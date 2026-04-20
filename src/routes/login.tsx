import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useRef, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { 
  signInWithEmailAndPassword, 
  sendEmailVerification,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  Lock, Loader2, Sparkles, ArrowRight, 
  AtSign, Eye, EyeOff, Mail, CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { DbService } from '@/lib/db-service';
import { AuthService } from '@/lib/auth-service';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'Log In — EduNook' },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  
  // Form State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  // Focus Refs
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password || loading) return;

    setError('');
    setNeedsVerification(false);
    setLoading(true);

    try {
      const cleanUsername = identifier.toLowerCase().trim();

      // 1. Lookup UID connected to this username
      const uid = await DbService.getUidByUsername(cleanUsername);
      if (!uid) {
        throw new Error('auth/user-not-found');
      }

      // 2. Retrieve their mapped email (Legacy real email OR Modern virtual email)
      const profile = await DbService.getProfile(uid);
      if (!profile || !profile.email) {
        throw new Error('auth/user-not-found');
      }

      const profileEmail = profile.email;

      await signInWithEmailAndPassword(auth, profileEmail, password);

      // Success!
      toast.success('Welcome back!');
      navigate({ to: '/home' });
    } catch (err: any) {
      console.error('Login Error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.message === 'auth/user-not-found') {
        setError('Invalid username or password');
      } else if (err.code === 'auth/wrong-password') {
        setError('Invalid username or password');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error, try again');
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendLoading || !auth.currentUser) return;
    setResendLoading(true);
    try {
      await sendEmailVerification(auth.currentUser);
      toast.success('Verification link sent to your email');
    } catch (err: any) {
      toast.error('Failed to send link. Try again later.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!identifier) {
      toast.error('Please enter your username first to reset your password');
      return;
    }
    
    const toastId = toast.loading('Locating your account...');
    try {
      const cleanUsername = identifier.toLowerCase().trim();
      
      // Look up UID by Username
      const uid = await DbService.getUidByUsername(cleanUsername);
      if (!uid) {
        toast.error('No account found with this username.', { id: toastId });
        return;
      }
      
      // Get the hidden Profile Email
      const profile = await DbService.getProfile(uid);
      if (!profile || !profile.email) {
        toast.error('Could not find a recovery address for this account', { id: toastId });
        return;
      }

      await sendPasswordResetEmail(auth, profile.email);
      toast.success('Recovery link sent successfully!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to send reset link. Please try again.', { id: toastId });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] px-6 py-8 md:py-12 relative overflow-hidden">
      {/* Premium Professional Mesh Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Base Mesh */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[160px] animate-pulse duration-[10s]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-violet-600/15 rounded-full blur-[160px] animate-pulse duration-[8s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-accent/5 rounded-full blur-[200px]" />
        
        {/* Noise Overlay for texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[400px]"
      >
        <div className="flex flex-col items-center mb-6 md:mb-10 space-y-3 md:space-y-4">
           <Link to="/" className="flex items-center gap-3 group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-2xl shadow-primary/20 group-hover:scale-110 transition-transform duration-500">
                 <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-black tracking-tighter text-white uppercase">EduNook</span>
           </Link>
        </div>

        <div className="bg-[#0f0f0f]/40 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 md:p-10 shadow-[0_0_80px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-2xl font-black text-white">Welcome Back</h1>
              <p className="text-muted-foreground text-sm font-medium">Log in to your account</p>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl"
                >
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <p className="text-destructive text-sm font-bold">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-5">
              <div className="space-y-2 group">
                <label className="text-xs font-bold text-muted-foreground ml-1">Username</label>
                <div className="relative">
                  <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your username"
                    autoFocus
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    disabled={loading}
                    onKeyDown={(e) => e.key === 'Enter' && passwordRef.current?.focus()}
                    className="w-full pl-11 pr-4 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/20 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password Info */}
              <div className="space-y-2 group">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-bold text-muted-foreground">Password</label>
                  <button 
                    type="button" 
                    onClick={handleForgotPassword}
                    className="text-[11px] font-bold text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                    className="w-full pl-11 pr-12 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/20 disabled:opacity-50"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !identifier || !password}
                className="w-full py-4 bg-gradient-to-r from-primary to-violet-600 text-white rounded-2xl font-black text-[16px] shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2 group"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>Log In <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                )}
              </button>
            </div>

            {needsVerification && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex flex-col items-center space-y-3"
              >
                <p className="text-[11px] font-bold text-primary/80 text-center uppercase tracking-wider">Please verify your email first</p>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                >
                  {resendLoading ? 'Sending...' : 'Resend verification link'}
                </button>
              </motion.div>
            )}
          </form>

          <div className="mt-8 text-center border-t border-white/5 pt-8">
            <p className="text-sm text-muted-foreground font-medium">
              New to EduNook?{' '}
              <Link to="/signup" className="text-white font-black hover:underline underline-offset-4 decoration-primary transition-all">
                Create Account
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
