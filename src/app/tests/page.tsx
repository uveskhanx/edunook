import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import TestsClientWrapper from './tests-client-wrapper';

export default function TestsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <TestsClientWrapper />
    </Suspense>
  );
}
