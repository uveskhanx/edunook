import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Chat | EduNook',
  description: 'Chat with educators and learners on EduNook.',
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
