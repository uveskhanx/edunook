import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { DbService, Profile, Course, Achievement, Highlight } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { CourseCard } from '@/components/CourseCard';
import { ProfileSkeleton } from '@/components/SkeletonLoader';
import { Camera, Package, Loader2, Edit2, X, Sparkles, Trophy, MessageCircle, UserPlus, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

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
    <Layout>
      <div className="max-w-[1200px] mx-auto px-4 md:px-10 py-12">
        
        {/* Instagram Style Header Centered */}
        <section className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-6 pt-4 pb-16 relative">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -z-10" />

           {/* Avatar Area */}
           <div className="relative mx-auto mt-4 group">
              <div className="absolute -inset-1.5 bg-gradient-to-br from-primary via-accent to-violet-600 rounded-full opacity-40 group-hover:opacity-60 transition-opacity blur-md" />
              <div className="relative w-36 h-36 md:w-48 md:h-48 rounded-full bg-[#121212] border-[6px] border-[#050505] overflow-hidden shadow-2xl flex-shrink-0 z-10 transition-transform group-hover:scale-[1.02]">
                 {profile.avatarUrl ? (
                   <img src={profile.avatarUrl} className="w-full h-full object-cover" alt="Avatar" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center bg-white/5">
                     <span className="text-5xl md:text-6xl font-black text-primary/50">
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
              {/* Explicit Edit Icon Badge (only if own profile) */}
              {isOwnProfile && (
                <label className="absolute bottom-2 right-2 md:bottom-3 md:right-3 w-10 h-10 md:w-12 md:h-12 bg-white text-black rounded-full shadow-xl flex items-center justify-center z-20 cursor-pointer hover:scale-110 active:scale-95 transition-transform">
                    <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
                </label>
              )}
           </div>

           {/* User Meta */}
           <div className="space-y-4">
              <div className="space-y-1">
                 <h1 className="text-3xl md:text-4xl font-black text-white">{profile.fullName}</h1>
                 <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                    @{profile.username}
                 </p>
              </div>

               <div className="flex items-center justify-center gap-6 text-white pt-2">
                 <div className="flex flex-col items-center">
                    <span className="text-xl font-black">{courses.length}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Courses</span>
                 </div>
                 <div className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
                    <span className="text-xl font-black">{followersCount}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Followers</span>
                 </div>
                 <div className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
                    <span className="text-xl font-black">{followingCount}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Following</span>
                 </div>
              </div>

              {isOwnProfile && (
                <div className="flex flex-col items-center gap-1 mt-6 p-4 bg-white/[0.02] border border-white/5 rounded-2xl w-full max-w-sm mx-auto">
                   <p className="text-[10px] uppercase font-black tracking-widest text-primary opacity-80 mb-2">Private Intel</p>
                   {profile.email && <p className="text-xs text-muted-foreground font-medium"><span className="text-white">Email:</span> {profile.email}</p>}
                   {profile.phone && <p className="text-xs text-muted-foreground font-medium"><span className="text-white">Phone:</span> {profile.phone}</p>}
                   {profile.dob && <p className="text-xs text-muted-foreground font-medium"><span className="text-white">Birthday:</span> {profile.dob}</p>}
                   <p className="text-[10px] font-mono text-muted-foreground mt-2 opacity-50 select-all">UID: {profile.uid}</p>
                </div>
              )}

              <p className="text-sm font-medium text-white/80 max-w-md mx-auto leading-relaxed whitespace-pre-wrap px-4 py-4">
                {profile.bio || (isOwnProfile ? `Join me on EduNook` : `Dedicated to crafting high-impact learning experiences.`)}
              </p>

              <div className="flex items-center justify-center gap-3">
                {isOwnProfile ? (
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[13px] font-black text-white transition-all inline-flex items-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" /> Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={`px-6 py-2.5 rounded-xl text-[13px] font-black transition-all inline-flex items-center gap-2 ${
                        isFollowing 
                          ? 'bg-white/5 border border-white/10 text-white hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30'
                          : 'bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 active:scale-95'
                      }`}
                    >
                      {followLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isFollowing ? (
                        <><UserCheck className="w-4 h-4" /> Following</>
                      ) : (
                        <><UserPlus className="w-4 h-4" /> Follow</>
                      )}
                    </button>
                    <Link 
                      to="/chat"
                      search={{ chatWith: resolvedUid || '' }}
                      className="px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-[13px] font-black text-white transition-all inline-flex items-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" /> Message
                    </Link>
                  </>
                )}
              </div>
           </div>
        </section>

        {/* Highlights Section */}
        <section className="mb-12">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mb-6 ml-2 md:mx-auto md:max-w-max text-center flex items-center gap-2">
               <Sparkles className="w-3 h-3" /> Highlights
            </h2>
            <div className="flex items-center gap-6 overflow-x-auto no-scrollbar pb-6 px-2 w-full md:justify-center">
                {highlights.length > 0 ? highlights.map(highlight => (
                  <motion.div 
                    key={highlight.id}
                    whileHover={{ scale: 1.05, y: -2 }}
                    className="flex flex-col items-center gap-3 cursor-pointer shrink-0"
                  >
                     <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-[#121212] flex items-center justify-center border-2 border-white/5 p-1 relative group">
                        <div className="absolute inset-0 rounded-full border border-primary/30 scale-[1.05] opacity-0 group-hover:opacity-100 transition-all" />
                        <div className="w-full h-full rounded-full overflow-hidden bg-white/5">
                           {highlight.coverImage ? (
                             <img src={highlight.coverImage} className="w-full h-full object-cover" alt={highlight.title} />
                           ) : (
                             <Sparkles className="w-8 h-8 text-white/20 m-auto mt-6 md:mt-8" />
                           )}
                        </div>
                     </div>
                     <span className="text-[11px] font-bold text-white max-w-[80px] text-center truncate">
                        {highlight.title}
                     </span>
                  </motion.div>
                )) : (
                  <div className="w-full flex items-center justify-center p-8 bg-[#121212] border border-white/5 rounded-3xl">
                     <p className="text-sm font-medium text-muted-foreground">No highlights yet.</p>
                  </div>
                )}
            </div>
        </section>

        {/* Achievements Section */}
        <section className="mb-16">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-accent mb-6 ml-2 md:mx-auto md:max-w-max text-center">
               Trophies
            </h2>
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-4 px-2 w-full md:justify-center">
                {achievements.length > 0 ? achievements.map(achievement => (
                  <div key={achievement.id} className="flex items-center gap-3 shrink-0 px-5 py-3.5 bg-[#121212] border border-white/5 rounded-2xl group">
                     <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                        {achievement.icon === 'trophy' ? <Trophy className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-white whitespace-nowrap">{achievement.title}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black opacity-60">
                           {new Date(achievement.earnedAt).toLocaleDateString()}
                        </span>
                     </div>
                  </div>
                )) : (
                  <div className="w-full flex items-center justify-center p-8 bg-[#121212] border border-white/5 rounded-3xl">
                     <p className="text-sm font-medium text-muted-foreground">No achievements unlocked.</p>
                  </div>
                )}
            </div>
        </section>

        {/* Divider */}
        <div className="w-full h-px bg-white/5 max-w-4xl mx-auto mb-16 relative">
          <div className="absolute left-1/2 -top-3 -translate-x-1/2 flex items-center justify-center w-6 h-6 bg-[#050505] text-white/20">
             <Package className="w-4 h-4" />
          </div>
        </div>

        {/* Course Grid Area */}
        <section className="space-y-8 max-w-[1400px] mx-auto">
           {courses.length > 0 ? (
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {courses.map(course => <CourseCard key={course.id} course={{...course, profiles: profile}} />)}
             </div>
           ) : (
             <div className="py-24 text-center space-y-6 max-w-sm mx-auto bg-[#121212] rounded-[2rem] border border-white/5 p-8">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-muted-foreground">
                   <Package className="w-8 h-8 opacity-40" />
                </div>
                <div className="space-y-2">
                   <h3 className="text-lg font-black text-white">No courses yet</h3>
                   <p className="text-[13px] font-medium text-muted-foreground">
                     {isOwnProfile ? "Ready to share your knowledge with the world?" : "This user hasn't published any courses."}
                   </p>
                </div>
             </div>
           )}
        </section>

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
