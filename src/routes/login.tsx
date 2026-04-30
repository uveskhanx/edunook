/* eslint-disable @typescript-eslint/no-explicit-any */
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
  AtSign, Eye, EyeOff, Mail,
  AlertCircle, ChevronLeft, ShieldCheck,
  HelpCircle
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

      const isValidPath = /^[a-zA-Z0-9_]+$/.test(cleanUsername);
      if (!isValidPath) {
         setError('Please enter a valid username (no spaces or special characters).');
         setLoading(false);
         return;
      }

      // 1. Lookup UID connected to this username
      const uid = await DbService.getUidByUsername(cleanUsername);
      if (!uid) {
        console.warn(`[Login] Username "${cleanUsername}" not found in database index.`);
        throw new Error('auth/user-not-found');
      }

      // 2. Retrieve their mapped email (Legacy real email OR Modern virtual email)
      const profile = await DbService.getProfile(uid);
      let profileEmail = profile?.email;

      if (!profileEmail) {
        console.warn(`[Login] Profile for UID "${uid}" is missing or has no email. Attempting recovery via internal mapping...`);
        // Self-Healing Fallback: Generate the virtual email if profile data is missing
        profileEmail = AuthService.getInternalEmail(cleanUsername);
      }

      await signInWithEmailAndPassword(auth, profileEmail, password);

      // Success!
      toast.success('Welcome back!');
      navigate({ to: '/home' });
    } catch (err: any) {
      console.error('Login Error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.message === 'auth/user-not-found') {
        setError('Hmm, we couldn\'t find that account. Please check your username and password.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Oops! That password doesn\'t look right. Try again?');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Connection problem. Please check your internet and try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a moment and try again.');
      } else {
        setError('Something went wrong on our end. Please try again in a bit.');
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


  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 md:px-6 py-12 md:py-20 relative overflow-hidden bg-[#020202]"
    >
      {/* Dynamic Background Elements - Aurora System */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, 60, 0],
            y: [0, -40, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-primary/20 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
            x: [0, -50, 0],
            y: [0, 70, 0]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-accent/20 rounded-full blur-[120px]" 
        />
        <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[440px] relative"
      >
        <div className="flex flex-col items-center mb-8 space-y-6">
           <Link to="/" className="flex flex-col items-center gap-4 group">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full group-hover:bg-primary/40 transition-colors duration-500" />
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-xl flex items-center justify-center shadow-2xl group-hover:scale-105 group-hover:rotate-3 transition-all duration-500 overflow-hidden relative z-10">
                   <img src="/logo.png" className="w-full h-full object-cover p-3 md:p-4" alt="Logo" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <span className="text-3xl md:text-4xl font-black text-white tracking-tighter group-hover:premium-gradient-text transition-all duration-500">
                  EduNook
                </span>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60 text-center">Your Learning Hub</p>
              </div>
           </Link>
        </div>

        <div 
          className="premium-glass-strong rounded-[2.5rem] p-6 md:p-10 shadow-2xl relative overflow-hidden group/card"
        >
          {/* Subtle Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-accent/5 pointer-events-none" />
          
          <form onSubmit={handleLogin} className="relative z-10 space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-2">
                <Sparkles className="w-3 h-3" /> Welcome Back
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Sign In</h1>
              <p className="text-muted-foreground text-sm font-medium">Ready to continue your learning journey?</p>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl"
                >
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                  <p className="text-destructive text-[13px] font-bold">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-6">
              <div className="space-y-2 group">
                <div className="flex items-center justify-between px-1">
                  <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Username</label>
                  <span className="text-[10px] text-muted-foreground/40 font-medium italic">Your unique identifier</span>
                </div>
                <div className="relative">
                  <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
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
                    className="w-full pl-12 pr-4 py-4 md:py-5 bg-white/[0.02] border border-white/5 rounded-2xl text-[16px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/[0.05] transition-all placeholder:text-white/10 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-2 group">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Password</label>
                  <Link 
                    to="/forgot-password"
                    className="text-[11px] font-bold text-primary hover:text-white transition-colors flex items-center gap-1 group/link"
                  >
                    <HelpCircle className="w-3 h-3 group-hover:rotate-12 transition-transform" /> Forgot?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                  <input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={loading}
                    className="w-full pl-12 pr-12 py-4 md:py-5 bg-white/[0.02] border border-white/5 rounded-2xl text-[16px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/[0.05] transition-all placeholder:text-white/10 disabled:opacity-50"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-4">
              <button
                type="submit"
                disabled={loading || !identifier || !password}
                className="w-full py-4 md:py-5 bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] animate-gradient text-white rounded-2xl font-black text-[17px] shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2 group/btn overflow-hidden relative"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                  <>
                    <span className="relative z-10">Let's Get Started</span>
                    <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform relative z-10" />
                  </>
                )}
              </button>
              
              <p className="text-center text-[13px] text-muted-foreground/60 font-medium">
                Not a member yet?{' '}
                <Link to="/signup" className="text-white font-black hover:underline underline-offset-4 decoration-primary transition-all">
                  Create Account
                </Link>
              </p>
            </div>

            {needsVerification && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-5 bg-primary/5 border border-primary/10 rounded-3xl flex flex-col items-center space-y-4"
              >
                <div className="flex items-center gap-2 text-primary">
                  <ShieldCheck className="w-5 h-5" />
                  <p className="text-[12px] font-black uppercase tracking-widest text-center">Verify Your Email</p>
                </div>
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="w-full py-3 bg-primary/10 hover:bg-primary text-primary hover:text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                >
                  {resendLoading ? 'Sending...' : 'Resend link'}
                </button>
              </motion.div>
            )}
          </form>
        </div>
      </motion.div>
    </div>
  );
}
