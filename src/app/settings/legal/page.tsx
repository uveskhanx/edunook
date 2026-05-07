import { Metadata } from 'next';
import LegalClient from './legal-client';

export const metadata: Metadata = {
  title: 'Legal | EduNook Settings',
  description: 'Review the Terms of Service and Privacy Policy for the EduNook platform.',
};

import { Suspense } from 'react';

export default function LegalPage() {
  return (
    <Suspense fallback={null}>
      <LegalClient />
    </Suspense>
  );
}
