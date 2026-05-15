'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DbService, Profile, Course, Achievement, Highlight, Story } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { CourseCard } from '@/components/CourseCard';
import { ProfileSkeleton } from '@/components/SkeletonLoader';
import { Camera, Package, Loader2, Edit2, X, Sparkles, Trophy, Medal, Award, MessageCircle, UserPlus, UserCheck, Settings, Plus, Music, Wand2, Type, Sticker, ChevronRight, Video, Heart, Share2, User, BarChart3 } from 'lucide-react';
import { SealCheck, Crown } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';
import { VerificationTick } from '@/components/VerificationTick';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ReportModal } from '@/components/ReportModal';
import { ShieldAlert, Info, MoreVertical, Grid2X2, Waves, Hash, Dot, Upload, CircuitBoard, Star } from 'lucide-react';
import { ALL_THEMES } from '@/lib/themes';
import { StoryViewer } from '@/components/Stories/StoryViewer';

const COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  cyan: '#06b6d4',
  fuchsia: '#d946ef',
  orange: '#f97316',
  slate: '#64748b',
  red: '#ef4444',
  indigo: '#6366f1',
  teal: '#14b8a6',
  primary: '#3b82f6',
  black: '#000000',
  green: '#22c55e'
};

export default function ProfileClient({ username }: { username: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedUid, setResolvedUid] = useState<string | null>(null);
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [editTheme, setEditTheme] = useState<any>(null);
  const [showAllThemes, setShowAllThemes] = useState(false);
  const [communityThemes, setCommunityThemes] = useState<any[]>([]);
  const [uploadingTheme, setUploadingTheme] = useState(false);

  // Highlight Viewer State
  const [viewerHighlight, setViewerHighlight] = useState<Highlight | null>(null);
  const [viewerHighlightStories, setViewerHighlightStories] = useState<Story[]>([]);
  const [loadingHighlightId, setLoadingHighlightId] = useState<string | null>(null);

  // Avatar Long-press State
  const [isPressingAvatar, setIsPressingAvatar] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [isAccountInfoOpen, setIsAccountInfoOpen] = useState(false);

  const startAvatarPress = () => {
    pressTimerRef.current = setTimeout(() => {
      setIsPressingAvatar(true);
    }, 400); 
  };

  const endAvatarPress = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    setIsPressingAvatar(false);
  };

  const openHighlightViewer = async (highlight: Highlight) => {
    if (!resolvedUid) return;
    try {
      setLoadingHighlightId(highlight.id);
      const stories = await DbService.getHighlightStories(resolvedUid, highlight.id, highlight);
      if (stories.length === 0) {
        toast.error('No stories found in this highlight yet');
        return;
      }
      setViewerHighlightStories(stories);
      setViewerHighlight(highlight);
    } catch (err) {
      console.error('Failed to load highlight stories:', err);
      toast.error('Could not open highlight');
    } finally {
      setLoadingHighlightId(null);
    }
  };

  const isOwnProfile = user?.id === resolvedUid;

  // Followers System State
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    async function resolveAndLoad() {
      try {
        setLoading(true);
        const uid = await DbService.getUidByUsername(username);
        if (!uid) {
          setLoading(false);
          return;
        }
        setResolvedUid(uid);

        if (user?.id === uid) {
          try {
            await DbService.scaffoldPremiumProfileData(uid);
          } catch(e) {
            console.warn("Could not scaffold", e);
          }
        }
        
        const [profileResult, c, a, h, ct] = await Promise.all([
          DbService.getProfile(uid).catch(() => null),
          DbService.getCourses({ userId: uid }).catch(() => []),
          DbService.getAchievements(uid).catch(() => []),
          DbService.getHighlights(uid).catch(() => []),
          DbService.getCommunityThemes().catch(() => []),
        ]);
        let p = profileResult;
        
        if (!p && user?.id === uid) {
           p = {
             uid: uid,
             email: user.email || '',
             fullName: user.displayName || user.email?.split('@')[0] || 'Unknown',
             username: username,
             role: 'student',
             createdAt: new Date().toISOString()
           };
           // We do not save this fallback to the DB to prevent overwriting the real username with a UID from the URL
        }

        setProfile(p);
        setCourses(c || []);
        setAchievements(a || []);
        setHighlights(h || []);
        setCommunityThemes(ct || []);
        if (p) {
          setEditName(p.fullName);
          setEditBio(p.bio || '');
          setEditTheme(p.theme || ALL_THEMES[0]);
        }
      } catch (err) {
        console.error('Error loading profile data:', err);
      } finally {
        setLoading(false);
      }
    }
    resolveAndLoad();
  }, [username, user?.id]);

  useEffect(() => {
    if (!resolvedUid) return;
    const unsub1 = DbService.subscribeToFollowerCount(resolvedUid, setFollowersCount);
    const unsub2 = DbService.subscribeToFollowingCount(resolvedUid, setFollowingCount);
    return () => { unsub1(); unsub2(); };
  }, [resolvedUid]);

  useEffect(() => {
    async function checkFollow() {
      if (user && resolvedUid && !isOwnProfile) {
        const result = await DbService.isFollowing(user.id, resolvedUid);
        setIsFollowing(result);
      }
    }
    checkFollow();
  }, [user, resolvedUid, isOwnProfile]);

  const handleFollow = async () => {
    if (!user || !resolvedUid || followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await DbService.unfollowUser(user.id, resolvedUid);
        setIsFollowing(false);
      } else {
        await DbService.followUser(user.id, resolvedUid);
        setIsFollowing(true);
      }
    } catch (err) {
      console.error('Follow error:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwnProfile) return;
    const file = e.target.files?.[0];
    if (file && user) {
      setUploadingAvatar(true);
      try {
        const url = await DbService.uploadAvatar(user.id, file);
        await DbService.updateProfile(user.id, { avatarUrl: url });
        setProfile(prev => prev ? { ...prev, avatarUrl: url } : null);
        toast.success("Profile photo updated");
      } catch (err) {
        console.error('Error uploading avatar:', err);
        toast.error("Could not upload photo");
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const saveProfileInfo = async () => {
    if (!user || !isOwnProfile) return;
    setSavingProfile(true);
    try {
      await DbService.updateProfile(user.id, { fullName: editName, bio: editBio, theme: editTheme });
      setProfile(prev => prev ? { ...prev, fullName: editName, bio: editBio, theme: editTheme } : null);
      toast.success("Profile updated");
      setIsEditing(false);
    } catch (err) {
      toast.error("Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="max-w-[1200px] mx-auto px-6 py-12 md:py-24">
          <ProfileSkeleton />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="max-w-[1200px] mx-auto px-6 py-24 text-center space-y-6">
            <h1 className="text-3xl font-black text-foreground">User not found</h1>
            <p className="text-muted-foreground mt-4">The profile (@{username}) you are looking for does not exist.</p>
            <button onClick={() => router.push('/home')} className="px-6 py-3 bg-primary text-white rounded-xl font-bold">Return Home</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showSettings={isOwnProfile}>
      <div className="w-full flex-1 overflow-visible">
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="min-h-screen relative w-full overflow-hidden transition-all duration-1000 bg-background/40 backdrop-blur-3xl"
        >
          {/* Theme Background Layer */}
          {profile.theme && (
            <div 
              className={`absolute inset-x-0 top-0 -z-20 transition-all duration-1000 ${profile.theme.type === 'image' ? 'h-[500px] opacity-100' : 'inset-0 opacity-40'}`}
              style={{
                background: profile.theme.type === 'image' 
                  ? `url(${profile.theme.imageUrl}) center/cover no-repeat`
                  : profile.theme.type === 'gradient' 
                    ? `linear-gradient(to bottom right, ${profile.theme.colors[0]}, black)`
                    : profile.theme.type === 'mesh'
                      ? `radial-gradient(circle at top right, ${profile.theme.colors[0]}, transparent), radial-gradient(circle at bottom left, ${profile.theme.colors[1] || '#a855f7'}, black)`
                      : 'transparent',
                maskImage: profile.theme.type === 'image' 
                  ? 'linear-gradient(to bottom, black 60%, transparent 100%)' 
                  : 'none',
                WebkitMaskImage: profile.theme.type === 'image' 
                  ? 'linear-gradient(to bottom, black 60%, transparent 100%)' 
                  : 'none'
              }}
            />
          )}

          {/* Pattern Layer */}
          {profile.theme?.pattern && profile.theme.pattern !== 'none' && (
            <div className="absolute inset-0 -z-10 opacity-20 pointer-events-none">
               {profile.theme.pattern === 'dots' && <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px', color: 'rgba(255,255,255,0.1)' }} />}
               {profile.theme.pattern === 'grid' && <div className="w-full h-full" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />}
               {profile.theme.pattern === 'noise' && <div className="w-full h-full opacity-30 brightness-50" style={{ backgroundImage: 'url(https://grainy-gradients.vercel.app/noise.svg)' }} />}
               {profile.theme.pattern === 'lines' && <div className="w-full h-full" style={{ backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 10px)' }} />}
               {profile.theme.pattern === 'circuit' && <div className="w-full h-full opacity-10" style={{ backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px, 20px 20px, 100px 100px, 100px 100px' }} />}
               {profile.theme.pattern === 'stars' && (
                  <div className="absolute inset-0">
                    <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-white rounded-full animate-pulse shadow-[0_0_10px_white]" />
                    <div className="absolute top-1/2 left-3/4 w-0.5 h-0.5 bg-white rounded-full animate-pulse delay-700" />
                    <div className="absolute top-3/4 left-1/2 w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-1000" />
                  </div>
               )}
            </div>
          )}
          
          {/* Background Ambient Glow */}
          <div className="absolute inset-0 pointer-events-none -z-10">
             {profile.theme?.id === 'aurora' ? (
                <>
                  <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-500/20 rounded-full blur-[160px] animate-pulse" />
                  <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px]" />
                </>
             ) : profile.theme?.id === 'sunset' ? (
                <>
                  <div className="absolute top-0 left-0 w-[800px] h-[800px] bg-orange-600/20 rounded-full blur-[160px]" />
                  <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-rose-600/10 rounded-full blur-[140px]" />
                </>
             ) : (
                <>
                  <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
                  <div className="absolute top-1/2 -left-24 w-64 h-64 bg-violet-600/10 rounded-full blur-[100px]" />
                </>
             )}
          </div>

          {/* 1. Header Profile Box */}
          <motion.section 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative flex flex-col items-center p-8 md:p-12 mb-2"
          >
             <div className="relative mx-auto mb-8 group">
                <div className="absolute -inset-2 bg-gradient-to-tr from-primary via-violet-500 to-blue-500 rounded-full opacity-20 group-hover:opacity-40 blur-xl transition-all duration-700 group-hover:rotate-180" />
                <div className="absolute -inset-0.5 bg-gradient-to-tr from-primary via-violet-500 to-blue-500 rounded-full opacity-30 group-hover:opacity-100 transition-all duration-700 group-hover:rotate-180" />
                
                <div 
                   onMouseDown={startAvatarPress}
                   onMouseUp={endAvatarPress}
                   onMouseLeave={endAvatarPress}
                   onTouchStart={startAvatarPress}
                   onTouchEnd={endAvatarPress}
                   className="relative w-32 h-32 md:w-44 md:h-44 rounded-full bg-background ring-[6px] ring-background overflow-hidden flex-shrink-0 z-10 shadow-2xl transition-transform duration-500 group-hover:scale-[1.02] cursor-pointer"
                 >
                    {profile.avatarUrl ? (
                      <img src={optimizeCloudinaryUrl(profile.avatarUrl, 400)} className="w-full h-full object-cover pointer-events-none select-none" alt="Avatar" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 via-transparent to-violet-600/30 pointer-events-none select-none">
                         <User className="w-16 h-16 md:w-20 md:h-20 text-primary/40 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
                      </div>
                    )}
                    {isOwnProfile && (
                      <label className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 opacity-0 hover:opacity-100 transition-opacity cursor-pointer z-20 backdrop-blur-sm">
                         {uploadingAvatar ? (
                            <Loader2 className="w-8 h-8 text-foreground animate-spin" />
                         ) : (
                            <Camera className="w-8 h-8 text-foreground mb-2" />
                         )}
                         <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Update Photo</span>
                         <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                      </label>
                    )}
                 </div>
             </div>
 
             <div className="text-center space-y-1 mb-8">
                 <div className="flex items-center justify-center gap-2">
                    <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight">{profile.fullName}</h1>
                    <VerificationTick planId={profile.subscription?.planId} size={32} />
                 </div>
                 <div className="flex flex-col items-center justify-center gap-3">
                    <span className="text-[11px] font-black text-primary/80 uppercase tracking-[0.3em] bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10">
                       @{profile.username}
                    </span>
                    {profile.subscription?.planId === 'edge' && (
                       <motion.div 
                         initial={{ opacity: 0, scale: 0.9 }}
                         animate={{ opacity: 1, scale: 1 }}
                         className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg"
                       >
                          <Crown size={12} weight="fill" className="text-amber-500" />
                          <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Edge Member</span>
                       </motion.div>
                    )}
                 </div>
             </div>

             <div className="flex items-center justify-center gap-4 sm:gap-12 text-foreground mb-10 w-full max-w-md px-4">
                 <div className="flex flex-col items-center group cursor-default">
                    <span className="text-3xl font-black tracking-tighter group-hover:scale-110 transition-transform">{courses.length}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-[0.25em] font-black opacity-60">Courses</span>
                 </div>
                 <div className="w-[1px] h-8 bg-border" />
                 <div className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-all group">
                    <span className="text-3xl font-black tracking-tighter group-hover:scale-110 transition-transform">{followersCount}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-[0.25em] font-black opacity-60">Followers</span>
                 </div>
                 <div className="w-[1px] h-8 bg-border" />
                 <div className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-all group">
                    <span className="text-3xl font-black tracking-tighter group-hover:scale-110 transition-transform">{followingCount}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-[0.25em] font-black opacity-60">Following</span>
                 </div>
             </div>

             <div className="relative px-8 pt-2 pb-10">
                <p className="text-[15px] font-medium text-foreground/80 max-w-sm text-center leading-relaxed whitespace-pre-wrap">
                   {profile.bio || (isOwnProfile ? `Join me on EduNook` : `Dedicated to crafting high-impact learning experiences.`)}
                </p>
             </div>

             <div className="w-full max-w-md flex flex-col sm:flex-row gap-4 px-6 md:px-0">
                {isOwnProfile ? (
                   <div className="w-full flex flex-col gap-3">
                     <button 
                       onClick={() => setIsEditing(true)}
                       className="w-full py-4.5 bg-foreground text-background hover:opacity-90 rounded-3xl text-[14px] font-black tracking-tight transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl"
                     >
                       <Edit2 className="w-4 h-4" /> Edit Profile
                     </button>
                     {courses.length > 0 && (
                       <Link 
                         href="/analytics"
                         className="w-full py-4.5 bg-primary text-white hover:bg-primary/90 rounded-3xl text-[14px] font-black tracking-tight transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl shadow-primary/20"
                       >
                         <BarChart3 className="w-4 h-4" /> Analytics Dashboard
                       </Link>
                     )}
                   </div>
                ) : (
                  <>
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={`flex-1 py-4.5 rounded-3xl text-[13px] font-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl
                        ${isFollowing 
                           ? 'bg-muted border border-border text-foreground hover:bg-destructive/10 hover:text-destructive'
                           : 'bg-primary text-white shadow-primary/20 hover:bg-primary/90'
                        }`}
                    >
                      {followLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFollowing ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
                    </button>
                    <Link 
                      href={`/chat?chatWith=${resolvedUid || ''}`}
                      className="flex-1 py-4.5 bg-muted border border-border hover:bg-muted/80 rounded-3xl text-[13px] font-black text-foreground transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <MessageCircle className="w-4 h-4" /> Message
                    </Link>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-4.5 bg-muted border border-border hover:bg-muted/80 rounded-3xl text-foreground transition-all flex items-center justify-center active:scale-95">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="bottom" sideOffset={12} className="w-56 bg-popover/90 border-border backdrop-blur-3xl rounded-2xl p-2 shadow-2xl z-[100]">
                        <DropdownMenuItem 
                          onClick={() => setIsAccountInfoOpen(true)}
                          className="cursor-pointer text-foreground font-medium focus:bg-foreground/10 focus:text-foreground rounded-xl py-3 px-4 flex items-center justify-between"
                        >
                          Account Intelligence
                          <Info className="w-4 h-4 opacity-70" />
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setIsReporting(true)}
                          className="cursor-pointer text-rose-500 font-bold focus:bg-rose-500/10 focus:text-rose-500 rounded-xl py-3 px-4 flex items-center justify-between"
                        >
                          Report Account
                          <ShieldAlert className="w-4 h-4 opacity-80" />
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
             </div>

             <div className="w-24 h-1 bg-gradient-to-r from-transparent via-border to-transparent mt-12 mb-4" />
          </motion.section>

          <div className="px-4 md:px-12 pb-24 space-y-20">
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative"
            >
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center border border-violet-500/20">
                       <Trophy className="w-4 h-4" />
                    </div>
                    <h2 className="text-[13px] font-black uppercase tracking-[0.25em] text-foreground/50">Achievements</h2>
                 </div>
              </div>
            
              <div className="flex flex-wrap items-center gap-4 w-full">
                {achievements.length > 0 ? achievements.map(achievement => {
                  const Icon = achievement.icon === 'trophy' ? Trophy :
                               achievement.icon === 'medal' ? Medal :
                               achievement.icon === 'award' ? Award : Trophy;
                               
                  return (
                  <motion.div 
                    key={achievement.id} 
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="flex items-center gap-5 p-6 bg-card border border-border rounded-3xl flex-1 min-w-[280px] group transition-all hover:border-primary/50"
                  >
                     <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 text-violet-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Icon className="w-7 h-7" />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[15px] font-black text-foreground">{achievement.title}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">
                           Earned — {new Date(achievement.earnedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </span>
                     </div>
                  </motion.div>
                )}) : (
                  <div className="w-full flex items-center justify-center py-6">
                     <p className="text-sm font-medium text-muted-foreground opacity-70">No achievements unlocked yet.</p>
                  </div>
                )}
              </div>
            </motion.section>

            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="relative"
            >
               <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                     <Sparkles className="w-4 h-4" />
                  </div>
                  <h2 className="text-[13px] font-black uppercase tracking-[0.25em] text-foreground/50">Highlights</h2>
               </div>

              <div className="flex items-center gap-6 overflow-x-auto no-scrollbar pb-4 -mx-2 px-2 w-full">
                {highlights.map(highlight => (
                  <motion.div 
                    key={highlight.id}
                    whileHover={{ scale: 1.05, y: -4 }}
                    onClick={() => openHighlightViewer(highlight)}
                    className="flex flex-col items-center gap-4 cursor-pointer shrink-0"
                  >
                     <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-muted/20 flex items-center justify-center border-[3px] border-border relative group p-1 transition-all hover:border-primary">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary to-violet-500 opacity-0 group-hover:opacity-20 blur-md transition-opacity" />
                        <div className="w-full h-full rounded-full overflow-hidden bg-background ring-4 ring-background shadow-2xl">
                           {highlight.coverImage ? (
                             <img src={optimizeCloudinaryUrl(highlight.coverImage, 200)} className="w-full h-full object-cover" alt={highlight.title} loading="lazy" />
                           ) : (
                             <Sparkles className="w-8 h-8 text-primary/20 m-auto mt-6 md:mt-8" />
                           )}
                        </div>
                        {loadingHighlightId === highlight.id && (
                          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                          </div>
                        )}
                     </div>
                     <span className="text-[11px] font-black text-muted-foreground uppercase tracking-widest text-center truncate w-24">
                        {highlight.title}
                     </span>
                  </motion.div>
                ))}

                {highlights.length === 0 && !isOwnProfile && (
                   <p className="text-sm font-medium text-muted-foreground opacity-70 ml-4 py-4">No highlights to show.</p>
                )}

                {isOwnProfile && (
                  <motion.div 
                    whileHover={{ scale: 1.05, y: -4 }}
                    className="flex flex-col items-center gap-4 shrink-0 transition-opacity"
                  >
                     <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-muted/20 border-[3px] border-border border-dashed hover:border-primary hover:bg-primary/5 flex items-center justify-center text-muted-foreground/40 hover:text-primary transition-all group shadow-xl">
                        <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
                     </div>
                      <span className="text-[11px] font-black text-primary uppercase tracking-widest">
                        From Story
                      </span>
                  </motion.div>
                )}
              </div>
            </motion.section>

            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="relative"
            >
               <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                       <Package className="w-4 h-4" />
                    </div>
                    <h2 className="text-[13px] font-black uppercase tracking-[0.25em] text-foreground/50">Authored Courses</h2>
                 </div>

                 {isOwnProfile && courses.length > 0 && (
                   <Link href="/analytics" className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-lg shadow-primary/5">
                     <BarChart3 className="w-4 h-4" />
                     Creator Analytics
                   </Link>
                 )}
               </div>

              {courses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {courses.map((course, index) => (
                      <div key={course.id} className="relative group">
                        <CourseCard 
                          course={{...course, profiles: profile}} 
                          showManagement={isOwnProfile}
                          priority={index < 4}
                        />
                      </div>
                   ))}
                </div>
              ) : (
                <div className="py-12 text-center bg-card rounded-[2rem] border border-border flex flex-col items-center justify-center">
                   <div className="w-12 h-12 rounded-full bg-muted/20 border border-border flex items-center justify-center text-muted-foreground mb-4">
                      <Package className="w-5 h-5 opacity-40" />
                   </div>
                   <h3 className="text-base font-black text-foreground">No courses</h3>
                   <p className="text-xs font-medium text-muted-foreground mt-1">
                     {isOwnProfile ? "Ready to create yours?" : "Nothing published yet."}
                   </p>
                </div>
              )}
            </motion.section>
          </div>
        </motion.div>

        <AnimatePresence>
          {isEditing && isOwnProfile && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
               <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 onClick={() => !savingProfile && setIsEditing(false)}
                 className="absolute inset-0 bg-black/80 backdrop-blur-sm"
               />
               <motion.div 
                 initial={{ opacity: 0, scale: 0.95, y: 20 }}
                 animate={{ opacity: 1, scale: 1, y: 0 }}
                 exit={{ opacity: 0, scale: 0.95, y: 20 }}
                 className="relative w-full max-w-xl mx-4 bg-card/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
               >
                  <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                    <button 
                      onClick={() => setIsEditing(false)}
                      disabled={savingProfile}
                      className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all z-10"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-3 mb-8">
                      <div className="p-2 bg-primary/20 text-primary rounded-xl">
                         <Sparkles className="w-5 h-5" />
                      </div>
                      <h2 className="text-2xl font-black text-foreground">Edit Profile</h2>
                    </div>

                    <div className="space-y-6">
                       <div className="space-y-2 group">
                          <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            placeholder="Your full name"
                            className="w-full px-5 py-4 bg-muted/20 border border-border rounded-2xl text-[14px] text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition-all placeholder:text-muted-foreground/40"
                          />
                       </div>

                       <div className="space-y-2 group">
                            <div className="flex items-center justify-between ml-1">
                               <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Bio</label>
                               <span className={`text-[10px] font-bold ${editBio.length >= 150 ? 'text-destructive' : 'text-muted-foreground/40'}`}>
                                  {editBio.length}/160
                               </span>
                            </div>
                            <textarea
                              value={editBio}
                              onChange={e => setEditBio(e.target.value)}
                              placeholder="Write something about yourself..."
                              rows={4}
                              maxLength={160}
                              className="w-full px-5 py-4 bg-muted/20 border border-border rounded-2xl text-[14px] text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition-all placeholder:text-muted-foreground/40 resize-none"
                            />
                         </div>

                        {profile.subscription?.planId === 'edge' && (
                          <div className="space-y-6 pt-4 border-t border-white/5">
                             <div className="flex items-center justify-between ml-1">
                                <div className="flex flex-col">
                                   <label className="text-[11px] font-black uppercase tracking-widest text-primary">Edge Elite Themes</label>
                                  <div className="flex items-center gap-2">
                                     <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-tighter">Selected theme is always at top</span>
                                     <span className="text-[8px] font-black text-amber-500/80 uppercase tracking-tighter bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">Best: 1920x600px</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                   <label className="cursor-pointer px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary/20 hover:border-primary/40 transition-all flex items-center gap-2">
                                      {uploadingTheme ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                      Upload Public Theme
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (file && user && profile) {
                                            setUploadingTheme(true);
                                            try {
                                              const url = await DbService.uploadCommunityTheme(user.id, profile.fullName, file);
                                              const newTheme = { id: `ct-${Date.now()}`, name: 'Community Style', type: 'image', imageUrl: url, colors: ['#ffffff'], pattern: 'none' };
                                              setCommunityThemes(prev => [newTheme, ...prev]);
                                              setEditTheme(newTheme);
                                              toast.success("Public Theme Shared!");
                                            } catch(err) {
                                              toast.error("Failed to upload theme");
                                            } finally {
                                              setUploadingTheme(false);
                                            }
                                          }
                                        }}
                                      />
                                   </label>
                                </div>
                             </div>

                             <div className="grid grid-cols-5 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar p-1">
                                {/* Current Theme First */}
                                {editTheme && (
                                   <button 
                                     key={`current-${editTheme.id}`}
                                     type="button"
                                     onClick={() => setEditTheme(editTheme)}
                                     className="aspect-square rounded-2xl border-2 border-primary ring-4 ring-primary/20 scale-105 relative group overflow-hidden"
                                   >
                                      <div 
                                        className="absolute inset-0"
                                        style={{
                                          background: editTheme.type === 'image' 
                                            ? `url(${editTheme.imageUrl}) center/cover no-repeat`
                                            : editTheme.type === 'gradient' 
                                              ? `linear-gradient(to bottom right, ${COLOR_MAP[editTheme.colors[0]] || editTheme.colors[0]}, black)`
                                              : `radial-gradient(circle at top right, ${COLOR_MAP[editTheme.colors[0]] || editTheme.colors[0]}, ${COLOR_MAP[editTheme.colors[1] || 'primary'] || editTheme.colors[1] || 'black'})`
                                        }}
                                      />
                                      <span className="absolute top-1 right-1 bg-primary text-white text-[6px] font-black px-1.5 py-0.5 rounded-full uppercase">Active</span>
                                   </button>
                                )}

                                {/* Community Themes */}
                                {communityThemes.map(t => (
                                   <button 
                                     key={t.id}
                                     type="button"
                                     onClick={() => setEditTheme(t)}
                                     className={`aspect-square rounded-2xl border transition-all relative group overflow-hidden ${editTheme?.id === t.id ? 'hidden' : 'border-white/5 hover:border-white/20'}`}
                                   >
                                      <div className="absolute inset-0" style={{ background: `url(${t.url}) center/cover no-repeat` }} />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                         <span className="text-[6px] font-black text-white uppercase px-2 text-center">By {t.creatorName}</span>
                                      </div>
                                   </button>
                                ))}

                                {/* Designer Themes */}
                                {ALL_THEMES.filter(t => t.id !== editTheme?.id).slice(0, showAllThemes ? undefined : 20).map(t => (
                                   <button 
                                     key={t.id}
                                     type="button"
                                     onClick={() => setEditTheme(t)}
                                     className={`aspect-square rounded-2xl border transition-all relative group overflow-hidden ${editTheme?.id === t.id ? 'hidden' : 'border-white/5 hover:border-white/20'}`}
                                   >
                                      <div 
                                        className="absolute inset-0"
                                        style={{
                                          background: t.type === 'gradient' 
                                            ? `linear-gradient(to bottom right, ${COLOR_MAP[t.colors[0]] || t.colors[0]}, black)`
                                            : `radial-gradient(circle at top right, ${COLOR_MAP[t.colors[0]] || t.colors[0]}, ${COLOR_MAP[t.colors[1] || 'primary'] || t.colors[1] || 'black'})`
                                        }}
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity">
                                         {t.pattern === 'dots' && <Dot className="w-4 h-4 text-white" />}
                                         {t.pattern === 'grid' && <Grid2X2 className="w-3 h-3 text-white" />}
                                         {t.pattern === 'waves' && <Waves className="w-3 h-3 text-white" />}
                                         {t.pattern === 'lines' && <Hash className="w-3 h-3 text-white" />}
                                         {t.pattern === 'circuit' && <CircuitBoard className="w-3 h-3 text-white" />}
                                         {t.pattern === 'stars' && <Star className="w-3 h-3 text-white" />}
                                      </div>
                                   </button>
                                ))}
                                
                                {!showAllThemes && (
                                  <button 
                                    type="button"
                                    onClick={() => setShowAllThemes(true)}
                                    className="aspect-square rounded-2xl border border-dashed border-white/20 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-all group"
                                  >
                                     <Plus className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                     <span className="text-[7px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary">Show All</span>
                                  </button>
                                )}
                             </div>
                          </div>
                        )}

                        <div className="pt-6 mt-6 border-t border-white/5 sticky bottom-0 bg-card/95 backdrop-blur-md pb-4">
                          <button
                            onClick={saveProfileInfo}
                            disabled={savingProfile || !editName.trim()}
                            className="w-full h-14 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {savingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                          </button>
                        </div>
                    </div>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {viewerHighlight && viewerHighlightStories.length > 0 && (
            <StoryViewer
              stories={viewerHighlightStories}
              user={profile}
              onClose={() => {
                setViewerHighlight(null);
                setViewerHighlightStories([]);
              }}
              onComplete={() => {
                setViewerHighlight(null);
                setViewerHighlightStories([]);
              }}
              disableViewTracking
              hideBottomBar
              headerSubLabel={viewerHighlight.title}
            />
          )}
        </AnimatePresence>

        <ReportModal 
          isOpen={isReporting}
          onClose={() => setIsReporting(false)}
          targetId={resolvedUid || ''}
          targetType="user"
          targetName={profile.fullName}
        />

        <AnimatePresence>
          {isAccountInfoOpen && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
               <motion.div 
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                 onClick={() => setIsAccountInfoOpen(false)}
                 className="absolute inset-0 bg-black/80 backdrop-blur-xl"
               />
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                 className="relative w-full max-w-md bg-card border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6 text-center"
               >
                  <div className="w-20 h-20 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto border border-primary/40">
                    <Info className="w-10 h-10 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Account Intelligence</h2>
                    <p className="text-muted-foreground text-sm font-medium">Detailed metadata for @{profile.username}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-left">
                     <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Joined Network</p>
                        <p className="text-sm font-bold text-white">May 2024</p>
                     </div>
                     <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-1">Security Status</p>
                        <p className="text-sm font-bold text-emerald-500">Verified</p>
                     </div>
                  </div>
                  <button 
                    onClick={() => setIsAccountInfoOpen(false)}
                    className="w-full py-4 bg-white/5 text-white/60 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    Close Terminal
                  </button>
               </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
