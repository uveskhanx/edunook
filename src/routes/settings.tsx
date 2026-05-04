import { createFileRoute, useNavigate, Link, Outlet, useLocation } from '@tanstack/react-router';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { DbService, UserPreferences, Profile } from '@/lib/db-service';
import { Layout } from '@/components/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Shield, Bell, CreditCard, 
  BookOpen, Monitor, SignOut,
  WarningCircle, CaretRight,
  Moon, Wind, SealCheck, X,
  ChatCircleDots, Bug, Lightbulb,
  ArrowRight, IdentificationCard, EyeSlash,
  Palette, Globe, LockKey, CheckCircle,
  DeviceMobile, AppWindow
} from '@phosphor-icons/react';
import { auth } from '@/lib/firebase';
import { sendEmailVerification } from 'firebase/auth';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';
import { sendFeedbackEmailAction } from '@/lib/server/email-actions';

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

type SettingsTab = 'account' | 'privacy' | 'notifications' | 'subscription' | 'appearance' | 'learning' | 'help';

function SettingsPage() {
  const { user, dbUser, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  
  const isBaseSettings = pathname === '/settings';
  
  const [currentTab, setCurrentTab] = useState<SettingsTab>('account');
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'improvement'>('improvement');
  const [feedbackText, setFeedbackText] = useState('');
  
  const [localPrefs, setLocalPrefs] = useState<UserPreferences | null>(dbUser?.preferences || null);
  const [editProfile, setEditProfile] = useState({ fullName: dbUser?.fullName || '', bio: dbUser?.bio || '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (dbUser) {
      setLocalPrefs(dbUser.preferences || null);
      setEditProfile({ fullName: dbUser.fullName || '', bio: dbUser.bio || '' });
    }
  }, [dbUser]);

  if (authLoading) return null;
  if (!user) {
    navigate({ to: '/login' });
    return null;
  }
  if (!isBaseSettings) return <Outlet />;

  const handleUpdatePref = async (section: keyof UserPreferences, key: string, value: any) => {
    if (!user || !localPrefs) return;
    
    const updatedPrefs = {
      ...localPrefs,
      [section]: {
        ...(localPrefs[section] as any),
        [key]: value
      }
    };
    
    setLocalPrefs(updatedPrefs);
    try {
      await DbService.updatePreferences(user.id, updatedPrefs);
      toast.success("Intelligence preference updated", { duration: 1000 });
      
      // Special logic for real-time presence toggle
      if (key === 'showOnlineStatus') {
         DbService.updatePresence(user.id, value);
      }
    } catch (err) {
      toast.error("Transmission failed");
    }
  };

  const handleSaveProfile = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      await DbService.updateProfile(user.id, editProfile);
      toast.success("Profile Signal Updated");
    } catch (err) {
      toast.error("Failed to update profile signal");
    } finally {
      setIsSaving(false);
    }
  };

  const TABS = [
    { id: 'account', label: 'Identity', icon: IdentificationCard },
    { id: 'privacy', label: 'Cloak', icon: EyeSlash },
    { id: 'notifications', label: 'Pulse', icon: Bell },
    { id: 'subscription', label: 'Access', icon: CreditCard },
    { id: 'appearance', label: 'Vision', icon: Palette },
    { id: 'learning', label: 'Mindset', icon: BookOpen },
    { id: 'help', label: 'Terminal', icon: ChatCircleDots },
  ];

  return (
    <Layout showSettings={false}>
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-primary/5 to-transparent -z-10" />
        <div className="absolute top-1/4 -right-24 w-96 h-96 bg-primary/10 blur-[120px] rounded-full -z-10" />

        <div className="max-w-6xl mx-auto px-4 py-12 md:py-24">
           {/* Header */}
           <div className="mb-12 md:mb-20">
              <div className="flex items-center gap-3 mb-4">
                 <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                    <AppWindow size={24} weight="duotone" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">System Configuration</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tighter">Command Center</h1>
           </div>

           <div className="flex flex-col lg:flex-row gap-12 items-start">
              {/* Sidebar Tabs */}
              <div className="w-full lg:w-72 shrink-0 space-y-2">
                 {TABS.map(tab => (
                   <button
                     key={tab.id}
                     onClick={() => setCurrentTab(tab.id as SettingsTab)}
                     className={`w-full flex items-center gap-4 px-6 py-4 rounded-3xl transition-all group ${
                       currentTab === tab.id 
                         ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]' 
                         : 'bg-card/50 hover:bg-card text-foreground/40 hover:text-foreground border border-transparent hover:border-border'
                     }`}
                   >
                     <tab.icon size={24} weight={currentTab === tab.id ? "fill" : "duotone"} className="shrink-0" />
                     <span className="font-black text-sm uppercase tracking-widest">{tab.label}</span>
                     {currentTab === tab.id && <motion.div layoutId="tab-indicator" className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
                   </button>
                 ))}

                 <div className="pt-8 mt-8 border-t border-border/50">
                    <button 
                      onClick={() => setShowSignOutModal(true)}
                      className="w-full flex items-center gap-4 px-6 py-4 rounded-3xl text-rose-500 hover:bg-rose-500/10 transition-all group"
                    >
                       <SignOut size={24} weight="duotone" />
                       <span className="font-black text-sm uppercase tracking-widest">Disconnect</span>
                    </button>
                 </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 w-full">
                 <AnimatePresence mode="wait">
                    <motion.div
                      key={currentTab}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="bg-card/30 backdrop-blur-3xl border border-border rounded-[2.5rem] p-6 md:p-10 shadow-2xl overflow-hidden relative"
                    >
                       {/* Subtle Tab Indicator Background */}
                       <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/5 blur-[80px] rounded-full" />

                       {currentTab === 'account' && (
                         <div className="space-y-10 relative">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-border/50">
                               <div>
                                  <h2 className="text-2xl font-black text-foreground mb-1 italic">Identity Signal</h2>
                                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">Manage your presence on the grid</p>
                               </div>
                               <div className="flex items-center gap-4 p-3 bg-foreground/5 rounded-2xl border border-border">
                                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black italic">
                                     {dbUser?.fullName?.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                  </div>
                                  <div className="flex flex-col pr-4">
                                     <span className="text-xs font-black text-foreground uppercase truncate">{dbUser?.username}</span>
                                     <span className="text-[10px] text-muted-foreground font-bold">{user.email}</span>
                                  </div>
                               </div>
                            </div>

                            <div className="grid gap-8">
                               <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-primary ml-2">Broadcast Name</label>
                                  <input 
                                    type="text" 
                                    value={editProfile.fullName}
                                    onChange={e => setEditProfile(p => ({ ...p, fullName: e.target.value }))}
                                    className="w-full bg-foreground/5 border border-border rounded-2xl p-5 text-foreground font-bold outline-none focus:border-primary/50 transition-all"
                                    placeholder="Enter your full name"
                                  />
                               </div>
                               <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-primary ml-2">Intelligence Bio</label>
                                  <textarea 
                                    value={editProfile.bio}
                                    onChange={e => setEditProfile(p => ({ ...p, bio: e.target.value }))}
                                    className="w-full h-32 bg-foreground/5 border border-border rounded-2xl p-5 text-foreground font-bold outline-none focus:border-primary/50 transition-all resize-none"
                                    placeholder="Describe your focus area..."
                                  />
                               </div>
                               <button 
                                 onClick={handleSaveProfile}
                                 disabled={isSaving}
                                 className="w-full md:w-fit px-12 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                               >
                                  {isSaving ? 'Synchronizing...' : 'Save Profile Signal'}
                               </button>
                            </div>

                            <div className="pt-10 border-t border-border/50">
                               <h3 className="text-sm font-black uppercase tracking-widest text-foreground/40 mb-6 italic">Security Access</h3>
                               <div className="flex flex-col md:flex-row gap-4">
                                  <Link 
                                    to="/settings/change-password"
                                    className="flex-1 p-6 bg-foreground/5 border border-border rounded-[2rem] hover:bg-foreground/10 transition-all group"
                                  >
                                     <LockKey size={24} className="text-primary mb-4" weight="duotone" />
                                     <h4 className="font-black text-foreground uppercase tracking-tighter mb-1">Rotation Protocol</h4>
                                     <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Update your access key</p>
                                  </Link>
                                  <div className="flex-1 p-6 bg-foreground/5 border border-border rounded-[2rem]">
                                     {user.emailVerified ? (
                                        <>
                                          <CheckCircle size={24} className="text-emerald-500 mb-4" weight="duotone" />
                                          <h4 className="font-black text-foreground uppercase tracking-tighter mb-1">Authenticated</h4>
                                          <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Signal Verified</p>
                                        </>
                                     ) : (
                                        <>
                                          <WarningCircle size={24} className="text-amber-500 mb-4" weight="duotone" />
                                          <h4 className="font-black text-foreground uppercase tracking-tighter mb-1">Unverified</h4>
                                          <button 
                                            onClick={() => {
                                               sendEmailVerification(auth.currentUser!).then(() => toast.success("Verification signal sent."));
                                            }}
                                            className="text-[10px] text-primary font-black uppercase tracking-widest hover:underline"
                                          >
                                            Request Link
                                          </button>
                                        </>
                                     )}
                                  </div>
                               </div>
                            </div>
                         </div>
                       )}

                       {currentTab === 'privacy' && (
                          <div className="space-y-10">
                             <div>
                                <h2 className="text-2xl font-black text-foreground mb-1 italic">Cloak & Encryption</h2>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">Manage your data visibility</p>
                             </div>

                             <div className="grid gap-4">
                                {[
                                   { label: 'Incognito Mode', desc: 'Hide your online status from other signals', key: 'showOnlineStatus' },
                                   { label: 'Transmission Feedback', desc: 'Allow others to see when you read their signal', key: 'showReadReceipts' },
                                   { label: 'Open Terminal', desc: 'Allow direct messages from unlinked users', key: 'allowStrangerMessages' },
                                ].map(item => (
                                   <div key={item.key} className="p-6 bg-foreground/5 border border-border rounded-3xl flex items-center justify-between gap-6 group hover:bg-foreground/10 transition-all">
                                      <div className="flex-1">
                                         <h4 className="font-black text-foreground uppercase tracking-tighter">{item.label}</h4>
                                         <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{item.desc}</p>
                                      </div>
                                      <button 
                                        onClick={() => handleUpdatePref('privacy', item.key, !(localPrefs as any)?.privacy?.[item.key])}
                                        className={`w-14 h-7 rounded-full transition-all relative p-1 ${
                                          (localPrefs as any)?.privacy?.[item.key] ? 'bg-primary' : 'bg-muted'
                                        }`}
                                      >
                                         <motion.div 
                                           animate={{ x: (localPrefs as any)?.privacy?.[item.key] ? 28 : 0 }}
                                           className="w-5 h-5 bg-white rounded-full shadow-lg" 
                                         />
                                      </button>
                                   </div>
                                ))}
                             </div>
                             
                             <div className="p-6 bg-rose-500/5 border border-rose-500/20 rounded-3xl">
                                <div className="flex items-center gap-4 mb-4">
                                   <WarningCircle size={24} className="text-rose-500" weight="fill" />
                                   <h4 className="font-black text-rose-500 uppercase tracking-tighter">Terminal Wipe</h4>
                                </div>
                                <p className="text-[11px] font-bold text-rose-500/60 leading-relaxed mb-6 uppercase tracking-widest">
                                   Permanent removal of your identity and intelligence data from the EduNook grid. This action is irreversible.
                                </p>
                                <button className="px-6 py-3 bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all">
                                   Initialize Termination
                                </button>
                             </div>
                          </div>
                       )}

                       {currentTab === 'notifications' && (
                          <div className="space-y-10">
                             <div>
                                <h2 className="text-2xl font-black text-foreground mb-1 italic">Pulse Alerts</h2>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">Synchronize your attention</p>
                             </div>

                             <div className="grid gap-4">
                                {[
                                   { label: 'Follower Alerts', key: 'followers' },
                                   { label: 'Course Intel Updates', key: 'courseUpdates' },
                                   { label: 'Quiz Analytics', key: 'quizResults' },
                                ].map(item => (
                                   <div key={item.key} className="p-6 bg-foreground/5 border border-border rounded-3xl flex items-center justify-between gap-6 group hover:bg-foreground/10 transition-all">
                                      <h4 className="font-black text-foreground uppercase tracking-tighter">{item.label}</h4>
                                      <button 
                                        onClick={() => handleUpdatePref('notifications', item.key, !(localPrefs as any)?.notifications?.[item.key])}
                                        className={`w-14 h-7 rounded-full transition-all relative p-1 ${
                                          (localPrefs as any)?.notifications?.[item.key] ? 'bg-primary' : 'bg-muted'
                                        }`}
                                      >
                                         <motion.div 
                                           animate={{ x: (localPrefs as any)?.notifications?.[item.key] ? 28 : 0 }}
                                           className="w-5 h-5 bg-white rounded-full shadow-lg" 
                                         />
                                      </button>
                                   </div>
                                ))}
                             </div>
                          </div>
                       )}

                       {currentTab === 'subscription' && (
                          <div className="space-y-10">
                             <div>
                                <h2 className="text-2xl font-black text-foreground mb-1 italic">Access Protocol</h2>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">Manage your intelligence clearance</p>
                             </div>

                             <div className="p-8 bg-primary/10 border border-primary/20 rounded-[2.5rem] relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[40px] -z-10 group-hover:scale-150 transition-transform duration-700" />
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                                   <div>
                                      <div className="flex items-center gap-3 mb-2">
                                         <span className="px-3 py-1 bg-primary text-white text-[9px] font-black uppercase tracking-widest rounded-lg">
                                            {dbUser?.subscription?.planId?.toUpperCase() || 'SPARK'}
                                         </span>
                                         <span className="text-[10px] font-black text-primary uppercase tracking-widest">Active System</span>
                                      </div>
                                      <h3 className="text-4xl font-black text-foreground tracking-tighter mb-4">
                                         {dbUser?.subscription?.planId === 'edge' ? 'EduNook Edge' : 'EduNook Spark'}
                                      </h3>
                                      <ul className="space-y-2">
                                         {(dbUser?.subscription?.planId === 'edge' ? ['Advanced AI Analytics', 'Unlimited Communications', 'Priority Intelligence'] : ['Basic Learning', 'Public Signals', 'Standard Tests']).map(f => (
                                           <li key={f} className="flex items-center gap-2 text-[10px] font-black text-foreground/40 uppercase tracking-widest">
                                              <SealCheck weight="fill" className="text-primary w-4 h-4" /> {f}
                                           </li>
                                         ))}
                                      </ul>
                                   </div>
                                   <Link 
                                     to="/subscription"
                                     className="px-8 py-5 bg-primary text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
                                   >
                                      Manage Access
                                   </Link>
                                </div>
                             </div>
                          </div>
                       )}

                       {currentTab === 'appearance' && (
                          <div className="space-y-10">
                             <div>
                                <h2 className="text-2xl font-black text-foreground mb-1 italic">Vision Parameters</h2>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">Customize your terminal interface</p>
                             </div>

                             <div className="grid gap-6">
                                <div className="p-6 bg-foreground/5 border border-border rounded-3xl flex items-center justify-between gap-6">
                                   <div>
                                      <h4 className="font-black text-foreground uppercase tracking-tighter">Theme Core</h4>
                                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Current: {theme.toUpperCase()}</p>
                                   </div>
                                   <button 
                                      onClick={toggleTheme}
                                      className={`w-16 h-8 rounded-full transition-all relative p-1.5 ${
                                        theme === 'dark' ? 'bg-primary' : 'bg-slate-300'
                                      }`}
                                    >
                                      <motion.div 
                                        animate={{ x: theme === 'dark' ? 32 : 0 }}
                                        className={`w-5 h-5 rounded-full shadow-md flex items-center justify-center ${theme === 'dark' ? 'bg-white text-primary' : 'bg-white text-slate-500'}`}
                                      >
                                          {theme === 'dark' ? <Moon size={12} weight="fill" /> : <Wind size={12} weight="fill" />}
                                      </motion.div>
                                    </button>
                                </div>

                                <div className="p-6 bg-foreground/5 border border-border rounded-3xl flex items-center justify-between gap-6">
                                   <div>
                                      <h4 className="font-black text-foreground uppercase tracking-tighter">Kinetic Dampening</h4>
                                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Reduce motion & animations</p>
                                   </div>
                                   <button 
                                      onClick={() => handleUpdatePref('app', 'reduceAnimations', !(localPrefs as any)?.app?.reduceAnimations)}
                                      className={`w-14 h-7 rounded-full transition-all relative p-1 ${
                                        (localPrefs as any)?.app?.reduceAnimations ? 'bg-primary' : 'bg-muted'
                                      }`}
                                    >
                                       <motion.div 
                                         animate={{ x: (localPrefs as any)?.app?.reduceAnimations ? 28 : 0 }}
                                         className="w-5 h-5 bg-white rounded-full shadow-lg" 
                                       />
                                    </button>
                                </div>
                             </div>
                          </div>
                       )}

                       {currentTab === 'learning' && (
                          <div className="space-y-10">
                             <div>
                                <h2 className="text-2xl font-black text-foreground mb-1 italic">Mindset Focus</h2>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">Calibrate your intelligence path</p>
                             </div>

                             <div className="space-y-8">
                                <div className="space-y-4">
                                   <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary ml-2">Interface Dialect</h4>
                                   <select 
                                      value={localPrefs?.learning.language || 'English'}
                                      onChange={(e) => handleUpdatePref('learning', 'language', e.target.value)}
                                      className="w-full bg-foreground/5 border border-border rounded-2xl p-5 text-foreground font-bold outline-none focus:border-primary/50 transition-all cursor-pointer appearance-none"
                                   >
                                      {['English', 'Hindi', 'Spanish', 'French', 'German', 'Japanese', 'Mandarin'].map(opt => (
                                        <option key={opt} value={opt} className="bg-background">{opt}</option>
                                      ))}
                                   </select>
                                </div>

                                <div className="space-y-4">
                                   <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary ml-2">Intelligence Clusters</h4>
                                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                      {[
                                        { id: 'programming', label: 'Code' },
                                        { id: 'design', label: 'Art' },
                                        { id: 'business', label: 'Biz' },
                                        { id: 'science', label: 'Sci' },
                                        { id: 'math', label: 'Math' },
                                        { id: 'language', label: 'Lang' }
                                      ].map(cat => {
                                        const isSelected = localPrefs?.learning.categories.includes(cat.id);
                                        return (
                                          <button 
                                            key={cat.id}
                                            onClick={() => {
                                              const current = [...(localPrefs?.learning.categories || [])];
                                              const next = isSelected ? current.filter(c => c !== cat.id) : [...current, cat.id];
                                              handleUpdatePref('learning', 'categories', next);
                                            }}
                                            className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border text-center ${
                                              isSelected 
                                                ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10' 
                                                : 'bg-foreground/5 border-border text-foreground/40 hover:border-foreground/20'
                                            }`}
                                          >
                                            {cat.label}
                                          </button>
                                        );
                                      })}
                                   </div>
                                </div>
                             </div>
                          </div>
                       )}

                       {currentTab === 'help' && (
                          <div className="space-y-10">
                             <div>
                                <h2 className="text-2xl font-black text-foreground mb-1 italic">Terminal Support</h2>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">Resolve signal interference</p>
                             </div>

                             <div className="grid gap-4">
                                {[
                                   { label: 'Report Intelligence Bug', icon: Bug, type: 'bug' },
                                   { label: 'Suggest System Improvement', icon: Lightbulb, type: 'improvement' },
                                ].map(item => (
                                   <button 
                                     key={item.type}
                                     onClick={() => { setFeedbackType(item.type as any); setShowFeedbackModal(true); }}
                                     className="p-6 bg-foreground/5 border border-border rounded-3xl flex items-center gap-6 group hover:bg-primary/5 hover:border-primary/20 transition-all text-left"
                                   >
                                      <div className="w-12 h-12 rounded-2xl bg-foreground/5 group-hover:bg-primary/10 text-foreground/40 group-hover:text-primary flex items-center justify-center transition-all">
                                         <item.icon size={24} weight="duotone" />
                                      </div>
                                      <div className="flex-1">
                                         <h4 className="font-black text-foreground uppercase tracking-tighter">{item.label}</h4>
                                         <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest italic">Submit encrypted report</p>
                                      </div>
                                      <ArrowRight size={20} className="text-foreground/10 group-hover:text-primary transition-all" weight="bold" />
                                   </button>
                                ))}
                             </div>
                             
                             <div className="p-8 bg-foreground/5 border border-border rounded-[2.5rem] flex flex-col items-center text-center">
                                <DeviceMobile size={40} className="text-primary/20 mb-4" weight="duotone" />
                                <h4 className="text-sm font-black uppercase tracking-widest text-foreground mb-2 italic">EduNook Intelligence V2.4.0</h4>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-40 mb-6">Build ID: communicatons-hub-final</p>
                                <a href="mailto:support@edunook.com" className="px-8 py-3 bg-foreground/5 hover:bg-foreground/10 text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-border">
                                   Contact Support Channel
                                </a>
                             </div>
                          </div>
                       )}
                    </motion.div>
                 </AnimatePresence>
              </div>
           </div>
        </div>
      </div>

      {/* Modals from previous version remain here but with improved styling */}
      <AnimatePresence>
        {showSignOutModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSignOutModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-card border border-border rounded-[2.5rem] p-10 shadow-2xl text-center overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
              <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                <SignOut size={40} weight="duotone" />
              </div>
              <h3 className="text-3xl font-black text-foreground mb-3 italic">Disconnect?</h3>
              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest leading-relaxed mb-10">
                Are you sure you want to terminate your current intelligence session?
              </p>
              <div className="flex flex-col gap-4">
                <button 
                  onClick={signOut}
                  className="w-full py-5 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-500/20 active:scale-95 transition-all"
                >
                  Confirm Disconnect
                </button>
                <button 
                  onClick={() => setShowSignOutModal(false)}
                  className="w-full py-5 bg-foreground/5 text-foreground rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all border border-border"
                >
                  Maintain Signal
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFeedbackModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFeedbackModal(false)} className="absolute inset-0 bg-background/80 backdrop-blur-xl" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-lg bg-card border border-border rounded-[2.5rem] p-10 shadow-2xl overflow-hidden">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                     <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                        {feedbackType === 'bug' ? <Bug size={28} weight="duotone" /> : <Lightbulb size={28} weight="duotone" />}
                     </div>
                     <div>
                        <h3 className="text-2xl font-black text-foreground italic">{feedbackType === 'bug' ? 'Report Signal Error' : 'Improvement Logic'}</h3>
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Optimizing the EduNook grid</p>
                     </div>
                  </div>
                  <button onClick={() => setShowFeedbackModal(false)} className="p-3 hover:bg-foreground/5 rounded-2xl transition-colors text-muted-foreground hover:text-foreground">
                     <X size={24} />
                  </button>
               </div>

               <div className="space-y-6">
                  <textarea 
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder={feedbackType === 'bug' ? "What interference did you encounter? Describe the error..." : "How can we optimize the signal? Share your improvement logic..."}
                    className="w-full h-48 bg-foreground/5 border border-border rounded-2xl p-6 text-foreground font-medium focus:border-primary/50 focus:bg-foreground/[0.07] transition-all outline-none resize-none"
                  />

                  <button 
                    onClick={() => {
                      if (!feedbackText.trim()) return;
                      const text = feedbackText;
                      const type = feedbackType;
                      setFeedbackText('');
                      setShowFeedbackModal(false);
                      toast.loading("Sending transmission...", { id: 'feedback-status' });
                      
                      (async () => {
                        try {
                          const data = { 
                            email: user.email!, 
                            type: type === 'bug' ? 'Bug Report' : 'Improvement', 
                            message: text, 
                            username: dbUser?.username || 'student',
                            userId: user.id
                          };
                          await sendFeedbackEmailAction({ data });
                          toast.success("Signal Received. Thank you.", { id: 'feedback-status' });
                        } catch (err) {
                          toast.error("Transmission Interrupted.", { id: 'feedback-status' });
                        }
                      })();
                    }}
                    disabled={!feedbackText.trim()}
                    className="w-full py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                     Submit to Terminal
                     <ArrowRight weight="bold" />
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
