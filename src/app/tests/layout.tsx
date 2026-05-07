import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Global Assessment Hub — EduNook',
};

export default function TestsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
