import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Course — EduNook',
  description: 'Create and publish an EduNook course with chapters, videos, quizzes, and Razorpay-ready pricing.',
  alternates: { canonical: '/create' },
  robots: { index: false, follow: false },
};

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
