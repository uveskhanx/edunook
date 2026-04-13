import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Plus, Play, Trash2 } from 'lucide-react';

export const Route = createFileRoute('/tests')({
  head: () => ({
    meta: [{ title: 'Tests — EduNook' }],
  }),
  component: TestsPage,
});

type TestRow = {
  id: string;
  title: string;
  description: string | null;
  creator_id: string;
  created_at: string;
  profiles: { username: string; full_name: string } | null;
};

function TestsPage() {
  const { user } = useAuth();
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadTests(); }, []);

  async function loadTests() {
    const { data } = await supabase
      .from('tests')
      .select('id, title, description, creator_id, created_at, profiles!tests_creator_id_fkey(username, full_name)')
      .order('created_at', { ascending: false });
    setTests((data as unknown as TestRow[]) || []);
    setLoading(false);
  }

  async function createTest(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setCreating(true);
    const { data } = await supabase.from('tests').insert({ creator_id: user.id, title, description }).select('id').single();
    if (data) {
      setShowCreate(false);
      setTitle('');
      setDescription('');
      loadTests();
    }
    setCreating(false);
  }

  async function deleteTest(id: string) {
    await supabase.from('tests').delete().eq('id', id);
    setTests(tests.filter(t => t.id !== id));
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Tests & MCQs</h1>
          {user && (
            <button onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-all">
              <Plus className="w-4 h-4" /> Create Test
            </button>
          )}
        </div>

        {showCreate && (
          <form onSubmit={createTest} className="p-4 bg-card border border-border rounded-xl mb-6 space-y-3 animate-slide-up">
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Test title"
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm" />
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={2}
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-none" />
            <button type="submit" disabled={creating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all">
              {creating ? 'Creating...' : 'Create'}
            </button>
          </form>
        )}

        {loading ? (
          <LoadingSpinner className="py-12" />
        ) : tests.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No tests yet. Be the first to create one!</p>
        ) : (
          <div className="space-y-3">
            {tests.map(test => (
              <div key={test.id} className="p-4 bg-card border border-border rounded-xl flex items-center justify-between animate-fade-in">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-card-foreground">{test.title}</h3>
                  {test.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{test.description}</p>}
                  <p className="text-xs text-muted-foreground/70 mt-1">by {test.profiles?.full_name || test.profiles?.username || 'Unknown'}</p>
                </div>
                <div className="flex gap-2 ml-3">
                  <Link to="/test/$testId" params={{ testId: test.id }}
                    className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all">
                    <Play className="w-4 h-4" />
                  </Link>
                  {user?.id === test.creator_id && (
                    <button onClick={() => deleteTest(test.id)}
                      className="p-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-all">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
