import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from 'react';
import { DbService, Profile, Notification } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { 
  Bell, User as UserIcon, Loader2, UserPlus, MessageSquare, Check, 
  Trash2, Filter, MoreHorizontal, ArrowLeft, Clock, ShieldCheck, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { formatDistanceToNow, isToday, isYesterday, subDays } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export const Route = createFileRoute('/notifications')({
  head: () => ({
    meta: [{ title: 'Communications Intelligence — EduNook' }],
  }),
  component: NotificationsPage,
});

type NotificationFilter = 'all' | 'follows' | 'messages' | 'system';

function NotificationSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-3xl bg-white/[0.02] border border-white/[0.05] animate-pulse">
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-white/5 rounded-full w-1/3" />
        <div className="h-2 bg-white/5 rounded-full w-1/2" />
      </div>
      <div className="w-8 h-8 rounded-xl bg-white/5" />
    </div>
  );
}

function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [isFollowingMap, setIsFollowingMap] = useState<Record<string, boolean>>({});

  // Security
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: '/login' });
  }, [user, authLoading, navigate]);

  // Real-time Subscriptions
  useEffect(() => {
    if (user) {
      const unsubscribe = DbService.subscribeToNotifications(user.id, async (notifs) => {
        setNotifications(notifs);
        
        // Batch fetch profiles to optimize performance
        const uniqueUids = [...new Set(notifs.map(n => n.fromUid))];
        const profileMap: Record<string, Profile> = { ...profiles };
        const followMap: Record<string, boolean> = { ...isFollowingMap };

        await Promise.all(uniqueUids.map(async (uid) => {
          if (!profileMap[uid]) {
            const p = await DbService.getProfile(uid);
            if (p) profileMap[uid] = p;
          }
          if (followMap[uid] === undefined) {
             followMap[uid] = await DbService.isFollowing(user.id, uid);
          }
        }));
        
        setProfiles(profileMap);
        setIsFollowingMap(followMap);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'follows') return n.type === 'follow';
      if (activeFilter === 'messages') return n.type === 'message' || n.type === 'chat';
      if (activeFilter === 'system') return !['follow', 'message', 'chat'].includes(n.type);
      return true;
    });
  }, [notifications, activeFilter]);

  const groupedNotifications = useMemo(() => {
    const groups: Record<string, Notification[]> = {
      'Today': [],
      'Yesterday': [],
      'Earlier': []
    };

    filteredNotifications.forEach(n => {
      const date = new Date(n.createdAt);
      if (isToday(date)) groups['Today'].push(n);
      else if (isYesterday(date)) groups['Yesterday'].push(n);
      else groups['Earlier'].push(n);
    });

    return groups;
  }, [filteredNotifications]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      await DbService.markNotificationsAsSeen(user.id);
      toast.success("Intelligence feed cleared.");
    } catch (err) {
      toast.error("Failed to update status.");
    }
  };

  const handleDeleteNotif = async (id: string) => {
    if (!user) return;
    try {
      await DbService.deleteNotification(user.id, id);
      toast.success("Log entry removed.");
    } catch (err) {
      toast.error("Operation failed.");
    }
  };

  const handleFollowBack = async (uid: string) => {
    if (!user) return;
    try {
      await DbService.followUser(user.id, uid);
      setIsFollowingMap(prev => ({ ...prev, [uid]: true }));
      toast.success("Counter-follow successful.");
    } catch (err) {
      toast.error("Connection failed.");
    }
  };

  if (authLoading) return null;

  return (
    <Layout>
      <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
         {/* Background Decor */}
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] -z-10 rounded-full" />
         <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] -z-10 rounded-full" />

         <div className="max-w-[800px] mx-auto px-4 md:px-12 py-10 md:py-16">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
               <div>
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                        <Bell className="w-5 h-5" />
                     </div>
                     <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">Pulse Interface</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tight flex items-center gap-4">
                     Notifications
                     {notifications.some(n => !n.seen) && (
                        <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/20 animate-pulse">
                           {notifications.filter(n => !n.seen).length} NEW
                        </span>
                     )}
                  </h1>
               </div>

               <div className="flex items-center gap-2">
                  {notifications.some(n => !n.seen) && (
                     <button
                        onClick={handleMarkAllRead}
                        className="px-5 py-2.5 bg-foreground/5 hover:bg-foreground/10 text-foreground/60 hover:text-foreground text-[10px] font-black uppercase tracking-widest rounded-2xl border border-border transition-all flex items-center gap-2"
                     >
                        <Check className="w-3.5 h-3.5" /> Mark Intelligence Clear
                     </button>
                  )}
               </div>
            </div>

            {/* Filters Navigation */}
            <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-2 chat-scrollbar">
               {(['all', 'follows', 'messages', 'system'] as const).map(filter => (
                  <button
                     key={filter}
                     onClick={() => setActiveFilter(filter)}
                     className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${
                        activeFilter === filter 
                           ? 'bg-primary text-white shadow-[0_10px_25px_rgba(59,130,246,0.3)]' 
                           : 'bg-foreground/5 text-foreground/40 hover:bg-foreground/10 hover:text-foreground'
                     }`}
                  >
                     {filter}
                  </button>
               ))}
            </div>

            {/* Content List */}
            <div className="space-y-12">
               {loading ? (
                  <div className="space-y-3">
                     {[1, 2, 3, 4, 5].map(i => <NotificationSkeleton key={i} />)}
                  </div>
               ) : notifications.length > 0 ? (
                  Object.entries(groupedNotifications).map(([group, notifs]) => notifs.length > 0 && (
                     <div key={group} className="space-y-4">
                        <div className="flex items-center gap-4 mb-6">
                           <span className="text-[10px] font-black uppercase tracking-[0.5em] text-foreground/20 whitespace-nowrap">{group} Log</span>
                           <div className="h-px w-full bg-border/40" />
                        </div>

                        <div className="grid gap-3">
                           <AnimatePresence mode="popLayout">
                              {notifs.map((notif, idx) => {
                                 const fromProfile = profiles[notif.fromUid];
                                 const isFollow = notif.type === 'follow';
                                 const isChat = notif.type === 'chat' || notif.type === 'message';

                                 return (
                                    <motion.div
                                       key={notif.id}
                                       initial={{ opacity: 0, x: -20 }}
                                       animate={{ opacity: 1, x: 0 }}
                                       exit={{ opacity: 0, scale: 0.95 }}
                                       transition={{ delay: idx * 0.05 }}
                                       className={`group flex items-center gap-5 p-5 rounded-[2rem] transition-all border relative overflow-hidden ${
                                          notif.seen 
                                             ? 'bg-foreground/[0.02] border-border/40 hover:border-border hover:bg-foreground/[0.03]' 
                                             : 'bg-primary/[0.04] border-primary/20 shadow-[0_10px_30px_rgba(59,130,246,0.05)]'
                                       }`}
                                    >
                                       {/* Signal Indicator */}
                                       {!notif.seen && (
                                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_15px_var(--primary)]" />
                                       )}

                                       {/* Avatar */}
                                       <Link
                                          to="/$username"
                                          params={{ username: fromProfile?.username || 'user' }}
                                          className="relative flex-shrink-0"
                                       >
                                          <div className="w-14 h-14 rounded-2xl bg-white/5 overflow-hidden border border-white/10 group-hover:scale-105 transition-all duration-500 shadow-xl">
                                             {fromProfile?.avatarUrl ? (
                                                <img src={fromProfile.avatarUrl} className="w-full h-full object-cover" alt="" />
                                             ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-xl font-black italic uppercase">
                                                   {fromProfile?.fullName?.split(' ').map(n => n[0]).join('').substring(0, 2) || '?'}
                                                </div>
                                             )}
                                          </div>
                                          <div className={`absolute -bottom-1 -right-1 p-1.5 rounded-lg border-2 border-background shadow-lg ${
                                             isFollow ? 'bg-primary text-white' : isChat ? 'bg-indigo-500 text-white' : 'bg-accent text-white'
                                          }`}>
                                             {isFollow ? <UserPlus className="w-3 h-3" /> : isChat ? <MessageSquare className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                                          </div>
                                       </Link>

                                       {/* Body */}
                                       <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                             <Link
                                                to="/$username"
                                                params={{ username: fromProfile?.username || 'user' }}
                                                className="text-sm font-black text-foreground hover:text-primary transition-colors truncate"
                                             >
                                                {fromProfile?.fullName || 'Anonymous Signal'}
                                             </Link>
                                             {fromProfile?.subscription?.planId === 'edge' && <ShieldCheck className="w-3 h-3 text-primary" />}
                                          </div>
                                          <p className="text-xs text-foreground/60 font-medium leading-relaxed mb-2">
                                             {notif.text}
                                          </p>
                                          <div className="flex items-center gap-3">
                                             <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-foreground/30">
                                                <Clock className="w-3 h-3" />
                                                {formatDistanceToNow(new Date(notif.createdAt))} ago
                                             </span>
                                          </div>
                                       </div>

                                       {/* Actions */}
                                       <div className="flex items-center gap-2">
                                          {isFollow && !isFollowingMap[notif.fromUid] && (
                                             <button
                                                onClick={() => handleFollowBack(notif.fromUid)}
                                                className="hidden sm:flex px-4 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-primary/20"
                                             >
                                                Follow Back
                                             </button>
                                          )}
                                          
                                          <DropdownMenu>
                                             <DropdownMenuTrigger asChild>
                                                <button className="p-3 text-foreground/20 hover:text-foreground hover:bg-foreground/5 rounded-xl transition-all">
                                                   <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                             </DropdownMenuTrigger>
                                             <DropdownMenuContent align="end" className="w-48 bg-popover/90 backdrop-blur-3xl border-border p-1 rounded-2xl shadow-2xl">
                                                {!notif.seen && (
                                                   <DropdownMenuItem 
                                                      onClick={() => DbService.markNotificationAsRead(user!.id, notif.id)}
                                                      className="cursor-pointer font-bold text-[10px] uppercase tracking-widest py-3 px-4 rounded-xl focus:bg-primary/10 focus:text-primary"
                                                   >
                                                      <Check className="w-3.5 h-3.5 mr-2" /> Mark Read
                                                   </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem 
                                                   onClick={() => handleDeleteNotif(notif.id)}
                                                   className="cursor-pointer font-bold text-[10px] uppercase tracking-widest py-3 px-4 rounded-xl focus:bg-rose-500/10 focus:text-rose-500 text-rose-500"
                                                >
                                                   <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Log
                                                </DropdownMenuItem>
                                             </DropdownMenuContent>
                                          </DropdownMenu>
                                       </div>
                                    </motion.div>
                                 );
                              })}
                           </AnimatePresence>
                        </div>
                     </div>
                  ))
               ) : (
                  <motion.div 
                     initial={{ opacity: 0, scale: 0.95 }}
                     animate={{ opacity: 1, scale: 1 }}
                     className="py-32 flex flex-col items-center justify-center text-center space-y-6"
                  >
                     <div className="w-24 h-24 rounded-[2.5rem] bg-foreground/5 border border-border flex items-center justify-center text-foreground/20 relative">
                        <Bell className="w-10 h-10" />
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-background border border-border rounded-full flex items-center justify-center animate-bounce">
                           ✨
                        </div>
                     </div>
                     <div>
                        <p className="text-sm font-black uppercase tracking-[0.3em] text-foreground mb-2">Intelligence Feed Empty</p>
                        <p className="text-xs text-foreground/40 font-bold max-w-[280px] mx-auto leading-relaxed">
                           Your communication pulse is stable. New signals will appear here as they arrive.
                        </p>
                     </div>
                     <Link
                        to="/home"
                        className="px-8 py-4 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-[2rem] shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                     >
                        Explore Edunook
                     </Link>
                  </motion.div>
               )}
            </div>
         </div>
      </div>
    </Layout>
  );
}
