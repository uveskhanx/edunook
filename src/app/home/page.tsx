import type { Metadata } from 'next';
import { Suspense } from 'react';
import HomeClient from './home-client';

export const metadata: Metadata = {
  title: 'Home | EduNook',
  description: 'Your personalized learning dashboard on EduNook.',
};

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        </div>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
