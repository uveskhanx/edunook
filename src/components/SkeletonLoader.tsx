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
    <div className="block space-y-3 md:space-y-4">
      {/* Thumbnail Skeleton */}
      <SkeletonLoader className="aspect-video w-full rounded-[1.5rem] border border-white/5" />
      
      {/* Info Area Skeleton */}
      <div className="flex gap-3 md:gap-4 pt-1 px-1">
        {/* Avatar Circle */}
        <SkeletonLoader variant="circular" className="w-8 h-8 md:w-10 md:h-10 shrink-0" />
        
        {/* Text Lines */}
        <div className="flex-1 space-y-2.5">
          <SkeletonLoader variant="text" className="w-full h-4 rounded-md" />
          <div className="space-y-1.5">
            <SkeletonLoader variant="text" className="w-2/3 h-2.5 rounded-md opacity-40" />
            <SkeletonLoader variant="text" className="w-1/3 h-2 rounded-md opacity-20" />
          </div>
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
