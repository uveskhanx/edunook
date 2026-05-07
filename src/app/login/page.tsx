import { Metadata } from 'next';
import LoginPageClient from './login-client';

export const metadata: Metadata = {
  title: 'Log In — EduNook',
  description: 'Sign in to your EduNook account to continue your learning journey.',
  alternates: {
    canonical: '/login',
  },
};

export default function LoginPage() {
  return <LoginPageClient />;
}
