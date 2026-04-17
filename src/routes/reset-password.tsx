import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { confirmPasswordReset } from 'firebase/auth';
import { Lock, ShieldCheck, Loader2, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const searchParams = new URL(window.location.href).searchParams;
  const oobCode = searchParams.get('oobCode');

  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!oobCode) {
      setError('Invalid or expired reset link.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
      setTimeout(() => navigate({ to: '/login' }), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12 relative overflow-hidden">
      {/* Immersive Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] opacity-40" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="flex flex-col items-center mb-12 space-y-4">
           <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/30 border border-white/20">
              <ShieldCheck className="w-8 h-8 text-white" />
           </div>
           <h1 className="text-3xl font-black text-white tracking-widest uppercase premium-gradient-text tracking-[0.3em]">Vault Restoration</h1>
           <p className="text-muted-foreground font-medium text-center text-sm">Initialize your new security credentials.</p>
        </div>

        <div className="p-8 md:p-12 bg-card/30 backdrop-blur-3xl border border-white/5 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-8 py-6">
                 <div className="relative">
                    <div className="absolute inset-0 bg-success/20 blur-3xl rounded-full" />
                    <CheckCircle2 className="w-24 h-24 text-success mx-auto relative z-10 animate-bounce" />
                 </div>
                 <div className="space-y-2">
                    <h2 className="text-3xl font-black text-white">Access Granted.</h2>
                    <p className="text-muted-foreground font-medium leading-relaxed">Your encryption key has been updated. Porting you to the login terminal...</p>
                 </div>
                 <div className="flex gap-1 justify-center">
                    {[0, 1, 2].map(i => <motion.div key={i} animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, delay: i * 0.1 }} className="w-1 h-1 bg-primary rounded-full" />)}
                 </div>
              </motion.div>
            ) : !oobCode ? (
               <div className="text-center space-y-6 py-4">
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive font-bold text-xs uppercase tracking-widest">
                     Security Link Expired
                  </div>
                  <p className="text-muted-foreground font-medium text-sm">This reset request is no longer valid. Please initiate a new recovery session.</p>
                  <Link to="/forgot-password" title="New reset link" className="flex items-center justify-center gap-2 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase text-white hover:bg-white/10 transition-all">
                     <Sparkles className="w-4 h-4" />
                     New Recovery Request
                  </Link>
               </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                <AnimatePresence mode="wait">
                    {error && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-destructive text-center font-bold text-xs uppercase tracking-widest">
                        {error}
                      </motion.div>
                    )}
                </AnimatePresence>

                <div className="space-y-3 group">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">New Encryption Key</label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Specify your new secure code"
                      required
                      minLength={6}
                      className="w-full pl-14 pr-6 py-5 bg-background/50 border border-white/5 rounded-2xl text-white font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/20"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-6 bg-primary text-white rounded-2xl font-black text-lg shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Finalize Restoration <ArrowRight className="w-6 h-6" /></>}
                  </button>
                </div>
              </form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
