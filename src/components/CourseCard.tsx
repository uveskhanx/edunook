import { Link, useNavigate } from '@tanstack/react-router';
import { Play, User, Clock, Sparkles, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { formatRelativeTime } from '@/lib/time';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';

interface CourseCardProps {
  course: {
    id: string;
    userId: string;
    slug?: string;
    title: string;
    description?: string | null;
    thumbnailUrl?: string | null;
    price: number;
    views?: number;
    createdAt: string;
    profiles?: {
      fullName: string;
      username: string;
      avatarUrl?: string | null;
    } | null;
    creatorName?: string;
    publisherName?: string;
  };
}

export function CourseCard({ course }: CourseCardProps) {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const isFree = course.price === 0;

  // Only the creator should see views
  const isOwner = currentUser?.id === course.userId;

  const handleCardClick = () => {
    navigate({ to: '/course/$slug', params: { slug: course.slug || course.id } });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -6, scale: 1.01 }}
      className="group cursor-pointer"
      onClick={handleCardClick}
    >
      <div className="block space-y-3">
        {/* Thumbnail Area - 16:9 */}
        <div className="relative aspect-video rounded-[1.5rem] overflow-hidden bg-[#121212] border border-white/5 transition-all duration-500 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]">
          {course.thumbnailUrl ? (
            <img 
              src={optimizeCloudinaryUrl(course.thumbnailUrl, 480)} 
              alt={course.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#121212] to-[#1a1a1a]">
              <Play className="w-10 h-10 text-white/10" />
            </div>
          )}

          {/* Price Tag Overlay */}
          <div className={`absolute bottom-3 right-3 px-3 py-1.5 rounded-xl text-[11px] font-black shadow-2xl backdrop-blur-md border border-white/10 ${
            isFree ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary'
          }`}>
            {isFree ? 'FREE' : `₹${course.price.toLocaleString()}`}
          </div>

          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
             <div className="w-12 h-12 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/40 flex items-center justify-center scale-90 group-hover:scale-100 transition-transform">
                <Play className="w-5 h-5 text-primary fill-primary" />
             </div>
          </div>
        </div>

        {/* Info Area - YouTube style */}
        <div className="flex gap-4 pt-1">
          {/* Creator Avatar */}
          <div className="flex-shrink-0">
             <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 overflow-hidden">
                {course.profiles?.avatarUrl ? (
                  <img src={optimizeCloudinaryUrl(course.profiles.avatarUrl, 80)} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-primary bg-primary/10">
                    {course.profiles?.fullName?.[0].toUpperCase() || 'E'}
                  </div>
                )}
             </div>
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="text-[15px] font-bold text-white line-clamp-2 leading-tight group-hover:text-primary transition-colors">
              {course.title}
            </h3>
            <div className="space-y-0.5">
              <Link 
                to="/$username" 
                params={{ username: course.profiles?.username || 'user' }} 
                className="text-[13px] font-medium text-muted-foreground hover:text-white transition-colors relative z-10"
                onClick={(e) => e.stopPropagation()}
              >
                {course.profiles?.fullName || course.profiles?.username || course.creatorName || course.publisherName || 'Creator'}
              </Link>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                {isOwner && (
                  <>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {course.views || 0} views
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                  </>
                )}
                <span>{formatRelativeTime(course.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
