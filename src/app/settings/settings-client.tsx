'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/use-auth';
import { AiProfileSettings, DbService, UserPreferences } from '@/lib/db-service';
import { auth, db } from '@/lib/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { sendEmailVerification } from 'firebase/auth';
import { push, ref, set } from 'firebase/database';
import { toast } from 'sonner';
import {
  AppWindow,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Bug,
  CaretRight,
  CheckCircle,
  ChatCircleDots,
  CreditCard,
  DeviceMobile,
  Eye,
  IdentificationCard,
  Lightbulb,
  LockKey,
  Moon,
  Palette,
  SealCheck,
  Shield,
  ShieldCheck,
  SignOut,
  WarningCircle,
  Wind,
  X,
} from '@phosphor-icons/react';

type PreferenceSection = keyof UserPreferences;

const DEFAULT_PREFS: UserPreferences = {
  notifications: {
    followers: true,
    courseUpdates: true,
    quizResults: true,
  },
  learning: {
    categories: [],
    language: 'English',
    suggestions: true,
  },
  app: {
    darkMode: true,
    theme: 'dark',
    reduceAnimations: false,
    dataSaver: false,
  },
  privacy: {
    showOnlineStatus: true,
    showReadReceipts: true,
    allowStrangerMessages: false,
  },
};

const navSections = [
  { id: 'account', label: 'Account', icon: IdentificationCard },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'notifications', label: 'Alerts', icon: Bell },
  { id: 'appearance', label: 'Display', icon: Palette },
  { id: 'learning', label: 'Learning', icon: BookOpen },
  { id: 'ai-memory', label: 'AI Memory', icon: Lightbulb },
  { id: 'subscription', label: 'Plan', icon: CreditCard },
  { id: 'help', label: 'Help', icon: ChatCircleDots },
  { id: 'help-legal', label: 'Help & Legal', icon: ShieldCheck },
];

const learningCategories = [
  { id: 'programming', label: 'Programming' },
  { id: 'design', label: 'Design' },
  { id: 'business', label: 'Business' },
  { id: 'science', label: 'Science' },
  { id: 'math', label: 'Math' },
  { id: 'language', label: 'Languages' },
];

function mergePreferences(preferences?: UserPreferences | null): UserPreferences {
  return {
    notifications: { ...DEFAULT_PREFS.notifications, ...(preferences?.notifications || {}) },
    learning: { ...DEFAULT_PREFS.learning, ...(preferences?.learning || {}) },
    app: { ...DEFAULT_PREFS.app, ...(preferences?.app || {}) },
    privacy: { ...DEFAULT_PREFS.privacy, ...(preferences?.privacy || {}) },
  };
}

const DEFAULT_AI_PROFILE: AiProfileSettings = {
  preferredName: '',
  preferredLanguage: '',
  chatStyle: 'balanced',
  tone: 'calm',
  vibe: 'cool',
  emojiStyle: 'low',
  responseEnergy: 'medium',
  favoriteTopics: [],
  summary: '',
  manualNotes: '',
};

function mergeAiProfile(aiProfile?: AiProfileSettings | null): AiProfileSettings {
  return {
    ...DEFAULT_AI_PROFILE,
    ...(aiProfile || {}),
    favoriteTopics: aiProfile?.favoriteTopics || [],
  };
}

export default function SettingsClient() {
  const { user, dbUser, signOut, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showDeleteRequestModal, setShowDeleteRequestModal] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'improvement'>('improvement');
  const [feedbackText, setFeedbackText] = useState('');
  const [deleteRequestText, setDeleteRequestText] = useState('');
  const [localPrefs, setLocalPrefs] = useState<UserPreferences>(() => mergePreferences(dbUser?.preferences));
  const [editProfile, setEditProfile] = useState({ fullName: dbUser?.fullName || '', bio: dbUser?.bio || '' });
  const [razorpayAccountId, setRazorpayAccountId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPayouts, setIsSavingPayouts] = useState(false);
  const [isSavingAiProfile, setIsSavingAiProfile] = useState(false);
  const [isRefreshingAiProfile, setIsRefreshingAiProfile] = useState(false);
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const [isSendingDeleteRequest, setIsSendingDeleteRequest] = useState(false);
  const [aiProfile, setAiProfile] = useState<AiProfileSettings>(DEFAULT_AI_PROFILE);

  const initials = useMemo(() => {
    const source = dbUser?.fullName || dbUser?.username || user?.email || 'EN';
    return source
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }, [dbUser, user]);

  useEffect(() => {
    if (dbUser) {
      setLocalPrefs(mergePreferences(dbUser.preferences));
      setEditProfile({ fullName: dbUser.fullName || '', bio: dbUser.bio || '' });
    }
  }, [dbUser]);

  useEffect(() => {
    if (!user?.id) return;
    DbService.getTeacherPaymentSettings(user.id)
      .then((settings) => setRazorpayAccountId(settings.razorpay_account_id))
      .catch(() => setRazorpayAccountId(''));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    DbService.getAiProfileSettings(user.id)
      .then((profile) => setAiProfile(mergeAiProfile(profile)))
      .catch(() => setAiProfile(DEFAULT_AI_PROFILE));
  }, [user?.id]);

  if (authLoading) return null;
  if (!user) {
    router.push('/login');
    return null;
  }

  const updatePreference = async (section: PreferenceSection, key: string, value: any) => {
    const previousPrefs = localPrefs;
    const updatedPrefs = {
      ...localPrefs,
      [section]: {
        ...(localPrefs[section] as any),
        [key]: value,
      },
    } as UserPreferences;

    setLocalPrefs(updatedPrefs);
    try {
      await DbService.updatePreferences(user.id, updatedPrefs);
      if (key === 'showOnlineStatus') {
        DbService.updatePresence(user.id, value);
      }
      toast.success('Setting updated', { duration: 1200 });
    } catch (err) {
      setLocalPrefs(previousPrefs);
      toast.error('Could not save that setting. Please try again.');
    }
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving) return;

    const cleanProfile = {
      fullName: editProfile.fullName.trim(),
      bio: editProfile.bio.trim(),
    };

    if (!cleanProfile.fullName) {
      toast.error('Please enter your full name.');
      return;
    }

    setIsSaving(true);
    try {
      await DbService.updateProfile(user.id, cleanProfile);
      await refreshProfile();
      toast.success('Profile updated');
    } catch (err) {
      toast.error('Could not update your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePayouts = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSavingPayouts) return;

    setIsSavingPayouts(true);
    try {
      await DbService.updateTeacherPaymentSettings(user.id, {
        razorpay_account_id: razorpayAccountId,
      });
      toast.success('Payout settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save payout settings.');
    } finally {
      setIsSavingPayouts(false);
    }
  };

  const handleSaveAiProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSavingAiProfile) return;

    setIsSavingAiProfile(true);
    try {
      const normalizedTopics = (aiProfile.favoriteTopics || [])
        .map((topic) => topic.trim())
        .filter(Boolean)
        .slice(0, 8);

      await DbService.updateAiProfileSettings(user.id, {
        preferredName: aiProfile.preferredName?.trim() || null,
        preferredLanguage: aiProfile.preferredLanguage?.trim() || null,
        chatStyle: aiProfile.chatStyle || 'balanced',
        tone: aiProfile.tone || 'calm',
        vibe: aiProfile.vibe || 'cool',
        emojiStyle: aiProfile.emojiStyle || 'low',
        responseEnergy: aiProfile.responseEnergy || 'medium',
        favoriteTopics: normalizedTopics,
        summary: aiProfile.summary?.trim() || null,
        manualNotes: aiProfile.manualNotes?.trim() || null,
      });
      toast.success('AI memory updated');
    } catch (error) {
      toast.error('Could not save AI memory.');
    } finally {
      setIsSavingAiProfile(false);
    }
  };

  const handleRefreshAiMemory = async () => {
    if (isRefreshingAiProfile) return;

    setIsRefreshingAiProfile(true);
    toast.loading('Refreshing AI memory...', { id: 'ai-memory-refresh' });
    try {
      const response = await fetch('/api/ai/profile/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not refresh AI memory');
      }

      setAiProfile(mergeAiProfile(payload.aiProfile));
      toast.success('AI memory refreshed', { id: 'ai-memory-refresh' });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not refresh AI memory.', { id: 'ai-memory-refresh' });
    } finally {
      setIsRefreshingAiProfile(false);
    }
  };

  const sendVerification = async () => {
    if (!auth.currentUser) {
      toast.error('Please sign in again to verify your email.');
      return;
    }

    try {
      await sendEmailVerification(auth.currentUser);
      toast.success('Verification email sent.');
    } catch (err) {
      toast.error('Could not send verification email.');
    }
  };

  const openFeedback = (type: 'bug' | 'improvement') => {
    setFeedbackType(type);
    setShowFeedbackModal(true);
  };

  const submitFeedback = async () => {
    const text = feedbackText.trim();
    if (!text || isSendingFeedback) return;

    setIsSendingFeedback(true);
    setFeedbackText('');
    setShowFeedbackModal(false);
    toast.loading('Sending feedback...', { id: 'feedback-status' });

    try {
      const requestRef = push(ref(db, `user_settings/${user.id}/supportRequests`));
      await set(requestRef, {
        id: requestRef.key,
        category: feedbackType,
        title: feedbackType === 'bug' ? 'Bug Report' : 'Improvement',
        message: text,
        status: 'new',
        source: 'settings',
        username: dbUser?.username || 'student',
        email: user.email || '',
        createdAt: new Date().toISOString(),
      });
      toast.success('Feedback sent. Thank you.', { id: 'feedback-status' });
    } catch (err) {
      toast.error('Feedback could not be sent.', { id: 'feedback-status' });
    } finally {
      setIsSendingFeedback(false);
    }
  };

  const submitDeleteRequest = async () => {
    if (isSendingDeleteRequest) return;

    setIsSendingDeleteRequest(true);
    toast.loading('Saving deletion request...', { id: 'delete-request-status' });

    try {
      const requestRef = push(ref(db, `user_settings/${user.id}/accountDeletionRequests`));
      await set(requestRef, {
        id: requestRef.key,
        status: 'requested',
        reason: deleteRequestText.trim(),
        username: dbUser?.username || 'student',
        email: user.email || '',
        createdAt: new Date().toISOString(),
      });
      setDeleteRequestText('');
      setShowDeleteRequestModal(false);
      toast.success('Deletion request saved.', { id: 'delete-request-status' });
    } catch (err) {
      toast.error('Could not save the deletion request.', { id: 'delete-request-status' });
    } finally {
      setIsSendingDeleteRequest(false);
    }
  };

  return (
    <Layout showSettings={false} hideNavigation hideMobileNav hideHeader>
      <div className="min-h-screen bg-background">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          
          <button 
            onClick={() => router.push('/home')}
            className="group mb-8 flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-black uppercase tracking-widest">Back to Home</span>
          </button>

          <header className="mb-6 rounded-3xl border border-border bg-card/70 p-5 shadow-2xl shadow-black/10 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="mb-4 flex items-center gap-3 text-primary">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                    <AppWindow size={24} weight="duotone" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.24em]">Settings</span>
                </div>
                <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                  Your EduNook settings
                </h1>
                <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-muted-foreground sm:text-base">
                  Manage your profile, privacy, alerts, display, learning preferences, plan, and support from one simple page.
                </p>
              </div>

              <div className="flex w-full items-center gap-4 rounded-2xl border border-border bg-background/60 p-3 lg:max-w-sm">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-black text-primary">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-foreground">{dbUser?.fullName || 'EduNook learner'}</p>
                  <p className="truncate text-xs font-semibold text-muted-foreground">@{dbUser?.username || 'student'}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </div>

            <nav className="mt-6 flex gap-2 overflow-x-auto pb-1 premium-horizontal-scrollbar" aria-label="Settings sections">
              {navSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border border-border bg-background/60 px-4 py-2 text-sm font-bold text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <section.icon size={18} weight="duotone" />
                  {section.label}
                </a>
              ))}
            </nav>
          </header>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)] xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-5">
              <SettingsSection
                id="account"
                icon={<IdentificationCard size={24} weight="duotone" />}
                title="Account"
                description="Keep your public profile easy to recognize."
              >
                <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/10 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
                        <LockKey size={22} weight="duotone" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-foreground">Password and security</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Change your password any time after confirming your current password.
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/settings/change-password"
                      className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-xl shadow-primary/20 transition hover:bg-primary/90"
                    >
                      Change password
                      <CaretRight size={18} weight="bold" />
                    </Link>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Full name" htmlFor="settings-full-name">
                      <input
                        id="settings-full-name"
                        type="text"
                        value={editProfile.fullName}
                        onChange={(event) => setEditProfile((profile) => ({ ...profile, fullName: event.target.value }))}
                        className="settings-input"
                        placeholder="Enter your full name"
                        autoComplete="name"
                      />
                    </Field>
                    <div className="rounded-2xl border border-border bg-background/60 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Email</p>
                      <p className="mt-2 break-all text-sm font-bold text-foreground">{user.email}</p>
                    </div>
                  </div>

                  <Field label="Bio" htmlFor="settings-bio" hint="Short and friendly works best.">
                    <textarea
                      id="settings-bio"
                      value={editProfile.bio}
                      onChange={(event) => setEditProfile((profile) => ({ ...profile, bio: event.target.value }))}
                      className="settings-input min-h-32 resize-y"
                      placeholder="Tell others what you are learning or teaching..."
                      maxLength={180}
                    />
                  </Field>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="min-h-12 rounded-2xl bg-primary px-6 py-3 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 transition hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? 'Saving...' : 'Save profile'}
                    </button>
                  </div>
                </form>

                <form onSubmit={handleSavePayouts} className="mt-6 rounded-2xl border border-border bg-background/60 p-4">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <CreditCard size={22} weight="duotone" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-foreground">Teacher payouts</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Paid courses require your Razorpay linked account ID so checkout can route your share securely.
                      </p>
                    </div>
                  </div>

                  <Field label="Razorpay linked account ID" htmlFor="settings-razorpay-account" hint="Starts with acc_">
                    <input
                      id="settings-razorpay-account"
                      type="text"
                      value={razorpayAccountId}
                      onChange={(event) => setRazorpayAccountId(event.target.value.trim())}
                      className="settings-input"
                      placeholder="acc_..."
                      autoComplete="off"
                    />
                  </Field>

                  <button
                    type="submit"
                    disabled={isSavingPayouts}
                    className="mt-4 min-h-12 rounded-2xl bg-primary px-6 py-3 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 transition hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingPayouts ? 'Saving...' : 'Save payout settings'}
                  </button>
                </form>
              </SettingsSection>

              <SettingsSection
                id="privacy"
                icon={<Shield size={24} weight="duotone" />}
                title="Privacy"
                description="Choose what others can see and how they can contact you."
              >
                <div className="space-y-3">
                  <SettingSwitch
                    label="Show online status"
                    description="Let other learners know when you are active."
                    checked={localPrefs.privacy.showOnlineStatus}
                    onChange={(checked) => updatePreference('privacy', 'showOnlineStatus', checked)}
                  />
                  <SettingSwitch
                    label="Read receipts"
                    description="Show when you have seen chat messages."
                    checked={localPrefs.privacy.showReadReceipts}
                    onChange={(checked) => updatePreference('privacy', 'showReadReceipts', checked)}
                  />
                  <SettingSwitch
                    label="Messages from new people"
                    description="Allow direct messages from users you do not follow."
                    checked={localPrefs.privacy.allowStrangerMessages}
                    onChange={(checked) => updatePreference('privacy', 'allowStrangerMessages', checked)}
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                id="notifications"
                icon={<Bell size={24} weight="duotone" />}
                title="Notifications"
                description="Decide which updates deserve your attention."
              >
                <div className="space-y-3">
                  <SettingSwitch
                    label="New followers"
                    description="Get notified when someone follows your profile."
                    checked={localPrefs.notifications.followers}
                    onChange={(checked) => updatePreference('notifications', 'followers', checked)}
                  />
                  <SettingSwitch
                    label="Course updates"
                    description="Receive updates about courses you follow or publish."
                    checked={localPrefs.notifications.courseUpdates}
                    onChange={(checked) => updatePreference('notifications', 'courseUpdates', checked)}
                  />
                  <SettingSwitch
                    label="Quiz and test results"
                    description="Know when results, scores, and test updates are ready."
                    checked={localPrefs.notifications.quizResults}
                    onChange={(checked) => updatePreference('notifications', 'quizResults', checked)}
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                id="appearance"
                icon={<Palette size={24} weight="duotone" />}
                title="Display"
                description="Make EduNook comfortable to use in any environment."
              >
                <div className="space-y-3">
                  <SettingSwitch
                    label={`${theme === 'dark' ? 'Dark' : 'Light'} theme`}
                    description="Switch between a premium dark theme and a clean light theme."
                    checked={theme === 'dark'}
                    onChange={toggleTheme}
                    onIcon={<Moon size={14} weight="fill" />}
                    offIcon={<Wind size={14} weight="fill" />}
                  />
                  <SettingSwitch
                    label="Reduce motion"
                    description="Limit animations for a calmer interface."
                    checked={localPrefs.app.reduceAnimations}
                    onChange={(checked) => updatePreference('app', 'reduceAnimations', checked)}
                  />
                  <SettingSwitch
                    label="Data saver"
                    description="Prefer lighter media loading where supported."
                    checked={localPrefs.app.dataSaver}
                    onChange={(checked) => updatePreference('app', 'dataSaver', checked)}
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                id="help-legal"
                icon={<ShieldCheck size={24} weight="duotone" />}
                title="Help & Legal"
                description="Guide on how to use EduNook and our legal terms."
              >
                <div className="space-y-3">
                  <Link
                    href="/settings/legal"
                    className="flex items-center justify-between p-4 rounded-2xl border border-border bg-background/60 hover:bg-primary/5 hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <ShieldCheck size={20} weight="duotone" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-foreground">Guide & Agreements</p>
                        <p className="text-xs text-muted-foreground">Detailed help, platform tour, and legal terms.</p>
                      </div>
                    </div>
                    <CaretRight size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                </div>
              </SettingsSection>
            </div>

            <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
              <SettingsSection
                id="learning"
                icon={<BookOpen size={24} weight="duotone" />}
                title="Learning"
                description="Personalize recommendations and course language."
              >
                <div className="space-y-5">
                  <Field label="Preferred language" htmlFor="settings-language">
                    <select
                      id="settings-language"
                      value={localPrefs.learning.language}
                      onChange={(event) => updatePreference('learning', 'language', event.target.value)}
                      className="settings-input"
                    >
                      {['English', 'Hindi', 'Spanish', 'French', 'German', 'Japanese', 'Mandarin'].map((language) => (
                        <option key={language} value={language} className="bg-background text-foreground">
                          {language}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
                      Interests
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {learningCategories.map((category) => {
                        const selected = localPrefs.learning.categories.includes(category.id);
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => {
                              const current = localPrefs.learning.categories;
                              const next = selected
                                ? current.filter((item) => item !== category.id)
                                : [...current, category.id];
                              updatePreference('learning', 'categories', next);
                            }}
                            aria-pressed={selected}
                            className={`min-h-11 rounded-2xl border px-3 py-2 text-sm font-black transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                              selected
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-background/60 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                            }`}
                          >
                            {category.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <SettingSwitch
                    label="Personal suggestions"
                    description="Use your interests to improve course recommendations."
                    checked={localPrefs.learning.suggestions}
                    onChange={(checked) => updatePreference('learning', 'suggestions', checked)}
                  />
                </div>
              </SettingsSection>

              <SettingsSection
                id="ai-memory"
                icon={<Lightbulb size={24} weight="duotone" />}
                title="AI Memory"
                description="Fine-tune how EduNook AI remembers and talks to you."
              >
                <form onSubmit={handleSaveAiProfile} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Preferred name" htmlFor="settings-ai-preferred-name" hint="How the AI should address you.">
                      <input
                        id="settings-ai-preferred-name"
                        type="text"
                        value={aiProfile.preferredName || ''}
                        onChange={(event) => setAiProfile((current) => ({ ...current, preferredName: event.target.value }))}
                        className="settings-input"
                        placeholder="Optional nickname"
                      />
                    </Field>
                    <Field label="Preferred language" htmlFor="settings-ai-language" hint="Used as a default when your chat language is unclear.">
                      <input
                        id="settings-ai-language"
                        type="text"
                        value={aiProfile.preferredLanguage || ''}
                        onChange={(event) => setAiProfile((current) => ({ ...current, preferredLanguage: event.target.value }))}
                        className="settings-input"
                        placeholder="English, Hindi, Urdu..."
                      />
                    </Field>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Reply length" htmlFor="settings-ai-style">
                      <select
                        id="settings-ai-style"
                        value={aiProfile.chatStyle || 'balanced'}
                        onChange={(event) => setAiProfile((current) => ({ ...current, chatStyle: event.target.value as AiProfileSettings['chatStyle'] }))}
                        className="settings-input"
                      >
                        <option value="short">Short</option>
                        <option value="balanced">Balanced</option>
                        <option value="detailed">Detailed</option>
                      </select>
                    </Field>
                    <Field label="Tone" htmlFor="settings-ai-tone">
                      <select
                        id="settings-ai-tone"
                        value={aiProfile.tone || 'calm'}
                        onChange={(event) => setAiProfile((current) => ({ ...current, tone: event.target.value as AiProfileSettings['tone'] }))}
                        className="settings-input"
                      >
                        <option value="calm">Calm</option>
                        <option value="casual">Casual</option>
                        <option value="playful">Playful</option>
                        <option value="formal">Formal</option>
                      </select>
                    </Field>
                    <Field label="Vibe" htmlFor="settings-ai-vibe">
                      <select
                        id="settings-ai-vibe"
                        value={aiProfile.vibe || 'cool'}
                        onChange={(event) => setAiProfile((current) => ({ ...current, vibe: event.target.value as AiProfileSettings['vibe'] }))}
                        className="settings-input"
                      >
                        <option value="cool">Cool</option>
                        <option value="aesthetic">Aesthetic</option>
                        <option value="dark">Dark</option>
                        <option value="bright">Bright</option>
                        <option value="minimal">Minimal</option>
                      </select>
                    </Field>
                    <Field label="Emoji style" htmlFor="settings-ai-emoji">
                      <select
                        id="settings-ai-emoji"
                        value={aiProfile.emojiStyle || 'low'}
                        onChange={(event) => setAiProfile((current) => ({ ...current, emojiStyle: event.target.value as AiProfileSettings['emojiStyle'] }))}
                        className="settings-input"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </Field>
                    <Field label="Response energy" htmlFor="settings-ai-energy">
                      <select
                        id="settings-ai-energy"
                        value={aiProfile.responseEnergy || 'medium'}
                        onChange={(event) => setAiProfile((current) => ({ ...current, responseEnergy: event.target.value as AiProfileSettings['responseEnergy'] }))}
                        className="settings-input"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </Field>
                    <Field label="Favorite topics" htmlFor="settings-ai-topics" hint="Comma separated.">
                      <input
                        id="settings-ai-topics"
                        type="text"
                        value={(aiProfile.favoriteTopics || []).join(', ')}
                        onChange={(event) =>
                          setAiProfile((current) => ({
                            ...current,
                            favoriteTopics: event.target.value.split(',').map((topic) => topic.trim()).filter(Boolean),
                          }))
                        }
                        className="settings-input"
                        placeholder="coding, design, study"
                      />
                    </Field>
                  </div>

                  <Field label="AI memory summary" htmlFor="settings-ai-summary" hint="Editable long-term summary the AI can use in chat.">
                    <textarea
                      id="settings-ai-summary"
                      value={aiProfile.summary || ''}
                      onChange={(event) => setAiProfile((current) => ({ ...current, summary: event.target.value }))}
                      className="settings-input min-h-32 resize-y"
                      placeholder="Example: Usually prefers short replies in English, likes coding and aesthetic UI..."
                    />
                  </Field>

                  <Field label="Manual notes for the AI" htmlFor="settings-ai-manual-notes" hint="Private notes that shape how the AI responds.">
                    <textarea
                      id="settings-ai-manual-notes"
                      value={aiProfile.manualNotes || ''}
                      onChange={(event) => setAiProfile((current) => ({ ...current, manualNotes: event.target.value }))}
                      className="settings-input min-h-32 resize-y"
                      placeholder="Example: Talk casually, avoid overexplaining, mirror mixed Hindi-English."
                    />
                  </Field>

                  <div className="rounded-2xl border border-border bg-background/60 p-4 text-sm leading-6 text-muted-foreground">
                    EduNook AI updates this memory automatically from chat patterns, and you can override it here any time.
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="submit"
                      disabled={isSavingAiProfile}
                      className="min-h-12 rounded-2xl bg-primary px-6 py-3 text-sm font-black text-primary-foreground shadow-xl shadow-primary/20 transition hover:bg-primary/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingAiProfile ? 'Saving...' : 'Save AI memory'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRefreshAiMemory}
                      disabled={isRefreshingAiProfile}
                      className="min-h-12 rounded-2xl border border-border bg-background/60 px-6 py-3 text-sm font-black text-foreground transition hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRefreshingAiProfile ? 'Refreshing...' : 'Refresh from past chats'}
                    </button>
                  </div>
                </form>
              </SettingsSection>

              <SettingsSection
                id="subscription"
                icon={<CreditCard size={24} weight="duotone" />}
                title="Plan"
                description="Review your current EduNook access."
              >
                <div className="rounded-3xl border border-primary/20 bg-primary/10 p-5">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-black text-white">
                      {(dbUser?.subscription?.planId || 'spark').toUpperCase()}
                    </span>
                    <span className="text-xs font-black text-primary">Active plan</span>
                  </div>
                  <h3 className="text-2xl font-black tracking-tight text-foreground">
                    {dbUser?.subscription?.planId === 'edge' ? 'EduNook Edge' : 'EduNook Spark'}
                  </h3>
                  <ul className="mt-4 space-y-2">
                    {(dbUser?.subscription?.planId === 'edge'
                      ? ['Advanced AI analytics', 'Unlimited communications', 'Priority support']
                      : ['Basic learning', 'Public profile', 'Standard tests']
                    ).map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <SealCheck size={17} weight="fill" className="text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/subscription"
                    className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-xl shadow-primary/20 transition hover:bg-primary/90"
                  >
                    Manage plan
                    <CaretRight size={18} weight="bold" />
                  </Link>
                </div>
              </SettingsSection>

              <SettingsSection
                id="help"
                icon={<ChatCircleDots size={24} weight="duotone" />}
                title="Help"
                description="Report issues or share improvement ideas."
              >
                <div className="space-y-3">
                  <FeedbackButton
                    icon={<Bug size={22} weight="duotone" />}
                    title="Report a bug"
                    description="Tell us what broke and where it happened."
                    onClick={() => openFeedback('bug')}
                  />
                  <FeedbackButton
                    icon={<Lightbulb size={22} weight="duotone" />}
                    title="Suggest an improvement"
                    description="Share an idea that would make EduNook better."
                    onClick={() => openFeedback('improvement')}
                  />
                </div>

                <div className="mt-5 rounded-2xl border border-border bg-background/60 p-4 text-center">
                  <DeviceMobile size={34} weight="duotone" className="mx-auto mb-3 text-primary" />
                  <p className="text-sm font-black text-foreground">EduNook Web</p>
                  <p className="mt-1 text-xs text-muted-foreground">Build: communications-hub-final</p>
                  <p className="mt-4 text-xs font-semibold leading-5 text-muted-foreground">
                    Use the report and suggestion buttons above to send support requests inside EduNook.
                  </p>
                </div>
              </SettingsSection>

              <button
                type="button"
                onClick={() => setShowSignOutModal(true)}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-3xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-black text-rose-500 transition hover:bg-rose-500 hover:text-white"
              >
                <SignOut size={20} weight="duotone" />
                Sign out
              </button>
            </aside>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showSignOutModal && (
          <Modal onClose={() => setShowSignOutModal(false)} labelledBy="signout-title">
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-500/10 text-rose-500">
                <SignOut size={34} weight="duotone" />
              </div>
              <h2 id="signout-title" className="text-2xl font-black tracking-tight text-foreground">
                Sign out?
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                You will leave this session and can sign in again whenever you are ready.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setShowSignOutModal(false)}
                  className="min-h-12 rounded-2xl border border-border bg-background/60 px-5 py-3 text-sm font-black text-foreground transition hover:bg-muted/40"
                >
                  Stay signed in
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  className="min-h-12 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-black text-white transition hover:bg-rose-600"
                >
                  Sign out
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFeedbackModal && (
          <Modal onClose={() => setShowFeedbackModal(false)} labelledBy="feedback-title" maxWidth="max-w-lg">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                  {feedbackType === 'bug' ? <Bug size={24} weight="duotone" /> : <Lightbulb size={24} weight="duotone" />}
                </div>
                <div>
                  <h2 id="feedback-title" className="text-xl font-black tracking-tight text-foreground">
                    {feedbackType === 'bug' ? 'Report a bug' : 'Suggest an improvement'}
                  </h2>
                  <p className="text-sm text-muted-foreground">Your feedback helps improve EduNook.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackModal(false)}
                aria-label="Close feedback dialog"
                className="rounded-2xl p-2 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
              >
                <X size={22} />
              </button>
            </div>

            <Field label="Message" htmlFor="feedback-message">
              <textarea
                id="feedback-message"
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value)}
                placeholder={feedbackType === 'bug' ? 'What happened? Include the page and steps if you can.' : 'What should work better?'}
                className="settings-input min-h-44 resize-y"
                autoFocus
              />
            </Field>

            <button
              type="button"
              onClick={submitFeedback}
              disabled={!feedbackText.trim() || isSendingFeedback}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-xl shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSendingFeedback ? 'Sending...' : 'Send feedback'}
              <ArrowRight size={18} weight="bold" />
            </button>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDeleteRequestModal && (
          <Modal onClose={() => setShowDeleteRequestModal(false)} labelledBy="delete-request-title" maxWidth="max-w-lg">
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
                <WarningCircle size={26} weight="fill" />
              </div>
              <div>
                <h2 id="delete-request-title" className="text-xl font-black tracking-tight text-foreground">
                  Request account deletion
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  This saves a deletion request in your account settings. Your account is not deleted immediately.
                </p>
              </div>
            </div>

            <Field label="Reason (optional)" htmlFor="delete-request-message">
              <textarea
                id="delete-request-message"
                value={deleteRequestText}
                onChange={(event) => setDeleteRequestText(event.target.value)}
                placeholder="Tell us anything important before deletion..."
                className="settings-input min-h-32 resize-y"
                autoFocus
              />
            </Field>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setShowDeleteRequestModal(false)}
                className="min-h-12 rounded-2xl border border-border bg-background/60 px-5 py-3 text-sm font-black text-foreground transition hover:bg-muted/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDeleteRequest}
                disabled={isSendingDeleteRequest}
                className="min-h-12 rounded-2xl bg-rose-500 px-5 py-3 text-sm font-black text-white transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSendingDeleteRequest ? 'Saving...' : 'Save request'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </Layout>
  );
}

function SettingsSection({
  id,
  icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-3xl border border-border bg-card/70 p-5 shadow-2xl shadow-black/10 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-black tracking-tight text-foreground">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-black text-foreground">
          {label}
        </label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function SettingSwitch({
  label,
  description,
  checked,
  onChange,
  onIcon,
  offIcon,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onIcon?: React.ReactNode;
  offIcon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h3 className="text-sm font-black text-foreground">{label}</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-16 shrink-0 rounded-full p-1 transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${
          checked ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <motion.span
          animate={{ x: checked ? 32 : 0 }}
          transition={{ type: 'spring', stiffness: 450, damping: 30 }}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-primary shadow-lg"
        >
          {checked ? onIcon : offIcon}
        </motion.span>
      </button>
    </div>
  );
}

function FeedbackButton({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 rounded-2xl border border-border bg-background/60 p-4 text-left transition hover:border-primary/30 hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-black text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <ArrowRight size={18} weight="bold" className="shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </button>
  );
}

function Modal({
  children,
  onClose,
  labelledBy,
  maxWidth = 'max-w-md',
}: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy: string;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <motion.button
        type="button"
        aria-label="Close dialog"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-xl"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-7 ${maxWidth}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
