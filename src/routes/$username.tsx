import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { DbService, Profile, Course, Achievement, Highlight } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { CourseCard } from '@/components/CourseCard';
import { ProfileSkeleton } from '@/components/SkeletonLoader';
import { Camera, Package, Loader2, Edit2, X, Sparkles, Trophy, MessageCircle, UserPlus, UserCheck, Settings, Plus, Music, Wand2, Type, Sticker, ChevronRight, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';

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

  // Highlight Upload State
  const [isAddingHighlight, setIsAddingHighlight] = useState(false);
  const [highlightFile, setHighlightFile] = useState<File | null>(null);
  const [highlightPreviewUrl, setHighlightPreviewUrl] = useState<string | null>(null);
  const [highlightType, setHighlightType] = useState<'image' | 'video'>('image');
  const [highlightTitle, setHighlightTitle] = useState('');
  const [uploadingHighlight, setUploadingHighlight] = useState(false);

  const handleHighlightSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHighlightFile(file);
      setHighlightPreviewUrl(URL.createObjectURL(file));
      setHighlightType(file.type.startsWith('video/') ? 'video' : 'image');
      setHighlightTitle('New Highlight');
      setIsAddingHighlight(true);
    }
    // reset input
    e.target.value = '';
  };

  const uploadHighlight = async () => {
    if (!user || !highlightFile) return;
    setUploadingHighlight(true);
    try {
      toast.loading(`Uploading ${highlightType}...`, { id: 'hl-upload' });
      // Uses the storage bucket generically
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
  };

  const nameInputRef = useRef<HTMLInputElement>(null);

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
        // 1. Resolve UID
        let uid = await DbService.getUidByUsername(username);
        
        // UID guessing fallback removed per requirement

        if (!uid) {
          setLoading(false);
          return;
        }

        setResolvedUid(uid);

        // 3. Load Data
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

  // Real-time follower/following counts
  useEffect(() => {
    if (!resolvedUid) return;
    const unsub1 = DbService.subscribeToFollowerCount(resolvedUid, setFollowersCount);
    const unsub2 = DbService.subscribeToFollowingCount(resolvedUid, setFollowingCount);
    return () => { unsub1(); unsub2(); };
  }, [resolvedUid]);

  // Check if current user is following this profile
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
            <h1 className="text-3xl font-black text-white">User not found</h1>
            <p className="text-muted-foreground mt-4">The profile (@{username}) you are looking for does not exist.</p>
            <button onClick={() => navigate({ to: '/home' })} className="px-6 py-3 bg-primary text-white rounded-xl font-bold">Return Home</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showSettings={isOwnProfile}>
      <div className="max-w-[800px] mx-auto px-4 md:px-8 py-10 mb-12 md:mb-0 w-full overflow-visible">
        
        {/* Main Wrapper matching the user's wireframe structure */}
        <div className="bg-[#121212]/80 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-4 md:p-8 shadow-2xl relative w-full">
          
          {/* Background Glow layer with hidden overflow so it doesn't break out, keeping container visible */}
          <div className="absolute inset-0 rounded-[3rem] overflow-hidden pointer-events-none -z-10">
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
          </div>

          {/* 2. All Information Box */}
          <section className="relative flex flex-col items-center bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-8 mb-6 shadow-xl">
             {/* Avatar Area */}
             <div className="relative mx-auto group mb-6">
                <div className="absolute -inset-1.5 bg-gradient-to-br from-primary via-accent to-violet-600 rounded-full opacity-30 group-hover:opacity-50 transition-opacity blur-md" />
                <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-[#050505] border-[4px] border-[#121212] overflow-hidden flex-shrink-0 z-10 transition-transform group-hover:scale-105">
                   {profile.avatarUrl ? (
                     <img src={optimizeCloudinaryUrl(profile.avatarUrl, 320)} className="w-full h-full object-cover" alt="Avatar" />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center bg-white/5">
                       <span className="text-5xl font-black text-primary/50">
                          {profile.fullName?.[0]?.toUpperCase()}
                       </span>
                     </div>
                   )}
                   {isOwnProfile && (
                     <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                        {uploadingAvatar ? (
                           <Loader2 className="w-8 h-8 text-white animate-spin" />
                        ) : (
                           <Camera className="w-8 h-8 text-white" />
                        )}
                        <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                     </label>
                   )}
                </div>
             </div>

             {/* User Meta */}
             <div className="text-center space-y-2 mb-6">
                 <h1 className="text-3xl font-black text-white">{profile.fullName}</h1>
                 <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-70">
                    @{profile.username}
                 </p>
             </div>

             {/* Stats */}
             <div className="flex items-center justify-center gap-8 text-white mb-6 w-full max-w-sm border-y border-white/5 py-4">
                 <div className="flex flex-col items-center">
                    <span className="text-xl font-black">{courses.length}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Courses</span>
                 </div>
                 <div className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
                    <span className="text-xl font-black">{followersCount}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Followers</span>
                 </div>
                 <div className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
                    <span className="text-xl font-black">{followingCount}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Following</span>
                 </div>
             </div>

             {/* Bio */}
             <p className="text-[14px] font-medium text-white/80 max-w-md text-center leading-relaxed whitespace-pre-wrap mb-8 px-4">
                {profile.bio || (isOwnProfile ? `Join me on EduNook` : `Dedicated to crafting high-impact learning experiences.`)}
             </p>

             {/* Private Intel (Own Profile Only) */}
             {isOwnProfile && (
               <div className="flex flex-col items-center gap-1.5 mb-8 p-5 bg-black/20 border border-white/5 rounded-2xl w-full max-w-sm text-center">
                  <p className="text-[10px] uppercase font-black tracking-widest text-primary opacity-80 mb-1">Private Info</p>
                  {profile.email && <p className="text-xs text-muted-foreground font-medium"><span className="text-white">Email:</span> {profile.email}</p>}
                  {profile.phone && <p className="text-xs text-muted-foreground font-medium"><span className="text-white">Phone:</span> {profile.phone}</p>}
               </div>
             )}

             {/* Edit / Follow Buttons at the Bottom of All Info */}
             <div className="w-full max-w-xs flex gap-3 justify-center mt-auto">
                {isOwnProfile ? (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="w-full py-4 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-[14px] font-black text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" /> Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={`flex-1 py-3.5 rounded-2xl text-[13px] font-black transition-all flex flex-col items-center justify-center gap-1 
                        ${isFollowing 
                           ? 'bg-white/5 border border-white/10 text-white hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'
                           : 'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                    >
                      {followLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFollowing ? <><UserCheck className="w-4 h-4" /> Following</> : <><UserPlus className="w-4 h-4" /> Follow</>}
                    </button>
                    <Link 
                      to="/chat"
                      search={{ chatWith: resolvedUid || '' }}
                      className="flex-1 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-[13px] font-black text-white transition-all flex flex-col items-center justify-center gap-1"
                    >
                      <MessageCircle className="w-4 h-4" /> Message
                    </Link>
                  </>
                )}
             </div>
          </section>

          {/* 3. Achievements Section */}
          <section className="mb-6 bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-6 lg:p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pl-2">
               <div className="p-2 bg-accent/20 text-accent rounded-xl">
                  <Trophy className="w-4 h-4" />
               </div>
               <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-white">Achievements</h2>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 w-full">
                {achievements.length > 0 ? achievements.map(achievement => (
                  <div key={achievement.id} className="flex items-center gap-3 px-5 py-4 bg-[#050505] border border-white/5 rounded-2xl flex-1 min-w-[200px]">
                     <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                        <Trophy className="w-5 h-5" />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-white whitespace-nowrap">{achievement.title}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black opacity-60">
                           {new Date(achievement.earnedAt).toLocaleDateString()}
                        </span>
                     </div>
                  </div>
                )) : (
                  <div className="w-full flex items-center justify-center py-6">
                     <p className="text-sm font-medium text-muted-foreground opacity-70">No achievements unlocked yet.</p>
                  </div>
                )}
            </div>
          </section>

          {/* 4. Highlights Section */}
          <section className="mb-6 bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-6 lg:p-8 shadow-xl">
             <div className="flex items-center gap-3 mb-6 pl-2">
                <div className="p-2 bg-primary/20 text-primary rounded-xl">
                   <Sparkles className="w-4 h-4" />
                </div>
                <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-white">Highlights</h2>
             </div>

             <div className="flex items-center gap-6 overflow-x-auto no-scrollbar pb-4 -mx-2 px-2 w-full">
                {/* Visual Group from Image: highlights on left, plus button on right */}
                
                {highlights.map(highlight => (
                  <motion.div 
                    key={highlight.id}
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="flex flex-col items-center gap-3 cursor-pointer shrink-0"
                  >
                     <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#050505] flex items-center justify-center border-[3px] border-white/10 relative group">
                        <div className="absolute inset-0 rounded-full border border-primary/50 scale-[1.05] opacity-0 group-hover:opacity-100 transition-all" />
                        <div className="w-full h-full rounded-full overflow-hidden bg-white/5">
                           {highlight.coverImage ? (
                             <img src={optimizeCloudinaryUrl(highlight.coverImage, 160)} className="w-full h-full object-cover" alt={highlight.title} loading="lazy" />
                           ) : (
                             <Sparkles className="w-6 h-6 text-white/20 m-auto mt-5 md:mt-7" />
                           )}
                        </div>
                     </div>
                     <span className="text-[11px] font-bold text-white max-w-[70px] text-center truncate">
                        {highlight.title}
                     </span>
                  </motion.div>
                ))}

                {highlights.length === 0 && !isOwnProfile && (
                   <p className="text-sm font-medium text-muted-foreground opacity-70 ml-4 py-4">No highlights to show.</p>
                )}

                {/* Adding margin-left auto pushes this rigidly to the right if there are items, creating the left-right separation */}
                {isOwnProfile && (
                  <motion.div 
                    whileHover={{ scale: 1.05 }}
                    className={`flex flex-col items-center gap-3 shrink-0 ${highlights.length > 0 ? 'ml-auto pl-6 border-l border-white/10' : ''}`}
                  >
                     <label className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/5 border-2 border-white/20 border-dashed hover:border-primary hover:bg-primary/10 flex items-center justify-center text-white/50 hover:text-primary transition-all group shadow-sm cursor-pointer">
                        <Plus className="w-6 h-6 group-hover:scale-125 transition-transform" />
                        <input type="file" accept="image/*,video/*" className="hidden" onChange={handleHighlightSelect} disabled={uploadingHighlight} />
                     </label>
                     <span className="text-[11px] font-bold text-muted-foreground w-max ">
                       <div className="flex w-16 text-center whitespace-normal justify-center overflow-visible mx-2">Add more highlight</div>
                     </span>
                  </motion.div>
                )}
             </div>
          </section>

          {/* 5. Courses Section */}
          <section className="bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-6 lg:p-8 shadow-xl">
             <div className="flex items-center gap-3 mb-6 pl-2">
                <div className="p-2 bg-violet-500/20 text-violet-400 rounded-xl">
                   <Package className="w-4 h-4" />
                </div>
                <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-white">Courses</h2>
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
               <div className="py-12 text-center bg-[#050505] rounded-[2rem] border border-white/5 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground mb-4">
                     <Package className="w-5 h-5 opacity-40" />
                  </div>
                  <h3 className="text-base font-black text-white">No courses</h3>
                  <p className="text-xs font-medium text-muted-foreground mt-1">
                    {isOwnProfile ? "Ready to create yours?" : "Nothing published yet."}
                  </p>
               </div>
             )}
          </section>

        </div>

        {/* Instagram Highlight Creator Modal (Preview Section) */}
        <AnimatePresence>
          {isAddingHighlight && highlightPreviewUrl && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-xl">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 50 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 50 }}
                  className="relative w-full h-full md:max-w-md md:h-[90vh] bg-[#050505] overflow-hidden md:rounded-[3rem] md:border md:border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col"
                >
                   {/* Top Header / Tools */}
                   <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent pt-12 md:pt-6">
                      <button onClick={cancelHighlight} disabled={uploadingHighlight} className="p-3 rounded-full bg-black/40 text-white backdrop-blur-xl hover:bg-white/20 transition-all">
                         <X className="w-6 h-6" />
                      </button>
                      
                      <div className="flex items-center gap-4 px-2">
                         <button className="p-2.5 rounded-full bg-black/40 text-white backdrop-blur-xl hover:scale-110 active:scale-95 transition-all outline-none">
                            <Type className="w-6 h-6" />
                         </button>
                         <button className="p-2.5 rounded-full bg-black/40 text-white backdrop-blur-xl hover:scale-110 active:scale-95 transition-all outline-none">
                            <Sticker className="w-6 h-6" />
                         </button>
                         <button className="p-2.5 rounded-full bg-black/40 text-white backdrop-blur-xl hover:scale-110 active:scale-95 transition-all outline-none">
                            <Wand2 className="w-6 h-6" />
                         </button>
                         <button className="p-2.5 rounded-full bg-black/40 text-white backdrop-blur-xl hover:scale-110 active:scale-95 transition-all outline-none">
                            <Music className="w-6 h-6" />
                         </button>
                      </div>
                   </div>

                   {/* Media Preview Area */}
                   <div className="flex-1 w-full h-full relative bg-zinc-900 flex items-center justify-center overflow-hidden">
                      {highlightType === 'video' ? (
                         <video src={highlightPreviewUrl} className="w-full h-full object-cover" autoPlay loop playsInline />
                      ) : (
                         <img src={highlightPreviewUrl} className="w-full h-full object-cover" alt="Previewing" />
                      )}
                      
                      {/* Fake Interactive Overlays to simulate UX */}
                      <div className="absolute inset-0 border-[1.5px] border-white/20 m-4 rounded-[2.5rem] pointer-events-none" />
                   </div>

                   {/* Bottom Footer / Publisher Action */}
                   <div className="absolute bottom-0 inset-x-0 z-20 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent pb-8 md:pb-6">
                      <div className="flex items-center justify-between gap-4">
                         <input 
                           type="text"
                           value={highlightTitle}
                           onChange={(e) => setHighlightTitle(e.target.value)}
                           className="flex-1 w-full bg-black/40 border border-white/10 rounded-full px-5 py-3.5 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 backdrop-blur-xl shadow-lg placeholder:text-white/50"
                           placeholder="Highlight Name..."
                           disabled={uploadingHighlight}
                           maxLength={15}
                         />
                         
                         <button 
                            onClick={uploadHighlight}
                            disabled={uploadingHighlight || !highlightTitle.trim()}
                            className="px-6 py-3.5 bg-white text-black rounded-full font-black text-[14px] flex shrink-0 items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50"
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

        {/* Edit Profile Modal */}
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
                 className="relative w-full max-w-md bg-[#121212] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl z-10"
               >
                  <button 
                    onClick={() => setIsEditing(false)}
                    disabled={savingProfile}
                    className="absolute top-6 right-6 p-2 rounded-full bg-white/5 text-muted-foreground hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-primary/20 text-primary rounded-xl">
                       <Sparkles className="w-5 h-5" />
                    </div>
                    <h2 className="text-2xl font-black text-white">Edit Profile</h2>
                  </div>

                  <div className="space-y-6">
                     <div className="space-y-2 group">
                        <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Name</label>
                        <input
                          ref={nameInputRef}
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          placeholder="Your full name"
                          className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-[14px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition-all placeholder:text-white/20"
                        />
                     </div>

                     <div className="space-y-2 group">
                        <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground ml-1">Bio</label>
                        <textarea
                          value={editBio}
                          onChange={e => setEditBio(e.target.value)}
                          placeholder="Write something about yourself..."
                          rows={4}
                          className="w-full px-5 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-[14px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent transition-all placeholder:text-white/20 resize-none"
                        />
                     </div>

                     <div className="pt-2">
                       <button
                         onClick={saveProfileInfo}
                         disabled={savingProfile || !editName.trim()}
                         className="w-full py-4 bg-gradient-to-r from-primary to-violet-600 text-white rounded-2xl font-black text-[15px] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                       >
                         {savingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                       </button>
                     </div>
                  </div>
               </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
