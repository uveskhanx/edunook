import { Metadata } from 'next';
import ForgotPasswordClient from './forgot-password-client';

export const metadata: Metadata = {
  title: 'Recover Account — EduNook',
  description: 'Recover your EduNook account password securely.',
  alternates: {
    canonical: '/forgot-password',
  },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}
