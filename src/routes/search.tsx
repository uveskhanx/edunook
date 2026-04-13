import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Search as SearchIcon, User } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export const Route = createFileRoute('/search')({
  head: () => ({
    meta: [{ title: 'Search — EduNook' }],
  }),
  component: SearchPage,
});

type ProfileResult = {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
};

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);

    const { data } = await supabase
      .from('profiles')
      .select('user_id, username, full_name, avatar_url, bio')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .limit(20);

    setResults(data || []);
    setLoading(false);
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-6">Search Users</h1>

        <form onSubmit={handleSearch} className="relative mb-6">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username or name..."
            className="w-full pl-10 pr-4 py-2.5 bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          />
        </form>

        {loading ? (
          <LoadingSpinner className="py-12" />
        ) : results.length > 0 ? (
          <div className="space-y-2">
            {results.map(profile => (
              <Link
                key={profile.user_id}
                to="/user/$userId"
                params={{ userId: profile.user_id }}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-all animate-fade-in"
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-card-foreground">{profile.full_name || profile.username}</p>
                  <p className="text-sm text-muted-foreground">@{profile.username}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : searched ? (
          <p className="text-center text-muted-foreground py-12">No users found</p>
        ) : null}
      </div>
    </Layout>
  );
}
