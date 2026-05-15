'use client';

import { Suspense } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { IncomingMessageNotifier } from '@/components/IncomingMessageNotifier';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <Suspense fallback={null}>
        <IncomingMessageNotifier />
      </Suspense>
      <Toaster />
    </ThemeProvider>
  );
}
