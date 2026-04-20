import { createFileRoute, useNavigate, Link, useSearch } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { DbService, Profile, Message } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { Send, User as UserIcon, Loader2, Search, MessageSquare, ArrowLeft, ShieldCheck, Sparkles, MoreVertical, Paperclip, Pin, VolumeX } from 'lucide-react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';
import { differenceInMinutes, formatDistanceToNow, format } from 'date-fns';

export const Route = createFileRoute('/chat')({
  head: () => ({
    meta: [{ title: 'Messaging — EduNook' }],
  }),
  component: ChatPage,
});

function ChatPage() {
  const searchParams = useSearch({ strict: false }) as { chatWith?: string };
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [conversations, setConversations] = useState<(Profile & { chatId: string; lastMessage?: string; updatedAt?: string })[]>([]);
  const [activeChat, setActiveChat] = useState<{ profile: Profile; chatId: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<Profile[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [recipientPresence, setRecipientPresence] = useState<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Security Verification
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/login' });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      // Start presence heartbeat
      DbService.updatePresence(user.id);

      const unsubscribe = DbService.subscribeToUserConversations(user.id, (convs) => {
        setConversations(convs);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

  // Handle Mark as Read when active chat is open
  useEffect(() => {
     if (activeChat && user) {
        DbService.markAsRead(activeChat.chatId, user.id);
     }
  }, [activeChat, user, messages]); // messages dependency ensures we clear unread if on screen when new msg arrives

  // Global Search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setGlobalResults([]);
      setIsSearchingGlobal(false);
      return;
    }

    const searchUsers = async () => {
      setIsSearchingGlobal(true);
      try {
        const results = await DbService.searchProfiles(searchQuery);
        // exclude users we already have chats with
        const currentUids = new Set(conversations.map(c => c.uid));
        setGlobalResults(results.filter(r => !currentUids.has(r.uid) && r.uid !== user?.id));
      } catch (err) {
        console.error("Global search failed", err);
      } finally {
        setIsSearchingGlobal(false);
      }
    };

    const timer = setTimeout(searchUsers, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, conversations, user?.id]);

  useEffect(() => {
    async function initDirectChat() {
      if (searchParams.chatWith && user && !loading) {
        try {
          // Use getOrCreateChat to ensure the node exists with correct structure
          const chatId = await DbService.getOrCreateChat(user.id, searchParams.chatWith);
          const profile = await DbService.getProfile(searchParams.chatWith);
          
          if (profile) {
            setActiveChat({ profile, chatId });
          }
        } catch (err) {
          console.error("Could not init direct chat", err);
        }
        // Purge parameter from URL so normal navigation restores cleanly
        navigate({ to: '/chat', replace: true });
      }
    }
    initDirectChat();
  }, [searchParams.chatWith, user, loading, navigate]);

  useEffect(() => {
    if (activeChat && user) {
      // Production Grade Security Fix: Verify user is a participant
      const verifyAccess = async () => {
         try {
           const chatSnapshot = await DbService.getChatMetadata(activeChat.chatId);
           if (chatSnapshot && chatSnapshot.users) {
              if (!chatSnapshot.users[user.id]) {
                 console.warn("Unauthorized access attempt to chat:", activeChat.chatId);
                 navigate({ to: '/home' });
                 return;
              }
           }
           
           const unsubMsgs = DbService.subscribeToMessages(activeChat.chatId, (msgs) => {
             setMessages(msgs);
             setTimeout(scrollToBottom, 500);
           });

           const unsubTyping = DbService.subscribeToTyping(activeChat.chatId, (typingMap) => {
              setTypingUsers(typingMap);
           });

           const unsubPresence = DbService.subscribeToPresence(activeChat.profile.uid, (presence) => {
              setRecipientPresence(presence);
           });

           return () => {
              unsubMsgs();
              unsubTyping();
              unsubPresence();
           };
         } catch (error) {
           console.error("Failed to verify access or subscribe to chat:", error);
           navigate({ to: '/chat', replace: true });
           return () => {};
         }
      };
      
      let cleanup: (() => void) | undefined;
      verifyAccess().then(unsub => { cleanup = unsub; });
      return () => { if (cleanup) cleanup(); };
    }
  }, [activeChat, user, navigate]);

  const handleTyping = () => {
     if (!user || !activeChat) return;
     
     DbService.setTypingStatus(activeChat.chatId, user.id, true);
     
     if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
     typingTimeoutRef.current = setTimeout(() => {
        DbService.setTypingStatus(activeChat.chatId, user.id, false);
     }, 3000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChat || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      await DbService.sendMessage(activeChat.chatId, user.id, newMessage.trim());
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  if (authLoading || (loading && !activeChat)) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideMobileNav={!!activeChat} hideHeader={true}>
      <div className="flex-1 flex bg-[#050505] h-full w-full overflow-hidden relative">
        {/* Sidebar: Message Threads */}
        <aside className={`w-full md:w-96 flex flex-col bg-black/40 backdrop-blur-3xl border-r border-white/5 transition-all ${activeChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
               <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">Communications</h1>
               <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 text-primary">
                  <Sparkles className="w-4 h-4" />
               </div>
            </div>
            
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Search frequencies..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/5 rounded-2xl text-white text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/30"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-32 md:pb-12 space-y-2">
            <AnimatePresence mode="popLayout">
              {/* Existing Conversations */}
              {conversations
                .filter(c => c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || c.username.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((conv, idx) => (
                  <motion.button
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={conv.uid}
                    onClick={() => setActiveChat({ profile: conv, chatId: conv.chatId })}
                    className={`w-full flex items-center gap-4 p-4 rounded-3xl transition-all group border ${
                      activeChat?.chatId === conv.chatId 
                        ? 'bg-primary/10 border-primary/20 shadow-xl' 
                        : 'border-transparent hover:bg-white/5'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 overflow-hidden border border-white/10 group-hover:scale-105 transition-transform">
                        {conv.avatarUrl ? (
                          <img src={optimizeCloudinaryUrl(conv.avatarUrl, 96)} className="w-full h-full object-cover" alt={conv.fullName} loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                             <UserIcon className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1.5 truncate">
                           <p className={`text-sm font-black truncate transition-colors ${(conv as any).unreadCount > 0 ? 'text-white' : (activeChat?.chatId === conv.chatId ? 'text-white' : 'text-muted-foreground group-hover:text-white')}`}>
                             {conv.fullName}
                           </p>
                           {(conv as any).unreadCount > 0 && (
                             <motion.span 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="w-1.5 h-1.5 bg-primary rounded-full inline-block shadow-[0_0_8px_var(--primary)]" 
                             />
                           )}
                           {(conv as any).isPinned && <Pin className="w-3 h-3 text-primary rotate-45" />}
                           {(conv as any).isMuted && <VolumeX className="w-3 h-3 text-muted-foreground/30" />}
                        </div>
                        {conv.updatedAt && (
                          <span className={`text-[9px] font-bold uppercase tracking-tighter ${(conv as any).unreadCount > 0 ? 'text-primary' : 'text-muted-foreground/30'}`}>
                            {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: false }).replace('about ', '').replace(' minutes', 'm').replace(' hours', 'h').replace(' days', 'd')}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <p className={`text-[11px] truncate font-medium flex-1 ${ (conv as any).unreadCount > 0 ? 'text-white font-bold' : 'text-muted-foreground/60'}`}>
                          {(conv as any).lastSenderId === user?.id && <span className="opacity-40 mr-1 italic">You:</span>}
                          {conv.lastMessage || 'Start Signal...'}
                        </p>
                        
                        {/* Action Hub (Hover only or specific trigger) */}
                        <div className="hidden group-hover:flex items-center gap-1">
                           <button 
                             onClick={(e) => { e.stopPropagation(); DbService.togglePin(user!.id, conv.chatId, !(conv as any).isPinned); }}
                             className="p-1 px-2 bg-white/5 rounded-md hover:bg-white/10 transition-colors"
                           >
                              <Pin className={`w-3 h-3 ${ (conv as any).isPinned ? 'text-primary' : 'text-muted-foreground'}`} />
                           </button>
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}

              {/* Global Discovery Results */}
              {searchQuery && globalResults.length > 0 && (
                <div className="pt-8 pb-4">
                   <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] px-4 mb-4 flex items-center gap-2">
                      <Sparkles className="w-3 h-3" />
                      EduNook Discovery
                   </p>
                   {globalResults.map((result, idx) => (
                      <motion.button
                        key={result.uid}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={async () => {
                           const chatId = await DbService.getOrCreateChat(user!.id, result.uid);
                           setActiveChat({ profile: result, chatId });
                           setSearchQuery('');
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-3xl hover:bg-white/5 transition-all text-left"
                      >
                         <div className="w-10 h-10 rounded-2xl bg-white/5 overflow-hidden border border-white/10">
                            {result.avatarUrl ? (
                              <img src={result.avatarUrl} className="w-full h-full object-cover" alt={result.fullName} />
                            ) : (
                               <UserIcon className="w-5 h-5 mx-auto mt-2.5 text-muted-foreground opacity-30" />
                            )}
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-white truncate">{result.fullName}</p>
                            <p className="text-[10px] text-muted-foreground font-medium truncate">@{result.username}</p>
                         </div>
                      </motion.button>
                   ))}
                </div>
              )}

              {conversations.length === 0 && !searchQuery && (
                <div className="py-24 text-center px-8 space-y-6 opacity-30">
                   <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground" />
                   <p className="text-[10px] font-black uppercase tracking-[0.2em]">Zero Signals Detected</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </aside>

        {/* Main: Chat Viewbox */}
        <main className={`flex-1 flex flex-col relative transition-all ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
          {activeChat ? (
            <>
              {/* Header Interface */}
              <header className="p-4 md:p-6 flex items-center justify-between bg-black/60 backdrop-blur-3xl border-b border-white/5 z-20">
                <div className="flex items-center gap-4">
                  <button aria-label="Go back" onClick={() => setActiveChat(null)} className="md:hidden p-2.5 bg-white/5 rounded-2xl border border-white/5">
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>
                  <Link to="/$username" params={{ username: activeChat.profile.username }} className="group flex items-center gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/10 overflow-hidden shadow-2xl group-hover:border-primary transition-all">
                       {activeChat.profile.avatarUrl ? <img src={activeChat.profile.avatarUrl} className="w-full h-full object-cover" alt={activeChat.profile.fullName} /> : <UserIcon className="w-10 h-10 md:w-12 md:h-12 p-2.5 text-muted-foreground opacity-20" />}
                    </div>
                     <div className="flex flex-col">
                       <div className="flex items-center gap-1.5">
                          <h2 className="text-sm md:text-base font-black text-white tracking-tight leading-none">{activeChat.profile.fullName}</h2>
                          <ShieldCheck className="w-3.5 h-3.5 text-primary fill-primary/10" />
                       </div>
                       <div className="flex items-center gap-1.5 mt-0.5">
                          {recipientPresence?.status === 'online' ? (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_var(--success)] animate-pulse" />
                              <span className="text-[9px] font-bold text-success uppercase tracking-widest">Connected Now</span>
                            </>
                          ) : (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">
                                {recipientPresence?.lastSeen ? `Last Signal ${formatDistanceToNow(new Date(recipientPresence.lastSeen))} ago` : 'Frequency Silent'}
                              </span>
                            </>
                          )}
                       </div>
                    </div>
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                   <button aria-label="More options" className="p-2.5 text-muted-foreground hover:text-white transition-colors bg-white/5 rounded-2xl border border-white/5"><MoreVertical className="w-5 h-5" /></button>
                </div>
              </header>

              {/* Message Feed (Chronological Flow) */}
              <div className="flex-1 overflow-y-auto px-4 py-8 md:px-12 md:py-10 space-y-4 pb-32 md:pb-48 relative scroll-smooth flex flex-col">
                 <AnimatePresence initial={false}>
                    {messages.length > 0 ? (
                      messages.map((msg, i) => {
                       const isOwn = msg.senderId === user?.id;
                       
                       // Timestamp grouping logic (within 20 mins of same sender)
                       const nextMsg = messages[i + 1];
                       const isLastInBlock = !nextMsg || 
                                           nextMsg.senderId !== msg.senderId || 
                                           differenceInMinutes(new Date(nextMsg.createdAt), new Date(msg.createdAt)) >= 20;

                       return (
                         <motion.div
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           key={msg.id}
                           className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                         >
                           <div className="max-w-[85%] md:max-w-[70%] group">
                              <div className={`px-4 py-2.5 rounded-2xl text-[14px] md:text-[15px] font-medium leading-relaxed shadow-sm transition-all ${
                                 isOwn 
                                   ? 'bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] text-white rounded-tr-none' 
                                   : 'bg-[#1a1a1a] border border-white/5 text-white rounded-tl-none'
                              }`}>
                                 {msg.text}
                              </div>
                              
                              <AnimatePresence>
                               {isLastInBlock && (
                                  <div className={`mt-1 flex items-center gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                    <motion.p 
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      className="text-[8px] font-black text-muted-foreground/30 uppercase px-1"
                                    >
                                       {format(new Date(msg.createdAt), 'HH:mm')}
                                    </motion.p>
                                    {isOwn && i === messages.length - 1 && (
                                      <div className="flex items-center gap-1.5">
                                         {recipientPresence?.status === 'online' ? (
                                           <div className="flex items-center gap-1">
                                              <div className="flex -space-x-1">
                                                 <ShieldCheck className="w-2.5 h-2.5 text-primary fill-primary/20" />
                                                 <ShieldCheck className="w-2.5 h-2.5 text-primary fill-primary/20" />
                                              </div>
                                              <span className="text-[7px] font-black text-primary uppercase tracking-tighter animate-pulse">Seen Now</span>
                                           </div>
                                         ) : (
                                           <div className="flex items-center gap-1">
                                              <ShieldCheck className="w-2.5 h-2.5 text-muted-foreground/30" />
                                              <span className="text-[7px] font-black text-muted-foreground/30 uppercase tracking-tighter">Delivered</span>
                                           </div>
                                         )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </AnimatePresence>
                           </div>
                         </motion.div>
                       );
                      })
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-24 opacity-20">
                          <div className="p-6 bg-white/5 rounded-full mb-4 ring-1 ring-white/10">
                             <MessageSquare className="w-8 h-8 text-white" />
                          </div>
                          <p className="text-xs font-black uppercase tracking-widest text-white">Secure Channel Ready</p>
                          <p className="text-[10px] text-muted-foreground mt-1 text-center">Commence communication below</p>
                      </div>
                    )}
                 </AnimatePresence>
                 
                 {/* Premium Typing HUD */}
                 {typingUsers[activeChat.profile.uid] && (
                   <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 10 }}
                     className="absolute bottom-28 left-8 flex items-center gap-3"
                   >
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <motion.div
                            key={i}
                            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                            transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                            className="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_5px_var(--primary)]"
                          />
                        ))}
                      </div>
                      <span className="text-[9px] font-black text-primary uppercase tracking-widest italic">{activeChat.profile.fullName.split(' ')[0]} is generating signal...</span>
                   </motion.div>
                 )}
                 
                 <div ref={messagesEndRef} />
              </div>

              {/* Input Terminal (Slim & Modern) */}
              <div className="absolute bottom-4 md:bottom-6 left-4 right-4 md:left-8 md:right-8 z-30">
                <form 
                  onSubmit={handleSendMessage}
                  className="p-1 px-4 bg-[#121212]/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-2xl flex items-center gap-2 group transition-all"
                >
                  <button type="button" aria-label="Attach file" className="p-3 text-muted-foreground hover:text-white transition-colors">
                     <Paperclip className="w-5 h-5" />
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    placeholder="Message..."
                    className="flex-1 bg-transparent border-none text-white font-medium py-3 px-2 focus:outline-none placeholder:text-muted-foreground/20 text-sm md:text-base"
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="p-2 text-primary hover:scale-110 active:scale-90 transition-all disabled:opacity-30 flex items-center gap-1"
                  >
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 fill-primary/20" />}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-8 animate-fade-in relative overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-accent/5 -z-10" />
               <div className="p-10 bg-white/5 rounded-[3.5rem] border border-white/5 relative">
                  <div className="absolute -inset-4 bg-primary/20 blur-3xl opacity-30 rounded-full" />
                  <MessageSquare className="relative w-24 h-24 text-muted-foreground opacity-20" />
               </div>
               <div className="space-y-4 max-w-sm">
                  <h2 className="text-4xl font-black tracking-tighter uppercase italic premium-gradient-text">Encrypted Hub.</h2>
                  <p className="text-muted-foreground font-medium leading-relaxed">Select a secure frequency to commence mentorship dialog with your peers.</p>
               </div>
               <div className="flex items-center gap-2 px-6 py-3 bg-white/5 rounded-2xl border border-white/10">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantum Level Privacy</span>
               </div>
            </div>
          )}
        </main>
      </div>
    </Layout>
  );
}
