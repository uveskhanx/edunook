import { Metadata } from 'next';
import SignupPageClient from './signup-client';

export const metadata: Metadata = {
  title: 'Create Account — EduNook',
  description: 'Join EduNook today and start your learning journey. Create a free account to browse courses, track progress, and connect with educators.',
  alternates: {
    canonical: '/signup',
  },
};

export default function SignupPage() {
  return <SignupPageClient />;
}
