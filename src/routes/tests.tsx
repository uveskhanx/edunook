/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { DbService, TestRow, Profile, Question, TestAttempt } from '@/lib/db-service';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/use-auth';
import { 
  ClipboardList, Plus, Search as SearchIcon, ArrowRight, User, 
  Sparkles, Clock, Target, TrendingUp, Zap, 
  ChevronRight, ChevronLeft, CheckCircle2, AlertCircle,
  Timer, Award, History, Play, Loader2, Trophy, MoreHorizontal,
  PlusCircle, Trash2, Save, X as CloseIcon, Flame, Monitor,
  Star, LayoutGrid, Activity, Globe, ShieldCheck, Heart, Smile,
  Calendar, Hourglass, Power
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// UI Components
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { LeaderboardModal } from '@/components/LeaderboardModal';

export const Route = createFileRoute('/tests')({
  head: () => ({
    meta: [
      { title: 'Global Assessment Hub — EduNook' },
    ],
  }),
  component: TestsPage,
});

type TabType = 'all' | 'active' | 'upcoming' | 'expired';

function TestsPage() {
  const { user, dbUser } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState<(TestRow & { profiles?: Profile | null })[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRankTest, setSelectedRankTest] = useState<TestRow | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [globalStats, setGlobalStats] = useState({ experts: 0, enrollments: 0, trophies: 0 });

  // Real-time Tests Listener
  useEffect(() => {
    const unsubscribe = DbService.subscribeToTests((data) => {
      setTests(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Attempts Listener (if logged in)
  useEffect(() => {
    if (user) {
      DbService.getTestAttempts(user.id).then(setAttempts);
    }
    // Fetch global stats
    DbService.getGlobalStats().then(setGlobalStats);
  }, [user]);

  const filteredTests = useMemo(() => {
    const now = new Date();
    const base = tests.filter(t => {
      const q = searchQuery.toLowerCase();
      return (t.title || '').toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
    });

    if (activeTab === 'active') {
      return base.filter(t => (!t.activeStartAt || new Date(t.activeStartAt) <= now) && (!t.expiresAt || new Date(t.expiresAt) >= now));
    }
    if (activeTab === 'upcoming') {
      return base.filter(t => t.activeStartAt && new Date(t.activeStartAt) > now);
    }
    if (activeTab === 'expired') {
      return base.filter(t => t.expiresAt && new Date(t.expiresAt) < now);
    }
    return base;
  }, [tests, searchQuery, activeTab]);

  const startQuiz = (test: TestRow) => {
    if (!user) {
      toast.error('Please sign in to start the quiz!');
      return;
    }
    const now = new Date();
    if (test.activeStartAt && new Date(test.activeStartAt) > now) {
      toast.error(`This quiz starts on ${new Date(test.activeStartAt).toLocaleString()}`);
      return;
    }
    if (test.expiresAt && new Date(test.expiresAt) < now) {
      toast.error('This quiz has expired.');
      return;
    }
    navigate({ to: '/test/$slug', params: { slug: test.slug || test.id } });
  };

  const getStatus = (test: TestRow) => {
    const now = new Date();
    if (test.expiresAt && new Date(test.expiresAt) < now) return 'expired';
    if (test.activeStartAt && new Date(test.activeStartAt) > now) return 'upcoming';
    return 'active';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-48 gap-6">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm font-bold text-white/40 tracking-[0.3em] uppercase">Opening Assessments...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="relative overflow-hidden min-h-screen bg-[#050505]">
        {/* Soft Background Orbs */}
        <div className="absolute top-[10%] left-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[-10%] w-[60%] h-[60%] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-[1400px] mx-auto px-4 md:px-12 py-10 md:py-24 space-y-16 md:space-y-32 relative z-10">
          
          {/* HERO SECTION */}
          <div className="space-y-8 md:space-y-12">
            <motion.div 
               initial={{ opacity: 0, y: 30 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex flex-col gap-6 md:gap-10"
            >
              <div className="flex items-center gap-3 text-primary">
                <ShieldCheck className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.4em] text-primary/80">Assessment Infrastructure</span>
              </div>
              <h1 className="text-5xl md:text-[120px] font-black text-white tracking-tighter leading-[0.8] uppercase">Quizzes</h1>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10 border-l-4 border-primary/20 pl-6 md:pl-12">
                <p className="text-lg md:text-3xl text-white/50 font-medium max-w-2xl leading-relaxed">
                   The global standard for knowledge verification. Participate in <span className="text-white font-black italic">Active Challenges</span> and earn certified standings.
                </p>
                {user && (
                  <button 
                    onClick={() => setShowCreator(true)}
                    className="group relative flex items-center justify-center gap-4 px-10 py-5 md:px-12 md:py-7 bg-primary text-white font-black text-[10px] md:text-sm rounded-2xl md:rounded-[2rem] hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(59,130,246,0.3)] uppercase tracking-[0.2em] w-full md:w-auto"
                  >
                    <Plus className="w-5 h-5 md:w-6 md:h-6 group-hover:rotate-90 transition-transform duration-500" />
                    Host Assessment
                  </button>
                )}
              </div>
            </motion.div>

            {/* QUICK STATS - Hide on mobile if too crowded or use 2x2 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
               {[
                 { label: 'Assessments', val: tests.length, icon: LayoutGrid, color: 'text-primary' },
                 { label: 'Educators', val: globalStats.experts, icon: ShieldCheck, color: 'text-emerald-400' },
                 { label: 'Candidates', val: globalStats.enrollments, icon: Smile, color: 'text-blue-400' },
                 { label: 'Certifications', val: globalStats.trophies, icon: Trophy, color: 'text-amber-400' },
               ].map((stat, i) => (
                 <motion.div 
                   key={i}
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   transition={{ delay: 0.2 + (i * 0.05) }}
                   className="p-6 md:p-10 bg-white/[0.03] backdrop-blur-3xl rounded-[2rem] md:rounded-[2.5rem] border border-white/5 flex flex-col justify-between group hover:bg-white/[0.05] transition-all"
                 >
                    <stat.icon className={`w-5 h-5 md:w-8 md:h-8 ${stat.color} mb-4 md:mb-6 opacity-50 group-hover:opacity-100 transition-opacity`} />
                    <div>
                      <p className="text-2xl md:text-6xl font-black text-white tracking-tighter tabular-nums mb-0.5 md:mb-1">{stat.val}</p>
                      <p className="text-[8px] md:text-[10px] font-black uppercase text-white/30 tracking-widest leading-none">{stat.label}</p>
                    </div>
                 </motion.div>
               ))}
            </div>
          </div>

          {/* TAB SYSTEM & SEARCH */}
          <div className="space-y-10 md:space-y-12">
            <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-6 md:gap-10">
               {/* Fixed Segmented Tabs for Mobile */}
               <div className="grid grid-cols-2 md:flex md:items-center gap-2 md:gap-4 bg-white/5 p-1.5 md:p-2 rounded-2xl md:rounded-[2rem] border border-white/5">
                  {[
                    { id: 'all', label: 'All', icon: Globe },
                    { id: 'active', label: 'Active', icon: Power, color: 'text-emerald-400' },
                    { id: 'upcoming', label: 'Upcoming', icon: Calendar, color: 'text-primary' },
                    { id: 'expired', label: 'Expired', icon: Hourglass, color: 'text-rose-400' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabType)}
                      className={`flex items-center justify-center md:justify-start gap-2 md:gap-3 px-4 py-3 md:px-8 md:py-4 rounded-xl md:rounded-[1.5rem] font-black text-[9px] md:text-[10px] uppercase tracking-widest transition-all ${
                        activeTab === tab.id ? 'bg-white text-black shadow-2xl' : 'text-white/40 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <tab.icon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${activeTab === tab.id ? 'text-black' : (tab.color || 'text-white/40')}`} />
                      {tab.label}
                    </button>
                  ))}
               </div>
               
               <div className="w-full xl:w-[400px] relative group">
                 <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-white/20 group-focus-within:text-primary transition-colors" />
                 <input 
                   type="text" 
                   placeholder="Search assessments..."
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   className="w-full pl-16 pr-8 py-5 md:py-6 bg-white/[0.03] border border-white/5 rounded-2xl md:rounded-[2.5rem] text-sm md:text-base text-white font-bold placeholder:text-white/10 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all"
                 />
               </div>
            </div>

            {/* QUIZ LIST - Smaller Mobile Cards */}
            <div className="space-y-4 md:space-y-6">
              {filteredTests.map((test, index) => {
                const status = getStatus(test);
                return (
                  <motion.div 
                    key={test.id} 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`group relative p-5 md:p-8 bg-white/[0.01] backdrop-blur-3xl rounded-[2rem] md:rounded-[3rem] border border-white/5 hover:border-primary/40 hover:bg-white/[0.03] transition-all duration-500 flex flex-col md:flex-row md:items-center gap-5 md:gap-8 overflow-hidden`}
                  >
                    <div className="relative z-10 flex flex-row md:items-center gap-5 md:gap-8 flex-1 min-w-0">
                      {/* Status Avatar - Smaller on mobile */}
                      <div className="relative shrink-0">
                         <div className={`w-14 h-14 md:w-24 md:h-24 rounded-2xl md:rounded-[2rem] flex items-center justify-center border-2 transition-all duration-500 ${
                           status === 'active' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 
                           status === 'upcoming' ? 'bg-primary/10 border-primary/20 text-primary' : 
                           'bg-rose-500/10 border-rose-500/20 text-rose-400'
                         }`}>
                           {status === 'active' ? <Power className="w-6 h-6 md:w-10 md:h-10 animate-pulse" /> : status === 'upcoming' ? <Calendar className="w-6 h-6 md:w-10 md:h-10" /> : <Hourglass className="w-6 h-6 md:w-10 md:h-10" />}
                         </div>
                      </div>

                      {/* Main Info - Compact Mobile Layout */}
                      <div className="flex-1 min-w-0 space-y-1.5 md:space-y-4">
                         <div className="flex flex-wrap items-center gap-2 md:gap-4">
                            <span className="text-[8px] md:text-[10px] font-black text-primary uppercase tracking-[0.2em] md:tracking-[0.3em] flex items-center gap-1.5">
                               <User className="w-3 md:w-3.5 h-3 md:h-3.5" /> {test.profiles?.fullName?.split(' ')[0] || 'Expert'}
                            </span>
                            <div className="hidden md:block w-1 h-1 rounded-full bg-white/10" />
                            <span className="text-[8px] md:text-[10px] font-black text-white/30 uppercase tracking-[0.2em] md:tracking-[0.3em] flex items-center gap-1.5">
                               <Timer className="w-3 md:w-3.5 h-3 md:h-3.5" /> {test.timeLimit}m
                            </span>
                         </div>
                         
                         <h3 className="text-lg md:text-5xl font-black text-white tracking-tight md:tracking-tighter group-hover:text-primary transition-colors leading-tight">
                           {test.title}
                         </h3>
                         <p className="text-white/40 font-medium text-[10px] md:text-lg leading-relaxed line-clamp-1 md:line-clamp-none">
                           {test.description || "Mission brief active."}
                         </p>
                      </div>

                      {/* Actions Area - Better Mobile Arrangement */}
                      <div className="flex items-center gap-2 md:gap-4 shrink-0 self-center md:self-auto">
                        <button
                          onClick={() => setSelectedRankTest(test)}
                          className="w-10 h-10 md:w-16 md:h-16 flex items-center justify-center bg-white/[0.03] text-white/20 rounded-xl md:rounded-[1.5rem] border border-white/5 hover:bg-amber-500/10 hover:text-amber-400 transition-all"
                        >
                          <Trophy className="w-4 h-4 md:w-7 md:h-7" />
                        </button>
                        <button 
                          onClick={() => startQuiz(test)}
                          className={`h-10 md:h-16 px-5 md:px-12 rounded-xl md:rounded-[1.5rem] font-black text-[9px] md:text-xs uppercase tracking-widest transition-all flex items-center gap-2 md:gap-4 ${
                            status === 'active' ? 'bg-white text-black hover:bg-primary hover:text-white' : 'bg-white/5 text-white/20'
                          }`}
                        >
                          {status === 'active' ? (window.innerWidth < 768 ? 'Play' : 'Enter Arena') : status === 'upcoming' ? 'Locked' : 'Closed'} <ArrowRight className="w-3.5 h-3.5 md:w-5 md:h-5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <LeaderboardModal test={selectedRankTest} onClose={() => setSelectedRankTest(null)} />
      <CinematicQuizCreator isOpen={showCreator} onClose={() => setShowCreator(false)} />
    </Layout>
  );
}


// --------------------------------------------------------------------------
// QUIZ CREATOR COMPONENT
// --------------------------------------------------------------------------
function CinematicQuizCreator({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, dbUser } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [quizData, setQuizData] = useState({
    title: '',
    description: '',
    timeLimit: 10,
    theme: 'dark' as 'dark' | 'neon' | 'gradient',
    questions: [] as any[],
    activeStartAt: '',
    expiresAt: '',
    resultAnnounceAt: 'immediate'
  });

  const [currentQ, setCurrentQ] = useState({
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    hint: ''
  });

  const addQuestion = () => {
    if (!currentQ.questionText.trim()) {
      toast.error('Please write the question!');
      return;
    }
    if (currentQ.options.some(o => !o.trim())) {
      toast.error('Please fill in all 4 choices!');
      return;
    }
    setQuizData({ ...quizData, questions: [...quizData.questions, currentQ] });
    setCurrentQ({ questionText: '', options: ['', '', '', ''], correctAnswer: 0, hint: '' });
    toast.success(`Question added!`);
  };

  const removeQuestion = (idx: number) => {
    setQuizData({ ...quizData, questions: quizData.questions.filter((_, i) => i !== idx) });
  };

  const handleCreate = async () => {
    if (!user) return;
    if (quizData.questions.length === 0) {
      toast.error('Add at least one question first!');
      return;
    }
    
    setSubmitting(true);
    try {
      const qMap: any = {};
      quizData.questions.forEach((q, i) => {
        qMap[`q${i + 1}`] = q;
      });

      await DbService.createTest(user.id, {
        title: quizData.title,
        description: quizData.description,
        timeLimit: quizData.timeLimit,
        theme: quizData.theme,
        totalQuestions: quizData.questions.length,
        questions: qMap,
        activeStartAt: quizData.activeStartAt || undefined,
        expiresAt: quizData.expiresAt || undefined,
        resultAnnounceAt: quizData.resultAnnounceAt === 'immediate' ? undefined : quizData.resultAnnounceAt
      });

      toast.success('Your assessment is live! Standings are now active.');
      onClose();
      // Reset
      setStep(1);
      setQuizData({ title: '', description: '', timeLimit: 10, theme: 'dark', questions: [], activeStartAt: '', expiresAt: '', resultAnnounceAt: 'immediate' });
    } catch (err) {
      toast.error('Failed to initialize assessment.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black overflow-y-auto custom-scrollbar">
      <AnimatePresence mode="wait">
        <motion.div 
          key={step}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          className="min-h-screen flex flex-col"
        >
          {/* Header */}
          <div className="h-20 md:h-24 px-6 md:px-12 flex items-center justify-between border-b border-white/5 backdrop-blur-3xl sticky top-0 z-50">
             <div className="flex items-center gap-4 md:gap-6">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-xl md:rounded-2xl flex items-center justify-center">
                   <Plus className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <h4 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter">Assessment Initialization</h4>
             </div>

             <button 
               onClick={onClose}
               className="p-3 md:p-4 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl hover:bg-red-500/10 hover:text-red-500 transition-all"
             >
               <CloseIcon className="w-5 h-5 md:w-6 md:h-6" />
             </button>
          </div>

          <div className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-12 md:py-24">
            
            {step === 1 ? (
              <div className="space-y-12 md:space-y-16">
                 <div className="space-y-3 md:space-y-4">
                    <h1 className="text-4xl md:text-8xl font-black text-white tracking-tighter uppercase">Step 1</h1>
                    <p className="text-lg md:text-xl text-white/40 font-medium">Define the parameters of your assessment.</p>
                 </div>

                 {/* Quiz Title */}
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Assessment Title</Label>
                    <input 
                      autoFocus
                      placeholder="e.g. Advanced System Architecture" 
                      value={quizData.title}
                      maxLength={60}
                      onChange={e => setQuizData({ ...quizData, title: e.target.value })}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 md:py-6 px-6 md:px-8 text-xl md:text-2xl font-black focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10"
                    />
                 </div>

                 {/* Quiz Description */}
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Mission Brief (Description)</Label>
                    <textarea 
                      placeholder="Explain the objectives of this assessment..." 
                      value={quizData.description}
                      onChange={e => setQuizData({ ...quizData, description: e.target.value })}
                      className="w-full h-32 md:h-48 bg-white/[0.03] border border-white/10 rounded-2xl py-6 px-8 text-lg font-medium focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10 resize-none"
                    />
                 </div>

                 {/* Scheduling Section */}
                 <div className="space-y-6">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">📅 Timing Configuration</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                          <Label className="text-xs font-bold text-white/50 flex items-center gap-2">
                             <Play className="w-4 h-4 text-emerald-400" /> Availability Start
                          </Label>
                          <input 
                            type="datetime-local"
                            value={quizData.activeStartAt}
                            onChange={e => setQuizData({ ...quizData, activeStartAt: e.target.value })}
                            className="w-full bg-white/[0.05] border border-white/10 rounded-xl py-4 px-5 text-base font-bold text-white focus:outline-none focus:border-primary/50 transition-all [color-scheme:dark]"
                          />
                       </div>
                       <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                          <Label className="text-xs font-bold text-white/50 flex items-center gap-2">
                             <Timer className="w-4 h-4 text-rose-400" /> Deadline Date
                          </Label>
                          <input 
                            type="datetime-local"
                            value={quizData.expiresAt}
                            onChange={e => setQuizData({ ...quizData, expiresAt: e.target.value })}
                            className="w-full bg-white/[0.05] border border-white/10 rounded-xl py-4 px-5 text-base font-bold text-white focus:outline-none focus:border-rose-500/50 transition-all [color-scheme:dark]"
                          />
                       </div>
                    </div>
                 </div>

                 {/* Results Announcement */}
                 <div className="space-y-6">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">📊 Result Protocols</Label>
                    <div className="grid grid-cols-2 gap-4">
                       <button
                          onClick={() => setQuizData({ ...quizData, resultAnnounceAt: 'immediate' })}
                          className={`p-6 rounded-2xl border text-left transition-all ${
                             quizData.resultAnnounceAt === 'immediate'
                               ? 'bg-emerald-500/10 border-emerald-500/30 ring-2 ring-emerald-500/40'
                               : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                          }`}
                       >
                          <Zap className={`w-6 h-6 mb-3 ${quizData.resultAnnounceAt === 'immediate' ? 'text-emerald-400' : 'text-white/20'}`} />
                          <p className="text-sm font-black text-white">Instant Reveal</p>
                          <p className="text-[10px] text-white/30 font-bold mt-1">Standings update after each submission.</p>
                       </button>
                       <button
                          onClick={() => setQuizData({ ...quizData, resultAnnounceAt: '' })}
                          className={`p-6 rounded-2xl border text-left transition-all ${
                             quizData.resultAnnounceAt !== 'immediate'
                               ? 'bg-amber-500/10 border-amber-500/30 ring-2 ring-amber-500/40'
                               : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                          }`}
                       >
                          <Clock className={`w-6 h-6 mb-3 ${quizData.resultAnnounceAt !== 'immediate' ? 'text-amber-400' : 'text-white/20'}`} />
                          <p className="text-sm font-black text-white">Scheduled Reveal</p>
                          <p className="text-[10px] text-white/30 font-bold mt-1">Unlock standings at a specific timestamp.</p>
                       </button>
                    </div>

                    {quizData.resultAnnounceAt !== 'immediate' && (
                      <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-3">
                         <Label className="text-xs font-bold text-amber-400/80 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Reveal Timestamp
                         </Label>
                         <input 
                            type="datetime-local"
                            value={quizData.resultAnnounceAt}
                            onChange={e => setQuizData({ ...quizData, resultAnnounceAt: e.target.value })}
                            className="w-full bg-white/[0.05] border border-amber-500/20 rounded-xl py-4 px-5 text-base font-bold text-amber-300 focus:outline-none focus:border-amber-500/50 transition-all [color-scheme:dark]"
                         />
                      </div>
                    )}
                 </div>

                 <div className="pt-10 flex flex-col md:flex-row justify-between items-center gap-8 border-t border-white/5">
                    <div className="flex flex-col items-center md:items-start">
                       <span className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-2">Assessment Duration</span>
                       <div className="flex items-center gap-4">
                          <input 
                             type="number" 
                             value={quizData.timeLimit}
                             onChange={e => setQuizData({ ...quizData, timeLimit: parseInt(e.target.value) || 0 })}
                             className="w-20 bg-white/5 border border-white/10 rounded-xl py-3 text-center font-black text-2xl focus:border-primary/50"
                          />
                          <span className="font-black text-white/30">Minutes</span>
                       </div>
                    </div>
                    <button 
                      onClick={() => setStep(2)}
                      disabled={!quizData.title.trim()}
                      className="w-full md:w-auto px-16 py-7 bg-white text-black font-black rounded-[2rem] hover:scale-105 active:scale-95 transition-all uppercase tracking-widest shadow-2xl disabled:opacity-20 text-sm"
                    >
                      Next: Build Syllabus
                    </button>
                 </div>
              </div>
            ) : (
              <div className="space-y-12 md:space-y-16">
                 <div className="space-y-3 md:space-y-4">
                    <h1 className="text-4xl md:text-8xl font-black text-white tracking-tighter uppercase">Step 2</h1>
                    <p className="text-lg md:text-xl text-white/40 font-medium">Engineer the assessment questions.</p>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
                    {/* List */}
                    <div className="space-y-6">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Syllabus Modules ({quizData.questions.length})</Label>
                       <div className="space-y-4 max-h-[400px] md:max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                          {quizData.questions.length > 0 ? (
                            quizData.questions.map((q, i) => (
                              <div key={i} className="p-8 bg-white/[0.03] border border-white/5 rounded-[2.5rem] flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                                 <div className="space-y-1">
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">MODULE {i + 1}</p>
                                    <p className="text-lg font-bold text-white line-clamp-1">{q.questionText}</p>
                                 </div>
                                 <button onClick={() => removeQuestion(i)} className="p-3 rounded-lg bg-red-500/10 text-red-500 border border-red-500/10 transition-all">
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                            ))
                          ) : (
                            <div className="py-20 text-center border-2 border-white/5 border-dashed rounded-3xl opacity-20">
                               <p className="text-xs font-black uppercase tracking-widest">Engineering required. Add a module.</p>
                            </div>
                          )}
                       </div>
                    </div>

                    {/* Editor */}
                    <div className="space-y-8 p-10 bg-white/[0.02] border border-white/10 rounded-[3rem]">
                       <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Question Context</Label>
                          <Input 
                            placeholder="Enter the question text..." 
                            value={currentQ.questionText}
                            onChange={e => setCurrentQ({ ...currentQ, questionText: e.target.value })}
                            className="rounded-2xl py-8 bg-white/[0.04] border-white/5 focus:border-primary/50 transition-all font-bold text-xl placeholder:text-white/10"
                          />
                       </div>

                       <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2 flex items-center gap-2">
                             <Sparkles className="w-3 h-3 text-primary" /> Strategy Clue (Hint)
                          </Label>
                          <Input 
                            placeholder="Optional strategy hint..." 
                            value={currentQ.hint}
                            onChange={e => setCurrentQ({ ...currentQ, hint: e.target.value })}
                            className="rounded-2xl py-4 bg-white/[0.02] border-white/5 focus:border-primary/30 transition-all text-sm italic placeholder:text-white/10"
                          />
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {currentQ.options.map((opt, i) => (
                             <div key={i} className="space-y-2">
                                <Label className={`text-[9px] font-black uppercase tracking-widest ml-2 transition-colors ${currentQ.correctAnswer === i ? 'text-emerald-400' : 'text-white/20'}`}>Choice {String.fromCharCode(65 + i)}</Label>
                                <div className="relative">
                                  <input 
                                    placeholder={`Choice ${i+1}`}
                                    value={opt}
                                    onChange={e => {
                                      const newOpts = [...currentQ.options];
                                      newOpts[i] = e.target.value;
                                      setCurrentQ({ ...currentQ, options: newOpts });
                                    }}
                                    className={`w-full bg-white/[0.03] border rounded-2xl py-5 px-6 text-sm font-bold focus:outline-none transition-all placeholder:text-white/10 ${
                                      currentQ.correctAnswer === i 
                                        ? 'border-emerald-500/50 bg-emerald-500/5' 
                                        : 'border-white/5 hover:border-white/20'
                                    }`}
                                  />
                                  <button 
                                    onClick={() => setCurrentQ({ ...currentQ, correctAnswer: i })}
                                    className={`absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                                      currentQ.correctAnswer === i 
                                        ? 'bg-emerald-500 border-emerald-500' 
                                        : 'bg-white/5 border-white/10 hover:bg-white/20'
                                    }`}
                                  >
                                    <CheckCircle2 className={`w-4 h-4 text-white ${currentQ.correctAnswer === i ? 'opacity-100' : 'opacity-0'}`} />
                                  </button>
                                </div>
                             </div>
                          ))}
                       </div>

                       <button 
                         onClick={addQuestion}
                         className="w-full py-6 mt-4 border-2 border-primary text-primary hover:bg-primary hover:text-white rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-3"
                       >
                          <PlusCircle className="w-5 h-5" /> Commit Module
                       </button>
                    </div>
                 </div>

                 <div className="pt-10 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-white/5 pb-20">
                    <button 
                      onClick={() => setStep(1)}
                      className="w-full md:w-auto px-12 py-6 bg-white/5 text-white/40 border border-white/10 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:text-white transition-all"
                    >
                      Back to Configuration
                    </button>
                    
                    <button
                      onClick={handleCreate}
                      disabled={submitting || quizData.questions.length === 0}
                      className="w-full md:w-auto px-20 py-8 bg-primary text-white font-black rounded-[2.5rem] hover:scale-110 active:scale-95 transition-all uppercase tracking-widest shadow-2xl shadow-primary/30 disabled:opacity-20 text-sm"
                    >
                       {submitting ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Finalize & Launch'}
                    </button>
                 </div>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
