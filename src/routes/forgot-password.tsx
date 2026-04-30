/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { 
  KeyRound, Loader2, Sparkles, 
  ArrowRight, AtSign, ChevronLeft, 
  CheckCircle2, AlertCircle, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { sendPasswordResetAction } from '@/lib/server/email-actions';

export const Route = createFileRoute('/forgot-password')({
  head: () => ({
    meta: [
      { title: 'Recover Account — EduNook' },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || loading) return;

    setError('');
    setLoading(true);

    try {
      await sendPasswordResetAction({
        data: { username: username.toLowerCase().trim() }
      });
      setSubmitted(true);
      toast.success('Recovery link sent!');
    } catch (err: any) {
      console.error('Reset Error:', err);
      setError(err.message || 'Could not find that username');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] px-6 py-12 relative overflow-hidden">
      {/* Premium Background Effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[80%] h-[70%] bg-primary/20 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[80%] h-[70%] bg-violet-600/20 rounded-full blur-[140px] animate-pulse delay-700" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[420px]"
      >
        <div className="flex flex-col items-center mb-10 space-y-4">
           <Link to="/" className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-2xl shadow-primary/20">
                 <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-black tracking-tighter text-white uppercase">EduNook</span>
           </Link>
        </div>

        <div className="bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-[3rem] p-8 md:p-12 shadow-[0_30px_100px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Subtle Glass Highlight */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div 
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="text-center space-y-3">
                  <h1 className="text-3xl font-black text-white tracking-tight">Account Recovery</h1>
                  <p className="text-white/40 text-sm font-medium leading-relaxed">Enter your username and we'll send a <br/>reset link to your verified email.</p>
                </div>

                {error && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl"
                  >
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <p className="text-red-500 text-xs font-bold uppercase tracking-wider">{error}</p>
                  </motion.div>
                )}

                <form onSubmit={handleReset} className="space-y-6">
                  <div className="space-y-2 group">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 ml-2">EduNook Username</label>
                    <div className="relative">
                      <AtSign className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                        placeholder="your_username"
                        required
                        autoFocus
                        className="w-full pl-12 pr-6 py-5 bg-white/[0.04] border border-white/5 rounded-2xl text-[15px] text-white font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/40 transition-all placeholder:text-white/5"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !username}
                    className="w-full py-5 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 flex items-center justify-center gap-3"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Identify Me <ArrowRight className="w-5 h-5" /></>}
                  </button>
                </form>

                <Link 
                  to="/login"
                  className="flex items-center justify-center gap-2 text-xs text-white/20 hover:text-white transition-colors font-black uppercase tracking-widest"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Return to Login
                </Link>
              </motion.div>
            ) : (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-8 py-4"
              >
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                  <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto border border-primary/20 relative z-10">
                     <CheckCircle2 className="w-10 h-10 text-primary" />
                  </div>
                </div>

                <div className="space-y-3">
                  <h2 className="text-2xl font-black text-white tracking-tight">Email Dispatched!</h2>
                  <p className="text-white/40 text-sm font-medium leading-relaxed">
                    Check the inbox of your registered email address. <br/>
                    We've sent a secure link to reset your <b>@{username}</b> credentials.
                  </p>
                </div>

                <div className="pt-4 flex flex-col gap-4">
                  <Link 
                    to="/login"
                    className="w-full py-5 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-all text-center"
                  >
                    Go to Login
                  </Link>
                  <button 
                    onClick={() => setSubmitted(false)}
                    className="text-[10px] font-black text-white/20 uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Wrong username? Try again
                  </button>
                </div>

                <div className="pt-6 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-white/10">
                   <ShieldCheck className="w-3 h-3" /> Encrypted Recovery
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
