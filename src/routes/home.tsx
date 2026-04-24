import { createFileRoute, Link, useSearch, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from 'react';
import { DbService, Course, Profile } from '@/lib/db-service';
import { CourseCard } from '@/components/CourseCard';
import { Layout } from '@/components/Layout';
import { CourseCardSkeleton } from '@/components/SkeletonLoader';
import { Plus, Search, BookOpen, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>(searchParams.tab || 'All');

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
          const data = await DbService.getCourses({ isPublished: true });
          setCourses(data);
        } catch (err) {
          console.error('Error loading courses:', err);
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

    // 3. Boost Elite and Edge courses if NO search query
    if (!searchParams.q) {
      list.sort((a, b) => {
        const planA = a.profiles?.subscription?.planId || 'none';
        const planB = b.profiles?.subscription?.planId || 'none';
        
        const score = (plan: string) => {
          if (plan === 'elite') return 3;
          if (plan === 'edge') return 2;
          if (plan === 'spark') return 1;
          return 0;
        };

        const scoreDiff = score(planB) - score(planA);
        if (scoreDiff !== 0) return scoreDiff;
        
        // Secondary sort: most recent first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }

    // 4. Patch current user's own courses with their real name if publisherName is missing
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
           <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-1">
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

        <div className="px-4 md:px-10 py-8">
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
        </div>
      </div>
    </Layout>
  );
}
