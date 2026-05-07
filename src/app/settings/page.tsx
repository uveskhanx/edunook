import type { Metadata } from 'next';
import { Suspense } from 'react';
import SettingsClient from './settings-client';

export const metadata: Metadata = {
  title: 'Account Settings — EduNook',
  description: 'Manage your profile, privacy, alerts, display, and learning preferences.',
};

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    }>
      <SettingsClient />
    </Suspense>
  );
}
