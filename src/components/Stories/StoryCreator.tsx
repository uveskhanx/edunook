'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue } from 'framer-motion';
import { X, Type, Check, Loader2, Image as ImageIcon, Smile, Square, Sliders, Type as TypeIcon, Trash2 } from 'lucide-react';
import { DbService, Profile } from '@/lib/db-service';

const FILTERS = [
  { name: 'Normal', value: 'none' },
  { name: 'Clarendon', value: 'contrast(1.2) saturate(1.35)' },
  { name: 'Gingham', value: 'brightness(1.05) hue-rotate(-10deg)' },
  { name: 'Moon', value: 'grayscale(1) contrast(1.1) brightness(1.1)' },
  { name: 'Lark', value: 'contrast(0.9) saturate(1.3) brightness(1.1)' },
  { name: 'Reyes', value: 'sepia(0.22) brightness(1.1) contrast(0.85) saturate(0.75)' },
  { name: 'Juno', value: 'contrast(1.15) saturate(1.8) hue-rotate(-10deg)' },
  { name: 'Slumber', value: 'saturate(0.66) brightness(1.05)' },
  { name: 'Crema', value: 'sepia(0.5) hue-rotate(-15deg) contrast(1.15)' },
];

const FONTS = [
  { name: 'Classic', value: 'Inter, sans-serif' },
  { name: 'Serif', value: 'Georgia, serif' },
  { name: 'Mono', value: 'monospace' },
  { name: 'Comic', value: '"Comic Sans MS", cursive, sans-serif' },
  { name: 'Impact', value: 'Impact, fantasy' },
];

const COLORS = ['#FFFFFF', '#000000', '#FF3B30', '#34C759', '#007AFF', '#FFCC00', '#FF9500', '#AF52DE', '#FF2D55'];

const EMOJI_CATEGORIES = [
  { name: 'Smileys', emojis: ['😀','😂','🥰','😎','🤔','😭','😡','🤯','🥳','🥶','🤢','😴','🙄','🤐','🤫'] },
  { name: 'Gestures', emojis: ['👍','👎','✌️','🤞','🤙','🤘','👋','👏','🙌','👐','🤲','🤝','🙏','💪'] },
  { name: 'Objects', emojis: ['🔥','✨','🌟','💯','💣','💥','💦','💨','💫','👑','💎','💰','🚀','🛸','🎁'] },
  { name: 'Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓'] },
];

export interface OverlayItem {
  id: string;
  type: 'text' | 'sticker';
  content: string;
  x: number;
  y: number;
  color?: string;
  fontFamily?: string;
  scale: number;
}

export interface FrameSettings {
  padding: number;
  radius: number;
  bgColor: string;
}

const CANVAS_W = 360;
const CANVAS_H = 640;

function DraggableOverlay({ 
  item, 
  onTransformUpdate,
  onDragStart,
  onDragEnd
}: { 
  item: OverlayItem, 
  onTransformUpdate: (id: string, x: number, y: number) => void,
  onDragStart: () => void,
  onDragEnd: (id: string, x: number, y: number) => void
}) {
  const x = useMotionValue(item.x);
  const y = useMotionValue(item.y);

  useEffect(() => {
    const unsubX = x.on('change', v => onTransformUpdate(item.id, v, y.get()));
    const unsubY = y.on('change', v => onTransformUpdate(item.id, x.get(), v));
    return () => { unsubX(); unsubY(); };
  }, [x, y, item.id, onTransformUpdate]);

  return (
    <motion.div
      drag
      dragConstraints={{ left: -100, right: CANVAS_W + 100, top: -100, bottom: CANVAS_H + 100 }}
      dragElastic={0.5}
      dragMomentum={false}
      onDragStart={onDragStart}
      onDragEnd={() => onDragEnd(item.id, x.get(), y.get())}
      style={{ x, y, position: 'absolute', left: 0, top: 0, zIndex: 30 }}
      whileDrag={{ scale: item.scale * 1.1, cursor: 'grabbing' }}
      whileHover={{ cursor: 'grab' }}
      className="group"
    >
      <div 
        style={{ 
          transform: 'translate(-50%, -50%)',
          color: item.color,
          fontFamily: item.fontFamily,
          fontSize: item.type === 'sticker' ? '4rem' : '2.5rem',
          fontWeight: 'bold',
          textShadow: item.type === 'text' ? '2px 2px 4px rgba(0,0,0,0.8)' : 'none',
          whiteSpace: 'pre-wrap',
          textAlign: 'center',
          lineHeight: '1.2'
        }}
      >
        {item.content}
      </div>
    </motion.div>
  );
}

interface StoryCreatorProps {
  currentUser: Profile;
  onClose: () => void;
  onStoryAdded: () => void;
}

export function StoryCreator({ currentUser, onClose, onStoryAdded }: StoryCreatorProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  
  const [activeFilter, setActiveFilter] = useState(FILTERS[0].value);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [frameSettings, setFrameSettings] = useState<FrameSettings>({ padding: 0, radius: 0, bgColor: '#000000' });
  
  const [activeTool, setActiveTool] = useState<'none' | 'text' | 'stickers' | 'filters' | 'frame'>('none');
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOverlay, setIsDraggingOverlay] = useState(false);
  
  // Text Draft State
  const [draftText, setDraftText] = useState('');
  const [draftColor, setDraftColor] = useState(COLORS[0]);
  const [draftFont, setDraftFont] = useState(FONTS[0].value);
  
  // Sticker Search State
  const [stickerSearch, setStickerSearch] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    if (selectedFiles.some((selected) => selected.size > 20 * 1024 * 1024)) {
      alert("One or more files are too large. Max 20MB allowed.");
      return;
    }

    setFiles(selectedFiles);
    const url = URL.createObjectURL(selectedFiles[0]);
    setPreviewUrl(url);
    setMediaType(selectedFiles[0].type.startsWith('video/') ? 'video' : 'image');
  };

  const handleTransformUpdate = useCallback((id: string, x: number, y: number) => {
    setOverlays(prev => prev.map(o => o.id === id ? { ...o, x, y } : o));
  }, []);

  const handleDragEnd = useCallback((id: string, x: number, y: number) => {
    setIsDraggingOverlay(false);
    // Trash bin threshold: near bottom center
    if (y > CANVAS_H - 100 && x > CANVAS_W / 2 - 60 && x < CANVAS_W / 2 + 60) {
      setOverlays(prev => prev.filter(o => o.id !== id));
    }
  }, []);

  const handleAddText = () => {
    if (!draftText.trim()) {
      setActiveTool('none');
      return;
    }
    setOverlays(prev => [...prev, {
      id: Date.now().toString(),
      type: 'text',
      content: draftText,
      color: draftColor,
      fontFamily: draftFont,
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      scale: 1
    }]);
    setDraftText('');
    setActiveTool('none');
  };

  const handleAddSticker = (emoji: string) => {
    setOverlays(prev => [...prev, {
      id: Date.now().toString(),
      type: 'sticker',
      content: emoji,
      x: CANVAS_W / 2,
      y: CANVAS_H / 2,
      scale: 1
    }]);
    setActiveTool('none');
    setStickerSearch('');
  };

  const handleUpload = async () => {
    if (files.length === 0 || !currentUser) return;
    setIsUploading(true);

    try {
      const mappedOverlays = overlays.map(o => ({
        ...o,
        x: (o.x / CANVAS_W) * 100,
        y: (o.y / CANVAS_H) * 100,
      }));

      const finalFiltersData = JSON.stringify({
        cssFilter: activeFilter,
        frame: frameSettings
      });

      await Promise.all(
        files.map(async (file) => {
          const url = await DbService.uploadStoryMedia(currentUser.uid, file);
          await DbService.addStory(currentUser.uid, {
            mediaUrl: url,
            mediaType: file.type.startsWith('video/') ? 'video' : 'image',
            filters: finalFiltersData,
            stickers: mappedOverlays.length > 0 ? JSON.stringify(mappedOverlays) : undefined
          });
        })
      );

      onStoryAdded();
    } catch (err) {
      console.error('Failed to upload story:', err);
      alert('Failed to upload story. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredEmojis = stickerSearch 
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => e.includes(stickerSearch)) // basic search won't work well on emojis natively without metadata, but it's okay for UI demo, maybe just show all if search is typed. We'll simulate search by showing all categories.
    : null;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] bg-black sm:bg-black/90 flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-50">
        <button onClick={onClose} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors drop-shadow-md">
          <X className="w-6 h-6" />
        </button>
        
        {previewUrl && activeTool === 'none' && (
          <div className="flex items-center gap-2">
            <button onClick={() => setActiveTool('text')} className="p-2 text-white hover:bg-white/10 rounded-full drop-shadow-md"><TypeIcon className="w-6 h-6" /></button>
            <button onClick={() => setActiveTool('stickers')} className="p-2 text-white hover:bg-white/10 rounded-full drop-shadow-md"><Smile className="w-6 h-6" /></button>
            {mediaType === 'image' && (
              <>
                <button onClick={() => setActiveTool('filters')} className="p-2 text-white hover:bg-white/10 rounded-full drop-shadow-md"><Sliders className="w-6 h-6" /></button>
                <button onClick={() => setActiveTool('frame')} className="p-2 text-white hover:bg-white/10 rounded-full drop-shadow-md"><Square className="w-6 h-6" /></button>
              </>
            )}
          </div>
        )}
      </div>

      {!previewUrl ? (
        <div className="flex flex-col items-center gap-4 p-8 text-center max-w-sm">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center text-white/50">
            <ImageIcon className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Create Story</h3>
            <p className="text-white/50 text-sm mt-1">Upload a photo or video to begin editing.</p>
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-full transition-colors shadow-lg shadow-primary/20"
          >
            Select Media
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" multiple onChange={handleFileSelect} />
        </div>
      ) : (
        <div 
          ref={canvasRef}
          style={{ width: CANVAS_W, height: CANVAS_H }}
          className="relative bg-zinc-950 shrink-0 overflow-hidden shadow-2xl rounded-2xl md:rounded-3xl flex items-center justify-center"
        >
          {/* Media Layer with Frame Settings */}
          <div 
            className="absolute inset-0 transition-all duration-300"
            style={{ 
              padding: `${frameSettings.padding}px`,
              backgroundColor: frameSettings.bgColor
            }}
          >
            <div 
              className="w-full h-full overflow-hidden transition-all duration-300 relative"
              style={{ borderRadius: `${frameSettings.radius}px` }}
            >
              {mediaType === 'image' ? (
                <img src={previewUrl} className="absolute inset-0 w-full h-full object-cover" style={{ filter: activeFilter }} alt="Preview" />
              ) : (
                <video src={previewUrl} className="absolute inset-0 w-full h-full object-cover" style={{ filter: activeFilter }} autoPlay loop muted playsInline />
              )}
            </div>
          </div>

          {/* Overlays Layer */}
          {activeTool !== 'text' && overlays.map(item => (
            <DraggableOverlay 
              key={item.id} 
              item={item} 
              onTransformUpdate={handleTransformUpdate} 
              onDragStart={() => setIsDraggingOverlay(true)}
              onDragEnd={handleDragEnd}
            />
          ))}

          {/* Trash Bin */}
          <AnimatePresence>
            {isDraggingOverlay && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.8 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 w-16 h-16 rounded-full bg-red-500/80 backdrop-blur-md flex items-center justify-center border-2 border-red-400 shadow-2xl shadow-red-500/50"
              >
                <Trash2 className="w-8 h-8 text-white animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Overlay Tools */}
          <AnimatePresence>
            {activeTool === 'text' && (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/80 z-40 flex flex-col"
              >
                <div className="flex-1 flex flex-col items-center justify-center p-4">
                   <textarea
                     autoFocus
                     value={draftText}
                     onChange={e => setDraftText(e.target.value)}
                     placeholder="Type something..."
                     className="w-full bg-transparent text-center resize-none focus:outline-none placeholder:text-white/30"
                     style={{ 
                       color: draftColor, 
                       fontFamily: draftFont,
                       fontSize: '2.5rem',
                       fontWeight: 'bold',
                       textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                     }}
                   />
                </div>
                
                <div className="p-4 space-y-4">
                   <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                     {FONTS.map(f => (
                       <button key={f.name} onClick={() => setDraftFont(f.value)} className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${draftFont === f.value ? 'bg-white text-black' : 'bg-white/20 text-white'}`} style={{ fontFamily: f.value }}>
                         {f.name}
                       </button>
                     ))}
                   </div>
                   <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                     {COLORS.map(c => (
                       <button key={c} onClick={() => setDraftColor(c)} className={`w-8 h-8 rounded-full shrink-0 border-2 ${draftColor === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                     ))}
                   </div>
                   <button onClick={handleAddText} className="w-full py-3 bg-white text-black font-bold rounded-xl mt-2">Done</button>
                </div>
              </motion.div>
            )}

            {activeTool === 'stickers' && (
              <motion.div 
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                className="absolute inset-x-0 bottom-0 h-[60%] bg-zinc-900 rounded-t-3xl z-40 flex flex-col shadow-2xl"
              >
                <div className="p-4 border-b border-white/10">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold">Stickers</h3>
                    <button onClick={() => setActiveTool('none')} className="text-white/50"><X className="w-5 h-5"/></button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                  {EMOJI_CATEGORIES.map(cat => (
                    <div key={cat.name}>
                      <h4 className="text-white/50 text-xs font-bold uppercase mb-3">{cat.name}</h4>
                      <div className="grid grid-cols-5 gap-3">
                        {cat.emojis.map(e => (
                          <button key={e} onClick={() => handleAddSticker(e)} className="text-3xl hover:scale-125 transition-transform flex items-center justify-center h-12">
                            {e}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTool === 'filters' && (
              <motion.div 
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                className="absolute inset-x-0 bottom-0 bg-zinc-900/90 backdrop-blur-md rounded-t-3xl z-40 p-4 border-t border-white/10"
              >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-bold">Filters</h3>
                    <button onClick={() => setActiveTool('none')} className="text-white/50"><X className="w-5 h-5"/></button>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {FILTERS.map(f => (
                    <button key={f.name} onClick={() => setActiveFilter(f.value)} className="flex flex-col items-center gap-2 shrink-0">
                      <div className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${activeFilter === f.value ? 'border-primary scale-105' : 'border-transparent'}`}>
                        <img src={previewUrl!} className="w-full h-full object-cover" style={{ filter: f.value }} alt="" />
                      </div>
                      <span className="text-[10px] font-bold text-white/70">{f.name}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTool === 'frame' && (
              <motion.div 
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                className="absolute inset-x-0 bottom-0 bg-zinc-900/90 backdrop-blur-md rounded-t-3xl z-40 p-6 space-y-6 border-t border-white/10"
              >
                 <div className="flex justify-between items-center">
                    <h3 className="text-white font-bold">Frame</h3>
                    <button onClick={() => setActiveTool('none')} className="bg-white text-black px-4 py-1.5 rounded-full text-sm font-bold">Done</button>
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-white/50 uppercase">Padding</label>
                    <input type="range" min="0" max="100" value={frameSettings.padding} onChange={e => setFrameSettings(p => ({ ...p, padding: parseInt(e.target.value) }))} className="w-full accent-white" />
                 </div>
                 
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-white/50 uppercase">Radius</label>
                    <input type="range" min="0" max="180" value={frameSettings.radius} onChange={e => setFrameSettings(p => ({ ...p, radius: parseInt(e.target.value) }))} className="w-full accent-white" />
                 </div>

                 <div className="space-y-2">
                    <label className="text-xs font-bold text-white/50 uppercase">Background Color</label>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                       {COLORS.map(c => (
                         <button key={c} onClick={() => setFrameSettings(p => ({ ...p, bgColor: c }))} className={`w-8 h-8 rounded-full shrink-0 border-2 ${frameSettings.bgColor === c ? 'border-primary' : 'border-white/20'}`} style={{ backgroundColor: c }} />
                       ))}
                    </div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>

          {files.length > 1 && (
            <div className="absolute bottom-4 left-4 z-30 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md">
              {files.length} stories selected
            </div>
          )}
        </div>
      )}

      {/* Upload Button */}
      {previewUrl && activeTool === 'none' && (
         <div className="absolute bottom-6 right-6 sm:bottom-10 sm:right-auto sm:mt-6 z-50">
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="flex items-center gap-2 bg-white text-black font-black uppercase tracking-widest text-sm py-3.5 px-6 rounded-full hover:scale-105 transition-all shadow-xl disabled:opacity-50"
            >
              {isUploading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Uploading...</>
              ) : (
                <>Post Story <Check className="w-5 h-5" /></>
              )}
            </button>
         </div>
      )}
    </motion.div>
  );
}
