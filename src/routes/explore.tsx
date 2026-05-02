/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from 'react';
import { DbService, Course, Profile } from '@/lib/db-service';
import { CourseCard } from '@/components/CourseCard';
import { Layout } from '@/components/Layout';
import { CourseCardSkeleton } from '@/components/SkeletonLoader';
import { 
  Search, TrendingUp, Flame, Users, User as UserIcon, 
  Sparkles, Crown, Star, ArrowRight, Zap, Globe, 
  Code, Palette, Briefcase, Music, Camera, LayoutGrid, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';
import { VerificationTick } from '@/components/VerificationTick';
import { useAuth } from '@/hooks/use-auth';

export const Route = createFileRoute('/explore')({
  validateSearch: (search: Record<string, unknown>): { q?: string; tab?: string; category?: string } => {
    return {
      q: (search.q as string) || undefined,
      tab: (search.tab as string) || 'trending',
      category: (search.category as string) || 'All',
    };
  },
  head: () => ({
    meta: [{ title: 'Explore — EduNook' }],
  }),
  component: ExplorePage,
});

type TrendingCourse = Course & { profiles: Profile | null; trendingScore: number; isNew: boolean };
type TopCreator = Profile & { followersCount: number };

const CATEGORIES = [
  { id: 'All', label: 'All Topics', icon: LayoutGrid },
  { id: 'programming', label: 'Programming', icon: Code },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'photography', label: 'Photography', icon: Camera },
  { id: 'language', label: 'Languages', icon: Globe },
];

function ExplorePage() {
  const navigate = useNavigate();
  const searchParams = useSearch({ from: '/explore' });
  const { user } = useAuth();
  
  const [trendingCourses, setTrendingCourses] = useState<TrendingCourse[]>([]);
  const [topCreators, setTopCreators] = useState<TopCreator[]>([]);
  const [loading, setLoading] = useState(() => !localStorage.getItem('explore_cache_universal'));
  const [searchQuery, setSearchQuery] = useState(searchParams.q || '');
  const [activeTab, setActiveTab] = useState<'trending' | 'creators'>((searchParams.tab as any) || 'trending');
  const [activeCategory, setActiveCategory] = useState(searchParams.category || 'All');

  useEffect(() => {
    async function loadExploreData() {
      // 1. Instant Offline Recovery
      const cached = localStorage.getItem('explore_cache_universal');
      if (cached) {
        try {
          const { trending, creators } = JSON.parse(cached);
          setTrendingCourses(trending);
          setTopCreators(creators);
          setLoading(false);
        } catch (e) { console.error('Explore cache corrupt'); }
      }

      try {
        const [courses, creators] = await Promise.all([
          DbService.getTrendingCourses(40),
          DbService.getTopCreators(20),
        ]);
        
        setTrendingCourses(courses);
        setTopCreators(creators);
        
        // Persist for offline
        localStorage.setItem('explore_cache_universal', JSON.stringify({ 
          trending: courses, 
          creators: creators 
        }));
      } catch (err) {
        console.error('Network sync failed in Explore');
      } finally {
        setLoading(false);
      }
    }
    loadExploreData();
  }, []);

  // Filter Logic
  const filteredCourses = useMemo(() => {
    let list = [...trendingCourses];
    
    if (activeCategory !== 'All') {
      list = list.filter(c => c.category?.toLowerCase() === activeCategory.toLowerCase());
    }
    
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.profiles?.fullName?.toLowerCase().includes(q) ||
        c.profiles?.username?.toLowerCase().includes(q) ||
        (c as any).creatorName?.toLowerCase().includes(q) ||
        (c as any).publisherName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [trendingCourses, searchQuery, activeCategory]);

  const filteredCreators = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return topCreators;
    return topCreators.filter(c =>
      c.fullName.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q)
    );
  }, [topCreators, searchQuery]);

  const handleTabChange = (tab: 'trending' | 'creators') => {
    setActiveTab(tab);
    navigate({ search: { ...searchParams, tab } as any });
  };

  const handleCategoryChange = (catId: string) => {
    setActiveCategory(catId);
    navigate({ search: { ...searchParams, category: catId } as any });
  };

  if (loading && trendingCourses.length === 0) {
    return (
      <Layout>
        <div className="w-full max-w-[1600px] mx-auto px-4 md:px-10 py-10">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="h-10 w-64 bg-white/5 rounded-2xl animate-pulse" />
              <div className="h-4 w-96 bg-white/5 rounded-xl animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <CourseCardSkeleton key={i} />)}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-[1600px] mx-auto min-h-screen">
        {/* Dynamic Background */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[5%] right-[-10%] w-[60%] h-[50%] bg-primary/5 rounded-full blur-[140px] animate-pulse" />
          <div className="absolute bottom-[15%] left-[-5%] w-[45%] h-[40%] bg-accent/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10">
          {/* Header & Search Area */}
          <div className="px-4 md:px-10 pt-8 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 text-primary">
                  <div className="p-1.5 bg-primary/10 rounded-lg">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Marketplace</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-foreground tracking-tighter uppercase leading-none">
                  Discover Knowledge
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground font-medium max-w-md opacity-60">
                  Join 1M+ learners exploring industry-standard courses from world-class creators.
                </p>
              </div>

              {/* Enhanced Search Input */}
              <div className="w-full md:w-[400px] relative group">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full opacity-0 group-focus-within:opacity-100 transition-all duration-500" />
                <div className="relative flex items-center bg-card/50 backdrop-blur-xl border border-border rounded-2xl px-5 py-4 focus-within:border-primary/50 transition-all shadow-2xl">
                  <Search className="w-5 h-5 text-muted-foreground mr-3 group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Find courses, skills, or mentors..."
                    className="flex-1 bg-transparent text-sm text-foreground font-semibold placeholder:text-muted-foreground/30 focus:outline-none"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-white/5 rounded-full text-muted-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Navigation & Categories Bar */}
            <div className="space-y-8">
              {/* Main Tabs */}
              <div className="flex items-center gap-1.5 bg-card/30 p-1.5 rounded-2xl border border-border w-fit">
                {(['trending', 'creators'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`relative px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-3 overflow-hidden ${
                      activeTab === tab ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {activeTab === tab && (
                      <motion.div 
                        layoutId="explore-pill" 
                        className="absolute inset-0 bg-primary shadow-[0_8px_20px_rgba(var(--primary-rgb),0.3)]" 
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      {tab === 'trending' ? <Flame className="w-3.5 h-3.5" /> : <Crown className="w-3.5 h-3.5" />}
                      {tab}
                    </span>
                  </button>
                ))}
              </div>

              {/* Categories Scroll */}
              <AnimatePresence mode="wait">
                {activeTab === 'trending' && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2"
                  >
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategoryChange(cat.id)}
                        className={`px-5 py-2.5 rounded-full border text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2.5 ${
                          activeCategory === cat.id 
                            ? 'bg-foreground text-background border-foreground shadow-xl' 
                            : 'bg-card/50 text-muted-foreground border-border hover:border-primary/50'
                        }`}
                      >
                        <cat.icon className="w-3.5 h-3.5" />
                        {cat.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Content Area */}
          <div className="px-4 md:px-10 pb-20">
            <AnimatePresence mode="wait">
              {activeTab === 'trending' ? (
                <motion.div
                  key="trending-grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-12"
                >
                  {filteredCourses.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
                      {filteredCourses.map((course, idx) => (
                        <motion.div 
                          key={course.id} 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.05, 0.3) }}
                          className="relative"
                        >
                          {idx < 3 && !searchQuery && activeCategory === 'All' && (
                            <div className="absolute -top-3 -right-2 z-20 px-3 py-1 bg-primary text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-2xl animate-bounce">
                              Trending #0{idx + 1}
                            </div>
                          )}
                          <CourseCard course={course} />
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-32 flex flex-col items-center justify-center text-center space-y-6">
                      <div className="w-20 h-20 rounded-3xl bg-muted/20 flex items-center justify-center">
                        <Search className="w-10 h-10 text-muted-foreground opacity-20" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xl font-black text-foreground uppercase tracking-tight">Zero Results Found</h4>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest opacity-40">Try clearing your filters or search query</p>
                      </div>
                      <button 
                        onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
                        className="text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:underline"
                      >
                        Reset Everything
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="creators-grid"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {filteredCreators.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                      {filteredCreators.map((creator, idx) => (
                        <motion.div
                          key={creator.uid}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.04 }}
                        >
                          <Link
                            to="/$username"
                            params={{ username: creator.username }}
                            className="group block p-8 bg-card/40 backdrop-blur-md border border-border rounded-[2.5rem] hover:border-primary/50 hover:bg-card/60 transition-all duration-500 text-center relative overflow-hidden"
                          >
                            {/* Decorative Rank */}
                            {idx < 3 && (
                              <div className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                              </div>
                            )}

                            <div className="relative mx-auto mb-6">
                              <div className="w-24 h-24 md:w-28 md:h-28 rounded-[2rem] bg-muted/20 overflow-hidden border-2 border-border group-hover:border-primary/50 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-2xl">
                                {creator.avatarUrl ? (
                                  <img src={optimizeCloudinaryUrl(creator.avatarUrl, 200)} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-transparent">
                                    <UserIcon className="w-10 h-10 text-primary/30" />
                                  </div>
                                )}
                              </div>
                              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-white text-[8px] font-black rounded-full opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                PRO
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center justify-center gap-1.5">
                                <h3 className="text-[15px] font-black text-foreground truncate group-hover:text-primary transition-colors">
                                  {creator.fullName}
                                </h3>
                                <VerificationTick planId={creator.subscription?.planId} size={16} />
                              </div>
                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">
                                @{creator.username}
                              </p>
                            </div>

                            <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-center gap-4">
                              <div className="text-center">
                                <p className="text-[12px] font-black text-foreground">{creator.followersCount.toLocaleString()}</p>
                                <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Students</p>
                              </div>
                              <div className="w-px h-6 bg-white/5" />
                              <div className="text-center">
                                <p className="text-[12px] font-black text-foreground">4.9</p>
                                <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Rating</p>
                              </div>
                            </div>

                            <div className="absolute inset-x-0 bottom-0 py-3 bg-primary text-white text-[9px] font-black uppercase tracking-[0.2em] translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                              View Portfolio
                            </div>
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-32 text-center">
                      <Users className="w-12 h-12 text-muted-foreground mx-auto opacity-10 mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-40">No creators matching your search</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Layout>
  );
}
