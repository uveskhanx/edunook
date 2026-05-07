import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notifications — EduNook',
  description: 'View your latest notifications and activity on EduNook.',
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
