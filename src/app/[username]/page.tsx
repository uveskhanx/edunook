import type { Metadata } from 'next';
import { Suspense } from 'react';
import ProfileClient from './profile-client';

import { optimizeCloudinaryUrl } from '@/lib/image-utils';

export async function generateMetadata(
  props: { params: Promise<{ username: string }> }
): Promise<Metadata> {
  const params = await props.params;
  const username = params.username;
  
  const siteUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://edunook.com';
  const dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  
  if (!dbUrl || !username) {
    return { title: 'Profile | EduNook' };
  }

  try {
    // 1. Resolve username to UID
    const usernameMapRes = await fetch(`${dbUrl}/usernames/${username}.json`, { next: { revalidate: 3600 } });
    const uid = await usernameMapRes.json();
    
    if (!uid) {
      return { title: 'User Not Found | EduNook' };
    }

    // 2. Fetch Profile Details
    const profileRes = await fetch(`${dbUrl}/profiles/${uid}.json`, { next: { revalidate: 3600 } });
    const profile = await profileRes.json();

    if (!profile) {
      return { title: 'Profile Not Found | EduNook' };
    }

    const title = `${profile.fullName || profile.username} (@${profile.username}) | EduNook`;
    const description = profile.bio?.substring(0, 160) || `Learn from ${profile.fullName || profile.username} on EduNook.`;
    const images = profile.avatarUrl 
      ? [{ url: optimizeCloudinaryUrl(profile.avatarUrl, 500), width: 500, height: 500 }] 
      : [];

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'profile',
        url: `${siteUrl}/${username}`,
        images,
      },
      twitter: {
        card: 'summary',
        title,
        description,
        images,
      }
    };
  } catch (error) {
    return { title: 'Profile | EduNook' };
  }
}


export default async function ProfilePage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <ProfileClient username={params.username} />
    </Suspense>
  );
}
