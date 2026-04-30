import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { DbService, TestRow, Question, Profile } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { 
  ChevronLeft, ChevronRight, CheckCircle, Clock, AlertCircle, Award, 
  Target, Sparkles, Loader2, PlayCircle, LogOut, Timer as TimerIcon, 
  Trophy, Zap, ShieldCheck, Activity, Monitor, LayoutGrid, User, ArrowRight,
  Star, Heart, Smile, PartyPopper, RefreshCcw, ZapOff, Flame, Brain, Lightbulb,
  FileText, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { LeaderboardModal } from '@/components/LeaderboardModal';

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

  // Persistence Key
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

          // Restore progress if exists
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.testId === t.id && !parsed.finished) {
              setAnswers(parsed.answers || {});
              setHintsUsed(parsed.hintsUsed || []);
              setCurrentIdx(parsed.currentIdx || 0);
              setTimeTaken(parsed.timeTaken || 0);
              setStarted(true);
              toast.info('Assessment progress restored');
            }
          }
        }
      } catch (err) {
        console.error('Error loading test:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  // Save Progress Regularly
  useEffect(() => {
    if (started && !finished && test) {
      const state = {
        testId: test.id,
        answers,
        hintsUsed,
        currentIdx,
        timeTaken,
        finished: false
      };
      localStorage.setItem(storageKey, JSON.stringify(state));
    }
  }, [answers, hintsUsed, currentIdx, timeTaken, started, finished, test]);

  // Timer Logic
  useEffect(() => {
    if (started && !finished && test) {
      timerRef.current = setInterval(() => {
        setTimeTaken(prev => prev + 1);
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started, finished, test]);

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!started || finished || submitting) return;
      
      // Select Answer (1-4)
      if (['1', '2', '3', '4'].includes(e.key)) {
        const optIdx = parseInt(e.key) - 1;
        const currentQ = questions[currentIdx];
        if (currentQ && optIdx < currentQ.options.length) {
          handleSelectAnswer(currentQ.id, optIdx);
          setLastSelectedKey(optIdx);
          setTimeout(() => setLastSelectedKey(null), 150);
        }
      }

      // Next / Finish (Enter)
      if (e.key === 'Enter') {
        const currentQ = questions[currentIdx];
        if (answers[currentQ.id] !== undefined) {
           if (currentIdx < questions.length - 1) {
              handleNext();
           } else {
              handleFinish();
           }
        }
      }

      // Hint (h)
      if (e.key.toLowerCase() === 'h' && questions[currentIdx]?.hint) {
        handleUseHint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [started, finished, submitting, currentIdx, questions, answers]);

  const handleSelectAnswer = (qId: string, idx: number) => {
    setAnswers(prev => ({ ...prev, [qId]: idx }));
  };

  const handleUseHint = () => {
    const q = questions[currentIdx];
    if (!q || !q.hint) return;
    setShowHint(true);
    if (!hintsUsed.includes(q.id)) {
      setHintsUsed(prev => [...prev, q.id]);
    }
  };

  const handleNext = () => {
    setShowHint(false);
    setCurrentIdx(prev => prev + 1);
  };

  const handleFinish = async () => {
    if (!user || !test) return;

    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    let correct = 0;
    questions.forEach((q) => { if (answers[q.id] === q.correctAnswer) correct++; });

    const finalScore = Math.round((correct / questions.length) * 100);
    setScore(finalScore);

    try {
      setFinished(true);
      localStorage.setItem(storageKey, JSON.stringify({ finished: true }));

      await Promise.all([
        DbService.saveTestAttempt(user.id, {
          testId: test.id,
          testTitle: test.title,
          score: correct,
          total: questions.length,
          completedAt: new Date().toISOString(),
          answers,
          hintsUsed
        }),
        DbService.saveLeaderboardEntry(test.id, user.id, {
          score: finalScore,
          timeTaken,
          name: dbUser?.fullName || 'Amazing Learner',
          avatar: dbUser?.avatarUrl || null,
          hintsCount: hintsUsed.length
        })
      ]);

      confetti({
        particleCount: 250,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#3b82f6', '#8b5cf6', '#f43f5e', '#fbbf24']
      });

      toast.success('Assessment Successfully Completed!');
    } catch (err) {
      console.error('Finish error:', err);
      setFinished(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Live Stats
  const answeredCount = Object.keys(answers).length;
  const progressPercent = (answeredCount / questions.length) * 100;

  if (loading) return <Layout hideNavigation={true}><div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] gap-6"><Loader2 className="w-12 h-12 text-primary animate-spin" /><p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Establishing secure session...</p></div></Layout>;
  
  if (!test || questions.length === 0) return <Layout hideNavigation={true}><div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] p-6 text-center"><AlertCircle className="w-16 h-16 text-red-500 mb-6" /><h1 className="text-4xl font-black text-white mb-4">Quiz Missing</h1><Link to="/tests" className="px-10 py-5 bg-white text-black font-black rounded-2xl">Return to Hub</Link></div></Layout>;

  // START SCREEN
  if (!started && !finished) {
    return (
      <Layout hideNavigation={true}>
        <div className="min-h-screen bg-[#050505] relative overflow-hidden flex flex-col items-center justify-center p-6">
           <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] bg-primary/10 rounded-full blur-[150px] animate-pulse" />
           <div className="absolute bottom-[-20%] left-[-10%] w-[70%] h-[70%] bg-purple-500/10 rounded-full blur-[150px] animate-pulse" />
           
           <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl w-full relative z-10 text-center space-y-12">
              <div className="space-y-6">
                 <div className="inline-flex items-center gap-3 px-6 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary text-[10px] font-black uppercase tracking-[0.3em]">
                    <ShieldCheck className="w-4 h-4" /> Secure Environment Verified
                 </div>
                 <h1 className="text-5xl md:text-9xl font-black text-white tracking-tighter leading-[0.85]">{test.title}</h1>
                 <div className="bg-white/5 backdrop-blur-3xl p-10 rounded-[2.5rem] border border-white/10 max-w-2xl mx-auto space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">Assessment Objectives</p>
                    <p className="text-xl md:text-2xl text-white font-medium leading-relaxed italic">
                      "{test.description || "The creator has not provided a specific mission brief for this assessment. Standard proficiency protocols apply."}"
                    </p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                 {[
                   { label: 'Syllabus Modules', val: questions.length, icon: LayoutGrid, color: 'text-primary' },
                   { label: 'Time Threshold', val: `${test.timeLimit || 5}m`, icon: Clock, color: 'text-purple-400' },
                   { label: 'Assessment Owner', val: test.profiles?.fullName?.split(' ')[0] || 'Expert', icon: Shield, color: 'text-emerald-400' },
                 ].map((stat, i) => (
                   <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} key={i} className="p-8 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 group hover:bg-white/[0.08] transition-all">
                      <stat.icon className={`w-6 h-6 ${stat.color} mb-4 mx-auto opacity-40 group-hover:opacity-100 transition-opacity`} />
                      <p className="text-3xl font-black text-white mb-1 tracking-tighter">{stat.val}</p>
                      <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">{stat.label}</p>
                   </motion.div>
                 ))}
              </div>

              <div className="flex flex-col md:flex-row items-center justify-center gap-6 pt-10">
                 <button onClick={() => setStarted(true)} className="w-full md:w-auto px-20 py-7 bg-white text-black font-black text-lg rounded-[2rem] hover:scale-[1.03] active:scale-95 transition-all shadow-3xl flex items-center justify-center gap-4 group">
                    Begin Assessment Arena <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                 </button>
                 <Link to="/tests" className="text-white/40 hover:text-white font-black text-[10px] uppercase tracking-widest transition-all">Abort Mission</Link>
              </div>
           </motion.div>
        </div>
      </Layout>
    );
  }

  // FINISHED SCREEN
  if (finished) {
    const isPassing = score >= 70;
    const getPerformanceTitle = (s: number) => {
      if (s === 100) return 'Academic Paragon';
      if (s >= 90) return 'Elite Scholar';
      if (s >= 80) return 'Mastermind';
      if (s >= 70) return 'Certified Expert';
      return 'Knowledge Seeker';
    };

    return (
      <Layout hideNavigation={true}>
         <div className="min-h-screen bg-[#050505] flex flex-col items-center p-6 relative overflow-hidden overflow-y-auto custom-scrollbar pt-24 pb-32">
           <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-500/10 opacity-30 pointer-events-none" />
           
           <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-4xl w-full bg-white/[0.03] backdrop-blur-3xl rounded-[4rem] border border-white/10 p-10 md:p-20 text-center space-y-16 relative z-10 mb-20 shadow-3xl">
              <div className="space-y-10">
                 <div className="relative inline-block">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-[80px]" />
                    <div className="w-48 h-48 md:w-64 md:h-64 bg-gradient-to-tr from-primary via-purple-500 to-primary p-2 rounded-full relative z-10">
                       <div className="w-full h-full bg-[#050505] rounded-full flex flex-col items-center justify-center">
                          <span className="text-7xl md:text-9xl font-black text-white leading-none tracking-tighter">{score}</span>
                          <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mt-3">Final Percentile</span>
                       </div>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter leading-tight">{getPerformanceTitle(score)}</h1>
                    <p className="text-lg md:text-xl text-white/40 font-medium max-w-lg mx-auto leading-relaxed">
                       {isPassing ? "Your mastery of the curriculum has been verified. You've exceeded the proficiency threshold." : "The assessment reveals opportunities for further refinement. Mastery requires persistence."}
                    </p>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="p-8 bg-white/5 rounded-[2rem] border border-white/10 space-y-2">
                      <Clock className="w-6 h-6 text-primary mb-3 mx-auto" />
                      <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Duration</p>
                      <p className="text-3xl font-black text-white">{timeTaken}s</p>
                  </div>
                  <div className="p-8 bg-white/5 rounded-[2rem] border border-white/10 space-y-2">
                      <Target className="w-6 h-6 text-emerald-400 mb-3 mx-auto" />
                      <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Accuracy</p>
                      <p className="text-3xl font-black text-white">{score}%</p>
                  </div>
                  <div className="p-8 bg-white/5 rounded-[2rem] border border-white/10 space-y-2">
                      <Sparkles className="w-6 h-6 text-amber-400 mb-3 mx-auto" />
                      <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Hints Used</p>
                      <p className="text-3xl font-black text-white">{hintsUsed.length}</p>
                  </div>
                  <button onClick={() => setSelectedRankTest(test)} className="p-8 bg-white/5 rounded-[2rem] border border-white/10 space-y-2 hover:bg-primary/10 transition-all group">
                      <Trophy className="w-6 h-6 text-primary mb-3 mx-auto group-hover:rotate-12 transition-transform" />
                      <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.3em]">Board</p>
                      <p className="text-3xl font-black text-white">Ranks</p>
                  </button>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-10">
                 <button onClick={() => { localStorage.removeItem(storageKey); window.location.reload(); }} className="w-full sm:w-auto px-12 py-7 bg-white/5 text-white/40 font-black text-xs rounded-2xl border border-white/10 hover:text-white transition-all uppercase tracking-[0.2em]">Re-Attempt</button>
                 <Link to="/home" className="w-full sm:w-auto px-20 py-7 bg-white text-black font-black text-xs rounded-2xl shadow-3xl hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-4 uppercase tracking-[0.2em]">Finalize Standing <ArrowRight className="w-5 h-5" /></Link>
              </div>
           </motion.div>

           <div className="max-w-4xl w-full relative z-10 space-y-6">
              <h2 className="text-3xl font-black text-white tracking-tighter mb-10 text-center">Diagnostic Feedback</h2>
              {questions.map((q, idx) => (
                <div key={q.id} className={`p-10 rounded-[3rem] border ${answers[q.id] === q.correctAnswer ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'} backdrop-blur-3xl`}>
                   <div className="flex items-start gap-6 mb-10">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-1 ${answers[q.id] === q.correctAnswer ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{answers[q.id] === q.correctAnswer ? <CheckCircle className="w-6 h-6" /> : <ZapOff className="w-6 h-6" />}</div>
                      <div className="flex-1">
                         <div className="flex items-center justify-between gap-4 mb-3">
                            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Module {idx + 1}</p>
                            {hintsUsed.includes(q.id) && <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[8px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5"><Sparkles className="w-2.5 h-2.5" /> Assisted</span>}
                         </div>
                         <h3 className="text-2xl font-black text-white/90 leading-tight tracking-tight">{q.questionText}</h3>
                      </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.options.map((opt, oIdx) => (
                         <div key={oIdx} className={`px-8 py-5 rounded-2xl border flex items-center justify-between gap-4 font-bold text-sm ${q.correctAnswer === oIdx ? 'bg-emerald-500/20 border-emerald-500/30 text-white shadow-lg' : answers[q.id] === oIdx ? 'bg-rose-500/20 border-rose-500/30 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}>
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

  const currentQ = questions[currentIdx];
  const totalQuestions = questions.length;
  const currentProgress = ((currentIdx + 1) / totalQuestions) * 100;

  return (
    <Layout hideNavigation={true}>
      <div className="min-h-screen bg-[#050505] relative flex flex-col p-6 overflow-hidden select-none">
        <div className="fixed top-0 right-[-10%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="fixed bottom-0 left-[-10%] w-[60%] h-[60%] bg-purple-500/5 rounded-full blur-[150px] pointer-events-none" />

        <div className="max-w-6xl mx-auto w-full flex flex-col flex-1 relative z-10">
          <header className="flex flex-col md:flex-row items-center justify-between gap-10 mb-16 md:mb-24 pt-4">
            <Link to="/tests" className="group flex items-center gap-3 px-6 py-3 bg-white/5 text-white/30 hover:text-white rounded-2xl border border-white/5 transition-all font-black text-[10px] uppercase tracking-widest"><ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Exit Session</Link>
            
            <div className="flex-1 w-full space-y-4">
                <div className="flex justify-between items-center px-2">
                   <div className="flex items-center gap-3">
                      <div className="relative">
                         <Brain className="w-5 h-5 text-primary animate-pulse" />
                         <div className="absolute inset-0 bg-primary/30 blur-lg animate-pulse" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Mastery Point {currentIdx + 1} / {totalQuestions}</span>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                         <Target className="w-3 h-3 text-emerald-400" />
                         <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{answeredCount} Processed</span>
                      </div>
                      <span className="text-2xl font-black text-white tabular-nums tracking-tighter">{Math.round(currentProgress)}%</span>
                   </div>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden p-1 border border-white/10">
                   <motion.div layoutId="p-bar" initial={{ width: 0 }} animate={{ width: `${currentProgress}%` }} className="h-full bg-gradient-to-r from-primary via-purple-500 to-primary rounded-full shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]" />
                </div>
            </div>

            <div className="flex items-center gap-5 px-8 py-4 bg-white/5 rounded-[2rem] border border-white/10 group">
               <TimerIcon className={`w-6 h-6 transition-colors ${timeTaken > 300 ? 'text-rose-500' : 'text-primary'}`} />
               <span className={`text-2xl font-black tabular-nums tracking-tighter ${timeTaken > 300 ? 'text-rose-500' : 'text-white'}`}>{timeTaken}s</span>
            </div>
          </header>

          <main className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full">
            <AnimatePresence mode="wait">
              <motion.div key={currentIdx} initial={{ opacity: 0, x: 50, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -50, scale: 0.95 }} transition={{ type: 'spring', damping: 25 }} className="space-y-16">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
                      <div className="space-y-8 flex-1">
                         <span className="px-5 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary text-[9px] font-black uppercase tracking-[0.4em]">Advanced Proficiency Module</span>
                         <h2 className="text-4xl md:text-8xl font-black tracking-tight text-white leading-[1.1]">{currentQ.questionText}</h2>
                      </div>
                      
                      {currentQ.hint && (
                         <div className="shrink-0 flex flex-col items-center gap-4">
                            <AnimatePresence>
                               {showHint && (
                                  <motion.div 
                                    initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                    className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-[2rem] max-w-xs text-center shadow-2xl relative"
                                  >
                                     <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 p-1.5 rounded-lg"><Lightbulb className="w-4 h-4 text-white" /></div>
                                     <p className="text-xs font-bold text-amber-200 leading-relaxed italic">"{currentQ.hint}"</p>
                                  </motion.div>
                               )}
                            </AnimatePresence>
                            <button 
                              onClick={handleUseHint}
                              className={`p-6 rounded-[2rem] border transition-all duration-500 group relative ${showHint ? 'bg-amber-500 border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : 'bg-white/5 border-white/10 hover:border-amber-500/40'}`}
                            >
                               <Sparkles className={`w-8 h-8 ${showHint ? 'text-white' : 'text-amber-500/40 group-hover:text-amber-500'} transition-colors`} />
                               {!showHint && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span></span>}
                            </button>
                            <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Mastery Hint [H]</span>
                         </div>
                      )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {currentQ.options.map((opt, i) => {
                        const isSelected = answers[currentQ.id] === i;
                        const isLastKeyed = lastSelectedKey === i;
                        
                        return (
                          <motion.button 
                            whileHover={{ scale: 1.02 }} 
                            whileTap={{ scale: 0.98 }} 
                            animate={isLastKeyed ? { scale: [1, 1.05, 1], borderColor: 'rgba(var(--primary-rgb), 1)' } : {}}
                            key={i} 
                            onClick={() => handleSelectAnswer(currentQ.id, i)}
                            className={`group relative p-10 md:p-14 rounded-[3.5rem] border text-left transition-all duration-300 ${isSelected ? 'bg-primary border-primary shadow-[0_0_50px_rgba(var(--primary-rgb),0.3)]' : 'bg-white/5 border-white/10 hover:border-white/30'}`}
                          >
                            <div className="flex items-center gap-8">
                                <div className={`w-14 h-14 md:w-20 md:h-20 rounded-3xl flex items-center justify-center font-black transition-all text-2xl md:text-3xl ${isSelected ? 'bg-white text-primary' : 'bg-white/5 text-white/20 group-hover:bg-white/10 group-hover:text-white'}`}>{String.fromCharCode(65 + i)}</div>
                                <span className={`text-xl md:text-3xl font-bold tracking-tight leading-tight ${isSelected ? 'text-white' : 'text-white/60 group-hover:text-white'}`}>{opt}</span>
                            </div>
                            {isSelected && <motion.div layoutId="sel-tick" className="absolute top-8 right-8 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-2xl"><CheckCircle className="w-5 h-5 text-primary" /></motion.div>}
                          </motion.button>
                        );
                    })}
                  </div>
              </motion.div>
            </AnimatePresence>
          </main>

          <footer className="mt-16 md:mt-24 py-10 flex flex-col sm:flex-row items-center justify-between gap-10">
            <div className="flex items-center gap-4 text-white/20 font-black text-[10px] uppercase tracking-[0.4em]">
               <Activity className="w-6 h-6 text-emerald-500 opacity-40 animate-pulse" /> 
               Biometric Security: Encrypted Channel Active
            </div>
            <div className="flex items-center gap-5 w-full sm:w-auto">
                {currentIdx > 0 && <button onClick={() => setCurrentIdx(currentIdx - 1)} className="flex-1 sm:flex-none px-12 py-7 bg-white/5 text-white/40 hover:text-white rounded-[2rem] border border-white/10 transition-all font-black text-xs uppercase tracking-widest">Back</button>}
                {currentIdx < totalQuestions - 1 ? (
                  <button onClick={handleNext} disabled={answers[currentQ.id] === undefined} className="flex-1 sm:flex-none px-20 py-7 bg-white text-black rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-3xl hover:scale-[1.03] disabled:opacity-20 transition-all flex items-center justify-center gap-4">Next Module <ChevronRight className="w-5 h-5" /></button>
                ) : (
                  <button onClick={handleFinish} disabled={answers[currentQ.id] === undefined || submitting} className="flex-1 sm:flex-none px-24 py-8 bg-primary text-white rounded-[2.5rem] font-black text-sm uppercase tracking-[0.3em] shadow-[0_0_50px_rgba(var(--primary-rgb),0.5)] hover:scale-[1.05] disabled:opacity-20 transition-all flex items-center justify-center gap-5">
                    {submitting ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : <>Complete Assessment <PartyPopper className="w-6 h-6" /></>}
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
