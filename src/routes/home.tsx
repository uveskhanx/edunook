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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>(searchParams.tab || 'All');
  const [showMobileHistory, setShowMobileHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollThumbWidth, setScrollThumbWidth] = useState(0);
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
  }, [updateScrollbar, showMobileHistory]);

  // Security Check
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/login' });
    }
  }, [user, authLoading, navigate]);

  // If user is logged in but profile didn't load (stale session before scaffold fix),
  // immediately re-resolve and backfill, then reload courses
  useEffect(() => {
    if (user && !authLoading && !dbUser) {
      refreshProfile().then(() => {
        // Reload courses after profile+backfill completes so publisherName appears
        DbService.getCourses({ isPublished: true }).then(data => setCourses(data)).catch(() => {});
      });
    }
  }, [user, authLoading, dbUser, refreshProfile]);

  // Load Data
  useEffect(() => {
    if (user) {
      async function loadData() {
        try {
          setLoading(true);
          await DbService.ensureUsernameMapLoaded();
          const [courseData, historyData] = await Promise.all([
            DbService.getCourses({ isPublished: true }),
            DbService.getHistory(user!.id)
          ]);
          setCourses(courseData);
          setHistory(historyData);

          const historyCourseIds = Object.keys(historyData || {});
          const enrollments: Record<string, boolean> = {};
          await Promise.all(
            historyCourseIds.map(async (cId) => {
               const c = courseData.find(course => course.id === cId);
               if (c) {
                  if (c.userId === user!.id || c.price === 0) {
                     enrollments[cId] = true;
                  } else {
                     try {
                       enrollments[cId] = await DbService.isEnrolled(cId, user!.id);
                     } catch (e) {
                       console.error('Enrollment check failed for', cId, e);
                       enrollments[cId] = false;
                     }
                  }
               }
            })
          );

          setEnrollmentMap(enrollments);
        } catch (err) {
          console.error('Error loading home data:', err);
        } finally {
          setLoading(false);
        }
      }
      loadData();
    }
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
        <div className="max-w-[1600px] mx-auto px-4 md:px-10 py-8">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
             {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <CourseCardSkeleton key={i} />)}
           </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto">
        
        {/* Filter Tabs - Sticky below Header */}
        <div className="sticky top-[72px] z-40 bg-background/90 backdrop-blur-xl px-4 md:px-10 py-4 border-b border-border">
           <div className="flex items-center justify-center md:justify-start gap-1 md:gap-3 pb-1">
              {(['All', 'Free', 'Paid'] as TabType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`relative px-6 py-2.5 rounded-xl text-sm font-black transition-all flex-shrink-0 ${
                    activeTab === tab 
                      ? 'text-foreground' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/5'
                  }`}
                >
                  {activeTab === tab && (
                    <motion.div 
                      layoutId="tab-pill" 
                      className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-xl" 
                    />
                  )}
                  {activeTab === tab && (
                    <motion.div 
                      layoutId="tab-line" 
                      className="absolute bottom-0 left-6 right-6 h-0.5 bg-primary rounded-full" 
                    />
                  )}
                  <span className="relative z-10 uppercase tracking-widest text-[11px]">{tab}</span>
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 text-muted-foreground opacity-40 md:flex hidden">
                 <Filter className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-widest">Filters</span>
              </div>
           </div>
        </div>

        <div className="px-4 md:px-10 py-8 space-y-16 w-full max-w-full overflow-x-hidden">
          {/* Continue Watching */}
          <AnimatePresence>
            {historyCourses.length > 0 && !searchParams.q && (
              <motion.section 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4 md:space-y-6 w-full max-w-full min-w-0"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 md:p-3 bg-primary/10 rounded-2xl border border-primary/20">
                      <Clock className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase">Continue Watching</h2>
                      <p className="hidden md:block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">Pick up where you left off</p>
                    </div>
                  </div>
                  <button 
                    className="md:hidden px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-colors"
                    onClick={() => setShowMobileHistory(!showMobileHistory)}
                  >
                    {showMobileHistory ? 'Hide' : 'View All'}
                  </button>
                </div>

                {/* Scrollable cards container */}
                <div className={`w-full min-w-0 ${!showMobileHistory ? 'hidden md:block' : 'block'}`}>
                  <div
                    ref={scrollRef}
                    onScroll={updateScrollbar}
                    className="flex gap-4 md:gap-6 overflow-x-auto pb-4 w-full snap-x snap-mandatory"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
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
                    <div
                      className="w-full h-[5px] rounded-full relative cursor-pointer mt-1"
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
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Main Feed */}
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                  <TrendingUp className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight uppercase">Explore All</h2>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">Discover your next masterpiece</p>
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
                <AnimatePresence>
                  {filteredCourses.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-32 flex flex-col items-center justify-center text-center space-y-8"
            >
              <div className="w-24 h-24 rounded-full bg-muted/20 flex items-center justify-center border border-border">
                <Search className="w-10 h-10 text-muted-foreground opacity-20" />
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-black text-foreground uppercase tracking-tighter">No courses found</h3>
                <p className="text-muted-foreground font-medium max-w-xs mx-auto">
                   {searchParams.q 
                    ? `We couldn't find anything matching "${searchParams.q}". Try a different search.` 
                    : "No courses have been published yet. Be the first to share your knowledge!"}
                </p>
              </div>
              {/* Note: Update the Create Link to not rely on old create page. Wait, no create user page for now... 
                  Ah, the user has a /create page? No, we will make it /$uid/create soon! */}
              <button 
                onClick={() => alert("Creating a course will be available from your profile.")}
                className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-[1.5rem] font-black shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
              >
                <Plus className="w-5 h-5" />
                Create Course
              </button>
            </motion.div>
            )}
          </section>
        </div>
      </div>
    </Layout>
  );
}
