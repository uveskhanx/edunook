/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate, Link, Outlet, useLocation } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { DbService, UserPreferences } from '@/lib/db-service';
import { Layout } from '@/components/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Shield, Bell, CreditCard, 
  BookOpen, Monitor, SignOut,
  WarningCircle, CaretRight,
  Moon, Wind, SealCheck, X,
  ChatCircleDots, Bug, Lightbulb,
  ArrowRight
} from '@phosphor-icons/react';
import { auth } from '@/lib/firebase';
import { sendEmailVerification } from 'firebase/auth';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';
import { sendFeedbackEmailAction } from '@/lib/server/email-actions';

interface SettingsItem {
  label: string;
  value?: string | string[] | null;
  type?: string;
  readOnly?: boolean;
  status?: 'success' | 'warning';
  action?: { label: string; onClick?: () => void; to?: string } | null;
  prefKey?: string;
  section?: keyof UserPreferences;
  options?: string[];
}

interface SettingsSection {
  id: string;
  title: string;
  icon: any;
  items: SettingsItem[];
  action?: { label: string; onClick?: () => void; to?: string } | null;
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, dbUser, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  
  const isBaseSettings = pathname === '/settings';
  
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'improvement'>('improvement');
  const [feedbackText, setFeedbackText] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  
  const [localPrefs, setLocalPrefs] = useState<UserPreferences | null>(dbUser?.preferences || null);

  useEffect(() => {
    if (dbUser?.preferences) {
      setLocalPrefs(dbUser.preferences);
    } else if (!localPrefs && dbUser) {
      const defaults: UserPreferences = {
        notifications: { followers: true, courseUpdates: true, quizResults: true },
        learning: { categories: [], language: 'English', suggestions: true },
        app: { darkMode: true, theme: 'dark', reduceAnimations: false, dataSaver: false }
      };
      setLocalPrefs(defaults);
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
      toast.success("Preference updated", { duration: 1000 });
    } catch (err) {
      toast.error("Failed to save changes");
    }
  };

  const sections: SettingsSection[] = [
    {
      id: 'account',
      title: 'Account',
      icon: User,
      items: [
        { label: 'Username', value: `@${dbUser?.username || 'student'}`, type: 'text', readOnly: true },
        { label: 'Email', value: user?.email, type: 'text', readOnly: true },
      ]
    },
    {
      id: 'security',
      title: 'Security',
      icon: Shield,
      items: [
        { 
          label: 'Password', 
          value: '••••••••', 
          type: 'password', 
          action: { label: 'Change Securely', to: '/settings/change-password' } 
        }
      ]
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: Bell,
      items: [
        { label: 'Followers', prefKey: 'followers', section: 'notifications' },
        { label: 'Course Updates', prefKey: 'courseUpdates', section: 'notifications' },
        { label: 'Quiz Results', prefKey: 'quizResults', section: 'notifications' },
      ]
    },
    {
      id: 'subscription',
      title: 'Subscription',
      icon: CreditCard,
      items: [
        { label: 'Current Plan', value: dbUser?.subscription?.planId ? dbUser.subscription.planId.toUpperCase() : 'SPARK (Free)', type: 'bold' },
        { label: 'Billing Cycle', value: dbUser?.subscription?.billingCycle ? dbUser.subscription.billingCycle.toUpperCase() : 'N/A', type: 'text' },
        { label: 'Benefits', value: dbUser?.subscription?.planId === 'edge' ? ['Blue Badge', '30% Discounts', 'Better Visibility', 'Custom Profile Themes'] : ['Basic Access'], type: 'list' },
      ],
      action: { label: 'Manage Plan', to: '/subscription' }
    },
    {
      id: 'learning',
      title: 'Learning',
      icon: BookOpen,
      items: [
        { 
          label: 'Language', 
          value: localPrefs?.learning.language || 'English', 
          type: 'select', 
          options: [
            'English', 'Hindi', 'Spanish', 'French', 'German', 
            'Japanese', 'Mandarin', 'Bengali', 'Russian', 'Portuguese', 
            'Arabic', 'Korean', 'Italian', 'Marathi', 'Tamil'
          ], 
          prefKey: 'language', 
          section: 'learning' 
        },
        { 
          label: 'Interests', 
          value: localPrefs?.learning.categories || [], 
          type: 'categories', 
          prefKey: 'categories', 
          section: 'learning' 
        },
        { label: 'Personalized Suggestions', prefKey: 'suggestions', section: 'learning' },
      ]
    },
    {
      id: 'app',
      title: 'App Settings',
      icon: Monitor,
      items: [
        { label: `${theme === 'dark' ? 'Dark' : 'Light'} Mode`, value: theme.toUpperCase(), type: 'theme-toggle', prefKey: 'darkMode', section: 'app' },
      ]
    },
    {
      id: 'help',
      title: 'Help & Feedback',
      icon: ChatCircleDots,
      items: [
        { label: 'Report a Technical Issue', action: { label: 'Report Bug', onClick: () => { setFeedbackType('bug'); setShowFeedbackModal(true); } } },
        { label: 'Suggest an Improvement', action: { label: 'Suggest', onClick: () => { setFeedbackType('improvement'); setShowFeedbackModal(true); } } },
      ]
    }
  ];

  return (
    <Layout showSettings={false}>
      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-12 md:py-20">
        
        {/* Header */}
        <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tighter mb-4">Settings</h1>
            <p className="text-muted-foreground font-medium">Control your account, privacy, and preferences.</p>
        </div>

        <div className="space-y-6">
           {sections.map((section, sIdx) => (
             <motion.div 
                key={section.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: sIdx * 0.05 }}
                className="bg-card backdrop-blur-3xl border border-border rounded-[2rem] overflow-hidden shadow-sm"
             >
                <div className="p-8">
                   <div className="flex items-center gap-4 mb-8">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                         <section.icon size={24} weight="duotone" />
                      </div>
                      <h2 className="text-xl font-black text-foreground capitalize">{section.title}</h2>
                   </div>

                   <div className="space-y-6">
                      {section.items.map((item: SettingsItem, iIdx) => (
                        <div key={iIdx} className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 border-b border-border last:border-0 pb-6 last:pb-2">
                           <div className="flex flex-col">
                              <span className="text-[13px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">{item.label}</span>
                              {(item.value && item.type !== 'select') && (
                                <span className={`text-base font-bold ${item.type === 'bold' ? 'text-primary' : 'text-foreground/80'}`}>
                                   {Array.isArray(item.value) ? (
                                      <div className="flex flex-wrap gap-2 mt-2">
                                         {item.value.map(v => (
                                           <span key={v} className="px-3 py-1 bg-muted rounded-full text-[10px] uppercase font-black tracking-widest text-muted-foreground border border-border">
                                              {v}
                                           </span>
                                         ))}
                                      </div>
                                   ) : item.value}
                                </span>
                              )}
                           {item.status && (
                                <div className="flex items-center gap-2 mt-1">
                                   {item.status === 'success' ? <SealCheck className="text-emerald-500" /> : <WarningCircle className="text-amber-500" />}
                                   <span className={`text-[11px] font-black uppercase tracking-widest ${item.status === 'success' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                      {item.value}
                                   </span>
                                </div>
                              )}
                           </div>

                           <div className="flex items-center gap-3">
                              {item.type === 'theme-toggle' && (
                                <button 
                                  onClick={toggleTheme}
                                  className={`w-14 h-7 rounded-full transition-all relative p-1 ${
                                    theme === 'dark' ? 'bg-primary' : 'bg-slate-300'
                                  }`}
                                >
                                  <motion.div 
                                    animate={{ x: theme === 'dark' ? 28 : 0 }}
                                    className={`w-5 h-5 rounded-full shadow-md flex items-center justify-center ${theme === 'dark' ? 'bg-white text-primary' : 'bg-white text-slate-500'}`}
                                  >
                                      {theme === 'dark' ? <Moon size={10} weight="fill" /> : <Wind size={10} weight="fill" />}
                                  </motion.div>
                                </button>
                              )}

                              {item.type === 'select' && (
                                <select 
                                  value={item.value as string}
                                  onChange={(e) => handleUpdatePref(item.section!, item.prefKey!, e.target.value)}
                                  className="bg-muted border border-border rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest outline-none focus:border-primary transition-all cursor-pointer text-foreground"
                                >
                                   {item.options?.map(opt => (
                                     <option key={opt} value={opt}>{opt}</option>
                                   ))}
                                </select>
                              )}

                              {item.type === 'categories' && (
                                <div className="flex flex-wrap gap-2 max-w-md justify-end">
                                   {[
                                     { id: 'programming', label: 'Code' },
                                     { id: 'design', label: 'Art' },
                                     { id: 'business', label: 'Biz' },
                                     { id: 'marketing', label: 'Ads' },
                                     { id: 'music', label: 'Music' },
                                     { id: 'photography', label: 'Photo' },
                                     { id: 'science', label: 'Sci' },
                                     { id: 'math', label: 'Math' },
                                     { id: 'language', label: 'Lang' },
                                     { id: 'general', label: 'Misc' }
                                   ].map(cat => {
                                     const isSelected = (item.value as string[]).includes(cat.id);
                                     return (
                                       <button 
                                         key={cat.id}
                                         onClick={() => {
                                           const current = [...(item.value as string[])];
                                           const next = isSelected 
                                             ? current.filter(c => c !== cat.id)
                                             : [...current, cat.id];
                                           handleUpdatePref(item.section!, item.prefKey!, next);
                                         }}
                                         className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                           isSelected 
                                             ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                                             : 'bg-muted border-border text-muted-foreground hover:border-white/20 hover:text-white'
                                         }`}
                                       >
                                         {cat.label}
                                       </button>
                                     );
                                   })}
                                </div>
                              )}

                              {item.prefKey && item.section && item.type !== 'theme-toggle' && item.type !== 'select' && item.type !== 'categories' && (
                                <button 
                                  onClick={() => handleUpdatePref(item.section!, item.prefKey!, !(localPrefs as any)?.[item.section!]?.[item.prefKey!])}
                                  className={`w-14 h-7 rounded-full transition-all relative p-1 ${
                                    (localPrefs as any)?.[item.section!]?.[item.prefKey!] ? 'bg-primary' : 'bg-muted'
                                  }`}
                                >
                                   <motion.div 
                                     animate={{ x: (localPrefs as any)?.[item.section!]?.[item.prefKey!] ? 28 : 0 }}
                                     className="w-5 h-5 bg-white rounded-full shadow-lg" 
                                   />
                                </button>
                              )}
                              
                              {item.action && (
                                item.action.to ? (
                                  <Link 
                                    to={item.action.to as any}
                                    className="px-6 py-2.5 bg-muted hover:bg-primary hover:text-white text-foreground rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 border border-border"
                                  >
                                     {item.action.label}
                                  </Link>
                                ) : (
                                  <button 
                                    onClick={item.action.onClick}
                                    className="px-6 py-2.5 bg-muted hover:bg-primary hover:text-white text-foreground rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 border border-border"
                                  >
                                     {item.action.label}
                                  </button>
                                )
                              )}

                              {item.type === 'link' && (
                                <CaretRight size={20} className="text-muted-foreground/40" />
                              )}
                           </div>
                        </div>
                      ))}
                   </div>

                    {section.action && (
                      section.action.to ? (
                        <Link
                          to={section.action.to as any}
                          className="mt-8 flex items-center justify-center w-full py-4 bg-primary text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                          {section.action.label}
                        </Link>
                      ) : (
                        <button 
                          onClick={section.action.onClick}
                          className="mt-8 w-full py-4 bg-primary text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                          {section.action.label}
                        </button>
                      )
                    )}
                </div>
             </motion.div>
           ))}

           {/* Sign Out Section */}
           <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="pt-12 text-center"
           >
              <button 
                onClick={() => setShowSignOutModal(true)}
                className="group flex items-center justify-center gap-4 mx-auto px-12 py-5 bg-destructive/10 hover:bg-destructive text-destructive hover:text-white rounded-[2rem] border border-destructive/20 transition-all active:scale-95"
              >
                 <SignOut size={24} weight="bold" />
                 <span className="text-lg font-black uppercase tracking-tighter">Sign Out of EduNook</span>
              </button>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground opacity-30">
                 Logged in as {user.email}
              </p>
           </motion.div>
        </div>
      </div>

      {/* Sign Out Confirmation Modal */}
      <AnimatePresence>
        {showSignOutModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSignOutModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-card border border-border rounded-[2.5rem] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto mb-6">
                <SignOut size={32} weight="duotone" />
              </div>
              <h3 className="text-2xl font-black text-foreground mb-2">Sign Out?</h3>
              <p className="text-muted-foreground font-medium mb-8">
                Are you sure you want to log out of your EduNook account?
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={signOut}
                  className="w-full py-4 bg-destructive text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-destructive/20 active:scale-95 transition-all"
                >
                  Yes, Sign Out
                </button>
                <button 
                  onClick={() => setShowSignOutModal(false)}
                  className="w-full py-4 bg-muted text-foreground rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Feedback Modal */}
      <AnimatePresence>
        {showFeedbackModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFeedbackModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#0f0f0f] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              {/* Glow */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-[80px]" />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                      {feedbackType === 'bug' ? <Bug size={24} weight="duotone" /> : <Lightbulb size={24} weight="duotone" />}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white">{feedbackType === 'bug' ? 'Report an Issue' : 'Suggest Improvement'}</h3>
                      <p className="text-xs text-muted-foreground font-medium">Help us make EduNook better</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowFeedbackModal(false)}
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors text-muted-foreground hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-4">Your Message</label>
                    <textarea 
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      disabled={isSendingFeedback}
                      placeholder={feedbackType === 'bug' ? "What happened? Describe the issue..." : "What could we do better? Tell us your ideas..."}
                      className="w-full h-40 bg-white/[0.03] border border-white/5 rounded-2xl p-6 text-white font-medium focus:border-primary/50 focus:bg-white/[0.05] transition-all outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3 items-start">
                    <ChatCircleDots size={20} className="text-primary shrink-0" weight="bold" />
                    <p className="text-[11px] font-medium text-primary/70 leading-relaxed">
                      Your feedback will be sent directly to the <span className="font-bold">@edunook</span> team for review.
                    </p>
                  </div>

                          <button 
                            onClick={() => {
                              console.log('[Feedback] Send clicked');
                              if (!feedbackText.trim() || !user || !dbUser) return;
                              
                              // 1. Close immediately
                              const text = feedbackText;
                              const type = feedbackType;
                              setFeedbackText('');
                              setShowFeedbackModal(false);
                              toast.loading("Sending feedback...", { id: 'feedback-status' });

                              // 2. Background work
                              (async () => {
                                try {
                                  const feedbackData = {
                                    email: user.email!,
                                    type: type === 'bug' ? 'Bug Report' : 'Improvement',
                                    message: text,
                                    username: dbUser.username || 'student'
                                  };

                                  const edunookUid = await DbService.getUidByUsername('edunook');
                                  if (edunookUid) {
                                    const chatId = await DbService.getOrCreateChat(user.id, edunookUid);
                                    await DbService.sendMessage(chatId, user.id, `[${feedbackData.type}] ${text}`);
                                    await DbService.deleteChat(user.id, chatId);
                                  }
                                  await DbService.createFeedback(user.id, feedbackData);
                                  sendFeedbackEmailAction({ data: feedbackData }).catch(() => {});
                                  toast.success("Feedback received! Thank you.", { id: 'feedback-status' });
                                } catch (err) {
                                  console.error('[Feedback] Background error:', err);
                                  toast.error("Failed to send feedback. Please try again later.", { id: 'feedback-status' });
                                }
                              })();
                            }}
                            disabled={!feedbackText.trim()}
                            className="w-full py-5 bg-primary text-white rounded-2xl font-black text-[13px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                          >
                             Send Feedback
                             <ArrowRight weight="bold" />
                          </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
