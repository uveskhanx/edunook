import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { DbService, TestRow, Question, Profile } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { 
  ChevronLeft, ChevronRight, CheckCircle, Clock, AlertCircle, Award, 
  Target, Sparkles, Loader2, PlayCircle, LogOut, Timer as TimerIcon, 
  Trophy, Zap, ShieldCheck, Activity, Monitor, LayoutGrid, User, ArrowRight,
  Star, Heart, Smile, PartyPopper
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

export const Route = createFileRoute('/test/$slug')({
  head: () => ({
    meta: [
      { title: 'Quiz Time! — EduNook' },
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
        toast.error('Something went wrong. Please try again.');
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
    if (!user || !test) {
      console.warn("User or Test missing at finish");
      toast.error("Please make sure you are signed in!");
      return;
    }

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
      // 1. Mark as finished locally first for immediate UI response
      setFinished(true);

      // 2. Try background saves
      try {
        await DbService.saveTestAttempt(user.id, {
          testId: test.id,
          testTitle: test.title,
          score: correct,
          total: questions.length,
          completedAt: new Date().toISOString(),
          answers: answers
        });

        await DbService.saveLeaderboardEntry(test.id, user.id, {
          score: finalScore,
          timeTaken: timeTaken,
          name: dbUser?.fullName || user.email?.split('@')[0] || 'Amazing Learner',
          avatar: dbUser?.avatarUrl || null
        });
      } catch (dbErr) {
        console.error("Background DB save failed:", dbErr);
        // We don't block the UI for this, just log it.
      }
      
      // 3. Celebrate!
      try {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#2dd4bf', '#fbbf24', '#f43f5e']
        });
      } catch (confettiErr) {
        console.error("Confetti failed:", confettiErr);
      }

      toast.success('You did it! Great job!');
    } catch (err) {
      console.error('Error in finish flow:', err);
      toast.error('We had a small problem, but your score is ready!');
      setFinished(true); // Ensure they see the score anyway
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout hideNavigation={true}>
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] gap-8">
          <div className="relative">
             <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
             <Sparkles className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="text-sm font-bold text-white/40 tracking-widest uppercase">Getting your quiz ready...</p>
        </div>
      </Layout>
    );
  }
  
  if (!test || questions.length === 0) {
    return (
      <Layout hideNavigation={true}>
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] p-6 text-center">
          <div className="w-32 h-32 bg-red-500/10 rounded-full flex items-center justify-center mb-8 border border-red-500/20">
            <AlertCircle className="w-16 h-16 text-red-500" />
          </div>
          <h1 className="text-4xl font-black text-white mb-4">Quiz Not Found</h1>
          <p className="text-muted-foreground mb-10 max-w-sm">We couldn't find this quiz. It might have been moved or deleted.</p>
          <Link to="/tests" className="px-10 py-5 bg-white text-black font-black rounded-2xl hover:scale-105 transition-all shadow-xl shadow-white/5">
            Back to All Quizzes
          </Link>
        </div>
      </Layout>
    );
  }

  // START SCREEN
  if (!started && !finished) {
    const now = new Date();
    const isTooEarly = test.activeStartAt && new Date(test.activeStartAt) > now;
    const isExpired = test.expiresAt && new Date(test.expiresAt) < now;

    if (isTooEarly || isExpired) {
      return (
        <Layout hideNavigation={true}>
          <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] p-6 text-center">
            <div className="w-32 h-32 bg-amber-500/10 rounded-full flex items-center justify-center mb-8 border border-amber-500/20">
              <Clock className="w-16 h-16 text-amber-500" />
            </div>
            <h1 className="text-4xl font-black text-white mb-4">
              {isTooEarly ? 'Quiz Not Started Yet' : 'Quiz Expired'}
            </h1>
            <p className="text-muted-foreground mb-10 max-w-sm">
              {isTooEarly 
                ? `This quiz will be available starting at ${new Date(test.activeStartAt!).toLocaleString()}.` 
                : `This quiz expired on ${new Date(test.expiresAt!).toLocaleString()} and is no longer accepting answers.`}
            </p>
            <Link to="/tests" className="px-10 py-5 bg-white text-black font-black rounded-2xl hover:scale-105 transition-all shadow-xl shadow-white/5">
              Back to All Quizzes
            </Link>
          </div>
        </Layout>
      );
    }

    return (
      <Layout hideNavigation={true}>
        <div className="min-h-screen bg-[#050505] relative overflow-hidden flex flex-col items-center justify-center p-4 md:p-6">
           {/* Abstract Background Orbs */}
           <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
           <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-accent/10 rounded-full blur-[120px] animate-pulse" />
           
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             className="max-w-4xl w-full relative z-10"
           >
              <div className="text-center space-y-8 md:space-y-12 mb-12 md:mb-16">
                 <div className="inline-flex items-center gap-2 px-5 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary text-[10px] md:text-xs font-black uppercase tracking-widest">
                    <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" /> Ready to learn?
                 </div>
                 <h1 className="text-4xl md:text-8xl font-black text-white tracking-tight leading-[0.9]">{test.title}</h1>
                 <p className="text-lg md:text-2xl text-white/50 font-medium max-w-2xl mx-auto leading-relaxed">
                    Take this fun quiz to see what you've learned! It's easy and exciting.
                 </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                 {[
                   { label: 'Questions', val: questions.length, icon: LayoutGrid, color: 'text-primary' },
                   { label: 'Minutes', val: test.timeLimit || 5, icon: Clock, color: 'text-emerald-400' },
                   { label: 'Teacher', val: test.profiles?.fullName?.split(' ')[0] || 'EduNook', icon: User, color: 'text-amber-400' },
                   { label: 'Level', val: 'Easy', icon: Activity, color: 'text-rose-400' },
                 ].map((stat, i) => (
                   <motion.div 
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: i * 0.1 }}
                     key={i} 
                     className="p-6 md:p-8 bg-white/[0.03] backdrop-blur-3xl rounded-[2rem] md:rounded-[2.5rem] border border-white/5 text-center group hover:bg-white/[0.05] transition-all"
                   >
                      <stat.icon className={`w-5 h-5 md:w-6 md:h-6 ${stat.color} mb-3 md:mb-4 mx-auto opacity-50 group-hover:opacity-100 transition-opacity`} />
                      <p className="text-2xl md:text-3xl font-black text-white mb-1 tracking-tighter">{stat.val}</p>
                      <p className="text-[9px] md:text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{stat.label}</p>
                   </motion.div>
                 ))}
              </div>

              <div className="mt-12 md:mt-16 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
                 <Link to="/tests" className="w-full md:w-auto px-10 py-5 md:py-7 text-white/40 hover:text-white font-black text-[10px] md:text-xs uppercase tracking-[0.2em] transition-colors text-center">
                    Go Back
                 </Link>
                 <button 
                   onClick={() => setStarted(true)}
                   className="w-full md:w-auto px-16 md:px-24 py-6 md:py-7 bg-primary text-white font-black text-base md:text-lg rounded-[1.5rem] md:rounded-[2rem] hover:scale-105 active:scale-95 transition-all shadow-[0_15px_40px_rgba(59,130,246,0.3)] flex items-center justify-center gap-4"
                 >
                    Start Quiz <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
                 </button>
              </div>
           </motion.div>
        </div>
      </Layout>
    );
  }

  // FINISHED SCREEN
  if (finished) {
    const isPassing = score >= 70;
    const now = new Date();
    const resultsPending = test.resultAnnounceAt && test.resultAnnounceAt !== 'immediate' && new Date(test.resultAnnounceAt) > now;

    if (resultsPending) {
      return (
        <Layout hideNavigation={true}>
           <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 md:p-6 text-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-50" />
              <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center mb-8 border border-primary/20 relative z-10">
                 <Clock className="w-16 h-16 text-primary" />
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-white mb-4 relative z-10 tracking-tighter">Answers Submitted!</h1>
              <p className="text-lg md:text-xl text-white/50 mb-10 max-w-lg relative z-10 font-medium">
                Your answers are securely saved. Results will be announced on <br/><span className="text-white font-bold">{new Date(test.resultAnnounceAt!).toLocaleString()}</span>.
              </p>
              <Link to="/tests" className="px-10 py-5 bg-white text-black font-black rounded-2xl hover:scale-105 transition-all shadow-xl shadow-white/5 relative z-10">
                 Back to All Quizzes
              </Link>
           </div>
        </Layout>
      );
    }
    
    return (
      <Layout hideNavigation={true}>
         <div className="min-h-screen bg-[#050505] flex flex-col items-center p-4 md:p-6 relative overflow-hidden overflow-y-auto custom-scrollbar pt-20">
           <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 opacity-50 pointer-events-none" />
           
           <motion.div 
             initial={{ opacity: 0, scale: 0.9, y: 20 }} 
             animate={{ opacity: 1, scale: 1, y: 0 }} 
             className="max-w-4xl w-full bg-white/[0.02] backdrop-blur-3xl rounded-[3rem] md:rounded-[4rem] border border-white/5 p-8 md:p-16 text-center space-y-12 md:space-y-16 relative z-10 mb-8"
           >
              <div className="space-y-6 md:space-y-8">
                 <div className="relative inline-block">
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-[60px]" />
                    <div className="w-36 h-36 md:w-56 md:h-56 bg-gradient-to-tr from-primary via-accent to-primary p-1.5 md:p-2 rounded-full relative z-10">
                       <div className="w-full h-full bg-[#050505] rounded-full flex flex-col items-center justify-center">
                          <span className="text-5xl md:text-8xl font-black text-white tabular-nums leading-none">{score}</span>
                          <span className="text-xs md:text-sm font-black text-white/30 uppercase tracking-widest mt-1 md:mt-2">Score</span>
                       </div>
                    </div>
                 </div>
                 
                 <div className="space-y-2 md:space-y-4">
                    <h1 className="text-4xl md:text-7xl font-black text-white tracking-tighter">
                       {isPassing ? 'Fantastic Job!' : 'Keep Practicing!'}
                    </h1>
                    <p className="text-base md:text-lg text-white/40 font-medium max-w-lg mx-auto">
                       {isPassing 
                         ? "You've mastered this topic! We're so proud of your hard work." 
                         : "Every mistake is a chance to learn. Try again and you'll get it!"}
                    </p>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                  <div className="p-6 md:p-8 bg-white/[0.03] rounded-2xl md:rounded-[2.5rem] border border-white/5 space-y-2">
                      <Clock className="w-5 h-5 md:w-6 md:h-6 text-primary mb-2 md:mb-3 mx-auto" />
                      <p className="text-[9px] md:text-[10px] font-black text-white/20 uppercase tracking-widest">Time Spent</p>
                      <p className="text-3xl md:text-4xl font-black text-white tabular-nums">{timeTaken}s</p>
                  </div>
                  <div className="p-6 md:p-8 bg-white/[0.03] rounded-2xl md:rounded-[2.5rem] border border-white/5 space-y-2">
                      <Target className="w-5 h-5 md:w-6 md:h-6 text-emerald-400 mb-2 md:mb-3 mx-auto" />
                      <p className="text-[9px] md:text-[10px] font-black text-white/20 uppercase tracking-widest">Accuracy</p>
                      <p className="text-3xl md:text-4xl font-black text-white tabular-nums">{score}%</p>
                  </div>
                  <div className="p-6 md:p-8 bg-white/[0.03] rounded-2xl md:rounded-[2.5rem] border border-white/5 space-y-2">
                      <Trophy className="w-5 h-5 md:w-6 md:h-6 text-amber-400 mb-2 md:mb-3 mx-auto" />
                      <p className="text-[9px] md:text-[10px] font-black text-white/20 uppercase tracking-widest">Your Rank</p>
                      <p className="text-3xl md:text-4xl font-black text-white">{score >= 90 ? 'Diamond' : score >= 70 ? 'Gold' : 'Silver'}</p>
                  </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 pt-4">
                 <button 
                   onClick={() => window.location.reload()}
                   className="w-full sm:w-auto px-10 md:px-12 py-5 md:py-6 bg-white/5 text-white font-black text-xs md:text-sm rounded-2xl md:rounded-[2rem] border border-white/10 hover:bg-white/10 transition-all uppercase tracking-widest"
                 >
                    Try Again
                 </button>
                 <Link to="/tests" className="w-full sm:w-auto px-16 md:px-20 py-6 md:py-7 bg-white text-black font-black text-xs md:text-sm rounded-2xl md:rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-center">
                    Finish & Go Home <ArrowRight className="w-4 h-4 md:w-5 md:h-5" />
                 </Link>
              </div>
           </motion.div>

           {/* Detailed Answers Section */}
           <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-4xl w-full relative z-10 space-y-4 mb-20"
           >
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter mb-6 text-center">Detailed Results</h2>
              {questions.map((q, idx) => {
                 const userAnswer = answers[q.id];
                 const isCorrect = userAnswer === q.correctAnswer;
                 const isUnanswered = userAnswer === undefined;
                 
                 return (
                   <div key={q.id} className={`p-6 md:p-8 rounded-3xl border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'} backdrop-blur-md`}>
                      <div className="flex items-start gap-4 mb-6">
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1 ${isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {isCorrect ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                         </div>
                         <div>
                            <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-2">Question {idx + 1}</p>
                            <p className="text-lg md:text-xl font-bold text-white/90 leading-relaxed">{q.questionText}</p>
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-0 md:pl-14">
                         {q.options.map((opt, optIdx) => {
                            const isSelected = userAnswer === optIdx;
                            const isActualCorrect = q.correctAnswer === optIdx;
                            
                            let optClass = "bg-white/[0.03] border-white/5 text-white/40";
                            let icon = null;

                            if (isActualCorrect) {
                               optClass = "bg-emerald-500/20 border-emerald-500/30 text-emerald-100 ring-2 ring-emerald-500/50";
                               icon = <CheckCircle className="w-4 h-4 text-emerald-400" />;
                            } else if (isSelected && !isActualCorrect) {
                               optClass = "bg-rose-500/20 border-rose-500/30 text-rose-100 ring-2 ring-rose-500/50";
                               icon = <AlertCircle className="w-4 h-4 text-rose-400" />;
                            }

                            return (
                               <div key={optIdx} className={`px-5 py-4 rounded-xl border flex items-center justify-between gap-3 ${optClass}`}>
                                  <span className="font-semibold text-sm">{opt}</span>
                                  {icon && <span className="shrink-0">{icon}</span>}
                               </div>
                            )
                         })}
                      </div>
                      {isUnanswered && (
                         <p className="mt-4 pl-0 md:pl-14 text-sm font-bold text-rose-400">You did not answer this question.</p>
                      )}
                   </div>
                 );
              })}
           </motion.div>
         </div>
      </Layout>
    );
  }

  const currentQ = questions[currentIdx];
  const progress = ((currentIdx + 1) / questions.length) * 100;

  return (
    <Layout hideNavigation={true}>
      <div className="min-h-screen bg-[#050505] relative flex flex-col p-4 md:p-8 overflow-x-hidden">
        
        {/* Floating Gradient Background */}
        <div className="fixed top-0 right-[-20%] w-[80%] h-[80%] bg-primary/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="fixed bottom-0 left-[-20%] w-[80%] h-[80%] bg-accent/5 rounded-full blur-[150px] pointer-events-none" />

        <div className="max-w-6xl mx-auto w-full flex flex-col flex-1 relative z-10">
          
          {/* Progress Header */}
          <header className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-12 mb-8 md:mb-20 pt-2 md:pt-4">
            <div className="w-full md:w-auto flex items-center justify-between md:justify-start gap-6">
                <Link to="/tests" className="group flex items-center gap-2 px-5 py-2.5 bg-white/5 text-white/40 hover:text-white rounded-xl md:rounded-2xl border border-white/5 transition-all font-bold text-[10px] md:text-xs uppercase tracking-widest">
                    <ChevronLeft className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:-translate-x-1 transition-transform" /> Exit
                </Link>

                <div className="flex md:hidden items-center gap-3 px-5 py-2.5 bg-white/5 rounded-xl border border-white/5">
                    <TimerIcon className="w-4 h-4 text-primary" />
                    <span className="text-base font-black text-white tabular-nums tracking-tighter">{timeTaken}s</span>
                </div>
            </div>
            
            <div className="flex-1 w-full space-y-3 md:space-y-4">
                <div className="flex justify-between items-center px-2">
                   <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Item {currentIdx + 1} of {questions.length}</span>
                   </div>
                   <span className="text-lg md:text-xl font-black text-white tabular-nums tracking-tighter">{Math.round(progress)}%</span>
                </div>
                <div className="h-2 md:h-2.5 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                  <motion.div 
                      layoutId="progress-bar"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-gradient-to-r from-primary to-accent rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                  />
                </div>
            </div>

            <div className="hidden md:flex items-center gap-4 px-6 py-3 bg-white/5 rounded-2xl border border-white/5">
                <TimerIcon className="w-5 h-5 text-primary" />
                <span className="text-xl font-black text-white tabular-nums tracking-tighter">{timeTaken}s</span>
            </div>
          </header>

          {/* Question Stage */}
          <main className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full py-8 md:py-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIdx}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="space-y-10 md:space-y-16"
              >
                  <div className="space-y-4 md:space-y-6">
                    <h2 className="text-3xl md:text-7xl font-black tracking-tight text-white leading-[1.2] md:leading-[1.1]">
                        {currentQ.questionText}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    {currentQ.options.map((opt, i) => (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          key={i}
                          onClick={() => setAnswers({ ...answers, [currentQ.id]: i })}
                          className={`group relative p-6 md:p-12 rounded-3xl md:rounded-[3rem] border text-left transition-all duration-300 ${
                            answers[currentQ.id] === i 
                              ? 'bg-primary border-primary shadow-[0_15px_40px_rgba(59,130,246,0.3)]' 
                              : 'bg-white/[0.03] border-white/5 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-5 md:gap-8">
                              <div className={`w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center font-black transition-all text-lg md:text-2xl ${
                                answers[currentQ.id] === i 
                                  ? 'bg-white text-primary' 
                                  : 'bg-white/5 text-white/20 group-hover:bg-white/10 group-hover:text-white'
                              }`}>
                                {String.fromCharCode(65 + i)}
                              </div>
                              <span className={`text-lg md:text-2xl font-bold tracking-tight leading-tight ${answers[currentQ.id] === i ? 'text-white' : 'text-white/60 group-hover:text-white'}`}>
                                {opt}
                              </span>
                          </div>
                        </motion.button>
                    ))}
                  </div>
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Navigation Controls */}
          <footer className="mt-8 md:mt-20 py-6 md:py-8 flex flex-col sm:flex-row items-center justify-between gap-6 md:gap-8">
            <div className="flex items-center gap-3 md:gap-4 text-white/20 font-bold text-[9px] md:text-[10px] uppercase tracking-[0.3em]">
               <ShieldCheck className="w-4 h-4 md:w-5 md:h-5 text-emerald-500 opacity-40" />
               Safe & Fun Environment
            </div>

            <div className="flex items-center gap-3 md:gap-4 w-full sm:w-auto">
                {currentIdx > 0 && (
                  <button 
                    onClick={() => setCurrentIdx(currentIdx - 1)}
                    className="flex-1 sm:flex-none px-8 md:px-10 py-5 md:py-6 bg-white/5 text-white/40 hover:text-white rounded-2xl md:rounded-[2rem] border border-white/5 transition-all font-black text-[10px] md:text-xs uppercase tracking-widest"
                  >
                    Back
                  </button>
                )}
                
                {currentIdx < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIdx(currentIdx + 1)}
                    disabled={answers[currentQ.id] === undefined}
                    className="flex-1 sm:flex-none px-12 md:px-16 py-5 md:py-6 bg-white text-black rounded-2xl md:rounded-[2rem] font-black text-xs md:text-sm uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 disabled:opacity-20 transition-all flex items-center justify-center gap-3"
                  >
                    Next <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                ) : (
                  <button
                    onClick={handleFinish}
                    disabled={answers[currentQ.id] === undefined || submitting}
                    className="flex-1 sm:flex-none px-16 md:px-20 py-6 md:py-7 bg-primary text-white rounded-2xl md:rounded-[2rem] font-black text-xs md:text-sm uppercase tracking-widest shadow-[0_15px_40px_rgba(59,130,246,0.4)] hover:scale-105 active:scale-95 disabled:opacity-20 transition-all flex items-center justify-center gap-3"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" /> : <>Finish Quiz <PartyPopper className="w-5 h-5 md:w-6 md:h-6" /></>}
                  </button>
                )}
            </div>
          </footer>
        </div>
      </div>
    </Layout>
  );
}
