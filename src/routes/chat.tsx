/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate, Link, useSearch } from '@tanstack/react-router';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { DbService, Profile, Message } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { 
  User as UserIcon, Loader2, MessageSquare, ArrowLeft, 
  MoreVertical, Info, ShieldCheck, Search, X, Trash2, Settings, MoreHorizontal
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { VerificationTick } from '@/components/VerificationTick';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { toast } from 'sonner';

export const Route = createFileRoute('/chat')({
  head: () => ({
    meta: [{ title: 'Communications Hub — EduNook' }],
  }),
  component: ChatPage,
});

function ChatPage() {
  const searchParams = useSearch({ strict: false }) as { c?: string; chatWith?: string };
  const { user, dbUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<{ profile: Profile; chatId: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<Profile[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [recipientPresence, setRecipientPresence] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Security Verification
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/login' });
    }
  }, [user, authLoading, navigate]);

  // Presence Heartbeat & Conversations Subscription
  useEffect(() => {
    if (user) {
      DbService.updatePresence(user.id);
      heartbeatRef.current = setInterval(() => DbService.updatePresence(user.id), 60000);

      const unsubscribe = DbService.subscribeToUserConversations(user.id, (convs) => {
        setConversations(convs);
        setLoading(false);
      });

      return () => {
        unsubscribe();
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      };
    }
  }, [user]);

  // Handle Mark as Read
  useEffect(() => {
     if (activeChat && user) {
        DbService.markAsRead(activeChat.chatId, user.id);
     }
  }, [activeChat, user, messages.length]);

  // Global Search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setGlobalResults([]);
      setIsSearchingGlobal(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingGlobal(true);
      try {
        const results = await DbService.searchProfiles(searchQuery);
        const currentUids = new Set(conversations.map(c => c.uid));
        setGlobalResults(results.filter(r => !currentUids.has(r.uid) && r.uid !== user?.id));
      } catch (err) {
        console.error("Global search failed", err);
      } finally {
        setIsSearchingGlobal(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, conversations, user?.id]);

  // Sync Active Chat from URL
  useEffect(() => {
    async function initDirectChat() {
      const targetUid = searchParams.c || searchParams.chatWith;
      if (targetUid && user && !loading) {
        try {
          const chatId = await DbService.getOrCreateChat(user.id, targetUid);
          const profile = await DbService.getProfile(targetUid);
          
          if (profile && (!activeChat || activeChat.profile.uid !== profile.uid)) {
            setActiveChat({ profile, chatId });
          }
        } catch (err) {
          console.error("Could not init direct chat", err);
          toast.error("Security Channel initialization failed.");
        }
        
        if (searchParams.chatWith) {
           navigate({ to: '/chat', search: { c: targetUid }, replace: true });
        }
      } else if (!targetUid && activeChat) {
         setActiveChat(null);
      }
    }
    initDirectChat();
  }, [searchParams.c, searchParams.chatWith, user, loading]);

  // Active Chat Real-time Subscriptions
  useEffect(() => {
    if (activeChat && user) {
      let unsubs: (() => void)[] = [];

      const setupSubs = async () => {
        const chatSnapshot = await DbService.getChatMetadata(activeChat.chatId);
        if (chatSnapshot?.users && !chatSnapshot.users[user.id]) {
           navigate({ to: '/home' });
           return;
        }

        unsubs.push(DbService.subscribeToMessages(activeChat.chatId, user.id, setMessages));
        unsubs.push(DbService.subscribeToTyping(activeChat.chatId, setTypingUsers));
        unsubs.push(DbService.subscribeToPresence(activeChat.profile.uid, setRecipientPresence));
      };

      setupSubs();
      return () => unsubs.forEach(u => u());
    }
  }, [activeChat, user, navigate]);

  const handleTyping = useCallback(() => {
     if (!user || !activeChat) return;
     DbService.setTypingStatus(activeChat.chatId, user.id, true);
     if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
     typingTimeoutRef.current = setTimeout(() => {
        DbService.setTypingStatus(activeChat.chatId, user.id, false);
     }, 3000);
  }, [user, activeChat]);

  const handleSendMessage = async (text: string, media?: { url: string, type: 'image' | 'video' | 'file' }) => {
    if (!user || !activeChat || sending) return;
    setSending(true);
    try {
      await DbService.sendMessage(activeChat.chatId, user.id, text, media);
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error("Transmission failed. Check network stability.");
    } finally {
      setSending(false);
    }
  };

  const handleUploadMedia = async (file: File) => {
    if (!user) throw new Error("Auth required");
    return await DbService.uploadChatMedia(user.id, file);
  };

  const filteredMessages = useMemo(() => {
    if (!chatSearchQuery.trim()) return messages;
    return messages.filter(m => m.text?.toLowerCase().includes(chatSearchQuery.toLowerCase()));
  }, [messages, chatSearchQuery]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="relative">
             <Loader2 className="w-16 h-16 animate-spin text-primary" />
             <div className="absolute inset-0 bg-primary/20 blur-3xl animate-pulse" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideMobileNav={!!activeChat} hideHeader={true}>
      <div className="flex-1 flex bg-background w-full h-[100dvh] max-h-[100dvh] overflow-hidden relative text-foreground">
        
        {/* Sidebar Layer */}
        <ChatSidebar 
          user={user}
          conversations={conversations}
          activeChatId={activeChat?.chatId}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          globalResults={globalResults}
          isSearchingGlobal={isSearchingGlobal}
          onSelectChat={(uid) => navigate({ to: '/chat', search: { c: uid }})}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
        />

        {/* Main Viewbox Layer */}
        <main className={`flex-1 flex flex-col relative min-h-0 min-w-0 ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
          {activeChat ? (
            <>
              {/* Premium Header */}
              <header className="p-4 md:p-7 flex items-center justify-between chat-glass border-b border-border z-20 transition-all">
                <div className="flex items-center gap-5">
                  <button onClick={() => navigate({ to: '/chat', search: {} })} className="md:hidden p-3 bg-foreground/5 rounded-2xl border border-border hover:bg-foreground/10 transition-all">
                    <ArrowLeft className="w-5 h-5 text-foreground" />
                  </button>
                  <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate({ to: '/$username', params: { username: activeChat.profile.username }})}>
                    <div className="relative">
                      <div className="w-11 h-11 md:w-14 md:h-14 rounded-[1.25rem] border-2 border-border overflow-hidden shadow-2xl group-hover:border-primary transition-all duration-500">
                         {activeChat.profile.avatarUrl ? (
                           <img src={activeChat.profile.avatarUrl} className="w-full h-full object-cover" alt="" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-xl font-black italic uppercase">
                             {activeChat.profile.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                           </div>
                         )}
                      </div>
                      {recipientPresence?.status === 'online' && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full border-[3px] border-background shadow-[0_0_10px_var(--success)]" />
                      )}
                    </div>
                    <div className="flex flex-col">
                       <div className="flex items-center gap-1.5">
                          <h2 className="text-base md:text-lg font-black tracking-tight leading-none text-foreground">{activeChat.profile.fullName}</h2>
                          <VerificationTick planId={activeChat.profile.subscription?.planId} size={18} />
                       </div>
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] mt-1.5 opacity-40 text-foreground">
                          {recipientPresence?.status === 'online' 
                             ? 'Active Now' 
                             : (recipientPresence?.lastSeen 
                                 ? `Active ${formatDistanceToNow(new Date(recipientPresence.lastSeen))} ago` 
                                 : 'Frequency Offline')}
                       </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                   <button 
                     onClick={() => setChatSearchOpen(!chatSearchOpen)}
                     className={`p-3 rounded-2xl border transition-all ${chatSearchOpen ? 'bg-primary text-white border-primary shadow-lg' : 'bg-foreground/5 text-foreground/40 border-border hover:text-foreground'}`}
                   >
                      <Search className="w-5 h-5" />
                   </button>
                   
                   <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                       <button className="p-3 bg-foreground/5 text-foreground/40 rounded-2xl border border-border hover:text-foreground transition-all">
                          <MoreVertical className="w-5 h-5" />
                       </button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end" side="bottom" sideOffset={12} className="w-56 bg-popover/90 border-border backdrop-blur-3xl rounded-2xl p-2 shadow-2xl z-[100]">
                       <DropdownMenuItem 
                         onClick={() => {
                            if (window.confirm("Clear all messages in this conversation? This action is irreversible.")) {
                               DbService.deleteChat(user!.id, activeChat.chatId);
                            }
                         }}
                         className="cursor-pointer text-rose-500 font-bold focus:bg-rose-500/10 focus:text-rose-500 rounded-xl py-3 px-4 flex items-center justify-between"
                       >
                         Clear Conversation
                         <Trash2 className="w-4 h-4 opacity-80" />
                       </DropdownMenuItem>
                       <DropdownMenuItem 
                         className="cursor-pointer text-foreground font-medium focus:bg-foreground/10 focus:text-foreground rounded-xl py-3 px-4 flex items-center justify-between"
                       >
                         Conversation Info
                         <Info className="w-4 h-4 opacity-70" />
                       </DropdownMenuItem>
                     </DropdownMenuContent>
                   </DropdownMenu>
                </div>

                {/* Inline Search UI */}
                <AnimatePresence>
                  {chatSearchOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 p-4 bg-background/90 backdrop-blur-2xl border-b border-border z-10 flex items-center gap-4"
                    >
                       <input 
                         autoFocus
                         type="text" 
                         placeholder="Search in conversation..."
                         value={chatSearchQuery}
                         onChange={e => setChatSearchQuery(e.target.value)}
                         className="flex-1 bg-foreground/5 border border-border rounded-xl px-5 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-all"
                       />
                       <button onClick={() => { setChatSearchOpen(false); setChatSearchQuery(''); }} className="p-3 hover:bg-foreground/10 rounded-xl text-foreground/40"><X className="w-5 h-5" /></button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </header>

              {/* Message Thread */}
              <MessageList 
                messages={filteredMessages}
                currentUserId={user!.id}
                typingUsers={typingUsers}
                recipientProfile={activeChat.profile}
                chatId={activeChat.chatId}
              />

              {/* Input Terminal */}
              <ChatInput 
                onSendMessage={handleSendMessage}
                onTyping={handleTyping}
                sending={sending}
                onUploadMedia={handleUploadMedia}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
               <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-primary/5 rounded-full blur-[120px] opacity-20" />
               </div>
               
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="space-y-10 relative z-10"
               >
                  <div className="relative inline-block">
                     <div className="absolute -inset-8 bg-primary/10 blur-[60px] rounded-full animate-pulse" />
                     <div className="w-32 h-32 md:w-48 md:h-48 bg-gradient-to-br from-white/[0.05] to-transparent rounded-[4rem] border border-white/10 flex items-center justify-center shadow-3xl">
                        <MessageSquare className="w-16 h-16 md:w-24 md:h-24 text-white opacity-10" />
                     </div>
                  </div>
                  
                  <div className="space-y-4 max-w-sm mx-auto">
                     <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-foreground leading-none">Intelligence Hub</h2>
                     <p className="text-foreground/30 text-xs md:text-sm font-bold uppercase tracking-widest leading-loose">Private channels are encrypted and ready for transmission. Select a contact to initiate.</p>
                  </div>

                  <button 
                    onClick={() => (document.querySelector('input[placeholder="Search messages..."]') as HTMLInputElement)?.focus()}
                    className="px-12 py-5 bg-primary text-white font-black text-xs uppercase tracking-[0.2em] rounded-[2rem] hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(59,130,246,0.3)] border border-border"
                  >
                    Establish Connection
                  </button>
               </motion.div>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
