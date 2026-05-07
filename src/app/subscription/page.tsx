import type { Metadata } from 'next';
import SubscriptionClient from './subscription-client';

export const metadata: Metadata = {
  title: 'Subscription — EduNook',
  description: 'Choose your EduNook learning plan.',
};

export default function SubscriptionPage() {
  return <SubscriptionClient />;
}
