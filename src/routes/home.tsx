/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useSearch, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { DbService, Course, Profile } from '@/lib/db-service';
import { CourseCard } from '@/components/CourseCard';
import { Layout } from '@/components/Layout';
import { CourseCardSkeleton } from '@/components/SkeletonLoader';
import { Plus, Search, BookOpen, Filter, PlayCircle, Clock, Trash2, MoreVertical, Sparkles, TrendingUp, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

export const Route = createFileRoute('/home')({
  validateSearch: (search: Record<string, unknown>): { q?: string; tab?: TabType } => {
    return {
      q: (search.q as string) || undefined,
      tab: (search.tab as TabType) || 'All',
    };
  },
  head: () => ({
    meta: [
      { title: 'Home — EduNook' },
    ],
  }),
  component: HomePage,
});

type EnrichedCourse = Course & { profiles: Profile | null };
type TabType = 'All' | 'Free' | 'Paid';

function HomePage() {
  const navigate = useNavigate();
  const { user, dbUser, loading: authLoading, refreshProfile } = useAuth();
  
  const searchParams = useSearch({ from: '/home' }) as { q?: string; tab?: TabType };
  
  const [courses, setCourses] = useState<EnrichedCourse[]>([]);
  const [history, setHistory] = useState<Record<string, { chapterId: string, lastVisited: string }>>({});
  const [enrollmentMap, setEnrollmentMap] = useState<Record<string, boolean>>({});
  
  // Instant Offline Detection
  const [loading, setLoading] = useState(() => !localStorage.getItem('edunook_universal_cache'));
  const [activeTab, setActiveTab] = useState<TabType>(searchParams.tab || 'All');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollThumbWidth, setScrollThumbWidth] = useState(100);
  const [scrollThumbLeft, setScrollThumbLeft] = useState(0);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);

  const updateScrollbar = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ratio = el.clientWidth / el.scrollWidth;
    setScrollThumbWidth(Math.max(ratio * 100, 10));
    setScrollThumbLeft((el.scrollLeft / el.scrollWidth) * 100);
  }, []);

  const onThumbMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    dragStartX.current = clientX;
    dragStartScrollLeft.current = scrollRef.current?.scrollLeft || 0;
    e.preventDefault();
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollbar();
    el.addEventListener('scroll', updateScrollbar);
    window.addEventListener('resize', updateScrollbar);
    const onMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current || !scrollRef.current) return;
      const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const dx = clientX - dragStartX.current;
      const scrollRatio = scrollRef.current.scrollWidth / scrollRef.current.clientWidth;
      scrollRef.current.scrollLeft = dragStartScrollLeft.current + dx * scrollRatio;
    };
    const onMouseUp = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onMouseMove);
    window.addEventListener('touchend', onMouseUp);
    return () => {
      el.removeEventListener('scroll', updateScrollbar);
      window.removeEventListener('resize', updateScrollbar);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onMouseMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [updateScrollbar]);

  // Security Check
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/login' });
    }
  }, [user, authLoading, navigate]);

  // Load Data logic
  useEffect(() => {
    async function loadData() {
      // 1. Instant Recovery from Universal Cache (Zero-latency)
      const universalCache = localStorage.getItem('edunook_universal_cache');
      if (universalCache) {
        try {
          const { courses: c, history: h, enrollmentMap: e } = JSON.parse(universalCache);
          setCourses(c);
          if (h) setHistory(h);
          if (e) setEnrollmentMap(e);
          setLoading(false);
        } catch (err) { console.error('Universal cache corrupt:', err); }
      }

      // 2. Network Sync (If online)
      try {
        await DbService.ensureUsernameMapLoaded();
        const courseData = await DbService.getCourses({ isPublished: true });
        let historyData = {};
        let enrollments: Record<string, boolean> = {};

        if (user) {
          historyData = await DbService.getHistory(user.id);
          const historyCourseIds = Object.keys(historyData || {});
          await Promise.all(
            historyCourseIds.map(async (cId) => {
               const c = courseData.find(course => course.id === cId);
               if (c) {
                  if (c.userId === user.id || c.price === 0) {
                     enrollments[cId] = true;
                  } else {
                     try {
                       enrollments[cId] = await DbService.isEnrolled(cId, user.id);
                     } catch (e) {
                       enrollments[cId] = false;
                     }
                  }
               }
            })
          );
        }

        setCourses(courseData);
        setHistory(historyData);
        setEnrollmentMap(enrollments);

        // Update Universal Cache for next visit
        localStorage.setItem('edunook_universal_cache', JSON.stringify({ 
          courses: courseData, 
          history: historyData, 
          enrollmentMap: enrollments 
        }));
      } catch (err) {
        console.warn('Network sync failed, staying in offline mode.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user]);

  // Update URL and scroll when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    navigate({ search: { ...searchParams, tab: tab === 'All' ? undefined : tab } as any });
  };

  const handleRemoveHistory = async (courseId: string) => {
    if (!user) return;
    try {
      await DbService.removeFromHistory(user.id, courseId);
      const newHistory = { ...history };
      delete newHistory[courseId];
      setHistory(newHistory);
      toast.success('Removed from history');
    } catch (err) {
      toast.error('Failed to remove');
    }
  };

  // Filtering Logic (YouTube Style)
  const filteredCourses = useMemo(() => {
    let list = [...courses];

    // Filter by Tab
    if (activeTab === 'Free') {
      list = list.filter(c => c.price === 0);
    } else if (activeTab === 'Paid') {
      list = list.filter(c => c.price > 0);
    }

    // Filter by Search Query
    if (searchParams.q) {
      const q = searchParams.q.toLowerCase();
      list = list.filter(c => 
        c.title.toLowerCase().includes(q) || 
        c.profiles?.fullName?.toLowerCase().includes(q) || 
        c.profiles?.username?.toLowerCase().includes(q) ||
        (c as any).creatorName?.toLowerCase().includes(q) ||
        (c as any).publisherName?.toLowerCase().includes(q)
      );
    }

    // 3. Smart Sorting (Views + Language + Subscription)
    const userLang = dbUser?.preferences?.learning?.language || 'English';

    list.sort((a, b) => {
      // 1. Boost Featured (Edge) if not searching
      if (!searchParams.q) {
        const score = (plan: string) => {
          if (plan === 'edge') return 2;
          return 0;
        };
        const scoreDiff = score(b.profiles?.subscription?.planId || 'none') - score(a.profiles?.subscription?.planId || 'none');
        if (scoreDiff !== 0) return scoreDiff;
      }

      // 2. Language Match Boost
      if (a.language === userLang && b.language !== userLang) return -1;
      if (b.language === userLang && a.language !== userLang) return 1;

      // 3. View Count (Popularity)
      const viewsDiff = (b.views || 0) - (a.views || 0);
      if (viewsDiff !== 0) return viewsDiff;

      // 4. Recency
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // 4. Patch current user's own courses
    if (dbUser?.fullName && user?.id) {
      list = list.map(course => {
        if (course.userId === user.id) {
          return {
            ...course,
            publisherName: dbUser.fullName,
            profiles: course.profiles ? { ...course.profiles, fullName: dbUser.fullName } : { fullName: dbUser.fullName } as any
          };
        }
        return course;
      });
    }

    return list;
  }, [courses, activeTab, searchParams.q, dbUser, user]);

  const historyCourses = useMemo(() => {
    return courses
      .filter(c => history[c.id] && enrollmentMap[c.id])
      .sort((a, b) => new Date(history[b.id].lastVisited).getTime() - new Date(history[a.id].lastVisited).getTime());
  }, [courses, history, enrollmentMap]);

  const featuredCourses = useMemo(() => {
    if (searchParams.q) return [];
    return courses.filter(c => {
      const plan = c.profiles?.subscription?.planId;
      return plan === 'edge';
    }).slice(0, 8);
  }, [courses, searchParams.q]);

  if (authLoading || (loading && !courses.length)) {
    return (
      <Layout>
        <div className="w-full max-w-[1600px] mx-auto px-4 md:px-10 py-10">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <CourseCardSkeleton key={i} />)}
           </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Background Aurora Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[10%] right-[-10%] w-[50%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[20%] left-[-5%] w-[40%] h-[30%] bg-accent/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Filter Tabs - Sticky below Header with ZERO gap */}
      <div className="sticky top-[60px] md:top-[72px] z-40 bg-background/80 backdrop-blur-xl border-b border-white/5 w-full -mt-px">
         <div className="max-w-[1600px] mx-auto px-4 md:px-10 py-3">
           <div className="flex items-center gap-1.5 md:gap-3 overflow-x-auto no-scrollbar scroll-smooth">
              {(['All', 'Free', 'Paid'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`relative px-6 py-2.5 rounded-2xl text-[11px] font-black transition-all flex-shrink-0 group overflow-hidden ${
                    activeTab === tab 
                      ? 'text-white' 
                      : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                  }`}
                >
                  {activeTab === tab && (
                    <motion.div 
                      layoutId="tab-pill" 
                      className="absolute inset-0 bg-primary rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.3)]" 
                    />
                  )}
                  <span className="relative z-10 uppercase tracking-[0.15em]">{tab}</span>
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 text-white/20 md:flex hidden pr-2">
                 <Filter className="w-3.5 h-3.5" />
                 <span className="text-[9px] font-black uppercase tracking-[0.2em]">Filter List</span>
              </div>
           </div>
         </div>
      </div>

      <div className="w-full max-w-[1600px] mx-auto overflow-x-hidden px-4 md:px-10 py-6 md:py-10 space-y-10 md:space-y-16">
        {/* Continue Watching */}
        <AnimatePresence>
          {historyCourses.length > 0 && !searchParams.q && activeTab === 'All' && (
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4 md:space-y-6 w-full max-w-full min-w-0"
            >
                {/* Header */}
                <div className="flex items-center justify-between w-full px-1">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-primary/20 to-accent/10 rounded-2xl border border-white/10 flex items-center justify-center shadow-inner">
                      <Clock className="w-6 h-6 md:w-7 md:h-7 text-primary animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-3xl font-black text-white tracking-tighter uppercase leading-none">Pick Up Where You Left</h2>
                      <p className="text-[10px] md:text-[11px] font-black text-primary/60 uppercase tracking-[0.25em] mt-1">Continue your learning journey</p>
                    </div>
                  </div>
                </div>

                {/* Scrollable cards container */}
                <div className="w-full min-w-0 relative -mx-4 md:-mx-10">
                  {/* Fade Edges for premium feel */}
                  <div className="absolute top-0 right-0 bottom-0 w-8 md:w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
                  
                  <div
                    ref={scrollRef}
                    onScroll={updateScrollbar}
                    className="flex gap-4 md:gap-6 overflow-x-auto pb-4 w-full snap-x snap-mandatory px-4 md:px-10"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                  >
                    {historyCourses.map((course) => (
                      <div key={course.id} className="relative group min-w-[260px] md:min-w-[320px] max-w-[260px] md:max-w-[320px] flex-shrink-0 snap-center">
                        <CourseCard course={course} />
                        <div className="absolute top-4 right-4 z-50">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#121212] border-white/10 text-white rounded-xl">
                              <DropdownMenuItem 
                                onClick={() => handleRemoveHistory(course.id)}
                                className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer px-4 py-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="text-xs font-black uppercase tracking-widest">Remove from History</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Custom draggable scrollbar — only shows when content overflows */}
                  {scrollThumbWidth < 99 && (
                    <div className="px-4 md:px-10 mt-1">
                      <div
                        className="w-full h-[5px] rounded-full relative cursor-pointer"
                        style={{ background: 'rgba(255,255,255,0.07)' }}
                        onClick={(e) => {
                          const el = scrollRef.current;
                          if (!el) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const ratio = (e.clientX - rect.left) / rect.width;
                          el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);
                        }}
                      >
                        <div
                          className="absolute top-0 h-full rounded-full cursor-grab active:cursor-grabbing"
                          style={{
                            width: `${scrollThumbWidth}%`,
                            left: `${scrollThumbLeft}%`,
                            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                          }}
                          onMouseDown={onThumbMouseDown}
                          onTouchStart={onThumbMouseDown}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <section className="space-y-10 relative z-10">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-6 h-6 md:w-7 md:h-7 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-xl md:text-3xl font-black text-white tracking-tighter uppercase leading-none">Discover New Skills</h2>
                  <p className="text-[10px] md:text-[11px] font-black text-emerald-500/60 uppercase tracking-[0.25em] mt-1">Handpicked for your progress</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                 {dbUser?.preferences?.learning?.language && (
                   <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
                      <Globe className="w-3 h-3 text-primary" />
                      <span className="text-[9px] font-black uppercase text-primary tracking-widest">{dbUser.preferences.learning.language}</span>
                   </div>
                 )}
              </div>
            </div>

            {filteredCourses.length > 0 ? (
              <motion.div 
                layout
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10"
              >
                <AnimatePresence mode="popLayout">
                  {filteredCourses.map((course, index) => (
                    <motion.div
                      key={course.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ 
                        duration: 0.3, 
                        delay: Math.min(index * 0.05, 0.4),
                        ease: "easeOut"
                      }}
                    >
                      <CourseCard course={course} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-24 md:py-40 flex flex-col items-center justify-center text-center space-y-10 px-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse" />
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center backdrop-blur-2xl relative z-10">
                  <BookOpen className="w-10 h-10 md:w-14 md:h-14 text-white/20" />
                </div>
              </div>
              <div className="space-y-4 max-w-md">
                <h3 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">The library is empty</h3>
                <p className="text-white/40 font-bold uppercase tracking-widest text-[11px] md:text-xs leading-relaxed">
                   {searchParams.q 
                    ? `We couldn't find any courses matching "${searchParams.q}". Try broadening your search.` 
                    : "Become a pioneer on EduNook. Start sharing your knowledge with the world today!"}
                </p>
              </div>
              {dbUser?.username && (
                <button 
                  onClick={() => navigate({ to: '/$username', params: { username: dbUser.username } })}
                  className="group relative px-10 py-5 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-[0_20px_40px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 transition-all overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative z-10 flex items-center gap-3">
                    <Plus className="w-4 h-4" />
                    Start Creating
                  </span>
                </button>
              )}
            </motion.div>
            )}
           </section>

           {/* Mobile Create Floating Action Button (Optional) */}
           <AnimatePresence>
             {!loading && dbUser?.username && (
               <motion.button
                 initial={{ scale: 0, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 whileHover={{ scale: 1.1 }}
                 whileTap={{ scale: 0.9 }}
                 onClick={() => navigate({ to: '/$username', params: { username: dbUser.username } })}
                 className="md:hidden fixed bottom-24 right-6 w-14 h-14 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-center z-[45]"
                 aria-label="Create a new course"
               >
                 <Plus className="w-7 h-7" />
               </motion.button>
             )}
           </AnimatePresence>
        </div>
    </Layout>
  );
}
