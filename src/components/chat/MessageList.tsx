import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ShieldCheck, MoreHorizontal, Trash2, X, Star, Zap, Diamond, Sparkles, Download, RotateCcw, Maximize2, Loader2, Image as ImageIcon } from 'lucide-react';
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
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAIChat = recipientProfile.uid === 'edunook-ai';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers, aiLoadingState]);

  const bulletColors = ['#818cf8', '#c084fc', '#22d3ee', '#f43f5e', '#10b981'];

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `edunook-ai-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className={`flex-1 overflow-y-auto px-4 py-4 scrollbar-hide min-h-0 ${isAIChat ? 'bg-[#020205] space-y-6' : 'bg-background space-y-4'}`}>
      
      {isAIChat && (
        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        `}} />
      )}

      <div className={`max-w-4xl mx-auto pb-24 ${isAIChat ? 'space-y-10' : 'space-y-4'}`} style={isAIChat ? { fontFamily: "'Plus Jakarta Sans', sans-serif" } : {}}>
        <AnimatePresence initial={false}>
          {messages.length > 0 ? (
            messages.map((msg, i) => {
              const isOwn = msg.senderId === currentUserId;
              
              if (!isAIChat) {
                return (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] flex items-center gap-2 group ${isOwn ? 'flex-row' : 'flex-row-reverse'}`}>
                       <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <button className="p-1.5 hover:bg-muted rounded-full text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="bg-popover border border-border shadow-xl rounded-xl p-1 min-w-[160px]">
                                <DropdownMenuItem className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted font-medium" onClick={() => DbService.deleteMessageForMe(currentUserId, chatId, msg.id)}>
                                   <Trash2 className="w-3.5 h-3.5 text-rose-500" /><span>Delete for Me</span>
                                </DropdownMenuItem>
                                {isOwn && (
                                   <DropdownMenuItem className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-rose-500/10 text-rose-500 font-bold" onClick={() => window.confirm("Unsend?") && DbService.unsendMessage(chatId, msg.id)}>
                                      <RotateCcw className="w-3.5 h-3.5" /><span>Unsend for All</span>
                                   </DropdownMenuItem>
                                )}
                             </DropdownMenuContent>
                          </DropdownMenu>
                       </div>
                       <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-[15px] ${isOwn ? 'bg-primary text-white rounded-tr-none' : 'bg-muted text-foreground rounded-tl-none'}`}>
                         <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text || ''}</ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              // --- PREMIUM AI CHAT STYLE ---
              return (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
	                <div className={`group relative flex flex-col gap-3 ${isOwn ? 'items-end max-w-[85%]' : 'items-start w-full'}`}>
                    
                    {/* BUBBLE CONTAINER */}
                    <div className={`relative w-full p-6 rounded-[2rem] border transition-all ${isOwn ? 'bg-primary border-white/10 rounded-tr-none shadow-xl' : 'bg-white/[0.03] border-white/5 backdrop-blur-md shadow-2xl'}`}>
                      
                      {/* ACTION MENU */}
                      <div className={`absolute top-4 ${isOwn ? '-left-12' : '-right-12'} opacity-0 group-hover:opacity-100 transition-all`}>
                        <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <button className="p-2 hover:bg-white/10 rounded-full text-white/40 hover:text-white"><MoreHorizontal className="w-5 h-5" /></button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="bg-[#0a0a0f] border border-white/10 shadow-3xl rounded-2xl p-1 min-w-[180px] z-50">
                              <DropdownMenuItem className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer hover:bg-white/5 text-white/70 font-semibold" onClick={() => DbService.deleteMessageForMe(currentUserId, chatId, msg.id)}>
                                 <Trash2 className="w-4 h-4 text-rose-500" /><span>Delete Message</span>
                              </DropdownMenuItem>
                              {isOwn && (
                                 <DropdownMenuItem className="flex items-center gap-2 p-2.5 rounded-xl cursor-pointer hover:bg-rose-500/10 text-rose-500 font-bold" onClick={() => window.confirm("Unsend?") && DbService.unsendMessage(chatId, msg.id)}>
                                    <RotateCcw className="w-4 h-4" /><span>Unsend for All</span>
                                 </DropdownMenuItem>
                              )}
                           </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* MEDIA CONTENT */}
                      {msg.mediaUrl && (
                         <div className="relative mb-6 group/image overflow-hidden rounded-[1.5rem] border border-white/10 shadow-2xl cursor-pointer bg-white/[0.02]" onClick={() => setViewerImage(msg.mediaUrl || null)}>
                            <img src={msg.mediaUrl} className="w-full max-h-[500px] object-cover hover:scale-[1.01] transition-all duration-700" alt="Generated Visual" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center gap-6">
                               <div className="p-4 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 text-white hover:bg-primary hover:scale-110 transition-all shadow-2xl"><Maximize2 className="w-8 h-8" /></div>
                               <div className="p-4 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 text-white hover:bg-emerald-500 hover:scale-110 transition-all shadow-2xl" onClick={(e) => { e.stopPropagation(); handleDownload(msg.mediaUrl || ''); }}><Download className="w-8 h-8" /></div>
                            </div>
                         </div>
                      )}

                      {/* TEXT CONTENT */}
                      <div className="text-white">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({node, ...props}) => <h1 style={{ fontSize: '2.2rem', fontWeight: '900', lineHeight: '1.1', letterSpacing: '-0.04em', marginBottom: '1.5rem', marginTop: '0.5rem', background: 'linear-gradient(to right, #fff, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }} {...props} />,
                            h2: ({node, ...props}) => <div className="flex items-center gap-3 mb-5 mt-8"><div style={{ width: '4px', height: '24px', backgroundColor: '#6366f1', borderRadius: '4px', boxShadow: '0 0 15px rgba(99,102,241,0.5)' }} /><h2 style={{ fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#fff', margin: '0' }} {...props} /></div>,
                            h3: ({node, ...props}) => <h3 style={{ fontSize: '0.9rem', fontWeight: '900', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#818cf8', marginBottom: '0.75rem', marginTop: '2rem' }} {...props} />,
                            p: ({node, ...props}) => <div style={{ fontSize: '1.05rem', lineHeight: '1.7', fontWeight: '500', color: 'rgba(255,255,255,0.85)', marginBottom: '1.25rem' }} {...props} />,
                            ul: ({node, ...props}) => <ul className="space-y-3 mb-8" {...props} />,
                            ol: ({node, ...props}) => <ol className="space-y-3 mb-8" {...props} />,
                            li: ({node, ...props}) => {
                              const color = bulletColors[Math.floor(Math.random() * bulletColors.length)];
                              return (
                                <motion.li whileHover={{ x: 5 }} style={{ display: 'flex', gap: '1rem', alignItems: 'start', backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem 1.5rem', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '0.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
                                  <div style={{ marginTop: '6px', flexShrink: '0' }}><Sparkles style={{ color, width: '14px', height: '14px', fill: color, filter: `drop-shadow(0 0 5px ${color})` }} /></div>
                                  <div style={{ fontSize: '1.05rem', fontWeight: '700', color: '#fff', lineHeight: '1.5' }}>{props.children}</div>
                                </motion.li>
                              );
                            },
                            code: ({node, inline, className, ...props}: any) => 
                              inline 
                                ? <code style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#a5b4fc', padding: '2px 6px', borderRadius: '6px', fontWeight: '700', fontSize: '0.9em', border: '1px solid rgba(99,102,241,0.3)' }} {...props} />
                                : (
                                  <div style={{ margin: '2rem 0', borderRadius: '1.5rem', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#050508', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                                    <div style={{ padding: '0.75rem 1.5rem', backgroundColor: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', gap: '8px' }}><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ff5f56' }} /><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} /><div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#27c93f' }} /></div>
                                      <span style={{ fontSize: '10px', fontWeight: '900', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.3em' }}>{className?.replace('language-', '') || 'SOURCE CODE'}</span>
                                    </div>
                                    <div style={{ padding: '1.5rem', overflowX: 'auto' }}><pre style={{ fontSize: '0.95rem', lineHeight: '1.7', color: '#e0e7ff', fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'pre' }}><code {...props} /></pre></div>
                                  </div>
                                ),
                            blockquote: ({node, ...props}) => <blockquote style={{ borderLeft: '5px solid #6366f1', padding: '1.25rem 2rem', margin: '2rem 0', fontStyle: 'italic', fontSize: '1.2rem', fontWeight: '700', color: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(99,102,241,0.03)', borderRadius: '0 1.5rem 1.5rem 0', boxShadow: 'inset 10px 0 20px -10px rgba(99,102,241,0.1)' }} {...props} />,
                            strong: ({node, ...props}) => <strong style={{ color: '#a5b4fc', fontWeight: '900', textShadow: '0 0 10px rgba(165,180,252,0.3)' }} {...props} />
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
            <div className="flex-1 flex flex-col items-center justify-center py-24 opacity-10"><Diamond className="w-16 h-16 text-white animate-spin-slow" /></div>
          )}

          {/* PREMIUM AI LOADING STATE */}
          {aiLoadingState && (
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
               <div className="flex items-center gap-5 px-8 py-5 bg-white/[0.04] border border-white/10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl">
                  <div className="relative">
                     <div className="absolute inset-0 bg-primary/30 blur-[20px] rounded-full animate-pulse" />
                     <Diamond className="w-7 h-7 text-primary animate-spin-slow" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[11px] font-black uppercase tracking-[0.3em] text-primary mb-1">Neural Connection Active</span>
                     <div className="flex gap-1.5">
                        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} className="w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_#6366f1]" />
                        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_#6366f1]" />
                        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-2 h-2 bg-primary rounded-full shadow-[0_0_8px_#6366f1]" />
                     </div>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
         {viewerImage && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-4 md:p-10" onClick={() => setViewerImage(null)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative max-w-full max-h-full flex flex-col items-center gap-8" onClick={(e) => e.stopPropagation()}>
                 <img src={viewerImage} className="max-w-full max-h-[80vh] object-contain rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10" alt="EduNook AI High Resolution" />
                 <div className="flex items-center gap-6">
                    <button onClick={() => handleDownload(viewerImage)} className="flex items-center gap-3 px-10 py-5 bg-white/10 hover:bg-primary text-white rounded-[2rem] border border-white/20 backdrop-blur-xl transition-all font-black text-xl shadow-2xl hover:scale-105 active:scale-95"><Download className="w-8 h-8" />Download Masterpiece</button>
                    <button onClick={() => setViewerImage(null)} className="p-5 bg-white/10 hover:bg-rose-500/20 text-white rounded-[2rem] border border-white/20 backdrop-blur-xl transition-all hover:scale-105 active:scale-95"><X className="w-8 h-8" /></button>
                 </div>
              </motion.div>
           </motion.div>
         )}
      </AnimatePresence>

      <div ref={messagesEndRef} />
    </div>
  );
}
