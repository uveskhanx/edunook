import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { CourseCard } from '@/components/CourseCard';
import { Camera, Edit2, LogOut, Loader2 } from 'lucide-react';

export const Route = createFileRoute('/profile')({
  head: () => ({
    meta: [{ title: 'Profile — EduNook' }],
  }),
  component: ProfilePage,
});

type Profile = {
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
};

type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  category: string;
};

function ProfilePage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: '/login' });
      return;
    }
    loadProfile();
  }, [user, authLoading, navigate]);

  async function loadProfile() {
    if (!user) return;
    const [profileRes, coursesRes] = await Promise.all([
      supabase.from('profiles').select('username, full_name, avatar_url, bio').eq('user_id', user.id).single(),
      supabase.from('courses').select('id, title, description, thumbnail_url, price, category').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    if (profileRes.data) {
      setProfile(profileRes.data);
      setEditName(profileRes.data.full_name);
      setEditBio(profileRes.data.bio || '');
    }
    setCourses(coursesRes.data || []);
    setLoading(false);
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    await supabase.from('profiles').update({ full_name: editName, bio: editBio }).eq('user_id', user.id);
    setProfile(p => p ? { ...p, full_name: editName, bio: editBio } : p);
    setEditing(false);
    setSaving(false);
  }

  async function uploadAvatar(file: File) {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('user_id', user.id);
    setProfile(p => p ? { ...p, avatar_url: data.publicUrl } : p);
    setUploading(false);
  }

  if (authLoading || loading) {
    return <Layout><LoadingSpinner className="py-20" /></Layout>;
  }

  if (!profile) return null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Profile Header */}
        <div className="flex items-start gap-4 mb-8">
          <div className="relative group">
            <div className="w-20 h-20 rounded-full bg-muted overflow-hidden flex-shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                  {profile.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <label className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
              {uploading ? <Loader2 className="w-5 h-5 animate-spin text-foreground" /> : <Camera className="w-5 h-5 text-foreground" />}
              <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
            </label>
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-2">
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-input border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={2}
                  className="w-full px-3 py-1.5 bg-input border border-border rounded-lg text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
                <div className="flex gap-2">
                  <button onClick={saveProfile} disabled={saving}
                    className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} className="px-3 py-1 bg-secondary text-secondary-foreground rounded-lg text-sm hover:opacity-80 transition-all">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold text-foreground">{profile.full_name || profile.username}</h2>
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
                {profile.bio && <p className="text-sm text-foreground/80 mt-1">{profile.bio}</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:opacity-80 transition-all">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={signOut} className="flex items-center gap-1 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg text-sm hover:opacity-80 transition-all md:hidden">
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Courses */}
        <h3 className="text-lg font-semibold text-foreground mb-4">My Courses ({courses.length})</h3>
        {courses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No courses yet</p>
            <Link to="/create" className="inline-block mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-all">
              Create your first course
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {courses.map(c => (
              <CourseCard
                key={c.id}
                id={c.id}
                title={c.title}
                description={c.description}
                thumbnailUrl={c.thumbnail_url}
                price={c.price}
                category={c.category}
                creatorName={profile.full_name || profile.username}
                creatorAvatar={profile.avatar_url}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
