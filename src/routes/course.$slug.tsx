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
  ShieldAlert, IndianRupee, Rocket
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
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews'>('overview');
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [newReview, setNewReview] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  
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
    let unsubReviews: (() => void) | undefined;
    
    async function loadData() {
      try {
        const c = await DbService.getCourse(slug);
        if (c) {
          DbService.incrementCourseViews(c.id);
          const ch = await DbService.getChapters(c.id);
          setCourse(c);
          setChapters(ch);
          if (ch.length > 0) setActiveChapter(ch[0]);

          unsubReviews = DbService.subscribeToCourseReviews(c.id, setReviews);

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
      await DbService.enrollInCourse(course.id, currentUser.id);
      setIsEnrolled(true);
      toast.success('Successfully enrolled! Welcome to the journey.');
    } catch (err) {
      toast.error('Enrollment failed. Please try again.');
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
                      <div className="relative z-10 flex flex-col items-center justify-center gap-4 md:gap-8 w-full max-w-xs md:max-w-md text-center">
                        <div className="p-6 md:p-12 bg-primary/5 rounded-[2rem] md:rounded-[3rem] border border-primary/10 shadow-[0_0_50px_rgba(var(--primary-rgb),0.1)]">
                           {activeChapter?.type === 'quiz' ? <FileQuestion className="w-10 h-10 md:w-20 md:h-20 text-primary" /> : <ExternalLink className="w-10 h-10 md:w-20 md:h-20 text-primary" />}
                        </div>
                        <div className="space-y-1 md:space-y-4 px-4">
                           <h2 className="text-lg md:text-2xl font-black text-white leading-tight tracking-tight">{activeChapter?.title}</h2>
                           <p className="text-muted-foreground font-medium text-[10px] md:text-sm leading-relaxed opacity-70">This module requires an external workspace. Access it below to continue your journey.</p>
                        </div>
                        <a 
                           href={launchUrl}
                           target="_blank"
                           rel="noopener noreferrer"
                           onClick={(e) => {
                             if (launchUrl === '#') {
                               e.preventDefault();
                               toast.error("Module workspace URL not found for this chapter.");
                               return;
                             }
                             if (document.fullscreenElement) document.exitFullscreen();
                           }}
                           className="w-full md:w-auto px-8 md:px-14 py-4 md:py-5 bg-primary text-white rounded-full md:rounded-[2rem] font-black text-[9px] md:text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-[1.03] active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                           <Rocket className="w-4 h-4 md:w-5 md:h-5" /> Launch Module <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        </a>
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
                  <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success('Link Copied!'); }} className="p-1.5 md:p-3 bg-white/5 border border-white/5 rounded-xl md:rounded-2xl hover:bg-white/10 transition-all text-white/60 hover:text-white">
                      <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                  <button className="p-1.5 md:p-3 bg-white/5 border border-white/5 rounded-xl md:rounded-2xl hover:bg-white/10 transition-all text-white/60 hover:text-white">
                      <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
              </div>
          </div>

          {/* Core Info */}
          <div className={`p-6 md:p-12 lg:p-16 ${theaterMode ? 'max-w-7xl' : 'max-w-5xl'} mx-auto w-full space-y-12 md:space-y-16 pb-40`}>
             
             {/* Header */}
             <div className="space-y-6 md:space-y-10">
                <div className="flex flex-wrap items-center gap-3 md:gap-4">
                    <div className="flex items-center gap-2.5 px-4 md:px-6 py-2 md:py-3 bg-primary/10 border border-primary/20 rounded-[1rem] md:rounded-[1.25rem] text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                        <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4" /> Professional Tier
                    </div>
                    <span className="px-4 md:px-6 py-2 md:py-3 bg-white/5 border border-white/10 rounded-[1rem] md:rounded-[1.25rem] text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{course.category}</span>
                </div>
                <h1 className="text-3xl md:text-6xl lg:text-7xl xl:text-8xl 2xl:text-9xl font-black tracking-tighter text-white leading-[0.85]">{course.title}</h1>
                
                {/* Publisher Card */}
                <motion.div 
                   initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                   className="relative group p-4 md:p-8 bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 rounded-[2rem] md:rounded-[3rem] overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8"
                >
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-3xl -z-10" />
                    
                    <Link to="/$username" params={{ username: course.profiles?.username || '' }} className="flex items-center gap-5 md:gap-6 w-full md:w-auto">
                        <div className="relative shrink-0">
                            <div className="w-14 h-14 md:w-24 md:h-24 rounded-[1.25rem] md:rounded-[2rem] bg-black border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-105 group-hover:rotate-2">
                                {course.profiles?.avatarUrl ? <img src={optimizeCloudinaryUrl(course.profiles.avatarUrl, 200)} className="w-full h-full object-cover" alt="" /> : <User className="w-7 h-7 md:w-10 md:h-10 text-primary/40" />}
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-primary p-1 md:p-1.5 rounded-lg md:rounded-xl border-2 md:border-4 border-[#050505] shadow-lg">
                                <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3 text-white fill-white" />
                            </div>
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 md:gap-3">
                                <span className="text-base md:text-2xl font-black text-white tracking-tight truncate">{course.profiles?.fullName}</span>
                                <VerificationTick planId={course.profiles?.subscription?.planId} size={18} />
                            </div>
                            <div className="flex items-center gap-2 md:gap-3 mt-1">
                                <span className="text-[8px] md:text-[10px] font-black text-primary uppercase tracking-[0.2em]">{course.profiles?.subscription?.planId || 'Educator'} Mastery</span>
                                <div className="w-1 h-1 rounded-full bg-white/20" />
                                <span className="text-[8px] md:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">{course.profiles?.followersCount || 0} Learners</span>
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

             {/* Content */}
             <div className="space-y-6 md:space-y-12">
                <div className="flex items-center gap-6 md:gap-8 border-b border-white/5 overflow-x-auto no-scrollbar">
                    {['overview', 'reviews'].map((t) => (
                       <button key={t} onClick={() => setActiveTab(t as any)} className={`relative pb-3 md:pb-6 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center gap-2 ${activeTab === t ? 'text-primary' : 'text-muted-foreground hover:text-white'}`}>
                          {t} {t === 'reviews' && <span className="px-2 py-0.5 bg-white/5 rounded-lg text-[8px] opacity-40">{reviews.length}</span>}
                          {activeTab === t && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]" />}
                       </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                   {activeTab === 'overview' ? (
                     <motion.div key="ov" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20">
                        <div className="space-y-6 md:space-y-10">
                           <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-primary">The Syllabus</h3>
                           <p className="text-sm md:text-[20px] text-muted-foreground leading-relaxed font-medium opacity-80 whitespace-pre-wrap">{course.description || "Master the core principles and professional execution of this curriculum in a high-intensity learning environment."}</p>
                           <div className="flex flex-wrap gap-6 md:gap-10">
                               <div className="flex flex-col"><span className="text-xl md:text-3xl font-black text-white">{chapters.length}</span><span className="text-[8px] md:text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1 opacity-40">Modules</span></div>
                               <div className="flex flex-col"><span className="text-xl md:text-3xl font-black text-white">4.9</span><span className="text-[8px] md:text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1 opacity-40">Global Rating</span></div>
                               <div className="flex flex-col"><span className="text-xl md:text-3xl font-black text-white">20h</span><span className="text-[8px] md:text-[9px] font-black text-muted-foreground uppercase tracking-widest mt-1 opacity-40">Total Content</span></div>
                           </div>
                        </div>
                        <div className="p-6 md:p-14 bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] md:rounded-[4rem] shadow-3xl space-y-6 md:space-y-10">
                           <h3 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60">Learning Outcomes</h3>
                           <div className="space-y-6 md:space-y-8">
                              {[
                                { t: 'Executive Certificate', d: 'Earn a globally recognized credential.' },
                                { t: 'Industry Standard Tools', d: 'Master the tech used by professionals.' },
                                { t: 'Lifetime Access', d: 'Always return to refreshed content.' }
                              ].map((item, i) => (
                                <div key={i} className="flex gap-4 md:gap-6">
                                  <div className="mt-1 w-6 h-6 md:w-7 md:h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xl shrink-0"><CheckCircle className="w-3.5 h-3.5 md:w-4 md:h-4" /></div>
                                  <div className="space-y-1"><p className="text-[13px] md:text-[15px] font-black text-white">{item.t}</p><p className="text-[9px] md:text-xs font-medium text-muted-foreground opacity-50">{item.d}</p></div>
                                </div>
                              ))}
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
          <aside className="w-full xl:w-[380px] 2xl:w-[450px] xl:sticky xl:top-0 h-fit xl:h-screen bg-black border-l border-white/5 xl:overflow-y-auto z-40">
            <div className="p-6 md:p-12 border-b border-white/5 bg-gradient-to-br from-white/[0.03] to-transparent">
              <div className="flex items-center justify-between mb-2">
                 <h2 className="text-xl md:text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-4"><BookOpen className="w-6 h-6 md:w-8 md:h-8 text-primary" /> Journey</h2>
                 <span className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-lg text-[9px] font-black text-primary uppercase tracking-widest">{chapters.length} Parts</span>
              </div>
              <p className="text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">Complete the syllabus to unlock certification</p>
            </div>
            
            <div className="p-4 md:p-8 space-y-4 pb-40">
               {chapters.map((ch, i) => {
                 const active = activeChapter?.id === ch.id;
                 const uniqueKey = ch.id || `chapter-${i}`;
                 return (
                   <button key={uniqueKey} onClick={() => { setActiveChapter(ch); setHasStarted(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                     className={`w-full group relative rounded-[2rem] md:rounded-[2.5rem] p-4 md:p-6 transition-all text-left flex items-center gap-4 md:gap-6 border ${active ? 'bg-primary/10 border-primary/40 shadow-2xl' : 'border-transparent hover:bg-white/[0.03] hover:border-white/5'}`}>
                      <div className={`w-12 h-12 md:w-16 md:h-16 rounded-[1.25rem] md:rounded-[1.5rem] flex items-center justify-center transition-all duration-700 shrink-0 ${active ? 'bg-primary text-white scale-110 shadow-[0_15px_30px_rgba(var(--primary-rgb),0.5)]' : 'bg-white/5 text-muted-foreground group-hover:bg-white/10 group-hover:text-white'}`}>
                         {active ? <Sparkles className="w-6 h-6 md:w-8 md:h-8 animate-pulse" /> : (
                            ch.isFreeDemo ? <PlayCircle className="w-6 h-6 md:w-8 md:h-8 text-emerald-500 opacity-60 group-hover:opacity-100 transition-opacity" /> : <span className="text-xs md:text-sm font-black opacity-30">{(i+1).toString().padStart(2,'0')}</span>
                         )}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                         <div className="flex items-center gap-2">
                            <p className={`text-sm md:text-[17px] font-black truncate transition-colors ${active ? 'text-white' : 'text-muted-foreground group-hover:text-white'}`}>{ch.title}</p>
                            {ch.isFreeDemo && !isEnrolled && (
                               <span className="px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded-md text-[7px] md:text-[8px] font-black text-emerald-500 uppercase tracking-widest whitespace-nowrap">Demo</span>
                            )}
                         </div>
                         <div className="flex items-center gap-2">
                            <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full ${active ? 'bg-primary animate-pulse shadow-[0_0_10px_var(--primary)]' : 'bg-white/10'}`} />
                            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.15em] opacity-40 truncate">{ch.type === 'video' ? 'Video Masterclass' : 'Skill Assessment'}</span>
                         </div>
                      </div>
                      {active && (
                         <div className="flex gap-1 items-end h-3 md:h-4 pb-1 pr-1 md:pr-2 shrink-0">
                            {[1, 2, 3].map(j => <motion.div key={j} animate={{ height: [4, 16, 4] }} transition={{ repeat: Infinity, duration: 1, delay: j*0.2 }} className="w-0.5 md:w-1 bg-primary rounded-full" />)}
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
