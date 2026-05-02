import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User as UserIcon, Sparkles, Pin, Trash2, MoreHorizontal, MessageSquare, VolumeX, Volume2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Profile, DbService } from '@/lib/db-service';
import { optimizeCloudinaryUrl } from '@/lib/image-utils';
import { formatDistanceToNow } from 'date-fns';
import { VerificationTick } from '@/components/VerificationTick';

interface ChatSidebarProps {
  user: any;
  conversations: (Profile & { 
    chatId: string; 
    lastMessage?: string; 
    updatedAt?: string; 
    unreadCount?: number; 
    isPinned?: boolean; 
    isMuted?: boolean;
    lastSenderId?: string;
  })[];
  activeChatId?: string;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  globalResults: Profile[];
  isSearchingGlobal: boolean;
  onSelectChat: (uid: string) => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}

export function ChatSidebar({
  user,
  conversations,
  activeChatId,
  searchQuery,
  setSearchQuery,
  globalResults,
  isSearchingGlobal,
  onSelectChat,
  openMenuId,
  setOpenMenuId
}: ChatSidebarProps) {
  
  const filteredConversations = conversations.filter(c => 
    c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className={`w-full md:w-96 flex flex-col chat-glass border-r border-border transition-all chat-scrollbar ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
           <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase italic">Communications</h1>
           <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 text-primary">
              <Sparkles className="w-4 h-4" />
           </div>
        </div>
        
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-foreground/5 border border-border rounded-2xl text-foreground text-sm font-bold focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/30"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto chat-scrollbar px-4 pb-32 md:pb-12 space-y-2 min-h-0">
        <AnimatePresence mode="popLayout">
          {filteredConversations.map((conv, idx) => (
            <motion.div
              role="button"
              tabIndex={0}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              key={conv.uid}
              onClick={() => onSelectChat(conv.uid)}
              className={`w-full flex items-center gap-4 p-4 rounded-3xl transition-all group border cursor-pointer relative ${
                activeChatId === conv.chatId 
                  ? 'bg-primary/10 border-primary/20 shadow-xl' 
                  : 'border-transparent hover:bg-white/5'
              }`}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-white/5 overflow-hidden border border-white/10 group-hover:scale-105 transition-transform">
                          {conv.avatarUrl ? (
                            <img src={conv.avatarUrl} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-xl font-black italic uppercase">
                               {conv.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </div>
                          )}
                </div>
                {conv.unreadCount && conv.unreadCount > 0 ? (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-black shadow-[0_0_10px_var(--primary)]">
                    {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                  </div>
                ) : null}
              </div>
              
              <div className="flex-1 min-w-0 text-left">
                <div className="flex justify-between items-start mb-0.5 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                     <p className={`text-[15px] font-black truncate transition-colors ${conv.unreadCount && conv.unreadCount > 0 ? 'text-white' : (activeChatId === conv.chatId ? 'text-white' : 'text-muted-foreground group-hover:text-white')}`}>
                       {conv.fullName}
                     </p>
                     <VerificationTick planId={conv.subscription?.planId} size={16} />
                     {conv.isPinned && <Pin className="shrink-0 w-3 h-3 text-primary rotate-45" />}
                     {conv.isMuted && <VolumeX className="shrink-0 w-3 h-3 text-white/20" />}
                  </div>
                  {conv.updatedAt && (
                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-tighter mt-1 ${conv.unreadCount && conv.unreadCount > 0 ? 'text-primary' : 'text-muted-foreground/30'}`}>
                      {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: false })
                        .replace('less than a minute', 'now')
                        .replace('about ', '')
                        .replace(' minutes', 'm')
                        .replace(' minute', 'm')
                        .replace(' hours', 'h')
                        .replace(' hour', 'h')
                        .replace(' days', 'd')
                        .replace(' day', 'd')
                        .replace(' months', 'mo')
                        .replace(' month', 'mo')}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center gap-2">
                  <p className={`text-[11px] truncate font-medium flex-1 ${conv.unreadCount && conv.unreadCount > 0 ? 'text-white font-bold' : 'text-muted-foreground/60'}`}>
                    {conv.lastSenderId === user?.id && <span className="opacity-40 mr-1 italic">You:</span>}
                    {conv.lastMessage || 'Start Signal...'}
                  </p>
                  
                  <div className={`items-center gap-1 ${openMenuId === conv.chatId ? 'flex' : 'hidden group-hover:flex'}`}>
                     <DropdownMenu open={openMenuId === conv.chatId} onOpenChange={(isOpen) => setOpenMenuId(isOpen ? conv.chatId : null)}>
                       <DropdownMenuTrigger asChild>
                         <button 
                           onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === conv.chatId ? null : conv.chatId); }}
                           className="p-1.5 bg-foreground/5 rounded-md hover:bg-foreground/10 transition-colors"
                         >
                            <MoreHorizontal className="w-4 h-4 text-foreground" />
                         </button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end" side="bottom" sideOffset={8} onClick={(e) => e.stopPropagation()} className="w-48 bg-popover/90 border-border backdrop-blur-3xl rounded-2xl p-2 shadow-2xl z-[100]">
                         <DropdownMenuItem 
                           onClick={(e) => { e.stopPropagation(); DbService.togglePin(user!.id, conv.chatId, !conv.isPinned); setOpenMenuId(null); }}
                           className="cursor-pointer text-foreground font-medium focus:bg-foreground/10 focus:text-foreground rounded-xl py-2.5 px-4 flex items-center justify-between"
                         >
                           {conv.isPinned ? 'Unpin Chat' : 'Pin Chat'}
                           <Pin className="w-3.5 h-3.5 opacity-70" />
                         </DropdownMenuItem>
                         <DropdownMenuItem 
                           onClick={(e) => { e.stopPropagation(); DbService.toggleMute(user!.id, conv.chatId, !conv.isMuted); setOpenMenuId(null); }}
                           className="cursor-pointer text-foreground font-medium focus:bg-foreground/10 focus:text-foreground rounded-xl py-2.5 px-4 flex items-center justify-between"
                         >
                           {conv.isMuted ? 'Unmute Chat' : 'Mute Notifications'}
                           {conv.isMuted ? <Volume2 className="w-3.5 h-3.5 opacity-70" /> : <VolumeX className="w-3.5 h-3.5 opacity-70" />}
                         </DropdownMenuItem>
                         <DropdownMenuItem 
                           onClick={(e) => { 
                               e.stopPropagation(); 
                               if (window.confirm('Are you sure you want to delete this conversation? This will hide it for you.')) {
                                 DbService.deleteChat(user!.id, conv.chatId);
                                 setOpenMenuId(null);
                               }
                           }}
                           className="cursor-pointer text-rose-500 font-bold focus:bg-rose-500/10 focus:text-rose-500 rounded-xl py-2.5 px-4 mt-1 flex items-center justify-between transition-all"
                         >
                           Delete Chat
                           <Trash2 className="w-3.5 h-3.5 opacity-80" />
                         </DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}

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
                    onClick={() => {
                       onSelectChat(result.uid);
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
                         <div className="flex items-center gap-1.5">
                            <p className="text-sm font-black text-white truncate">{result.fullName}</p>
                            <VerificationTick planId={result.subscription?.planId} size={14} />
                         </div>
                         <p className="text-[10px] text-muted-foreground font-medium truncate">@{result.username}</p>
                      </div>
                  </motion.button>
               ))}
            </div>
          )}

          {filteredConversations.length === 0 && !searchQuery && (
            <div className="py-24 text-center px-8 space-y-6 opacity-30">
               <div className="p-6 bg-white/5 rounded-full inline-block border border-white/10">
                 <MessageSquare className="w-8 h-8 text-white" />
               </div>
               <p className="text-[12px] font-black uppercase tracking-[0.1em]">No Messages Found</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
