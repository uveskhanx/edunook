import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { DbService, TestRow, Question, Profile } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { 
  ChevronLeft, ChevronRight, CheckCircle, Clock, AlertCircle, Award, 
  Target, Sparkles, Loader2, PlayCircle, LogOut, Timer as TimerIcon, 
  Trophy, Zap, ShieldCheck, Activity, Monitor, LayoutGrid, User, ArrowRight,
  Star, Heart, Smile, PartyPopper, RefreshCcw, ZapOff, Brain, Lightbulb,
  FileText, Shield, Info, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { LeaderboardModal } from '@/components/LeaderboardModal';

// --- PRODUCTION QUALITY UTILS ---
const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return m > 0 ? `${m}m ${rs}s` : `${s}s`;
};

export const Route = createFileRoute('/test/$slug')({
  head: () => ({
    meta: [
      { title: 'Certification Assessment — EduNook' },
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
  const [hintsUsed, setHintsUsed] = useState<string[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [timeTaken, setTimeTaken] = useState(0);
  const [started, setStarted] = useState(false);
  const [selectedRankTest, setSelectedRankTest] = useState<(TestRow & { profiles?: Profile | null }) | null>(null);
  const [lastSelectedKey, setLastSelectedKey] = useState<number | null>(null);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const storageKey = `edunook_quiz_v1_${slug}`;

  // Load Data & Restore State
  useEffect(() => {
    async function loadData() {
      try {
        const t = await DbService.getTest(slug);
        if (t) {
          const q = await DbService.getQuestions(t.id);
          setTest(t);
          setQuestions(q);

          const saved = localStorage.getItem(storageKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.testId === t.id) {
              if (parsed.finished) {
                setFinished(true);
                let correct = 0;
                q.forEach((item) => { if (parsed.answers?.[item.id] === item.correctAnswer) correct++; });
                setScore(Math.round((correct / q.length) * 100));
                setAnswers(parsed.answers || {});
                setHintsUsed(parsed.hintsUsed || []);
                setTimeTaken(parsed.timeTaken || 0);
              } else {
                // DON'T set started = true automatically anymore to avoid 200s confusion
                // Just keep the saved data ready
                setAnswers(parsed.answers || {});
                setHintsUsed(parsed.hintsUsed || []);
                setCurrentIdx(parsed.currentIdx || 0);
                setTimeTaken(parsed.timeTaken || 0);
              }
            }
          }
        }
      } catch (err) {
        console.error('Test loading error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  // Save Progress
  useEffect(() => {
    if (started && !finished && test) {
      localStorage.setItem(storageKey, JSON.stringify({
        testId: test.id,
        answers,
        hintsUsed,
        currentIdx,
        timeTaken,
        finished: false
      }));
    }
  }, [answers, hintsUsed, currentIdx, timeTaken, started, finished, test]);

  // Timer
  useEffect(() => {
    if (started && !finished && test) {
      timerRef.current = setInterval(() => setTimeTaken(p => p + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started, finished, test]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!started || finished || submitting) return;
      if (['1', '2', '3', '4'].includes(e.key)) {
        const optIdx = parseInt(e.key) - 1;
        const q = questions[currentIdx];
        if (q && optIdx < q.options.length) {
          handleSelectAnswer(q.id, optIdx);
          setLastSelectedKey(optIdx);
          setTimeout(() => setLastSelectedKey(null), 150);
        }
      }
      if (e.key === 'Enter' && answers[questions[currentIdx]?.id] !== undefined) {
        currentIdx < questions.length - 1 ? handleNext() : handleFinish();
      }
      if (e.key.toLowerCase() === 'h' && questions[currentIdx]?.hint) handleUseHint();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [started, finished, submitting, currentIdx, questions, answers]);

  const handleSelectAnswer = (qId: string, idx: number) => {
    setAnswers(prev => ({ ...prev, [qId]: idx }));
  };

  const handleUseHint = () => {
    const q = questions[currentIdx];
    if (!q?.hint) return;
    setShowHint(true);
    if (!hintsUsed.includes(q.id)) setHintsUsed(prev => [...prev, q.id]);
  };

  const handleNext = () => {
    setShowHint(false);
    setCurrentIdx(p => p + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinish = async () => {
    if (!user || !test) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    let correct = 0;
    questions.forEach(q => { if (answers[q.id] === q.correctAnswer) correct++; });
    const finalScore = Math.round((correct / questions.length) * 100);
    setScore(finalScore);

    try {
      localStorage.setItem(storageKey, JSON.stringify({ 
        testId: test.id, 
        answers, 
        hintsUsed, 
        timeTaken, 
        finished: true 
      }));
      setFinished(true);

      // 1. Save local history
      await DbService.saveTestAttempt(user.id, {
        testId: test.id,
        testTitle: test.title,
        score: correct,
        total: questions.length,
        answers,
        hintsUsed,
        timeTaken,
        completedAt: new Date().toISOString()
      }).catch(e => console.error('Attempt save failed:', e));

      // 2. Archive Standing (Hall of Fame)
      await DbService.saveLeaderboardEntry(test.id, user.id, {
        score: finalScore,
        timeTaken,
        name: dbUser?.fullName || 'Anonymous Learner',
        avatar: dbUser?.avatarUrl || null,
        hintsCount: hintsUsed.length
      }).catch(e => {
        console.error('Leaderboard sync failed:', e);
        toast.error('Leaderboard sync delay. Standings will refresh shortly.');
      });

      toast.success('Performance archived in Hall of Fame!');

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#8b5cf6', '#10b981']
      });
      toast.success('Assessment completed! Standings updated.');
    } catch (err) {
      console.error('Finalization error:', err);
      setFinished(true);
    } finally {
      setSubmitting(false);
    }
  };  // --- THEME ENGINE ---
  const theme = getThemeConfig(test?.theme);

  if (loading) return (
    <Layout hideNavigation={true}>
      <div className={`min-h-screen ${theme.bg} flex flex-col items-center justify-center gap-6`}>
        <div className={`w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin`} />
        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] animate-pulse">Initializing Assessment Arena...</p>
      </div>
    </Layout>
  );

  if (!test || questions.length === 0) return (
    <Layout hideNavigation={true}>
      <div className={`min-h-screen ${theme.bg} flex flex-col items-center justify-center p-6 text-center`}>
        <AlertCircle className="w-20 h-20 text-rose-500 mb-8 opacity-20" />
        <h1 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">Arena Not Found</h1>
        <p className="text-white/40 mb-10 font-medium">The requested assessment session is no longer active.</p>
        <Link to="/tests" className="px-10 py-5 bg-white text-black font-black rounded-2xl hover:scale-105 transition-all">Return to Assessment Hub</Link>
      </div>
    </Layout>
  );

  // --- START SCREEN ---
  if (!started && !finished) {
    return (
      <Layout hideNavigation={true}>
        <div className={`min-h-screen ${theme.bg} relative overflow-hidden flex flex-col items-center justify-center p-6 pt-20`}>
           {/* Visual Flourish */}
           <div className="fixed inset-0 pointer-events-none">
             <div className={`absolute top-[-10%] right-[-10%] w-[60%] h-[60%] ${theme.orb1} rounded-full blur-[140px] animate-pulse`} />
             <div className={`absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] ${theme.orb2} rounded-full blur-[140px] animate-pulse`} style={{ animationDelay: '2s' }} />
           </div>
           
           <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl w-full relative z-10 text-center space-y-16">
              <div className="space-y-8">
                 <div className={`inline-flex items-center gap-3 px-6 py-2 bg-white/5 border border-white/10 rounded-full ${theme.accent} text-[9px] font-black uppercase tracking-[0.4em] shadow-2xl`}>
                    <ShieldCheck className="w-4 h-4" /> Assessment Protocols Active
                 </div>
                 <h1 className="text-4xl md:text-7xl font-black text-white tracking-tighter leading-[0.9] uppercase italic">{test.title}</h1>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-8 max-w-3xl mx-auto">
                 {[
                   { label: 'Syllabus Modules', val: questions.length, icon: LayoutGrid, color: theme.accent },
                   { label: 'Time Allocation', val: `${test.timeLimit || 15}m`, icon: Clock, color: theme.accent },
                   { label: 'Academic Tier', val: 'PRO', icon: Award, color: theme.accent },
                 ].map((stat, i) => (
                   <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} key={i} className="p-8 bg-white/[0.03] border border-white/10 rounded-[2.5rem] group hover:border-white/30 transition-all shadow-xl">
                      <stat.icon className={`w-8 h-8 ${stat.color} mb-4 mx-auto opacity-30 group-hover:opacity-100 transition-all group-hover:scale-110`} />
                      <p className="text-2xl font-black text-white mb-1 tracking-tighter">{stat.val}</p>
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-widest">{stat.label}</p>
                   </motion.div>
                 ))}
              </div>

              <div className="flex flex-col md:flex-row items-center justify-center gap-6 pt-10">
                 {timeTaken > 0 ? (
                   <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                     <button onClick={() => setStarted(true)} className={`w-full md:w-auto px-12 py-6 ${theme.primary} text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:scale-105 transition-all shadow-xl flex items-center justify-center gap-3`}>
                        Resume Mission ({timeTaken}s) <RefreshCcw className="w-4 h-4" />
                     </button>
                     <button 
                       onClick={() => { localStorage.removeItem(storageKey); window.location.reload(); }} 
                       className="w-full md:w-auto px-12 py-6 bg-white/5 border border-white/10 text-white/40 font-black text-[10px] uppercase tracking-widest rounded-2xl hover:text-rose-500 transition-all"
                     >
                        Start Fresh Arena
                     </button>
                   </div>
                 ) : (
                   <button onClick={() => setStarted(true)} className="w-full md:w-auto px-16 py-7 bg-white text-black font-black text-[10px] uppercase tracking-[0.3em] rounded-3xl hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-4 group">
                      Enter Assessment Arena <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                   </button>
                 )}
                 <Link to="/tests" className="text-white/20 hover:text-white font-black text-[10px] uppercase tracking-[0.4em] transition-colors">Abort Assessment</Link>
              </div>
           </motion.div>
        </div>
      </Layout>
    );
  }

  // --- FINISHED SCREEN ---
  if (finished) {
    const isPassing = score >= 70;
    const getPerformanceTitle = (s: number) => {
      if (s === 100) return 'Paragon of Knowledge';
      if (s >= 90) return 'Elite Strategist';
      if (s >= 80) return 'Academic Grandmaster';
      if (s >= 70) return 'Certified Professional';
      return 'Emerging Talent';
    };

    return (
      <Layout hideNavigation={true}>
         <div className={`min-h-screen ${theme.bg} flex flex-col items-center p-6 relative overflow-y-auto custom-scrollbar pt-24 pb-32`}>
           <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl w-full bg-white/[0.03] border border-white/10 rounded-[4rem] p-10 md:p-20 text-center space-y-20 relative z-10 mb-20 shadow-2xl">
              <div className="space-y-12">
                 <div className="relative inline-block">
                    <div className={`absolute inset-0 ${theme.orb1} rounded-full blur-[100px] animate-pulse`} />
                    <div className={`w-56 h-56 md:w-72 md:h-72 bg-gradient-to-tr ${theme.gradient} p-2 rounded-full relative z-10 shadow-3xl`}>
                       <div className="w-full h-full bg-[#050505] rounded-full flex flex-col items-center justify-center border-4 border-white/5 shadow-inner">
                          <span className="text-8xl md:text-[10rem] font-black text-white leading-none tracking-tighter tabular-nums">{score}</span>
                          <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.5em] mt-2">Proficiency Level</span>
                       </div>
                    </div>
                 </div>
                 <div className="space-y-6">
                    <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-tight uppercase italic break-words px-4">{getPerformanceTitle(score)}</h1>
                    <p className="text-lg md:text-xl text-white/40 font-medium max-w-xl mx-auto leading-relaxed opacity-60 italic">
                      {isPassing ? "Your curriculum synchronization is complete. Professional-grade proficiency has been archived." : "Diagnostic reveals gaps in current understanding. Re-synchronization with syllabus recommended."}
                    </p>
                 </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Time Invested', val: `${timeTaken}s`, icon: Clock, color: theme.accent },
                    { label: 'Accuracy', val: `${score}%`, icon: Target, color: theme.accent },
                    { label: 'Aids Utilized', val: hintsUsed.length, icon: Sparkles, color: theme.accent },
                    { label: 'Global Hall', val: 'Active', icon: Trophy, color: theme.accent, action: () => setSelectedRankTest(test) }
                  ].map((stat, i) => (
                    <motion.button 
                      key={i}
                      disabled={!stat.action}
                      onClick={stat.action}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                      className={`p-8 bg-white/[0.02] border border-white/5 rounded-[2.5rem] space-y-3 transition-all ${stat.action ? 'hover:bg-white/5 hover:border-white/20 cursor-pointer group' : 'cursor-default'}`}
                    >
                      <stat.icon className={`w-6 h-6 ${stat.color} mb-2 mx-auto ${stat.action ? 'group-hover:scale-110 transition-transform' : 'opacity-40'}`} />
                      <p className="text-[8px] font-black text-white/30 uppercase tracking-[0.4em]">{stat.label}</p>
                      <p className="text-2xl md:text-3xl font-black text-white tracking-tighter tabular-nums">{stat.val}</p>
                    </motion.button>
                  ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-10">
                 <button onClick={() => { localStorage.removeItem(storageKey); window.location.reload(); }} className="w-full sm:w-auto px-12 py-7 bg-white/5 border border-white/10 text-white/40 font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:text-white transition-all">Recalibrate Arena</button>
                 <Link to="/tests" className="w-full sm:w-auto px-20 py-7 bg-white text-black font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl shadow-3xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4">Return to Assessment Hub <ArrowRight className="w-5 h-5" /></Link>
              </div>
           </motion.div>

           {/* Diagnostic Map */}
           <div className="max-w-4xl w-full relative z-10 space-y-10">
              <h2 className="text-3xl font-black text-white tracking-tighter text-center uppercase">Detailed Performance Diagnostic</h2>
              {questions.map((q, idx) => (
                <div key={q.id} className={`p-10 rounded-[3.5rem] border backdrop-blur-3xl transition-all hover:scale-[1.01] ${answers[q.id] === q.correctAnswer ? 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.05)]' : 'bg-rose-500/5 border-rose-500/20 shadow-[0_0_40px_rgba(244,63,94,0.05)]'}`}>
                   <div className="flex items-start gap-8 mb-12">
                      <div className={`w-14 h-14 rounded-3xl flex items-center justify-center shrink-0 mt-1 shadow-2xl ${answers[q.id] === q.correctAnswer ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                        {answers[q.id] === q.correctAnswer ? <CheckCircle className="w-7 h-7" /> : <ZapOff className="w-7 h-7" />}
                      </div>
                      <div className="flex-1 space-y-4">
                         <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em]">Checkpoint {idx + 1}</span>
                            {hintsUsed.includes(q.id) && <span className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[8px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2"><Sparkles className="w-3 h-3" /> Assisted</span>}
                         </div>
                         <h3 className="text-2xl md:text-3xl font-black text-white/90 leading-tight tracking-tight uppercase italic">{q.questionText}</h3>
                      </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.options.map((opt, oIdx) => (
                         <div key={oIdx} className={`px-8 py-6 rounded-3xl border flex items-center justify-between gap-4 font-black text-xs uppercase tracking-tight transition-all ${q.correctAnswer === oIdx ? 'bg-emerald-500/20 border-emerald-500/40 text-white' : answers[q.id] === oIdx ? 'bg-rose-500/20 border-rose-500/40 text-white' : 'bg-white/[0.02] border-white/5 text-white/20 opacity-40'}`}>
                            {opt} {q.correctAnswer === oIdx ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : answers[q.id] === oIdx && <ZapOff className="w-4 h-4 text-rose-400" />}
                         </div>
                      ))}
                   </div>
                </div>
              ))}
           </div>
         </div>
      </Layout>
    );
  }

  // --- ACTIVE SESSION ---
  const currentQ = questions[currentIdx];
  const totalQuestions = questions.length;
  const progressPercent = ((currentIdx + 1) / totalQuestions) * 100;

  return (
    <Layout hideNavigation={true}>
      <div className={`min-h-screen ${theme.bg} relative flex flex-col p-4 md:p-8 overflow-hidden select-none transition-colors duration-1000`}>
        {/* Dynamic Effects */}
        <div className="fixed inset-0 pointer-events-none opacity-40">
           <div className={`absolute top-[5%] right-[-5%] w-[50%] h-[50%] ${theme.orb1} rounded-full blur-[140px]`} />
           <div className={`absolute bottom-[5%] left-[-5%] w-[50%] h-[50%] ${theme.orb2} rounded-full blur-[140px]`} />
        </div>

        <div className="max-w-7xl mx-auto w-full flex flex-col flex-1 relative z-10">
          <header className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12 md:mb-20 pt-2">
            <Link to="/tests" className="w-full md:w-auto group flex items-center justify-center gap-3 px-6 py-4 bg-white/5 border border-white/10 text-white/40 hover:text-white rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest">
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Disconnect Session
            </Link>
            
            <div className="flex-1 w-full space-y-5">
                <div className="flex justify-between items-center px-2">
                   <div className="flex items-center gap-4">
                      <div className={`p-2.5 ${theme.bgPrimarySoft} rounded-xl relative`}>
                         <Brain className={`w-5 h-5 ${theme.textPrimary} animate-pulse`} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Academic Synchronization</span>
                        <span className="text-[9px] font-black text-white/30 uppercase tracking-widest opacity-40">Module {currentIdx + 1} / {totalQuestions}</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-6">
                      <div className="hidden sm:flex items-center gap-2.5 px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-full">
                         <Target className="w-3.5 h-3.5 text-emerald-500" />
                         <span className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em]">{Object.keys(answers).length} Registered</span>
                      </div>
                      <span className="text-3xl font-black text-white tabular-nums tracking-tighter">{Math.round(progressPercent)}%</span>
                   </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden p-0.5">
                   <motion.div layoutId="p-bar" className={`h-full bg-gradient-to-r ${theme.gradient} rounded-full ${theme.glow}`} animate={{ width: `${progressPercent}%` }} />
                </div>
            </div>

            <div className="flex items-center gap-4 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl shadow-xl backdrop-blur-md">
               <TimerIcon className={`w-5 h-5 ${timeTaken > (test.timeLimit || 15) * 60 ? 'text-rose-500 animate-pulse' : theme.accent}`} />
               <span className={`text-xl font-black tabular-nums tracking-tighter ${timeTaken > (test.timeLimit || 15) * 60 ? 'text-rose-500' : 'text-white'}`}>{formatDuration(timeTaken)}</span>
            </div>
          </header>

          <main className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentIdx} 
                initial={{ opacity: 0, scale: 0.98, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.98, x: -20 }} transition={{ duration: 0.4 }}
                className="space-y-16"
              >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12">
                      <div className="space-y-10 flex-1">
                         <div className={`inline-flex items-center gap-3 px-5 py-2 ${theme.bgPrimarySoft} border ${theme.borderPrimarySoft} rounded-full ${theme.accent} text-[9px] font-black uppercase tracking-[0.5em] shadow-xl`}>
                            <Zap className="w-3 h-3" /> Core Assessment Module
                         </div>
                         <h2 className="text-3xl md:text-6xl font-black tracking-tight text-white leading-[1] uppercase italic transition-all break-words hyphens-auto">{currentQ.questionText}</h2>
                      </div>
                      
                      {currentQ.hint && (
                         <div className="shrink-0 flex flex-col items-center gap-6">
                            <AnimatePresence>
                               {showHint && (
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                    className="p-8 bg-amber-500/10 border border-amber-500/30 rounded-[3rem] max-w-xs text-center shadow-3xl relative backdrop-blur-3xl"
                                  >
                                     <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 p-2 rounded-xl shadow-xl"><Lightbulb className="w-5 h-5 text-white" /></div>
                                     <p className="text-xs font-black text-amber-200 leading-relaxed italic uppercase tracking-tighter">"{currentQ.hint}"</p>
                                  </motion.div>
                               )}
                            </AnimatePresence>
                            <button 
                               onClick={handleUseHint}
                               className={`p-8 rounded-[3rem] border transition-all duration-700 relative group overflow-hidden ${showHint ? 'bg-amber-500 border-amber-500 shadow-2xl' : 'bg-white/5 border-white/10 hover:border-amber-500/50'}`}
                            >
                               <Sparkles className={`w-10 h-10 ${showHint ? 'text-white' : 'text-amber-500/30 group-hover:text-amber-500'} transition-all`} />
                               {!showHint && <div className="absolute top-2 right-2 flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" /></div>}
                            </button>
                            <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.5em]">Request Support [H]</span>
                         </div>
                      )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {currentQ.options.map((opt, i) => {
                        const isSelected = answers[currentQ.id] === i;
                        return (
                          <motion.button 
                            whileTap={{ scale: 0.98 }} 
                            key={i} 
                            onClick={() => handleSelectAnswer(currentQ.id, i)}
                            className={`group relative p-6 md:p-8 rounded-[2.5rem] border text-left transition-all duration-500 ${isSelected ? `${theme.primary} border-white/40 shadow-2xl` : 'bg-white/[0.03] border-white/10 hover:border-white/30 hover:bg-white/[0.05]'}`}
                          >
                             <div className="flex items-center gap-6">
                                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center font-black transition-all text-xl md:text-2xl shadow-inner ${isSelected ? 'bg-white/20 text-white' : `bg-white/5 text-white/20 ${theme.groupHoverText} group-hover:bg-white/10`}`}>{String.fromCharCode(65 + i)}</div>
                                <span className={`text-xl md:text-2xl font-black tracking-tight leading-tight uppercase italic break-words flex-1 ${isSelected ? 'text-white' : 'text-white/60 group-hover:text-white'}`}>{opt}</span>
                            </div>
                            {isSelected && <motion.div layoutId="sel-tick" className="absolute top-8 right-8 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-2xl"><CheckCircle className={`w-6 h-6 ${theme.textPrimary}`} /></motion.div>}
                          </motion.button>
                        );
                    })}
                  </div>
              </motion.div>
            </AnimatePresence>
          </main>

          <footer className="mt-auto py-8 grid grid-cols-1 md:grid-cols-3 items-center gap-8 border-t border-white/5">
            <div className="flex items-center gap-3 text-white/10 font-black text-[8px] uppercase tracking-[0.4em] italic justify-center md:justify-start">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" /> Academic Encryption Active
            </div>
            
            <div className="flex items-center justify-center gap-3">
              {questions.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${idx === currentIdx ? `${theme.primary} w-4` : answers[questions[idx].id] !== undefined ? 'bg-emerald-500/40' : 'bg-white/10'}`}
                />
              ))}
            </div>

            <div className="flex items-center justify-center md:justify-end gap-4 w-full">
                {currentIdx > 0 && (
                  <button 
                    onClick={() => setCurrentIdx(currentIdx - 1)} 
                    className="px-8 py-4 bg-white/5 border border-white/10 text-white/30 font-black text-[10px] uppercase tracking-widest rounded-xl hover:text-white hover:border-white/30 transition-all"
                  >
                    Previous Module
                  </button>
                )}
                {currentIdx < totalQuestions - 1 ? (
                  <button 
                    onClick={handleNext} 
                    disabled={answers[currentQ.id] === undefined} 
                    className="flex-1 md:flex-none px-12 py-5 bg-white text-black rounded-xl font-black text-[10px] uppercase tracking-widest shadow-2xl hover:scale-[1.03] active:scale-95 disabled:opacity-20 transition-all flex items-center justify-center gap-3"
                  >
                    Proceed Module <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button 
                    onClick={handleFinish} 
                    disabled={answers[currentQ.id] === undefined || submitting} 
                    className={`flex-1 md:flex-none px-14 py-5 ${theme.primary} text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.03] active:scale-95 disabled:opacity-20 transition-all flex items-center justify-center gap-3`}
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <>Finalize Assessment <PartyPopper className="w-5 h-5" /></>}
                  </button>
                )}
            </div>
          </footer>
        </div>
      </div>
      <LeaderboardModal test={selectedRankTest} onClose={() => setSelectedRankTest(null)} />
    </Layout>
  );
}

// --- THEME UTILS ---
const getThemeConfig = (themeName?: string) => {
  const themes: Record<string, any> = {
    dark: {
      bg: 'bg-[#050505]',
      primary: 'bg-primary',
      textPrimary: 'text-primary',
      accent: 'text-primary',
      groupHoverText: 'group-hover:text-primary',
      borderPrimary: 'border-primary',
      borderPrimarySoft: 'border-primary/20',
      bgPrimarySoft: 'bg-primary/10',
      gradient: 'from-primary via-indigo-500 to-primary',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.4)]',
      orb1: 'bg-primary/5',
      orb2: 'bg-indigo-500/5'
    },
    neon: {
      bg: 'bg-[#0f051a]',
      primary: 'bg-pink-500',
      textPrimary: 'text-pink-500',
      accent: 'text-pink-500',
      groupHoverText: 'group-hover:text-pink-500',
      borderPrimary: 'border-pink-500',
      borderPrimarySoft: 'border-pink-500/20',
      bgPrimarySoft: 'bg-pink-500/10',
      gradient: 'from-pink-500 via-cyan-400 to-pink-500',
      glow: 'shadow-[0_0_15px_rgba(236,72,153,0.4)]',
      orb1: 'bg-pink-500/10',
      orb2: 'bg-cyan-500/10'
    },
    emerald: {
      bg: 'bg-[#051a05]',
      primary: 'bg-emerald-500',
      textPrimary: 'text-emerald-500',
      accent: 'text-emerald-500',
      groupHoverText: 'group-hover:text-emerald-500',
      borderPrimary: 'border-emerald-500',
      borderPrimarySoft: 'border-emerald-500/20',
      bgPrimarySoft: 'bg-emerald-500/10',
      gradient: 'from-emerald-500 via-lime-400 to-emerald-500',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]',
      orb1: 'bg-emerald-500/10',
      orb2: 'bg-lime-500/10'
    },
    royal: {
      bg: 'bg-[#120a1a]',
      primary: 'bg-amber-500',
      textPrimary: 'text-amber-500',
      accent: 'text-amber-500',
      groupHoverText: 'group-hover:text-amber-500',
      borderPrimary: 'border-amber-500',
      borderPrimarySoft: 'border-amber-500/20',
      bgPrimarySoft: 'bg-amber-500/10',
      gradient: 'from-amber-500 via-yellow-400 to-amber-500',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',
      orb1: 'bg-amber-500/10',
      orb2: 'bg-yellow-500/10'
    },
    crimson: {
      bg: 'bg-[#1a0a0a]',
      primary: 'bg-rose-500',
      textPrimary: 'text-rose-500',
      accent: 'text-rose-500',
      groupHoverText: 'group-hover:text-rose-500',
      borderPrimary: 'border-rose-500',
      borderPrimarySoft: 'border-rose-500/20',
      bgPrimarySoft: 'bg-rose-500/10',
      gradient: 'from-rose-500 via-orange-400 to-rose-500',
      glow: 'shadow-[0_0_15px_rgba(244,63,94,0.4)]',
      orb1: 'bg-rose-500/10',
      orb2: 'bg-orange-500/10'
    }
  };
  return themes[themeName || 'dark'] || themes.dark;
};

