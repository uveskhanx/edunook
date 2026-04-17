import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { DbService } from '@/lib/db-service';
import { Layout } from '@/components/Layout';
import { Loader2 } from 'lucide-react';

export const Route = createFileRoute('/profile')({
  component: ProfileRedirect,
});

function ProfileRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function redirect() {
      if (!loading) {
        if (!user) {
          navigate({ to: '/login' });
          return;
        }

        // Fetch user profile to get the username
        const profile = await DbService.getProfile(user.id);
        if (profile?.username) {
          navigate({ to: '/$username', params: { username: profile.username } });
        } else {
          // Fallback if profile not found or username missing
          navigate({ to: '/home' });
        }
      }
    }
    redirect();
  }, [user, loading, navigate]);

  return (
    <Layout>
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    </Layout>
  );
}
