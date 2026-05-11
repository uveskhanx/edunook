import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ShieldCheck, MoreHorizontal, Trash2, X, Star, Zap, Diamond, Sparkles, Download, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { Message, Profile, DbService } from '@/lib/db-service';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  recipientProfile: Profile;
  typingUsers: Record<string, boolean>;
  chatId: string;
  aiLoadingState?: string | null;
}

export function MessageList({
  messages,
  currentUserId,
  recipientProfile,
  typingUsers,
  chatId,
  aiLoadingState
}: MessageListProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [viewerImage, setViewerImage] = React.useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAIChat = recipientProfile.uid === 'edunook-ai';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const bulletColors = ['#818cf8', '#c084fc', '#22d3ee', '#f43f5e', '#10b981'];

  return (
    <div className={`flex-1 overflow-y-auto px-4 py-4 scrollbar-hide min-h-0 ${isAIChat ? 'bg-[#020205] space-y-6' : 'bg-background space-y-4'}`}>
      
      {isAIChat && (
        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        `}} />
      )}

      <div className={`max-w-4xl mx-auto pb-24 ${isAIChat ? 'space-y-6' : 'space-y-4'}`} style={isAIChat ? { fontFamily: "'Plus Jakarta Sans', sans-serif" } : {}}>
        <AnimatePresence initial={false}>
          {messages.length > 0 ? (
            messages.map((msg, i) => {
              const isOwn = msg.senderId === currentUserId;
              
              // --- STANDARD CHAT STYLE (User to User) ---
              if (!isAIChat) {
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] flex items-center gap-2 group ${isOwn ? 'flex-row' : 'flex-row-reverse'}`}>
                       {/* Options for Normal Chat */}
                       <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <button className="p-1.5 hover:bg-muted rounded-full text-muted-foreground transition-all">
                                  <MoreHorizontal className="w-4 h-4" />
                               </button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="bg-popover border border-border shadow-xl rounded-xl p-1 min-w-[160px]">
                                <DropdownMenuItem 
                                  className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted text-foreground font-medium"
                                  onClick={() => DbService.deleteMessageForMe(currentUserId, chatId, msg.id)}
                                >
                                   <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                   <span>Delete for Me</span>
                                </DropdownMenuItem>
                                {isOwn && (
                                   <DropdownMenuItem 
                                     className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-rose-500/10 text-rose-500 font-bold"
                                     onClick={() => {
                                        if (window.confirm("Unsend this message for everyone?")) {
                                           DbService.unsendMessage(chatId, msg.id);
                                        }
                                     }}
                                   >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>Unsend for All</span>
                                   </DropdownMenuItem>
                                )}
                             </DropdownMenuContent>
                          </DropdownMenu>
                       </div>

                       <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-[15px] leading-relaxed ${
                        isOwn ? 'bg-primary text-white rounded-tr-none' : 'bg-muted text-foreground rounded-tl-none'
                      }`}>
                         <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text || ''}</ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              // --- PREMIUM AI CHAT STYLE ---
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={msg.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
	                <div className={`group relative flex flex-col gap-1.5 ${isOwn ? 'items-end max-w-[85%]' : 'items-start w-full'}`}>
                    <div className={`relative ${isOwn ? 'bg-primary p-3 px-5 rounded-[1.25rem] rounded-tr-none shadow-lg border border-white/10' : 'w-full'}`}>
                      
                      {/* Options for AI Chat */}
                      <div className={`absolute top-2 ${isOwn ? '-left-10' : '-right-10'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <button className="p-1.5 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all">
                                <MoreHorizontal className="w-4 h-4" />
                             </button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="bg-[#12121a] border border-white/10 shadow-2xl rounded-2xl p-1 min-w-[160px]">
                              <DropdownMenuItem 
                                className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-white/5 text-white/70 hover:text-white font-medium"
                                onClick={() => DbService.deleteMessageForMe(currentUserId, chatId, msg.id)}
                              >
                                 <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                 <span>Delete for Me</span>
                              </DropdownMenuItem>
                              {isOwn && (
                                 <DropdownMenuItem 
                                   className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-rose-500/10 text-rose-500 font-bold"
                                   onClick={() => {
                                      if (window.confirm("Unsend this message?")) {
                                         DbService.unsendMessage(chatId, msg.id);
                                      }
                                   }}
                                 >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>Unsend Message</span>
                                 </DropdownMenuItem>
                              )}
                           </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {msg.mediaUrl && (
                         <div className="mb-4 overflow-hidden rounded-[1.5rem] border border-white/5 shadow-xl">
                            <img src={msg.mediaUrl} className="w-full max-h-[400px] object-cover cursor-zoom-in" alt="" />
                         </div>
                      )}
                      <div className={!isOwn ? 'text-white' : 'text-white font-bold text-[14px]'}>
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({node, ...props}) => (
                              <h1 style={{ fontSize: '2rem', fontWeight: '900', lineHeight: '1.1', letterSpacing: '-0.04em', marginBottom: '1rem', marginTop: '0.5rem', background: 'linear-gradient(to right, #fff, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }} {...props} />
                            ),
                            h2: ({node, ...props}) => (
                              <div className="flex items-center gap-2.5 mb-4 mt-6">
                                <div style={{ width: '3px', height: '18px', backgroundColor: '#6366f1', borderRadius: '2px' }} />
                                <h2 style={{ fontSize: '1.3rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#fff', margin: '0' }} {...props} />
                              </div>
                            ),
                            h3: ({node, ...props}) => <h3 style={{ fontSize: '0.8rem', fontWeight: '900', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6366f1', marginBottom: '0.5rem', marginTop: '1.5rem' }} {...props} />,
                            p: ({node, ...props}) => <p style={{ fontSize: '1rem', lineHeight: '1.6', fontWeight: '500', color: 'rgba(255,255,255,0.8)', marginBottom: '1rem' }} {...props} />,
                            ul: ({node, ...props}) => <ul className="space-y-2 mb-6" {...props} />,
                            ol: ({node, ...props}) => <ol className="space-y-2 mb-6" {...props} />,
                            li: ({node, ...props}) => {
                              const color = bulletColors[Math.floor(Math.random() * bulletColors.length)];
                              return (
                                <motion.li whileHover={{ x: 3 }} style={{ display: 'flex', gap: '0.75rem', alignItems: 'start', backgroundColor: 'rgba(255,255,255,0.02)', padding: '0.75rem 1.25rem', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '0.25rem' }}>
                                  <div style={{ marginTop: '4px', flexShrink: '0' }}>
                                    <Sparkles style={{ color, width: '12px', height: '12px', fill: color }} />
                                  </div>
                                  <div style={{ fontSize: '1rem', fontWeight: '700', color: '#fff', lineHeight: '1.4' }}>{props.children}</div>
                                </motion.li>
                              );
                            },
                            code: ({node, inline, className, ...props}: any) => 
                              inline 
                                ? <code style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '1px 5px', borderRadius: '5px', fontWeight: '700', fontSize: '0.85em' }} {...props} />
                                : (
                                  <div style={{ margin: '1.5rem 0', borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#050505', overflow: 'hidden' }}>
                                    <div style={{ padding: '0.5rem 1.25rem', backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', gap: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff5f56' }} />
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#27c93f' }} />
                                      </div>
                                      <span style={{ fontSize: '8px', fontWeight: '800', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.2em' }}>{className?.replace('language-', '') || 'code'}</span>
                                    </div>
                                    <div style={{ padding: '1.25rem', overflowX: 'auto' }}>
                                      <pre style={{ fontSize: '0.9rem', lineHeight: '1.6', color: '#e0e7ff', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre' }}>
                                        <code {...props} />
                                      </pre>
                                    </div>
                                  </div>
                                ),
                            blockquote: ({node, ...props}) => (
                              <blockquote style={{ borderLeft: '4px solid #6366f1', padding: '1rem 1.5rem', margin: '1.5rem 0', fontStyle: 'italic', fontSize: '1.1rem', fontWeight: '700', color: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.01)', borderRadius: '0 1rem 1rem 0' }} {...props} />
                            ),
                            strong: ({node, ...props}) => <strong style={{ color: '#818cf8', fontWeight: '800' }} {...props} />
                          }}
                        >
                          {msg.text || ''}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center py-24 opacity-10">
                <Diamond className="w-10 h-10 text-white animate-spin-slow" />
            </div>
          )}
        </AnimatePresence>
      </div>

      <div ref={messagesEndRef} />
    </div>
  );
}
