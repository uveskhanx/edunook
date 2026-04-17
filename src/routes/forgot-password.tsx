import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { 
  KeyRound, Loader2, Sparkles, 
  ArrowRight, Mail, ChevronLeft, 
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export const Route = createFileRoute('/forgot-password')({
  head: () => ({
    meta: [
      { title: 'Recover Account — EduNook' },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || loading) return;

    setError('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSubmitted(true);
      toast.success('Check your inbox!');
    } catch (err: any) {
      console.error('Reset Error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Account not found');
      } else {
        setError('Connection error, try again');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] px-6 py-12 relative overflow-hidden">
      {/* Premium Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full -z-10">
         <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />
         <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-500/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[400px]"
      >
        <div className="flex flex-col items-center mb-10 space-y-4">
           <Link to="/" className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-2xl shadow-primary/20">
                 <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-black tracking-tighter text-white uppercase">EduNook</span>
           </Link>
        </div>

        <div className="bg-[#0f0f0f]/80 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-3xl">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div 
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="text-center space-y-2 mb-8">
                  <h1 className="text-2xl font-black text-white">Reset Password</h1>
                  <p className="text-muted-foreground text-sm font-medium">Enter your email to recover access</p>
                </div>

                {error && (
                  <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl">
                    <AlertCircle className="w-4 h-4 text-destructive" />
                    <p className="text-destructive text-sm font-bold">{error}</p>
                  </div>
                )}

                <form onSubmit={handleReset} className="space-y-6">
                  <div className="space-y-2 group">
                    <label className="text-xs font-bold text-muted-foreground ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@email.com"
                        required
                        autoFocus
                        className="w-full pl-11 pr-4 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="w-full py-4 bg-gradient-to-r from-primary to-violet-600 text-white rounded-2xl font-black text-[16px] shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Send link <ArrowRight className="w-5 h-5" /></>}
                  </button>
                </form>

                <Link 
                  to="/login"
                  className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors font-medium"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Log In
                </Link>
              </motion.div>
            ) : (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-6 py-4"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                   <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-black text-white">Check Your Email</h2>
                  <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                    We've sent a password reset link to <br/>
                    <span className="text-white font-bold">{email}</span>
                  </p>
                </div>
                <div className="pt-4">
                  <Link 
                    to="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/[0.03] border border-white/5 rounded-2xl text-white font-bold text-sm hover:bg-white/[0.08] transition-all"
                  >
                    Return to Log In
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
