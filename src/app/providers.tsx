'use client';

import { ThemeProvider } from '@/contexts/ThemeContext';
import { IncomingMessageNotifier } from '@/components/IncomingMessageNotifier';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <IncomingMessageNotifier />
      <Toaster />
    </ThemeProvider>
  );
}
