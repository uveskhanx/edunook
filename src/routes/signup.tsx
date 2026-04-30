import React, { useState, useEffect, useRef } from 'react';
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { auth, db } from '@/lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  updateProfile
} from 'firebase/auth';
import { ref, set, runTransaction } from 'firebase/database';
import { DbService } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { 
  Lock, User, CheckCircle2, XCircle, 
  Loader2, Sparkles, ArrowRight, AtSign, 
  Eye, EyeOff, Calendar, Phone, ChevronLeft,
  Mail, ShieldCheck, Fingerprint, Info
} from 'lucide-react';
import { AuthService } from '@/lib/auth-service';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { differenceInMonths, parseISO, isFuture } from 'date-fns';
import { sendSignupOTPEmailAction, verifySignupOTPAction } from '@/lib/server/email-actions';

export const Route = createFileRoute('/signup')({
  head: () => ({
    meta: [
      { title: 'Create Account — EduNook' },
    ],
  }),
  component: SignupPage,
});

type Step = 1 | 2 | 3;

function SignupPage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  
  // Multi-step State
  const [step, setStep] = useState<Step>(1);
  
  // Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [realEmail, setRealEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dobError, setDobError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Validation States
  const [isUsernameValid, setIsUsernameValid] = useState<boolean | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

  // Refs for auto-focus
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Username Real-time Validation
  useEffect(() => {
    const checkUsername = async () => {
      if (!username) {
        setIsUsernameValid(null);
        setUsernameSuggestions([]);
        return;
      }
      
      const normalized = username.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (normalized !== username) setUsername(normalized);
      
      setUsernameLoading(true);
      const available = await DbService.checkUsernameAvailability(normalized);
      setIsUsernameValid(available);
      
      if (!available) {
        // Generate random suggestions
        const randomSuffixes = [
          Math.floor(Math.random() * 1000),
          Math.floor(Math.random() * 100),
          new Date().getFullYear()
        ];
        
        const possibleSuggestions = randomSuffixes.map(s => `${normalized}${s}`);
        
        // Verify suggestions in parallel
        const verifiedSuggestions = await Promise.all(
          possibleSuggestions.map(async (s) => {
            const isAvail = await DbService.checkUsernameAvailability(s);
            return isAvail ? s : null;
          })
        );
        
        setUsernameSuggestions(verifiedSuggestions.filter(Boolean) as string[]);
      } else {
        setUsernameSuggestions([]);
      }
      
      setUsernameLoading(false);
    };

    const timer = setTimeout(checkUsername, 500);
    return () => clearTimeout(timer);
  }, [username]);

  useEffect(() => {
    if (authUser && !loading) {
      navigate({ to: '/home' });
    }
  }, [authUser, navigate, loading]);

  const handleNext = () => {
    if (step === 1) {
      if (!fullName || !isUsernameValid || !dob) return;
      
      const birthDate = parseISO(dob);
      if (isFuture(birthDate)) {
        setDobError('Invalid date');
        return;
      }
      
      const months = differenceInMonths(new Date(), birthDate);
      if (months < 42) { // 3.5 years = 42 months
        setDobError('Minimum age requirement is 3.5 years');
        return;
      }
    }
    setStep(2);
    setError('');
    setDobError('');
  };

  const handleBack = () => {
    setStep(1);
    setError('');
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !realEmail || password.length < 6) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(realEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setError('');
    setLoading(true);

    try {
      await sendSignupOTPEmailAction({
        data: {
          email: realEmail,
          username: username || 'student'
        }
      });

      setStep(3);
      setResendTimer(60);
      toast.success("Verification code sent to your email!");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Email OTP Send Error:", err);
      setError(err.message || "Failed to send verification email");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !verificationCode || !realEmail) return;
    
    setError('');
    setLoading(true);

    const cleanUsername = username.toLowerCase().trim();
    const virtualEmail = AuthService.getInternalEmail(cleanUsername);
    let tempUser = null;

    try {
      // 1. Verify Email OTP
      try {
        await verifySignupOTPAction({
          data: {
            email: realEmail,
            code: verificationCode
          }
        });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (confirmErr: any) {
        throw new Error(confirmErr.message || "Invalid verification code.");
      }

      // 2. Create Auth account
      const userCred = await createUserWithEmailAndPassword(auth, virtualEmail, password);
      tempUser = userCred.user;

      // 3. Claim Username
      const usernameRef = ref(db, `usernames/${cleanUsername}`);
      const transactionResult = await runTransaction(usernameRef, (currentVal) => {
        if (currentVal === null) return tempUser!.uid;
        return;
      });

      if (!transactionResult.committed) {
        throw new Error("Username was claimed during verification.");
      }

      // 4. Save Profile
      const userData = {
        uid: tempUser.uid,
        fullName,
        username: cleanUsername,
        email: virtualEmail,
        realEmail: realEmail,
        dob: dob,
        phone: `${countryCode}${phone}`,
        role: 'student' as const,
        createdAt: new Date().toISOString(),
      };

      await set(ref(db, `users/${tempUser.uid}`), userData);
      await updateProfile(tempUser, { displayName: fullName });

      toast.success('Account verified and created!');
      navigate({ to: '/home' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error('Final Signup Error:', err);
      if (tempUser) await tempUser.delete().catch(console.error);
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }


  return (
    <div 
      className="min-h-screen flex items-center justify-center px-4 md:px-6 py-12 md:py-20 relative overflow-hidden bg-[#020202]"
    >
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, 50, 0],
            y: [0, -30, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/20 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
            x: [0, -40, 0],
            y: [0, 60, 0]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-accent/20 rounded-full blur-[120px]" 
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
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">Your Learning Hub</p>
              </div>
           </Link>
           
           <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`h-1.5 rounded-full transition-all duration-500 ${
                    step === s ? 'w-8 bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 
                    step > s ? 'w-4 bg-success' : 'w-4 bg-white/10'
                  }`} />
                  {s < 3 && <div className="w-1 h-1 rounded-full bg-white/5" />}
                </div>
              ))}
           </div>
        </div>

        <div 
          className="premium-glass-strong rounded-[2.5rem] p-6 md:p-10 shadow-2xl relative overflow-hidden group/card"
        >
          {/* Subtle Inner Glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-accent/5 pointer-events-none" />
          
          <form onSubmit={step === 3 ? handleFinalSubmit : handleSendCode} className="relative z-10">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div 
                  key="step1" 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-2 mb-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-2">
                      <Sparkles className="w-3 h-3" /> Step 01
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Your Profile</h2>
                    <p className="text-muted-foreground text-sm font-medium">Let's start with the basics</p>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2 group">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Full Name</label>
                      </div>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="John Doe"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && fullName && usernameRef.current?.focus()}
                          className="w-full pl-12 pr-4 py-4 bg-white/[0.02] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/[0.05] transition-all placeholder:text-white/10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 group">
                      <div className="flex justify-between items-center px-1">
                         <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Username</label>
                         {usernameLoading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                      </div>
                      <div className="relative">
                        <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                        <input
                          ref={usernameRef}
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="choose_username"
                          className={`w-full pl-12 pr-12 py-4 bg-white/[0.02] border rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/[0.05] transition-all placeholder:text-white/10 ${
                            isUsernameValid === true ? 'border-success/30' : isUsernameValid === false ? 'border-destructive/30' : 'border-white/5'
                          }`}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                           {isUsernameValid === true && (
                             <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                               <CheckCircle2 className="w-5 h-5 text-success" />
                             </motion.div>
                           )}
                           {isUsernameValid === false && (
                             <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                               <XCircle className="w-5 h-5 text-destructive" />
                             </motion.div>
                           )}
                        </div>
                      </div>
                      {isUsernameValid === false && (
                        <div className="space-y-3 mt-3">
                          <p className="text-[10px] font-bold text-destructive px-1 uppercase tracking-wider">Username already taken</p>
                          {usernameSuggestions.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[9px] font-bold text-white/40 px-1 uppercase tracking-widest">Available Alternatives:</p>
                              <div className="flex flex-wrap gap-2">
                                {usernameSuggestions.map(suggestion => (
                                  <button
                                    key={suggestion}
                                    onClick={() => setUsername(suggestion)}
                                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold text-white hover:bg-primary/20 hover:border-primary/40 transition-all cursor-pointer"
                                    type="button"
                                  >
                                    {suggestion}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 group">
                      <div className="flex justify-between items-center px-1">
                        <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Date of Birth</label>
                        {dobError && (
                          <motion.span 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-[10px] font-black text-destructive uppercase tracking-wider flex items-center gap-1"
                          >
                            <Info className="w-3 h-3" /> {dobError}
                          </motion.span>
                        )}
                      </div>
                      <div className="relative">
                        <Calendar className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${dobError ? 'text-destructive' : 'text-muted-foreground/40 group-focus-within:text-primary'}`} />
                        <input
                          type="date"
                          value={dob}
                          required
                          onChange={(e) => {
                            setDob(e.target.value);
                            setDobError('');
                          }}
                          className={`w-full pl-12 pr-4 py-4 bg-white/[0.02] border rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 transition-all [color-scheme:dark] group-focus-within:bg-white/[0.05] ${
                            dobError ? 'border-destructive/40 focus:ring-destructive/40' : 'border-white/5 focus:ring-primary/40'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!fullName || !isUsernameValid || !dob}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-black text-[16px] shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center gap-2 group/btn"
                  >
                    Continue <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </motion.div>
              ) : step === 2 ? (
                <motion.div 
                  key="step2" 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-2 mb-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest mb-2">
                      <ShieldCheck className="w-3 h-3" /> Step 02
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Security</h2>
                    <p className="text-muted-foreground text-sm font-medium">Protect your new account</p>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[12px] font-bold text-destructive text-center p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4 shrink-0" /> {error}
                    </motion.div>
                  )}

                  <div className="space-y-5">
                    <div className="space-y-2 group">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">Account Password</label>
                        {password && (
                          <span className={`text-[10px] font-black uppercase tracking-tighter ${
                            password.length < 6 ? 'text-destructive' : password.length < 10 ? 'text-warning' : 'text-success'
                          }`}>
                            {password.length < 6 ? 'Too Weak' : password.length < 10 ? 'Good' : 'Strong!'}
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                        <input
                          ref={passwordRef}
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full pl-12 pr-12 py-4 bg-white/[0.02] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/[0.05] transition-all placeholder:text-white/10"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)} 
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-white transition-colors"
                        >
                           {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {/* Password Strength Bar */}
                      {password && (
                        <div className="h-1 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ 
                              width: password.length < 6 ? '33%' : password.length < 10 ? '66%' : '100%',
                              backgroundColor: password.length < 6 ? '#ef4444' : password.length < 10 ? '#f59e0b' : '#22c55e'
                            }}
                            className="h-full transition-all duration-500"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 group">
                      <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider px-1">Real Email (Verification)</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                        <input
                          type="email"
                          value={realEmail}
                          onChange={(e) => setRealEmail(e.target.value)}
                          placeholder="you@gmail.com"
                          className="w-full pl-12 pr-4 py-4 bg-white/[0.02] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/[0.05] transition-all placeholder:text-white/10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 group">
                      <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider px-1">Phone Number (Optional)</label>
                      <div className="flex gap-2">
                         <div className="w-[85px] relative">
                            <input
                              type="text"
                              value={countryCode}
                              onChange={(e) => setCountryCode(e.target.value)}
                              className="w-full text-center py-4 bg-white/[0.02] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/[0.05] transition-all"
                            />
                         </div>
                         <div className="relative flex-1">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                            <input
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                              placeholder="Phone number"
                              className="w-full pl-12 pr-4 py-4 bg-white/[0.02] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/[0.05] transition-all placeholder:text-white/10"
                            />
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button" 
                      onClick={handleBack} 
                      disabled={loading} 
                      className="p-4 bg-white/[0.03] border border-white/10 text-muted-foreground hover:text-white rounded-2xl transition-all disabled:opacity-50 hover:bg-white/[0.08]"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      type="submit"
                      disabled={!realEmail || password.length < 6 || loading}
                      className="flex-1 py-4 bg-gradient-to-r from-primary to-accent text-white rounded-2xl font-black text-[16px] shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2 group/btn"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>Verify Email <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                      )}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="step3" 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="text-center space-y-2 mb-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 text-success text-[10px] font-black uppercase tracking-widest mb-2">
                      <Fingerprint className="w-3 h-3" /> Step 03
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">Verify Email</h2>
                    <p className="text-muted-foreground text-sm font-medium">Enter the 6-digit code sent to</p>
                    <p className="text-primary text-xs font-bold truncate px-4">{realEmail}</p>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[12px] font-bold text-destructive text-center p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4 shrink-0" /> {error}
                    </motion.div>
                  )}

                  <div className="space-y-6">
                    <div className="space-y-3 group">
                      <label className="text-xs font-bold text-muted-foreground/60 uppercase tracking-wider text-center block">Verification Code</label>
                      <div className="relative">
                        <input
                          type="text"
                          maxLength={6}
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="000000"
                          className="w-full px-6 py-5 bg-white/[0.02] border border-white/10 rounded-2xl text-center text-3xl font-black tracking-[0.6em] text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/[0.05] transition-all placeholder:text-white/5"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <button
                        type="submit"
                        disabled={verificationCode.length < 6 || loading}
                        className="w-full py-4 bg-success text-white rounded-2xl font-black text-[16px] shadow-lg shadow-success/20 hover:shadow-success/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2 group/btn"
                      >
                        {loading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>Complete Registration <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
                        )}
                      </button>
                      
                      <div className="text-center">
                        <button 
                          type="button"
                          disabled={resendTimer > 0 || loading}
                          onClick={() => {
                            // Trigger resend logic
                            toast.info("Resending code...");
                            setResendTimer(60);
                          }}
                          className="text-xs font-bold text-muted-foreground hover:text-white transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                        >
                          {resendTimer > 0 ? (
                            <>Resend code in <span className="text-primary">{resendTimer}s</span></>
                          ) : (
                            "Didn't receive the code? Resend"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          <div className="mt-8 text-center border-t border-white/5 pt-8">
            <p className="text-sm text-muted-foreground font-medium">
              Already have an account?{' '}
              <Link to="/login" className="text-white font-black hover:underline transition-all">
                Log In
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
