import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { ref, set } from 'firebase/database';
import { DbService } from '@/lib/db-service';
import { AuthService } from '@/lib/auth-service';
import { useAuth } from '@/hooks/use-auth';
import { 
  Mail, Lock, User, CheckCircle2, XCircle, 
  Loader2, Sparkles, ArrowRight, AtSign, 
  Eye, EyeOff, Calendar, Phone, ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [dob, setDob] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Validation States
  const [isUsernameValid, setIsUsernameValid] = useState<boolean | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Refs for auto-focus
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Username Real-time Validation
  useEffect(() => {
    const checkUsername = async () => {
      if (!username) {
        setIsUsernameValid(null);
        setSuggestions([]);
        return;
      }
      
      const normalized = username.toLowerCase().replace(/\s+/g, '_');
      if (normalized !== username) setUsername(normalized);
      
      setUsernameLoading(true);
      const available = await DbService.checkUsernameAvailability(normalized);
      setIsUsernameValid(available);
      
      if (!available) {
        const suggested = await DbService.suggestUsernames(normalized);
        setSuggestions(suggested);
      } else {
        setSuggestions([]);
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
    if (step === 1 && (!fullName || !isUsernameValid)) return;
    if (step === 2 && (!email || !password || password.length < 6)) return;
    setStep((s) => (s + 1) as Step);
    setError('');
  };

  const handleBack = () => {
    setStep((s) => (s - 1) as Step);
    setError('');
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      // 1. Create the user with REAL EMAIL
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Reserve the username using the REAL UID
      const reserved = await DbService.reserveUsernameTransaction(username, user.uid);
      if (!reserved) {
        // Cleanup: If username was taken in the last split second, we delete the auth user
        await user.delete();
        setError('Username was just taken, try another');
        setStep(1);
        setLoading(false);
        return;
      }

      // 3. Save to Database
      const userData = {
        uid: user.uid,
        fullName,
        username: username.toLowerCase(),
        email: email,
        dob: dob,
        phone: `${countryCode}${phone}`,
        role: 'student' as const,
        createdAt: new Date().toISOString(),
      };

      await set(ref(db, `users/${user.uid}`), userData);

      // 4. Update Profile
      await updateProfile(user, { displayName: fullName });

      toast.success('Account created! Now log in.');
      navigate({ to: '/login' });
    } catch (err: any) {
      console.error('Signup Error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email already registered');
      } else {
        setError(err.message || 'Signup failed');
      }
    } finally {
      setLoading(false);
    }
  }

  const stepVariants = {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] px-6 py-8 md:py-12 relative overflow-hidden">
      {/* Premium Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full -z-10">
         <div className="absolute top-[20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />
         <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] bg-violet-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[400px]"
      >
        <div className="flex flex-col items-center mb-6 md:mb-8 space-y-3 md:space-y-4">
           <Link to="/" className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center shadow-2xl shadow-primary/20">
                 <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-black tracking-tighter text-white uppercase">EduNook</span>
           </Link>
           
           <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`h-1 rounded-full transition-all duration-500 ${step === s ? 'w-8 bg-primary' : step > s ? 'w-4 bg-success' : 'w-4 bg-white/10'}`} />
              ))}
           </div>
        </div>

        <div className="bg-[#0f0f0f]/80 backdrop-blur-2xl border border-white/5 rounded-[2.5rem] p-6 md:p-10 shadow-3xl">
          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                <div className="text-center space-y-2 mb-6">
                  <h2 className="text-2xl font-black text-white">Your Profile</h2>
                  <p className="text-muted-foreground text-sm font-medium">Let's start with the basics</p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2 group">
                    <label className="text-xs font-bold text-muted-foreground ml-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="John Doe"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && fullName && usernameRef.current?.focus()}
                        className="w-full pl-11 pr-4 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 group">
                    <div className="flex justify-between items-center px-1">
                       <label className="text-xs font-bold text-muted-foreground">Username</label>
                       {usernameLoading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                    </div>
                    <div className="relative">
                      <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        ref={usernameRef}
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="choose_username"
                        className={`w-full pl-11 pr-11 py-4 bg-white/[0.03] border rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/20 ${
                          isUsernameValid === true ? 'border-success/30' : isUsernameValid === false ? 'border-destructive/30' : 'border-white/5'
                        }`}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                         {isUsernameValid === true && <CheckCircle2 className="w-4 h-4 text-success" />}
                         {isUsernameValid === false && <XCircle className="w-4 h-4 text-destructive" />}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!fullName || !isUsernameValid}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black text-[16px] shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                <div className="text-center space-y-2 mb-6">
                   <h2 className="text-2xl font-black text-white">Account Details</h2>
                   <p className="text-muted-foreground text-sm font-medium">Choose a password and email</p>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2 group">
                    <label className="text-xs font-bold text-muted-foreground ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        ref={emailRef}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="example@email.com"
                        className="w-full pl-11 pr-4 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 group">
                    <label className="text-xs font-bold text-muted-foreground ml-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        ref={passwordRef}
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-11 pr-12 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/20"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
                         {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button type="button" onClick={handleBack} className="p-4 bg-white/[0.03] border border-white/5 text-muted-foreground hover:text-white rounded-2xl transition-all">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!email || password.length < 6}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-[16px] shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    Continue <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                <div className="text-center space-y-2 mb-6">
                   <h2 className="text-2xl font-black text-white">Last Details</h2>
                   <p className="text-muted-foreground text-sm font-medium">Pick your date of birth</p>
                </div>

                <div className="space-y-5">
                   {error && <p className="text-xs font-bold text-destructive text-center p-3 bg-destructive/10 rounded-xl">{error}</p>}
                   <div className="space-y-2 group">
                    <label className="text-xs font-bold text-muted-foreground ml-1">Date of Birth</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="date"
                        value={dob}
                        required
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full pl-11 pr-4 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button type="button" onClick={handleBack} className="p-4 bg-white/[0.03] border border-white/5 text-muted-foreground hover:text-white rounded-2xl transition-all">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !dob}
                    className="flex-1 py-4 bg-gradient-to-r from-primary to-violet-600 text-white rounded-2xl font-black text-[16px] shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Finish <ArrowRight className="w-5 h-5" /></>}
                  </button>
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
