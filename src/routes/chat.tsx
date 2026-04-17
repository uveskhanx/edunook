import { createFileRoute, useNavigate, Link, useSearch } from '@tanstack/react-router';
import { useEffect, useState, useRef } from 'react';
import { DbService, Profile, Message } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { Send, User as UserIcon, Loader2, Search, MessageSquare, ArrowLeft, ShieldCheck, Sparkles, MoreVertical, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

  // Security Verification
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: '/login' });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      const unsubscribe = DbService.subscribeToUserConversations(user.id, (convs) => {
        setConversations(convs);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

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
         const chatSnapshot = await DbService.getChatMetadata(activeChat.chatId);
         if (chatSnapshot && chatSnapshot.users) {
            if (!chatSnapshot.users[user.id]) {
               console.warn("Unauthorized access attempt to chat:", activeChat.chatId);
               navigate({ to: '/home' });
               return;
            }
         }
         
         const unsubscribe = DbService.subscribeToMessages(activeChat.chatId, (msgs) => {
           setMessages(msgs);
           setTimeout(scrollToBottom, 500); // Increased delay for smoother layout shift handling
         });
         return unsubscribe;
      };
      
      let cleanup: (() => void) | undefined;
      verifyAccess().then(unsub => { cleanup = unsub; });
      return () => { if (cleanup) cleanup(); };
    }
  }, [activeChat, user, navigate]);

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
    <Layout>
      <div className="flex bg-[#050505] h-[calc(100vh-160px)] md:h-screen overflow-hidden">
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

          <div className="flex-1 overflow-y-auto px-4 pb-32 md:pb-8 space-y-2">
            <AnimatePresence mode="popLayout">
              {conversations.length > 0 ? (
                conversations
                  .filter(c => c.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((conv, idx) => (
                    <motion.button
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
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
                            <img src={conv.avatarUrl} className="w-full h-full object-cover" alt={conv.fullName} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary">
                               <UserIcon className="w-6 h-6" />
                            </div>
                          )}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success rounded-full border-2 border-black" />
                      </div>
                      
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex justify-between items-center mb-1">
                          <p className={`text-sm font-black truncate transition-colors ${activeChat?.chatId === conv.chatId ? 'text-white' : 'text-muted-foreground group-hover:text-white'}`}>
                            {conv.fullName}
                          </p>
                          {conv.updatedAt && (
                            <span className="text-[9px] text-muted-foreground/50 font-medium">
                              {new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground/60 truncate font-medium">
                          {conv.lastMessage || 'Open frequency to start talking...'}
                        </p>
                      </div>

                      {activeChat?.chatId === conv.chatId && (
                        <div className="flex flex-col gap-0.5">
                           {[0, 1].map(i => <div key={i} className="w-1 h-1 bg-primary rounded-full animate-pulse" />)}
                        </div>
                      )}
                    </motion.button>
                  ))
              ) : (
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
              <header className="p-6 md:p-8 flex items-center justify-between bg-black/40 backdrop-blur-3xl border-b border-white/5 z-20">
                <div className="flex items-center gap-6">
                  <button onClick={() => setActiveChat(null)} className="md:hidden p-3 bg-white/5 rounded-2xl border border-white/5">
                    <ArrowLeft className="w-6 h-6 text-white" />
                  </button>
                  <Link to="/$username" params={{ username: activeChat.profile.username }} className="group flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[1.25rem] bg-card border border-white/10 overflow-hidden shadow-2xl group-hover:border-primary/50 transition-all">
                       {activeChat.profile.avatarUrl ? <img src={activeChat.profile.avatarUrl} className="w-full h-full object-cover" /> : <UserIcon className="w-12 h-12 p-3 text-muted-foreground opacity-20" />}
                    </div>
                    <div>
                       <div className="flex items-center gap-2">
                          <h2 className="text-xl font-black text-white tracking-tight">{activeChat.profile.fullName}</h2>
                          <ShieldCheck className="w-4 h-4 text-primary" />
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_var(--success)]" />
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Identity Verified</span>
                       </div>
                    </div>
                  </Link>
                </div>
                <div className="flex items-center gap-4">
                   <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-xl text-primary">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Premium Node</span>
                   </div>
                   <button className="p-3 text-muted-foreground hover:text-white transition-colors bg-white/5 rounded-2xl"><MoreVertical className="w-5 h-5" /></button>
                </div>
              </header>

              {/* Message Feed */}
              <div className="flex-1 flex flex-col-reverse overflow-y-auto p-6 md:p-12 space-y-8 space-y-reverse pb-40 relative">
                 <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#050505] to-transparent pointer-events-none z-10" />
                 <div ref={messagesEndRef} />
                 <AnimatePresence initial={false}>
                    {messages.length > 0 ? (
                      messages.map((msg) => {
                       const isOwn = msg.senderId === user?.id;
                       return (
                         <motion.div
                           initial={{ opacity: 0, scale: 0.9 }}
                           animate={{ opacity: 1, scale: 1 }}
                           key={msg.id}
                           className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
                         >
                           <div className={`max-w-[80%] space-y-1.5`}>
                              <div className={`relative px-5 py-3 rounded-2xl text-[14px] font-medium leading-relaxed shadow-lg ${
                                 isOwn 
                                   ? 'bg-primary text-white rounded-tr-none' 
                                   : 'bg-white/5 border border-white/10 text-white rounded-tl-none'
                              }`}>
                                 {msg.text}
                              </div>
                              <p className={`text-[9px] font-bold text-muted-foreground/40 ${isOwn ? 'text-right' : 'text-left'}`}>
                                 {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                           </div>
                         </motion.div>
                       );
                     })
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-24 opacity-20">
                         <div className="p-6 bg-white/5 rounded-full mb-4">
                            <MessageSquare className="w-8 h-8 text-white" />
                         </div>
                         <p className="text-xs font-black uppercase tracking-widest text-white">No messages yet</p>
                         <p className="text-[10px] text-muted-foreground mt-1 text-center">Send the first message below</p>
                      </div>
                    )}
                 </AnimatePresence>
              </div>

              {/* Input Terminal */}
              <div className="absolute bottom-10 left-6 right-6 md:left-12 md:right-12 z-30">
                <form 
                  onSubmit={handleSendMessage}
                  className="p-3 bg-card/60 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-2xl flex items-center gap-2 group focus-within:ring-4 focus-within:ring-primary/10 transition-all"
                >
                  <button type="button" className="p-4 text-muted-foreground hover:text-primary transition-colors bg-white/5 rounded-full">
                     <Paperclip className="w-6 h-6" />
                  </button>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Inscribe your thoughts..."
                    className="flex-1 bg-transparent border-none text-white font-bold px-4 focus:outline-none placeholder:text-muted-foreground/20 text-lg"
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="p-5 bg-primary text-white rounded-full shadow-lg shadow-primary/30 hover:scale-110 active:scale-90 transition-all disabled:opacity-50 disabled:scale-100"
                  >
                    {sending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
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
