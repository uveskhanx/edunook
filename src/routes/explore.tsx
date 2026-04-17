import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from 'react';
import { DbService, Course, Profile } from '@/lib/db-service';
import { CourseCard } from '@/components/CourseCard';
import { Layout } from '@/components/Layout';
import { CourseCardSkeleton } from '@/components/SkeletonLoader';
import { 
  Search, TrendingUp, Flame, Users, User as UserIcon, 
  Sparkles, Crown, Star, ArrowRight, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Route = createFileRoute('/explore')({
  head: () => ({
    meta: [{ title: 'Explore — EduNook' }],
  }),
  component: ExplorePage,
});

type TrendingCourse = Course & { profiles: Profile | null; trendingScore: number; isNew: boolean };
type TopCreator = Profile & { followersCount: number };

function ExplorePage() {
  const [trendingCourses, setTrendingCourses] = useState<TrendingCourse[]>([]);
  const [topCreators, setTopCreators] = useState<TopCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'trending' | 'creators'>('trending');

  useEffect(() => {
    async function loadExploreData() {
      try {
        const [courses, creators] = await Promise.all([
          DbService.getTrendingCourses(20),
          DbService.getTopCreators(12),
        ]);
        setTrendingCourses(courses);
        setTopCreators(creators);
      } catch (err) {
        console.error('Error loading explore data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadExploreData();
  }, []);

  // Filter by search
  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return trendingCourses;
    const q = searchQuery.toLowerCase();
    return trendingCourses.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.profiles?.fullName?.toLowerCase().includes(q) ||
      c.profiles?.username?.toLowerCase().includes(q) ||
      (c as any).creatorName?.toLowerCase().includes(q) ||
      (c as any).publisherName?.toLowerCase().includes(q)
    );
  }, [trendingCourses, searchQuery]);

  const filteredCreators = useMemo(() => {
    if (!searchQuery.trim()) return topCreators;
    const q = searchQuery.toLowerCase();
    return topCreators.filter(c =>
      c.fullName.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q)
    );
  }, [topCreators, searchQuery]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-[1600px] mx-auto px-4 md:px-10 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <CourseCardSkeleton key={i} />)}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-[1600px] mx-auto">

        {/* Hero Header */}
        <div className="relative px-4 md:px-10 pt-8 pb-6 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[120px] -z-10" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-[100px] -z-10" />
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">Discover</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                Explore EduNook
              </h1>
              <p className="text-sm text-muted-foreground font-medium max-w-md">
                Find trending courses and top creators. Learn from the best minds on the platform.
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative group mb-6">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <div className="relative flex items-center bg-[#121212] border border-white/10 rounded-2xl px-5 py-3.5">
              <Search className="w-5 h-5 text-muted-foreground mr-3 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search courses and creators..."
                className="flex-1 bg-transparent text-[14px] text-white font-medium placeholder:text-muted-foreground/30 focus:outline-none"
              />
            </div>
          </div>

          {/* Tab Pills */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('trending')}
              className={`relative px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'trending' ? 'text-white' : 'text-muted-foreground hover:text-white hover:bg-white/5'
              }`}
            >
              {activeTab === 'trending' && (
                <motion.div layoutId="explore-tab" className="absolute inset-0 bg-primary/15 border border-primary/20 rounded-xl" />
              )}
              <span className="relative flex items-center gap-2">
                <Flame className="w-3.5 h-3.5" /> Trending
              </span>
            </button>
            <button
              onClick={() => setActiveTab('creators')}
              className={`relative px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'creators' ? 'text-white' : 'text-muted-foreground hover:text-white hover:bg-white/5'
              }`}
            >
              {activeTab === 'creators' && (
                <motion.div layoutId="explore-tab" className="absolute inset-0 bg-primary/15 border border-primary/20 rounded-xl" />
              )}
              <span className="relative flex items-center gap-2">
                <Crown className="w-3.5 h-3.5" /> Top Creators
              </span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 md:px-10 py-6">
          <AnimatePresence mode="wait">
            {activeTab === 'trending' ? (
              <motion.div
                key="trending"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Section Label */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                      {filteredCourses.length} Trending Courses
                    </span>
                  </div>
                </div>

                {filteredCourses.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-x-6 md:gap-y-10">
                    {filteredCourses.map((course, idx) => (
                      <div key={course.id} className="relative">
                        {/* Badges */}
                        {idx < 3 && (
                          <div className="absolute top-3 left-3 z-20 flex items-center gap-1 px-2.5 py-1 bg-orange-500/20 backdrop-blur-md border border-orange-500/30 rounded-lg">
                            <Flame className="w-3 h-3 text-orange-400" />
                            <span className="text-[9px] font-black text-orange-300 uppercase">Trending</span>
                          </div>
                        )}
                        {course.isNew && idx >= 3 && (
                          <div className="absolute top-3 left-3 z-20 flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 rounded-lg">
                            <Zap className="w-3 h-3 text-emerald-400" />
                            <span className="text-[9px] font-black text-emerald-300 uppercase">New</span>
                          </div>
                        )}
                        <CourseCard course={course} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-24 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                    <Search className="w-12 h-12 text-muted-foreground" />
                    <p className="text-xs font-black uppercase tracking-widest">No courses found</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="creators"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {/* Section Label */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                      {filteredCreators.length} Top Creators
                    </span>
                  </div>
                </div>

                {filteredCreators.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
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
                          className="group block p-6 bg-[#0f0f0f] border border-white/5 rounded-2xl hover:border-primary/30 hover:bg-[#121212] transition-all duration-300 text-center relative overflow-hidden"
                        >
                          {/* Rank badge for top 3 */}
                          {idx < 3 && (
                            <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-amber-500/15 border border-amber-500/20 rounded-lg">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              <span className="text-[9px] font-black text-amber-300">#{idx + 1}</span>
                            </div>
                          )}

                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mt-16 group-hover:bg-primary/10 transition-colors" />

                          {/* Avatar */}
                          <div className="relative mx-auto mb-4">
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/5 overflow-hidden border-2 border-white/10 mx-auto group-hover:border-primary/50 transition-all group-hover:scale-105">
                              {creator.avatarUrl ? (
                                <img src={creator.avatarUrl} className="w-full h-full object-cover" alt={creator.fullName} />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-black text-xl">
                                  {creator.fullName?.[0]?.toUpperCase() || 'E'}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Info */}
                          <h3 className="text-sm font-black text-white truncate mb-1 group-hover:text-primary transition-colors">
                            {creator.fullName}
                          </h3>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 truncate">
                            @{creator.username}
                          </p>

                          {/* Followers */}
                          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            <span className="text-white font-black">{creator.followersCount}</span>
                            <span>followers</span>
                          </div>

                          {/* CTA */}
                          <div className="mt-4 flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            View Profile <ArrowRight className="w-3 h-3" />
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="py-24 flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                    <Users className="w-12 h-12 text-muted-foreground" />
                    <p className="text-xs font-black uppercase tracking-widest">No creators found</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
