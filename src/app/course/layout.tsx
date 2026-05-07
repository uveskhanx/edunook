import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Learning — EduNook',
  description: 'Master new skills on EduNook. Access video lessons, quizzes, and workspaces.',
};

export default function CourseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
