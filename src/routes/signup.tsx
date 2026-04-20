import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  updateProfile
} from 'firebase/auth';
import { ref, set, get, runTransaction } from 'firebase/database';
import { DbService } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { 
  Lock, User, CheckCircle2, XCircle, 
  Loader2, Sparkles, ArrowRight, AtSign, 
  Eye, EyeOff, Calendar, Phone, ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { differenceInMonths, parseISO, isFuture, format } from 'date-fns';

export const Route = createFileRoute('/signup')({
  head: () => ({
    meta: [
      { title: 'Create Account — EduNook' },
    ],
  }),
  component: SignupPage,
});

type Step = 1 | 2;

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
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dobError, setDobError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Validation States
  const [isUsernameValid, setIsUsernameValid] = useState<boolean | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Refs for auto-focus
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

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

  const validatePhoneWithNumverify = async (fullPhone: string) => {
    // Note: We recommend putting the API key in a .env file like VITE_NUMVERIFY_API_KEY
    // Numverify only validates the formatting and existence of a number, it doesn't send SMS.
    const apiKey = import.meta.env.VITE_NUMVERIFY_API_KEY || 'YOUR_NUMVERIFY_API_KEY';
    
    // Clean the phone number (remove + for the API)
    const cleanPhone = fullPhone.replace('+', '');

    try {
      const response = await fetch(`https://apilayer.net/api/validate?access_key=${apiKey}&number=${cleanPhone}`);
      const data = await response.json();
      
      if (data.success === false) {
          console.warn("Numverify API Error:", data.error.info);
          // If API fails (e.g. invalid key or out of quota), we just bypass to prevent locking users out
          return true; 
      }

      return data.valid; // Will be true if it's a real phone number
    } catch (err) {
      console.error("Numverify network error:", err);
      return true; // Bypass on network failure
    }
  };

  async function handleFinalSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !phone || password.length < 6) return;
    
    setError('');
    setLoading(true);

    const cleanUsername = username.toLowerCase().trim();
    const virtualEmail = `${cleanUsername}@edunook.internal`;
    const fullPhone = `${countryCode}${phone}`;
    let tempUser = null;

    try {
      // 1. Numverify Phone Validation Check
      const isValidPhone = await validatePhoneWithNumverify(fullPhone);
      if (!isValidPhone) {
        throw new Error("Invalid phone number detected by Numverify. Please check the number.");
      }

      // 2. Create the base Auth account (Virtual Email acts as vault)
      const userCred = await createUserWithEmailAndPassword(auth, virtualEmail, password);
      tempUser = userCred.user;

      // 3. Atomic Database Transaction for the Username
      const usernameRef = ref(db, `usernames/${cleanUsername}`);
      const transactionResult = await runTransaction(usernameRef, (currentVal) => {
        if (currentVal === null) return tempUser!.uid; // Claim it
        return; // Abort if taken
      });

      if (!transactionResult.committed) {
        throw new Error("Username was claimed during phone verification.");
      }

      // 4. Save Profile to Database
      const userData = {
        uid: tempUser.uid,
        fullName,
        username: cleanUsername,
        email: virtualEmail,
        dob: dob,
        phone: fullPhone, // Successfully validated via Numverify
        role: 'student' as const,
        createdAt: new Date().toISOString(),
      };

      await set(ref(db, `users/${tempUser.uid}`), userData);
      await updateProfile(tempUser, { displayName: fullName });

      toast.success('Account created successfully!');
      navigate({ to: '/home' });
    } catch (err: any) {
      console.error('Final Signup Error:', err);
      // FATAL ROLLBACK: Destroy ghost account if failed
      if (tempUser) await tempUser.delete().catch(console.error);
      
      if (err.code === 'auth/email-already-in-use') {
        setError("Username is already taken.");
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
    <div 
      className="min-h-screen flex items-center justify-center px-6 py-8 md:py-12 relative overflow-hidden"
      style={{ background: '#020202' }}
    >
      {/* Maximum Premium "Living Aurora" Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {/* Animated Aurora Blooms - High Opacity for maximum visibility */}
        <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[70%] bg-[#4f46e5]/40 rounded-full blur-[140px] animate-pulse duration-[12s]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[70%] bg-[#06b6d4]/40 rounded-full blur-[140px] animate-pulse duration-[15s] delay-700" />
        <div className="absolute top-[20%] right-[10%] w-[50%] h-[50%] bg-[#9333ea]/30 rounded-full blur-[120px] animate-pulse duration-[18s]" />
        
        {/* Structural Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] bg-primary/10 rounded-full blur-[200px]" />
        
        {/* Subtle Noise Texture */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
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
              {[1, 2].map((s) => (
                <div key={s} className={`h-1 rounded-full transition-all duration-500 ${step === s ? 'w-8 bg-primary' : step > s ? 'w-4 bg-success' : 'w-4 bg-white/10'}`} />
              ))}
           </div>
        </div>

        <div 
          className="backdrop-blur-[40px] rounded-[3.5rem] p-6 md:p-10 shadow-[0_0_100px_rgba(79,70,229,0.15)] border border-white/20 ring-1 ring-white/10 transition-all duration-500"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%)'
          }}
        >
          <form onSubmit={handleFinalSubmit}>
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

                  <div className="space-y-2 group">
                    <div className="flex justify-between items-center ml-1">
                      <label className="text-xs font-bold text-muted-foreground">Date of Birth</label>
                      {dobError && <span className="text-[10px] font-black text-destructive uppercase tracking-wider">{dobError}</span>}
                    </div>
                    <div className="relative">
                      <Calendar className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${dobError ? 'text-destructive' : 'text-muted-foreground group-focus-within:text-primary'}`} />
                      <input
                        type="date"
                        value={dob}
                        required
                        onChange={(e) => {
                          setDob(e.target.value);
                          setDobError('');
                        }}
                        className={`w-full pl-11 pr-4 py-4 bg-white/[0.04] border rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 transition-all [color-scheme:dark] group-focus-within:bg-white/[0.06] group-focus-within:shadow-[0_0_20px_rgba(59,130,246,0.15)] ${
                          dobError ? 'border-destructive/40 focus:ring-destructive/40' : 'border-white/10 focus:ring-primary/40 focus:border-primary/40'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!fullName || !isUsernameValid || !dob}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black text-[16px] shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                >
                  Continue <ArrowRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" variants={stepVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                <div className="text-center space-y-2 mb-6">
                   <h2 className="text-2xl font-black text-white">Security & Phone</h2>
                   <p className="text-muted-foreground text-sm font-medium">Numverify Protection</p>
                </div>

                {error && <p className="text-[13px] font-bold text-destructive text-center p-3 bg-destructive/10 rounded-xl">{error}</p>}

                <div className="space-y-5">
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

                  <div className="space-y-2 group">
                    <label className="text-xs font-bold text-muted-foreground ml-1">Phone Number</label>
                    <div className="flex gap-2">
                       <input
                          type="text"
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="w-[80px] text-center py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                       />
                       <div className="relative flex-1">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            placeholder="Current phone number"
                            className="w-full pl-11 pr-4 py-4 bg-white/[0.03] border border-white/5 rounded-2xl text-[15px] text-white font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-muted-foreground/20"
                          />
                       </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    type="button" 
                    onClick={handleBack} 
                    disabled={loading} 
                    aria-label="Go back to previous step"
                    className="p-4 bg-white/[0.03] border border-white/5 text-muted-foreground hover:text-white rounded-2xl transition-all disabled:opacity-50"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="submit"
                    disabled={!phone || password.length < 6 || loading}
                    className="flex-1 py-4 bg-gradient-to-r from-[#4f46e5] via-[#7c3aed] to-[#c026d3] text-white rounded-2xl font-black text-[16px] shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Complete Signup <ArrowRight className="w-5 h-5" /></>}
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
