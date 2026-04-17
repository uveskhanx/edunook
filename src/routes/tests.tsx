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
  Star, LayoutGrid, Activity, Globe, ShieldCheck
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
      { title: 'Arena — High Performance Assessments | EduNook' },
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

  const filteredTests = tests.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startQuiz = (test: TestRow) => {
    if (!user) {
      toast.error('Identity unverified. Please log in.');
      return;
    }
    navigate({ to: '/test/$slug', params: { slug: test.slug || test.id } });
  };

  if (loading) return <Layout><div className="flex flex-col items-center justify-center py-48 gap-6"><Loader2 className="w-16 h-16 animate-spin text-primary opacity-20" /><p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground">Initializing Arena...</p></div></Layout>;

  return (
    <Layout>
      <div className="relative overflow-hidden min-h-screen">
        {/* Massive Background Decor */}
        <div className="absolute top-0 right-[-10%] w-[60%] h-[40%] bg-primary/5 rounded-full blur-[200px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-accent/5 rounded-full blur-[180px] pointer-events-none" />

        <div className="max-w-[1600px] mx-auto px-6 md:px-12 py-16 md:py-24 space-y-24 md:space-y-32 relative z-10">
          
          {/* HUGE HERO SECTION */}
          <div className="space-y-12">
            <motion.div 
               initial={{ opacity: 0, y: 30 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex flex-col gap-6 md:gap-10"
            >
              <div className="flex items-center gap-3 text-primary animate-pulse">
                <Globe className="w-5 h-5" />
                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.6em] text-primary/80">Global Assessment Network</span>
              </div>
              <h1 className="text-huge text-white">ARENA</h1>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-l-2 border-primary/20 pl-6 md:pl-8">
                <p className="text-base md:text-2xl text-muted-foreground font-medium max-w-2xl leading-relaxed">
                   The world's most immersive learning battlefield. Clear <span className="text-white font-black italic">Challenges</span>, dominate <span className="text-primary font-black">Leaderboards</span>, and archive peak performance.
                </p>
                {user && (
                  <button 
                    onClick={() => setShowCreator(true)}
                    className="group relative flex items-center justify-center gap-4 px-8 md:px-12 py-5 md:py-7 bg-white text-black font-black text-xs md:text-sm rounded-[1.5rem] md:rounded-[2rem] hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(255,255,255,0.1)] uppercase tracking-[0.2em] w-full md:w-auto"
                  >
                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
                    Open Studio
                  </button>
                )}
              </div>
            </motion.div>

            {/* HIGH-IMPACT STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
               {[
                 { label: 'Active Sectors', val: tests.length, icon: LayoutGrid, color: 'text-primary' },
                 { label: 'Verified Experts', val: globalStats.experts, icon: ShieldCheck, color: 'text-emerald-400' },
                 { label: 'Total Enrollments', val: globalStats.enrollments, icon: Activity, color: 'text-blue-400' },
                 { label: 'Trophies Earned', val: globalStats.trophies, icon: Trophy, color: 'text-amber-400' },
               ].map((stat, i) => (
                 <motion.div 
                   key={i}
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   transition={{ delay: 0.2 + (i * 0.05) }}
                   className="p-8 md:p-10 glass-card"
                 >
                    <stat.icon className={`w-6 h-6 ${stat.color} opacity-40 group-hover:opacity-100 transition-opacity`} />
                    <div>
                      <p className="text-3xl md:text-5xl font-black text-white tracking-tighter tabular-nums">{stat.val}</p>
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-50">{stat.label}</p>
                    </div>
                 </motion.div>
               ))}
            </div>
          </div>

          {/* PERSISTENT SEARCH STAGE */}
          <div className="space-y-12">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight flex items-center gap-4">
                Active Challenges
                <span className="text-sm bg-primary/10 text-primary px-4 py-1.5 rounded-xl border border-primary/20">{filteredTests.length}</span>
              </h2>
              
              <div className="w-full md:w-96 relative group">
                <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                  type="text" 
                  placeholder="Filter by sector..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-16 pr-8 glass-input"
                />
              </div>
            </div>

            {/* MASSIVE GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {filteredTests.map((test, index) => (
                <motion.div 
                  key={test.id} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`group relative p-10 md:p-12 glass-card rounded-[3.5rem] md:rounded-[4.5rem] transition-all duration-500 flex flex-col justify-between h-full overflow-hidden ${
                    test.theme === 'neon' ? 'hover:shadow-[0_0_80px_rgba(0,242,255,0.15)]' : 
                    test.theme === 'gradient' ? 'hover:shadow-[0_0_80px_rgba(251,191,36,0.15)]' : 
                    'hover:shadow-[0_0_80px_rgba(139,92,246,0.15)]'
                  }`}
                >
                  {/* Card Glow Decor */}
                  <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity -mr-10 -mt-10 ${
                    test.theme === 'neon' ? 'bg-cyan-400' : test.theme === 'gradient' ? 'bg-amber-400' : 'bg-primary'
                  }`} />
                  
                  <div className="relative z-10 space-y-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
                        <Monitor className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">{test.totalQuestions} Questions</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-black uppercase tracking-widest opacity-40">
                        <Clock className="w-3.5 h-3.5" />
                        {test.timeLimit} Min
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-3xl md:text-4xl font-black text-white leading-tight lowercase tracking-tighter group-hover:text-primary transition-colors">
                        {test.title}
                      </h3>
                      <p className="text-base text-muted-foreground/60 line-clamp-2 font-medium leading-[1.6]">
                        {test.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                       <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-primary/50 transition-colors">
                          {test.profiles?.avatarUrl ? (
                            <img src={test.profiles.avatarUrl} className="w-full h-full object-cover rounded-2xl shadow-2xl" alt="" />
                          ) : (
                            <User className="w-5 h-5 text-muted-foreground" />
                          )}
                       </div>
                       <div className="flex flex-col">
                          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-40">Creator Identity</span>
                          <span className="text-xs font-black text-white group-hover:text-primary transition-colors">
                            {test.profiles?.fullName || test.creatorName || 'System Protocol'}
                          </span>
                       </div>
                    </div>
                  </div>

                  <div className="relative z-10 mt-12 flex gap-4">
                    <button 
                      onClick={() => startQuiz(test)}
                      className="flex-1 py-7 bg-white text-black rounded-[2rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl hover:bg-primary hover:text-white hover:scale-[1.05] active:scale-[0.95] transition-all duration-300"
                    >
                      Enter Field
                    </button>
                    <button
                      onClick={() => setSelectedRankTest(test)}
                      className="w-20 flex items-center justify-center bg-white/5 text-white rounded-[2rem] border border-white/10 hover:bg-white/10 hover:border-amber-400 group-hover:scale-110 transition-all duration-300"
                    >
                      <Trophy className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
              
              {filteredTests.length === 0 && !loading && (
                <div className="col-span-full py-48 text-center space-y-10 group bg-card/10 rounded-[5rem] border border-white/5 border-dashed">
                   <Monitor className="w-24 h-24 text-muted-foreground mx-auto opacity-10 group-hover:rotate-12 transition-transform duration-700" />
                   <div className="space-y-4">
                      <p className="text-3xl font-black text-muted-foreground opacity-30 uppercase tracking-[0.5em]">Sector Empty</p>
                      <p className="text-xs font-bold text-muted-foreground/20 max-w-xs mx-auto">No assessments detected in this coordinate range. Try another filter or create your own.</p>
                   </div>
                </div>
              )}
            </div>
          </div>

          {/* PERSONAL ARCHIVE / FOOTER */}
          {user && attempts.length > 0 && (
            <div className="space-y-12">
               <div className="flex items-center gap-6">
                 <div className="w-20 h-20 bg-primary/10 border border-primary/20 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary/10">
                    <History className="w-10 h-10 text-primary" />
                 </div>
                 <div>
                   <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Transmission Archive</h2>
                   <p className="text-xs font-black text-muted-foreground uppercase tracking-widest opacity-40">Legacy of your past 10 deployments</p>
                 </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {attempts.slice(0, 9).map((att) => (
                   <div key={att.id} className="p-8 glass-card rounded-[3rem] border border-white/5 flex items-center justify-between group hover:border-primary/30 transition-all cursor-default overflow-hidden relative">
                     <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                     <div className="flex items-center gap-6 relative z-10">
                       <div className="w-14 h-14 bg-white/5 text-white rounded-2xl flex items-center justify-center font-black text-xl border border-white/5">
                          {Math.round((att.score / att.total) * 100)}%
                       </div>
                       <div className="space-y-1">
                         <p className="font-black text-white text-lg lowercase tracking-tight">{att.testTitle || "Unknown Unit"}</p>
                         <div className="flex items-center gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                              {new Date(att.completedAt).toLocaleDateString()}
                            </p>
                         </div>
                       </div>
                     </div>
                     <div className="relative z-10 text-right space-y-2">
                        <p className="text-2xl font-black text-white tabular-nums">{att.score}<span className="text-[10px] opacity-30">/{att.total}</span></p>
                        <div className="px-3 py-1 bg-emerald-500/10 rounded-lg text-emerald-400 text-[8px] font-black tracking-widest border border-emerald-500/20">PASSED</div>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Feature Modals */}
      <LeaderboardModal test={selectedRankTest} onClose={() => setSelectedRankTest(null)} />
      <CinematicQuizCreator isOpen={showCreator} onClose={() => setShowCreator(false)} />
    </Layout>
  );
}

// --------------------------------------------------------------------------
// LEADERBOARD MODAL COMPONENT (Upgraded)
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

  return (
    <Dialog open={!!test} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#050505] border-white/10 rounded-[4rem] p-12 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]">
        {/* Glow Decor */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
        
        <DialogHeader className="space-y-6 mb-12">
          <div className="flex items-center gap-6">
             <div className="w-20 h-20 bg-amber-500/10 text-amber-500 rounded-3xl flex items-center justify-center shadow-[0_20px_40px_rgba(245,158,11,0.1)] border border-amber-500/20">
                <Trophy className="w-10 h-10" />
             </div>
             <div className="text-left space-y-1">
                <DialogTitle className="text-4xl font-black text-white uppercase tracking-tighter">Leaderboard</DialogTitle>
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                   <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.3em] opacity-60">Global Rankings: {test.title}</p>
                </div>
             </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
          {loading ? (
            <div className="py-24 flex justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" /></div>
          ) : rankings.length > 0 ? (
            rankings.map((rank, index) => (
              <motion.div 
                key={rank.uid}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center justify-between p-8 rounded-[2.5rem] border transition-all relative overflow-hidden group ${
                index === 0 ? 'bg-amber-500/5 border-amber-500/20' : 
                index === 1 ? 'bg-slate-400/5 border-slate-400/20' : 
                index === 2 ? 'bg-orange-800/10 border-orange-800/20' : 
                'bg-white/[0.02] border-white/5'
              }`}
            >
                {/* Visual Rank Indicator */}
                {index < 3 && (
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                     <Award className="w-24 h-24" />
                  </div>
                )}

                <div className="flex items-center gap-8 relative z-10">
                   <div className="w-16 flex flex-col items-center">
                      {index === 0 ? <span className="text-5xl drop-shadow-lg">🥇</span> : 
                       index === 1 ? <span className="text-5xl drop-shadow-lg">🥈</span> : 
                       index === 2 ? <span className="text-5xl drop-shadow-lg">🥉</span> : 
                       <span className="text-xl font-black text-muted-foreground/30 tabular-nums">#{index + 1}</span>}
                   </div>
                   <div className="flex items-center gap-6">
                      <div className="relative">
                        {rank.avatar ? (
                          <img src={rank.avatar} className="w-16 h-16 rounded-[1.5rem] object-cover border-2 border-white/10 group-hover:border-white/30 transition-all shadow-2xl" alt="" />
                        ) : (
                          <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center font-black text-3xl border border-white/5">
                            {rank.name[0]}
                          </div>
                        )}
                        {index === 0 && <Flame className="absolute -top-3 -right-3 w-8 h-8 text-orange-500 animate-bounce" />}
                      </div>
                      <div>
                        <p className="font-black text-white text-xl tracking-tight group-hover:text-primary transition-colors">{rank.name}</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-40">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{rank.timeTaken}s Efficiency</span>
                        </div>
                      </div>
                   </div>
                </div>
                <div className="text-right relative z-10">
                   <p className="text-4xl font-black text-white tabular-nums tracking-tighter group-hover:scale-110 transition-transform">{rank.score}<span className="text-base text-muted-foreground opacity-30">%</span></p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="py-24 text-center space-y-6 opacity-30">
               <Zap className="w-16 h-16 mx-auto animate-pulse" />
               <p className="text-sm font-black uppercase tracking-[0.5em]">Sector Uncharted</p>
               <p className="text-xs font-bold max-w-xs mx-auto">Be the first to secure a verified score in this challenge sector.</p>
            </div>
          )}
        </div>

        <button onClick={onClose} className="mt-12 w-full py-8 rounded-[2rem] bg-white text-black font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-white/5 hover:scale-[1.02] active:scale-[0.98] transition-all">
           Return to Arena
        </button>
      </DialogContent>
    </Dialog>
  );
}

// --------------------------------------------------------------------------
// CINEMATIC QUIZ CREATOR (Massive Redesign)
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
    questions: [] as any[]
  });

  const [currentQ, setCurrentQ] = useState({
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: 0
  });

  const addQuestion = () => {
    if (!currentQ.questionText.trim()) {
      toast.error('Question text is mandatory.');
      return;
    }
    if (currentQ.options.some(o => !o.trim())) {
      toast.error('All 4 options must be populated.');
      return;
    }
    setQuizData({ ...quizData, questions: [...quizData.questions, currentQ] });
    setCurrentQ({ questionText: '', options: ['', '', '', ''], correctAnswer: 0 });
    toast.success(`Question ${quizData.questions.length + 1} locked into buffer.`);
  };

  const removeQuestion = (idx: number) => {
    setQuizData({ ...quizData, questions: quizData.questions.filter((_, i) => i !== idx) });
  };

  const handleCreate = async () => {
    if (!user) return;
    if (quizData.questions.length === 0) {
      toast.error('Sector offline. Add at least one module.');
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
        questions: qMap
      });

      toast.success('CHALLENGE DEPLOYED. RETURNING TO ARENA.');
      onClose();
      // Reset
      setStep(1);
      setQuizData({ title: '', description: '', timeLimit: 10, theme: 'dark', questions: [] });
    } catch (err) {
      toast.error('Deployment failure. Protocol aborted.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const themes = [
    { id: 'dark', label: 'Classic', desc: 'Midnight focus mode.' },
    { id: 'neon', label: 'Neon Pulse', desc: 'High-energy cyber ambience.' },
    { id: 'gradient', label: 'Solaris', desc: 'Warm solar-infused transitions.' },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black focus-mode-active overflow-y-auto custom-scrollbar">
      <AnimatePresence mode="wait">
        <motion.div 
          key={step}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          className="min-h-screen flex flex-col"
        >
          {/* Top Info Bar */}
          <div className="h-24 px-12 flex items-center justify-between border-b border-white/5 backdrop-blur-3xl sticky top-0 z-50">
             <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                   <Monitor className="w-6 h-6 text-primary" />
                </div>
                <div>
                   <h4 className="text-xl font-black text-white uppercase tracking-tighter">Challenge Studio</h4>
                   <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Phase {step} — Deployment Configuration</p>
                </div>
             </div>

             <div className="flex items-center gap-6">
                <div className="flex flex-col items-end">
                   <p className="text-[9px] font-black text-muted-foreground uppercase mb-1 opacity-50">Identity Verified</p>
                   <p className="text-xs font-black text-white uppercase tabular-nums">@{dbUser?.username || 'user'}</p>
                </div>
                <button 
                  onClick={onClose}
                  className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all group"
                >
                  <CloseIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
                </button>
             </div>
          </div>

          {/* CINEMATIC STEPPER CONTENT */}
          <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-24 md:py-32">
            
            {step === 1 ? (
              <div className="space-y-24">
                 <div className="space-y-6">
                   <div className="flex items-center gap-3 text-primary">
                      <Zap className="w-5 h-5 fill-primary" />
                      <span className="text-xs font-black uppercase tracking-[0.4em]">Core Parameters</span>
                   </div>
                   <h1 className="text-huge text-white">GENESIS</h1>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-32">
                    <div className="space-y-12">
                       <div className="space-y-4 group">
                          <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground group-focus-within:text-primary transition-colors">Sector Title</Label>
                          <input 
                            autoFocus
                            placeholder="Enter identifying title..." 
                            value={quizData.title}
                            onChange={e => setQuizData({ ...quizData, title: e.target.value })}
                            className="w-full glass-input text-4xl font-black"
                          />
                       </div>
                       <div className="space-y-4 group">
                          <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground group-focus-within:text-primary transition-colors">Intelligence Brief</Label>
                          <textarea 
                            placeholder="Describe the objective..." 
                            rows={3}
                            value={quizData.description}
                            onChange={e => setQuizData({ ...quizData, description: e.target.value })}
                            className="w-full glass-input text-2xl font-bold resize-none"
                          />
                       </div>
                    </div>

                    <div className="space-y-12">
                       <div className="space-y-6">
                          <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Select Ambience</Label>
                          <div className="grid grid-cols-1 gap-4">
                             {themes.map(t => (
                               <button
                                 key={t.id}
                                 onClick={() => setQuizData({ ...quizData, theme: t.id as any })}
                                 className={`p-8 rounded-[2.5rem] border text-left transition-all relative overflow-hidden group ${
                                   quizData.theme === t.id 
                                     ? 'bg-primary/20 border-primary/40 shadow-2xl' 
                                     : 'bg-white/5 border-white/5 hover:border-white/20'
                                 }`}
                               >
                                  {quizData.theme === t.id && (
                                    <motion.div layoutId="theme-active" className="absolute inset-0 bg-primary/10 p-2" />
                                  )}
                                  <div className="relative z-10 flex items-center justify-between">
                                     <div>
                                        <p className="text-xl font-black text-white">{t.label}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">{t.desc}</p>
                                     </div>
                                     <div className={`w-8 h-8 rounded-full border-2 border-white/10 flex items-center justify-center ${quizData.theme === t.id ? 'bg-primary border-primary' : ''}`}>
                                        <CheckCircle2 className={`w-4 h-4 text-white transition-opacity ${quizData.theme === t.id ? 'opacity-100' : 'opacity-0'}`} />
                                     </div>
                                  </div>
                               </button>
                             ))}
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="pt-12 flex justify-between items-center border-t border-white/5">
                    <div className="flex items-center gap-8">
                       <div className="flex flex-col">
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Time Projection</span>
                          <div className="flex items-center gap-4">
                             <input 
                                type="number" 
                                value={quizData.timeLimit}
                                onChange={e => setQuizData({ ...quizData, timeLimit: parseInt(e.target.value) || 0 })}
                                className="w-20 bg-white/5 border border-white/10 rounded-xl py-3 text-center font-black text-2xl"
                             />
                             <span className="font-black text-white opacity-40">Minutes</span>
                          </div>
                       </div>
                    </div>
                    <button 
                      onClick={() => setStep(2)}
                      disabled={!quizData.title.trim()}
                      className="px-20 py-8 bg-white text-black font-black rounded-[2.5rem] hover:scale-105 active:scale-95 transition-all uppercase tracking-[0.3em] shadow-2xl disabled:opacity-20"
                    >
                      Initialize Module Grid
                    </button>
                 </div>
              </div>
            ) : (
              <div className="space-y-24">
                <div className="space-y-6">
                   <div className="flex items-center gap-3 text-emerald-400">
                      <Activity className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-[0.4em]">Intelligence Matrix</span>
                   </div>
                   <h1 className="text-title-massive text-white lowercase tracking-tighter">Construction</h1>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
                    {/* Buffer List */}
                    <div className="space-y-8">
                       <div className="flex items-center justify-between mb-8">
                          <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Buffered Modules ({quizData.questions.length})</Label>
                       </div>
                       
                       <div className="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                          {quizData.questions.length > 0 ? (
                            quizData.questions.map((q, i) => (
                              <motion.div 
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={i} 
                                className="p-8 bg-white/[0.03] border border-white/5 rounded-[2.5rem] flex items-center justify-between group hover:border-emerald-500/30 transition-all"
                              >
                                 <div className="space-y-2">
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">MODULE {i + 1}</p>
                                    <p className="text-lg font-bold text-white line-clamp-1">{q.questionText}</p>
                                 </div>
                                 <button onClick={() => removeQuestion(i)} className="p-4 rounded-xl bg-destructive/5 text-destructive border border-destructive/10 opacity-0 group-hover:opacity-100 transition-all">
                                    <Trash2 className="w-5 h-5" />
                                 </button>
                              </motion.div>
                            ))
                          ) : (
                            <div className="py-24 text-center border-2 border-white/5 border-dashed rounded-[3rem] opacity-20">
                               <p className="text-xs font-black uppercase tracking-[0.5em]">Buffer Empty</p>
                            </div>
                          )}
                       </div>
                    </div>

                    {/* Active Question Editor */}
                    <div className="space-y-10 p-10 bg-white/[0.02] border border-white/5 rounded-[3.5rem] relative">
                       <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground ml-2">Objective Text</Label>
                          <Input 
                            placeholder="State the inquiry..." 
                            value={currentQ.questionText}
                            onChange={e => setCurrentQ({ ...currentQ, questionText: e.target.value })}
                            className="rounded-2xl py-8 bg-white/[0.04] border-white/5 focus:border-emerald-500 transition-all font-bold text-xl"
                          />
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {currentQ.options.map((opt, i) => (
                             <div key={i} className="space-y-3">
                                <Label className={`text-[9px] font-black uppercase tracking-widest ml-2 transition-colors ${currentQ.correctAnswer === i ? 'text-emerald-400' : 'text-muted-foreground opacity-40'}`}>Sector {String.fromCharCode(65 + i)}</Label>
                                <div className="relative">
                                  <input 
                                    placeholder={`Option Value ${i+1}`}
                                    value={opt}
                                    onChange={e => {
                                      const newOpts = [...currentQ.options];
                                      newOpts[i] = e.target.value;
                                      setCurrentQ({ ...currentQ, options: newOpts });
                                    }}
                                    className={`w-full bg-white/[0.03] border rounded-2xl py-5 px-6 text-sm font-bold focus:outline-none transition-all ${
                                      currentQ.correctAnswer === i 
                                        ? 'border-emerald-500/50 ring-4 ring-emerald-500/10' 
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
                         className="w-full py-6 mt-4 border-2 border-emerald-500 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-[2rem] font-black uppercase text-[10px] tracking-[0.4em] transition-all flex items-center justify-center gap-3"
                       >
                          <PlusCircle className="w-4 h-4" /> Insert into Sector Buffer
                       </button>
                    </div>
                 </div>

                 {/* FINAL ACTIONS */}
                 <div className="pt-12 flex items-center justify-between border-t border-white/5 pb-24">
                    <button 
                      onClick={() => setStep(1)}
                      className="px-12 py-6 bg-white/5 text-white/50 border border-white/10 rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:text-white transition-all"
                    >
                      Return to Genesis
                    </button>
                    
                    <button
                      onClick={handleCreate}
                      disabled={submitting || quizData.questions.length === 0}
                      className="px-24 py-8 bg-emerald-500 text-white font-black rounded-[2.5rem] hover:scale-110 active:scale-95 transition-all uppercase tracking-[0.4em] shadow-2xl shadow-emerald-500/30 disabled:opacity-10"
                    >
                       {submitting ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : <>Finalize Deployment <Zap className="ml-2 w-5 h-5 fill-white" /></>}
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

