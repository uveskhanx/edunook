'use client';
import { useState, useMemo, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, ShieldCheck, FileText, 
  LockKey, Scroll, Gavel, Handshake,
  CheckCircle, WarningCircle, Info,
  MagnifyingGlass, BookOpen, Rocket,
  User, PlayCircle, ChatCircleDots,
  Compass, House, PlusCircle, Bell,
  Key, UserPlus, SignIn, Gear,
  Palette, CreditCard, VideoCamera,
  ListBullets, CheckSquare, CloudArrowUp,
  CaretRight, Question, Monitor,
  Layout as LayoutIcon, IdentificationCard,
  CreditCard as PaymentIcon, Globe,
  ShieldSlash, Warning, X, Bug, ArrowRight
} from '@phosphor-icons/react';
import { useAuth } from '@/hooks/use-auth';
import { push, ref, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

type TopicId = 'getting-started' | 'navigating' | 'learning' | 'teaching' | 'account' | 'privacy-legal';

interface HelpArticle {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  keywords: string[];
}

export default function LegalClient() {
  const router = useRouter();
  const [activeTopic, setActiveTopic] = useState<TopicId>('getting-started');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // --- FEEDBACK MODAL STATE ---
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);
  const { user, dbUser } = useAuth();

  const submitFeedback = async () => {
    const text = feedbackText.trim();
    if (!text || isSendingFeedback || !user) {
      if (!user) toast.error('You must be logged in to send support requests.');
      return;
    }

    setIsSendingFeedback(true);
    toast.loading('Sending support request...', { id: 'feedback-status' });

    try {
      const requestRef = push(ref(db, `user_settings/${user.id}/supportRequests`));
      await set(requestRef, {
        id: requestRef.key,
        category: 'bug',
        title: 'Support Request',
        message: text,
        status: 'new',
        source: 'help_center',
        username: dbUser?.username || 'student',
        email: user.email || '',
        createdAt: new Date().toISOString(),
      });
      setFeedbackText('');
      setShowFeedbackModal(false);
      toast.success('Request sent. Our team will look into it.', { id: 'feedback-status' });
    } catch (err) {
      toast.error('Request could not be sent. Please try again.', { id: 'feedback-status' });
    } finally {
      setIsSendingFeedback(false);
    }
  };

  // --- TOPICS CONFIGURATION ---
  const topics = [
    { id: 'getting-started', label: 'Getting Started', icon: <Rocket /> },
    { id: 'navigating', label: 'Platform Tour', icon: <Compass /> },
    { id: 'learning', label: 'How to Learn', icon: <BookOpen /> },
    { id: 'teaching', label: 'How to Teach', icon: <VideoCamera /> },
    { id: 'account', label: 'Account & Plan', icon: <User /> },
    { id: 'privacy-legal', label: 'Legal & Safety', icon: <ShieldCheck /> },
  ];

  // --- ARTICLES DATA ---
  const articles: Record<TopicId, HelpArticle[]> = {
    'getting-started': [
      {
        id: 'signup-deep-dive',
        title: 'Joining EduNook: Step-by-Step',
        icon: <UserPlus />,
        keywords: ['signup', 'register', 'join', 'account'],
        content: (
          <div className="space-y-6">
            <p>Welcome to EduNook! Signing up is the first step to your learning journey. Here is exactly what happens on the Join page:</p>
            <div className="grid gap-4">
              <GuideStep 
                title="Find the 'Join' Button" 
                desc="On the landing page, look at the top right corner. You'll see a vibrant 'Join EduNook' button. Click it."
              />
              <GuideStep 
                title="The 'Full Name' Input" 
                desc="Located at the top. Type your name exactly how you want it to appear on your certificates and profile. It should be 3-50 characters long."
              />
              <GuideStep 
                title="The 'Email' Input" 
                desc="Type your permanent email. Tip: Check for typos! If you miss a letter, you won't get your password reset links."
              />
              <GuideStep 
                title="The 'Password' Input" 
                desc="Must be at least 8 characters. We recommend a mix of letters and numbers. Click the 'Eye' icon to double-check your typing."
              />
              <GuideStep 
                title="Final Step: The 'Join' Button" 
                desc="Click the large button at the bottom. If it spins, it means we are creating your digital classroom. Wait 2 seconds!"
              />
            </div>
            <ProblemBox 
              title="Error: 'Email already exists'"
              solution="This means you have an account! Click the 'Login' link at the bottom of the form instead."
            />
          </div>
        )
      },
      {
        id: 'login-details',
        title: 'Logging In & Recovery',
        icon: <SignIn />,
        keywords: ['login', 'signin', 'forgot password', 'reset'],
        content: (
          <div className="space-y-6">
            <p>Accessing your existing account is fast and secure.</p>
            <div className="grid gap-4">
              <GuideStep title="Email Box" desc="Enter the email you used to sign up." />
              <GuideStep title="Password Box" desc="Enter your secret key. It is hidden for your safety." />
              <GuideStep title="Forgot Password Link" desc="Located directly under the password box. If you click this, we'll ask for your email and send you a secure link to change your password." />
              <GuideStep title="Google Login" desc="Use the social buttons at the bottom for one-click access if you linked your Google account." />
            </div>
          </div>
        )
      }
    ],
    'navigating': [
      {
        id: 'sidebar-map',
        title: 'The Master Sidebar (Left Menu)',
        icon: <Monitor />,
        keywords: ['sidebar', 'icons', 'navigation', 'menu'],
        content: (
          <div className="space-y-6">
            <p>The sidebar is your main control panel. It stays on the left of every page.</p>
            <div className="space-y-4">
              <FeatureCard icon={<House />} title="Home (House Icon)" desc="Takes you back to your Dashboard. This is where your current courses and progress live." />
              <FeatureCard icon={<Compass />} title="Explore (Compass Icon)" desc="Takes you to the search page. Use this to find new teachers and trending skills." />
              <FeatureCard icon={<Bell />} title="Notifications (Bell Icon)" desc="A red dot appears here when you get a message or a follower. Click it to see what's new." />
              <FeatureCard icon={<Gear />} title="Settings (Gear Icon)" desc="Located at the bottom. Use this to change your password, theme, and privacy." />
            </div>
          </div>
        )
      }
    ],
    'learning': [
      {
        id: 'course-player',
        title: 'The Course Player & Video Controls',
        icon: <PlayCircle />,
        keywords: ['video', 'player', 'chapters', 'complete'],
        content: (
          <div className="space-y-6">
            <p>Our premium player is designed for distraction-free learning.</p>
            <div className="grid gap-4">
              <GuideStep title="Main Video Area" desc="Click the center to Play or Pause. Use the 'F' key on your keyboard to go full-screen." />
              <GuideStep title="Timeline Bar" desc="The bar at the bottom shows how much of the lesson you've watched. Click any point to skip ahead." />
              <GuideStep title="Chapters List" desc="On the right side. Every lesson title is a button. Click it to switch topics instantly." />
              <GuideStep title="The 'Next' Button" desc="Appears at the bottom right after a video ends. Use it to keep your momentum going." />
            </div>
          </div>
        )
      }
    ],
    'teaching': [
      {
        id: 'creator-studio',
        title: 'Creator Studio: Your Publishing Hub',
        icon: <VideoCamera />,
        keywords: ['create', 'teach', 'upload', 'publish'],
        content: (
          <div className="space-y-6">
            <p>Ready to share your knowledge? Here is the detailed creator workflow.</p>
            <div className="grid gap-4">
              <GuideStep title="1. The 'Create Course' Button" desc="Found on your profile. Click it to open the studio." />
              <GuideStep title="2. Course Identity" desc="Enter your Title, Category (Programming, Design, etc.), and a long Description." />
              <GuideStep title="3. The Pricing Input" desc="Type '0' for a free course. Type any amount (e.g., '499') to make it a paid course." />
              <GuideStep title="4. Cover Image Upload" desc="Click the large box with the 'Image' icon. Select a bright, 16:9 ratio image from your device." />
              <GuideStep title="5. Adding Content" desc="Click 'Add Chapter'. Then, inside the chapter, click 'Upload Video' (the cloud icon). Select your lesson file." />
            </div>
            <ProblemBox title="Upload Stuck?" solution="Ensure your video is in .mp4 or .mov format and is under 500MB for optimal performance." />
          </div>
        )
      }
    ],
    'account': [
      {
        id: 'subscription-details',
        title: 'EduNook Plans (Spark vs Edge)',
        icon: <PaymentIcon />,
        keywords: ['payment', 'razorpay', 'edge', 'spark', 'plan'],
        content: (
          <div className="space-y-6">
            <p>Manage your access and premium features from the Plan section.</p>
            <div className="grid gap-4">
              <GuideStep title="Spark Plan (Free)" desc="Our standard access. You can watch free courses and follow your favorite teachers." />
              <GuideStep title="Edge Plan (Premium)" desc="Click 'Upgrade' to unlock AI analytics, premium courses, and priority support." />
              <GuideStep title="The Payment Modal" desc="When you click 'Pay', a Razorpay window pops up. You can pay via UPI, Card, or Netbanking. This window is 100% encrypted." />
            </div>
          </div>
        )
      }
    ],
    'privacy-legal': [
      {
        id: 'legal-terms',
        title: 'User Agreements & Safety',
        icon: <Gavel />,
        keywords: ['terms', 'privacy', 'rules', 'safety'],
        content: (
          <div className="space-y-6">
            <p>We keep EduNook a safe space for everyone.</p>
            <ul className="list-disc pl-6 space-y-4">
              <li><strong>Content Rights:</strong> You own what you create. EduNook just helps you host it.</li>
              <li><strong>Privacy:</strong> We never share your email. Your data is your property.</li>
              <li><strong>Conduct:</strong> No bullying, no piracy, and no spamming. We have a zero-tolerance policy.</li>
            </ul>
          </div>
        )
      }
    ]
  };

  // --- SEARCH LOGIC ---
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    const allArticles = Object.values(articles).flat();
    return allArticles.filter(a => 
      a.title.toLowerCase().includes(query) || 
      a.keywords.some(k => k.includes(query))
    );
  }, [searchQuery]);

  return (
    <Layout showSettings={false} hideNavigation hideMobileNav hideHeader>
      <div className="min-h-screen bg-background flex flex-col md:flex-row overflow-hidden">
        
        {/* --- LEFT SIDEBAR: TOPIC DIRECTORY --- */}
        <motion.aside 
          initial={false}
          animate={{ width: isSidebarOpen ? 320 : 0, opacity: isSidebarOpen ? 1 : 0 }}
          className="hidden md:flex flex-col border-r border-white/5 bg-white/[0.02] backdrop-blur-3xl sticky top-0 h-screen"
        >
          <div className="p-8 border-b border-white/5">
            <button 
              onClick={() => router.push('/settings')}
              className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors mb-6 text-xs font-black uppercase tracking-widest"
            >
              <ArrowLeft size={16} />
              Settings
            </button>
            <h2 className="text-xl font-black text-white tracking-tighter">Help Directory</h2>
          </div>
          
          <nav className="flex-1 overflow-y-auto p-4 space-y-2 premium-scrollbar">
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => { setActiveTopic(topic.id as TopicId); setSearchQuery(''); }}
                className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-sm font-bold transition-all ${
                  activeTopic === topic.id && !searchQuery
                    ? 'bg-primary text-white shadow-xl shadow-primary/20'
                    : 'text-muted-foreground hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-xl">{topic.icon}</span>
                {topic.label}
              </button>
            ))}
          </nav>

          <div className="p-6 border-t border-white/5 bg-white/[0.01]">
            <p className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-2">Support Version 2.4.0</p>
            <p className="text-[10px] font-medium text-white/40">© 2026 EduNook Platform</p>
          </div>
        </motion.aside>

        {/* --- MAIN CONTENT AREA --- */}
        <main className="flex-1 overflow-y-auto h-screen premium-scrollbar bg-background relative">
          
          {/* Header & Search */}
          <div className="max-w-4xl mx-auto px-6 py-12 md:py-20">
            
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-black uppercase tracking-widest mb-6">
              <House size={14} />
              <CaretRight size={10} />
              <span>Help Center</span>
              <CaretRight size={10} />
              <span className="text-primary">{searchQuery ? 'Search Results' : topics.find(t => t.id === activeTopic)?.label}</span>
            </div>

            <div className="mb-12">
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-4">
                {searchQuery ? 'Search results for' : 'How can we'} <span className="premium-gradient-text italic">{searchQuery ? `"${searchQuery}"` : 'help you?'}</span>
              </h1>
              <p className="text-lg text-muted-foreground font-medium max-w-2xl">
                Explore our detailed encyclopedia of every pixel and process on EduNook.
              </p>
            </div>

            {/* Powerful Search Bar */}
            <div className="relative group mb-16">
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                <MagnifyingGlass size={26} weight="bold" />
              </div>
              <input 
                type="text" 
                placeholder="Search any button, input, or feature..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-3xl py-7 pl-16 pr-8 text-lg text-white font-medium focus:outline-none focus:border-primary/50 focus:bg-white/[0.05] transition-all shadow-2xl"
              />
            </div>

            {/* Articles List */}
            <div className="space-y-12">
              <AnimatePresence mode="wait">
                {(searchQuery ? searchResults : articles[activeTopic]).map((article, idx) => (
                  <motion.section
                    key={article.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-8 md:p-10 rounded-[3rem] bg-white/[0.02] border border-white/5 hover:border-primary/20 transition-all group"
                  >
                    <div className="flex items-center gap-6 mb-8">
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <span className="text-2xl">{article.icon}</span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase">{article.title}</h2>
                    </div>
                    <div className="md:pl-20 text-muted-foreground font-medium leading-relaxed border-l-2 border-white/5 md:ml-7">
                      {article.content}
                    </div>
                  </motion.section>
                ))}

                {(searchQuery && searchResults.length === 0) && (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-muted-foreground">
                      <Question size={40} />
                    </div>
                    <h3 className="text-xl font-black text-white">No results found</h3>
                    <p className="text-muted-foreground mt-2">Try searching for a simpler term or browse the categories on the left.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer Support */}
            <div className="mt-20 p-10 rounded-[2.5rem] bg-primary/5 border border-primary/10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-4">
                <ChatCircleDots size={32} className="text-primary" />
                <div className="text-sm">
                  <p className="font-black text-white uppercase tracking-tighter">Need live support?</p>
                  <p className="text-muted-foreground">Our team is available 24/7 for technical issues.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowFeedbackModal(true)}
                className="px-8 py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all"
              >
                Contact Team
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showFeedbackModal && (
              <Modal onClose={() => setShowFeedbackModal(false)} labelledBy="support-modal-title" maxWidth="max-w-lg">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <Bug size={24} weight="duotone" />
                    </div>
                    <div>
                      <h2 id="support-modal-title" className="text-xl font-black tracking-tight text-foreground">
                        Live Support Request
                      </h2>
                      <p className="text-sm text-muted-foreground">Explain your issue, and we will help.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(false)}
                    aria-label="Close dialog"
                    className="rounded-2xl p-2 text-muted-foreground transition hover:bg-muted/40 hover:text-foreground"
                  >
                    <X size={22} />
                  </button>
                </div>

                <Field label="Message" htmlFor="feedback-message">
                  <textarea
                    id="feedback-message"
                    value={feedbackText}
                    onChange={(event) => setFeedbackText(event.target.value)}
                    placeholder="What happened? Include the page and steps if you can."
                    className="w-full bg-background/50 border border-border rounded-2xl p-4 text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-44 resize-y"
                    autoFocus
                  />
                </Field>

                <button
                  type="button"
                  onClick={submitFeedback}
                  disabled={!feedbackText.trim() || isSendingFeedback}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white shadow-xl shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSendingFeedback ? 'Sending...' : 'Send request'}
                  <ArrowRight size={18} weight="bold" />
                </button>
              </Modal>
            )}
          </AnimatePresence>

        </main>
      </div>
    </Layout>
  );
}

// --- SHARED UI COMPONENTS ---

function GuideStep({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="flex gap-4 group/step">
      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 group-hover/step:scale-150 transition-transform" />
      <div>
        <h4 className="text-white font-black text-sm uppercase tracking-tight mb-1">{title}</h4>
        <p className="text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function ProblemBox({ title, solution }: { title: string, solution: string }) {
  return (
    <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 mt-6">
      <div className="flex items-center gap-3 mb-2 text-amber-500">
        <Warning size={18} weight="fill" />
        <h4 className="font-black text-xs uppercase tracking-widest">{title}</h4>
      </div>
      <p className="text-sm text-amber-500/80 font-medium"><strong>Solution:</strong> {solution}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 flex items-start gap-4 hover:bg-white/[0.05] transition-all">
      <div className="text-primary text-xl mt-1">{icon}</div>
      <div>
        <h4 className="text-white font-black text-sm uppercase tracking-tight mb-1">{title}</h4>
        <p className="text-xs leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function Modal({
  children,
  onClose,
  labelledBy,
  maxWidth = 'max-w-md',
}: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy: string;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <motion.button
        type="button"
        aria-label="Close dialog"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-xl"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl sm:p-7 ${maxWidth}`}
      >
        {children}
      </motion.div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-black text-foreground">
          {label}
        </label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
