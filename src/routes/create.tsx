import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { DbService, TestRow } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { Upload, Plus, X, Loader2, BookOpen, IndianRupee, Tag, Video as VideoIcon, Sparkles, LayoutGrid, CheckCircle2, Link as LinkIcon, FileQuestion, GripVertical, Clock, ShieldAlert, Infinity, ArrowRight, Music, Camera, Microscope, Calculator, Globe, User, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Route = createFileRoute('/create')({
  head: () => ({
    meta: [{ title: 'Create Course — EduNook' }],
  }),
  component: CreateCoursePage,
});

const categories = ['programming', 'design', 'business', 'music', 'photography', 'marketing', 'science', 'math', 'language', 'general'];

type ChapterType = 'video' | 'link' | 'quiz';

interface ChapterDraft {
  title: string;
  type: ChapterType;
  file?: File;       // for video type
  pageUrl?: string;  // for link type
  quizUrl?: string;  // for quiz type
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
  const [chapters, setChapters] = useState<ChapterDraft[]>([]);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userTests, setUserTests] = useState<TestRow[]>([]);

  useEffect(() => {
    if (user?.id) {
      DbService.getUserTests(user.id).then(setUserTests);
    }
  }, [user?.id]);

  if (authLoading) return <Layout><div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></Layout>;

  if (!user) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="p-12 bg-card/30 backdrop-blur-3xl border border-white/5 rounded-[3rem] shadow-2xl max-w-md">
            <BookOpen className="w-20 h-20 text-primary mx-auto mb-8 opacity-20" />
            <h2 className="text-3xl font-black text-white mb-4 tracking-tighter">Enter Creator Mode</h2>
            <p className="text-muted-foreground mb-10 font-medium leading-relaxed">Join our elite collective of master educators. Sign in to publish your masterpiece.</p>
            <Link to="/login" className="block w-full py-5 bg-primary text-white rounded-2xl font-black shadow-2xl shadow-primary/20 hover:scale-105 transition-all">
              Ignite Your Journey
            </Link>
          </motion.div>
        </div>
      </Layout>
    );
  }

  const addChapter = (type: ChapterType) => {
    setChapters([...chapters, { title: '', type }]);
  };

  const updateChapter = (index: number, updates: Partial<ChapterDraft>) => {
    const newChapters = [...chapters];
    newChapters[index] = { ...newChapters[index], ...updates };
    setChapters(newChapters);
  };

  const removeChapter = (index: number) => {
    setChapters(chapters.filter((_, i) => i !== index));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      setError('A masterpiece needs a name. Please provide a title.');
      setLoading(false);
      return;
    }

    if (chapters.length === 0) {
      setError('A course without chapters is just a dream. Please add at least one unit.');
      setLoading(false);
      return;
    }

    try {
      let thumbnailUrl: string | null = null;
      if (thumbnail) {
        try {
          thumbnailUrl = await DbService.uploadThumbnail(user.id, thumbnail);
        } catch (err: any) {
          throw new Error('Failed to upload course cover art. Please check connection and try again.');
        }
      }

        if (isPaid && parseFloat(price) > 10000) {
          throw new Error('Masterpieces have value, but let\'s keep it accessible. Maximum price is ₹10,000.');
        }

        const finalPrice = isPaid ? (parseFloat(price) || 0) : 0;
        const slug = DbService.slugify(title);
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

      // Save chapters
      for (let i = 0; i < chapters.length; i++) {
        const ch = chapters[i];
        let videoUrl: string | undefined;

        if (ch.type === 'video' && ch.file) {
          try {
            videoUrl = await DbService.uploadVideo(user.id, courseId, ch.file, i);
          } catch (err: any) {
            throw new Error(`Upload failed for chapter ${i + 1} video. Course is saved partially, please edit. `);
          }
        }

        await DbService.addChapter(courseId, {
          title: ch.title?.trim() || `Chapter ${i + 1}`,
          type: ch.type,
          ...(videoUrl && { videoUrl }),
          ...(ch.pageUrl && { pageUrl: ch.pageUrl }),
          ...(ch.quizUrl && { quizUrl: ch.quizUrl }),
          position: i,
        });
      }

      navigate({ to: '/course/$slug', params: { slug: slug } });
    } catch (err: any) {
      setError(err.message || 'Failed to create course');
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
      case 'link': return 'text-accent bg-accent/10 border-accent/20';
      case 'quiz': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    }
  };

  const steps = [
    { id: 1, name: 'Foundation', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 2, name: 'Curriculum', icon: <VideoIcon className="w-4 h-4" /> },
    { id: 3, name: 'Review', icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto px-4 md:px-10 py-10 md:py-16">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-12 max-w-2xl mx-auto px-4">
           {steps.map((s, i) => (
             <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <button 
                  type="button"
                  onClick={() => step > s.id && setStep(s.id)}
                  className={`flex flex-col items-center gap-3 relative z-10 transition-all ${step >= s.id ? 'opacity-100' : 'opacity-30'}`}
                >
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all shadow-lg ${
                     step === s.id ? 'bg-primary border-primary text-white scale-110' : 
                     step > s.id ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 
                     'bg-white/5 border-white/10 text-white'
                   }`}>
                      {step > s.id ? <CheckCircle2 className="w-6 h-6" /> : s.icon}
                   </div>
                   <span className={`text-[10px] font-black uppercase tracking-widest ${step === s.id ? 'text-primary' : 'text-muted-foreground'}`}>
                      {s.name}
                   </span>
                </button>
                {i < steps.length - 1 && (
                  <div className="flex-1 h-[2px] mx-4 bg-white/5 relative top-[-15px]">
                     <motion.div 
                        initial={{ width: '0%' }}
                        animate={{ width: step > s.id ? '100%' : '0%' }}
                        className="h-full bg-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]" 
                     />
                  </div>
                )}
             </div>
           ))}
        </div>

        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-20">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/60">Creative Studio</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-[0.9]">Architect Your <br /> <span className="premium-gradient-text">Masterpiece.</span></h1>
          <p className="text-muted-foreground font-medium mt-6 max-w-xl text-lg opacity-80">Design a transformative learning experience that defines your legacy.</p>
        </motion.div>

        <form id="create-course-form" onSubmit={handleSubmit} className="relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Form Side */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-12">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-10"
                  >
                    <div className="space-y-4">
                      <h2 className="text-3xl font-black tracking-tight">Step 1: The <span className="premium-gradient-text">Foundation</span></h2>
                      <p className="text-muted-foreground text-sm font-medium">Define the core identity and value of your course.</p>
                    </div>

                    <section className="p-8 md:p-10 bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-[2.5rem] shadow-2xl space-y-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-2">Course Title</label>
                        <input 
                          type="text" 
                          value={title} 
                          onChange={e => setTitle(e.target.value)} 
                          required
                          className="w-full px-8 py-5 bg-black/40 border border-white/10 rounded-2xl text-white font-bold text-xl placeholder:text-white/10 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all"
                          placeholder="e.g., The Alchemy of Modern Design" 
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-2">Description</label>
                        <textarea 
                          value={description} 
                          onChange={e => setDescription(e.target.value)} 
                          rows={5}
                          className="w-full px-8 py-5 bg-black/40 border border-white/10 rounded-2xl text-white font-medium placeholder:text-white/10 focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all resize-none leading-relaxed"
                          placeholder="What will your students achieve?" 
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-2">Monetization</label>
                          <div className="flex p-1 bg-black/40 border border-white/10 rounded-2xl w-fit">
                            <button 
                              type="button"
                              onClick={() => { setIsPaid(false); setPrice('0'); }}
                              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isPaid ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                            >
                              Free
                            </button>
                            <button 
                              type="button"
                              onClick={() => setIsPaid(true)}
                              className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isPaid ? 'bg-primary text-white shadow-lg' : 'text-muted-foreground hover:text-white'}`}
                            >
                              Paid
                            </button>
                          </div>

                          {isPaid && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-2">Set Price (Max ₹10,000)</label>
                              <div className="relative group">
                                <IndianRupee className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <input 
                                  type="number" 
                                  value={price} 
                                  onChange={e => {
                                    const val = e.target.value;
                                    if (parseFloat(val) > 10000) {
                                      setPrice('10000');
                                    } else {
                                      setPrice(val);
                                    }
                                  }} 
                                  min="0" 
                                  max="10000"
                                  step="1"
                                  className="w-full pl-16 pr-8 py-5 bg-black/40 border border-white/10 rounded-2xl text-white font-black text-lg focus:outline-none focus:border-primary/50 transition-all" 
                                />
                              </div>
                              {parseFloat(price) > 0 && (
                                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-3">
                                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                                    <Zap className="w-4 h-4 text-emerald-500" />
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.1em]">Your Revenue Share (85%)</p>
                                    <p className="text-sm font-black text-white">You will earn ₹{(parseFloat(price) * 0.85).toFixed(2)} per student enrollment</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-2">Language</label>
                          <div className="relative group">
                            <Globe className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-all" />
                            <select 
                              value={language} 
                              onChange={e => setLanguage(e.target.value)}
                              className="w-full pl-16 pr-8 py-5 bg-black/40 border border-white/10 rounded-2xl text-white font-black text-lg focus:outline-none focus:border-primary/50 transition-all appearance-none cursor-pointer"
                            >
                              {[
                                'English', 'Hindi', 'Spanish', 'French', 'German', 
                                'Japanese', 'Mandarin', 'Bengali', 'Russian', 'Portuguese', 
                                'Arabic', 'Korean', 'Italian', 'Marathi', 'Tamil'
                              ].map(l => (
                                <option key={l} value={l} className="bg-[#0f0f0f] text-white">{l}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60 ml-2">Category</label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                             {[
                               { id: 'programming', label: 'Code', icon: <LayoutGrid className="w-4 h-4" /> },
                               { id: 'design', label: 'Art', icon: <Sparkles className="w-4 h-4" /> },
                               { id: 'business', label: 'Biz', icon: <IndianRupee className="w-4 h-4" /> },
                               { id: 'marketing', label: 'Ads', icon: <Tag className="w-4 h-4" /> },
                               { id: 'music', label: 'Music', icon: <Music className="w-4 h-4" /> },
                               { id: 'photography', label: 'Photo', icon: <Camera className="w-4 h-4" /> },
                               { id: 'science', label: 'Sci', icon: <Microscope className="w-4 h-4" /> },
                               { id: 'math', label: 'Math', icon: <Calculator className="w-4 h-4" /> },
                               { id: 'language', label: 'Lang', icon: <Globe className="w-4 h-4" /> },
                               { id: 'general', label: 'Misc', icon: <BookOpen className="w-4 h-4" /> }
                             ].map(cat => (
                               <button 
                                 key={cat.id}
                                 type="button"
                                 onClick={() => setCategory(cat.id)}
                                 className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${
                                   category === cat.id ? 'bg-primary/20 border-primary text-primary' : 'bg-black/40 border-white/5 text-muted-foreground hover:border-white/20'
                                 }`}
                               >
                                  {cat.icon}
                                  <span className="text-[9px] font-black uppercase tracking-widest">{cat.label}</span>
                               </button>
                             ))}
                          </div>
                        </div>
                      </div>
                    </section>

                    <div className="flex justify-end">
                       <button 
                         type="button" 
                         onClick={() => setStep(2)}
                         className="px-10 py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                       >
                         Next: Curriculum <ArrowRight className="w-5 h-5" />
                       </button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-10"
                  >
                    <div className="space-y-4">
                      <h2 className="text-3xl font-black tracking-tight">Step 2: Build the <span className="premium-gradient-text">Journey</span></h2>
                      <p className="text-muted-foreground text-sm font-medium">Add chapters and content to structure your course.</p>
                    </div>

                    <section className="p-8 md:p-10 bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-[2.5rem] shadow-2xl space-y-8">
                      <div className="flex items-center justify-between">
                         <h3 className="text-xl font-black">Course Curriculum</h3>
                         <div className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-widest">{chapters.length} Units</div>
                      </div>

                      <div className="space-y-4">
                        <AnimatePresence mode="popLayout">
                          {chapters.map((ch, i) => (
                            <motion.div 
                              layout
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              key={i} 
                              className="p-6 bg-black/40 border border-white/5 rounded-3xl group hover:border-primary/30 transition-all space-y-4 shadow-sm"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 font-black border border-white/5 group-hover:bg-primary/20 group-hover:text-primary transition-all text-sm">
                                  {String(i + 1).padStart(2, '0')}
                                </div>
                                <input 
                                  type="text" 
                                  value={ch.title} 
                                  onChange={e => updateChapter(i, { title: e.target.value })}
                                  placeholder="Untitled Chapter" 
                                  className="flex-1 bg-transparent text-white font-bold text-lg placeholder:text-white/10 focus:outline-none" 
                                />
                                <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border hidden sm:flex ${getChapterColor(ch.type)}`}>
                                  <span className="flex items-center gap-1.5">{getChapterIcon(ch.type)} {ch.type}</span>
                                </div>
                                <button type="button" onClick={() => removeChapter(i)} 
                                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all">
                                  <X className="w-5 h-5" />
                                </button>
                              </div>

                              <div className="ml-14">
                                {ch.type === 'video' && (
                                  ch.file ? (
                                    <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl">
                                      <VideoIcon className="w-4 h-4 text-primary" />
                                      <span className="text-sm font-medium text-white truncate max-w-[200px]">{ch.file.name}</span>
                                      <button type="button" onClick={() => updateChapter(i, { file: undefined })} 
                                        className="text-muted-foreground hover:text-destructive ml-auto">
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ) : (
                                    <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-white/10 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                                      <Upload className="w-4 h-4 text-muted-foreground" />
                                      <span className="text-sm font-medium text-muted-foreground">Select video...</span>
                                      <input type="file" accept="video/*" className="hidden" onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) updateChapter(i, { file });
                                      }} />
                                    </label>
                                  )
                                )}

                                {ch.type === 'link' && (
                                  <input 
                                    type="url" 
                                    value={ch.pageUrl || ''} 
                                    onChange={e => updateChapter(i, { pageUrl: e.target.value })}
                                    placeholder="Paste URL here..."
                                    className="w-full px-4 py-3 bg-black/30 border border-white/5 rounded-xl text-white text-sm font-medium placeholder:text-white/10 focus:outline-none focus:border-accent/40" 
                                  />
                                )}

                                {ch.type === 'quiz' && (
                                   <div className="space-y-3">
                                      <select 
                                        value={ch.quizUrl || ''} 
                                        onChange={e => updateChapter(i, { quizUrl: e.target.value })}
                                        className="w-full px-4 py-3 bg-black/30 border border-white/5 rounded-xl text-white text-sm font-medium focus:outline-none focus:border-amber-400/40 appearance-none cursor-pointer" 
                                      >
                                        <option value="" className="bg-[#0a0a0a]">Select your quiz...</option>
                                        {userTests.map(test => (
                                          <option key={test.id} value={`/test/${test.id}`} className="bg-[#0a0a0a]">
                                            {test.title}
                                          </option>
                                        ))}
                                      </select>
                                      {userTests.length === 0 && (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-400/5 border border-amber-400/10 rounded-lg">
                                           <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                                           <p className="text-[10px] text-amber-400/60 font-bold uppercase tracking-widest">No quizzes found. Create one first!</p>
                                        </div>
                                      )}
                                   </div>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        <div className="grid grid-cols-3 gap-3 pt-6">
                           {[
                             { type: 'video' as ChapterType, icon: <VideoIcon className="w-4 h-4" />, label: 'Video', color: 'primary' },
                             { type: 'link' as ChapterType, icon: <LinkIcon className="w-4 h-4" />, label: 'Page', color: 'accent' },
                             { type: 'quiz' as ChapterType, icon: <FileQuestion className="w-4 h-4" />, label: 'Quiz', color: 'amber-400' }
                           ].map(btn => (
                             <button 
                               key={btn.type}
                               type="button" 
                               onClick={() => addChapter(btn.type)}
                               className="flex flex-col items-center gap-2 p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.05] hover:border-white/10 transition-all group"
                             >
                                <div className={`p-2 rounded-lg bg-white/5 text-white group-hover:scale-110 transition-transform`}>
                                   {btn.icon}
                                </div>
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{btn.label}</span>
                             </button>
                           ))}
                        </div>
                      </div>
                    </section>

                    <div className="flex justify-between items-center">
                       <button type="button" onClick={() => setStep(1)} className="text-muted-foreground font-black text-xs uppercase tracking-widest hover:text-white transition-colors">
                          Go Back
                       </button>
                       <button 
                         type="button" 
                         onClick={() => setStep(3)}
                         className="px-10 py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                       >
                         Next: Review <ArrowRight className="w-5 h-5" />
                       </button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div 
                    key="step3"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-10"
                  >
                    <div className="space-y-4">
                      <h2 className="text-3xl font-black tracking-tight">Final <span className="premium-gradient-text">Deployment</span></h2>
                      <p className="text-muted-foreground text-sm font-medium">Verify everything and set your access licensing.</p>
                    </div>

                    <section className="p-8 md:p-10 bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-[2.5rem] shadow-2xl space-y-10">
                      <div className="space-y-4">
                         <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60">Course Cover Art</h4>
                         <label className="relative block aspect-video rounded-3xl overflow-hidden border-2 border-dashed border-white/10 cursor-pointer group hover:border-primary/50 transition-all">
                            {thumbnail ? (
                              <div className="relative w-full h-full">
                                 <img src={URL.createObjectURL(thumbnail)} className="w-full h-full object-cover" alt="Preview" />
                                 <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                     <span className="text-[10px] font-black uppercase text-white tracking-[0.2em] bg-black/60 px-4 py-2 rounded-xl backdrop-blur-md">Change Cover</span>
                                 </div>
                              </div>
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/5">
                                 <div className="p-5 bg-white/5 rounded-2xl border border-white/5 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all">
                                    <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-all" />
                                 </div>
                                 <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Drop artwork here</span>
                              </div>
                            )}
                            <input type="file" accept="image/*" className="hidden" onChange={e => setThumbnail(e.target.files?.[0] || null)} />
                         </label>
                      </div>

                      {parseFloat(price) > 0 ? (
                        <div className="space-y-6">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60">Access Duration</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <button 
                               type="button" 
                               onClick={() => { setHasExpiry(false); setExpiresInDays(''); }}
                               className={`p-6 rounded-2xl border-2 transition-all text-left flex items-center gap-5 ${!hasExpiry ? 'border-primary bg-primary/10' : 'border-white/5 bg-black/20 hover:bg-white/5'}`}
                             >
                                <div className={`p-3 rounded-xl ${!hasExpiry ? 'bg-primary/20 text-primary' : 'bg-white/5 text-muted-foreground'}`}>
                                   <Infinity className="w-6 h-6" />
                                </div>
                                <div>
                                   <p className={`font-black text-sm ${!hasExpiry ? 'text-white' : 'text-muted-foreground'}`}>Lifetime Access</p>
                                   <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Never Expires</p>
                                </div>
                             </button>
                             
                             <button 
                               type="button" 
                               onClick={() => setHasExpiry(true)}
                               className={`p-6 rounded-2xl border-2 transition-all text-left flex items-center gap-5 ${hasExpiry ? 'border-amber-400 bg-amber-400/10' : 'border-white/5 bg-black/20 hover:bg-white/5'}`}
                             >
                                <div className={`p-3 rounded-xl ${hasExpiry ? 'bg-amber-400/20 text-amber-400' : 'bg-white/5 text-muted-foreground'}`}>
                                   <Clock className="w-6 h-6" />
                                </div>
                                <div>
                                   <p className={`font-black text-sm ${hasExpiry ? 'text-white' : 'text-muted-foreground'}`}>Time-Limited</p>
                                   <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Sets Expiration</p>
                                </div>
                             </button>
                          </div>

                          <AnimatePresence>
                            {hasExpiry && (
                              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="pt-2">
                                 <input 
                                   type="number" 
                                   min="1" 
                                   value={expiresInDays} 
                                   onChange={e => setExpiresInDays(e.target.value)} 
                                   required={hasExpiry}
                                   className="w-full px-6 py-4 bg-amber-400/5 border border-amber-400/20 rounded-2xl text-amber-400 font-black focus:outline-none"
                                   placeholder="Validity in days (e.g. 365)" 
                                 />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ) : (
                        <div className="p-8 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl flex items-center gap-6">
                           <div className="p-4 bg-emerald-500/10 rounded-2xl">
                              <Infinity className="w-8 h-8 text-emerald-500" />
                           </div>
                           <div className="space-y-1">
                              <h4 className="text-emerald-500 font-black uppercase tracking-widest text-[10px]">Perpetual Access</h4>
                              <p className="text-muted-foreground text-sm font-medium">Free courses are always deployed with **Lifetime Access** for all students.</p>
                           </div>
                        </div>
                      )}
                    </section>

                    <div className="flex justify-between items-center">
                       <button type="button" onClick={() => setStep(2)} className="text-muted-foreground font-black text-xs uppercase tracking-widest hover:text-white transition-colors">
                          Back to Curriculum
                       </button>
                       <button 
                         type="submit" 
                         disabled={loading}
                         className="px-12 py-5 bg-white text-black rounded-2xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                       >
                         {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Sparkles className="w-5 h-5" /> Deploy Masterpiece</>}
                       </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 space-y-8">
               <div className="p-8 bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-[2.5rem] space-y-8">
                  <div className="flex items-center justify-between">
                     <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Live Preview</h3>
                     <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] font-black uppercase text-emerald-500">Live Sync</span>
                     </div>
                  </div>

                  <div className="relative group">
                     <div className="absolute -inset-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                     <div className="relative bg-[#121212] border border-white/5 rounded-[1.8rem] overflow-hidden shadow-2xl">
                        <div className="aspect-video bg-white/5 relative flex items-center justify-center">
                           {thumbnail ? (
                             <img src={URL.createObjectURL(thumbnail)} className="w-full h-full object-cover" />
                           ) : (
                             <LayoutGrid className="w-12 h-12 text-white/5" />
                           )}
                           <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-black text-white uppercase tracking-widest">
                              {price === '0' || !price ? 'Free' : `₹${price}`}
                           </div>
                        </div>
                        <div className="p-6 space-y-4">
                           <div className="flex gap-4">
                              <div className="w-8 h-8 rounded-full bg-primary/20 shrink-0 flex items-center justify-center text-[10px] font-black text-primary">
                                 <User className="w-4 h-4 text-primary/40" />
                              </div>
                              <div className="space-y-2 flex-1">
                                 <h4 className={`text-sm font-bold leading-tight ${!title ? 'text-white/10' : 'text-white'}`}>
                                    {title || 'Your Course Title Here'}
                                 </h4>
                                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    {dbUser?.fullName || user?.displayName || 'Creator Name'}
                                 </p>
                              </div>
                           </div>
                           <div className="flex items-center justify-between pt-2 border-t border-white/5">
                              <div className="flex items-center gap-1 text-[9px] font-black text-primary uppercase tracking-widest">
                                 <BookOpen className="w-3 h-3" />
                                 {chapters.length} Chapters
                              </div>
                              <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">{category}</span>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4 pt-4">
                     <div className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl">
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Completion</span>
                           <span className="text-[9px] font-black uppercase text-primary tracking-widest">
                              {Math.round(((title ? 1 : 0) + (description ? 1 : 0) + (thumbnail ? 1 : 0) + (chapters.length > 0 ? 1 : 0)) / 4 * 100)}%
                           </span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                           <motion.div 
                             className="h-full bg-primary" 
                             animate={{ width: `${((title ? 1 : 0) + (description ? 1 : 0) + (thumbnail ? 1 : 0) + (chapters.length > 0 ? 1 : 0)) / 4 * 100}%` }}
                           />
                        </div>
                     </div>
                     <p className="text-[10px] text-muted-foreground font-medium text-center leading-relaxed">
                        Course will be deployed to the **EduNook Global Edge Network** upon completion.
                     </p>
                  </div>
               </div>
            </div>
          </div>
        </form>

        <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-black/80 backdrop-blur-2xl border-t border-white/10 z-50 flex items-center justify-between">
           <button 
             type="button" 
             disabled={step === 1}
             onClick={() => setStep(s => Math.max(1, s - 1))}
             className="px-6 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground disabled:opacity-0 transition-all"
           >
              Back
           </button>
           
           {step < 3 ? (
             <button 
               type="button" 
               onClick={() => setStep(s => Math.min(3, s + 1))}
               className="px-8 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20"
             >
                Next Step
             </button>
           ) : (
             <button 
               form="create-course-form"
               type="submit" 
               disabled={loading}
               className="px-8 py-3 bg-white text-black rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-white/10"
             >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Deploy Now'}
             </button>
           )}
        </div>
      </div>
    </Layout>
  );
}
