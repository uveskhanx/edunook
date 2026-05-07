'use client';

import dynamic from 'next/dynamic';

const DynamicCreateClient = dynamic(() => import('./create-client'), {
  loading: () => (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
    </div>
  ),
  ssr: false,
});

export default function CreateClientWrapper() {
  return <DynamicCreateClient />;
}
