import { Suspense } from 'react';
import CreateClientWrapper from './create-client-wrapper';

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateClientWrapper />
    </Suspense>
  );
}
