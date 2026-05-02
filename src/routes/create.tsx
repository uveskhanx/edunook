/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { DbService, TestRow } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { 
  Upload, Plus, X, Loader2, BookOpen, IndianRupee, Tag, 
  Video as VideoIcon, Sparkles, LayoutGrid, CheckCircle2, 
  Link as LinkIcon, FileQuestion, GripVertical, Clock, 
  ShieldAlert, Infinity as InfinityIcon, ArrowRight, Music, 
  Camera, Microscope, Calculator, Globe, User, Zap, ChevronUp, ChevronDown, Info
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { toast } from 'sonner';

export const Route = createFileRoute('/create')({
  head: () => ({
    meta: [{ title: 'Create Course — EduNook' }],
  }),
  component: CreateCoursePage,
});

const CATEGORIES = [
  { id: 'programming', label: 'Code', icon: LayoutGrid },
  { id: 'design', label: 'Design', icon: Sparkles },
  { id: 'business', label: 'Business', icon: IndianRupee },
  { id: 'marketing', label: 'Marketing', icon: Tag },
  { id: 'music', label: 'Music', icon: Music },
  { id: 'photography', label: 'Photo', icon: Camera },
  { id: 'science', label: 'Science', icon: Microscope },
  { id: 'math', label: 'Math', icon: Calculator },
  { id: 'language', label: 'Lang', icon: Globe },
  { id: 'general', label: 'Misc', icon: BookOpen }
];

type ChapterType = 'video' | 'link' | 'quiz';

interface ChapterDraft {
  id: string; // Added for Framer Motion Reorder
  title: string;
  type: ChapterType;
  file?: File;
  pageUrl?: string;
  quizUrl?: string;
  isFreeDemo?: boolean;
}

function CreateCoursePage() {
  const { user, dbUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [isPaid, setIsPaid] = useState(false);
  const [category, setCategory] = useState('general');
  const [language, setLanguage] = useState('English');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ChapterDraft[]>([]);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [error, setError] = useState('');
  const [userTests, setUserTests] = useState<TestRow[]>([]);

  useEffect(() => {
    if (user?.id) {
      DbService.getUserTests(user.id).then(setUserTests);
    }
  }, [user?.id]);

  useEffect(() => {
    if (thumbnail) {
      const url = URL.createObjectURL(thumbnail);
      setThumbnailPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [thumbnail]);

  if (authLoading) return <Layout><div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>;

  if (!user) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="p-12 bg-card/30 backdrop-blur-3xl border border-border rounded-[3rem] shadow-2xl max-w-md">
            <BookOpen className="w-20 h-20 text-primary mx-auto mb-8 opacity-20" />
            <h2 className="text-3xl font-black text-foreground mb-4 tracking-tighter">Enter Creator Mode</h2>
            <p className="text-muted-foreground mb-10 font-medium leading-relaxed">Join our exclusive collective of master educators. Sign in to publish your masterpiece.</p>
            <Link to="/login" className="block w-full py-5 bg-primary text-white rounded-2xl font-black shadow-2xl shadow-primary/20 hover:scale-105 transition-all">
              Ignite Your Journey
            </Link>
          </motion.div>
        </div>
      </Layout>
    );
  }

  const addChapter = (type: ChapterType) => {
    setChapters([...chapters, { id: Math.random().toString(36).substr(2, 9), title: '', type }]);
  };

  const updateChapter = (id: string, updates: Partial<ChapterDraft>) => {
    setChapters(chapters.map(ch => ch.id === id ? { ...ch, ...updates } : ch));
  };

  const removeChapter = (id: string) => {
    setChapters(chapters.filter(ch => ch.id !== id));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      toast.error('Your course needs a title.');
      setStep(1);
      return;
    }

    if (chapters.length === 0) {
      toast.error('Add at least one chapter to your curriculum.');
      setStep(2);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      let thumbnailUrl: string | null = null;
      if (thumbnail) {
        thumbnailUrl = await DbService.uploadThumbnail(user.id, thumbnail);
      }

      const finalPrice = isPaid ? (parseFloat(price) || 0) : 0;
      const slug = DbService.slugify(title) + '-' + Math.random().toString(36).substr(2, 5);
      
      const courseId = await DbService.createCourse(user.id, {
        title,
        slug,
        description,
        price: finalPrice,
        category,
        language,
        thumbnailUrl,
        expiresInDays: isPaid && hasExpiry && expiresInDays ? parseInt(expiresInDays, 10) : null,
      });

      // Sequential chapter upload to manage progress
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        let videoUrl: string | undefined;

        if (ch.type === 'video' && ch.file) {
          // Progress simulation (Firebase doesn't give clean progress without custom tasks)
          setUploadProgress(prev => ({ ...prev, [ch.id]: 20 }));
          videoUrl = await DbService.uploadVideo(user.id, courseId, ch.file, i);
          setUploadProgress(prev => ({ ...prev, [ch.id]: 100 }));
        }

        await DbService.addChapter(courseId, {
          title: ch.title?.trim() || `Chapter ${i + 1}`,
          type: ch.type,
          ...(videoUrl && { videoUrl }),
          ...(ch.pageUrl && { pageUrl: ch.pageUrl }),
          ...(ch.quizUrl && { quizUrl: ch.quizUrl }),
          position: i,
          isFreeDemo: !!ch.isFreeDemo,
        });
      }

      toast.success('Your masterpiece is now live!');
      navigate({ to: '/course/$slug', params: { slug } });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to deploy course. Please check your connection.');
      toast.error('Deployment failed. See error below.');
    } finally {
      setLoading(false);
    }
  }

  const getChapterIcon = (type: ChapterType) => {
    switch (type) {
      case 'video': return <VideoIcon className="w-4 h-4" />;
      case 'link': return <LinkIcon className="w-4 h-4" />;
      case 'quiz': return <FileQuestion className="w-4 h-4" />;
    }
  };

  const getChapterColor = (type: ChapterType) => {
    switch (type) {
      case 'video': return 'text-primary bg-primary/10 border-primary/20';
      case 'link': return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
      case 'quiz': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    }
  };

  const steps = [
    { id: 1, name: 'Foundation', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 2, name: 'Curriculum', icon: <VideoIcon className="w-4 h-4" /> },
    { id: 3, name: 'Publish', icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  const completionPercent = Math.round(((title ? 1 : 0) + (description ? 1 : 0) + (thumbnail ? 1 : 0) + (chapters.length > 0 ? 1 : 0)) / 4 * 100);

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-4 md:px-10 py-10 md:py-16">
        
        {/* Cinematic Step Progress */}
        <div className="flex items-center justify-between mb-16 max-w-2xl mx-auto px-4 relative">
           <div className="absolute top-[24px] left-[10%] right-[10%] h-[2px] bg-border z-0" />
           {steps.map((s, i) => (
             <div key={s.id} className="flex flex-col items-center gap-3 relative z-10 group">
                <button 
                  type="button"
                  onClick={() => step > s.id && setStep(s.id)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 shadow-2xl ${
                    step === s.id ? 'bg-primary border-primary text-white scale-125 shadow-primary/40' : 
                    step > s.id ? 'bg-emerald-500 border-emerald-500 text-white' : 
                    'bg-card border-border text-muted-foreground'
                  }`}
                >
                  {step > s.id ? <CheckCircle2 className="w-6 h-6" /> : s.icon}
                </button>
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${step === s.id ? 'text-primary' : 'text-muted-foreground'}`}>
                  {s.name}
                </span>
             </div>
           ))}
        </div>

        {/* Page Title */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-20 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Creative Studio</span>
          </div>
          <h1 className="text-5xl md:text-8xl font-black text-foreground tracking-tighter leading-[0.85] uppercase">
            Create your <br /> <span className="text-primary italic">masterpiece</span>
          </h1>
          <p className="text-muted-foreground font-medium mt-8 max-w-xl text-base md:text-lg opacity-60">
            Every master was once a student. Design an experience that empowers the next generation.
          </p>
        </motion.div>

        <form id="create-course-form" onSubmit={handleSubmit} className="relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* Form Section */}
            <div className="lg:col-span-7 xl:col-span-8">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                    className="space-y-12"
                  >
                    <section className="p-8 md:p-12 bg-card/50 backdrop-blur-3xl border border-border rounded-[3rem] shadow-2xl space-y-10">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">The Brand</label>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                        <div className="space-y-4">
                          <input 
                            type="text" 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            required
                            className="w-full px-8 py-6 bg-background/50 border border-border rounded-3xl text-foreground font-black text-2xl placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-inner"
                            placeholder="Course Name..." 
                          />
                          <textarea 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            rows={4}
                            className="w-full px-8 py-6 bg-background/50 border border-border rounded-3xl text-foreground font-medium placeholder:text-muted-foreground/20 focus:outline-none focus:border-primary transition-all resize-none shadow-inner"
                            placeholder="What's the core promise of this course?" 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Pricing Strategy</label>
                          <div className="flex p-1.5 bg-background/50 border border-border rounded-2xl w-fit">
                            <button 
                              type="button" onClick={() => { setIsPaid(false); setPrice('0'); }}
                              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isPaid ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                              Free
                            </button>
                            <button 
                              type="button" onClick={() => setIsPaid(true)}
                              className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isPaid ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                              Paid
                            </button>
                          </div>

                          <AnimatePresence>
                            {isPaid && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                                <div className="relative group">
                                  <IndianRupee className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                  <input 
                                    type="number" value={price} 
                                    onChange={e => setPrice(e.target.value)} 
                                    max="10000" className="w-full pl-16 pr-8 py-5 bg-background border border-border rounded-2xl text-foreground font-black text-xl focus:border-primary transition-all" 
                                  />
                                </div>
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                                   <Zap className="w-4 h-4 text-emerald-500" />
                                   <p className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest leading-tight">
                                     Estimated Revenue: <span className="text-foreground">₹{(parseFloat(price || '0') * 0.85).toFixed(0)}</span> per student
                                   </p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Category & Language</label>
                          <div className="grid grid-cols-2 gap-3">
                            <select 
                              value={language} onChange={e => setLanguage(e.target.value)}
                              className="w-full px-5 py-4 bg-background border border-border rounded-2xl text-foreground font-bold text-xs appearance-none focus:border-primary transition-all cursor-pointer"
                            >
                              {['English', 'Hindi', 'Spanish', 'French', 'German'].map(l => <option key={l}>{l}</option>)}
                            </select>
                            <select 
                              value={category} onChange={e => setCategory(e.target.value)}
                              className="w-full px-5 py-4 bg-background border border-border rounded-2xl text-foreground font-bold text-xs appearance-none focus:border-primary transition-all cursor-pointer capitalize"
                            >
                              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    </section>

                    <div className="flex justify-end">
                      <button 
                        type="button" onClick={() => setStep(2)}
                        className="px-12 py-5 bg-foreground text-background rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
                      >
                        Next: Curriculum <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                    className="space-y-12"
                  >
                    <section className="p-8 md:p-12 bg-card/50 backdrop-blur-3xl border border-border rounded-[3rem] shadow-2xl space-y-10">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-2xl font-black tracking-tight">Curriculum Structure</h3>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Drag to reorder your lesson flow</p>
                        </div>
                        <div className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest">{chapters.length} Units</div>
                      </div>

                      <Reorder.Group axis="y" values={chapters} onReorder={setChapters} className="space-y-4">
                        {chapters.map((ch) => (
                          <Reorder.Item 
                            key={ch.id} value={ch}
                            className="p-6 bg-background/50 border border-border rounded-[2rem] group hover:border-primary/50 transition-all space-y-4 shadow-sm relative overflow-hidden"
                          >
                            <div className="flex items-center gap-4">
                              <div className="cursor-grab active:cursor-grabbing p-2 text-muted-foreground/30 hover:text-primary transition-colors">
                                <GripVertical className="w-5 h-5" />
                              </div>
                              <input 
                                type="text" 
                                value={ch.title} 
                                onChange={e => updateChapter(ch.id, { title: e.target.value })}
                                placeholder="Chapter Name..." 
                                className="flex-1 bg-transparent text-foreground font-black text-lg placeholder:text-muted-foreground/20 focus:outline-none" 
                              />
                              <div className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border flex items-center gap-2 ${getChapterColor(ch.type)}`}>
                                {getChapterIcon(ch.type)} {ch.type}
                              </div>
                              <button type="button" onClick={() => removeChapter(ch.id)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all">
                                <X className="w-5 h-5" />
                              </button>
                            </div>

                            <div className="pl-12">
                              {ch.type === 'video' && (
                                <div className="space-y-3">
                                  {ch.file ? (
                                    <div className="flex items-center gap-3 px-4 py-4 bg-primary/5 border border-primary/20 rounded-2xl">
                                      <VideoIcon className="w-4 h-4 text-primary" />
                                      <span className="text-xs font-bold text-foreground truncate max-w-[200px]">{ch.file.name}</span>
                                      {uploadProgress[ch.id] > 0 && uploadProgress[ch.id] < 100 && (
                                        <div className="flex-1 h-1 bg-primary/20 rounded-full overflow-hidden ml-4">
                                          <div className="h-full bg-primary" style={{ width: `${uploadProgress[ch.id]}%` }} />
                                        </div>
                                      )}
                                      <button type="button" onClick={() => updateChapter(ch.id, { file: undefined })} className="text-muted-foreground hover:text-destructive ml-auto">
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-[2rem] cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group/up">
                                      <Upload className="w-8 h-8 text-muted-foreground group-hover/up:text-primary transition-all mb-2" />
                                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Upload Video Asset</span>
                                      <input type="file" accept="video/*" className="hidden" onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) updateChapter(ch.id, { file });
                                      }} />
                                    </label>
                                  )}
                                  
                                  {isPaid && (
                                    <button 
                                      type="button"
                                      onClick={() => updateChapter(ch.id, { isFreeDemo: !ch.isFreeDemo })}
                                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${ch.isFreeDemo ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-background/50 border-border text-muted-foreground hover:border-emerald-500/50'}`}
                                    >
                                       <CheckCircle2 className={`w-4 h-4 ${ch.isFreeDemo ? 'opacity-100' : 'opacity-20'}`} />
                                       <span className="text-[10px] font-black uppercase tracking-widest">Public Free Demo</span>
                                    </button>
                                  )}
                                </div>
                              )}

                              {ch.type === 'link' && (
                                <div className="relative group">
                                  <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary" />
                                  <input 
                                    type="url" value={ch.pageUrl || ''} 
                                    onChange={e => updateChapter(ch.id, { pageUrl: e.target.value })}
                                    placeholder="External workspace URL..."
                                    className="w-full pl-12 pr-6 py-4 bg-background border border-border rounded-2xl text-foreground text-xs font-bold focus:border-primary transition-all" 
                                  />
                                </div>
                              )}

                              {ch.type === 'quiz' && (
                                <select 
                                  value={ch.quizUrl || ''} 
                                  onChange={e => updateChapter(ch.id, { quizUrl: e.target.value })}
                                  className="w-full px-6 py-4 bg-background border border-border rounded-2xl text-foreground text-xs font-bold focus:border-amber-400/50 appearance-none cursor-pointer" 
                                >
                                  <option value="">Link a Quiz...</option>
                                  {userTests.map(test => <option key={test.id} value={`/test/${test.id}`}>{test.title}</option>)}
                                </select>
                              )}
                            </div>
                          </Reorder.Item>
                        ))}
                      </Reorder.Group>

                      <div className="grid grid-cols-3 gap-4 pt-6">
                        {(['video', 'link', 'quiz'] as ChapterType[]).map(type => (
                          <button 
                            key={type} type="button" onClick={() => addChapter(type)}
                            className="flex flex-col items-center gap-3 p-6 bg-background/50 border border-border rounded-[2rem] hover:border-primary/50 hover:bg-primary/5 transition-all group"
                          >
                            <div className="p-3 bg-card border border-border rounded-2xl group-hover:scale-110 group-hover:bg-primary/10 transition-all">
                              {getChapterIcon(type)}
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground group-hover:text-primary">{type}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <div className="flex justify-between items-center">
                       <button type="button" onClick={() => setStep(1)} className="px-6 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-foreground">Back</button>
                       <button type="button" onClick={() => setStep(3)} className="px-12 py-5 bg-foreground text-background rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl flex items-center gap-4">Next: Publish <ArrowRight className="w-4 h-4" /></button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div 
                    key="step3"
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                    className="space-y-12"
                  >
                    <section className="p-8 md:p-12 bg-card/50 backdrop-blur-3xl border border-border rounded-[3rem] shadow-2xl space-y-12">
                      <div className="space-y-6">
                         <div className="flex items-center gap-3">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Cover Artwork</h4>
                            <div className="h-px flex-1 bg-border" />
                         </div>
                         <label className="relative block aspect-video rounded-[2.5rem] overflow-hidden border-2 border-dashed border-border cursor-pointer group hover:border-primary/50 transition-all bg-background/50">
                            {thumbnailPreview ? (
                              <div className="relative w-full h-full">
                                 <img src={thumbnailPreview} className="w-full h-full object-cover" alt="Preview" />
                                 <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                     <span className="text-[10px] font-black uppercase text-white tracking-[0.2em] bg-primary px-6 py-3 rounded-2xl shadow-2xl">Change Visual</span>
                                 </div>
                              </div>
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                                 <div className="p-6 bg-card border border-border rounded-3xl group-hover:scale-110 transition-all">
                                    <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary" />
                                 </div>
                                 <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Select Primary Image</span>
                              </div>
                            )}
                            <input type="file" accept="image/*" className="hidden" onChange={e => setThumbnail(e.target.files?.[0] || null)} />
                         </label>
                      </div>

                      {isPaid && (
                        <div className="space-y-8">
                          <div className="flex items-center gap-3">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Access Policy</h4>
                            <div className="h-px flex-1 bg-border" />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <button 
                               type="button" onClick={() => setHasExpiry(false)}
                               className={`p-8 rounded-[2rem] border-2 transition-all flex items-center gap-6 ${!hasExpiry ? 'border-primary bg-primary/5 shadow-2xl shadow-primary/10' : 'border-border bg-background hover:bg-card'}`}
                             >
                                <div className={`p-4 rounded-2xl ${!hasExpiry ? 'bg-primary text-white' : 'bg-muted/20 text-muted-foreground'}`}>
                                   <InfinityIcon className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                   <p className="font-black text-sm uppercase tracking-wider">Lifetime</p>
                                   <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-50">Permanent Access</p>
                                </div>
                             </button>
                             <button 
                               type="button" onClick={() => setHasExpiry(true)}
                               className={`p-8 rounded-[2rem] border-2 transition-all flex items-center gap-6 ${hasExpiry ? 'border-amber-500 bg-amber-500/5 shadow-2xl shadow-amber-500/10' : 'border-border bg-background hover:bg-card'}`}
                             >
                                <div className={`p-4 rounded-2xl ${hasExpiry ? 'bg-amber-500 text-white' : 'bg-muted/20 text-muted-foreground'}`}>
                                   <Clock className="w-6 h-6" />
                                </div>
                                <div className="text-left">
                                   <p className="font-black text-sm uppercase tracking-wider">Limited</p>
                                   <p className="text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-50">Expires After X Days</p>
                                </div>
                             </button>
                          </div>
                          {hasExpiry && (
                            <input 
                              type="number" value={expiresInDays} onChange={e => setExpiresInDays(e.target.value)} 
                              placeholder="Validity duration (days)..." className="w-full px-8 py-5 bg-background border border-amber-500/30 rounded-3xl text-amber-500 font-black text-lg focus:outline-none" 
                            />
                          )}
                        </div>
                      )}
                    </section>

                    <div className="flex justify-between items-center">
                       <button type="button" onClick={() => setStep(2)} className="px-6 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:text-foreground">Back</button>
                       <button 
                         type="submit" disabled={loading}
                         className="px-12 py-5 bg-primary text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-[0_20px_50px_rgba(var(--primary-rgb),0.3)] hover:scale-105 active:scale-95 transition-all flex items-center gap-4 disabled:opacity-50"
                       >
                         {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Deploy Marketplace</>}
                       </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sticky Preview Sidebar */}
            <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 space-y-8">
               <div className="p-10 bg-card/80 backdrop-blur-3xl border border-border rounded-[3.5rem] shadow-2xl space-y-10">
                  <div className="flex items-center justify-between">
                     <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-muted-foreground">Market Snapshot</h3>
                     <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] font-black uppercase text-emerald-500 tracking-widest">Active Sync</span>
                     </div>
                  </div>

                  {/* Real-time Card Preview */}
                  <div className="group relative">
                     <div className="absolute -inset-4 bg-primary/10 blur-[40px] rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity" />
                     <div className="relative bg-background border border-border rounded-[2.5rem] overflow-hidden shadow-2xl transform transition-transform duration-700 group-hover:scale-[1.02]">
                        <div className="aspect-video bg-muted/20 relative flex items-center justify-center">
                           {thumbnailPreview ? (
                             <img src={thumbnailPreview} className="w-full h-full object-cover" alt="" />
                           ) : (
                             <div className="text-center opacity-20">
                               <LayoutGrid className="w-12 h-12 mx-auto mb-2" />
                               <p className="text-[8px] font-black uppercase tracking-widest">No Artwork</p>
                             </div>
                           )}
                           <div className="absolute bottom-4 right-4 px-4 py-1.5 bg-black/60 backdrop-blur-xl rounded-xl text-[10px] font-black text-white uppercase tracking-widest border border-white/10 shadow-2xl">
                              {price === '0' || !price ? 'Free' : `₹${price}`}
                           </div>
                        </div>
                        <div className="p-8 space-y-5">
                           <div className="flex gap-4">
                              <div className="w-10 h-10 rounded-2xl bg-primary/20 shrink-0 flex items-center justify-center border border-primary/20 shadow-inner">
                                 <User className="w-5 h-5 text-primary" />
                              </div>
                              <div className="space-y-1.5 flex-1 min-w-0">
                                 <h4 className={`text-base font-black leading-tight truncate ${!title ? 'text-muted-foreground/20' : 'text-foreground'}`}>
                                    {title || 'Masterpiece Title'}
                                 </h4>
                                 <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">
                                    {dbUser?.fullName || 'Creator'}
                                 </p>
                              </div>
                           </div>
                           <div className="flex items-center justify-between pt-4 border-t border-border">
                              <div className="flex items-center gap-2 text-[9px] font-black text-primary uppercase tracking-widest bg-primary/5 px-3 py-1 rounded-full">
                                 <BookOpen className="w-3 h-3" />
                                 {chapters.length} Modules
                              </div>
                              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] opacity-30">{category}</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-6 pt-4">
                     <div className="p-6 bg-background/50 border border-border rounded-[2rem] space-y-4">
                        <div className="flex items-center justify-between">
                           <span className="text-[9px] font-black uppercase text-muted-foreground tracking-[0.3em]">Integrity Check</span>
                           <span className="text-[10px] font-black text-primary tracking-widest">{completionPercent}%</span>
                        </div>
                        <div className="h-1.5 bg-muted/20 rounded-full overflow-hidden">
                           <motion.div 
                             className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" 
                             animate={{ width: `${completionPercent}%` }} 
                           />
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                           <Info className="w-3.5 h-3.5 text-primary opacity-40" />
                           <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-[0.1em] leading-relaxed">
                             Deployment triggers global indexing.
                           </p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </form>

        {/* Mobile Navigation Controller */}
        <div className="lg:hidden fixed bottom-6 left-6 right-6 z-50">
           <div className="flex items-center justify-around h-[72px] px-2 bg-card/90 backdrop-blur-2xl border border-border rounded-full shadow-[0_20px_40px_rgba(0,0,0,0.3)]">
              <button 
                type="button" 
                disabled={step === 1}
                onClick={() => setStep(s => Math.max(1, s - 1))}
                className="w-12 h-12 flex items-center justify-center rounded-full text-muted-foreground disabled:opacity-20 transition-all"
              >
                 <ChevronUp className="w-5 h-5 -rotate-90" />
              </button>
              
              <div className="flex gap-2">
                {[1,2,3].map(i => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${step === i ? 'w-6 bg-primary' : 'bg-muted-foreground/30'}`} />
                ))}
              </div>

              {step < 3 ? (
                <button 
                  type="button" 
                  onClick={() => setStep(s => Math.min(3, s + 1))}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/20"
                >
                   <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <button 
                  form="create-course-form"
                  type="submit" 
                  disabled={loading}
                  className="w-12 h-12 flex items-center justify-center rounded-full bg-foreground text-background shadow-lg"
                >
                   {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                </button>
              )}
           </div>
        </div>
      </div>
    </Layout>
  );
}
