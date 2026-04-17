import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { DbService, TestRow, Question, Profile } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { 
  ChevronLeft, ChevronRight, CheckCircle, Clock, AlertCircle, Award, 
  Target, Sparkles, Loader2, PlayCircle, LogOut, Timer as TimerIcon, 
  Trophy, Zap, ShieldCheck, Activity, Monitor, LayoutGrid, User, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export const Route = createFileRoute('/test/$slug')({
  head: () => ({
    meta: [
      { title: 'Critical Assessment — Arena Protocol | EduNook' },
    ],
  }),
  component: TestViewPage,
});

function TestViewPage() {
  const { slug } = Route.useParams();
  const { user, dbUser } = useAuth();
  const navigate = useNavigate();

  const [test, setTest] = useState<(TestRow & { profiles?: Profile | null }) | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [timeTaken, setTimeTaken] = useState(0);
  const [started, setStarted] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load Data
  useEffect(() => {
    async function loadData() {
      try {
        const t = await DbService.getTest(slug);
        if (t) {
          const q = await DbService.getQuestions(t.id);
          setTest(t);
          setQuestions(q);
        }
      } catch (err) {
        console.error('Error loading test:', err);
        toast.error('Failed to load session');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  // Timer Logic
  useEffect(() => {
    if (started && !finished && test) {
      timerRef.current = setInterval(() => {
        setTimeTaken(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [started, finished, test]);

  const handleFinish = async () => {
    if (!user || !test) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    let correct = 0;
    questions.forEach((q) => {
      if (answers[q.id] === q.correctAnswer) {
        correct++;
      }
    });

    const finalScore = Math.round((correct / questions.length) * 100);
    setScore(finalScore);

    try {
      // 1. Save personal attempt history
      await DbService.saveTestAttempt(user.id, {
        testId: test.id,
        testTitle: test.title,
        score: correct,
        total: questions.length,
        completedAt: new Date().toISOString()
      });

      // 2. Save to global leaderboard
      await DbService.saveLeaderboardEntry(test.id, user.id, {
        score: finalScore,
        timeTaken: timeTaken,
        name: dbUser?.fullName || user.email?.split('@')[0] || 'Anonymous',
        avatar: dbUser?.avatarUrl
      });

      setFinished(true);
      toast.success('PEAK PERFORMANCE RECORDED.');
    } catch (err) {
      console.error('Error saving results:', err);
      toast.error('Cloud synchronization failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Layout hideNavigation={true}><div className="flex flex-col items-center justify-center min-h-screen bg-black gap-8"><Loader2 className="w-20 h-20 animate-spin text-primary opacity-20" /><p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted-foreground">Syncing Sector Data...</p></div></Layout>;
  
  if (!test || questions.length === 0) return <Layout hideNavigation={true}><div className="flex flex-col items-center justify-center min-h-screen bg-black gap-8"><AlertCircle className="w-20 h-20 text-destructive opacity-40" /><h1 className="text-4xl font-black text-white uppercase tracking-tighter">Sector Corrupted</h1><Link to="/tests" className="px-12 py-5 bg-white text-black font-black rounded-2xl uppercase tracking-widest text-xs">Return to Base</Link></div></Layout>;

  // START SCREEN
  if (!started && !finished) {
    return (
      <Layout hideNavigation={true}>
        <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-16 transition-colors duration-1000 ${test.theme === 'neon' ? 'theme-neon' : test.theme === 'gradient' ? 'theme-gradient' : 'theme-dark'}`}>
           <motion.div 
             initial={{ opacity: 0, y: 30 }}
             animate={{ opacity: 1, y: 0 }}
             className="max-w-4xl space-y-12"
           >
              <div className="space-y-4">
                 <div className="flex items-center justify-center gap-3 text-primary">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="text-xs font-black uppercase tracking-[0.4em]">Protocol Authorization Required</span>
                 </div>
                 <h1 className="text-huge text-white">{test.title}</h1>
                 <p className="text-xl md:text-3xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
                    {test.description}
                 </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {[
                   { label: 'Modules', val: questions.length, icon: LayoutGrid },
                   { label: 'Projection', val: `${test.timeLimit}m`, icon: Clock },
                   { label: 'Identity', val: test.profiles?.fullName || test.creatorName || 'system', icon: User },
                   { label: 'Difficulty', val: 'Level IV', icon: Activity },
                 ].map((stat, i) => (
                   <div key={i} className="p-8 premium-glass rounded-[2.5rem] border border-white/5 space-y-2">
                      <stat.icon className="w-5 h-5 text-primary opacity-40 mb-2 mx-auto" />
                      <p className="text-2xl font-black text-white">{stat.val}</p>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">{stat.label}</p>
                   </div>
                 ))}
              </div>

              <div className="pt-12 flex flex-col md:flex-row items-center justify-center gap-6">
                 <Link to="/tests" className="w-full md:w-auto px-12 py-7 bg-white/5 text-muted-foreground hover:text-white border border-white/10 rounded-[2rem] font-black text-xs uppercase tracking-widest">
                    Abort Mission
                 </Link>
                 <button 
                   onClick={() => setStarted(true)}
                   className="w-full md:w-auto px-24 py-7 bg-white text-black font-black text-sm rounded-[2rem] hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/5 uppercase tracking-[0.2em]"
                 >
                    Initiate Sequence
                 </button>
              </div>
           </motion.div>
        </div>
      </Layout>
    );
  }

  // FINISHED SCREEN
  if (finished) {
    return (
      <Layout hideNavigation={true}>
         <div className={`min-h-screen flex items-center justify-center p-6 ${test.theme === 'neon' ? 'theme-neon' : test.theme === 'gradient' ? 'theme-gradient' : 'theme-dark'}`}>
          <div className="max-w-6xl w-full">
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-12 md:p-32 premium-glass rounded-[4rem] md:rounded-[6rem] border border-white/5 text-center space-y-16 relative overflow-hidden backdrop-blur-3xl">
                  {/* Decorative Glow */}
                  <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] -z-10" />
                  <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] -z-10" />
                  
                  <div className="space-y-8">
                     <div className="w-32 h-32 md:w-48 md:h-48 bg-gradient-to-tr from-primary via-accent to-primary p-1.5 rounded-[3.5rem] mx-auto shadow-[0_0_80px_rgba(59,130,246,0.2)] animate-pulse">
                        <div className="w-full h-full bg-[#050505] rounded-[3.3rem] flex items-center justify-center font-black text-5xl md:text-7xl text-white tabular-nums">
                           {score}%
                        </div>
                     </div>
                     <div className="space-y-4">
                        <h1 className="text-huge text-white">MISSION CLEAR</h1>
                        <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.6em] opacity-40">Performance archive successfully synced to network</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
                      <div className="p-10 premium-glass rounded-[3rem] border border-white/5 space-y-2 group hover:border-primary/40 transition-all">
                          <Clock className="w-6 h-6 text-primary mb-2 mx-auto opacity-40" />
                          <p className="text-[10px] font-black text-muted-foreground uppercase opacity-40 tracking-widest">Time Execution</p>
                          <p className="text-4xl font-black text-white tabular-nums">{timeTaken}s</p>
                      </div>
                      <div className="p-10 premium-glass rounded-[3rem] border border-white/5 space-y-2 group hover:border-emerald-500/40 transition-all">
                          <Target className="w-6 h-6 text-emerald-500 mb-2 mx-auto opacity-40" />
                          <p className="text-[10px] font-black text-muted-foreground uppercase opacity-40 tracking-widest">Accuracy Ratio</p>
                          <p className="text-4xl font-black text-white tabular-nums">{score}%</p>
                      </div>
                      <div className="p-10 premium-glass rounded-[3rem] border border-white/5 space-y-2 group hover:border-amber-500/40 transition-all">
                          <Trophy className="w-6 h-6 text-amber-500 mb-2 mx-auto opacity-40" />
                          <p className="text-[10px] font-black text-muted-foreground uppercase opacity-40 tracking-widest">Protocol Rank</p>
                          <p className="text-4xl font-black text-white">{score > 90 ? 'ELITE' : score > 70 ? 'GOLD' : 'BRAVO'}</p>
                      </div>
                  </div>

                  <div className="pt-12">
                     <Link to="/tests" className="group flex items-center justify-center gap-4 w-full md:w-auto mx-auto px-24 py-8 bg-white text-black font-black text-sm rounded-[2.5rem] shadow-2xl hover:scale-105 active:scale-95 transition-all uppercase tracking-[0.2em]">
                        Sign Transmission & Exit
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                     </Link>
                  </div>
              </motion.div>
          </div>
         </div>
      </Layout>
    );
  }

  const currentQ = questions[currentIdx];
  const progress = ((currentIdx + 1) / questions.length) * 100;

  return (
    <Layout hideNavigation={true}>
      <div className={`min-h-screen transition-colors duration-1000 overflow-hidden relative ${test.theme === 'neon' ? 'theme-neon' : test.theme === 'gradient' ? 'theme-gradient' : 'theme-dark'}`}>
        
        {/* Background Decor */}
        <div className="absolute top-0 right-[-10%] w-[50%] h-[40%] bg-primary/5 rounded-full blur-[200px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[180px] pointer-events-none" />

        <div className="max-w-[1400px] mx-auto px-6 py-12 md:py-16 space-y-20 relative z-10">
          
          {/* Top Bar (Focus Mode Header) */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-12 premium-glass p-8 md:p-10 rounded-[3rem] border border-white/5">
            <Link to="/tests" className="flex items-center gap-4 px-8 py-4 bg-white/5 text-muted-foreground hover:text-white rounded-[1.5rem] border border-white/10 transition-all group font-black uppercase text-[10px] tracking-widest">
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-2 transition-transform" />
                Abort 
            </Link>
            
            <div className="flex-1 max-w-xl w-full space-y-6">
                <div className="flex justify-between items-end px-4">
                  <div className="flex items-center gap-3">
                     <Monitor className="w-4 h-4 text-primary" />
                     <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Intelligence Extraction</span>
                  </div>
                  <span className="text-xs font-black text-white tabular-nums tracking-tighter opacity-40">{currentIdx + 1} / {questions.length}</span>
                </div>
                <div className="h-4 bg-white/5 rounded-full overflow-hidden p-1 border border-white/5">
                  <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-primary rounded-full shadow-[0_0_25px_rgba(59,130,246,0.4)] transition-all duration-300"
                  />
                </div>
            </div>

            <div className="flex items-center gap-8">
                <div className="flex flex-col items-end">
                   <p className="text-[9px] font-black text-muted-foreground uppercase mb-2 opacity-30">Active Session</p>
                   <div className="flex items-center gap-4 px-8 py-4 bg-white/5 rounded-[1.5rem] border border-white/10 min-w-[140px] justify-center">
                      <TimerIcon className="w-5 h-5 text-primary animate-pulse" />
                      <span className="text-xl font-black text-white tabular-nums tracking-tighter">{timeTaken}s</span>
                   </div>
                </div>
            </div>
          </div>

          {/* QUESTION STAGE - MASSIVE TYPOGRAPHY */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="relative space-y-24"
            >
                <div className="space-y-12 max-w-5xl">
                  <div className="flex items-center gap-4 px-6 py-2 bg-primary/10 border border-primary/20 rounded-full w-fit">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary">MODULE {currentIdx + 1}</span>
                  </div>
                  <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-white leading-[1.05] lowercase">
                      {currentQ.questionText}?
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-12">
                  {currentQ.options.map((opt, i) => (
                      <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i}
                        onClick={() => setAnswers({ ...answers, [currentQ.id]: i })}
                        className={`group relative p-10 md:p-12 rounded-[3.5rem] md:rounded-[4.5rem] border text-left transition-all duration-500 overflow-hidden ${
                          answers[currentQ.id] === i 
                            ? 'bg-primary border-primary shadow-[0_20px_60px_rgba(59,130,246,0.3)]' 
                            : 'bg-white/[0.02] border-white/5 hover:border-white/20 hover:bg-white/[0.04]'
                        }`}
                      >
                        {/* Option Decor */}
                        {answers[currentQ.id] === i && (
                          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16" />
                        )}

                        <div className="relative flex items-center gap-10">
                            <div className={`w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-center font-black transition-all text-2xl md:text-3xl ${
                              answers[currentQ.id] === i 
                                ? 'bg-white text-primary scale-110 shadow-2xl' 
                                : 'bg-white/5 text-muted-foreground group-hover:bg-white/10 group-hover:text-white'
                            }`}>
                              {String.fromCharCode(65 + i)}
                            </div>
                            <span className={`text-2xl md:text-3xl font-black tracking-tight leading-tight transition-colors ${answers[currentQ.id] === i ? 'text-white' : 'text-muted-foreground/60 group-hover:text-white'}`}>
                              {opt}
                            </span>
                        </div>
                      </motion.button>
                  ))}
                </div>
            </motion.div>
          </AnimatePresence>

          {/* BOTTOM NAVIGATION - CINEMATIC ACTIONS */}
          <div className="pt-12 flex flex-col md:flex-row items-center justify-between gap-12 sticky bottom-0 pb-12 bg-transparent">
            {/* Attribution */}
            <div className="flex items-center gap-6 px-10 py-6 premium-glass rounded-[2rem] border border-white/5">
                <ShieldCheck className="w-8 h-8 text-emerald-500 opacity-40" />
                <div className="flex flex-col">
                   <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-30">Authenticity Verified</span>
                   <span className="text-xs font-black text-white uppercase tracking-tighter">@{test.profiles?.username || 'system'} Deployment</span>
                </div>
            </div>

            <div className="flex items-center gap-6 w-full md:w-auto">
                {currentIdx > 0 && (
                  <button 
                    onClick={() => setCurrentIdx(currentIdx - 1)}
                    className="flex-1 md:flex-none px-12 py-8 bg-white/5 text-muted-foreground hover:text-white rounded-[2.5rem] border border-white/10 transition-all font-black text-xs uppercase tracking-widest"
                  >
                    Previous Module
                  </button>
                )}
                
                {currentIdx < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIdx(currentIdx + 1)}
                    disabled={answers[currentQ.id] === undefined}
                    className="group flex-1 md:flex-none px-20 py-8 bg-white text-black rounded-[2.5rem] font-black text-sm uppercase tracking-[0.3em] shadow-[0_20px_50px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 disabled:opacity-10 disabled:scale-100 transition-all flex items-center justify-center gap-4"
                  >
                    Next Objective <ChevronRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                  </button>
                ) : (
                  <button
                    onClick={handleFinish}
                    disabled={answers[currentQ.id] === undefined || submitting}
                    className="group flex-1 md:flex-none px-24 py-9 bg-primary text-white rounded-[3rem] font-black text-sm uppercase tracking-[0.3em] shadow-[0_30px_60px_rgba(59,130,246,0.4)] hover:scale-110 active:scale-95 disabled:opacity-10 disabled:scale-100 transition-all flex items-center justify-center gap-4"
                  >
                    {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Archive & Finalize <Zap className="w-6 h-6 fill-white" /></>}
                  </button>
                )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
