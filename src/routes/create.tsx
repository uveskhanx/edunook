import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { Upload, Plus, X, Loader2 } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/create')({
  head: () => ({
    meta: [{ title: 'Create Course — EduNook' }],
  }),
  component: CreateCoursePage,
});

const categories = ['programming', 'design', 'business', 'music', 'photography', 'marketing', 'science', 'math', 'language', 'general'];

function CreateCoursePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('0');
  const [category, setCategory] = useState('general');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [videos, setVideos] = useState<{ file: File; title: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (authLoading) return <Layout><div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></Layout>;

  if (!user) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">Sign in to create a course</h2>
          <p className="text-muted-foreground mb-4">You need an account to create courses</p>
          <Link to="/login" className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-all">
            Sign In
          </Link>
        </div>
      </Layout>
    );
  }

  function addKeyword() {
    if (keywordInput.trim() && keywords.length < 3) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    setLoading(true);

    try {
      let thumbnailUrl: string | null = null;
      if (thumbnail) {
        const ext = thumbnail.name.split('.').pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('thumbnails').upload(path, thumbnail);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(path);
        thumbnailUrl = urlData.publicUrl;
      }

      const { data: course, error: courseErr } = await supabase
        .from('courses')
        .insert({
          user_id: user.id,
          title,
          description,
          price: parseFloat(price) || 0,
          category,
          keywords,
          thumbnail_url: thumbnailUrl,
          is_published: true,
        })
        .select('id')
        .single();

      if (courseErr) throw courseErr;

      // Upload videos
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        const ext = video.file.name.split('.').pop();
        const path = `${user.id}/${course.id}/${i}.${ext}`;
        const { error: vidErr } = await supabase.storage.from('videos').upload(path, video.file);
        if (vidErr) throw vidErr;
        const { data: vidUrl } = supabase.storage.from('videos').getPublicUrl(path);

        await supabase.from('videos').insert({
          course_id: course.id,
          title: video.title,
          video_url: vidUrl.publicUrl,
          position: i,
        });
      }

      navigate({ to: '/course/$courseId', params: { courseId: course.id } });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
    setLoading(false);
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Create Course</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
              className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              placeholder="Course title" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
              className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all resize-none"
              placeholder="What will students learn?" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Price ($)</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} min="0" step="0.01"
                className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-input border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all">
                {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Keywords (max 3)</label>
            <div className="flex gap-2 mb-2 flex-wrap">
              {keywords.map((k, i) => (
                <span key={i} className="px-2 py-1 bg-secondary text-secondary-foreground rounded-lg text-xs flex items-center gap-1">
                  {k}
                  <button type="button" onClick={() => setKeywords(keywords.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            {keywords.length < 3 && (
              <div className="flex gap-2">
                <input type="text" value={keywordInput} onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                  className="flex-1 px-3 py-2 bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all text-sm"
                  placeholder="Add keyword" />
                <button type="button" onClick={addKeyword} className="px-3 py-2 bg-secondary text-secondary-foreground rounded-xl text-sm hover:opacity-80 transition-all">Add</button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Thumbnail</label>
            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-all">
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{thumbnail ? thumbnail.name : 'Upload thumbnail'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => setThumbnail(e.target.files?.[0] || null)} />
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Videos</label>
            <div className="space-y-2 mb-2">
              {videos.map((v, i) => (
                <div key={i} className="flex items-center gap-2 p-2 bg-secondary rounded-xl">
                  <span className="text-xs text-secondary-foreground flex-1 truncate">{v.file.name}</span>
                  <input type="text" value={v.title} onChange={e => {
                    const newVids = [...videos];
                    newVids[i] = { ...v, title: e.target.value };
                    setVideos(newVids);
                  }} placeholder="Video title" className="px-2 py-1 bg-input border border-border rounded-lg text-xs text-foreground flex-1" />
                  <button type="button" onClick={() => setVideos(videos.filter((_, j) => j !== i))}><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
              ))}
            </div>
            <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-all">
              <Plus className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Add video</span>
              <input type="file" accept="video/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) setVideos([...videos, { file, title: file.name.replace(/\.[^.]+$/, '') }]);
              }} />
            </label>
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 disabled:opacity-50 transition-all">
            {loading ? 'Creating...' : 'Create Course'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
