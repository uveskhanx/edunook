import { Layout } from '@/components/Layout';
import { PlusCircle, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-8">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse" />
            <div className="w-24 h-24 rounded-3xl bg-white/[0.03] border border-white/10 flex items-center justify-center backdrop-blur-2xl relative z-10">
              <PlusCircle className="w-10 h-10 text-primary" />
            </div>
          </div>
          <div className="space-y-4 max-w-md">
            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none">Become a Creator</h1>
            <p className="text-white/40 font-bold uppercase tracking-widest text-[11px] md:text-xs leading-relaxed">
              Ready to share your knowledge with the world? Course creation is managed directly from your professional profile.
            </p>
            <div className="pt-6">
              <Link 
                href="/home" 
                className="inline-flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
              >
                Go to Profile <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </Layout>
    </Suspense>
  );
}
