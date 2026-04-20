import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { DbService } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { Upload, Plus, X, Loader2, BookOpen, DollarSign, Tag, Video as VideoIcon, Sparkles, LayoutGrid, CheckCircle2, Link as LinkIcon, FileQuestion, GripVertical, Clock, ShieldAlert, Infinity } from 'lucide-react';
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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [category, setCategory] = useState('general');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [chapters, setChapters] = useState<ChapterDraft[]>([]);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    setError('');
    setLoading(true);

    try {
      let thumbnailUrl: string | null = null;
      if (thumbnail) {
        try {
          thumbnailUrl = await DbService.uploadThumbnail(user.id, thumbnail);
        } catch (err: any) {
          throw new Error('Failed to upload course cover art. Please check connection and try again.');
        }
      }

      const slug = DbService.slugify(title);
      const courseId = await DbService.createCourse(user.id, {
        title,
        slug,
        description,
        price: parseFloat(price) || 0,
        category,
        thumbnailUrl,
        expiresInDays: hasExpiry && expiresInDays ? parseInt(expiresInDays, 10) : null,
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

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-6 py-12 md:py-24">
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

        <form onSubmit={handleSubmit} className="space-y-16">
          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="p-6 bg-destructive/10 border border-destructive/20 rounded-3xl text-destructive font-bold text-center">
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
            <div className="lg:col-span-2 space-y-12">
              {/* Module 1: Core Foundation */}
              <section className="p-10 bg-[#121212] border border-white/5 rounded-[3rem] shadow-xl relative">
                <div className="flex items-center gap-4 mb-10">
                   <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-primary font-black border border-white/10">01</div>
                   <h3 className="text-2xl font-black tracking-tight">Core Foundation</h3>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Course Title</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
                      className="w-full px-8 py-5 bg-background/50 border border-white/5 rounded-2xl text-white font-bold text-xl placeholder:text-muted-foreground/20 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                      placeholder="e.g., The Alchemy of Modern Design" />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={6}
                      className="w-full px-8 py-5 bg-background/50 border border-white/5 rounded-2xl text-white font-medium placeholder:text-muted-foreground/20 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all resize-none leading-relaxed"
                      placeholder="Describe what students will learn..." />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Price ($)</label>
                      <div className="relative group">
                        <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.01"
                          className="w-full pl-16 pr-8 py-5 bg-background/50 border border-white/5 rounded-2xl text-white font-black text-lg focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Category</label>
                      <div className="relative group">
                        <select value={category} onChange={e => setCategory(e.target.value)}
                          className="w-full px-8 py-5 bg-background/50 border border-white/5 rounded-2xl text-white font-black text-lg focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none cursor-pointer">
                          {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                        </select>
                        <Tag className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none opacity-40" />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Module 2: Access Licensing */}
              <section className="p-10 bg-[#121212] border border-white/5 rounded-[3rem] shadow-xl relative">
                <div className="flex items-center gap-4 mb-10">
                   <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-primary font-black border border-white/10">02</div>
                   <h3 className="text-2xl font-black tracking-tight">Access Licensing</h3>
                </div>

                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row gap-6">
                    <button 
                      type="button" 
                      onClick={() => { setHasExpiry(false); setExpiresInDays(''); }}
                      className={`flex-1 p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${!hasExpiry ? 'border-primary bg-primary/10' : 'border-white/5 bg-background/50 hover:bg-white/5'}`}
                    >
                       <Infinity className={`w-8 h-8 ${!hasExpiry ? 'text-primary' : 'text-muted-foreground'}`} />
                       <span className={`font-black tracking-widest uppercase text-[10px] ${!hasExpiry ? 'text-primary' : 'text-muted-foreground'}`}>Lifetime Access</span>
                    </button>
                    
                    <button 
                      type="button" 
                      onClick={() => setHasExpiry(true)}
                      className={`flex-1 p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${hasExpiry ? 'border-amber-400 bg-amber-400/10' : 'border-white/5 bg-background/50 hover:bg-white/5'}`}
                    >
                       <Clock className={`w-8 h-8 ${hasExpiry ? 'text-amber-400' : 'text-muted-foreground'}`} />
                       <span className={`font-black tracking-widest uppercase text-[10px] ${hasExpiry ? 'text-amber-400' : 'text-muted-foreground'}`}>Limited Time</span>
                    </button>
                  </div>

                  <AnimatePresence>
                    {hasExpiry && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="pt-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">Validity Duration (Days)</label>
                          <div className="relative group mt-3">
                            <ShieldAlert className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500/50 group-focus-within:text-amber-400 transition-colors" />
                            <input type="number" min="1" max="3650" value={expiresInDays} onChange={e => setExpiresInDays(e.target.value)} required={hasExpiry}
                              className="w-full pl-16 pr-8 py-5 bg-amber-400/5 border border-amber-400/20 rounded-2xl text-amber-400 font-black text-lg focus:outline-none focus:ring-4 focus:ring-amber-400/20 transition-all placeholder:text-amber-400/30"
                              placeholder="e.g. 30 for one month" />
                            <div className="absolute top-full mt-2 left-2 right-2 text-xs text-amber-500/70 font-medium">After this period from purchase, access will automatically expire and revoke.</div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>

              {/* Module 3: Chapters (Advanced) */}
              <section className="p-10 bg-[#121212] border border-white/5 rounded-[3rem] shadow-xl relative">
                <div className="flex items-center justify-between mb-10">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-primary font-black border border-white/10">03</div>
                      <h3 className="text-2xl font-black tracking-tight">Chapters</h3>
                   </div>
                   <span className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-2xl text-[10px] font-black uppercase tracking-widest">{chapters.length} Chapters</span>
                </div>

                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {chapters.map((ch, i) => (
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} key={i} 
                        className="p-6 bg-background/40 border border-white/5 rounded-3xl group hover:border-primary/30 transition-all space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 font-black border border-white/5 group-hover:bg-primary/20 group-hover:text-primary transition-all text-sm">
                            {String(i + 1).padStart(2, '0')}
                          </div>
                          <input type="text" value={ch.title} onChange={e => updateChapter(i, { title: e.target.value })}
                            placeholder="Chapter Title" 
                            className="flex-1 bg-transparent text-white font-black text-lg placeholder:text-muted-foreground/30 focus:outline-none" />
                          <div className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${getChapterColor(ch.type)}`}>
                            <span className="flex items-center gap-1.5">{getChapterIcon(ch.type)} {ch.type}</span>
                          </div>
                          <button type="button" onClick={() => removeChapter(i)} 
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all">
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Type-specific inputs */}
                        {ch.type === 'video' && (
                          <div className="ml-14">
                            {ch.file ? (
                              <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl">
                                <VideoIcon className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium text-white truncate">{ch.file.name}</span>
                                <button type="button" onClick={() => updateChapter(i, { file: undefined })} className="text-muted-foreground hover:text-destructive ml-auto">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-white/10 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                                <Upload className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground">Upload video file</span>
                                <input type="file" accept="video/*" className="hidden" onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) updateChapter(i, { file });
                                }} />
                              </label>
                            )}
                          </div>
                        )}

                        {ch.type === 'link' && (
                          <div className="ml-14">
                            <input type="url" value={ch.pageUrl || ''} onChange={e => updateChapter(i, { pageUrl: e.target.value })}
                              placeholder="https://example.com/page"
                              className="w-full px-4 py-3 bg-background/50 border border-white/5 rounded-xl text-white text-sm font-medium placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-accent/20" />
                          </div>
                        )}

                        {ch.type === 'quiz' && (
                          <div className="ml-14">
                            <input type="url" value={ch.quizUrl || ''} onChange={e => updateChapter(i, { quizUrl: e.target.value })}
                              placeholder="https://quiz-link.com or /tests/testId"
                              className="w-full px-4 py-3 bg-background/50 border border-white/5 rounded-xl text-white text-sm font-medium placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-amber-400/20" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Add Chapter Buttons */}
                  <div className="grid grid-cols-3 gap-3 pt-4">
                    <button type="button" onClick={() => addChapter('video')}
                      className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group">
                      <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:scale-110 transition-transform">
                        <VideoIcon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-white">Video</span>
                    </button>
                    <button type="button" onClick={() => addChapter('link')}
                      className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-all group">
                      <div className="p-3 bg-accent/10 text-accent rounded-xl group-hover:scale-110 transition-transform">
                        <LinkIcon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-white">Webpage</span>
                    </button>
                    <button type="button" onClick={() => addChapter('quiz')}
                      className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-amber-400/50 hover:bg-amber-400/5 transition-all group">
                      <div className="p-3 bg-amber-400/10 text-amber-400 rounded-xl group-hover:scale-110 transition-transform">
                        <FileQuestion className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-white">Quiz</span>
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <aside className="space-y-12">
              {/* Module 3: Visual Identity */}
              <section className="p-10 bg-[#121212] border border-white/5 rounded-[3rem] shadow-xl">
                <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-10 text-center">Visual Identity</h3>
                <label className="relative block aspect-[16/9] rounded-3xl overflow-hidden border-2 border-dashed border-white/10 cursor-pointer group hover:border-primary/50 transition-all">
                   {thumbnail ? (
                     <div className="relative w-full h-full">
                        <img src={URL.createObjectURL(thumbnail)} className="w-full h-full object-cover" alt="Preview" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-black uppercase text-white tracking-[0.2em] bg-black/60 px-4 py-2 rounded-xl backdrop-blur-md">Change Cover</span>
                        </div>
                     </div>
                   ) : (
                     <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/5">
                        <Upload className="w-12 h-12 text-muted-foreground opacity-20 group-hover:text-primary group-hover:opacity-100 transition-all" />
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] opacity-40">Upload Cover Art</span>
                     </div>
                   )}
                   <input type="file" accept="image/*" className="hidden" onChange={e => setThumbnail(e.target.files?.[0] || null)} />
                </label>
                <p className="text-[10px] text-muted-foreground font-medium text-center mt-6 uppercase tracking-widest opacity-40 italic">Stored on Cloudinary CDN</p>
              </section>

              {/* Deployment Hub */}
              <div className="sticky top-24 p-10 bg-white text-black rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(255,255,255,0.1)] space-y-8">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 text-black/60">Ready to Publish?</p>
                  <h3 className="text-3xl font-black tracking-tighter">Deploy Now.</h3>
                </div>
                <div className="space-y-4">
                   <div className="flex items-center gap-3 text-xs font-bold text-black/70">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span>Cloudinary CDN Delivery</span>
                   </div>
                   <div className="flex items-center gap-3 text-xs font-bold text-black/70">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span>Video + Link + Quiz chapters</span>
                   </div>
                   
                   {hasExpiry && expiresInDays && (
                     <div className="flex items-center gap-3 text-xs font-bold text-amber-600">
                        <Clock className="w-5 h-5" />
                        <span>Expires {expiresInDays} days after purchase</span>
                     </div>
                   )}
                </div>
                
                <button type="submit" disabled={loading}
                  className="w-full py-6 bg-black text-white rounded-[2rem] font-black text-lg shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Plus className="w-6 h-6" /> Go Live Now</>}
                </button>
              </div>
            </aside>
          </div>
        </form>
      </div>
    </Layout>
  );
}
