import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
}

export function SkeletonLoader({ className = '', variant = 'rectangular' }: SkeletonProps) {
  const baseClasses = "shimmer bg-muted/20 opacity-50";
  const variantClasses = {
    rectangular: "rounded-xl",
    circular: "rounded-full",
    text: "rounded h-4 w-full"
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`} />
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="premium-glass rounded-[2rem] overflow-hidden border border-white/5 space-y-4 p-4">
      <SkeletonLoader className="aspect-video w-full rounded-2xl" />
      <div className="space-y-3 px-2">
        <SkeletonLoader variant="text" className="w-3/4 h-6" />
        <div className="flex justify-between items-center">
          <SkeletonLoader variant="text" className="w-1/3" />
          <SkeletonLoader variant="text" className="w-1/4 h-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-6">
        <SkeletonLoader variant="circular" className="w-24 h-24" />
        <div className="space-y-2 flex-1">
          <SkeletonLoader variant="text" className="w-48 h-8" />
          <SkeletonLoader variant="text" className="w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => <CourseCardSkeleton key={i} />)}
      </div>
    </div>
  );
}
