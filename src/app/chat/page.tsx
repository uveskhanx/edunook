import { Layout } from '@/components/Layout';
import { MessageCircle, Sparkles } from 'lucide-react';
import { Suspense } from 'react';

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse" />
            <div className="w-24 h-24 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center backdrop-blur-2xl relative z-10">
              <MessageCircle className="w-10 h-10 text-primary" />
            </div>
          </div>
          <div className="space-y-4 max-w-md">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">Coming Soon</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">EduNook Chat</h1>
            <p className="text-white/40 font-bold uppercase tracking-widest text-[11px] md:text-xs leading-relaxed">
              Connect with creators and fellow students in real-time. We are putting the finishing touches on our secure messaging engine.
            </p>
          </div>
        </div>
      </Layout>
    </Suspense>
  );
}
