import { Metadata } from 'next';
import { Suspense } from 'react';
import AnalyticsClient from './analytics-client';

export const metadata: Metadata = {
  title: 'Creator Analytics | EduNook',
  description: 'Deep insights into your course performance and student engagement.',
};

export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsClient />
    </Suspense>
  );
}
