import React, { useState, useRef } from 'react';
import { Send, Paperclip, Loader2, Smile, Mic, Image as ImageIcon, X, File as FileIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface ChatInputProps {
  onSendMessage: (text: string, media?: { url: string, type: 'image' | 'video' | 'file' }) => Promise<void>;
  onTyping: () => void;
  sending: boolean;
  onUploadMedia: (file: File) => Promise<{ url: string, type: 'image' | 'video' | 'file' }>;
}

const EMOJIS = ['😊', '😂', '🔥', '👍', '❤️', '🙌', '🎉', '💡', '💯', '🚀', '✨', '👏', '🤔', '😎', '🎓', '📚'];

export function ChatInput({
  onSendMessage,
  onTyping,
  sending,
  onUploadMedia
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [attachedMedia, setAttachedMedia] = useState<{ url: string, type: 'image' | 'video' | 'file', file: File } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!text.trim() && !attachedMedia) || sending || isUploading) return;
    
    const msg = text.trim();
    const media = attachedMedia ? { url: attachedMedia.url, type: attachedMedia.type } : undefined;
    
    setText('');
    setAttachedMedia(null);
    setShowEmojis(false);
    
    try {
      await onSendMessage(msg, media);
    } catch (err) {
      toast.error("Failed to send message.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await onUploadMedia(file);
      setAttachedMedia({ ...result, file });
      toast.success("Attachment ready.");
    } catch (err) {
      toast.error("Media upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="absolute bottom-4 md:bottom-8 left-4 right-4 md:left-10 md:right-10 z-30 flex flex-col gap-3">
      {/* Attachment Preview */}
      <AnimatePresence>
        {attachedMedia && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="flex items-center gap-4 p-3 bg-card/90 backdrop-blur-3xl border border-primary/30 rounded-2xl w-fit shadow-2xl ml-4"
          >
             <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden">
                {attachedMedia.type === 'image' ? (
                   <img src={attachedMedia.url} className="w-full h-full object-cover" alt="Preview" />
                ) : attachedMedia.type === 'video' ? (
                   <ImageIcon className="w-6 h-6 text-primary" />
                ) : (
                   <FileIcon className="w-6 h-6 text-primary" />
                )}
             </div>
             <div className="flex flex-col pr-4">
                <span className="text-[10px] font-black text-foreground uppercase truncate max-w-[120px]">{attachedMedia.file.name}</span>
                <span className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest">{attachedMedia.type}</span>
             </div>
             <button onClick={() => setAttachedMedia(null)} className="p-1.5 hover:bg-white/5 rounded-full text-foreground/40 hover:text-rose-500 transition-colors">
                <X className="w-4 h-4" />
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji Picker Popover */}
      <AnimatePresence>
        {showEmojis && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-24 left-4 p-4 bg-card/95 backdrop-blur-3xl border border-border rounded-3xl shadow-3xl grid grid-cols-4 gap-2 z-40"
          >
             {EMOJIS.map(emoji => (
               <button 
                 key={emoji} 
                 onClick={() => { setText(p => p + emoji); setShowEmojis(false); }}
                 className="w-10 h-10 flex items-center justify-center text-xl hover:bg-foreground/5 rounded-xl transition-all hover:scale-110 active:scale-90"
               >
                 {emoji}
               </button>
             ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Terminal */}
      <form 
        onSubmit={handleSubmit}
        className={`p-1.5 bg-card/90 backdrop-blur-3xl border border-border rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-1 group transition-all ${isRecording ? 'ring-2 ring-rose-500/50 border-rose-500/30' : 'focus-within:border-primary/30'}`}
      >
        <div className="flex items-center">
           <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
           <button 
             type="button" 
             disabled={isUploading}
             onClick={() => fileInputRef.current?.click()} 
             className="p-3 text-foreground/20 hover:text-foreground transition-colors rounded-full hover:bg-foreground/5 disabled:opacity-30"
           >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
           </button>
           <button 
             type="button" 
             onClick={() => setShowEmojis(!showEmojis)}
             className={`hidden sm:block p-3 transition-colors rounded-full hover:bg-foreground/5 ${showEmojis ? 'text-primary' : 'text-foreground/20 hover:text-foreground'}`}
           >
              <Smile className="w-5 h-5" />
           </button>
        </div>

        {isRecording ? (
          <div className="flex-1 flex items-center gap-4 px-4 py-3">
             <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_10px_var(--rose-500)]" />
             <span className="text-xs font-black uppercase tracking-widest text-rose-500 animate-pulse">Voice Encryption Recording...</span>
             <div className="flex-1 h-1 bg-rose-500/10 rounded-full overflow-hidden">
                <motion.div initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ repeat: Infinity, duration: 1.5 }} className="w-1/2 h-full bg-rose-500" />
             </div>
             <button type="button" onClick={() => setIsRecording(false)} className="text-[10px] font-black text-foreground/40 hover:text-foreground uppercase tracking-tighter">Cancel</button>
          </div>
        ) : (
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onTyping();
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Type your message..."
            className="flex-1 bg-transparent border-none text-foreground font-medium py-4 px-3 focus:outline-none placeholder:text-foreground/10 text-sm md:text-base selection:bg-primary/30"
          />
        )}

        <div className="flex items-center pr-1 gap-1">
          {(!text.trim() && !attachedMedia) ? (
            <button 
              type="button" 
              onClick={() => setIsRecording(!isRecording)}
              className={`p-3 transition-colors rounded-full ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'text-foreground/20 hover:text-primary hover:bg-primary/5'}`}
            >
               {isRecording ? <Send className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          ) : (
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              type="submit"
              disabled={sending || isUploading}
              className="p-3.5 bg-primary text-white rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:opacity-30 disabled:grayscale flex items-center justify-center"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 fill-white/10" />}
            </motion.button>
          )}
        </div>
      </form>
    </div>
  );
}
