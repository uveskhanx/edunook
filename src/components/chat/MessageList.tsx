import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ShieldCheck, MoreHorizontal, Trash2, RotateCcw, X, Download } from 'lucide-react';
import { differenceInMinutes, format } from 'date-fns';
import { Message, Profile, DbService } from '@/lib/db-service';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  recipientProfile: Profile;
  typingUsers: Record<string, boolean>;
  chatId: string;
}

export function MessageList({
  messages,
  currentUserId,
  recipientProfile,
  typingUsers,
  chatId
}: MessageListProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [viewerImage, setViewerImage] = React.useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  return (
    <div className="flex-1 overflow-y-auto chat-scrollbar px-4 py-8 md:px-12 md:py-10 space-y-4 pb-32 md:pb-48 relative scroll-smooth flex flex-col min-h-0">
      <AnimatePresence initial={false}>
        {messages.length > 0 ? (
          messages.map((msg, i) => {
            const isOwn = msg.senderId === currentUserId;
            const isSelected = selectedId === msg.id;
            const nextMsg = messages[i + 1];
            const isLastInBlock = !nextMsg || 
                                nextMsg.senderId !== msg.senderId || 
                                differenceInMinutes(new Date(nextMsg.createdAt), new Date(msg.createdAt)) >= 20;

            return (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'} message-appear`}
                onClick={() => setSelectedId(isSelected ? null : msg.id)}
              >
                <div className={`max-w-[85%] md:max-w-[70%] group relative flex items-center gap-2 ${isOwn ? 'flex-row' : 'flex-row-reverse'}`}>
                  {/* Message Options Trigger - Centered Vertically */}
                  <div className={`transition-all flex items-center justify-center shrink-0 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100'}`}>
                    <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                         <button className="p-2 hover:bg-foreground/5 rounded-full text-foreground/40 hover:text-foreground transition-all focus:outline-none">
                            <MoreHorizontal className="w-4 h-4" />
                         </button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent 
                         side={isOwn ? "left" : "right"} 
                         align="center" 
                         sideOffset={12} 
                         className="w-44 bg-popover/95 backdrop-blur-2xl border-border rounded-xl p-1 shadow-2xl z-50"
                       >
                          <DropdownMenuItem 
                            onClick={() => DbService.deleteMessageForMe(currentUserId, chatId, msg.id)}
                            className="cursor-pointer text-foreground font-semibold focus:bg-foreground/10 focus:text-foreground rounded-lg py-2 px-3 flex items-center justify-between text-[11px] transition-colors"
                          >
                             Delete for Me
                             <Trash2 className="w-3 h-3 opacity-40" />
                          </DropdownMenuItem>
                          {isOwn && (
                            <DropdownMenuItem 
                              onClick={() => DbService.unsendMessage(chatId, msg.id)}
                              className="cursor-pointer text-rose-500 font-bold focus:bg-rose-500/10 focus:text-rose-500 rounded-lg py-2 px-3 flex items-center justify-between text-[11px] transition-colors"
                            >
                                Unsend Message
                                <RotateCcw className="w-3 h-3 opacity-70" />
                            </DropdownMenuItem>
                          )}
                       </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className={`flex flex-col gap-1 flex-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                    {isLastInBlock && (
                      <div className="flex items-center gap-2 mb-1 px-1 opacity-40">
                        <p className="text-[9px] font-black text-foreground uppercase tracking-widest">
                           {format(new Date(msg.createdAt), 'HH:mm')}
                        </p>
                      </div>
                    )}

                    <div className={`flex flex-col gap-2 rounded-2xl shadow-sm transition-all relative w-fit ${
                      isOwn 
                        ? 'bg-gradient-to-br from-primary to-indigo-600 text-white rounded-tr-none' 
                        : 'bg-foreground/5 border border-border text-foreground/90 rounded-tl-none backdrop-blur-md'
                    }`}>
                      {msg.mediaUrl && (
                         <div className="p-1 pb-0">
                            {msg.mediaType === 'image' ? (
                               <img 
                                 src={msg.mediaUrl} 
                                 onClick={(e) => { e.stopPropagation(); setViewerImage(msg.mediaUrl || null); }}
                                 className="w-full max-h-72 object-cover rounded-xl border border-white/10 cursor-zoom-in hover:opacity-90 transition-opacity" 
                                 alt="Shared media" 
                               />
                            ) : (
                               <a 
                                 href={msg.mediaUrl} 
                                 target="_blank" 
                                 rel="noopener noreferrer"
                                 className="flex items-center gap-3 p-3 bg-black/20 rounded-xl hover:bg-black/30 transition-all border border-white/5"
                               >
                                  <ShieldCheck className="w-5 h-5 text-primary" />
                                  <div className="flex flex-col">
                                     <span className="text-[10px] font-black uppercase truncate max-w-[150px]">Secure Document</span>
                                     <span className="text-[8px] font-bold opacity-40 uppercase">Click to decrypt</span>
                                  </div>
                               </a>
                            )}
                         </div>
                      )}
                      {msg.text && (
                         <div className="px-5 py-3 text-[14px] md:text-[15px] font-medium leading-relaxed">
                            {msg.text}
                         </div>
                      )}
                    </div>

                    {isOwn && i === messages.length - 1 && (
                      <div className="mt-1 flex items-center gap-1.5 opacity-40">
                         {msg.seen ? (
                           <div className="flex items-center gap-1">
                              <div className="flex -space-x-1">
                                 <ShieldCheck className="w-2.5 h-2.5 text-primary fill-primary/20" />
                                 <ShieldCheck className="w-2.5 h-2.5 text-primary fill-primary/20" />
                              </div>
                              <span className="text-[7px] font-black text-primary uppercase tracking-tighter">Seen</span>
                           </div>
                         ) : (
                           <div className="flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5 text-foreground" />
                              <span className="text-[7px] font-black text-foreground uppercase tracking-tighter">Sent</span>
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-24 opacity-20">
              <div className="p-8 bg-white/5 rounded-[2.5rem] mb-6 ring-1 ring-white/10">
                 <MessageSquare className="w-10 h-10 text-white" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-white">Secure Channel Ready</p>
              <p className="text-[10px] text-muted-foreground mt-2 text-center font-bold">Encrypted messages are active for this conversation</p>
          </div>
        )}
      </AnimatePresence>
      
      {typingUsers[recipientProfile.uid] && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-28 left-8 flex items-center gap-4 bg-background/60 backdrop-blur-xl px-5 py-3 rounded-2xl border border-border"
        >
           <div className="flex gap-1.5">
             {[0, 1, 2].map(i => (
               <motion.div
                 key={i}
                 animate={{ scale: [1, 1.4, 1], opacity: [0.2, 1, 0.2] }}
                 transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.15 }}
                 className="w-1.5 h-1.5 bg-primary rounded-full"
               />
             ))}
           </div>
           <span className="text-[9px] font-black text-foreground/40 uppercase tracking-widest italic">{recipientProfile.fullName.split(' ')[0]} is generating signal...</span>
        </motion.div>
      )}
      
      {/* Premium Lightbox Overlay */}
      <AnimatePresence>
        {viewerImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewerImage(null)}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-12 cursor-zoom-out"
          >
            <motion.button 
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => setViewerImage(null)}
              className="absolute top-6 right-6 md:top-12 md:right-12 p-4 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-white z-[210] transition-all"
            >
              <X className="w-6 h-6" />
            </motion.button>

            <motion.img 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              src={viewerImage} 
              className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={messagesEndRef} />
    </div>
  );
}
