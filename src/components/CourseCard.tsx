import { Link, useNavigate } from '@tanstack/react-router';
import { Play, User, Clock, Sparkles, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { formatRelativeTime } from '@/lib/time';
import { SealCheck } from '@phosphor-icons/react';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';
import { VerificationTick } from './VerificationTick';
import { calculateDiscountedPrice, getDiscountLabel, isPremium } from '@/lib/subscription-utils';

import { DbService, Course, Profile } from '@/lib/db-service';

interface CourseCardProps {
  course: Course & {
    profiles?: Profile | null;
  };
}

export function CourseCard({ course }: CourseCardProps) {
  const { user: currentUser, dbUser } = useAuth();
  const navigate = useNavigate();
  const isFree = course.price === 0;
  const isPremiumUser = isPremium(dbUser?.subscription?.planId);

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
        <div className="relative aspect-video rounded-[1.5rem] overflow-hidden bg-card border border-border transition-all duration-500 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)]">
          {course.thumbnailUrl ? (
            <img 
              src={optimizeCloudinaryUrl(course.thumbnailUrl, 480)} 
              alt={course.title}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-card to-muted/20">
              <Play className="w-10 h-10 text-primary/20" />
            </div>
          )}

          {/* Price Tag Overlay */}
          <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1">
             {isPremiumUser && !isFree && (
                <div className="px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-1.5 shadow-2xl">
                   <span className="text-[9px] font-black text-white/40 line-through">₹{course.price.toLocaleString()}</span>
                   <span className="text-[8px] font-black text-primary uppercase tracking-tighter">{getDiscountLabel(dbUser?.subscription?.planId)} OFF</span>
                </div>
             )}
             <div className={`px-3 py-1.5 rounded-xl text-[11px] font-black shadow-2xl backdrop-blur-md border border-border flex items-center gap-2 ${
               isFree ? 'bg-success/20 text-success' : 'bg-primary/10 text-white border-primary/20 shadow-[0_0_20px_rgba(79,70,229,0.2)]'
             }`}>
               {isFree ? 'FREE' : (
                  <>
                    <span className={isPremiumUser ? "text-primary font-black" : "text-white"}>
                      ₹{calculateDiscountedPrice(course.price, dbUser?.subscription?.planId).toLocaleString()}
                    </span>
                    {isPremiumUser && (
                       <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                    )}
                  </>
               )}
             </div>
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
             <div className="w-8 h-8 rounded-full bg-card border border-border overflow-hidden">
                {course.profiles?.avatarUrl ? (
                  <img src={optimizeCloudinaryUrl(course.profiles.avatarUrl, 80)} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div 
                    className={`w-full h-full flex items-center justify-center text-[10px] font-black text-white uppercase bg-gradient-to-br ${
                      ['from-blue-600 to-indigo-600', 'from-purple-600 to-pink-600', 'from-emerald-600 to-teal-600', 'from-amber-500 to-orange-600', 'from-rose-600 to-red-700'][
                        (course.profiles?.fullName || course.publisherName || 'E').length % 5
                      ]
                    }`}
                  >
                    <User className="w-4 h-4 text-white/40" />
                  </div>
                )}
             </div>
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="text-[15px] font-bold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
              {course.title}
            </h3>
            <div className="space-y-0.5">
              <Link 
                to="/$username" 
                params={{ username: course.profiles?.username || 'user' }} 
                className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors relative z-10"
                onClick={(e) => e.stopPropagation()}
              >
                {course.profiles?.fullName || course.publisherName || course.profiles?.username || course.creatorName || ''}
                <VerificationTick planId={course.profiles?.subscription?.planId} size={14} className="mb-0.5" />
              </Link>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                {isOwner && (
                  <>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {course.views || 0} views
                    </span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
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
