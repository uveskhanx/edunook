'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MoreVertical, Trash2, Heart, Send, Eye, Plus, Star, Check } from 'lucide-react';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';
import { DbService, Story, Profile, Highlight } from '@/lib/db-service';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

const STORY_DURATION = 10000;

interface StoryViewerProps {
  stories: Story[];
  user: Profile;
  isOwnStory?: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onDelete?: (storyId: string) => void;
  onAddMore?: () => void;
  disableViewTracking?: boolean;
  hideBottomBar?: boolean;
  headerSubLabel?: string;
  existingHighlights?: Highlight[];
  highlightSourceStories?: Story[];
  onHighlightSaved?: (highlight: Highlight) => void;
}

function formatStoryTime(createdAt: string) {
  const diffMs = Math.max(0, Date.now() - new Date(createdAt).getTime());
  const diffMins = Math.floor(diffMs / (1000 * 60));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h`;
}

export function StoryViewer({
  stories,
  user,
  isOwnStory,
  onClose,
  onComplete,
  onDelete,
  onAddMore,
  disableViewTracking,
  hideBottomBar,
  headerSubLabel,
  existingHighlights = [],
  highlightSourceStories,
  onHighlightSaved,
}: StoryViewerProps) {
  const { user: authUser } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const progressRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);

  // Feature modals
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<{ profile: Profile; viewedAt: number }[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [highlightName, setHighlightName] = useState('');
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [creatingNewHighlight, setCreatingNewHighlight] = useState(false);
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const [shareResults, setShareResults] = useState<Profile[]>([]);
  const [searchingShare, setSearchingShare] = useState(false);

  const currentStory = stories[currentIndex];

  // Mark story as viewed
  useEffect(() => {
    if (!disableViewTracking && currentStory && authUser && user.uid !== authUser.id) {
      DbService.markStoryViewed(user.uid, currentStory.id, authUser.id).catch(() => {});
    }
  }, [currentStory?.id, authUser, user.uid, disableViewTracking]);

  useEffect(() => {
    if (!showHighlight) return;
    setSelectedStoryIds((prev) => (prev.length > 0 ? prev : currentStory ? [currentStory.id] : []));
    if (existingHighlights.length > 0) {
      setSelectedHighlightId(existingHighlights[0].id);
      setCreatingNewHighlight(false);
      setHighlightName(existingHighlights[0].title);
    } else {
      setSelectedHighlightId(null);
      setCreatingNewHighlight(true);
      setHighlightName('');
    }
  }, [showHighlight, currentStory?.id, existingHighlights]);

  const handleNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
      startTimeRef.current = Date.now();
      progressRef.current = 0;
    } else {
      onComplete?.();
      onClose();
    }
  }, [currentIndex, stories.length, onComplete, onClose]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
      startTimeRef.current = Date.now();
      progressRef.current = 0;
    }
  }, [currentIndex]);

  useEffect(() => {
    if (isPaused || !currentStory) return;
    startTimeRef.current = Date.now() - progressRef.current;

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(pct);
      progressRef.current = elapsed;
      if (pct >= 100) { handleNext(); return; }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isPaused, handleNext, currentStory?.mediaType, currentIndex]);

  const handlePointerDown = () => { setIsPaused(true); progressRef.current = (progress / 100) * STORY_DURATION; };
  const handlePointerUp = () => { setIsPaused(false); startTimeRef.current = Date.now(); };
  const handleTapLeft = (e: React.MouseEvent) => { e.stopPropagation(); handlePrev(); };
  const handleTapRight = (e: React.MouseEvent) => { e.stopPropagation(); handleNext(); };

  if (!currentStory) return null;

  // Parse overlays and frame settings
  let cssFilter = 'none';
  let frameSettings = { padding: 0, radius: 0, bgColor: '#000' };
  let overlays: any[] = [];

  if (currentStory.filters) {
    try {
      const parsed = JSON.parse(currentStory.filters);
      cssFilter = parsed.cssFilter || parsed.filter || 'none';
      if (parsed.frame) frameSettings = parsed.frame;
    } catch { cssFilter = currentStory.filters; }
  }

  if (currentStory.stickers) {
    try {
      const parsed = JSON.parse(currentStory.stickers);
      if (Array.isArray(parsed)) overlays = parsed;
    } catch { /* legacy */ }
  }

  const viewerCount = currentStory.viewers ? Object.keys(currentStory.viewers).length : 0;

  const openViewers = async () => {
    setShowViewers(true); setIsPaused(true); setLoadingViewers(true);
    try {
      const v = await DbService.getStoryViewers(user.uid, currentStory.id);
      setViewers(v);
    } catch { toast.error('Failed to load viewers'); }
    setLoadingViewers(false);
  };

  const handleHighlight = async () => {
    const storiesForHighlight = (highlightSourceStories?.length ? highlightSourceStories : stories)
      .filter((story) => selectedStoryIds.includes(story.id));
    const existingHighlight = existingHighlights.find((item) => item.id === selectedHighlightId);
    const finalHighlightName = creatingNewHighlight
      ? highlightName.trim()
      : (existingHighlight?.title || highlightName.trim());

    if (!finalHighlightName) { toast.error('Select or create a highlight'); return; }
    if (storiesForHighlight.length === 0) { toast.error('Choose at least one story'); return; }

    try {
      setSavingHighlight(true);
      const savedHighlight = await DbService.addStoriesToHighlight(user.uid, storiesForHighlight, {
        highlightId: creatingNewHighlight ? undefined : existingHighlight?.id,
        highlightTitle: finalHighlightName,
      });
      toast.success(`Added ${storiesForHighlight.length} stor${storiesForHighlight.length > 1 ? 'ies' : 'y'} to highlight`);
      onHighlightSaved?.(savedHighlight);
      setShowHighlight(false);
      setHighlightName('');
      setSelectedStoryIds([]);
      setIsPaused(false);
    } catch { toast.error('Failed to add highlight'); }
    finally { setSavingHighlight(false); }
  };

  const searchUsersForShare = async (q: string) => {
    setShareSearch(q);
    if (!q.trim()) { setShareResults([]); return; }
    setSearchingShare(true);
    try {
      const results = await DbService.searchProfiles(q);
      setShareResults(results.filter(r => r.uid !== authUser?.id).slice(0, 10));
    } catch { /* ignore */ }
    setSearchingShare(false);
  };

  const shareToUser = async (targetUid: string) => {
    if (!authUser) return;
    try {
      const chatId = await DbService.getOrCreateChat(authUser.id, targetUid);
      await DbService.sendMessage(chatId, authUser.id, `📖 Check out ${user.username}'s story!`);
      toast.success('Story shared!');
      setShowShare(false); setIsPaused(false);
    } catch { toast.error('Failed to share'); }
  };

  const storiesAvailableForHighlight = highlightSourceStories?.length ? highlightSourceStories : stories;

  const toggleStorySelection = (storyId: string) => {
    setSelectedStoryIds((prev) => (
      prev.includes(storyId)
        ? prev.filter((id) => id !== storyId)
        : [...prev, storyId]
    ));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black sm:bg-black/90 backdrop-blur-sm"
    >
      <div className="relative w-full h-full sm:w-[400px] sm:h-[85vh] sm:rounded-3xl overflow-hidden bg-zinc-900 flex flex-col">
        {/* Progress Bars */}
        <div className="absolute top-0 left-0 right-0 p-3 flex gap-1 z-20">
          {stories.map((s, i) => (
            <div key={s.id} className="h-0.5 flex-1 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-none" style={{ width: i === currentIndex ? `${progress}%` : i < currentIndex ? '100%' : '0%' }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-5 left-0 right-0 px-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-muted">
              {user.avatarUrl ? (
                <img src={optimizeCloudinaryUrl(user.avatarUrl, 80)} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xs">
                  {user.fullName?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <span className="text-sm font-bold text-white drop-shadow-md">{user.username}</span>
            <span className="text-xs text-white/70 drop-shadow-md ml-1">{headerSubLabel || formatStoryTime(currentStory.createdAt)}</span>
          </div>

          <div className="flex items-center gap-1">
            {isOwnStory && (
              <button onClick={(e) => { e.stopPropagation(); onAddMore?.(); onClose(); }} className="p-1.5 text-white hover:bg-white/10 rounded-full transition-colors">
                <Plus className="w-5 h-5 drop-shadow-md" />
              </button>
            )}
            {isOwnStory && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="p-1.5 text-white hover:bg-white/10 rounded-full transition-colors" onClick={(e) => { e.stopPropagation(); setIsPaused(true); }}>
                    <MoreVertical className="w-5 h-5 drop-shadow-md" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="bg-zinc-900 border border-white/10 rounded-xl p-1 min-w-[150px] shadow-2xl z-[70]" sideOffset={8} align="end" onInteractOutside={() => setIsPaused(false)}>
                    <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 font-medium rounded-lg hover:bg-white/10 cursor-pointer outline-none" onClick={() => { onDelete?.(currentStory.id); setIsPaused(false); }}>
                      <Trash2 className="w-4 h-4" /> Delete Story
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
            <button onClick={onClose} className="p-1.5 text-white hover:bg-white/10 rounded-full transition-colors">
              <X className="w-6 h-6 drop-shadow-md" />
            </button>
          </div>
        </div>

        {/* Media Container */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
          <div className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={handleTapLeft} />
          <div className="absolute inset-y-0 right-0 w-1/3 z-10" onClick={handleTapRight} />

          <div className="relative w-full h-full aspect-[9/16] mx-auto bg-black flex items-center justify-center pointer-events-none overflow-hidden">
            <div className="absolute inset-0 transition-all duration-300" style={{ padding: `${frameSettings.padding}px`, backgroundColor: frameSettings.bgColor }}>
              <div className="w-full h-full overflow-hidden relative" style={{ borderRadius: `${frameSettings.radius}px` }}>
                {currentStory.mediaType === 'image' ? (
                  <img src={currentStory.mediaUrl} className="absolute inset-0 w-full h-full object-cover" style={{ filter: cssFilter }} alt="Story" />
                ) : (
                  <video src={currentStory.mediaUrl} className="absolute inset-0 w-full h-full object-cover" style={{ filter: cssFilter }} autoPlay playsInline loop onEnded={handleNext}
                    ref={(el) => { if (el) { if (isPaused) { el.pause(); } else { el.play().catch(() => {}); } } }}
                  />
                )}
              </div>
            </div>

            {overlays.map((o: any) => (
              <div key={o.id} className="absolute z-20 pointer-events-none" style={{ left: `${o.x}%`, top: `${o.y}%`, transform: `translate(-50%, -50%) scale(${o.scale || 1})` }}>
                <div style={{ color: o.color, fontFamily: o.fontFamily, fontSize: o.type === 'sticker' ? '4rem' : '2.5rem', fontWeight: 'bold', textShadow: o.type === 'text' ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none', whiteSpace: 'pre-wrap', textAlign: 'center', lineHeight: '1.2' }}>
                  {o.content}
                </div>
              </div>
            ))}

            {currentStory.stickers && !currentStory.stickers.startsWith('[') && (
              <div className="absolute inset-0 z-20 pointer-events-none" dangerouslySetInnerHTML={{ __html: currentStory.stickers }} />
            )}
          </div>
        </div>

        {/* Bottom Bar - Own Story */}
        {isOwnStory && !hideBottomBar && (
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between z-20 bg-gradient-to-t from-black/80 to-transparent">
            <button onClick={(e) => { e.stopPropagation(); openViewers(); }} className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
              <Eye className="w-5 h-5" />
              <span className="text-sm font-bold">{viewerCount}</span>
            </button>
            <div className="flex items-center gap-2">
              <button onClick={(e) => { e.stopPropagation(); setShowHighlight(true); setIsPaused(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 backdrop-blur-md rounded-full text-white text-xs font-bold hover:bg-white/20 transition-colors border border-white/10">
                <Star className="w-4 h-4" /> Highlight
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowShare(true); setIsPaused(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 backdrop-blur-md rounded-full text-white text-xs font-bold hover:bg-white/20 transition-colors border border-white/10">
                <Send className="w-4 h-4" /> Share
              </button>
            </div>
          </div>
        )}

        {/* Bottom Bar - Other's Story */}
        {!isOwnStory && !hideBottomBar && (
          <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-3 z-20 bg-gradient-to-t from-black/80 to-transparent">
            <input type="text" placeholder={`Reply to ${user.username}...`}
              className="flex-1 bg-black/40 border border-white/20 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/60 focus:outline-none focus:border-white/50 backdrop-blur-md"
              onClick={(e) => { e.stopPropagation(); setIsPaused(true); }} onBlur={() => setIsPaused(false)}
            />
            <button className="p-2.5 text-white hover:bg-white/10 rounded-full transition-colors"><Heart className="w-6 h-6" /></button>
            <button onClick={(e) => { e.stopPropagation(); setShowShare(true); setIsPaused(true); }} className="p-2.5 text-white hover:bg-white/10 rounded-full transition-colors"><Send className="w-6 h-6" /></button>
          </div>
        )}

        {/* Viewers Modal */}
        <AnimatePresence>
          {showViewers && (
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}
              className="absolute inset-x-0 bottom-0 bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl z-50 max-h-[60%] flex flex-col border-t border-white/10">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-white/70" />
                  <h3 className="text-white font-bold">{viewerCount} viewers</h3>
                </div>
                <button onClick={() => { setShowViewers(false); setIsPaused(false); }} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5 text-white" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {loadingViewers ? (
                  <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /></div>
                ) : viewers.length === 0 ? (
                  <p className="text-white/40 text-center py-8 text-sm">No viewers yet</p>
                ) : (
                  viewers.map(v => (
                    <div key={v.profile.uid} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0">
                        {v.profile.avatarUrl ? <img src={optimizeCloudinaryUrl(v.profile.avatarUrl, 80)} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-sm">{v.profile.fullName?.[0]}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm truncate">{v.profile.fullName}</p>
                        <p className="text-white/40 text-xs">@{v.profile.username}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Highlight Modal */}
        <AnimatePresence>
          {showHighlight && (
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}
              className="absolute inset-x-0 bottom-0 bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl z-50 p-6 space-y-5 border-t border-white/10 max-h-[80%] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold flex items-center gap-2"><Star className="w-5 h-5 text-yellow-400" /> Add to Highlight</h3>
                <button onClick={() => { setShowHighlight(false); setIsPaused(false); }} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5 text-white" /></button>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/40">Choose Stories</p>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {storiesAvailableForHighlight.map((story) => {
                    const isSelected = selectedStoryIds.includes(story.id);
                    return (
                      <button
                        key={story.id}
                        onClick={() => toggleStorySelection(story.id)}
                        className={`relative w-20 h-28 rounded-2xl overflow-hidden border transition-all shrink-0 ${isSelected ? 'border-white scale-[1.02]' : 'border-white/10 opacity-70'}`}
                      >
                        {story.mediaType === 'video' ? (
                          <video src={story.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                        ) : (
                          <img src={story.mediaUrl} className="w-full h-full object-cover" alt="" />
                        )}
                        <div className={`absolute top-2 right-2 w-5 h-5 rounded-full border border-white/40 flex items-center justify-center ${isSelected ? 'bg-white text-black' : 'bg-black/40 text-transparent'}`}>
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/40">Add To</p>
                <div className="grid grid-cols-2 gap-3">
                  {existingHighlights.map((highlight) => (
                    <button
                      key={highlight.id}
                      onClick={() => {
                        setCreatingNewHighlight(false);
                        setSelectedHighlightId(highlight.id);
                        setHighlightName(highlight.title);
                      }}
                      className={`rounded-2xl border px-4 py-3 text-left transition-all ${!creatingNewHighlight && selectedHighlightId === highlight.id ? 'border-white bg-white text-black' : 'border-white/10 bg-white/5 text-white hover:bg-white/10'}`}
                    >
                      <span className="block text-sm font-bold truncate">{highlight.title}</span>
                      <span className={`block text-[10px] uppercase tracking-[0.2em] mt-1 ${!creatingNewHighlight && selectedHighlightId === highlight.id ? 'text-black/60' : 'text-white/40'}`}>Existing Highlight</span>
                    </button>
                  ))}

                  <button
                    onClick={() => {
                      setCreatingNewHighlight(true);
                      setSelectedHighlightId(null);
                      setHighlightName('');
                    }}
                    className={`rounded-2xl border px-4 py-3 text-left transition-all ${creatingNewHighlight ? 'border-white bg-white text-black' : 'border-white/10 bg-white/5 text-white hover:bg-white/10'}`}
                  >
                    <span className="block text-sm font-bold truncate">Create New</span>
                    <span className={`block text-[10px] uppercase tracking-[0.2em] mt-1 ${creatingNewHighlight ? 'text-black/60' : 'text-white/40'}`}>New Highlight</span>
                  </button>
                </div>
              </div>

              {creatingNewHighlight && (
                <input
                  type="text"
                  value={highlightName}
                  onChange={e => setHighlightName(e.target.value)}
                  placeholder="Highlight name"
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-primary"
                />
              )}

              <button onClick={handleHighlight} disabled={savingHighlight} className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-colors disabled:opacity-60">
                {savingHighlight ? 'Saving...' : 'Save to Highlight'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Share Modal */}
        <AnimatePresence>
          {showShare && (
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }}
              className="absolute inset-x-0 bottom-0 bg-zinc-900/95 backdrop-blur-xl rounded-t-3xl z-50 max-h-[60%] flex flex-col border-t border-white/10">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-white font-bold flex items-center gap-2"><Send className="w-5 h-5" /> Share Story</h3>
                <button onClick={() => { setShowShare(false); setShareSearch(''); setShareResults([]); setIsPaused(false); }} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5 text-white" /></button>
              </div>
              <div className="p-4">
                <input type="text" value={shareSearch} onChange={e => searchUsersForShare(e.target.value)} placeholder="Search users..." className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-primary" />
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {searchingShare ? (
                  <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /></div>
                ) : shareResults.length === 0 && shareSearch ? (
                  <p className="text-white/40 text-center py-8 text-sm">No users found</p>
                ) : (
                  shareResults.map(r => (
                    <button key={r.uid} onClick={() => shareToUser(r.uid)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 w-full text-left transition-colors">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-muted shrink-0">
                        {r.avatarUrl ? <img src={optimizeCloudinaryUrl(r.avatarUrl, 80)} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-sm">{r.fullName?.[0]}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm truncate">{r.fullName}</p>
                        <p className="text-white/40 text-xs">@{r.username}</p>
                      </div>
                      <Send className="w-4 h-4 text-white/40" />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
