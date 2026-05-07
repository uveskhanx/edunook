import type { Metadata } from 'next';
import { Suspense } from 'react';
import ResetPasswordClient from './reset-password-client';
import { Loader2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Reset Password — EduNook',
  description: 'Reset your EduNook account password securely.',
  alternates: {
    canonical: '/reset-password',
  },
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <ResetPasswordClient />
    </Suspense>
  );
}
