'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { DbService } from '@/lib/db-service';
import { Layout } from '@/components/Layout';
import { Loader2 } from 'lucide-react';

export default function ProfileRedirectClient() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      if (!loading) {
        if (!user) {
          router.push('/login');
          return;
        }

        // Fetch user profile to get the username
        const profile = await DbService.getProfile(user.id);
        if (profile?.username) {
          router.push(`/${profile.username}`);
        } else {
          // Fallback if profile not found or username missing
          router.push('/home');
        }
      }
    }
    redirect();
  }, [user, loading, router]);

  return (
    <Layout>
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    </Layout>
  );
}
