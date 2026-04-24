import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { DbService, Profile, Course } from '@/lib/db-service';
import { Search as SearchIcon, User as UserIcon, ArrowRight, Sparkles, LayoutGrid, Users, Flame, Crown, Star, TrendingUp, Zap } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { CourseCard } from '@/components/CourseCard';
import { motion, AnimatePresence } from 'framer-motion';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';
import { VerificationTick } from '@/components/VerificationTick';

export const Route = createFileRoute('/search')({
  head: () => ({
    meta: [
      { title: 'Search & Explore — EduNook' },
    ],
  }),
  component: SearchPage,
});

type TrendingCourse = Course & { profiles: Profile | null; trendingScore: number; isNew: boolean };
type TopCreator = Profile & { followersCount: number };

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  // Explore data (shown when no search query)
  const [trendingCourses, setTrendingCourses] = useState<TrendingCourse[]>([]);
  const [topCreators, setTopCreators] = useState<TopCreator[]>([]);
  const [exploreLoading, setExploreLoading] = useState(true);

  // Load explore data on mount
  useEffect(() => {
    async function loadExplore() {
      try {
        const [courses, creators] = await Promise.all([
          DbService.getTrendingCourses(8),
          DbService.getTopCreators(6),
        ]);
        setTrendingCourses(courses);
        setTopCreators(creators);
      } catch (err) {
        console.error('Error loading explore:', err);
      } finally {
        setExploreLoading(false);
      }
    }
    loadExplore();
  }, []);

  // Search users
  useEffect(() => {
    async function executeSearch() {
      if (!query.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const profiles = await DbService.searchProfiles(query);
        setResults(profiles);
      } catch (err) {
        console.error('Error searching:', err);
      } finally {
        setLoading(false);
      }
    }
    executeSearch();
  }, [query]);

  const isSearching = query.trim().length > 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-16">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary">
               <Sparkles className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-[0.3em]">Search & Explore</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
               Discover <span className="premium-gradient-text">EduNook.</span>
            </h1>
          </div>
          {isSearching && (
            <div className="flex items-center gap-4 text-muted-foreground font-black text-xs uppercase tracking-widest bg-white/5 px-5 py-2.5 rounded-2xl border border-white/5">
               <Users className="w-4 h-4" />
               <span>{results.length} Users Found</span>
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative mb-12 group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-2xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative flex items-center bg-[#121212] border border-white/10 rounded-2xl px-6 py-4 shadow-2xl">
            <SearchIcon className="w-5 h-5 text-muted-foreground mr-3 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users by name or username..."
              className="flex-1 bg-transparent text-base font-bold placeholder:text-muted-foreground/30 focus:outline-none"
            />
            {isSearching && (
              <button 
                onClick={() => setQuery('')} 
                aria-label="Clear search"
                className="text-xs font-black text-primary uppercase tracking-widest hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {isSearching ? (
          /* ===== SEARCH RESULTS (Instagram Style List) ===== */
          <div className="flex flex-col">
            <AnimatePresence mode="popLayout">
              {loading ? (
                 [1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="w-full h-16 mb-2 rounded-2xl bg-white/5 shimmer opacity-20" />
                 ))
              ) : results.length > 0 ? (
                results.map((profile, i) => (
                  <motion.div
                    key={profile.uid}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: i * 0.02 }}
                    className="group"
                  >
                    <Link
                      to="/$username"
                      params={{ username: profile.username }}
                      aria-label={`View ${profile.fullName}'s profile`}
                      className="flex items-center gap-4 w-full p-4 hover:bg-white/[0.03] active:bg-white/[0.05] border-b border-white/[0.03] transition-all"
                    >
                      {/* Avatar Left */}
                      <div className="flex-shrink-0">
                        {profile.avatarUrl ? (
                          <img src={optimizeCloudinaryUrl(profile.avatarUrl, 100)} alt={profile.fullName}
                            loading="lazy"
                            className="w-12 h-12 rounded-full border border-white/10 object-cover group-hover:border-primary/50 transition-colors" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:border-primary/50 transition-colors">
                            <UserIcon className="w-5 h-5 text-primary" />
                          </div>
                        )}
                      </div>

                      {/* Identity Middle */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                           <h3 className="text-sm font-black text-white truncate">{profile.fullName}</h3>
                           <VerificationTick planId={profile.subscription?.planId} size={14} />
                           {profile.role === 'admin' && <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />}
                        </div>
                        <p className="text-xs font-bold text-muted-foreground truncate">@{profile.username}</p>
                      </div>

                      {/* Action Right (Optional but sleek) */}
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="p-2 bg-primary/10 rounded-lg">
                            <ArrowRight className="w-4 h-4 text-primary" />
                         </div>
                      </div>
                    </Link>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-24 flex flex-col items-center justify-center text-center space-y-6 opacity-30">
                  <LayoutGrid className="w-12 h-12 text-muted-foreground" />
                  <div className="space-y-2">
                     <h3 className="text-2xl font-black">No users found</h3>
                     <p className="text-sm text-muted-foreground">Try a different search term</p>
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* ===== EXPLORE CONTENT (when not searching) ===== */
          <div className="space-y-16">
            {/* Trending Courses */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-white">Trending Courses</h2>
                </div>
                <Link to="/explore" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                  See All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {exploreLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {[1, 2, 3, 4].map(i => <div key={i} className="aspect-video rounded-2xl bg-white/5 shimmer opacity-20" />)}
                </div>
              ) : trendingCourses.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                  {trendingCourses.map((course, idx) => (
                    <div key={course.id} className="relative">
                      {idx < 3 && (
                        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 px-2 py-1 bg-orange-500/20 backdrop-blur-md border border-orange-500/30 rounded-lg">
                          <Flame className="w-3 h-3 text-orange-400" />
                          <span className="text-[9px] font-black text-orange-300 uppercase">Trending</span>
                        </div>
                      )}
                      {course.isNew && idx >= 3 && (
                        <div className="absolute top-3 left-3 z-20 flex items-center gap-1 px-2 py-1 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 rounded-lg">
                          <Zap className="w-3 h-3 text-emerald-400" />
                          <span className="text-[9px] font-black text-emerald-300 uppercase">New</span>
                        </div>
                      )}
                      <CourseCard course={course} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center opacity-20">
                  <p className="text-xs font-black uppercase tracking-widest">No courses yet</p>
                </div>
              )}
            </section>

            {/* Top Creators */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-black uppercase tracking-widest text-white">Top Creators</h2>
                </div>
                <Link to="/explore" className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline flex items-center gap-1">
                  See All <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              {exploreLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-white/5 shimmer opacity-20" />)}
                </div>
              ) : topCreators.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {topCreators.map((creator, idx) => (
                    <Link
                      key={creator.uid}
                      to="/$username"
                      params={{ username: creator.username }}
                      aria-label={`View ${creator.fullName}'s profile`}
                      className="group block p-4 bg-[#0f0f0f] border border-white/5 rounded-2xl hover:border-primary/30 transition-all text-center relative"
                    >
                      {idx < 3 && (
                        <div className="absolute top-2 right-2">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                        </div>
                      )}
                      <div className="w-14 h-14 rounded-full bg-white/5 overflow-hidden border border-white/10 mx-auto mb-3 group-hover:border-primary/50 group-hover:scale-105 transition-all">
                        {creator.avatarUrl ? (
                          <img src={optimizeCloudinaryUrl(creator.avatarUrl, 120)} className="w-full h-full object-cover" alt={creator.fullName} loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10">
                            <UserIcon className="w-6 h-6 text-primary" />
                          </div>
                        )}
                      </div>
                      <h3 className="text-xs font-black text-white truncate group-hover:text-primary transition-colors flex items-center justify-center gap-1">
                        {creator.fullName}
                        <VerificationTick planId={creator.subscription?.planId} size={12} />
                      </h3>
                      <p className="text-[10px] text-muted-foreground font-bold mt-0.5">
                        <span className="text-white">{creator.followersCount}</span> followers
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center opacity-20">
                  <p className="text-xs font-black uppercase tracking-widest">No creators yet</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}
