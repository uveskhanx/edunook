import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Play, User, Sparkles, Eye, MoreVertical, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { formatRelativeTime } from '@/lib/time';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';
import { VerificationTick } from './VerificationTick';
import { calculateDiscountedPrice, getDiscountLabel, isPremium } from '@/lib/subscription-utils';

import { Course, Profile } from '@/lib/db-service';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

interface CourseCardProps {
  course: Course & {
    profiles?: Profile | null;
  };
  priority?: boolean;
  showManagement?: boolean;
}

export function CourseCard({ course, priority = false, showManagement = false }: CourseCardProps) {
  const { user: currentUser, dbUser } = useAuth();
  const router = useRouter();
  const isFree = course.price === 0;
  const isPremiumUser = isPremium(dbUser?.subscription?.planId);

  // Only the creator should see views
  const isOwner = currentUser?.id === course.userId;

  const handleCardClick = () => {
    router.push(`/course/${course.slug || course.id}`);
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
      <div className="block space-y-2 md:space-y-3">
        {/* Thumbnail Area - 16:9 */}
        <div className="relative aspect-video rounded-[1.5rem] overflow-hidden bg-card border border-border transition-all duration-500 group-hover:border-primary/50 group-hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.15)]">
          {course.thumbnailUrl ? (
            <Image 
              src={optimizeCloudinaryUrl(course.thumbnailUrl, 480)} 
              alt={course.title}
              width={480}
              height={270}
              priority={priority}
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
                   <span className="text-[9px] font-black text-white/40 line-through">Rs. {course.price.toLocaleString()}</span>
                   <span className="text-[8px] font-black text-primary uppercase tracking-tighter">{getDiscountLabel(dbUser?.subscription?.planId)} OFF</span>
                </div>
             )}
             <div className={`px-3 py-1.5 rounded-xl text-[11px] font-black shadow-2xl backdrop-blur-md border border-border flex items-center gap-2 ${
               isFree ? 'bg-success/20 text-success' : 'bg-primary/10 text-white border-primary/20 shadow-[0_0_20px_rgba(79,70,229,0.2)]'
             }`}>
               {isFree ? 'FREE' : (
                  <>
                    <span className={isPremiumUser ? "text-primary font-black" : "text-white"}>
                      Rs. {calculateDiscountedPrice(course.price, dbUser?.subscription?.planId).toLocaleString()}
                    </span>
                    {isPremiumUser && (
                       <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                    )}
                  </>
               )}
             </div>
          </div>

          {/* Owner Actions (Overlay) */}
          {showManagement && (
            <div className="absolute top-4 right-4 z-[40]" onClick={(e) => { e.stopPropagation(); }}>
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <button className="w-10 h-10 rounded-full bg-white text-black border border-white/20 flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:scale-110 active:scale-95 transition-all cursor-pointer">
                        <MoreVertical className="w-6 h-6" />
                     </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-black border-white/10 rounded-2xl p-2 min-w-[200px] shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-[100]">
                     <DropdownMenuItem 
                        onClick={() => router.push(`/course/${course.slug || course.id}?tab=management`)}
                        className="flex items-center gap-3 px-4 py-4 rounded-xl text-[12px] font-black uppercase tracking-widest text-white hover:bg-primary cursor-pointer transition-all"
                     >
                        <Settings className="w-5 h-5" /> Manage Course
                     </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </div>
          )}

          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
             <div className="w-12 h-12 rounded-full bg-primary/20 backdrop-blur-sm border border-primary/40 flex items-center justify-center scale-90 group-hover:scale-100 transition-transform">
                <Play className="w-5 h-5 text-primary fill-primary" />
             </div>
          </div>
        </div>

        {/* Info Area - YouTube style */}
        <div className="flex gap-3 md:gap-4 pt-0.5 md:pt-1">
          {/* Creator Avatar */}
          <div className="flex-shrink-0">
             <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-card border border-border overflow-hidden">
                {course.profiles?.avatarUrl ? (
                  <Image 
                    src={optimizeCloudinaryUrl(course.profiles.avatarUrl, 80)} 
                    alt="" 
                    width={32}
                    height={32}
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/30 via-transparent to-violet-600/30">
                    <User className="w-4 h-4 text-primary/40 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                  </div>
                )}
             </div>
          </div>

          <div className="flex-1 min-w-0 space-y-0.5 md:space-y-1">
            <h3 className="text-[15px] font-bold text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">
              {course.title}
            </h3>
            <div className="space-y-0.5">
              <Link 
                href={`/${course.profiles?.username || 'user'}`}
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
