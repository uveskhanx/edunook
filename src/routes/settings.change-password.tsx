import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Eye, EyeSlash, 
  ArrowLeft, ShieldCheck, CheckCircle,
  WarningCircle, Key
} from '@phosphor-icons/react';
import { auth } from '@/lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { toast } from 'sonner';

export const Route = createFileRoute('/settings/change-password')({
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Verification
  const [currentPassword, setCurrentPassword] = useState('');
  
  // Step 2: New Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (authLoading) return null;
  if (!user) {
    navigate({ to: '/login' });
    return null;
  }

  const handleVerifyCurrent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !auth.currentUser.email) return;

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      setError(null);
      setStep(2);
      toast.success("Identity verified", { description: "You can now set your new password." });
    } catch (err: any) {
      setError("The current password you entered is incorrect.");
      toast.error("Incorrect password", { description: "Please try again or use the forgot password flow." });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password too short", { description: "Password must be at least 6 characters." });
      return;
    }

    setLoading(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast.success("Password updated successfully");
      setTimeout(() => navigate({ to: '/settings' }), 1000);
    } catch (err: any) {
      toast.error("Update failed", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showSettings={false}>
      <div className="flex-1 w-full max-w-xl mx-auto px-4 py-12 md:py-24">
        
        {/* Navigation */}
        <button 
          onClick={() => navigate({ to: '/settings' })}
          className="group mb-12 flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-black uppercase tracking-widest">Back to Settings</span>
        </button>

        <div className="premium-glass p-8 md:p-12 rounded-[3.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
          {/* Subtle Background Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] -z-10" />
          
          <div className="text-center mb-10">
             <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 mx-auto mb-6">
                {step === 1 ? <ShieldCheck size={32} weight="duotone" /> : <Key size={32} weight="duotone" />}
             </div>
             <h1 className="text-3xl font-black text-white tracking-tighter mb-2">
                {step === 1 ? "Secure Verification" : "Create New Password"}
             </h1>
             <p className="text-muted-foreground font-medium text-sm">
                {step === 1 
                  ? "For your security, please confirm your current password to continue." 
                  : "Almost there! Choose a strong password that you haven't used before."}
             </p>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form 
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleVerifyCurrent}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 ml-4">Current Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                    <input 
                      type={showPassword ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full h-16 bg-white/[0.03] border border-white/5 rounded-2xl pl-14 pr-14 text-white font-bold focus:border-primary/50 focus:bg-white/[0.05] transition-all outline-none"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 mt-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-bold"
                    >
                      <WarningCircle size={16} weight="fill" />
                      {error}
                    </motion.div>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={loading || !currentPassword}
                  className="w-full h-16 bg-white text-black hover:bg-primary hover:text-white rounded-[1.5rem] font-black text-[13px] uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <>
                      Verify Identity
                      <ArrowRight weight="bold" />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleUpdatePassword}
                className="space-y-6"
              >
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 ml-4">New Password</label>
                      <div className="relative group">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                        <input 
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full h-16 bg-white/[0.03] border border-white/5 rounded-2xl pl-14 pr-6 text-white font-bold focus:border-primary/50 focus:bg-white/[0.05] transition-all outline-none"
                        />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 ml-4">Confirm New Password</label>
                      <div className="relative group">
                        <CheckCircle className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                        <input 
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full h-16 bg-white/[0.03] border border-white/5 rounded-2xl pl-14 pr-6 text-white font-bold focus:border-primary/50 focus:bg-white/[0.05] transition-all outline-none"
                        />
                      </div>
                   </div>
                </div>

                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3 items-start">
                   <WarningCircle size={20} className="text-primary shrink-0" weight="bold" />
                   <p className="text-[11px] font-medium text-primary/70 leading-relaxed">
                      Changing your password will not log you out of this session, but it will expire all other active sessions for security.
                   </p>
                </div>

                <button 
                  type="submit"
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full h-16 bg-primary text-white hover:bg-white hover:text-black rounded-[1.5rem] font-black text-[13px] uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Update Password
                      <ArrowRight weight="bold" />
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}

// Minimal ArrowRight icon to avoid missing export
function ArrowRight({ weight }: { weight?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor">
      <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L204.69,128,138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z"></path>
      <path d="M216,128H40a8,8,0,0,1,0-16H216a8,8,0,0,1,0,16Z" opacity="0.2"></path>
    </svg>
  );
}
