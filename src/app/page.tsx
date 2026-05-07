import { Metadata } from 'next';
import RootRedirect from './root-redirect';

export const metadata: Metadata = {
  title: 'EduNook | Modern Education Platform',
  description: 'Welcome to EduNook, your personalized learning hub. Access premium courses, connect with educators, and master new skills.',
};

export default function RootPage() {
  return <RootRedirect />;
}
