'use client';
import Link from 'next/link';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { DbService, Profile } from '@/lib/db-service';
import { 
  Search as SearchIcon, 
  User as UserIcon, 
  Users, 
  Sparkles, 
  ArrowRight,
  Plus,
  Check
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';
import { VerificationTick } from '@/components/VerificationTick';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

type EnrichedProfile = Profile & { followersCount: number; isFollowing?: boolean };

export default function SearchClient() {
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [allUsers, setAllUsers] = useState<EnrichedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({});

  // Ranking logic: Edge > Spark > None, then by followers
  const getPlanWeight = (plan?: string) => {
    switch (plan) {
      case 'edge': return 3;
      case 'spark': return 2;
      default: return 1;
    }
  };

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Load ALL users from the database via DbService (no direct firebase imports)
  useEffect(() => {
    async function loadAllUsers() {
      try {
        setLoading(true);
        const users = await DbService.getAllUsersWithFollowStatus(currentUser?.id);

        // Sort: Edge > Spark > None, then by followers
        users.sort((a, b) => {
          const weightA = getPlanWeight(a.subscription?.planId);
          const weightB = getPlanWeight(b.subscription?.planId);
          if (weightA !== weightB) return weightB - weightA;
          return b.followersCount - a.followersCount;
        });

        setAllUsers(users);
      } catch (err) {
        console.error('Error loading community:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAllUsers();
  }, [currentUser]);

  const handleFollow = async (targetUid: string, isFollowing: boolean) => {
    if (!currentUser) {
      toast.error("Please log in to follow creators");
      return;
    }
    if (targetUid === currentUser.id) return;

    setFollowLoading(prev => ({ ...prev, [targetUid]: true }));
    try {
      if (isFollowing) {
        await DbService.unfollowUser(currentUser.id, targetUid);
        toast.success("Unfollowed");
      } else {
        await DbService.followUser(currentUser.id, targetUid);
        toast.success("Following");
      }
      
      // Update local state
      setAllUsers(prev => prev.map(c => 
        c.uid === targetUid 
          ? { ...c, isFollowing: !isFollowing, followersCount: c.followersCount + (isFollowing ? -1 : 1) } 
          : c
      ));
    } catch (err) {
      toast.error("Action failed. Try again.");
    } finally {
      setFollowLoading(prev => ({ ...prev, [targetUid]: false }));
    }
  };

  // Real-time filtering as user types
  const filteredUsers = useMemo(() => {
    if (!debouncedQuery.trim()) return allUsers;
    const lower = debouncedQuery.toLowerCase().trim();
    return allUsers.filter(c => 
      c.fullName?.toLowerCase().includes(lower) || 
      c.username?.toLowerCase().includes(lower) ||
      c.bio?.toLowerCase().includes(lower)
    );
  }, [allUsers, debouncedQuery]);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 md:px-10 py-8 md:py-16">
        {/* Header Section */}
        <div className="space-y-8 mb-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-primary">
               <Sparkles className="w-3.5 h-3.5" />
               <span className="text-[10px] font-black uppercase tracking-[0.4em]">Discovery</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.9]">
               Explore <span className="premium-gradient-text">Community.</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground font-medium max-w-xl opacity-60 leading-relaxed">
              Discover and follow the most influential educators and learners on EduNook.
            </p>
          </div>

          {/* User Search Input */}
          <div className="relative group max-w-2xl">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-2xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <div className="relative flex items-center bg-card/50 backdrop-blur-xl border border-white/5 rounded-2xl px-5 md:px-6 py-4 shadow-2xl">
              <SearchIcon className="w-5 h-5 text-muted-foreground mr-4 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, username, or bio..."
                className="flex-1 bg-transparent text-sm md:text-base font-bold placeholder:text-muted-foreground/20 focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-[10px] font-black text-primary uppercase tracking-widest hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors">Clear</button>
              )}
            </div>
          </div>

          {/* Stats bar */}
          {!loading && (
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
              <span>{filteredUsers.length} {debouncedQuery ? 'results' : 'members'}</span>
              {debouncedQuery && <span>for &quot;{debouncedQuery}&quot;</span>}
            </div>
          )}
        </div>

        {/* Unified Users List */}
        <div className="grid grid-cols-1 gap-1">
          <AnimatePresence mode="popLayout">
            {loading ? (
              [1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="w-full h-20 mb-2 rounded-[2rem] bg-white/5 shimmer opacity-20" />
              ))
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((creator, idx) => (
                <motion.div
                  key={creator.uid}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                  className="group"
                >
                  <div className="flex items-center gap-3 md:gap-5 w-full p-3.5 md:p-6 rounded-[2.5rem] hover:bg-white/[0.03] border-b border-white/[0.02] transition-all">
                    {/* User Info Link (Avatar + Name) */}
                    <Link
                      href={`/${creator.username}`}
                      className="flex items-center gap-3 md:gap-5 flex-1 min-w-0"
                    >
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl overflow-hidden border border-white/10 group-hover:border-primary/50 transition-all duration-500 shadow-inner">
                          {creator.avatarUrl ? (
                            <img src={optimizeCloudinaryUrl(creator.avatarUrl, 150)} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-primary/5 to-violet-500/20">
                              <UserIcon className="w-6 h-6 text-primary/40" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                           <h3 className="text-[14px] md:text-[17px] font-black text-white truncate group-hover:text-primary transition-colors">{creator.fullName}</h3>
                           <VerificationTick planId={creator.subscription?.planId} size={15} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                           <p className="text-[10px] md:text-[12px] font-bold text-muted-foreground/60 truncate">@{creator.username}</p>
                           <span className="w-1 h-1 rounded-full bg-white/10 shrink-0" />
                           <p className="text-[10px] md:text-[12px] font-bold text-primary uppercase tracking-tighter whitespace-nowrap">
                             {creator.followersCount.toLocaleString()} <span className="text-muted-foreground/30 font-medium">Followers</span>
                           </p>
                        </div>
                      </div>
                    </Link>

                    {/* Follow Action */}
                    {currentUser?.id !== creator.uid && (
                      <div className="shrink-0">
                        <button
                          onClick={() => handleFollow(creator.uid, !!creator.isFollowing)}
                          disabled={followLoading[creator.uid]}
                          className={`
                            h-10 md:h-12 px-4 md:px-8 rounded-2xl text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2
                            ${creator.isFollowing 
                              ? 'bg-white/5 text-muted-foreground border border-white/5 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20' 
                              : 'bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.03] active:scale-[0.97]'
                            }
                          `}
                        >
                          {followLoading[creator.uid] ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : creator.isFollowing ? (
                            <>
                              <Check className="w-4 h-4" />
                              <span className="hidden sm:inline">Following</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              <span>Follow</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    {/* View Profile Indicator (Hidden on Mobile) */}
                    <Link
                       href={`/${creator.username}`}
                       className="hidden md:flex p-3 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors ml-2"
                    >
                       <ArrowRight className="w-5 h-5" />
                    </Link>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-32 flex flex-col items-center justify-center text-center space-y-8 opacity-30">
                <div className="p-8 bg-white/5 rounded-[3rem] border border-white/5">
                  <Users className="w-16 h-16 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                   <h3 className="text-2xl font-black">No users found</h3>
                   <p className="text-sm text-muted-foreground">Try a different search term</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
