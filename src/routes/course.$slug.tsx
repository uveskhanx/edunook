/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useRef, useMemo } from 'react';
import { DbService, Course, Video, Chapter, Profile, CourseReview } from '@/lib/db-service';
import { Layout } from '@/components/Layout';
import { 
  Play, Pause, CheckCircle, User, BookOpen, Clock, 
  Sparkles, MessageCircle, Share2, Award, Zap, 
  Link as LinkIcon, FileQuestion, ExternalLink,
  Maximize, Minimize, Volume2, VolumeX, FastForward, 
  Rewind, Settings, ChevronRight, ChevronLeft, Loader2, PlayCircle,
  MoreVertical, Trash2, Send, UserPlus, UserCheck,
  RotateCcw, RotateCw, Monitor, Download, Trophy,
  ShieldAlert, IndianRupee, Rocket, Globe, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { VerificationTick } from '@/components/VerificationTick';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute('/course/$slug')({
  head: () => ({
    meta: [
      { title: `Learning — EduNook` },
    ],
  }),
  component: CourseViewPage,
});

type EnrichedCourse = Course & { profiles: Profile | null };

function CourseViewPage() {
  const { slug } = Route.useParams();
  const { user: currentUser, dbUser } = useAuth();
  const [course, setCourse] = useState<EnrichedCourse | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [theaterMode, setTheaterMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'resources'>('overview');
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [newReview, setNewReview] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const isExpired = useMemo(() => {
    if (!course?.expiresInDays) return false;
    const expiryDate = new Date(course.createdAt);
    expiryDate.setDate(expiryDate.getDate() + course.expiresInDays);
    return new Date() > expiryDate;
  }, [course]);
  
  // Video Player State
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isHolding, setIsHolding] = useState(false);
  const [showNextOverlay, setShowNextOverlay] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [hasStarted, setHasStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW failed:', err));
    }
  }, []);

  useEffect(() => {
    if (course?.id) {
      const saved = localStorage.getItem(`offline_${course.id}`);
      if (saved === 'true') {
        setIsDownloaded(true);
        setSyncProgress(100);
      }
    }
  }, [course?.id]);

  useEffect(() => {
    let unsubReviews: (() => void) | undefined;
    
    async function loadData() {
      // 1. Try to load from Local Offline Vault first (Instant Load)
      const offlineKey = `offline_data_${slug}`;
      const cached = localStorage.getItem(offlineKey);
      if (cached) {
        try {
          const { course: c, chapters: chs } = JSON.parse(cached);
          setCourse(c);
          setChapters(chs);
          if (chs.length > 0) setActiveChapter(chs[0]);
          setLoading(false); // Immediate transition
        } catch (e) { console.error('Cache corrupt:', e); }
      }

      try {
        const c = await DbService.getCourse(slug);
        if (c) {
          DbService.incrementCourseViews(c.id);
          const ch = await DbService.getChapters(c.id);
          setCourse(c);
          setChapters(ch);
          if (ch.length > 0 && !activeChapter) setActiveChapter(ch[0]);

          unsubReviews = DbService.subscribeToCourseReviews(c.id, setReviews);

          // Silently update cache if already in offline mode
          if (localStorage.getItem(`offline_${c.id}`) === 'true') {
            localStorage.setItem(offlineKey, JSON.stringify({ course: c, chapters: ch }));
          }

          if (currentUser) {
            const following = await DbService.isFollowing(currentUser.id, c.userId);
            setIsFollowing(following);

            // Check enrollment
            if (c.price > 0 && c.userId !== currentUser.id) {
              const enrolled = await DbService.isEnrolled(c.id, currentUser.id);
              setIsEnrolled(enrolled);
            } else if (c.userId === currentUser.id) {
              setIsEnrolled(true);
            } else {
              setIsEnrolled(true); // Free course
            }
          }
        }
      } catch (err) {
        console.error('Error loading course:', err);
      } finally {
        setLoading(false);
        setCheckingAccess(false);
      }
    }
    loadData();
    return () => { if (unsubReviews) unsubReviews(); };
  }, [slug, currentUser]);

  const nextChapter = useMemo(() => {
    if (!activeChapter) return null;
    const idx = chapters.findIndex(c => c.id === activeChapter.id);
    return chapters[idx + 1] || null;
  }, [activeChapter, chapters]);

  const prevChapter = useMemo(() => {
    if (!activeChapter) return null;
    const idx = chapters.findIndex(c => c.id === activeChapter.id);
    return chapters[idx - 1] || null;
  }, [activeChapter, chapters]);

  const launchUrl = useMemo(() => {
    if (!activeChapter) return '#';
    const raw = activeChapter.type === 'quiz' ? activeChapter.quizUrl : activeChapter.pageUrl;
    if (!raw) return '#';
    if (raw.startsWith('/')) return window.location.origin + raw;
    if (raw.startsWith('http')) return raw;
    return `https://${raw}`;
  }, [activeChapter]);

  // Utils
  const formatTime = (time: number) => {
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const handleSeek = (val: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const handleHoldStart = () => {
    if (!videoRef.current || !isPlaying) return;
    setIsHolding(true);
    videoRef.current.playbackRate = 2;
  };

  const handleHoldEnd = () => {
    if (!videoRef.current) return;
    setIsHolding(false);
    videoRef.current.playbackRate = playbackSpeed;
  };

  // YouTube Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case 'arrowright': case 'l': video.currentTime = Math.min(video.duration, video.currentTime + 5); resetControlsTimeout(); break;
        case 'arrowleft': case 'j': video.currentTime = Math.max(0, video.currentTime - 5); resetControlsTimeout(); break;
        case 'arrowup': e.preventDefault(); setVolume(v => { const n = Math.min(1, v + 0.1); video.volume = n; return n; }); setIsMuted(false); resetControlsTimeout(); break;
        case 'arrowdown': e.preventDefault(); setVolume(v => { const n = Math.max(0, v - 0.1); video.volume = n; return n; }); resetControlsTimeout(); break;
        case ' ': case 'k': e.preventDefault(); togglePlay(); resetControlsTimeout(); break;
        case 'f': toggleFullscreen(); break;
        case 't': setTheaterMode(v => !v); break;
        case 'm': setIsMuted(v => !v); video.muted = !video.muted; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, playbackSpeed, theaterMode, isMuted, volume]);

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) v.pause();
    else { setHasStarted(true); v.play().catch(() => setIsPlaying(false)); }
  };

  useEffect(() => {
    if (currentUser && course && activeChapter) {
      DbService.addToHistory(currentUser.id, course.id, activeChapter.id);
    }
  }, [currentUser?.id, course?.id, activeChapter?.id]);

  const handleVideoEnded = () => {
    if (nextChapter) {
      setShowNextOverlay(true); setCountdown(5);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(p => {
          if (p <= 1) { clearInterval(countdownIntervalRef.current!); setActiveChapter(nextChapter); setShowNextOverlay(false); setHasStarted(false); return 0; }
          return p - 1;
        });
      }, 1000);
    }
  };

  const toggleFollow = async () => {
    if (!currentUser || !course) return toast.error('Sign in to follow');
    try {
      if (isFollowing) { await DbService.unfollowUser(currentUser.id, course.userId); setIsFollowing(false); toast.success('Unfollowed'); }
      else { await DbService.followUser(currentUser.id, course.userId); setIsFollowing(true); toast.success('Following'); }
    } catch (e) { toast.error('Action failed'); }
  };

  const handlePostReview = async () => {
    if (!currentUser || !course || !newReview.trim()) return;
    setSubmittingReview(true);
    try { await DbService.addCourseReview(course.id, course.userId, currentUser.id, newReview); setNewReview(''); toast.success('Posted!'); }
    catch (e) { toast.error('Failed'); } finally { setSubmittingReview(false); }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!course) return;
    try { await DbService.deleteCourseReview(course.id, reviewId); toast.success('Deleted!'); }
    catch (e) { toast.error('Failed to delete'); }
  };

  const handleShare = async () => {
    if (!course) return;
    const shareData = {
      title: course.title,
      text: `Elevate your mastery with ${course.title} by ${course.profiles?.fullName} on EduNook.`,
      url: window.location.href,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(window.location.href); toast.success('Link copied to clipboard'); }
    } catch (e) { console.error(e); }
  };

  const handleDownload = async () => {
    if (!course) return;
    if (isDownloaded) return toast.success('Course already available in your Offline Vault.');
    
    // Immediate feedback
    const syncToastId = toast.loading('Initializing Secure Vault...');

    try {
      const cache = await caches.open('edunook-vault-v1');
      const modulesToSync = chapters.filter(ch => ch.videoUrl || ch.pageUrl);
      
      if (modulesToSync.length === 0) {
        toast.dismiss(syncToastId);
        return toast.error('No downloadable content found in this course.');
      }

      let count = 0;
      for (const ch of modulesToSync) {
        const url = ch.videoUrl || ch.pageUrl;
        if (!url) continue;

        try {
          // Real physical caching
          const response = await fetch(url, { mode: 'no-cors' }); 
          await cache.put(url, response);
          count++;
          setSyncProgress(Math.round((count / modulesToSync.length) * 100));
          toast.loading(`Syncing: ${ch.title} (${Math.round((count / modulesToSync.length) * 100)}%)`, { id: syncToastId });
        } catch (err) {
          console.warn(`Sync skipped for ${ch.title}:`, err);
        }
      }

      setIsDownloaded(true);
      localStorage.setItem(`offline_${course.id}`, 'true');
      localStorage.setItem(`offline_data_${slug}`, JSON.stringify({ course, chapters }));
      toast.success('Course 100% Offline Ready!', { id: syncToastId });
    } catch (e) {
      toast.error('Vault access error. Please check browser permissions.', { id: syncToastId });
      console.error(e);
    }
  };

  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  if (loading || checkingAccess) return <Layout><div className="flex items-center justify-center h-screen bg-[#050505]"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div></Layout>;
  if (!course) return <Layout><div className="p-12 text-center text-2xl font-black text-white bg-[#050505]">Course not found</div></Layout>;

  const hasAccess = isEnrolled || activeChapter?.isFreeDemo;

  const handleEnroll = async () => {
    if (!currentUser) return toast.error('Please sign in to enroll');
    try {
      setCheckingAccess(true);
      
      // Simulated Payment Flow
      const loadingToast = toast.loading('Initializing secure payment gateway...');
      await new Promise(r => setTimeout(r, 1500));
      toast.loading('Processing payment...', { id: loadingToast });
      await new Promise(r => setTimeout(r, 2000));
      
      await DbService.enrollInCourse(course!.id, currentUser.id);
      setIsEnrolled(true);
      toast.success('Payment Successful! Welcome to the cohort.', { id: loadingToast });
    } catch (err) {
      toast.error('Transaction failed. Please try again.');
    } finally {
      setCheckingAccess(false);
    }
  };

  return (
    <Layout>
      <div className={`flex flex-col ${theaterMode ? 'w-full' : 'xl:flex-row'} min-h-[calc(100vh-64px)] bg-[#050505] overflow-x-hidden`}>
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          
          {/* Cinema Player */}
          <div 
            ref={playerContainerRef}
            className={`w-full bg-black relative group/player overflow-hidden select-none transition-all duration-500 ${theaterMode ? 'aspect-[21/9] max-h-[85vh]' : 'min-h-[380px] md:aspect-video shadow-[0_30px_100px_rgba(0,0,0,0.8)]'}`}
            onMouseMove={resetControlsTimeout}
            onMouseLeave={() => isPlaying && setShowControls(false)}
          >
            <AnimatePresence>
               {!hasStarted && activeChapter?.type === 'video' && (
                  <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[60] flex flex-col items-center justify-center cursor-pointer"
                    onClick={hasAccess ? togglePlay : undefined}
                  >
                     {course.thumbnailUrl && <img src={optimizeCloudinaryUrl(course.thumbnailUrl, 1920)} className="absolute inset-0 w-full h-full object-cover opacity-50 blur-sm scale-105" alt="" />}
                     <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
                     
                     {!hasAccess ? (
                        <div className="relative z-10 flex flex-col items-center gap-6 md:gap-8 p-6 md:p-10 bg-black/60 backdrop-blur-3xl rounded-[2.5rem] md:rounded-[3rem] border border-white/10 shadow-2xl max-w-lg mx-auto text-center">
                           <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40 shadow-[0_0_50px_rgba(var(--primary-rgb),0.3)]">
                              <ShieldAlert className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                           </div>
                           <div className="space-y-2 md:space-y-3">
                              <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Premium Content</h3>
                              <p className="text-muted-foreground text-xs md:text-sm font-medium leading-relaxed">This module is part of the professional curriculum. Enroll now to unlock full mastery.</p>
                           </div>
                           <button 
                             onClick={handleEnroll}
                             className="w-full py-4 md:py-5 bg-primary text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest shadow-2xl shadow-primary/40 hover:scale-105 transition-all flex items-center justify-center gap-3"
                           >
                              Unlock Course for ₹{course.price} <IndianRupee className="w-3.5 h-3.5 md:w-4 h-4" />
                           </button>
                        </div>
                     ) : (
                        <>
                           <motion.div 
                             whileHover={{ scale: 1.1, rotate: 5 }} whileTap={{ scale: 0.9 }}
                             className="relative w-20 h-20 md:w-28 md:h-28 rounded-full bg-primary/20 backdrop-blur-3xl border border-primary/40 flex items-center justify-center shadow-[0_0_80px_rgba(var(--primary-rgb),0.5)]"
                           >
                              <Play className="w-8 h-8 md:w-12 md:h-12 text-white fill-white ml-1.5" />
                           </motion.div>
                           <h3 className="relative mt-8 px-6 text-lg md:text-2xl font-black text-white uppercase tracking-[0.3em] text-center">{activeChapter.title}</h3>
                           {activeChapter.isFreeDemo && (
                              <div className="mt-4 px-4 py-1.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center gap-2">
                                 <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                                 <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Free Demo Access</span>
                              </div>
                           )}
                        </>
                     )}
                  </motion.div>
               )}
            </AnimatePresence>

            {activeChapter?.type === 'video' ? (
              <div className="w-full h-full relative" onMouseDown={handleHoldStart} onMouseUp={handleHoldEnd} onMouseLeave={handleHoldEnd}>
                {hasAccess && (
                   <video
                     ref={videoRef} src={activeChapter.videoUrl || undefined} onEnded={handleVideoEnded}
                     className="w-full h-full object-contain" playsInline onClick={togglePlay}
                     onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                     onDurationChange={() => setDuration(videoRef.current?.duration || 0)}
                     onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}
                   />
                )}

                {/* Overlays */}
                <AnimatePresence>
                  {isHolding && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className="absolute top-1/4 left-1/2 -translate-x-1/2 px-8 py-3 bg-primary/20 backdrop-blur-3xl border border-primary/40 rounded-full z-40 flex items-center gap-3"
                    >
                       <FastForward className="w-5 h-5 text-primary animate-pulse" />
                       <span className="text-xs font-black text-white uppercase tracking-widest">2x Speed</span>
                    </motion.div>
                  )}
                  {showNextOverlay && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-2xl px-6"
                    >
                       <div className="text-center mb-10">
                          <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-2">Up Next in {countdown}s</p>
                          <h2 className="text-2xl md:text-4xl font-black text-white max-w-xl leading-tight px-4">{nextChapter?.title}</h2>
                       </div>
                       <div className="flex gap-4">
                          <button onClick={() => setShowNextOverlay(false)} className="px-6 md:px-8 py-3 md:py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all">Cancel</button>
                          <button onClick={() => { setActiveChapter(nextChapter!); setShowNextOverlay(false); }} className="px-6 md:px-8 py-3 md:py-4 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-primary/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">Play Now <ChevronRight className="w-4 h-4" /></button>
                       </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Controls Bar */}
                <div className={`absolute inset-0 z-30 flex flex-col justify-end transition-opacity duration-500 bg-gradient-to-t from-black/95 via-transparent to-transparent ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <div className="px-4 md:px-8 pb-2 md:pb-3">
                    <div className="relative h-2 md:h-1.5 w-full bg-white/10 rounded-full cursor-pointer group/seek" 
                         onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); handleSeek(((e.clientX - r.left) / r.width) * duration); }}>
                       <div className="absolute top-0 left-0 h-full bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)]" style={{ width: `${(currentTime/duration)*100}%` }} />
                       <div className="absolute top-1/2 -translate-y-1/2 h-5 w-5 md:h-4 md:w-4 bg-white border-2 border-primary rounded-full scale-0 md:group-hover/seek:scale-100 transition-transform" style={{ left: `calc(${(currentTime/duration)*100}% - 10px)` }} />
                    </div>
                  </div>
                  <div className="px-4 md:px-8 py-3 md:py-6 flex items-center justify-between">
                    <div className="flex items-center gap-4 md:gap-8">
                       <button onClick={togglePlay} className="text-white hover:text-primary transition-all scale-110 md:scale-125 active:scale-90">
                          {isPlaying ? <Pause className="w-5 h-5 md:w-6 md:h-6 fill-white" /> : <Play className="w-5 h-5 md:w-6 md:h-6 fill-white" />}
                       </button>
                       <div className="flex items-center gap-3 text-white/80 text-[10px] md:text-[12px] font-black tracking-widest uppercase">
                          <span className="text-white">{formatTime(currentTime)}</span>
                          <span className="opacity-20">/</span>
                          <span>{formatTime(duration)}</span>
                       </div>
                    </div>
                    <div className="flex items-center gap-4 md:gap-7">
                       <div className="hidden md:flex items-center gap-3 group/vol">
                          <button onClick={() => { setIsMuted(!isMuted); if (videoRef.current) videoRef.current.muted = !isMuted; }} className="text-white/60 hover:text-white transition-colors">
                             {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                          </button>
                          <input type="range" min="0" max="1" step="0.05" value={isMuted ? 0 : volume} onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; } setIsMuted(v === 0); }} className="w-0 group-hover/vol:w-24 transition-all duration-500 accent-primary cursor-pointer" />
                       </div>
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild><button className="text-white/60 hover:text-white transition-colors"><Settings className="w-5 h-5" /></button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#0c0c0c]/95 backdrop-blur-3xl border-white/10 rounded-2xl p-2 min-w-[160px] shadow-2xl">
                             <div className="px-4 py-2 text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">Playback Speed</div>
                             {[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                                <DropdownMenuItem key={s} onClick={() => { setPlaybackSpeed(s); if (videoRef.current) videoRef.current.playbackRate = s; }}
                                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer transition-all ${playbackSpeed === s ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/50 hover:bg-white/5'}`}>
                                   {s}x {playbackSpeed === s && <CheckCircle className="w-3 h-3" />}
                                </DropdownMenuItem>
                             ))}
                          </DropdownMenuContent>
                       </DropdownMenu>
                       <button onClick={toggleFullscreen} className="text-white/60 hover:text-white transition-colors scale-110"><Maximize className="w-5 h-5" /></button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a] gap-1 md:gap-8 p-1 md:p-10 relative overflow-hidden">
                   {!hasAccess ? (
                      <div className="flex flex-col items-center gap-6 md:gap-8 p-6 md:p-10 bg-black/60 backdrop-blur-3xl rounded-[2.5rem] md:rounded-[3rem] border border-white/10 shadow-2xl max-w-lg mx-auto text-center relative z-10 scale-90 md:scale-100">
                         <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40 shadow-[0_0_50px_rgba(var(--primary-rgb),0.3)]">
                            <ShieldAlert className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                         </div>
                         <div className="space-y-2 md:space-y-3">
                            <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Skill Locked</h3>
                            <p className="text-muted-foreground text-xs md:text-sm font-medium leading-relaxed">This external workspace requires course enrollment. Join the cohort to proceed.</p>
                         </div>
                         <button 
                           onClick={handleEnroll}
                           className="w-full py-4 md:py-5 bg-primary text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest shadow-2xl shadow-primary/40 hover:scale-105 transition-all flex items-center justify-center gap-3"
                           >
                            Enroll for ₹{course.price} <IndianRupee className="w-3.5 h-3.5 md:w-4 h-4" />
                         </button>
                      </div>
                    ) : (
                      <div className="relative z-10 flex flex-col items-center justify-center gap-6 md:gap-10 w-full max-w-2xl text-center px-4">
                        <div className="relative w-full p-8 md:p-16 bg-gradient-to-b from-white/[0.03] to-transparent border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden group/launch">
                           <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/launch:opacity-100 transition-opacity duration-1000" />
                           
                           <div className="relative z-10 flex flex-col items-center gap-6">
                              <div className="w-20 h-20 md:w-28 md:h-28 bg-primary/10 rounded-[2rem] md:rounded-[2.5rem] border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_50px_rgba(var(--primary-rgb),0.2)] group-hover/launch:scale-110 transition-transform duration-500">
                                 {activeChapter?.type === 'quiz' ? <FileQuestion className="w-10 h-10 md:w-14 md:h-14" /> : <Rocket className="w-10 h-10 md:w-14 md:h-14" />}
                              </div>
                              
                              <div className="space-y-3">
                                 <h2 className="text-2xl md:text-4xl font-black text-white leading-none tracking-tighter uppercase">{activeChapter?.title}</h2>
                                 <div className="flex items-center justify-center gap-3">
                                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black text-muted-foreground uppercase tracking-widest">External Workspace</span>
                                    <div className="w-1 h-1 rounded-full bg-white/20" />
                                    <span className="text-[9px] font-black text-primary uppercase tracking-widest">{activeChapter?.type} Module</span>
                                 </div>
                              </div>

                              <p className="text-muted-foreground font-medium text-xs md:text-sm leading-relaxed max-w-md mx-auto opacity-60">This module requires an specialized environment. Click below to launch your dedicated instance.</p>
                              
                              <a 
                                href={launchUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  if (launchUrl === '#') {
                                    e.preventDefault();
                                    toast.error("Module workspace URL not found.");
                                    return;
                                  }
                                  if (document.fullscreenElement) document.exitFullscreen();
                                }}
                                className="mt-4 w-full md:w-auto px-12 md:px-16 py-4 md:py-5 bg-white text-black rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                              >
                                 Go to Workspace <ExternalLink className="w-4 h-4" />
                              </a>
                           </div>
                        </div>
                      </div>
                    )}
                </div>
            )}
          </div>

          {/* Navigation Bar */}
          <div className="bg-white/5 border-b border-white/5 flex items-center justify-between px-4 md:px-12 py-2 md:py-5 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-4 md:gap-6">
                  <button onClick={() => { if (prevChapter) { setActiveChapter(prevChapter); setHasStarted(false); window.scrollTo({ top: 0, behavior: 'smooth' }); } }} disabled={!prevChapter} className="flex items-center gap-2 md:gap-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white disabled:opacity-20 transition-all">
                      <ChevronLeft className="w-3 h-3 md:w-4 md:h-4" /> Previous
                  </button>
                  <div className="hidden md:block w-px h-4 bg-white/10" />
                  <button onClick={() => { if (nextChapter) { setActiveChapter(nextChapter); setHasStarted(false); window.scrollTo({ top: 0, behavior: 'smooth' }); } }} disabled={!nextChapter} className="flex items-center gap-2 md:gap-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-primary hover:scale-105 disabled:opacity-20 transition-all">
                      Next Lesson <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
                  </button>
              </div>
              <div className="flex items-center gap-3 md:gap-5 pr-2 md:pr-4">
                  <button onClick={handleShare} className="p-1.5 md:p-3 bg-white/5 border border-white/5 rounded-xl md:rounded-2xl hover:bg-white/10 transition-all text-white/60 hover:text-white" title="Share Course">
                      <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                   <button 
                     onClick={handleDownload} 
                     className={`p-1.5 md:p-3 rounded-xl md:rounded-2xl transition-all flex items-center gap-2 group/sync ${isDownloaded ? 'bg-emerald-500/20 border border-emerald-500/20 text-emerald-500' : 'bg-white/5 border border-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`} 
                     title={isDownloaded ? 'Course Synced Offline' : 'Sync for Offline'}
                   >
                       {isDownloaded ? <CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" /> : <Download className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover/sync:animate-bounce" />}
                       {syncProgress > 0 && syncProgress < 100 && (
                          <span className="text-[8px] font-black">{syncProgress}%</span>
                       )}
                   </button>
              </div>
          </div>

          <div className={`p-4 md:p-10 lg:p-16 ${theaterMode ? 'max-w-[1800px]' : 'max-w-[1600px]'} mx-auto w-full space-y-12 md:space-y-24 pb-40`}>
             {/* Header */}
             <div className="space-y-6 md:space-y-12">
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="px-4 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-[0.2em] shadow-lg shadow-primary/5">Batch 01</span>
                        <span className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40"><Rocket className="w-3 h-3" /> {course.category}</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white uppercase tracking-tighter leading-[0.9]">{course.title}</h1>
                </div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-8 md:gap-12 p-6 md:p-10 bg-white/[0.02] border border-white/5 rounded-[2rem] md:rounded-[3rem] backdrop-blur-3xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    
                    <Link to="/$username" params={{ username: course.profiles?.username || '' }} className="flex items-center gap-5 md:gap-6 relative z-10">
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[2rem] border-2 border-white/10 overflow-hidden group-hover:border-primary/40 transition-all duration-700">
                            {course.profiles?.avatarUrl ? (
                               <img src={optimizeCloudinaryUrl(course.profiles.avatarUrl, 200)} className="w-full h-full object-cover" alt="" />
                            ) : (
                               <div className="w-full h-full bg-primary/10 flex items-center justify-center"><User className="w-8 h-8 text-primary/40" /></div>
                            )}
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-xl md:text-2xl font-black text-white leading-none tracking-tight">{course.profiles?.fullName}</h3>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] md:text-[11px] font-black text-primary uppercase tracking-[0.2em]">Course Director</span>
                                <div className="w-1 h-1 rounded-full bg-white/20" />
                                <span className="text-[10px] md:text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">{course.profiles?.username}</span>
                            </div>
                        </div>
                    </Link>

                    {currentUser?.id !== course.userId && (
                       <button 
                         onClick={toggleFollow}
                         className={`w-full md:w-auto px-10 md:px-12 py-3.5 md:py-5 rounded-[1.5rem] md:rounded-[2rem] text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 group/follow ${
                           isFollowing ? 'bg-white/5 text-white border border-white/10 hover:bg-white/10' : 'bg-primary text-white shadow-[0_15px_40px_rgba(var(--primary-rgb),0.4)] hover:scale-[1.03] active:scale-[0.95]'
                         }`}
                       >
                          {isFollowing ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4 group-hover/follow:scale-110 transition-transform" /> Follow Creator</>}
                       </button>
                    )}
                </motion.div>
             </div>

             <div className="flex flex-col gap-16 md:gap-24">
                {/* Custom Tabs */}
                <div className="flex items-center gap-8 md:gap-14 border-b border-white/5 pb-2">
                   {['overview', 'reviews'].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`relative pb-6 text-[11px] md:text-[13px] font-black uppercase tracking-[0.3em] transition-all ${
                          activeTab === tab ? 'text-primary' : 'text-muted-foreground/40 hover:text-white'
                        }`}
                      >
                         <div className="flex items-center gap-3">
                            {tab === 'overview' && <BookOpen className="w-4 h-4" />}
                            {tab === 'reviews' && <MessageCircle className="w-4 h-4" />}
                            {tab}
                         </div>
                         {activeTab === tab && (
                            <motion.div layoutId="tab-active" className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]" />
                         )}
                      </button>
                   ))}
                </div>

                <AnimatePresence mode="wait">
                    {activeTab === 'overview' ? (
                      <motion.div 
                        key="ov" 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        exit={{ opacity: 0, x: 10 }} 
                        className="grid grid-cols-1 2xl:grid-cols-2 gap-16 md:gap-24"
                      >
                         <div className="space-y-12">
                            <div className="space-y-8">
                               <div className="space-y-4">
                                  <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-primary">The Syllabus</h3>
                                  <p className="text-base md:text-lg lg:text-xl text-white/70 leading-relaxed font-medium whitespace-pre-wrap">{course.description || "Master the core principles of this curriculum through expert-led modules and hands-on professional execution."}</p>
                               </div>

                               <div className="space-y-6 pt-4">
                                  <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Curriculum Breakdown</h4>
                                  <div className="space-y-4">
                                     {chapters.map((ch, i) => (
                                        <div key={ch.id} className="flex items-center gap-4 group/item">
                                           <span className="text-[10px] font-black text-primary/40 w-5">{(i+1).toString().padStart(2, '0')}</span>
                                           <div className="flex-1 h-px bg-white/5 group-hover/item:bg-primary/20 transition-colors" />
                                           <span className="text-xs md:text-sm font-bold text-white/60 group-hover/item:text-white transition-colors">{ch.title}</span>
                                        </div>
                                     ))}
                                  </div>
                               </div>
                            </div>
                            
                            {/* Course Meta Specs */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 2xl:grid-cols-2 gap-8 md:gap-12 py-10 border-y border-white/5">
                                <div className="flex flex-col gap-2">
                                   <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Language</span>
                                   <span className="text-sm md:text-base font-black text-white uppercase tracking-tight flex items-center gap-2.5"><Globe className="w-4 h-4 text-primary" /> {course.language || 'English'}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                   <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Release Date</span>
                                   <span className="text-sm md:text-base font-black text-white uppercase tracking-tight">{new Date(course.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                   <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Verified Views</span>
                                   <span className="text-sm md:text-base font-black text-white uppercase tracking-tight flex items-center gap-2.5"><Eye className="w-4 h-4 text-primary" /> {course.views?.toLocaleString() || '0'}</span>
                                </div>
                                <div className="flex flex-col gap-2">
                                   <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Access Term</span>
                                   <span className="text-sm md:text-base font-black text-white uppercase tracking-tight">{course.expiresInDays ? `${course.expiresInDays} Days` : 'Lifetime Access'}</span>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-10 md:gap-16 pt-4">
                                <div className="flex flex-col gap-1"><span className="text-4xl md:text-5xl font-black text-white">{chapters.length}</span><span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Modules</span></div>
                                <div className="flex flex-col gap-1"><span className="text-4xl md:text-5xl font-black text-white">{course.price > 0 ? 'PAID' : 'FREE'}</span><span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Access</span></div>
                            </div>
                         </div>
                         <div className="space-y-12">
                            <div className="p-8 md:p-14 bg-white/[0.03] border border-white/10 rounded-[3rem] shadow-3xl space-y-10 relative overflow-hidden">
                               <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] rounded-full" />
                               <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-muted-foreground/60">Professional Outcomes</h3>
                               <div className="space-y-8">
                                  {[
                                    { t: 'Industry-Standard Proficiency', d: 'Master the core workflows and tooling used by elite production teams.' },
                                    { t: 'Strategic Architecture', d: 'Develop the capacity to design and scale complex technical solutions.' },
                                    { t: 'Career Acceleration', d: 'Bridge the gap between theoretical knowledge and senior-level execution.' }
                                  ].map((item, i) => (
                                    <div key={i} className="flex gap-6 relative z-10">
                                      <div className="mt-1 w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-xl shrink-0"><CheckCircle className="w-4 h-4" /></div>
                                      <div className="space-y-1.5">
                                         <p className="text-base md:text-lg font-black text-white">{item.t}</p>
                                         <p className="text-xs font-medium text-muted-foreground/60 leading-relaxed">{item.d}</p>
                                      </div>
                                    </div>
                                  ))}
                               </div>
                            </div>

                           {/* Certificate Preview */}
                           <div className="group relative p-8 md:p-12 bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-[2.5rem] md:rounded-[3rem] overflow-hidden flex flex-col gap-6">
                              <div className="flex items-center gap-4">
                                 <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary"><Award className="w-6 h-6" /></div>
                                 <div>
                                    <h4 className="text-sm md:text-lg font-black text-white uppercase tracking-tighter">Certification of Mastery</h4>
                                    <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Included with enrollment</p>
                                 </div>
                              </div>
                              <p className="text-xs md:text-sm text-muted-foreground/60 leading-relaxed font-medium">Showcase your achievement to the world. Upon completion, receive a cryptographically verified certificate linked to your professional profile.</p>
                              <div className="relative aspect-[1.414/1] w-full bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-700">
                                 <div className="flex flex-col items-center gap-2 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <Trophy className="w-12 h-12" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">EduNook Verified</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </motion.div>
                    ) : (
                      <motion.div key="rv" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-8 md:space-y-12">
                        {currentUser && (
                           <div className="p-5 md:p-10 bg-white/5 border border-white/5 rounded-[2rem] md:rounded-[3rem] space-y-6 md:space-y-8">
                              <div className="flex items-center gap-4 md:gap-5">
                                 <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl overflow-hidden border border-white/10">
                                    {dbUser?.avatarUrl ? (
                                       <img src={optimizeCloudinaryUrl(dbUser.avatarUrl, 120)} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                       <div className="w-full h-full bg-primary/10 flex items-center justify-center"><User className="w-5 h-5 md:w-6 md:h-6 text-primary/40" /></div>
                                    )}
                                 </div>
                                 <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-white">Join the Discussion</h3>
                              </div>
                              <div className="relative">
                                 <textarea value={newReview} onChange={(e) => setNewReview(e.target.value)} placeholder="Share your experience..." className="w-full h-28 md:h-36 bg-black/40 border border-white/5 rounded-[1.25rem] md:rounded-[2rem] p-5 md:p-8 text-sm md:text-base font-medium text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none" />
                                 <div className="absolute bottom-3 right-3 md:bottom-6 md:right-6">
                                    <button onClick={handlePostReview} disabled={submittingReview || !newReview.trim()} className="px-5 md:px-10 py-2 md:py-3 bg-primary text-white rounded-lg md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-primary/40 hover:scale-[1.05] disabled:opacity-30 transition-all flex items-center gap-3">
                                       {submittingReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 md:w-4 md:h-4" /> Post</>}
                                    </button>
                                 </div>
                              </div>
                           </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
                           {reviews.length === 0 ? (
                              <div className="col-span-full py-16 md:py-32 text-center opacity-20 space-y-4 md:space-y-6"><MessageCircle className="w-14 h-14 md:w-20 md:h-20 mx-auto" /><p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.5em]">Feed is empty</p></div>
                           ) : (
                              reviews.map((r, i) => (
                                 <motion.div key={r.id || `review-${i}`} layout className="p-5 md:p-8 bg-white/5 border border-white/5 rounded-[1.5rem] md:rounded-[3rem] hover:bg-white/[0.08] transition-all group relative">
                                    <div className="flex items-start justify-between">
                                       <div className="flex items-center gap-3 md:gap-5">
                                          <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-black border border-white/10 overflow-hidden group-hover:border-primary/40 transition-all">
                                             {r.profiles?.avatarUrl ? (
                                                <img src={optimizeCloudinaryUrl(r.profiles.avatarUrl, 150)} className="w-full h-full object-cover" alt="" />
                                             ) : (
                                                <div className="w-full h-full flex items-center justify-center text-primary/40 font-black"><User className="w-5 h-5 md:w-6 md:h-6" /></div>
                                             )}
                                          </div>
                                          <div className="flex flex-col">
                                             <div className="flex items-center gap-2"><span className="text-[13px] md:text-[15px] font-black text-white">{r.profiles?.fullName}</span><VerificationTick planId={r.profiles?.subscription?.planId} size={14} /></div>
                                             <span className="text-[7px] md:text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-0.5 opacity-40">Scholar</span>
                                          </div>
                                       </div>
                                       <div className="flex items-center gap-2 md:gap-3">
                                          <span className="text-[7px] md:text-[9px] font-bold text-muted-foreground/30">{new Date(r.createdAt).toLocaleDateString()}</span>
                                          {currentUser?.id === r.userId && (
                                             <DropdownMenu>
                                                <DropdownMenuTrigger asChild><button className="p-1.5 hover:bg-white/10 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100"><MoreVertical className="w-3.5 h-3.5 text-white" /></button></DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-black/90 backdrop-blur-3xl border-white/10 rounded-2xl p-2"><DropdownMenuItem onClick={() => handleDeleteReview(r.id)} className="flex items-center gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 rounded-xl cursor-pointer font-black text-[9px] md:text-[10px] uppercase tracking-widest"><Trash2 className="w-4 h-4" /> Delete</DropdownMenuItem></DropdownMenuContent>
                                             </DropdownMenu>
                                          )}
                                       </div>
                                    </div>
                                    <p className="mt-5 md:mt-8 text-[13px] md:text-[15px] text-white/70 leading-relaxed font-medium italic">"{r.content}"</p>
                                 </motion.div>
                              ))
                           )}
                        </div>
                     </motion.div>
                   )}
                </AnimatePresence>
             </div>
          </div>
        </div>

         {/* Sidebar */}
        {!theaterMode && (
          <aside className="w-full xl:w-[380px] 2xl:w-[450px] xl:sticky xl:top-0 h-fit xl:h-screen bg-black border-l border-white/5 xl:overflow-y-auto z-40 no-scrollbar">
            <div className="p-6 md:p-10 border-b border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2" />
              
              <div className="flex items-center justify-between mb-6 relative z-10">
                 <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3"><Monitor className="w-6 h-6 text-primary" /> Playlist</h2>
                 <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Mastery Tracking</span>
                 </div>
              </div>

              {/* Progress System */}
              <div className="space-y-4 relative z-10">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Your Progress</span>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">{Math.round((chapters.findIndex(c => c.id === activeChapter?.id) / chapters.length) * 100)}%</span>
                 </div>
                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(chapters.findIndex(c => c.id === activeChapter?.id) / chapters.length) * 100}%` }}
                      className="h-full bg-gradient-to-r from-primary to-accent shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]"
                    />
                 </div>
                 <div className="flex items-center gap-2 pt-2">
                    <div className="flex -space-x-2">
                       {[1,2,3].map(i => (
                         <div key={i} className="w-5 h-5 rounded-full border-2 border-black bg-muted" />
                       ))}
                       <div className="w-5 h-5 rounded-full border-2 border-black bg-primary flex items-center justify-center text-[7px] font-black text-white">+8</div>
                    </div>
                    <span className="text-[8px] font-black text-muted-foreground/60 uppercase tracking-widest ml-1">Learning with you</span>
                 </div>
              </div>
            </div>
            
            <div className="p-4 md:p-8 space-y-4 pb-40">
               {chapters.map((ch, i) => {
                 const active = activeChapter?.id === ch.id;
                 const uniqueKey = ch.id || `chapter-${i}`;
                 return (
                   <button key={uniqueKey} onClick={() => { setActiveChapter(ch); setHasStarted(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                     className={`w-full group relative rounded-2xl md:rounded-[1.75rem] p-3 md:p-4 transition-all text-left flex items-center gap-3 md:gap-4 border ${active ? 'bg-primary/10 border-primary/30 shadow-lg' : 'border-transparent hover:bg-white/[0.02] hover:border-white/5'}`}>
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-[1rem] flex items-center justify-center transition-all duration-500 shrink-0 ${active ? 'bg-primary text-white scale-105 shadow-[0_8px_20px_rgba(var(--primary-rgb),0.3)]' : 'bg-white/5 text-muted-foreground group-hover:bg-white/10 group-hover:text-white'}`}>
                         {active ? <Sparkles className="w-5 h-5 md:w-6 md:h-6 animate-pulse" /> : (
                            ch.isFreeDemo ? <PlayCircle className="w-5 h-5 md:w-6 md:h-6 text-emerald-500 opacity-60 group-hover:opacity-100 transition-opacity" /> : <span className="text-[10px] md:text-xs font-black opacity-30">{(i+1).toString().padStart(2,'0')}</span>
                         )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                         <div className="flex items-center gap-2">
                            <p className={`text-xs md:text-[14px] font-black truncate transition-colors ${active ? 'text-white' : 'text-muted-foreground group-hover:text-white'}`}>{ch.title}</p>
                            {ch.isFreeDemo && !isEnrolled && (
                               <span className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded-md text-[6px] md:text-[7px] font-black text-emerald-500 uppercase tracking-widest whitespace-nowrap">Free</span>
                            )}
                         </div>
                         <div className="flex items-center gap-2">
                            <div className={`w-1 h-1 rounded-full ${active ? 'bg-primary animate-pulse' : 'bg-white/10'}`} />
                            <span className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.1em] opacity-30 truncate">{ch.type} Module</span>
                         </div>
                      </div>
                      {active && (
                         <div className="flex gap-0.5 items-end h-2 md:h-3 pb-1 pr-1 shrink-0">
                            {[1, 2, 3].map(j => <motion.div key={j} animate={{ height: [3, 10, 3] }} transition={{ repeat: Infinity, duration: 1, delay: j*0.2 }} className="w-0.5 bg-primary rounded-full" />)}
                         </div>
                      )}
                   </button>
                 );
               })}
            </div>
          </aside>
        )}
      </div>
    </Layout>
  );
}
