import type { Metadata } from 'next';
import TestViewClient from './test-client';

export const metadata: Metadata = {
  title: 'Certification Assessment — EduNook',
  robots: { index: false, follow: false },
};

import { Suspense } from 'react';

export default function TestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <TestViewClient />
    </Suspense>
  );
}
