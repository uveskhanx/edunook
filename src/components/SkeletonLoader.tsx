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
    <div className="space-y-2 md:space-y-3 opacity-70">
      <div className="relative aspect-video rounded-[1.5rem] bg-muted/10 border border-border overflow-hidden shimmer" />
      <div className="flex gap-3 md:gap-4 pt-0.5 md:pt-1">
        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-muted/20 shimmer shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="h-4 bg-muted/20 rounded-md w-full shimmer" />
          <div className="space-y-1.5">
            <div className="h-3 bg-muted/10 rounded-md w-2/3 shimmer" />
            <div className="h-2 bg-muted/5 rounded-md w-1/3 shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function CourseViewSkeleton() {
  return (
    <div className="flex flex-col xl:flex-row min-h-screen bg-[#050505]">
      {/* Left Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Player Skeleton */}
        <div className="aspect-video w-full bg-card/40 shimmer" />
        
        {/* Nav Bar Skeleton */}
        <div className="h-16 border-y border-white/5 bg-white/5 flex items-center justify-between px-12">
          <div className="flex gap-6">
            <div className="w-24 h-4 bg-white/5 rounded shimmer" />
            <div className="w-24 h-4 bg-white/5 rounded shimmer" />
          </div>
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-white/5 rounded-xl shimmer" />
            <div className="w-10 h-10 bg-white/5 rounded-xl shimmer" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="p-12 space-y-8">
          <div className="space-y-4">
            <div className="h-10 bg-white/10 w-2/3 rounded-xl shimmer" />
            <div className="flex gap-4">
              <div className="w-32 h-4 bg-white/5 rounded shimmer" />
              <div className="w-32 h-4 bg-white/5 rounded shimmer" />
            </div>
          </div>
          <div className="h-px bg-white/5 w-full" />
          <div className="grid grid-cols-4 gap-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <div className="w-16 h-2 bg-white/5 rounded shimmer" />
                <div className="w-24 h-4 bg-white/10 rounded shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sidebar Skeleton */}
      <div className="w-full xl:w-[400px] 2xl:w-[450px] border-l border-white/5 bg-card/20 p-6 space-y-6">
        <div className="h-8 bg-white/10 rounded-xl w-1/2 shimmer" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex gap-4">
              <div className="w-24 aspect-video bg-white/5 rounded-lg shimmer shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/10 rounded w-full shimmer" />
                <div className="h-2 bg-white/5 rounded w-2/3 shimmer" />
              </div>
            </div>
          ))}
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
