import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search — EduNook',
  description: 'Search for courses and creators on EduNook.',
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
