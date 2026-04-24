import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { DbService, TestRow, Profile, Question, TestAttempt } from '@/lib/db-service';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/hooks/use-auth';
import { 
  ClipboardList, Plus, Search as SearchIcon, ArrowRight, User, 
  Sparkles, Clock, Target, TrendingUp, Zap, 
  ChevronRight, ChevronLeft, CheckCircle2, AlertCircle,
  Timer, Award, History, Play, Loader2, Trophy, MoreHorizontal,
  PlusCircle, Trash2, Save, X as CloseIcon, Flame, Monitor,
  Star, LayoutGrid, Activity, Globe, ShieldCheck, Heart, Smile
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

export const Route = createFileRoute('/tests')({
  head: () => ({
    meta: [
      { title: 'Fun Quizzes — EduNook' },
    ],
  }),
  component: TestsPage,
});

function TestsPage() {
  const { user, dbUser } = useAuth();
  const navigate = useNavigate();
  const [tests, setTests] = useState<(TestRow & { profiles?: Profile | null })[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRankTest, setSelectedRankTest] = useState<TestRow | null>(null);
  const [showCreator, setShowCreator] = useState(false);
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

  const filteredTests = tests.filter(t => {
    const q = searchQuery.toLowerCase();
    const titleMatch = (t.title || '').toLowerCase().includes(q);
    return titleMatch;
  });

  const startQuiz = (test: TestRow) => {
    if (!user) {
      toast.error('Please sign in to start the quiz!');
      return;
    }
    navigate({ to: '/test/$slug', params: { slug: test.slug || test.id } });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-48 gap-6">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-sm font-bold text-white/40 tracking-[0.3em] uppercase">Opening Quizzes...</p>
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

        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16 md:py-24 space-y-24 md:space-y-32 relative z-10">
          
          {/* HERO SECTION */}
          <div className="space-y-12">
            <motion.div 
               initial={{ opacity: 0, y: 30 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex flex-col gap-8 md:gap-10"
            >
              <div className="flex items-center gap-3 text-primary">
                <Sparkles className="w-5 h-5" />
                <span className="text-xs font-black uppercase tracking-[0.4em] text-primary/80">Fun Learning Place</span>
              </div>
              <h1 className="text-6xl md:text-[120px] font-black text-white tracking-tighter leading-[0.8] uppercase">Quizzes</h1>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 border-l-4 border-primary/20 pl-8 md:pl-12">
                <p className="text-xl md:text-3xl text-white/50 font-medium max-w-2xl leading-relaxed">
                   Welcome to the best place to test your knowledge! Play <span className="text-white font-black italic">Challenges</span>, win <span className="text-primary font-black">Trophies</span>, and show everyone how smart you are.
                </p>
                {user && (
                  <button 
                    onClick={() => setShowCreator(true)}
                    className="group relative flex items-center justify-center gap-4 px-12 py-7 bg-primary text-white font-black text-sm rounded-[2rem] hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(59,130,246,0.3)] uppercase tracking-[0.2em] w-full md:w-auto"
                  >
                    <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
                    Make Your Own
                  </button>
                )}
              </div>
            </motion.div>

            {/* QUICK STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
               {[
                 { label: 'Live Quizzes', val: tests.length, icon: LayoutGrid, color: 'text-primary' },
                 { label: 'Smart Teachers', val: globalStats.experts, icon: ShieldCheck, color: 'text-emerald-400' },
                 { label: 'Happy Students', val: globalStats.enrollments, icon: Smile, color: 'text-blue-400' },
                 { label: 'Total Wins', val: globalStats.trophies, icon: Trophy, color: 'text-amber-400' },
               ].map((stat, i) => (
                 <motion.div 
                   key={i}
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   transition={{ delay: 0.2 + (i * 0.05) }}
                   className="p-8 md:p-10 bg-white/[0.03] backdrop-blur-3xl rounded-[2.5rem] border border-white/5 flex flex-col justify-between group hover:bg-white/[0.05] transition-all"
                 >
                    <stat.icon className={`w-8 h-8 ${stat.color} mb-6 opacity-50 group-hover:opacity-100 transition-opacity`} />
                    <div>
                      <p className="text-4xl md:text-6xl font-black text-white tracking-tighter tabular-nums mb-1">{stat.val}</p>
                      <p className="text-[10px] font-black uppercase text-white/30 tracking-widest">{stat.label}</p>
                    </div>
                 </motion.div>
               ))}
            </div>
          </div>

          {/* SEARCH & FILTERS */}
          <div className="space-y-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight flex items-center gap-6">
                All Quizzes
                <span className="text-sm bg-primary/10 text-primary px-5 py-2 rounded-2xl border border-primary/20">{filteredTests.length}</span>
              </h2>
              
              <div className="w-full md:w-[400px] relative group">
                <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-white/20 group-focus-within:text-primary transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search for a quiz..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-16 pr-8 py-6 bg-white/[0.03] border border-white/5 rounded-[2rem] text-white font-bold placeholder:text-white/10 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all"
                />
              </div>
            </div>

            {/* QUIZ LIST (Ultra-Premium Professional Layout) */}
            <div className="space-y-3 md:space-y-4">
              {filteredTests.map((test, index) => (
                <motion.div 
                  key={test.id} 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="group relative p-3 md:p-6 bg-white/[0.01] backdrop-blur-2xl rounded-2xl md:rounded-[1.5rem] border border-white/5 hover:border-primary/40 hover:bg-white/[0.03] transition-all duration-500 flex flex-col md:flex-row md:items-center gap-3 md:gap-6 overflow-hidden"
                >
                  {/* Subtle Numbering - Hidden on mobile to save space */}
                  <div className="hidden md:flex shrink-0 w-12 h-12 items-center justify-center border border-white/5 rounded-xl bg-white/[0.02] group-hover:border-primary/20 transition-all">
                    <span className="text-xs font-black text-white/20 group-hover:text-primary/40 transition-colors">{String(index + 1).padStart(2, '0')}</span>
                  </div>

                  <div className="relative z-10 flex flex-row items-center gap-4 md:gap-6 flex-1 min-w-0">
                    {/* Main Content Area */}
                    <div className="flex-1 min-w-0 space-y-1 md:space-y-2">
                       {/* Header Info: Creator & Stats */}
                       <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 border border-primary/20 rounded-md">
                            <Activity className="w-2.5 h-2.5 text-primary" />
                            <span className="text-[7px] md:text-[8px] font-black text-primary uppercase tracking-widest">{test.totalQuestions} Qs</span>
                          </div>
                          
                          <div className="flex items-center gap-1 px-2 py-0.5 border-l border-white/10 ml-1">
                             <div className="w-1 h-1 rounded-full bg-emerald-500" />
                             <span className="text-[8px] md:text-[10px] font-black text-white/40 uppercase tracking-widest truncate max-w-[80px] md:max-w-none">
                               {test.profiles?.fullName?.split(' ')[0] || test.creatorName?.split(' ')[0] || 'Expert'}
                             </span>
                          </div>
                       </div>
                       
                       <h3 className="text-base md:text-2xl font-black text-white leading-tight tracking-tight group-hover:text-primary transition-colors truncate">
                         {test.title}
                       </h3>
                    </div>

                    {/* Actions Area */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setSelectedRankTest(test)}
                        className="w-9 h-9 md:w-12 md:h-12 flex items-center justify-center bg-white/[0.03] text-white/20 rounded-lg md:rounded-xl border border-white/5 hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/30 transition-all"
                      >
                        <Trophy className="w-3.5 h-3.5 md:w-5 md:h-5" />
                      </button>
                      <button 
                        onClick={() => startQuiz(test)}
                        className="h-9 md:h-14 px-4 md:px-10 bg-white text-black rounded-lg md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest shadow-xl hover:bg-primary hover:text-white transition-all duration-300 whitespace-nowrap flex items-center gap-2"
                      >
                        Play <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subtle Background Accent */}
                  <div className="absolute top-0 right-0 w-1/4 h-full bg-gradient-to-l from-primary/[0.03] to-transparent pointer-events-none" />
                </motion.div>
              ))}
            </div>
              
              {filteredTests.length === 0 && !loading && (
                <div className="col-span-full py-48 text-center bg-white/[0.02] rounded-[4rem] border-2 border-dashed border-white/5">
                   <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-8">
                      <SearchIcon className="w-10 h-10 text-white/20" />
                   </div>
                   <h3 className="text-3xl font-black text-white mb-2">No quizzes found</h3>
                   <p className="text-white/30 font-medium">Try searching for something else!</p>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Feature Modals */}
      <LeaderboardModal test={selectedRankTest} onClose={() => setSelectedRankTest(null)} />
      <CinematicQuizCreator isOpen={showCreator} onClose={() => setShowCreator(false)} />
    </Layout>
  );
}

// --------------------------------------------------------------------------
// LEADERBOARD MODAL COMPONENT
// --------------------------------------------------------------------------
function LeaderboardModal({ test, onClose }: { test: TestRow | null; onClose: () => void }) {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (test) {
      setLoading(true);
      const unsubscribe = DbService.subscribeToLeaderboard(test.id, (data) => {
        setRankings(data);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [test]);

  if (!test) return null;

  const resultsPending = test?.resultAnnounceAt && test.resultAnnounceAt !== 'immediate' && new Date(test.resultAnnounceAt) > new Date();

  return (
    <Dialog open={!!test} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#0a0a0a] border-white/10 rounded-[3rem] p-10 overflow-hidden shadow-2xl">
        <DialogHeader className="space-y-6 mb-12">
          <div className="flex items-center gap-6">
             <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center border border-amber-500/20">
                <Trophy className="w-10 h-10" />
             </div>
             <div className="text-left space-y-1">
                <DialogTitle className="text-4xl font-black text-white uppercase tracking-tighter">Leaderboard</DialogTitle>
                <p className="text-white/40 font-black uppercase text-[10px] tracking-widest">Who is the smartest in {test.title}?</p>
             </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
          {resultsPending ? (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              <Clock className="w-16 h-16 text-amber-500/30 mb-6" />
              <h3 className="text-2xl font-black text-white mb-2 tracking-tighter">Ranks are Hidden</h3>
              <p className="text-sm font-bold text-white/40 max-w-[250px]">The leaderboard will be revealed on <br/><span className="text-white">{new Date(test.resultAnnounceAt!).toLocaleString()}</span></p>
            </div>
          ) : loading ? (
            <div className="py-24 flex justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /></div>
          ) : rankings.length > 0 ? (
            rankings.map((rank, index) => (
              <motion.div 
                key={rank.uid}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all group ${
                index === 0 ? 'bg-amber-500/5 border-amber-500/20' : 
                index === 1 ? 'bg-slate-400/5 border-slate-400/20' : 
                index === 2 ? 'bg-orange-800/10 border-orange-800/20' : 
                'bg-white/[0.02] border-white/5'
              }`}
            >
                <div className="flex items-center gap-6">
                   <div className="w-12 flex flex-col items-center">
                      {index === 0 ? <span className="text-4xl">🥇</span> : 
                       index === 1 ? <span className="text-4xl">🥈</span> : 
                       index === 2 ? <span className="text-4xl">🥉</span> : 
                       <span className="text-lg font-black text-white/20 tabular-nums">#{index + 1}</span>}
                   </div>
                   <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center font-black text-2xl border border-white/5 overflow-hidden">
                        {rank.avatar ? (
                          <img src={rank.avatar} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <User className="w-6 h-6 text-white/30" />
                        )}
                      </div>
                      <div>
                        <p className="font-black text-white text-lg tracking-tight">{rank.name}</p>
                        <p className="text-[9px] text-white/20 uppercase font-black tracking-widest">
                          {rank.timeTaken}s Time
                        </p>
                      </div>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-3xl font-black text-white tabular-nums tracking-tighter">{rank.score}<span className="text-sm opacity-30">%</span></p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="py-24 text-center opacity-20">
               <Zap className="w-16 h-16 mx-auto mb-4 animate-pulse" />
               <p className="text-sm font-black uppercase tracking-widest">No scores yet</p>
               <p className="text-xs font-bold">Be the first to play!</p>
            </div>
          )}
        </div>

        <button onClick={onClose} className="mt-10 w-full py-7 rounded-[2rem] bg-white text-black font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-all">
           Close Leaderboard
        </button>
      </DialogContent>
    </Dialog>
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
    correctAnswer: 0
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
    setCurrentQ({ questionText: '', options: ['', '', '', ''], correctAnswer: 0 });
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
        timeLimit: quizData.timeLimit,
        theme: quizData.theme,
        totalQuestions: quizData.questions.length,
        questions: qMap,
        activeStartAt: quizData.activeStartAt || undefined,
        expiresAt: quizData.expiresAt || undefined,
        resultAnnounceAt: quizData.resultAnnounceAt === 'immediate' ? undefined : quizData.resultAnnounceAt
      });

      toast.success('Your quiz is live! Everyone can see it now.');
      onClose();
      // Reset
      setStep(1);
      setQuizData({ title: '', timeLimit: 10, theme: 'dark', questions: [], activeStartAt: '', expiresAt: '', resultAnnounceAt: 'immediate' });
    } catch (err) {
      toast.error('We had a problem creating the quiz. Please try again.');
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
                <h4 className="text-lg md:text-xl font-black text-white uppercase tracking-tighter">Quiz Maker</h4>
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
                    <p className="text-lg md:text-xl text-white/40 font-medium">Tell us about your awesome quiz!</p>
                 </div>

                 {/* Quiz Name */}
                 <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Quiz Name</Label>
                    <input 
                      autoFocus
                      placeholder="e.g. My Amazing Math Quiz" 
                      value={quizData.title}
                      maxLength={60}
                      onChange={e => setQuizData({ ...quizData, title: e.target.value })}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 md:py-6 px-6 md:px-8 text-xl md:text-2xl font-black focus:outline-none focus:border-primary/50 transition-all placeholder:text-white/10"
                    />
                    <p className="text-[10px] text-white/30 text-right pr-4">{quizData.title.length}/60</p>
                 </div>

                 {/* Scheduling Section */}
                 <div className="space-y-6">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">📅 Scheduling Options</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                          <Label className="text-xs font-bold text-white/50 flex items-center gap-2">
                             <Play className="w-4 h-4 text-emerald-400" /> Active Start
                          </Label>
                          <input 
                            type="datetime-local"
                            value={quizData.activeStartAt}
                            onChange={e => setQuizData({ ...quizData, activeStartAt: e.target.value })}
                            className="w-full bg-white/[0.05] border border-white/10 rounded-xl py-4 px-5 text-base font-bold text-white focus:outline-none focus:border-primary/50 transition-all [color-scheme:dark]"
                          />
                          <p className="text-[10px] text-white/20">When should this quiz become available?</p>
                       </div>
                       <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3">
                          <Label className="text-xs font-bold text-white/50 flex items-center gap-2">
                             <Timer className="w-4 h-4 text-rose-400" /> Expiry Date
                          </Label>
                          <input 
                            type="datetime-local"
                            value={quizData.expiresAt}
                            onChange={e => setQuizData({ ...quizData, expiresAt: e.target.value })}
                            className="w-full bg-white/[0.05] border border-white/10 rounded-xl py-4 px-5 text-base font-bold text-white focus:outline-none focus:border-rose-500/50 transition-all [color-scheme:dark]"
                          />
                          <p className="text-[10px] text-white/20">When should this quiz stop accepting answers?</p>
                       </div>
                    </div>
                 </div>

                 {/* Results Announcement */}
                 <div className="space-y-6">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">📊 Results Announcement</Label>
                    <div className="grid grid-cols-2 gap-4">
                       <button
                          onClick={() => setQuizData({ ...quizData, resultAnnounceAt: 'immediate' })}
                          className={`p-5 md:p-6 rounded-2xl border text-left transition-all ${
                             quizData.resultAnnounceAt === 'immediate'
                               ? 'bg-emerald-500/10 border-emerald-500/30 ring-2 ring-emerald-500/40'
                               : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                          }`}
                       >
                          <Zap className={`w-6 h-6 mb-3 ${quizData.resultAnnounceAt === 'immediate' ? 'text-emerald-400' : 'text-white/20'}`} />
                          <p className="text-sm md:text-base font-black text-white">Immediately</p>
                          <p className="text-[10px] text-white/30 font-bold mt-1">Show results right after finishing</p>
                       </button>
                       <button
                          onClick={() => setQuizData({ ...quizData, resultAnnounceAt: '' })}
                          className={`p-5 md:p-6 rounded-2xl border text-left transition-all ${
                             quizData.resultAnnounceAt !== 'immediate'
                               ? 'bg-amber-500/10 border-amber-500/30 ring-2 ring-amber-500/40'
                               : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                          }`}
                       >
                          <Clock className={`w-6 h-6 mb-3 ${quizData.resultAnnounceAt !== 'immediate' ? 'text-amber-400' : 'text-white/20'}`} />
                          <p className="text-sm md:text-base font-black text-white">Scheduled</p>
                          <p className="text-[10px] text-white/30 font-bold mt-1">Announce at a specific date/time</p>
                       </button>
                    </div>

                    {quizData.resultAnnounceAt !== 'immediate' && (
                      <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl space-y-3">
                         <Label className="text-xs font-bold text-amber-400/80 flex items-center gap-2">
                            <Clock className="w-4 h-4" /> Announce Date/Time
                         </Label>
                         <input 
                            type="datetime-local"
                            value={quizData.resultAnnounceAt}
                            onChange={e => setQuizData({ ...quizData, resultAnnounceAt: e.target.value })}
                            className="w-full bg-white/[0.05] border border-amber-500/20 rounded-xl py-4 px-5 text-base font-bold text-amber-300 focus:outline-none focus:border-amber-500/50 transition-all [color-scheme:dark]"
                         />
                         <p className="text-[10px] text-white/20">Leaderboard and scores will be hidden until this date.</p>
                      </div>
                    )}
                 </div>

                 {/* Theme Preview */}
                 <div className="space-y-6">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">🎨 Quiz Theme</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                       {[
                         { 
                           id: 'dark', label: 'Classic Night', desc: 'Simple and clean.',
                           bg: 'bg-gradient-to-br from-[#0a0a0a] to-[#1a1a2e]',
                           accent: 'border-white/10',
                           previewBg: 'bg-white/5',
                           previewAccent: 'bg-white/10',
                           textColor: 'text-white/80',
                           dotColor: 'bg-blue-500'
                         },
                         { 
                           id: 'neon', label: 'Neon Party', desc: 'Bright and energetic!',
                           bg: 'bg-gradient-to-br from-[#0a001a] to-[#1a0033]',
                           accent: 'border-purple-500/20',
                           previewBg: 'bg-purple-500/10',
                           previewAccent: 'bg-pink-500/20',
                           textColor: 'text-purple-300',
                           dotColor: 'bg-pink-500'
                         },
                         { 
                           id: 'gradient', label: 'Rainbow Sky', desc: 'Soft and colorful.',
                           bg: 'bg-gradient-to-br from-[#0a1628] to-[#1a0a2e]',
                           accent: 'border-cyan-500/20',
                           previewBg: 'bg-cyan-500/10',
                           previewAccent: 'bg-teal-500/20',
                           textColor: 'text-cyan-300',
                           dotColor: 'bg-teal-500'
                         },
                       ].map(t => (
                         <button
                           key={t.id}
                           onClick={() => setQuizData({ ...quizData, theme: t.id as any })}
                           className={`relative overflow-hidden rounded-3xl border p-1 transition-all duration-300 ${
                             quizData.theme === t.id 
                               ? 'border-primary ring-2 ring-primary/50 shadow-xl shadow-primary/20 scale-[1.02]' 
                               : 'border-white/5 hover:border-white/20 hover:scale-[1.01]'
                           }`}
                         >
                            {/* Theme Preview Card */}
                            <div className={`${t.bg} rounded-[1.25rem] p-5 space-y-4`}>
                               {/* Mini preview UI */}
                               <div className="flex items-center gap-2 mb-4">
                                  <div className={`w-2 h-2 rounded-full ${t.dotColor}`} />
                                  <div className={`h-2 w-16 rounded-full ${t.previewAccent}`} />
                                  <div className="flex-1" />
                                  <div className={`h-2 w-8 rounded-full ${t.previewAccent}`} />
                               </div>
                               <div className={`h-3 w-3/4 rounded-full ${t.previewBg}`} />
                               <div className="grid grid-cols-2 gap-2">
                                  <div className={`h-8 rounded-lg ${t.previewBg} border ${t.accent}`} />
                                  <div className={`h-8 rounded-lg ${t.previewBg} border ${t.accent}`} />
                                  <div className={`h-8 rounded-lg ${t.previewBg} border ${t.accent}`} />
                                  <div className={`h-8 rounded-lg ${t.previewBg} border ${t.accent}`} />
                               </div>
                            </div>
                            {/* Theme Label */}
                            <div className="px-4 py-4 flex items-center justify-between">
                               <div>
                                  <p className="text-sm font-black text-white text-left">{t.label}</p>
                                  <p className="text-[10px] font-bold text-white/30 text-left">{t.desc}</p>
                               </div>
                               <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${quizData.theme === t.id ? 'bg-primary border-primary' : 'border-white/10'}`}>
                                  <CheckCircle2 className={`w-3.5 h-3.5 text-white transition-opacity ${quizData.theme === t.id ? 'opacity-100' : 'opacity-0'}`} />
                               </div>
                            </div>
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="pt-10 flex flex-col md:flex-row justify-between items-center gap-8 border-t border-white/5">
                    <div className="flex flex-col items-center md:items-start">
                       <span className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-2">Time Limit</span>
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
                      className="w-full md:w-auto px-10 md:px-16 py-5 md:py-7 bg-white text-black font-black rounded-2xl md:rounded-[2rem] hover:scale-105 active:scale-95 transition-all uppercase tracking-widest shadow-2xl disabled:opacity-20 text-xs md:text-sm"
                    >
                      Next: Add Questions
                    </button>
                 </div>
              </div>
            ) : (
              <div className="space-y-12 md:space-y-16">
                 <div className="space-y-3 md:space-y-4">
                    <h1 className="text-4xl md:text-8xl font-black text-white tracking-tighter uppercase">Step 2</h1>
                    <p className="text-lg md:text-xl text-white/40 font-medium">Add some fun questions to your quiz!</p>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
                    {/* List */}
                    <div className="space-y-6">
                       <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Your Questions ({quizData.questions.length})</Label>
                       <div className="space-y-4 max-h-[400px] md:max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                          {quizData.questions.length > 0 ? (
                            quizData.questions.map((q, i) => (
                              <div key={i} className="p-6 md:p-8 bg-white/[0.03] border border-white/5 rounded-2xl md:rounded-[2.5rem] flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                                 <div className="space-y-1">
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">QUESTION {i + 1}</p>
                                    <p className="text-base md:text-lg font-bold text-white line-clamp-1">{q.questionText}</p>
                                 </div>
                                 <button onClick={() => removeQuestion(i)} className="p-3 rounded-lg bg-red-500/10 text-red-500 border border-red-500/10 transition-all">
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                            ))
                          ) : (
                            <div className="py-20 text-center border-2 border-white/5 border-dashed rounded-3xl opacity-20">
                               <p className="text-xs font-black uppercase tracking-widest">No questions yet. Add one below!</p>
                            </div>
                          )}
                       </div>
                    </div>

                    {/* Editor */}
                    <div className="space-y-8 p-6 md:p-10 bg-white/[0.02] border border-white/10 rounded-3xl md:rounded-[3rem]">
                       <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Question Text</Label>
                          <Input 
                            placeholder="What do you want to ask?" 
                            value={currentQ.questionText}
                            onChange={e => setCurrentQ({ ...currentQ, questionText: e.target.value })}
                            className="rounded-2xl py-6 md:py-8 bg-white/[0.04] border-white/5 focus:border-primary/50 transition-all font-bold text-lg md:text-xl placeholder:text-white/10"
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
                                    className={`w-full bg-white/[0.03] border rounded-2xl py-4 md:py-5 px-5 md:px-6 text-sm font-bold focus:outline-none transition-all placeholder:text-white/10 ${
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
                         className="w-full py-5 md:py-6 mt-4 border-2 border-primary text-primary hover:bg-primary hover:text-white rounded-2xl md:rounded-[2rem] font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-3"
                       >
                          <PlusCircle className="w-5 h-5" /> Add This Question
                       </button>
                    </div>
                 </div>

                 <div className="pt-10 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-white/5 pb-20">
                    <button 
                      onClick={() => setStep(1)}
                      className="w-full md:w-auto px-12 py-5 md:py-6 bg-white/5 text-white/40 border border-white/10 rounded-2xl md:rounded-[2rem] font-black text-xs uppercase tracking-widest hover:text-white transition-all"
                    >
                      Go Back
                    </button>
                    
                    <button
                      onClick={handleCreate}
                      disabled={submitting || quizData.questions.length === 0}
                      className="w-full md:w-auto px-16 md:px-20 py-6 md:py-8 bg-primary text-white font-black rounded-2xl md:rounded-[2.5rem] hover:scale-110 active:scale-95 transition-all uppercase tracking-widest shadow-2xl shadow-primary/30 disabled:opacity-20 text-xs md:text-sm"
                    >
                       {submitting ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Create My Quiz!'}
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
