/* eslint-disable @typescript-eslint/no-explicit-any */
import { 
  ref, get, set, push, update, onValue,
  remove, query, orderByChild, equalTo,
  runTransaction, onDisconnect, serverTimestamp 
} from 'firebase/database';
import { db } from './firebase';
import { getAuth } from 'firebase/auth';
import { sendFeedbackEmailAction } from './client-actions';

// Types
export interface UserPreferences {
  notifications: {
    followers: boolean;
    courseUpdates: boolean;
    quizResults: boolean;
  };
  learning: {
    categories: string[];
    language: string;
    suggestions: boolean;
  };
  app: {
    darkMode: boolean;
    theme: 'dark' | 'light';
    reduceAnimations: boolean;
    dataSaver: boolean;
  };
  privacy: {
    showOnlineStatus: boolean;
    showReadReceipts: boolean;
    allowStrangerMessages: boolean;
  };
}

export interface Subscription {
  planId: 'none' | 'spark' | 'edge';
  billingCycle: 'monthly' | 'yearly';
  status: 'active' | 'expired';
  subscribedAt: string;
  expiresAt: string;
  lastNotifiedDaysRemaining?: number;
}

export interface CommunityTheme {
  id: string;
  url: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
}

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
  preferences?: UserPreferences;
  subscription?: Subscription;
  followersCount?: number;
  followingCount?: number;
  theme?: any;
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
  language: string;
}

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file';
  createdAt: string;
  seen?: boolean;
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
  isFreeDemo?: boolean;
}

export interface TestRow {
  id: string;
  creatorId: string;
  title: string;
  description?: string;
  slug: string;
  timeLimit: number; // in minutes
  totalQuestions: number;
  theme: 'dark' | 'neon' | 'emerald' | 'royal' | 'crimson';
  createdAt: string;
  activeStartAt?: string;
  expiresAt?: string;
  resultAnnounceAt?: string; // ISO string or 'immediate'
  profiles?: Profile | null;
  questions?: Record<string, Question>;
  creatorName?: string;
}

export interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  hint?: string;
}

export interface TestAttempt {
  id: string;
  testId: string;
  testTitle?: string;
  score: number;
  total: number;
  completedAt: string;
  answers?: Record<string, number>;
  hintsUsed?: string[];
  timeTaken?: number;
  timeTakenCentiseconds?: number;
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

export interface CourseReview {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  profiles?: Profile | null;
}

export interface Notification {
  id: string;
  type: 'follow' | 'system' | 'update' | 'test' | 'quiz' | 'review' | 'chat' | 'message';
  fromUid: string;
  text: string;
  createdAt: string;
  seen: boolean;
}

export interface Report {
  id?: string;
  targetId: string;
  targetName: string;
  targetType: 'user' | 'course' | 'chat';
  reason: string;
  description: string;
  timestamp: number;
  reporterId?: string;
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

export interface TeacherPaymentSettings {
  razorpay_account_id: string;
  updatedAt?: string;
}

let profileCache: Record<string, Profile> = {};
let cachedAllProfiles: Profile[] | null = null;

type FirebaseObject = Record<string, any>;

const PUBLIC_PROFILE_KEYS = [
  'uid',
  'username',
  'fullName',
  'avatarUrl',
  'bio',
  'role',
  'createdAt',
  'subscription',
  'followersCount',
  'followingCount',
  'theme',
  'publicThemes',
] as const;

function pickPublicProfile(data: Partial<Profile> & FirebaseObject): FirebaseObject {
  const clean: FirebaseObject = {};
  PUBLIC_PROFILE_KEYS.forEach((key) => {
    if (data[key] !== undefined) clean[key] = data[key];
  });
  return clean;
}

/**
 * Validates if a string is a valid Firebase Realtime Database key.
 * Keys cannot contain ".", "#", "$", "[", or "]"
 */
function isValidFirebaseKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  return !/[.#$[\]]/.test(key);
}

async function readNode<T = FirebaseObject>(path: string): Promise<T | null> {
  try {
    // Validate path segments to prevent "invalid path" crashes
    const segments = path.split('/');
    if (segments.some(s => s && !isValidFirebaseKey(s))) {
      console.warn(`[DbService] Blocked read for invalid path: ${path}`);
      return null;
    }

    const snapshot = await get(ref(db, path));
    return snapshot.exists() ? snapshot.val() as T : null;
  } catch (err) {
    console.warn(`[DbService] Unable to read ${path}:`, err);
    return null;
  }
}

async function migratePrivateProfileFields(uid: string, publicProfile: FirebaseObject | null) {
  if (!publicProfile) return;

  const updates: FirebaseObject = {};
  ['email', 'realEmail', 'dob', 'phone'].forEach((key) => {
    if (publicProfile[key] !== undefined) {
      updates[`users/${uid}/${key}`] = publicProfile[key];
      updates[`profiles/${uid}/${key}`] = null;
    }
  });

  if (publicProfile.preferences !== undefined) {
    updates[`user_settings/${uid}/preferences`] = publicProfile.preferences;
    updates[`profiles/${uid}/preferences`] = null;
  }
  if (publicProfile.history !== undefined) {
    updates[`user_settings/${uid}/history`] = publicProfile.history;
    updates[`profiles/${uid}/history`] = null;
  }

  if (Object.keys(updates).length > 0) {
    try {
      await update(ref(db), updates);
    } catch (err) {
      console.warn(`[DbService] Unable to clean private profile fields for ${uid}:`, err);
    }
  }
}

const normalizeLeaderboardEntry = (uid: string, raw: any = {}, quizTotalQuestions?: number) => {
  const storedScore = typeof raw.score === 'number' ? raw.score : 0;
  const totalQuestions = typeof raw.totalQuestions === 'number' && raw.totalQuestions > 0
    ? raw.totalQuestions
    : quizTotalQuestions;
  const correctAnswers = typeof raw.correctAnswers === 'number'
    ? raw.correctAnswers
    : totalQuestions
      ? storedScore > totalQuestions
        ? Math.min(totalQuestions, Math.round((storedScore / 100) * totalQuestions))
        : storedScore
      : storedScore;
  const timeTakenCentiseconds = typeof raw.timeTakenCentiseconds === 'number'
    ? raw.timeTakenCentiseconds
    : typeof raw.timeTakenMs === 'number'
      ? Math.round(raw.timeTakenMs / 10)
      : typeof raw.timeTaken === 'number'
        ? Math.round(raw.timeTaken * 100)
        : Number.MAX_SAFE_INTEGER;
  const accuracy = typeof raw.accuracy === 'number'
    ? raw.accuracy
    : totalQuestions
      ? Math.round((correctAnswers / totalQuestions) * 100)
      : storedScore;

  return {
    uid,
    ...raw,
    score: correctAnswers,
    correctAnswers,
    totalQuestions,
    accuracy,
    timeTaken: Number((timeTakenCentiseconds / 100).toFixed(2)),
    timeTakenCentiseconds,
    completedAt: raw.completedAt || new Date(0).toISOString()
  };
};

// Service Functions
export const DbService = {
  updatePresence(userId: string, showOnlineStatus: boolean = true) {
    const userPresenceRef = ref(db, `presence/${userId}`);
    if (!showOnlineStatus) {
      remove(userPresenceRef);
      return;
    }
    onValue(ref(db, '.info/connected'), (snap) => {
      if (snap.val() === true) {
        onDisconnect(userPresenceRef).set({ status: 'offline', lastSeen: serverTimestamp() });
        set(userPresenceRef, { status: 'online', lastSeen: serverTimestamp() });
      }
    });
  },

  subscribeToPresence(userId: string, callback: (presence: Presence | null) => void) {
    return onValue(ref(db, `presence/${userId}`), (snapshot) => callback(snapshot.exists() ? snapshot.val() : null));
  },

  subscribeToTyping(chatId: string, callback: (typing: Record<string, boolean>) => void) {
    return onValue(ref(db, `chats/${chatId}/typing`), (snapshot) => callback(snapshot.exists() ? snapshot.val() : {}));
  },

  async getChatMetadata(chatId: string): Promise<{ users: Record<string, boolean>; lastMessage?: string; updatedAt?: string } | null> {
    const snapshot = await get(ref(db, `chats/${chatId}`));
    return snapshot.exists() ? snapshot.val() : null;
  },

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
    const currentUid = getAuth().currentUser?.uid;
    const shouldReadPrivateNodes = currentUid === uid;
    if (!bypassCache && profileCache[uid] && (!shouldReadPrivateNodes || profileCache[uid].preferences)) {
      return profileCache[uid];
    }

    try {
      const [publicProfile, privateUser, privateSettings] = await Promise.all([
        readNode<FirebaseObject>(`profiles/${uid}`),
        shouldReadPrivateNodes ? readNode<FirebaseObject>(`users/${uid}`) : Promise.resolve(null),
        shouldReadPrivateNodes ? readNode<FirebaseObject>(`user_settings/${uid}`) : Promise.resolve(null),
      ]);

      if (!publicProfile && !privateUser) {
        return null;
      }

      const userData = privateUser || {};
      const profData = publicProfile || {};
      if (shouldReadPrivateNodes) {
        await migratePrivateProfileFields(uid, publicProfile);
      }

      const settingsData = privateSettings || {};
      const mergedData: FirebaseObject = {
        ...userData,
        ...profData,
        preferences: settingsData.preferences || userData.preferences || (shouldReadPrivateNodes ? profData.preferences : undefined),
      };

      // Merge data: prioritize profiles but fallback to users
      const defaultName = userData.email ? userData.email.split('@')[0] : (mergedData.username || uid.substring(0, 8));

      // Auto-heal logic: If a previous bug accidentally saved the UID as the public username,
      // restore the correct username from the private users node.
      let resolvedUsername = mergedData.username;
      if (resolvedUsername === uid && userData.username && userData.username !== uid) {
        resolvedUsername = userData.username;
        // Background heal: fix the corrupted public username (fire-and-forget)
        update(ref(db, `profiles/${uid}`), { username: resolvedUsername }).catch(() => {});
      }

      const merged: Profile = {
        uid,
        username: resolvedUsername || uid.substring(0, 8),
        fullName: mergedData.fullName || mergedData.name || mergedData.username || defaultName,
        email: userData.email || mergedData.email || '',
        avatarUrl: mergedData.avatarUrl || '',
        bio: mergedData.bio || '',
        followersCount: mergedData.followersCount || 0,
        followingCount: mergedData.followingCount || 0,
        role: mergedData.role || 'student',
        createdAt: mergedData.createdAt || new Date().toISOString(),
        ...mergedData,
      };

      profileCache[uid] = merged;
      return merged;
    } catch (err) {
      console.warn(`[DbService] Profile merge failed for ${uid}:`, err);
      return profileCache[uid] || null;
    }
  },

  async updateProfile(uid: string, profile: Partial<Profile>) {
    const userRef = ref(db, `profiles/${uid}`);
    await update(userRef, {
      ...pickPublicProfile(profile as Partial<Profile> & FirebaseObject),
      updatedAt: new Date().toISOString(),
    });
    this.clearProfileCache(uid);
  },

  async updatePreferences(uid: string, preferences: Partial<UserPreferences>) {
    const prefRef = ref(db, `user_settings/${uid}/preferences`);
    await update(prefRef, preferences);
    this.clearProfileCache(uid);
  },

  // ===== ENROLLMENT SYSTEM =====

  async isEnrolled(courseId: string, userId: string): Promise<boolean> {
    const enrollRef = ref(db, `enrollments/${courseId}/${userId}`);
    const snapshot = await get(enrollRef);
    return snapshot.exists();
  },

  async enrollInCourse(courseId: string, userId: string, data: Record<string, any> = {}): Promise<void> {
    const enrollRef = ref(db, `enrollments/${courseId}/${userId}`);
    
    // 1. Detect device type from userAgent
    let device = 'Desktop';
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (/tablet|ipad|playbook|silk/i.test(ua)) device = 'Tablet';
      else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) device = 'Mobile';
    }

    // 2. Determine age bracket (Anonymized for privacy)
    let ageBracket = 'Unknown';
    try {
      const profile = await this.getProfile(userId);
      if (profile?.dob) {
        const birth = new Date(profile.dob);
        const age = Math.floor((new Date().getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age >= 45) ageBracket = '45+';
        else if (age >= 35) ageBracket = '35-44';
        else if (age >= 25) ageBracket = '25-34';
        else if (age >= 18) ageBracket = '18-24';
        else if (age >= 13) ageBracket = '13-17';
        else if (age >= 3) ageBracket = '3-12';
      }
    } catch (err) {
      console.warn('[DbService] Could not determine age for enrollment:', err);
    }

    await set(enrollRef, {
      enrolledAt: new Date().toISOString(),
      device,
      ageBracket,
      ...data
    });
  },

  async updateSubscription(uid: string, subscription: Subscription) {
    const subRef = ref(db, `profiles/${uid}/subscription`);
    await set(subRef, subscription);
  },

  async uploadCommunityTheme(uid: string, fullName: string, file: File): Promise<string> {
    const url = await this.uploadAvatar(uid, file); // Reuse uploadAvatar logic for themes
    const themeRef = push(ref(db, 'community_themes'));
    const themeData: CommunityTheme = {
      id: themeRef.key!,
      url,
      creatorId: uid,
      creatorName: fullName,
      createdAt: new Date().toISOString()
    };
    await set(themeRef, themeData);
    return url;
  },

  async getCommunityThemes(): Promise<CommunityTheme[]> {
    const snapshot = await get(ref(db, 'community_themes'));
    if (!snapshot.exists()) return [];
    const data = snapshot.val();
    return Object.keys(data).map(id => ({ ...data[id], id }));
  },

  async getTeacherPaymentSettings(uid: string): Promise<TeacherPaymentSettings> {
    const data = await readNode<TeacherPaymentSettings>(`teachers/${uid}`);
    return {
      razorpay_account_id: data?.razorpay_account_id || '',
      updatedAt: data?.updatedAt,
    };
  },

  async updateTeacherPaymentSettings(uid: string, settings: TeacherPaymentSettings): Promise<void> {
    const accountId = settings.razorpay_account_id.trim();
    if (accountId && !/^acc_[A-Za-z0-9]{8,}$/.test(accountId)) {
      throw new Error('Enter a valid Razorpay linked account ID. It usually starts with acc_.');
    }

    await update(ref(db, `teachers/${uid}`), {
      razorpay_account_id: accountId || null,
      updatedAt: new Date().toISOString(),
    });
  },

  // ===== HISTORY SYSTEM =====

  async addToHistory(userId: string, courseId: string, chapterId: string) {
    const historyRef = ref(db, `user_settings/${userId}/history/${courseId}`);
    await set(historyRef, {
      chapterId,
      lastVisited: new Date().toISOString()
    });
  },

  async removeFromHistory(userId: string, courseId: string) {
    const historyRef = ref(db, `user_settings/${userId}/history/${courseId}`);
    await remove(historyRef);
  },

  async getHistory(userId: string): Promise<Record<string, { chapterId: string, lastVisited: string }>> {
    const historyRef = ref(db, `user_settings/${userId}/history`);
    const snap = await get(historyRef);
    return snap.exists() ? snap.val() : {};
  },

  async updateProfileData(uid: string, data: Partial<Profile>): Promise<void> {
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
    const snapshot = await get(ref(db, `profiles/${uid}/achievements`));
    const privateSnapshot = !snapshot.exists() && getAuth().currentUser?.uid === uid
      ? await get(ref(db, `users/${uid}/achievements`))
      : null;
    const source = snapshot.exists() ? snapshot : privateSnapshot;
    if (!source?.exists()) return [];
    
    const achievements: Achievement[] = [];
    source.forEach((child) => {
      achievements.push({ id: child.key as string, ...child.val() });
    });
    // Sort so newest are likely first or based on earnedAt string, but for now just reverse
    return achievements.reverse();
  },

  async getHighlights(uid: string): Promise<Highlight[]> {
    const snapshot = await get(ref(db, `profiles/${uid}/highlights`));
    const privateSnapshot = !snapshot.exists() && getAuth().currentUser?.uid === uid
      ? await get(ref(db, `users/${uid}/highlights`))
      : null;
    const source = snapshot.exists() ? snapshot : privateSnapshot;
    if (!source?.exists()) return [];
    
    const highlights: Highlight[] = [];
    source.forEach((child) => {
      highlights.push({ id: child.key as string, ...child.val() });
    });
    return highlights.reverse();
  },

  async addHighlight(uid: string, highlight: Omit<Highlight, 'id'>): Promise<string> {
    const highlightsRef = ref(db, `profiles/${uid}/highlights`);
    const newRef = push(highlightsRef);
    await set(newRef, highlight);
    return newRef.key!;
  },

  async scaffoldPremiumProfileData(_uid: string): Promise<void> {
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
  isValidFirebaseKey(key: string): boolean {
    return /^[^.$#[\]/]+$/.test(key);
  },

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
    if (!isValidFirebaseKey(username)) return null;
    const snapshot = await get(ref(db, `usernames/${username.toLowerCase()}`));
    return snapshot.exists() ? snapshot.val() : null;
  },

  async searchProfiles(queryText: string): Promise<Profile[]> {
    if (!queryText || !queryText.trim()) return [];
    
    // Ensure cache is populated
    if (!cachedAllProfiles) {
      try {
        const pSnap = await get(ref(db, 'profiles'));
        const profiles = pSnap.exists() ? Object.entries(pSnap.val()).map(([uid, data]: any) => ({ ...data, uid })) : [];
        
        // Deduplicate by UID (though profiles should already be unique by UID)
        cachedAllProfiles = Array.from(new Map(profiles.map(p => [p.uid, p])).values());
      } catch (err) {
        console.error('[DbService] Failed to load search cache:', err);
        return [];
      }
    }
    
    const lower = queryText.trim().toLowerCase();
    
    // Perform search
    return (cachedAllProfiles || []).filter(p => {
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
      return { 
        ...course, 
        profiles: profile,
        publisherName: profile?.fullName || course.publisherName || course.creatorName || ''
      };
    }));
    
    return enriched.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getCourse(idOrSlug: string): Promise<(Course & { profiles: Profile | null }) | null> {
    let actualId = idOrSlug;

    try {
      const slugQuery = query(ref(db, 'courses'), orderByChild('slug'), equalTo(idOrSlug));
      const slugMatchSnapshot = await get(slugQuery);
      if (slugMatchSnapshot.exists()) {
        const [matchedCourseId] = Object.keys(slugMatchSnapshot.val() || {});
        if (matchedCourseId) {
          actualId = matchedCourseId;
        }
      }
    } catch (err) {
      console.warn(`[DbService] courses slug query failed for ${idOrSlug}:`, err);
    }

    const snapshot = await get(ref(db, `courses/${actualId}`));
    if (!snapshot.exists()) return null;
    const course = { ...snapshot.val(), id: actualId } as Course;
    const profile = await this.getProfile(course.userId);
    return { ...course, profiles: profile };
  },

  async deleteChapter(courseId: string, chapterId: string): Promise<void> {
    await remove(ref(db, `chapters/${courseId}/${chapterId}`));
  },

  async createCourse(userId: string, data: Partial<Course>): Promise<{ id: string; slug: string }> {
    const coursesRef = ref(db, 'courses');
    const newCourseRef = push(coursesRef);
    const courseId = newCourseRef.key!;
    
    const slug = this.slugify(data.title || 'course');
    
    const profile = await this.getProfile(userId);
    const publisherName = profile?.fullName || 'Educator';

    const courseData = {
      ...data,
      userId,
      id: courseId,
      slug: slug,
      isPublished: true,
      views: 0,
      createdAt: new Date().toISOString(),
      expiresInDays: data.expiresInDays || null,
      publisherName,
      language: data.language || 'English',
    };

    await set(ref(db, `courses/${courseId}`), courseData);
    await set(ref(db, `course_slugs/${slug}`), courseId);
    return { id: courseId, slug };
  },

  async createFeedback(userId: string, data: { type: string; message: string; email: string; username: string }) {
    await sendFeedbackEmailAction({ data });
  },

  /**
   * Backfills publisherName on all courses by this user that are missing it.
   * Called once per login to self-heal old data.
   */
  async backfillCoursePublisherNames(uid: string, fullName: string): Promise<void> {
    try {
      const coursesRef = ref(db, 'courses');
      const snapshot = await get(coursesRef);
      if (!snapshot.exists()) return;

      const data = snapshot.val();
      const batchUpdates: Record<string, any> = {};

      Object.keys(data).forEach(courseId => {
        const course = data[courseId];
        if (course.userId === uid && !course.publisherName) {
          batchUpdates[`courses/${courseId}/publisherName`] = fullName;
        }
      });

      if (Object.keys(batchUpdates).length > 0) {
        await update(ref(db), batchUpdates);

      }
    } catch (err) {
      console.warn('[DbService] backfillCoursePublisherNames failed:', err);
    }
  },

  async incrementCourseViews(courseId: string, userId?: string): Promise<void> {
    try {
      // 1. Session Throttling (Client-side immediate prevention)
      const sessionKey = `viewed_${courseId}`;
      if (sessionStorage.getItem(sessionKey)) return;
      sessionStorage.setItem(sessionKey, 'true');

      // 2. Persistent Unique Check (Database level)
      if (userId) {
        const uniqueViewRef = ref(db, `unique_views/${courseId}/${userId}`);
        const snapshot = await get(uniqueViewRef);
        if (snapshot.exists()) return; // Already counted permanently
        
        // Mark as viewed in database
        await set(uniqueViewRef, { 
          viewedAt: serverTimestamp(),
          platform: 'web'
        });
      }

      // 3. Increment Atomic Counter
      const courseViewsRef = ref(db, `courses/${courseId}/views`);
      await runTransaction(courseViewsRef, (currentViews) => {
        return (currentViews || 0) + 1;
      });
    } catch (err) {
      console.warn('[DbService] incrementCourseViews throttled or failed:', err);
    }
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

  async uploadVideo(userId: string, courseId: string, file: File, _index: number): Promise<string> {
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
    if (!isValidFirebaseKey(userId)) { callback([]); return () => {}; }
    const userChatsRef = ref(db, `user_chats/${userId}`);
    const settingsRef = ref(db, `user_settings/${userId}`);
    
    // Cache snapshots to re-process cleanly
    let latestChatsSnapshot: any = null;
    let latestSettings: { pinned: Record<string, boolean>; muted: Record<string, boolean>; deletedChats: Record<string, string> } = { pinned: {}, muted: {}, deletedChats: {} };
    const chatMetadataUnsubs = new Map<string, () => void>();
    let processing = false;
    let needsUpdate = false;

    const processConversations = async () => {
      if (processing) {
        needsUpdate = true;
        return;
      }
      
      processing = true;
      needsUpdate = false;
      
      try {
        const snapshot = latestChatsSnapshot;
        const { pinned, muted, deletedChats } = latestSettings;
        
        if (!snapshot || !snapshot.exists()) {
          callback([]);
          return;
        }
        
        const chatIdsMap = snapshot.val();
        const chatIds = Object.keys(chatIdsMap);
        
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
        
        const filtered = myChats.filter(c => {
           if (c === null) return false;
           const deletedAt = deletedChats[c.chatId];
           if (deletedAt && c.updatedAt && c.updatedAt <= deletedAt) {
               return false;
           }
           return true;
        }) as any[];
        
        filtered.sort((a, b) => {
           if (a.isPinned && !b.isPinned) return -1;
           if (!a.isPinned && b.isPinned) return 1;
           return (b.updatedAt || '').localeCompare(a.updatedAt || '');
        });
        
        callback(filtered);
      } catch (err) {
        console.error("Critical error processing chats list:", err);
        callback([]);
      } finally {
        processing = false;
        // If an update was requested while we were busy, run it now
        if (needsUpdate) {
          processConversations();
        }
      }
    };

    const unsubChats = onValue(userChatsRef, (snapshot) => {
      latestChatsSnapshot = snapshot;
      const chatIds = snapshot.exists() ? Object.keys(snapshot.val()) : [];
      const activeChatIds = new Set(chatIds);

      chatMetadataUnsubs.forEach((unsubscribe, chatId) => {
        if (!activeChatIds.has(chatId)) {
          unsubscribe();
          chatMetadataUnsubs.delete(chatId);
        }
      });

      chatIds.forEach(chatId => {
        if (chatMetadataUnsubs.has(chatId)) return;
        const unsubscribe = onValue(ref(db, `chats/${chatId}`), () => {
          processConversations();
        });
        chatMetadataUnsubs.set(chatId, unsubscribe);
      });

      processConversations();
    });

    const unsubSettings = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const settings = snapshot.val();
        latestSettings = {
          pinned: settings.pinned || {},
          muted: settings.muted || {},
          deletedChats: settings.deletedChats || {},
        };
      } else {
        latestSettings = { pinned: {}, muted: {}, deletedChats: {} };
      }
      if (latestChatsSnapshot) {
        processConversations();
      }
    });

    return () => {
      unsubChats();
      unsubSettings();
      chatMetadataUnsubs.forEach(unsubscribe => unsubscribe());
      chatMetadataUnsubs.clear();
    };
  },

  subscribeToMessages(chatId: string, userId: string, callback: (messages: Message[]) => void) {
    if (!isValidFirebaseKey(chatId) || !isValidFirebaseKey(userId)) { callback([]); return () => {}; }
    const messagesRef = ref(db, `messages/${chatId}`);
    const settingsRef = ref(db, `user_settings/${userId}/deletedChats/${chatId}`);
    
    let deletedAtThreshold: string | null = null;
    let deletedMessageIds: Record<string, boolean> = {};
    let latestMessagesSnapshot: any = null;

    const processMessages = () => {
      if (latestMessagesSnapshot && latestMessagesSnapshot.exists()) {
        const data = latestMessagesSnapshot.val();
        let msgList = Object.keys(data).map(id => ({ ...data[id], id }));
        
        if (deletedAtThreshold) {
          msgList = msgList.filter(msg => msg.createdAt > deletedAtThreshold!);
        }

        // Filter out individual messages deleted for me
        msgList = msgList.filter(msg => !deletedMessageIds[msg.id]);
        
        callback(msgList.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      } else {
        callback([]);
      }
    };

    // Listen to raw messages
    const unsubMsgs = onValue(messagesRef, (snapshot) => {
      latestMessagesSnapshot = snapshot;
      processMessages();
    });

    // Listen to deletion threshold and individual deleted messages
    const unsubSettings = onValue(ref(db, `user_settings/${userId}/deletedChats/${chatId}`), (snap) => {
      deletedAtThreshold = snap.exists() ? snap.val() : null;
      processMessages();
    });

    const unsubDeletedMsgs = onValue(ref(db, `user_settings/${userId}/deletedMessages/${chatId}`), (snap) => {
      deletedMessageIds = snap.exists() ? snap.val() : {};
      processMessages();
    });
    
    return () => {
        unsubMsgs();
        unsubSettings();
        unsubDeletedMsgs();
    };
  },

  async sendMessage(chatId: string, senderId: string, text?: string, media?: { url: string, type: 'image' | 'video' | 'file' }): Promise<string> {
    const messagesRef = ref(db, `messages/${chatId}`);
    const newMessageRef = push(messagesRef);
    const now = new Date().toISOString();

    await set(newMessageRef, {
      id: newMessageRef.key,
      senderId,
      text: text || '',
      mediaUrl: media?.url || null,
      mediaType: media?.type || null,
      createdAt: now,
      seen: false
    });

    const participants = chatId.split('_');
    const receiverId = participants.find(p => p !== senderId);

    // 2. Update chat metadata and increment unread for receiver
    const updates: Record<string, any> = {};
    updates[`chats/${chatId}/lastMessage`] = text || (media?.type === 'image' ? 'Sent an image' : 'Sent a file');
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

    return newMessageRef.key!;
  },

  async unsendMessage(chatId: string, messageId: string): Promise<void> {
    const msgRef = ref(db, `messages/${chatId}/${messageId}`);
    await remove(msgRef);
  },

  async deleteMessageForMe(userId: string, chatId: string, messageId: string): Promise<void> {
    const delRef = ref(db, `user_settings/${userId}/deletedMessages/${chatId}/${messageId}`);
    await set(delRef, true);
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

  async deleteChat(userId: string, chatId: string): Promise<void> {
    const settingsRef = ref(db, `user_settings/${userId}`);
    const now = new Date();
    
    try {
      // 1. Record local deletion
      await update(settingsRef, {
        [`deletedChats/${chatId}`]: now.toISOString()
      });

      // 2. Check if the other user has also deleted this chat
      const participants = chatId.split('_');
      const otherId = participants.find(id => id !== userId);
      
      if (otherId) {
        const otherSettingsRef = ref(db, `user_settings/${otherId}/deletedChats/${chatId}`);
        const otherSnapshot = await get(otherSettingsRef);
        
        if (otherSnapshot.exists()) {
          // BOTH users have deleted the chat. Mark for permanent purge in 10 days.
          const purgeDate = new Date();
          purgeDate.setDate(purgeDate.getDate() + 10);
          
          await update(ref(db, `chats/${chatId}`), {
            pendingPurgeAt: purgeDate.toISOString(),
            status: 'purging'
          });
        }
      }
    } catch (err) {
      console.warn("Failed to process chat deletion policy:", err);
    }
  },

  /**
   * Scans the current user's conversations and removes those marked for purge that have passed their 10-day window.
   * This ensures we only attempt to clean up data the user has access to.
   */
  async runGarbageCollector(userId: string): Promise<void> {
    try {
      // Get the user's own chat references first
      const userChatsRef = ref(db, `user_chats/${userId}`);
      const snapshot = await get(userChatsRef);
      
      if (!snapshot.exists()) return;
      
      const userChatIds = Object.keys(snapshot.val());
      const now = new Date();
      
      for (const chatId of userChatIds) {
        try {
          const chatRef = ref(db, `chats/${chatId}`);
          const chatSnap = await get(chatRef);
          
          if (!chatSnap.exists()) continue;
          const chat = chatSnap.val();
          
          if (chat.status === 'purging' && chat.pendingPurgeAt && new Date(chat.pendingPurgeAt) <= now) {

            
            // 1. Remove messages (if permission allowed)
            await remove(ref(db, `messages/${chatId}`)).catch(() => null);
            
            // 2. Remove references for this specific user
            await remove(ref(db, `user_chats/${userId}/${chatId}`)).catch(() => null);
            await remove(ref(db, `user_settings/${userId}/deletedChats/${chatId}`)).catch(() => null);
            await remove(ref(db, `user_settings/${userId}/deletedMessages/${chatId}`)).catch(() => null);

            // 3. Attempt to remove the main chat node (will only succeed if rules allow or if other user also purged)
            await remove(ref(db, `chats/${chatId}`)).catch(() => null);
          }
        } catch (err) {
          // Individual chat failure shouldn't stop the loop
          continue;
        }
      }
    } catch (err) {
      console.warn("[GC] User-level cleanup cycle interrupted:", err);
    }
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

    async uploadChatMedia(userId: string, file: File): Promise<{ url: string, type: 'image' | 'video' | 'file' }> {
    const { uploadToCloudinary } = await import('./cloudinary');
    const result = await uploadToCloudinary(file, `edunook/chat/${userId}`);
    let type: 'image' | 'video' | 'file' = 'file';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    return { url: result.secure_url, type };
  },

  // ===== FOLLOWERS SYSTEM =====
  async followUser(currentUid: string, targetUid: string): Promise<void> {
    const now = new Date().toISOString();
    const updates: Record<string, any> = {};
    updates[`followers/${targetUid}/${currentUid}`] = true;
    updates[`following/${currentUid}/${targetUid}`] = true;
    await update(ref(db), updates);
    await this.createNotification(targetUid, {
      type: 'follow', fromUid: currentUid, text: 'started following you', createdAt: now, seen: false,
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
    if (!isValidFirebaseKey(uid)) { callback(0); return () => {}; }
    return onValue(ref(db, `followers/${uid}`), (snapshot) => {
      callback(snapshot.exists() ? Object.keys(snapshot.val()).length : 0);
    });
  },

  subscribeToFollowingCount(uid: string, callback: (count: number) => void) {
    if (!isValidFirebaseKey(uid)) { callback(0); return () => {}; }
    return onValue(ref(db, `following/${uid}`), (snapshot) => {
      callback(snapshot.exists() ? Object.keys(snapshot.val()).length : 0);
    });
  },

  // ===== NOTIFICATIONS SYSTEM =====
  async createNotification(targetUid: string, data: Omit<Notification, 'id'>): Promise<void> {
    try {
      const profile = await this.getProfile(targetUid);
      const prefs = profile?.preferences?.notifications;
      if (prefs) {
        if (data.type === 'follow' && !prefs.followers) return;
        if (data.type === 'update' && !prefs.courseUpdates) return;
        if ((data.type === 'test' || data.type === 'quiz') && !prefs.quizResults) return;
      }
      const notifRef = ref(db, `notifications/${targetUid}`);
      const newNotifRef = push(notifRef);
      await set(newNotifRef, { ...data, id: newNotifRef.key });
    } catch (err) { console.error('[DbService] Notification error:', err); }
  },

  subscribeToNotifications(uid: string, callback: (notifications: Notification[]) => void) {
    if (!isValidFirebaseKey(uid)) { callback([]); return () => {}; }
    const notifRef = ref(db, `notifications/${uid}`);
    return onValue(notifRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data).map(id => ({ ...data[id], id } as Notification));
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

  subscribeToUnreadChatCount(userId: string, callback: (count: number) => void) {
    const userChatsRef = ref(db, `user_chats/${userId}`);
    const chatUnsubs = new Map<string, () => void>();
    const counts: Record<string, number> = {};

    const emit = () => {
      callback(Object.values(counts).reduce((sum, count) => sum + count, 0));
    };

    const unsubscribeChats = () => {
      chatUnsubs.forEach(unsub => unsub());
      chatUnsubs.clear();
      Object.keys(counts).forEach(chatId => delete counts[chatId]);
    };

    const unsubscribeUserChats = onValue(userChatsRef, (snapshot) => {
      if (!snapshot.exists()) {
        unsubscribeChats();
        callback(0);
        return;
      }

      const activeChatIds = new Set(Object.keys(snapshot.val()));

      chatUnsubs.forEach((unsub, chatId) => {
        if (!activeChatIds.has(chatId)) {
          unsub();
          chatUnsubs.delete(chatId);
          delete counts[chatId];
        }
      });

      activeChatIds.forEach(chatId => {
        if (chatUnsubs.has(chatId)) return;

        const unreadRef = ref(db, `chats/${chatId}/unreadCounts/${userId}`);
        const unsub = onValue(unreadRef, (unreadSnapshot) => {
          counts[chatId] = unreadSnapshot.exists() ? Number(unreadSnapshot.val() || 0) : 0;
          emit();
        });
        chatUnsubs.set(chatId, unsub);
      });

      emit();
    });

    return () => {
      unsubscribeUserChats();
      unsubscribeChats();
    };
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

  async markNotificationAsRead(uid: string, id: string): Promise<void> {
    await update(ref(db, `notifications/${uid}/${id}`), { seen: true });
  },

  async deleteNotification(uid: string, id: string): Promise<void> {
    await remove(ref(db, `notifications/${uid}/${id}`));
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

  async getUserTests(userId: string): Promise<TestRow[]> {
    const testsRef = ref(db, 'tests');
    const snapshot = await get(testsRef);
    if (!snapshot.exists()) return [];
    
    const data = snapshot.val();
    return Object.keys(data)
      .map(id => ({ ...data[id], id } as TestRow))
      .filter(t => t.creatorId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    
    // Filter out undefined values as Firebase update() will throw if they exist
    const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    const testData = {
      ...cleanData,
      creatorId,
      id: testId,
      slug: slug,
      createdAt: new Date().toISOString()
    };

    await set(ref(db, `tests/${testId}`), testData);
    await set(ref(db, `test_slugs/${slug}`), testId);
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

  async getBestTestAttemptForUser(uid: string, testId: string): Promise<TestAttempt | null> {
    const attempts = await this.getTestAttempts(uid);
    const matching = attempts
      .filter(attempt => attempt.testId === testId)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aTime = a.timeTakenCentiseconds ?? Math.round((a.timeTaken ?? Number.MAX_SAFE_INTEGER) * 100);
        const bTime = b.timeTakenCentiseconds ?? Math.round((b.timeTaken ?? Number.MAX_SAFE_INTEGER) * 100);
        return aTime - bTime;
      });
    return matching[0] || null;
  },

  // Leaderboards
  async saveLeaderboardEntry(idOrSlug: string, uid: string, entry: { score: number; timeTaken: number; name: string; avatar?: string | null; hintsCount?: number; correctAnswers?: number; totalQuestions?: number; accuracy?: number; timeTakenCentiseconds?: number }) {
    if (!idOrSlug || !uid) return;

    // 1. Resolve actual ID first 
    let actualId = idOrSlug;
    let slug = idOrSlug;
    try {
      const slugSnapshot = await get(ref(db, `test_slugs/${idOrSlug}`));
      if (slugSnapshot.exists()) {
        actualId = slugSnapshot.val();
        slug = idOrSlug;
      }
    } catch (e) {
      console.warn('Leaderboard slug resolution failed:', e);
    }

    const correctAnswers = typeof entry.correctAnswers === 'number' ? entry.correctAnswers : entry.score;
    const timeTakenCentiseconds = typeof entry.timeTakenCentiseconds === 'number'
      ? entry.timeTakenCentiseconds
      : Math.round((entry.timeTaken || 0) * 100);

    const data = {
      ...entry,
      score: correctAnswers,
      correctAnswers,
      timeTaken: Number((timeTakenCentiseconds / 100).toFixed(2)),
      timeTakenCentiseconds,
      completedAt: new Date().toISOString()
    };

    const updates: Record<string, any> = {};
    if (actualId) {
        updates[`leaderboards/${actualId}/${uid}`] = data;
    }
    if (slug && slug !== actualId) {
      updates[`leaderboards/${slug}/${uid}`] = data;
    }
    
    // Check if we should actually update (Best score logic)
    const existingSnapshots = await Promise.all([
      actualId ? get(ref(db, `leaderboards/${actualId}/${uid}`)) : Promise.resolve(null),
      slug && slug !== actualId ? get(ref(db, `leaderboards/${slug}/${uid}`)) : Promise.resolve(null)
    ]);
    const existing = existingSnapshots
      .filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot && snapshot.exists()))
      .map((snapshot) => normalizeLeaderboardEntry(uid, snapshot.val(), entry.totalQuestions))
      .sort((a, b) => {
        if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
        return a.timeTakenCentiseconds - b.timeTakenCentiseconds;
      })[0];
    if (existing) {
      if (
        data.correctAnswers < existing.correctAnswers ||
        (data.correctAnswers === existing.correctAnswers && data.timeTakenCentiseconds >= existing.timeTakenCentiseconds)
      ) {
        return; 
      }
    }

    await update(ref(db), updates);
  },

  subscribeToLeaderboard(testId: string, callback: (rankings: any[], error?: any) => void, slug?: string, totalQuestions?: number) {
    const leaderboardKeys = Array.from(new Set([testId, slug].filter(Boolean) as string[]));
    const nodesByKey: Record<string, any> = {};
    const errors: any[] = [];

    const emit = () => {
      const byUid: Record<string, any> = {};
      Object.values(nodesByKey).forEach((standingsNode) => {
        Object.keys(standingsNode || {}).forEach((uid) => {
          const contender = normalizeLeaderboardEntry(uid, standingsNode[uid], totalQuestions);
          const existing = byUid[uid];
          if (
            !existing ||
            contender.correctAnswers > existing.correctAnswers ||
            (contender.correctAnswers === existing.correctAnswers && contender.timeTakenCentiseconds < existing.timeTakenCentiseconds)
          ) {
            byUid[uid] = contender;
          }
        });
      });

      const list = Object.values(byUid).sort((a, b) => {
        if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
        if (a.timeTakenCentiseconds !== b.timeTakenCentiseconds) return a.timeTakenCentiseconds - b.timeTakenCentiseconds;
        return (a.completedAt || "").localeCompare(b.completedAt || "");
      });

      callback(list, list.length === 0 && errors.length > 0 ? errors[0] : undefined);
    };

    const unsubscribers = leaderboardKeys.map((key) => onValue(ref(db, `leaderboards/${key}`), (snapshot) => {
      nodesByKey[key] = snapshot.exists() ? snapshot.val() || {} : {};
      emit();
    }, (error) => {
      errors.push(error);
      nodesByKey[key] = {};
      emit();
    }));

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
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
    const creatorUids: string[] = Array.from(new Set(courses.map(c => c.userId)));
    const followerCounts: Record<string, number> = {};
    
    await Promise.all(creatorUids.map(async (uid) => {
      const snapshot = await get(ref(db, `followers/${uid}`));
      followerCounts[uid] = snapshot.exists() ? Object.keys(snapshot.val() || {}).length : 0;
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
    try {
      const [testsSnap, attemptsSnap] = await Promise.all([
        get(ref(db, 'tests')),
        get(ref(db, 'test_attempts'))
      ]);

      const tests = testsSnap.exists() ? Object.values(testsSnap.val()) as any[] : [];
      const uniqueExperts = new Set(tests.map(t => t.creatorId)).size;

      let totalEnrollments = 0;
      let totalPerfectScores = 0;

      if (attemptsSnap.exists()) {
        const allAttemptsMap = attemptsSnap.val();
        totalEnrollments = Object.keys(allAttemptsMap).length;
        Object.values(allAttemptsMap).forEach((userAttempts: any) => {
          Object.values(userAttempts).forEach((attempt: any) => {
             if (attempt.score === attempt.total) totalPerfectScores++;
          });
        });
      }

      return {
        experts: uniqueExperts,
        enrollments: totalEnrollments,
        trophies: totalPerfectScores
      };
    } catch (err) {
      return { experts: 0, enrollments: 0, trophies: 0 };
    }
  },

  async getTopCreators(limit: number = 12): Promise<(Profile & { followersCount: number })[]> {
    const pSnap = await get(ref(db, 'profiles'));
    const profiles = pSnap.exists()
      ? Object.entries(pSnap.val() as Record<string, Profile>).map(([uid, profile]) => ({
          ...profile,
          uid: profile.uid || uid,
        }))
      : [];

    // Get follower counts
    const followersSnapshot = await get(ref(db, 'followers'));
    const followersData = followersSnapshot.exists() ? followersSnapshot.val() : {};

    const enriched = profiles
      .filter(user => user.username && user.fullName)
      .map(user => ({
        ...user,
        followersCount: followersData[user.uid] ? Object.keys(followersData[user.uid]).length : 0,
      }));


    // Sort by followers descending, take limit
    enriched.sort((a, b) => b.followersCount - a.followersCount);
    return enriched.slice(0, limit);
  },

  async getAllUsersWithFollowStatus(currentUserId?: string): Promise<(Profile & { followersCount: number; isFollowing?: boolean })[]> {
    const [pSnap, followersSnap, followingSnap] = await Promise.all([
      get(ref(db, 'profiles')),
      get(ref(db, 'followers')),
      currentUserId ? get(ref(db, `following/${currentUserId}`)) : Promise.resolve(null),
    ]);

    const profilesData = pSnap.exists() ? pSnap.val() : {};
    const followersData = followersSnap.exists() ? followersSnap.val() : {};
    const followingData = followingSnap?.exists() ? followingSnap.val() : {};

    return Object.entries(profilesData)
      .map(([uid, data]: [string, any]) => ({
        ...data,
        uid: data.uid || uid,
        followersCount: followersData[uid] ? Object.keys(followersData[uid]).length : 0,
        isFollowing: !!followingData[uid],
      }))
      .filter((u: any) => u.username && u.fullName);
  },

  async addCourseReview(courseId: string, publisherId: string, userId: string, content: string): Promise<void> {
    const now = new Date().toISOString();
    const reviewsRef = ref(db, `course_reviews/${courseId}`);
    const newReviewRef = push(reviewsRef);
    const reviewId = newReviewRef.key!;

    const reviewData = {
      userId,
      content,
      createdAt: now,
    };

    const updates: Record<string, any> = {};
    updates[`course_reviews/${courseId}/${reviewId}`] = reviewData;

    // Only notify if not self-review
    if (publisherId !== userId) {
      const notifRef = ref(db, `notifications/${publisherId}`);
      const newNotifRef = push(notifRef);
      const user = await this.getProfile(userId);
      updates[`notifications/${publisherId}/${newNotifRef.key}`] = {
        type: 'review',
        fromUid: userId,
        text: `${user?.fullName || 'Someone'} left a review: "${content.substring(0, 60)}${content.length > 60 ? '...' : ''}"`,
        createdAt: now,
        seen: false
      };
    }

    await update(ref(db), updates);
  },

  async deleteCourseReview(courseId: string, reviewId: string): Promise<void> {
    await remove(ref(db, `course_reviews/${courseId}/${reviewId}`));
  },

  subscribeToCourseReviews(courseId: string, callback: (reviews: CourseReview[]) => void) {
    const reviewsRef = ref(db, `course_reviews/${courseId}`);
    return onValue(reviewsRef, async (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      const data = snapshot.val();
      const reviews = await Promise.all(Object.keys(data).map(async (id) => {
        const review = data[id];
        const profile = await this.getProfile(review.userId);
        return { ...review, id, profiles: profile } as CourseReview;
      }));
      callback(reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });
  },

  // ===== CREATOR ANALYTICS =====

  async getEnrollmentsForCourse(courseId: string): Promise<Record<string, any>> {
    try {
      const snapshot = await get(ref(db, `enrollments/${courseId}`));
      return snapshot.exists() ? snapshot.val() : {};
    } catch (err) {
      console.warn(`[DbService] Cannot read enrollments for ${courseId}:`, err);
      return {};
    }
  },

  async getPaymentsForTeacher(uid: string): Promise<any[]> {
    try {
      const paymentsRef = ref(db, 'payments');
      const q = query(paymentsRef, orderByChild('teacher_id'), equalTo(uid));
      const snapshot = await get(q);
      
      if (!snapshot.exists()) return [];
      
      return Object.entries(snapshot.val())
        .filter(([, v]: any) => v.status === 'success' && v.type === 'course')
        .map(([id, v]: any) => ({ id, ...v }));
    } catch (err) {
      console.warn('[DbService] Cannot read payments using query:', err);
      return [];
    }
  },

  async getCourseReviewsList(courseId: string): Promise<CourseReview[]> {
    try {
      const snapshot = await get(ref(db, `course_reviews/${courseId}`));
      if (!snapshot.exists()) return [];
      const data = snapshot.val();
      return Object.keys(data).map(id => ({ ...data[id], id } as CourseReview));
    } catch (err) {
      console.warn(`[DbService] Cannot read reviews for ${courseId}:`, err);
      return [];
    }
  },

  async getFollowersList(uid: string): Promise<string[]> {
    try {
      const snapshot = await get(ref(db, `followers/${uid}`));
      if (!snapshot.exists()) return [];
      return Object.keys(snapshot.val());
    } catch (err) {
      console.warn(`[DbService] Cannot read followers for ${uid}:`, err);
      return [];
    }
  },

  async getCreatorAnalytics(uid: string): Promise<{
    courses: Course[];
    enrollmentsByCourse: Record<string, any[]>;
    payments: any[];
    reviewsByCourse: Record<string, CourseReview[]>;
    followers: string[];
    totalViews: number;
    ageDemographics: { age: string; count: number }[];
    deviceBreakdown: { name: string; value: number }[];
  }> {
    // 1. Get all creator's courses
    const allCourses = await this.getCourses({ userId: uid });
    const courses = allCourses.map(({ profiles, ...rest }) => rest) as Course[];

    // 2. Fetch enrollments, reviews, payments, and followers in parallel
    const [enrollmentResults, reviewResults, payments, followers] = await Promise.all([
      Promise.all(courses.map(async (c) => {
        const enrollments = await this.getEnrollmentsForCourse(c.id);
        return { courseId: c.id, enrollments: Object.entries(enrollments).map(([uid, data]: any) => ({ uid, ...data })) };
      })),
      Promise.all(courses.map(async (c) => {
        const reviews = await this.getCourseReviewsList(c.id);
        return { courseId: c.id, reviews };
      })),
      this.getPaymentsForTeacher(uid),
      this.getFollowersList(uid),
    ]);

    const enrollmentsByCourse: Record<string, any[]> = {};
    enrollmentResults.forEach(r => { enrollmentsByCourse[r.courseId] = r.enrollments; });

    const reviewsByCourse: Record<string, CourseReview[]> = {};
    reviewResults.forEach(r => { reviewsByCourse[r.courseId] = r.reviews; });

    const totalViews = courses.reduce((sum, c) => sum + (c.views || 0), 0);

    // 3. Age demographics from enrollment records (Captured at time of enrollment)
    const allEnrollments = Object.values(enrollmentsByCourse).flat();
    const ageBuckets: Record<string, number> = { '3-12': 0, '13-17': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45+': 0, 'Existing': 0 };

    allEnrollments.forEach((e: any) => {
      const bracket = e.ageBracket || 'Existing';
      if (ageBuckets[bracket] !== undefined) {
        ageBuckets[bracket]++;
      } else {
        ageBuckets['Existing']++;
      }
    });

    const ageDemographics = Object.entries(ageBuckets)
      .map(([age, count]) => ({ age, count }))
      .filter(d => d.count > 0);

    // 4. Device breakdown from enrollment records
    const deviceCounts: Record<string, number> = { Desktop: 0, Mobile: 0, Tablet: 0 };
    allEnrollments.forEach((e: any) => {
      const dev = e.device || 'Desktop';
      if (deviceCounts[dev] !== undefined) deviceCounts[dev]++;
      else deviceCounts['Desktop']++;
    });
    const deviceBreakdown = Object.entries(deviceCounts)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0);

    return { courses, enrollmentsByCourse, payments, reviewsByCourse, followers, totalViews, ageDemographics, deviceBreakdown };
  },
};
