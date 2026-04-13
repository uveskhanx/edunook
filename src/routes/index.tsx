import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { CourseCard } from '@/components/CourseCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Search } from 'lucide-react';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'EduNook — Modern Education Platform' },
      { name: 'description', content: 'Learn and teach with EduNook. Browse courses, create content, and connect with educators.' },
      { property: 'og:title', content: 'EduNook — Modern Education Platform' },
      { property: 'og:description', content: 'Learn and teach with EduNook. Browse courses, create content, and connect with educators.' },
    ],
  }),
  component: HomePage,
});

type CourseWithCreator = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  category: string;
  profiles: { username: string; avatar_url: string | null; full_name: string } | null;
};

function HomePage() {
  const [courses, setCourses] = useState<CourseWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'free' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCourses();
  }, [tab]);

  async function loadCourses() {
    setLoading(true);
    let query = supabase
      .from('courses')
      .select('id, title, description, thumbnail_url, price, category, profiles!courses_user_id_fkey(username, avatar_url, full_name)')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (tab === 'free') query = query.eq('price', 0);
    if (tab === 'paid') query = query.gt('price', 0);

    const { data } = await query;
    setCourses((data as unknown as CourseWithCreator[]) || []);
    setLoading(false);
  }

  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs = [
    { key: 'all' as const, label: 'All' },
    { key: 'free' as const, label: 'Free' },
    { key: 'paid' as const, label: 'Paid' },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Discover Courses</h1>
          <p className="text-muted-foreground mt-1">Learn something new today</p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Course Grid */}
        {loading ? (
          <LoadingSpinner className="py-20" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">No courses found</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Be the first to create one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(course => (
              <CourseCard
                key={course.id}
                id={course.id}
                title={course.title}
                description={course.description}
                thumbnailUrl={course.thumbnail_url}
                price={course.price}
                category={course.category}
                creatorName={course.profiles?.full_name || course.profiles?.username || 'Unknown'}
                creatorAvatar={course.profiles?.avatar_url || null}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
