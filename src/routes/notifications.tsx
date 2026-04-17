import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { DbService, Profile, Notification } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { Bell, User as UserIcon, Loader2, UserPlus, MessageSquare, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Route = createFileRoute('/notifications')({
  head: () => ({
    meta: [{ title: 'Notifications — EduNook' }],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);

  // Security: only authenticated users
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: '/login' });
  }, [user, authLoading, navigate]);

  // Subscribe to notifications in real-time
  useEffect(() => {
    if (user) {
      const unsubscribe = DbService.subscribeToNotifications(user.id, async (notifs) => {
        setNotifications(notifs);
        setLoading(false);

        // Fetch profiles for all unique fromUid values
        const uniqueUids = [...new Set(notifs.map(n => n.fromUid))];
        const profileMap: Record<string, Profile> = {};
        await Promise.all(uniqueUids.map(async (fromUid) => {
          const p = await DbService.getProfile(fromUid);
          if (p) profileMap[fromUid] = p;
        }));
        setProfiles(profileMap);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // Mark all as seen when page opens
  useEffect(() => {
    if (user && !loading) {
      DbService.markNotificationsAsSeen(user.id);
    }
  }, [user, loading]);

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-[700px] mx-auto px-4 md:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-black text-white">Notifications</h1>
          {user && notifications.some(n => !n.seen) && (
            <button
              onClick={() => DbService.markNotificationsAsSeen(user.id)}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> Mark all read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {notifications.length > 0 ? (
              notifications.map((notif, idx) => {
                const fromProfile = profiles[notif.fromUid];
                const isFollow = notif.type === 'follow';

                return (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className={`flex items-center gap-4 p-4 rounded-2xl transition-all border ${
                      notif.seen 
                        ? 'border-transparent hover:bg-white/[0.02]' 
                        : 'bg-primary/[0.03] border-primary/10'
                    }`}
                  >
                    {/* Avatar */}
                    <Link
                      to="/$username"
                      params={{ username: fromProfile?.username || 'user' }}
                      className="flex-shrink-0"
                    >
                      <div className="w-12 h-12 rounded-full bg-white/5 overflow-hidden border border-white/10 hover:scale-105 transition-transform">
                        {fromProfile?.avatarUrl ? (
                          <img src={fromProfile.avatarUrl} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-primary bg-primary/10">
                            <UserIcon className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    </Link>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">
                        <Link
                          to="/$username"
                          params={{ username: fromProfile?.username || 'user' }}
                          className="font-black hover:underline"
                        >
                          {fromProfile?.fullName || 'Someone'}
                        </Link>
                        {' '}
                        <span className="text-muted-foreground font-medium">{notif.text}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground/50 font-bold mt-1">
                        {getTimeAgo(notif.createdAt)}
                      </p>
                    </div>

                    {/* Icon */}
                    <div className={`p-2 rounded-xl flex-shrink-0 ${
                      isFollow ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'
                    }`}>
                      {isFollow ? <UserPlus className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </div>

                    {/* Unseen dot */}
                    {!notif.seen && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 shadow-[0_0_8px_var(--primary)]" />
                    )}
                  </motion.div>
                );
              })
            ) : (
              <div className="py-24 text-center space-y-4 opacity-30">
                <Bell className="w-12 h-12 mx-auto text-muted-foreground" />
                <p className="text-xs font-black uppercase tracking-widest">No notifications yet</p>
                <p className="text-[10px] text-muted-foreground">Follow users and send messages to get started</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
