import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ArrowLeft, Play } from 'lucide-react';

export const Route = createFileRoute('/course/$courseId')({
  component: CourseDetailPage,
});

type CourseDetail = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  category: string;
  keywords: string[] | null;
  user_id: string;
  profiles: { username: string; full_name: string; avatar_url: string | null } | null;
};

type Video = {
  id: string;
  title: string;
  video_url: string;
  position: number;
};

function CourseDetailPage() {
  const { courseId } = Route.useParams();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);

  useEffect(() => {
    async function load() {
      const [courseRes, videosRes] = await Promise.all([
        supabase.from('courses').select('id, title, description, thumbnail_url, price, category, keywords, user_id, profiles!courses_user_id_fkey(username, full_name, avatar_url)').eq('id', courseId).single(),
        supabase.from('videos').select('*').eq('course_id', courseId).order('position'),
      ]);
      if (courseRes.data) setCourse(courseRes.data as unknown as CourseDetail);
      const vids = (videosRes.data || []) as Video[];
      setVideos(vids);
      if (vids.length > 0) setActiveVideo(vids[0]);
      setLoading(false);
    }
    load();
  }, [courseId]);

  if (loading) return <Layout><LoadingSpinner className="py-20" /></Layout>;
  if (!course) return <Layout><div className="text-center py-20 text-muted-foreground">Course not found</div></Layout>;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        {/* Video Player */}
        {activeVideo && (
          <div className="aspect-video bg-background rounded-xl overflow-hidden mb-4 border border-border">
            <video src={activeVideo.video_url} controls className="w-full h-full" />
          </div>
        )}

        {/* Course Info */}
        <h1 className="text-xl md:text-2xl font-bold text-foreground">{course.title}</h1>

        <div className="flex items-center gap-3 mt-3">
          <Link to="/user/$userId" params={{ userId: course.user_id }} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
              {course.profiles?.avatar_url ? (
                <img src={course.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                  {(course.profiles?.username || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{course.profiles?.full_name || course.profiles?.username}</span>
          </Link>
          <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${course.price === 0 ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
            {course.price === 0 ? 'Free' : `$${course.price}`}
          </span>
          <span className="text-xs text-muted-foreground capitalize">{course.category}</span>
        </div>

        {course.keywords && course.keywords.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {course.keywords.map(k => (
              <span key={k} className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded-md text-xs">{k}</span>
            ))}
          </div>
        )}

        {course.description && (
          <p className="text-sm text-foreground/80 mt-4 leading-relaxed">{course.description}</p>
        )}

        {/* Video List */}
        {videos.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-foreground mb-3">Videos ({videos.length})</h3>
            <div className="space-y-2">
              {videos.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => setActiveVideo(v)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    activeVideo?.id === v.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'bg-card border border-border hover:border-primary/30'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Play className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">{v.title}</p>
                    <p className="text-xs text-muted-foreground">Video {i + 1}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
