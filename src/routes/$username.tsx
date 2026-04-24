import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { DbService, Profile, Course, Achievement, Highlight } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { CourseCard } from '@/components/CourseCard';
import { ProfileSkeleton } from '@/components/SkeletonLoader';
import { Camera, Package, Loader2, Edit2, X, Sparkles, Trophy, MessageCircle, UserPlus, UserCheck, Settings, Plus, Music, Wand2, Type, Sticker, ChevronRight, Video, Heart, Share2, User } from 'lucide-react';
import { SealCheck, Crown } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';
import { VerificationTick } from '@/components/VerificationTick';

export const Route = createFileRoute('/$username')({
  head: () => ({
    meta: [{ title: 'Profile — EduNook' }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

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

  const [isAddingHighlight, setIsAddingHighlight] = useState(false);
  const [highlightFile, setHighlightFile] = useState<File | null>(null);
  const [highlightPreviewUrl, setHighlightPreviewUrl] = useState<string | null>(null);
  const [highlightType, setHighlightType] = useState<'image' | 'video'>('image');
  const [highlightTitle, setHighlightTitle] = useState('');
  const [uploadingHighlight, setUploadingHighlight] = useState(false);
  const [highlightZoom, setHighlightZoom] = useState(1);
  const [highlightRatio, setHighlightRatio] = useState<'square' | 'portrait' | 'original'>('original');

  // Highlight Viewer State
  const [viewerHighlight, setViewerHighlight] = useState<Highlight | null>(null);
  const [viewerProgress, setViewerProgress] = useState(0);

  // Avatar Long-press State
  const [isPressingAvatar, setIsPressingAvatar] = useState(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startAvatarPress = () => {
    pressTimerRef.current = setTimeout(() => {
      setIsPressingAvatar(true);
    }, 400); 
  };

  const endAvatarPress = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    setIsPressingAvatar(false);
  };

  const handleHighlightSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHighlightFile(file);
      setHighlightPreviewUrl(URL.createObjectURL(file));
      setHighlightType(file.type.startsWith('video/') ? 'video' : 'image');
      setHighlightTitle('New Highlight');
      setIsAddingHighlight(true);
    }
    e.target.value = '';
  };

  const uploadHighlight = async () => {
    if (!user || !highlightFile) return;
    setUploadingHighlight(true);
    try {
      toast.loading(`Uploading ${highlightType}...`, { id: 'hl-upload' });
      const url = await DbService.uploadAvatar(user.id, highlightFile); 

      const newHighlight = {
         title: highlightTitle,
         coverImage: url,
         type: 'update' as const,
      };

      const id = await DbService.addHighlight(user.id, newHighlight);
      setHighlights(prev => [{ id, ...newHighlight }, ...prev]);
      
      setIsAddingHighlight(false);
      setHighlightFile(null);
      setHighlightPreviewUrl(null);
      toast.success("Highlight Added!", { id: 'hl-upload' });
    } catch (err) {
      console.error(err);
      toast.error("Failed to add highlight", { id: 'hl-upload' });
    } finally {
      setUploadingHighlight(false);
    }
  };

  const cancelHighlight = () => {
    setIsAddingHighlight(false);
    setHighlightFile(null);
    setHighlightPreviewUrl(null);
    setHighlightZoom(1);
    setHighlightRatio('original');
  };

  useEffect(() => {
    if (viewerHighlight) {
      setViewerProgress(0);
      const startTime = Date.now();
      const duration = 10000; 

      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        setViewerProgress(progress);
        
        if (elapsed >= duration) {
          setViewerHighlight(null);
          clearInterval(interval);
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [viewerHighlight]);

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
        let uid = await DbService.getUidByUsername(username);
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
        
        let [p, c, a, h] = await Promise.all([
          DbService.getProfile(uid).catch(() => null),
          DbService.getCourses({ userId: uid }).catch(() => []),
          DbService.getAchievements(uid).catch(() => []),
          DbService.getHighlights(uid).catch(() => []),
        ]);
        
        if (!p && user?.id === uid) {
           p = {
             uid: uid,
             email: user.email || '',
             fullName: user.displayName || user.email?.split('@')[0] || 'Unknown',
             username: username,
             role: 'student',
             createdAt: new Date().toISOString()
           };
           DbService.updateProfile(uid, p).catch(console.error);
        }

        setProfile(p);
        setCourses(c || []);
        setAchievements(a || []);
        setHighlights(h || []);
        if (p) {
          setEditName(p.fullName);
          setEditBio(p.bio || '');
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
      await DbService.updateProfile(user.id, { fullName: editName, bio: editBio });
      setProfile(prev => prev ? { ...prev, fullName: editName, bio: editBio } : null);
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
            <button onClick={() => navigate({ to: '/home' })} className="px-6 py-3 bg-primary text-white rounded-xl font-bold">Return Home</button>
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
          className="bg-background/40 backdrop-blur-3xl border-l border-border min-h-screen shadow-2xl relative w-full overflow-hidden"
        >
          
          {/* Background Ambient Glow */}
          <div className="absolute inset-0 pointer-events-none -z-10">
             <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
             <div className="absolute top-1/2 -left-24 w-64 h-64 bg-violet-600/10 rounded-full blur-[100px]" />
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
                      <div className="w-full h-full flex items-center justify-center bg-muted/20 pointer-events-none select-none">
                         <User className="w-16 h-16 text-primary/30" />
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
                 <div className="flex items-center justify-center gap-2">
                    <span className="text-[11px] font-black text-primary/80 uppercase tracking-[0.3em] bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10">
                       @{profile.username}
                    </span>
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
                   <button 
                     onClick={() => setIsEditing(true)}
                     className="w-full py-4.5 bg-foreground text-background hover:opacity-90 rounded-3xl text-[14px] font-black tracking-tight transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl"
                   >
                     <Edit2 className="w-4 h-4" /> Edit Profile
                   </button>
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
                      to="/chat"
                      search={{ chatWith: resolvedUid || '' }}
                      className="flex-1 py-4.5 bg-muted border border-border hover:bg-muted/80 rounded-3xl text-[13px] font-black text-foreground transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <MessageCircle className="w-4 h-4" /> Message
                    </Link>
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
                {achievements.length > 0 ? achievements.map(achievement => (
                  <motion.div 
                    key={achievement.id} 
                    whileHover={{ scale: 1.02, y: -2 }}
                    className="flex items-center gap-5 p-6 bg-card border border-border rounded-3xl flex-1 min-w-[280px] group transition-all hover:border-primary/50"
                  >
                     <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600/20 to-blue-600/20 text-violet-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Trophy className="w-7 h-7" />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[15px] font-black text-foreground">{achievement.title}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">
                           Earned — {new Date(achievement.earnedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        </span>
                     </div>
                  </motion.div>
                )) : (
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
                    onClick={() => setViewerHighlight(highlight)}
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
                     <label className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-muted/20 border-[3px] border-border border-dashed hover:border-primary hover:bg-primary/5 flex items-center justify-center text-muted-foreground/40 hover:text-primary transition-all group cursor-pointer shadow-xl">
                        <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-500" />
                        <input type="file" accept="image/*,video/*" className="hidden" onChange={handleHighlightSelect} disabled={uploadingHighlight} />
                     </label>
                      <span className="text-[11px] font-black text-primary uppercase tracking-widest">
                        Add Highlight
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
               <div className="flex items-center gap-3 mb-10">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                     <Package className="w-4 h-4" />
                  </div>
                  <h2 className="text-[13px] font-black uppercase tracking-[0.25em] text-foreground/50">Authored Courses</h2>
               </div>

              {courses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   {courses.map(course => (
                      <div key={course.id} className="relative group">
                        <CourseCard course={{...course, profiles: profile}} />
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
          {isAddingHighlight && highlightPreviewUrl && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-xl">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 50 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 50 }}
                  className="relative w-full h-full md:max-w-md md:h-[90vh] bg-card overflow-hidden md:rounded-[3rem] md:border md:border-border shadow-[0_0_100px_rgba(0,0,0,0.4)] flex flex-col"
                >
                   <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-card/80 to-transparent pt-12 md:pt-6">
                      <button onClick={cancelHighlight} disabled={uploadingHighlight} className="p-3 rounded-full bg-card/40 text-foreground backdrop-blur-xl hover:bg-foreground/10 transition-all">
                         <X className="w-6 h-6" />
                      </button>
                      
                      <div className="flex items-center gap-4 px-2">
                         <button className="p-2.5 rounded-full bg-card/40 text-foreground backdrop-blur-xl hover:scale-110 active:scale-95 transition-all outline-none">
                            <Type className="w-6 h-6" />
                         </button>
                         <button className="p-2.5 rounded-full bg-card/40 text-foreground backdrop-blur-xl hover:scale-110 active:scale-95 transition-all outline-none">
                            <Sticker className="w-6 h-6" />
                         </button>
                         <button className="p-2.5 rounded-full bg-card/40 text-foreground backdrop-blur-xl hover:scale-110 active:scale-95 transition-all outline-none">
                            <Wand2 className="w-6 h-6" />
                         </button>
                         <button className="p-2.5 rounded-full bg-card/40 text-foreground backdrop-blur-xl hover:scale-110 active:scale-95 transition-all outline-none">
                            <Music className="w-6 h-6" />
                         </button>
                      </div>
                   </div>

                    <div className="flex-1 w-full h-full relative bg-background flex items-center justify-center overflow-hidden">
                       <div className={`w-full h-full transition-all duration-300 flex items-center justify-center
                          ${highlightRatio === 'square' ? 'aspect-square' : highlightRatio === 'portrait' ? 'aspect-[9/16]' : 'h-full w-full'}`}>
                          <motion.div 
                            style={{ scale: highlightZoom }}
                            className="w-full h-full flex items-center justify-center"
                          >
                             {highlightType === 'video' ? (
                                <video src={highlightPreviewUrl} className="w-full h-full object-cover" autoPlay loop playsInline />
                             ) : (
                                <img src={highlightPreviewUrl} className="w-full h-full object-cover" alt="Previewing" />
                             )}
                          </motion.div>
                       </div>
                       
                       <div className="absolute inset-x-6 top-[20%] space-y-6">
                          <div className="flex flex-col gap-2 p-4 bg-card/40 backdrop-blur-xl rounded-2xl border border-border">
                             <div className="flex justify-between items-center text-[10px] font-black uppercase text-foreground/40 tracking-widest px-1">
                                <span>Zoom</span>
                                <span>{Math.round(highlightZoom * 100)}%</span>
                             </div>
                             <input 
                               type="range" 
                               min="1" 
                               max="3" 
                               step="0.01" 
                               value={highlightZoom}
                               onChange={(e) => setHighlightZoom(parseFloat(e.target.value))}
                               className="w-full accent-primary bg-foreground/10 h-1.5 rounded-full appearance-none cursor-pointer"
                             />
                          </div>

                          <div className="flex flex-col gap-3">
                             <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40 px-1">Aspect Ratio</span>
                             <div className="flex items-center gap-2">
                                {[
                                  {id: 'square', label: '1:1'},
                                  {id: 'portrait', label: '9:16'},
                                  {id: 'original', label: 'Fit'}
                                ].map(r => (
                                  <button
                                    key={r.id}
                                    onClick={() => setHighlightRatio(r.id as any)}
                                    className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all
                                      ${highlightRatio === r.id ? 'bg-foreground text-background' : 'bg-card/60 text-foreground border border-border'}`}
                                  >
                                    {r.label}
                                  </button>
                                ))}
                             </div>
                          </div>

                          <div className="flex flex-col gap-3">
                             <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40 px-1">Filters</span>
                             <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2">
                                {['Original', 'Noir', 'Vivid', 'Warm', 'Cold'].map(f => (
                                   <div key={f} className="flex flex-col items-center gap-1.5 shrink-0">
                                      <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center text-[8px] font-black uppercase tracking-tighter text-foreground/40 hover:border-primary/50 cursor-pointer transition-all">
                                         {f[0]}
                                      </div>
                                      <span className="text-[8px] font-black text-foreground/30 uppercase">{f}</span>
                                   </div>
                                ))}
                             </div>
                          </div>
                       </div>
                       
                       <div className="absolute inset-0 border-[1.5px] border-border m-4 rounded-[2.5rem] pointer-events-none" />
                    </div>

                    <div className="absolute bottom-0 inset-x-0 z-20 p-6 bg-gradient-to-t from-card/90 via-card/50 to-transparent pb-8 md:pb-6">
                       <div className="flex items-center justify-between gap-4">
                          <input 
                            type="text"
                            value={highlightTitle}
                            onChange={(e) => setHighlightTitle(e.target.value)}
                            className="flex-1 w-full bg-card/40 border border-border rounded-full px-5 py-3.5 text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-xl shadow-lg placeholder:text-foreground/50"
                            placeholder="Highlight Name..."
                            disabled={uploadingHighlight}
                            maxLength={15}
                          />
                         
                         <button 
                            onClick={uploadHighlight}
                            disabled={uploadingHighlight || !highlightTitle.trim()}
                            className="px-6 py-3.5 bg-foreground text-background rounded-full font-black text-[14px] flex shrink-0 items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50"
                         >
                            {uploadingHighlight ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Your Story'}
                            {!uploadingHighlight && <ChevronRight className="w-4 h-4 ml-1" />}
                         </button>
                      </div>
                   </div>
                </motion.div>
            </div>
          )}
        </AnimatePresence>

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
                 className="relative w-full max-w-md bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl z-10"
               >
                  <button 
                    onClick={() => setIsEditing(false)}
                    disabled={savingProfile}
                    className="absolute top-6 right-6 p-2 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
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

                     <div className="pt-6">
                        <button
                          onClick={saveProfileInfo}
                          disabled={savingProfile || !editName.trim()}
                          className="w-full py-4.5 bg-foreground text-background hover:opacity-90 rounded-3xl font-black text-[15px] shadow-2xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {savingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                        </button>
                      </div>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {viewerHighlight && (
            <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1.5 flex gap-1 p-2 z-30">
                  <div className="flex-1 bg-white/20 rounded-full h-full overflow-hidden">
                    <motion.div 
                      className="bg-white h-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${viewerProgress}%` }}
                      transition={{ ease: "linear" }}
                    />
                  </div>
                </div>

                <div className="absolute top-6 inset-x-0 flex items-center justify-between p-4 z-30 pt-10">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border-2 border-primary p-0.5">
                         <img src={optimizeCloudinaryUrl(profile.avatarUrl || '', 80)} className="w-full h-full rounded-full object-cover" alt="" />
                      </div>
                       <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                             <span className="text-white text-sm font-bold">{profile.fullName}</span>
                             <VerificationTick planId={profile.subscription?.planId} size={14} />
                          </div>
                          <span className="text-white/60 text-[10px] font-medium uppercase tracking-widest">{viewerHighlight.title}</span>
                       </div>
                   </div>
                   <button onClick={() => setViewerHighlight(null)} className="p-2 text-white/60 hover:text-white">
                      <X className="w-6 h-6" />
                   </button>
                </div>

                <div className="w-full h-full flex items-center justify-center">
                   <img src={optimizeCloudinaryUrl(viewerHighlight.coverImage || '', 1200)} className="w-full h-full object-contain" alt="" />
                </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
