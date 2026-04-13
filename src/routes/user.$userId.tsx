import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { CourseCard } from '@/components/CourseCard';
import { User } from 'lucide-react';

export const Route = createFileRoute('/user/$userId')({
  component: UserProfilePage,
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

function UserProfilePage() {
  const { userId } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [profileRes, coursesRes] = await Promise.all([
        supabase.from('profiles').select('username, full_name, avatar_url, bio').eq('user_id', userId).single(),
        supabase.from('courses').select('id, title, description, thumbnail_url, price, category').eq('user_id', userId).eq('is_published', true).order('created_at', { ascending: false }),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      setCourses(coursesRes.data || []);
      setLoading(false);
    }
    load();
  }, [userId]);

  if (loading) return <Layout><LoadingSpinner className="py-20" /></Layout>;
  if (!profile) return <Layout><div className="text-center py-20 text-muted-foreground">User not found</div></Layout>;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-start gap-4 mb-8">
          <div className="w-20 h-20 rounded-full bg-muted overflow-hidden flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{profile.full_name || profile.username}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio && <p className="text-sm text-foreground/80 mt-2">{profile.bio}</p>}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-4">Courses ({courses.length})</h3>
        {courses.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No courses yet</p>
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
