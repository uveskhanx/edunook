'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { DbService, Course, Profile } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { CourseCard } from '@/components/CourseCard';
import { Layout } from '@/components/Layout';
import { CourseCardSkeleton } from '@/components/SkeletonLoader';
import { 
  Search, Flame, Users, User as UserIcon,
  Sparkles, Crown, Globe,
  Code, Palette, Briefcase, Music, Camera, LayoutGrid, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';
import { VerificationTick } from '@/components/VerificationTick';
import { StoriesBar } from '@/components/Stories/StoriesBar';

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

export default function ExploreClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  
  const queryQ = searchParams.get('q') || '';
  const rawTab = searchParams.get('tab');
  const queryTab = (rawTab === 'creators' || rawTab === 'community') ? 'community' : 'trending';
  const queryCategory = searchParams.get('category') || 'All';

  const [trendingCourses, setTrendingCourses] = useState<TrendingCourse[]>([]);
  const [allUsers, setAllUsers] = useState<(Profile & { followersCount: number; isFollowing?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState(queryQ);
  const [activeTab, setActiveTab] = useState<'trending' | 'community'>(queryTab);
  const [activeCategory, setActiveCategory] = useState(queryCategory);
  const [followLoadingMap, setFollowLoadingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const tab = searchParams.get('tab');
    setActiveTab(tab === 'creators' || tab === 'community' ? 'community' : 'trending');
    setActiveCategory(queryCategory);
    if(queryQ !== searchQuery) setSearchQuery(queryQ);
  }, [searchParams, queryCategory, queryQ]);

  useEffect(() => {
    async function loadExploreData() {
      setLoading(true);
      try {
        const [courses, users] = await Promise.all([
          DbService.getTrendingCourses(40),
          DbService.getAllUsersWithFollowStatus(user?.id),
        ]);
        
        setTrendingCourses(courses);
        setAllUsers(users);
      } catch (err) {
        console.error('Explore load failed:', err);
      } finally {
        setLoading(false);
      }
    }
    loadExploreData();
  }, [user?.id]);

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
        c.profiles?.username?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [trendingCourses, searchQuery, activeCategory]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allUsers;
    return allUsers.filter(u =>
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.bio?.toLowerCase().includes(q)
    );
  }, [allUsers, searchQuery]);

  const handleFollow = async (targetUid: string, isCurrentlyFollowing: boolean) => {
    if (!user || followLoadingMap[targetUid]) return;
    setFollowLoadingMap(prev => ({ ...prev, [targetUid]: true }));
    try {
      if (isCurrentlyFollowing) {
        await DbService.unfollowUser(user.id, targetUid);
      } else {
        await DbService.followUser(user.id, targetUid);
      }
      // Update local state for instant feedback
      setAllUsers(prev => prev.map(u => {
        if (u.uid === targetUid) {
          return {
            ...u,
            isFollowing: !isCurrentlyFollowing,
            followersCount: u.followersCount + (isCurrentlyFollowing ? -1 : 1)
          };
        }
        return u;
      }));
    } catch (err) {
      console.error('Follow toggle failed:', err);
    } finally {
      setFollowLoadingMap(prev => ({ ...prev, [targetUid]: false }));
    }
  };

  const handleTabChange = (tab: 'trending' | 'community') => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.push(`/explore?${params.toString()}`, { scroll: false });
  };

  const handleCategoryChange = (catId: string) => {
    setActiveCategory(catId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('category', catId);
    router.push(`/explore?${params.toString()}`, { scroll: false });
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    const params = new URLSearchParams(searchParams.toString());
    if (val) params.set('q', val);
    else params.delete('q');
    router.push(`/explore?${params.toString()}`, { scroll: false });
  }

  if (loading && trendingCourses.length === 0) {
    return (
      <Layout>
        <div className="w-full max-w-[1200px] mx-auto px-4 py-20 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-[1000px] mx-auto min-h-screen pb-32">
        {/* Search Header */}
        <div className="px-4 pt-10 pb-6 space-y-8">
           <div className="space-y-2">
              <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase">Explore</h1>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">Discover courses and the community</p>
           </div>

           <StoriesBar 
              currentUser={user ? allUsers.find(u => u.uid === user.id) || { uid: user.id, username: 'Loading...', fullName: 'User', role: 'student', createdAt: '' } : null} 
              allUsers={allUsers} 
           />

           <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full opacity-0 group-focus-within:opacity-100 transition-all duration-700" />
              <div className="relative flex items-center bg-card border border-border rounded-3xl px-6 py-5 focus-within:border-primary/50 transition-all shadow-2xl">
                <Search className="w-5 h-5 text-muted-foreground mr-4 group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  placeholder="Search community, courses, and more..."
                  className="flex-1 bg-transparent text-sm text-foreground font-bold placeholder:text-muted-foreground/30 focus:outline-none"
                />
                {searchQuery && (
                  <button onClick={() => handleSearchChange('')} className="p-2 hover:bg-white/5 rounded-full text-muted-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
           </div>

           <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {(['trending', 'community'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${
                    activeTab === tab 
                      ? 'bg-primary text-white shadow-xl shadow-primary/20' 
                      : 'bg-card border border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {tab}
                </button>
              ))}
           </div>
        </div>

        {/* Content Area */}
        <div className="px-4">
          <AnimatePresence mode="wait">
            {activeTab === 'trending' ? (
              <motion.div
                key="trending"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                {/* Categories */}
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryChange(cat.id)}
                      className={`px-5 py-2.5 rounded-full border text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-2.5 ${
                        activeCategory === cat.id 
                          ? 'bg-foreground text-background border-foreground shadow-lg' 
                          : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                      }`}
                    >
                      <cat.icon className="w-3.5 h-3.5" />
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {filteredCourses.map((course, index) => (
                    <CourseCard key={course.id} course={course} priority={index < 4} />
                  ))}
                </div>

                {filteredCourses.length === 0 && (
                  <div className="py-20 text-center opacity-40">
                    <p className="text-xs font-black uppercase tracking-widest">No matching courses</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="community"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {filteredUsers.map((u) => (
                  <div 
                    key={u.uid}
                    className="w-full bg-card/40 backdrop-blur-md border border-border rounded-[2rem] p-4 flex items-center justify-between group hover:border-primary/30 transition-all hover:bg-card/60"
                  >
                    <Link href={`/${u.username}`} className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="relative shrink-0">
                         <div className="w-14 h-14 rounded-2xl bg-muted/20 overflow-hidden border border-border group-hover:border-primary/40 transition-all">
                            {u.avatarUrl ? (
                              <img src={optimizeCloudinaryUrl(u.avatarUrl, 120)} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-primary/5">
                                <UserIcon className="w-6 h-6 text-primary/20" />
                              </div>
                            )}
                         </div>
                         <VerificationTick planId={u.subscription?.planId} size={16} className="absolute -top-1 -right-1" />
                      </div>
                      <div className="min-w-0">
                         <h3 className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">{u.fullName}</h3>
                         <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">@{u.username}</p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-6 pr-4">
                       <div className="hidden sm:block text-right">
                          <p className="text-xs font-black text-foreground">{u.followersCount.toLocaleString()}</p>
                          <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Followers</p>
                       </div>
                       
                       {user?.id !== u.uid && (
                         <button
                           onClick={(e) => {
                             e.preventDefault();
                             handleFollow(u.uid, !!u.isFollowing);
                           }}
                           disabled={followLoadingMap[u.uid]}
                           className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all min-w-[100px] flex items-center justify-center
                             ${u.isFollowing 
                               ? 'bg-muted border border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20' 
                               : 'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95'
                             }`}
                         >
                           {followLoadingMap[u.uid] ? (
                             <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                           ) : u.isFollowing ? 'Following' : 'Follow'}
                         </button>
                       )}
                    </div>
                  </div>
                ))}

                {filteredUsers.length === 0 && (
                  <div className="py-20 text-center opacity-40">
                    <p className="text-xs font-black uppercase tracking-widest">No matching users</p>
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

