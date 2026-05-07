import type { Metadata } from 'next';
import { Suspense } from 'react';
import ExploreClient from './explore-client';

export const metadata: Metadata = {
  title: 'Explore Courses — EduNook',
  description: 'Discover and browse all courses on EduNook.',
};

export default function ExplorePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <ExploreClient />
    </Suspense>
  );
}
