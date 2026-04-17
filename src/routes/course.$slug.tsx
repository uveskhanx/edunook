import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { DbService, Course, Video, Chapter, Profile } from '@/lib/db-service';
import { Layout } from '@/components/Layout';
import { Play, FileText, CheckCircle, ChevronRight, User, BookOpen, Clock, Sparkles, MessageCircle, Share2, Award, Zap, Link as LinkIcon, FileQuestion, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Route = createFileRoute('/course/$slug')({
  head: ({ params }) => ({
    meta: [
      { title: `Learning — EduNook` },
    ],
  }),
  component: CourseViewPage,
});

type EnrichedCourse = Course & { profiles: Profile | null };

function CourseViewPage() {
  const { slug } = Route.useParams();
  const [course, setCourse] = useState<EnrichedCourse | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [c] = await Promise.all([
          DbService.getCourse(slug),
        ]);
        
        if (c) {
          // Increment views
          DbService.incrementCourseViews(c.id);

          const [v, ch] = await Promise.all([
            DbService.getVideos(c.id),
            DbService.getChapters(c.id),
          ]);
          setCourse(c);
          setVideos(v);
          setChapters(ch);
          
          if (ch.length > 0) setActiveChapter(ch[0]);
          else if (v.length > 0) setActiveVideo(v[0]);
        }
      } catch (err) {
        console.error('Error loading course:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  if (loading) return <Layout><div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div></Layout>;
  if (!course) return <Layout><div className="p-12 text-center text-2xl font-black">Course not found</div></Layout>;

  // Determine what to render in the main player area
  const renderMainContent = () => {
    // New chapter system
    if (activeChapter) {
      switch (activeChapter.type) {
        case 'video':
          return (
            <div className="aspect-video w-full relative bg-black">
              {activeChapter.videoUrl ? (
                <motion.video
                  key={activeChapter.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  src={activeChapter.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  poster={course.thumbnailUrl || undefined}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Play className="w-16 h-16 text-muted-foreground opacity-20" />
                </div>
              )}
            </div>
          );
        case 'link':
          return (
            <div className="aspect-video w-full relative bg-[#0a0a0a]">
              {activeChapter.pageUrl ? (
                <iframe
                  src={activeChapter.pageUrl}
                  className="w-full h-full border-0"
                  title={activeChapter.title}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                  <LinkIcon className="w-12 h-12 text-accent opacity-20" />
                  <p className="text-sm text-muted-foreground font-medium">No URL provided</p>
                </div>
              )}
            </div>
          );
        case 'quiz':
          return (
            <div className="aspect-video w-full relative bg-[#0a0a0a] flex flex-col items-center justify-center gap-6">
              <div className="p-6 bg-amber-400/10 rounded-full">
                <FileQuestion className="w-16 h-16 text-amber-400" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-black text-white">{activeChapter.title}</h3>
                <p className="text-muted-foreground font-medium">Test your knowledge with this quiz</p>
              </div>
              {activeChapter.quizUrl && (
                <a
                  href={activeChapter.quizUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-amber-400 text-black rounded-2xl font-black shadow-lg shadow-amber-400/20 hover:scale-105 active:scale-95 transition-all"
                >
                  <FileQuestion className="w-5 h-5" /> Start Quiz <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          );
      }
    }
    
    // Legacy video system fallback
    if (activeVideo) {
      return (
        <div className="aspect-video w-full relative bg-black">
          <motion.video
            key={activeVideo.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            src={activeVideo.videoUrl}
            controls
            className="w-full h-full object-contain"
            poster={course.thumbnailUrl || undefined}
          />
        </div>
      );
    }

    return (
      <div className="aspect-video w-full flex items-center justify-center bg-card/20">
        <Play className="w-16 h-16 text-muted-foreground opacity-20" />
      </div>
    );
  };

  const getChapterTypeIcon = (type: Chapter['type']) => {
    switch (type) {
      case 'video': return <Play className="w-4 h-4" />;
      case 'link': return <LinkIcon className="w-4 h-4" />;
      case 'quiz': return <FileQuestion className="w-4 h-4" />;
    }
  };

  const getChapterTypeLabel = (type: Chapter['type']) => {
    switch (type) {
      case 'video': return 'Video';
      case 'link': return 'Webpage';
      case 'quiz': return 'Quiz';
    }
  };

  // Determine the active label for the status bar
  const activeLabel = activeChapter 
    ? getChapterTypeLabel(activeChapter.type) 
    : 'Video';

  const totalItems = chapters.length > 0 ? chapters.length : videos.length;

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-64px)] bg-[#050505]">
        {/* Main Content: Player & Details */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Cinema Player Section */}
          <div className="w-full bg-black flex flex-col space-y-4">
             {renderMainContent()}
             
             {/* Player Controls Underlay */}
             <div className="px-8 py-4 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-xl border border-primary/20">
                        <Zap className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">In Session</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                        <Clock className="w-4 h-4" />
                        <span>{activeLabel} Chapter</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                   <button className="p-2 text-muted-foreground hover:text-white transition-colors"><Share2 className="w-5 h-5" /></button>
                   <button className="p-2 text-muted-foreground hover:text-white transition-colors"><MessageCircle className="w-5 h-5" /></button>
                </div>
             </div>
          </div>

          {/* Content Details */}
          <div className="p-8 md:p-12 max-w-5xl space-y-10 pb-32">
             <div className="space-y-6">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-4">
                    <span className="px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground">{course.category}</span>
                    <div className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-accent">
                        <Award className="w-4 h-4" />
                        {course.price === 0 ? 'Free Course' : `₹${course.price}`}
                    </div>
                </motion.div>
                <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-[0.9]">{course.title}</h1>
                <div className="flex items-center gap-4">
                    <Link to="/$username" params={{ username: course.profiles?.username || '' }} className="flex items-center gap-3 p-1.5 pr-6 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/20 flex items-center justify-center text-primary font-black overflow-hidden relative">
                            {course.profiles?.avatarUrl ? <img src={course.profiles.avatarUrl} className="w-full h-full object-cover" /> : course.profiles?.fullName?.[0]}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-black text-white group-hover:text-primary transition-colors">{course.profiles?.fullName}</span>
                            <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase opacity-40">Creator</span>
                        </div>
                    </Link>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <section className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">About This Course</h3>
                    <p className="text-xl text-muted-foreground leading-relaxed font-medium opacity-80">
                        {course.description || "A comprehensive learning experience designed to help you master new skills."}
                    </p>
                </section>
                <section className="p-8 bg-card/30 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] space-y-6 h-fit">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">What you'll learn</h3>
                    <ul className="space-y-4">
                        {['Core concepts and fundamentals', 'Hands-on practice exercises', 'Real-world applications', 'Certificate of completion'].map((item, i) => (
                            <li key={i} className="flex items-start gap-4 text-sm font-bold text-white/80">
                                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </section>
             </div>
          </div>
        </div>

        {/* Sidebar: Curriculum */}
        <div className="w-full lg:w-96 lg:sticky lg:top-0 h-fit lg:h-screen lg:overflow-y-auto bg-black/40 backdrop-blur-xl border-l border-white/5 shadow-2xl z-20">
          <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
               <BookOpen className="w-6 h-6 text-primary" />
               Curriculum
            </h2>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">{totalItems} Chapters</span>
          </div>
          
          <div className="p-4 space-y-2 pb-32">
            <AnimatePresence>
              {/* New Chapters System */}
              {chapters.length > 0 && chapters.map((chapter, idx) => {
                const isActive = activeChapter?.id === chapter.id;
                return (
                  <motion.button
                    key={chapter.id}
                    onClick={() => { setActiveChapter(chapter); setActiveVideo(null); }}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`w-full group rounded-2xl p-4 transition-all text-left flex items-center gap-5 border ${
                      isActive 
                        ? 'bg-primary/10 border-primary/30 shadow-xl' 
                        : 'border-transparent hover:bg-white/5 hover:border-white/5'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      isActive ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/30' : 'bg-white/5 text-muted-foreground group-hover:bg-white/10 group-hover:text-white'
                    }`}>
                      {isActive ? <Sparkles className="w-6 h-6 animate-pulse" /> : getChapterTypeIcon(chapter.type)}
                    </div>
                    <div className="flex-1 space-y-0.5 min-w-0">
                      <p className={`text-sm font-black transition-colors truncate ${isActive ? 'text-white' : 'text-muted-foreground group-hover:text-white'}`}>
                        {chapter.title}
                      </p>
                      <div className="flex items-center gap-2">
                         <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-primary shadow-[0_0_8px_var(--primary)]' : 'bg-muted-foreground/30'}`} />
                         <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{getChapterTypeLabel(chapter.type)}</span>
                      </div>
                    </div>
                    {isActive && (
                       <div className="hidden md:flex flex-col gap-0.5">
                          {[0, 1, 2].map(i => <div key={i} className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />)}
                       </div>
                    )}
                  </motion.button>
                );
              })}

              {/* Legacy Videos Fallback */}
              {chapters.length === 0 && videos.map((video, idx) => {
                const isPlaying = activeVideo?.id === video.id;
                return (
                  <motion.button
                    key={video.id}
                    onClick={() => { setActiveVideo(video); setActiveChapter(null); }}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`w-full group rounded-2xl p-4 transition-all text-left flex items-center gap-5 border ${
                      isPlaying 
                        ? 'bg-primary/10 border-primary/30 shadow-xl' 
                        : 'border-transparent hover:bg-white/5 hover:border-white/5'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black transition-all ${
                      isPlaying ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/30' : 'bg-white/5 text-muted-foreground group-hover:bg-white/10 group-hover:text-white'
                    }`}>
                      {isPlaying ? <Sparkles className="w-6 h-6 animate-pulse" /> : String(idx + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <p className={`text-sm font-black transition-colors ${isPlaying ? 'text-white' : 'text-muted-foreground group-hover:text-white'}`}>
                        {video.title}
                      </p>
                      <div className="flex items-center gap-2">
                         <div className={`w-1 h-1 rounded-full ${isPlaying ? 'bg-primary shadow-[0_0_8px_var(--primary)]' : 'bg-muted-foreground/30'}`} />
                         <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Video</span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>

            {totalItems === 0 && (
              <div className="p-10 text-center space-y-6">
                 <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-muted-foreground opacity-20">
                    <Play className="w-8 h-8" />
                 </div>
                 <p className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-40">No chapters yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
