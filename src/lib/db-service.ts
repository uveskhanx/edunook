import { 
  ref, get, set, push, update, onValue, 
  query, orderByChild, equalTo, remove, 
  runTransaction, onDisconnect, serverTimestamp 
} from 'firebase/database';
import { db } from './firebase';

// Types
export interface Profile {
  uid: string;
  username: string;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string | null;
  dob?: string | null;
  phone?: string | null;
  role: 'student' | 'admin' | 'educator';
  createdAt: string;
}

export interface Course {
  id: string;
  userId: string;
  title: string;
  slug: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  price: number;
  category: string;
  isPublished: boolean;
  views: number;
  createdAt: string;
  creatorName?: string;
  publisherName?: string;
  expiresInDays?: number | null;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface Video {
  id: string;
  courseId: string;
  title: string;
  videoUrl: string;
  position: number;
}

export interface Chapter {
  id: string;
  title: string;
  type: 'video' | 'link' | 'quiz';
  videoUrl?: string;
  pageUrl?: string;
  quizUrl?: string;
  position: number;
}

export interface TestRow {
  id: string;
  creatorId: string;
  title: string;
  slug: string;
  description: string;
  timeLimit: number; // in minutes
  totalQuestions: number;
  theme: 'dark' | 'neon' | 'gradient';
  createdAt: string;
  profiles?: Profile | null;
  questions?: Record<string, Question>;
  creatorName?: string;
}

export interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
}

export interface TestAttempt {
  id: string;
  testId: string;
  testTitle?: string;
  score: number;
  total: number;
  completedAt: string;
}

export interface Achievement {
  id: string;
  title: string;
  icon: string;
  earnedAt: string;
}

export interface Highlight {
  id: string;
  title: string;
  coverImage?: string;
  type: 'course' | 'achievement' | 'update';
  linkId?: string;
}

export interface Attempt {
  score: number;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: 'follow' | 'message';
  fromUid: string;
  text: string;
  createdAt: string;
  seen: boolean;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  updatedAt: string;
  unreadCounts?: Record<string, number>;
  typing?: Record<string, boolean>;
}

export interface Presence {
  status: 'online' | 'offline';
  lastSeen: string | object;
}

let profileCache: Record<string, Profile> = {};
let reverseUsernameMapCache: Record<string, string> | null = null;
let cachedAllProfiles: Profile[] | null = null;

// Service Functions
export const DbService = {
  // Helpers
  async ensureUsernameMapLoaded(): Promise<Record<string, string>> {
     return {}; // Removed aggressive offline caching
  },

  clearProfileCache(uid?: string) {
    if (uid) {
      delete profileCache[uid];
    } else {
      profileCache = {};
    }
  },

  // Profiles (Consolidated for /users and backward compat)
  async getProfile(uid: string, bypassCache = false): Promise<Profile | null> {
    if (!uid) return null;
    if (!bypassCache && profileCache[uid]) {
      return profileCache[uid];
    }

    try {
      // Fetch both nodes in parallel for speed and consistency
      const [userSnap, profSnap] = await Promise.all([
        get(ref(db, `users/${uid}`)),
        get(ref(db, `profiles/${uid}`))
      ]);

      if (!userSnap.exists() && !profSnap.exists()) {
        return null;
      }

      const userData = userSnap.exists() ? userSnap.val() : {};
      const profData = profSnap.exists() ? profSnap.val() : {};

      // Merge data: prioritize profiles but fallback to users
      const defaultName = userData.email ? userData.email.split('@')[0] : (userData.username || uid.substring(0, 8));

      const merged: Profile = {
        uid,
        username: profData.username || userData.username || uid.substring(0, 8),
        fullName: profData.fullName || profData.name || userData.fullName || userData.name || profData.username || userData.username || defaultName,
        avatarUrl: profData.avatarUrl || userData.avatarUrl || '',
        bio: profData.bio || userData.bio || '',
        followersCount: profData.followersCount || userData.followersCount || 0,
        followingCount: profData.followingCount || userData.followingCount || 0,
        ...profData // Ensure any other profile-specific fields are included
      };

      profileCache[uid] = merged;
      return merged;
    } catch (err) {
      console.warn(`[DbService] Profile merge failed for ${uid}:`, err);
      return profileCache[uid] || null;
    }
  },

  async updateProfile(uid: string, data: Partial<Profile>): Promise<void> {
    const path = await this.getProfilePath(uid);
    const existing = await this.getProfile(uid, true);
    
    // If username is changing, update the index
    if (data.username && existing && existing.username !== data.username) {
      const updates: Record<string, any> = {};
      updates[`usernames/${existing.username.toLowerCase()}`] = null;
      updates[`usernames/${data.username.toLowerCase()}`] = uid;
      await update(ref(db), updates);
    }

    await update(ref(db, `${path}/${uid}`), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
    
    // Update local cache synchronously
    if (profileCache[uid]) {
      profileCache[uid] = { ...profileCache[uid], ...data };
    }
  },

  async getProfilePath(uid: string): Promise<string> {
    const userSnapshot = await get(ref(db, `users/${uid}`));
    return userSnapshot.exists() ? 'users' : 'profiles';
  },

  async getAchievements(uid: string): Promise<Achievement[]> {
    const snapshot = await get(ref(db, `users/${uid}/achievements`));
    if (!snapshot.exists()) return [];
    
    const achievements: Achievement[] = [];
    snapshot.forEach((child) => {
      achievements.push({ id: child.key as string, ...child.val() });
    });
    // Sort so newest are likely first or based on earnedAt string, but for now just reverse
    return achievements.reverse();
  },

  async getHighlights(uid: string): Promise<Highlight[]> {
    const snapshot = await get(ref(db, `users/${uid}/highlights`));
    if (!snapshot.exists()) return [];
    
    const highlights: Highlight[] = [];
    snapshot.forEach((child) => {
      highlights.push({ id: child.key as string, ...child.val() });
    });
    return highlights.reverse();
  },

  async addHighlight(uid: string, highlight: Omit<Highlight, 'id'>): Promise<string> {
    const highlightsRef = ref(db, `users/${uid}/highlights`);
    const newRef = push(highlightsRef);
    await set(newRef, highlight);
    return newRef.key!;
  },

  async scaffoldPremiumProfileData(uid: string): Promise<void> {
    // No longer generating mock data.
    // Users start with a clean profile to maintain data integrity.
  },

  // Username Logic
  async checkUsernameAvailability(username: string): Promise<boolean> {
    const snapshot = await get(ref(db, `usernames/${username.toLowerCase()}`));
    return !snapshot.exists();
  },

  async suggestUsernames(base: string): Promise<string[]> {
    const suggestions: string[] = [];
    const suffixes = ['_01', '_123', '_official', '_genius', '_hub'];
    
    for (const suffix of suffixes) {
      const suggested = (base + suffix).toLowerCase();
      const isAvailable = await this.checkUsernameAvailability(suggested);
      if (isAvailable) suggestions.push(suggested);
      if (suggestions.length >= 3) break;
    }
    return suggestions;
  },

  async reserveUsernameTransaction(username: string, uid: string): Promise<boolean> {
    const usernameRef = ref(db, `usernames/${username.toLowerCase()}`);
    try {
      const result = await runTransaction(usernameRef, (currentValue) => {
        if (currentValue === null) {
          return uid; // Claim it
        }
        return; // Abort if exists
      });
      return result.committed;
    } catch (error) {
      console.error('Transaction failed:', error);
      return false;
    }
  },

  async releaseUsername(username: string): Promise<void> {
    await remove(ref(db, `usernames/${username.toLowerCase()}`));
  },

  async getEmailByUsername(username: string): Promise<string | null> {
    const snapshot = await get(ref(db, `usernames/${username.toLowerCase()}`));
    if (!snapshot.exists()) return null;
    
    // The value in /usernames is the UID
    const uid = snapshot.val();
    const profile = await this.getProfile(uid);
    return profile ? profile.email : null;
  },

  async uploadAvatar(uid: string, file: File): Promise<string> {
    const { uploadToCloudinary } = await import('./cloudinary');
    const result = await uploadToCloudinary(file, `edunook/avatars/${uid}`);
    return result.secure_url;
  },

  // Utilities
  slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')     // Replace spaces with -
      .replace(/[^\w-]+/g, '')   // Remove all non-word chars
      .replace(/--+/g, '-')      // Replace multiple - with single -
      .replace(/^-+/, '')        // Trim - from start of text
      .replace(/-+$/, '') + '-' + Math.random().toString(36).substring(2, 7); // Add small random suffix for uniqueness
  },

  async getUidByUsername(username: string): Promise<string | null> {
    const snapshot = await get(ref(db, `usernames/${username.toLowerCase()}`));
    return snapshot.exists() ? snapshot.val() : null;
  },

  async searchProfiles(queryText: string): Promise<Profile[]> {
    if (!queryText || !queryText.trim()) return [];
    
    // Ensure cache is populated
    if (!cachedAllProfiles) {
      try {
        const [uSnap, pSnap] = await Promise.all([
          get(ref(db, 'users')),
          get(ref(db, 'profiles'))
        ]);
        
        const users = uSnap.exists() ? Object.entries(uSnap.val()).map(([uid, data]: any) => ({ ...data, uid })) : [];
        const profiles = pSnap.exists() ? Object.entries(pSnap.val()).map(([uid, data]: any) => ({ ...data, uid })) : [];
        
        const all = [...users, ...profiles];
        // Deduplicate by UID
        cachedAllProfiles = Array.from(new Map(all.map(p => [p.uid, p])).values());
      } catch (err) {
        console.error('[DbService] Failed to load search cache:', err);
        return [];
      }
    }
    
    const lower = queryText.trim().toLowerCase();
    
    // Perform search
    return cachedAllProfiles.filter(p => {
      const username = (p.username || '').toLowerCase();
      const fullName = (p.fullName || '').toLowerCase();
      return username.includes(lower) || fullName.includes(lower);
    }).slice(0, 50); // Limit results for performance
  },

  // Courses
  async getCourses(filters?: { isPublished?: boolean; category?: string; userId?: string }): Promise<(Course & { profiles: Profile | null })[]> {
    const coursesRef = ref(db, 'courses');
    const snapshot = await get(coursesRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    let courses: Course[] = Object.keys(data).map(id => ({ ...data[id], id }));
    
    if (filters?.isPublished !== undefined) {
      courses = courses.filter(c => c.isPublished === filters.isPublished);
    }
    if (filters?.category) {
      courses = courses.filter(c => c.category === filters.category);
    }
    if (filters?.userId) {
      courses = courses.filter(c => c.userId === filters.userId);
    }
    
    const enriched = await Promise.all(courses.map(async (course) => {
      const profile = await this.getProfile(course.userId);
      return { ...course, profiles: profile };
    }));
    
    return enriched.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getCourse(idOrSlug: string): Promise<(Course & { profiles: Profile | null }) | null> {
    // 1. Try resolving by slug first
    const slugSnapshot = await get(ref(db, `course_slugs/${idOrSlug}`));
    const actualId = slugSnapshot.exists() ? slugSnapshot.val() : idOrSlug;

    const snapshot = await get(ref(db, `courses/${actualId}`));
    if (!snapshot.exists()) return null;
    const course = { ...snapshot.val(), id: actualId } as Course;
    const profile = await this.getProfile(course.userId);
    return { ...course, profiles: profile };
  },

  async createCourse(userId: string, data: Partial<Course>): Promise<string> {
    const coursesRef = ref(db, 'courses');
    const newCourseRef = push(coursesRef);
    const courseId = newCourseRef.key!;
    
    const slug = this.slugify(data.title || 'course');
    
    const courseData = {
      ...data,
      userId,
      id: courseId,
      slug: slug,
      isPublished: true,
      views: 0,
      createdAt: new Date().toISOString(),
      expiresInDays: data.expiresInDays || null,
    };

    const updates: Record<string, any> = {};
    updates[`courses/${courseId}`] = courseData;
    updates[`course_slugs/${slug}`] = courseId;
    
    await update(ref(db), updates);
    return courseId;
  },

  async incrementCourseViews(courseId: string): Promise<void> {
    const courseViewsRef = ref(db, `courses/${courseId}/views`);
    await runTransaction(courseViewsRef, (currentViews) => {
      return (currentViews || 0) + 1;
    });
  },

  async uploadThumbnail(userId: string, file: File): Promise<string> {
    const { uploadToCloudinary } = await import('./cloudinary');
    const result = await uploadToCloudinary(file, `edunook/thumbnails/${userId}`);
    return result.secure_url;
  },

  // Videos
  async getVideos(courseId: string): Promise<Video[]> {
    const videosRef = ref(db, `videos/${courseId}`);
    const snapshot = await get(videosRef);
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    return Object.keys(data)
      .map(id => ({ ...data[id], id } as Video))
      .sort((a, b) => a.position - b.position);
  },

  async uploadVideo(userId: string, courseId: string, file: File, index: number): Promise<string> {
    const { uploadToCloudinary } = await import('./cloudinary');
    const result = await uploadToCloudinary(file, `edunook/videos/${userId}/${courseId}`);
    return result.secure_url;
  },

  async addVideo(courseId: string, title: string, videoUrl: string, position: number): Promise<void> {
    const videosRef = ref(db, `videos/${courseId}`);
    const newVideoRef = push(videosRef);
    await set(newVideoRef, {
      courseId,
      title,
      videoUrl,
      position,
    });
  },

  // Chapters (Advanced Course Structure)
  async getChapters(courseId: string): Promise<Chapter[]> {
    const chaptersRef = ref(db, `chapters/${courseId}`);
    const snapshot = await get(chaptersRef);
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    return Object.keys(data)
      .map(id => ({ ...data[id], id } as Chapter))
      .sort((a, b) => a.position - b.position);
  },

  async addChapter(courseId: string, chapter: Omit<Chapter, 'id'>): Promise<string> {
    const chaptersRef = ref(db, `chapters/${courseId}`);
    const newRef = push(chaptersRef);
    
    // Defensive: Firebase cannot handle undefined. Clean non-existent values.
    const cleanChapter = Object.fromEntries(
      Object.entries(chapter).filter(([_, v]) => v !== undefined)
    );
    
    await set(newRef, cleanChapter);
    return newRef.key!;
  },

  // Chat Subscriptions
  subscribeToUserConversations(userId: string, callback: (convs: (Profile & { chatId: string; lastMessage?: string; updatedAt?: string; lastSenderId?: string; unreadCount?: number; isPinned?: boolean; isMuted?: boolean })[]) => void) {
    const userChatsRef = ref(db, `user_chats/${userId}`);
    const settingsRef = ref(db, `user_settings/${userId}`);
    
    return onValue(userChatsRef, async (snapshot) => {
      let pinned: Record<string, boolean> = {};
      let muted: Record<string, boolean> = {};

      try {
        const settingsSnap = await get(settingsRef);
        const settings = settingsSnap.exists() ? settingsSnap.val() : {};
        pinned = settings.pinned || {};
        muted = settings.muted || {};
      } catch (err) {
        console.warn("Could not load user settings (check Firebase rules):", err);
      }

      if (snapshot.exists()) {
        const chatIdsMap = snapshot.val();
        const chatIds = Object.keys(chatIdsMap);
        
        try {
          const myChats = await Promise.all(chatIds.map(async (id) => {
            try {
              const chatSnapshot = await get(ref(db, `chats/${id}`));
              if (!chatSnapshot.exists()) return null;
              
              const chat = chatSnapshot.val();
              const users = chat.users || {};
              const participants = Object.keys(users);
              const otherId = participants.find(uid => uid !== userId);
              if (!otherId) return null;
              
              const profile = await this.getProfile(otherId);
              return profile ? { 
                ...profile, 
                chatId: id, 
                lastMessage: chat.lastMessage, 
                updatedAt: chat.updatedAt,
                lastSenderId: chat.lastSenderId,
                unreadCount: chat.unreadCounts?.[userId] || 0,
                isPinned: !!pinned[id],
                isMuted: !!muted[id]
              } : null;
            } catch (innerErr) {
              console.warn(`Failed to process chat metadata for ${id}:`, innerErr);
              return null;
            }
          }));
          
          const filtered = myChats.filter(c => c !== null) as any[];
          // Sort: Pins first, then updated at
          filtered.sort((a, b) => {
             if (a.isPinned && !b.isPinned) return -1;
             if (!a.isPinned && b.isPinned) return 1;
             return (b.updatedAt || '').localeCompare(a.updatedAt || '');
          });
          callback(filtered);
        } catch (err) {
          console.error("Critical error processing chats list:", err);
          callback([]);
        }
      } else {
        callback([]);
      }
    });
  },

  subscribeToMessages(chatId: string, callback: (messages: Message[]) => void) {
    const messagesRef = ref(db, `messages/${chatId}`);
    return onValue(messagesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const msgList = Object.keys(data).map(id => ({ ...data[id], id }));
        callback(msgList.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      } else {
        callback([]);
      }
    });
  },

  async sendMessage(chatId: string, senderId: string, text: string): Promise<void> {
    const now = new Date().toISOString();
    const participants = chatId.split('_');
    const receiverId = participants.find(p => p !== senderId);

    // 1. Save message
    const messagesRef = ref(db, `messages/${chatId}`);
    const newMessageRef = push(messagesRef);
    await set(newMessageRef, {
      senderId,
      text,
      createdAt: now,
      seen: false
    });

    // 2. Update chat metadata and increment unread for receiver
    const updates: Record<string, any> = {};
    updates[`chats/${chatId}/lastMessage`] = text;
    updates[`chats/${chatId}/updatedAt`] = now;
    updates[`chats/${chatId}/lastSenderId`] = senderId;
    
    await update(ref(db), updates);

    // Increment unread count via transaction
    if (receiverId) {
      const unreadRef = ref(db, `chats/${chatId}/unreadCounts/${receiverId}`);
      await runTransaction(unreadRef, (count) => {
        return (count || 0) + 1;
      });
    }
  },

  async getOrCreateChat(uid1: string, uid2: string): Promise<string> {
    const chatId = [uid1, uid2].sort().join('_');
    const chatRef = ref(db, `chats/${chatId}`);
    const snapshot = await get(chatRef);
    
    if (!snapshot.exists()) {
      const now = new Date().toISOString();
      const chatData = {
        users: {
          [uid1]: true,
          [uid2]: true
        },
        createdAt: now,
        updatedAt: now,
        lastMessage: ''
      };

      // Create main chat metadata
      await set(chatRef, chatData);

      // Create performance indices (Production Upgrade)
      const updates: Record<string, any> = {};
      updates[`user_chats/${uid1}/${chatId}`] = true;
      updates[`user_chats/${uid2}/${chatId}`] = true;
      await update(ref(db), updates);
    }
    
    return chatId;
  },

  async togglePin(userId: string, chatId: string, isPinned: boolean): Promise<void> {
    const pinRef = ref(db, `user_settings/${userId}/pinned/${chatId}`);
    await set(pinRef, isPinned ? true : null);
  },

  async toggleMute(userId: string, chatId: string, isMuted: boolean): Promise<void> {
    const muteRef = ref(db, `user_settings/${userId}/muted/${chatId}`);
    await set(muteRef, isMuted ? true : null);
  },

  async markAsRead(chatId: string, userId: string): Promise<void> {
    const chatRef = ref(db, `chats/${chatId}/unreadCounts/${userId}`);
    await set(chatRef, 0);
  },

  async setTypingStatus(chatId: string, userId: string, isTyping: boolean): Promise<void> {
    const typingRef = ref(db, `chats/${chatId}/typing/${userId}`);
    await set(typingRef, isTyping);
    
    // Automatically clear after a while if the app crashes
    if (isTyping) {
      onDisconnect(typingRef).set(false);
    }
  },

  updatePresence(userId: string) {
    const userPresenceRef = ref(db, `presence/${userId}`);
    const connectedRef = ref(db, '.info/connected');

    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        // We are connected (or reconnected)!
        // When I disconnect, update the last time I was seen online
        onDisconnect(userPresenceRef).set({
          status: 'offline',
          lastSeen: serverTimestamp()
        });

        // The app is currently running, set to online
        set(userPresenceRef, {
          status: 'online',
          lastSeen: serverTimestamp()
        });
      }
    });
  },

  subscribeToPresence(userId: string, callback: (presence: Presence | null) => void) {
    const userPresenceRef = ref(db, `presence/${userId}`);
    return onValue(userPresenceRef, (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : null);
    });
  },

  subscribeToTyping(chatId: string, callback: (typing: Record<string, boolean>) => void) {
    const typingRef = ref(db, `chats/${chatId}/typing`);
    return onValue(typingRef, (snapshot) => {
      callback(snapshot.exists() ? snapshot.val() : {});
    });
  },

  async getChatMetadata(chatId: string): Promise<{ users: Record<string, boolean>; lastMessage?: string; updatedAt?: string } | null> {
    const snapshot = await get(ref(db, `chats/${chatId}`));
    return snapshot.exists() ? snapshot.val() : null;
  },

  // ===== FOLLOWERS SYSTEM =====

  async followUser(currentUid: string, targetUid: string): Promise<void> {
    const now = new Date().toISOString();
    const updates: Record<string, any> = {};
    updates[`followers/${targetUid}/${currentUid}`] = true;
    updates[`following/${currentUid}/${targetUid}`] = true;
    await update(ref(db), updates);

    // Create follow notification
    await this.createNotification(targetUid, {
      type: 'follow',
      fromUid: currentUid,
      text: 'started following you',
      createdAt: now,
      seen: false,
    });
  },

  async unfollowUser(currentUid: string, targetUid: string): Promise<void> {
    await remove(ref(db, `followers/${targetUid}/${currentUid}`));
    await remove(ref(db, `following/${currentUid}/${targetUid}`));
  },

  async isFollowing(currentUid: string, targetUid: string): Promise<boolean> {
    const snapshot = await get(ref(db, `following/${currentUid}/${targetUid}`));
    return snapshot.exists();
  },

  subscribeToFollowerCount(uid: string, callback: (count: number) => void) {
    return onValue(ref(db, `followers/${uid}`), (snapshot) => {
      callback(snapshot.exists() ? Object.keys(snapshot.val()).length : 0);
    });
  },

  subscribeToFollowingCount(uid: string, callback: (count: number) => void) {
    return onValue(ref(db, `following/${uid}`), (snapshot) => {
      callback(snapshot.exists() ? Object.keys(snapshot.val()).length : 0);
    });
  },

  // ===== NOTIFICATIONS SYSTEM =====

  async createNotification(targetUid: string, data: Omit<Notification, 'id'>): Promise<void> {
    const notifRef = ref(db, `notifications/${targetUid}`);
    const newRef = push(notifRef);
    await set(newRef, data);
  },

  subscribeToNotifications(uid: string, callback: (notifications: Notification[]) => void) {
    const notifRef = ref(db, `notifications/${uid}`);
    return onValue(notifRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list: Notification[] = Object.keys(data).map(id => ({ ...data[id], id }));
        callback(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } else {
        callback([]);
      }
    });
  },

  subscribeToUnseenCount(uid: string, callback: (count: number) => void) {
    const notifRef = ref(db, `notifications/${uid}`);
    return onValue(notifRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const unseen = Object.values(data).filter((n: any) => n.seen === false).length;
        callback(unseen);
      } else {
        callback(0);
      }
    });
  },

  async markNotificationsAsSeen(uid: string): Promise<void> {
    const snapshot = await get(ref(db, `notifications/${uid}`));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const updates: Record<string, any> = {};
      Object.keys(data).forEach(id => {
        if (data[id].seen === false) {
          updates[`notifications/${uid}/${id}/seen`] = true;
        }
      });
      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
      }
    }
  },

  // Tests
  async getAllTests(): Promise<(TestRow & { profiles: Profile | null })[]> {
    const testsRef = ref(db, 'tests');
    const snapshot = await get(testsRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    const tests = Object.keys(data).map(id => ({ ...data[id], id }));
    
    const enriched = await Promise.all(tests.map(async (test) => {
      const profile = await this.getProfile(test.creatorId);
      return { ...test, profiles: profile };
    }));
    
    return enriched.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  subscribeToTests(callback: (tests: (TestRow & { profiles: Profile | null })[]) => void) {
    const testsRef = ref(db, 'tests');
    return onValue(testsRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const tests = Object.keys(data).map(id => ({ ...data[id], id }));
        
        const enriched = await Promise.all(tests.map(async (test) => {
          const profile = await this.getProfile(test.creatorId);
          return { ...test, profiles: profile };
        }));
        
        callback(enriched.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      } else {
        callback([]);
      }
    });
  },

  async getTest(idOrSlug: string): Promise<TestRow | null> {
    const slugSnapshot = await get(ref(db, `test_slugs/${idOrSlug}`));
    const actualId = slugSnapshot.exists() ? slugSnapshot.val() : idOrSlug;

    const snapshot = await get(ref(db, `tests/${actualId}`));
    return snapshot.exists() ? { ...snapshot.val(), id: actualId } : null;
  },

  async createTest(creatorId: string, data: Partial<TestRow>): Promise<string> {
    const testsRef = ref(db, 'tests');
    const newTestRef = push(testsRef);
    const testId = newTestRef.key!;
    
    const slug = this.slugify(data.title || 'test');
    
    const testData = {
      ...data,
      creatorId,
      id: testId,
      slug: slug,
      createdAt: new Date().toISOString()
    };

    const updates: Record<string, any> = {};
    updates[`tests/${testId}`] = testData;
    updates[`test_slugs/${slug}`] = testId;
    
    await update(ref(db), updates);
    return testId;
  },

  async getQuestions(testId: string): Promise<Question[]> {
    const ref_ = ref(db, `tests/${testId}/questions`);
    const snapshot = await get(ref_);
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    return Object.keys(data).map(id => ({ 
      id, 
      questionText: data[id].questionText,
      options: data[id].options || [],
      correctAnswer: data[id].correctAnswer ?? 0
    }));
  },

  async saveTestAttempt(uid: string, attempt: Omit<TestAttempt, 'id'>): Promise<void> {
    const attemptsRef = ref(db, `test_attempts/${uid}`);
    const newAttemptRef = push(attemptsRef);
    await set(newAttemptRef, {
      ...attempt,
      id: newAttemptRef.key
    });
  },

  async getTestAttempts(uid: string): Promise<TestAttempt[]> {
    const attemptsRef = ref(db, `test_attempts/${uid}`);
    const snapshot = await get(attemptsRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    return Object.keys(data)
      .map(id => ({ ...data[id], id } as TestAttempt))
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  },

  // Leaderboards
  async saveLeaderboardEntry(testId: string, uid: string, entry: { score: number; timeTaken: number; name: string; avatar?: string | null }) {
    const leaderboardRef = ref(db, `leaderboards/${testId}/${uid}`);
    await set(leaderboardRef, {
      ...entry,
      completedAt: new Date().toISOString()
    });
  },

  subscribeToLeaderboard(testId: string, callback: (rankings: any[]) => void) {
    const leaderboardRef = ref(db, `leaderboards/${testId}`);
    return onValue(leaderboardRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map(uid => ({ uid, ...data[uid] }));
        
        // Sort: 1. Score (Desc), 2. Time Taken (Asc), 3. CompletedAt (Asc)
        list.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (a.timeTaken !== b.timeTaken) return a.timeTaken - b.timeTaken;
          return a.completedAt.localeCompare(b.completedAt);
        });
        
        callback(list);
      } else {
        callback([]);
      }
    });
  },

  // Attempts
  async getAttempt(testId: string, userId: string): Promise<Attempt | null> {
    const snapshot = await get(ref(db, `attempts/${testId}/${userId}`));
    return snapshot.exists() ? snapshot.val() : null;
  },

  async saveAttempt(testId: string, userId: string, score: number): Promise<void> {
    const attemptRef = ref(db, `attempts/${testId}/${userId}`);
    await set(attemptRef, {
      score,
      createdAt: new Date().toISOString(),
    });
  },

  // ===== EXPLORE & TRENDING =====

  async getTrendingCourses(limit: number = 20): Promise<(Course & { profiles: Profile | null; trendingScore: number; isNew: boolean })[]> {
    const courses = await this.getCourses({ isPublished: true });
    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

    // Get follower counts for each creator
    const creatorUids = [...new Set(courses.map(c => c.userId))];
    const followerCounts: Record<string, number> = {};
    
    await Promise.all(creatorUids.map(async (uid) => {
      const snapshot = await get(ref(db, `followers/${uid}`));
      followerCounts[uid] = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    }));

    // Score each course
    const scored = courses.map(course => {
      const creatorFollowers = followerCounts[course.userId] || 0;
      const isFree = course.price === 0;
      const courseAge = now - new Date(course.createdAt).getTime();
      const isNew = courseAge < THREE_DAYS;
      const recentBonus = isNew ? 20 : 0;
      
      const trendingScore = (creatorFollowers * 2) + (isFree ? 10 : 0) + recentBonus;

      return { ...course, trendingScore, isNew };
    });

    // Sort by score descending, take limit
    scored.sort((a, b) => b.trendingScore - a.trendingScore);
    return scored.slice(0, limit);
  },

  async getGlobalStats(): Promise<{ experts: number; enrollments: number; trophies: number }> {
    const [testsSnap, attemptsSnap] = await Promise.all([
      get(ref(db, 'tests')),
      get(ref(db, 'attempts'))
    ]);

    const tests = testsSnap.exists() ? Object.values(testsSnap.val()) as any[] : [];
    const uniqueExperts = new Set(tests.map(t => t.creatorId)).size;

    let totalEnrollments = 0;
    let totalPerfectScores = 0;

    if (attemptsSnap.exists()) {
      const allAttemptsMap = attemptsSnap.val();
      Object.keys(allAttemptsMap).forEach(testId => {
        const testAttempts = Object.values(allAttemptsMap[testId]) as any[];
        totalEnrollments += testAttempts.length;
        totalPerfectScores += testAttempts.filter(a => a.score >= 100).length;
      });
    }

    return {
      experts: uniqueExperts,
      enrollments: totalEnrollments,
      trophies: totalPerfectScores
    };
  },

  async getTopCreators(limit: number = 12): Promise<(Profile & { followersCount: number })[]> {
    // Get all users from both nodes
    const [uSnap, pSnap] = await Promise.all([
      get(ref(db, 'users')),
      get(ref(db, 'profiles'))
    ]);
    
    const users = uSnap.exists() ? Object.values(uSnap.val()) as Profile[] : [];
    const profiles = pSnap.exists() ? Object.values(pSnap.val()) as Profile[] : [];
    
    // Deduplicate by UID (preferring 'users' node data as it's newer)
    const allProfilesMap = new Map<string, Profile>();
    profiles.forEach(p => allProfilesMap.set(p.uid, p));
    users.forEach(u => allProfilesMap.set(u.uid, u));
    const allProfiles = Array.from(allProfilesMap.values());

    // Get follower counts
    const followersSnapshot = await get(ref(db, 'followers'));
    const followersData = followersSnapshot.exists() ? followersSnapshot.val() : {};

    const enriched = allProfiles.map(user => ({
      ...user,
      followersCount: followersData[user.uid] ? Object.keys(followersData[user.uid]).length : 0,
    }));

    // Sort by followers descending, take limit
    enriched.sort((a, b) => b.followersCount - a.followersCount);
    return enriched.slice(0, limit);
  }
};
