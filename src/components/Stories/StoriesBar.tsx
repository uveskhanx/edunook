'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { DbService, Profile, Story } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';
import { StoryViewer } from './StoryViewer';
import { StoryCreator } from './StoryCreator';

interface StoriesBarProps {
  currentUser: Profile | null;
  allUsers: Profile[];
}

export function StoriesBar({ currentUser, allUsers }: StoriesBarProps) {
  const [storiesMap, setStoriesMap] = useState<Record<string, Story[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeStoryUserId, setActiveStoryUserId] = useState<string | null>(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);

  useEffect(() => {
    async function fetchStories() {
      if (!allUsers.length) return;
      const userIds = allUsers.map(u => u.uid);
      if (currentUser && !userIds.includes(currentUser.uid)) {
        userIds.push(currentUser.uid);
      }
      try {
        const stories = await DbService.getStories(userIds);
        setStoriesMap(stories);
      } catch (err) {
        console.error('Failed to fetch stories:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStories();
  }, [allUsers, currentUser]);

  const hasOwnStory = currentUser && storiesMap[currentUser.uid]?.length > 0;

  // Group users based on priority
  // 1. Followings with stories
  // 2. Others with stories
  const sortedStoryUsers = useMemo(() => {
    const withStories = allUsers.filter(u => storiesMap[u.uid]?.length > 0 && u.uid !== currentUser?.uid);
    // Assuming allUsers from explore-client already has isFollowing property (but we might need to cast or just check followers)
    // For now, we'll just put all users with stories. 
    return withStories;
  }, [allUsers, storiesMap, currentUser]);

  const handleAvatarClick = (uid: string) => {
    if (storiesMap[uid]?.length > 0) {
      setActiveStoryUserId(uid);
    } else if (uid === currentUser?.uid) {
      setIsCreatorOpen(true);
    }
  };

  const handleStoryComplete = () => {
    if (!activeStoryUserId) return;
    
    // Find next user
    if (activeStoryUserId === currentUser?.uid && sortedStoryUsers.length > 0) {
      setActiveStoryUserId(sortedStoryUsers[0].uid);
      return;
    }
    
    const currentIndex = sortedStoryUsers.findIndex(u => u.uid === activeStoryUserId);
    if (currentIndex >= 0 && currentIndex < sortedStoryUsers.length - 1) {
      setActiveStoryUserId(sortedStoryUsers[currentIndex + 1].uid);
    } else {
      setActiveStoryUserId(null); // Close viewer
    }
  };

  const handleStoryAdded = async () => {
    setIsCreatorOpen(false);
    // Refetch own stories
    if (!currentUser) return;
    const stories = await DbService.getStories([currentUser.uid]);
    setStoriesMap(prev => ({ ...prev, [currentUser.uid]: stories[currentUser.uid] || [] }));
  };

  const renderAvatar = (user: Profile, isOwn: boolean) => {
    const hasStory = storiesMap[user.uid]?.length > 0;
    
    return (
      <button 
        key={user.uid}
        onClick={() => handleAvatarClick(user.uid)}
        className="flex flex-col items-center gap-1.5 shrink-0 group relative"
      >
        <div className={`
          relative w-[68px] h-[68px] rounded-full p-[3px]
          ${hasStory ? 'bg-gradient-to-tr from-yellow-400 via-orange-500 to-pink-500' : 'bg-border/50'}
        `}>
          <div className="w-full h-full rounded-full bg-background p-0.5">
            <div className="w-full h-full rounded-full overflow-hidden bg-muted relative">
              {user.avatarUrl ? (
                <img src={optimizeCloudinaryUrl(user.avatarUrl, 120)} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xl">
                  {user.fullName?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>
          {isOwn && !hasStory && (
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center border-2 border-background">
              <Plus className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
        <span className="text-[10px] font-medium text-foreground w-[70px] truncate text-center">
          {isOwn ? 'Your Story' : user.username}
        </span>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex gap-4 overflow-x-auto no-scrollbar py-4 px-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="w-[68px] h-[68px] rounded-full bg-muted animate-pulse" />
            <div className="w-12 h-2.5 bg-muted rounded-full animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const activeUser = activeStoryUserId === currentUser?.uid ? currentUser : sortedStoryUsers.find(u => u.uid === activeStoryUserId);

  return (
    <>
      <div className="flex gap-4 overflow-x-auto no-scrollbar py-4 px-4 bg-card/20 backdrop-blur-sm border-y border-border">
        {currentUser && renderAvatar(currentUser, true)}
        {sortedStoryUsers.map(u => renderAvatar(u, false))}
      </div>

      <AnimatePresence>
        {isCreatorOpen && currentUser && (
          <StoryCreator 
            onClose={() => setIsCreatorOpen(false)} 
            onStoryAdded={handleStoryAdded}
            currentUser={currentUser}
          />
        )}

        {activeStoryUserId && activeUser && (
          <StoryViewer
            stories={storiesMap[activeStoryUserId] || []}
            user={activeUser}
            isOwnStory={activeStoryUserId === currentUser?.uid}
            onClose={() => setActiveStoryUserId(null)}
            onComplete={handleStoryComplete}
            onDelete={async (storyId: string) => {
              await DbService.deleteStory(currentUser!.uid, storyId);
              setStoriesMap(prev => ({
                ...prev,
                [currentUser!.uid]: prev[currentUser!.uid]?.filter(s => s.id !== storyId) || []
              }));
              if (storiesMap[currentUser!.uid]?.length === 1) { // That was the last one
                setActiveStoryUserId(null);
              }
            }}
            onAddMore={() => setIsCreatorOpen(true)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
