/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, User, Zap, Loader2, X as CloseIcon, Award, Target, Medal, CheckCircle2 } from 'lucide-react';
import { DbService, TestRow } from '@/lib/db-service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';

interface LeaderboardModalProps {
  test: TestRow | null;
  onClose: () => void;
}

export function LeaderboardModal({ test, onClose }: LeaderboardModalProps) {
  const { user } = useAuth();
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (test) {
      setLoading(true);
      setError(null);
      
      const unsubscribe = DbService.subscribeToLeaderboard(test.id, (data, err) => {
        if (err) {
          setError(err);
        } else {
          setRankings(data);
        }
        setLoading(false);
      }, test.slug);

      return () => unsubscribe();
    }
  }, [test]);

  const myRankData = useMemo(() => {
    if (!user || rankings.length === 0) return null;
    const idx = rankings.findIndex(r => r.uid === user.id);
    if (idx === -1) return null;
    return { ...rankings[idx], rank: idx + 1 };
  }, [user, rankings]);

  if (!test) return null;

  const resultsPending = test?.resultAnnounceAt && test.resultAnnounceAt !== 'immediate' && new Date(test.resultAnnounceAt) > new Date();
  const theme = getThemeConfig(test?.theme);

  return (
    <Dialog open={!!test} onOpenChange={onClose}>
      <DialogContent className={`max-w-2xl ${theme.bg} border-white/10 rounded-[3rem] p-0 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]`}>
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${theme.gradient} animate-gradient-x`} />
        
        <div className="p-8 md:p-12">
            <DialogHeader className="space-y-6 mb-10">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                     <div className={`w-12 h-12 md:w-16 md:h-16 ${theme.bgPrimarySoft} ${theme.textPrimary} rounded-2xl flex items-center justify-center border ${theme.borderPrimarySoft} shadow-xl`}>
                        <Trophy className="w-6 h-6 md:w-8 h-8" />
                     </div>
                      <div className="text-left">
                        <DialogTitle className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter leading-none mb-1">Hall of Fame</DialogTitle>
                        <DialogDescription className="text-white/30 font-bold uppercase text-[8px] tracking-[0.2em] flex items-center gap-1.5">
                           <Target className={`w-2.5 h-2.5 ${theme.textPrimary}`} /> {test.title} Arena
                        </DialogDescription>
                      </div>
                  </div>
                  <button onClick={onClose} className="p-4 hover:bg-white/5 rounded-2xl transition-all text-white/20 hover:text-white"><CloseIcon className="w-6 h-6" /></button>
              </div>
            </DialogHeader>

            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-4 custom-scrollbar relative">
              {resultsPending ? (
                <div className="py-24 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-8 border border-amber-500/20"><Clock className="w-10 h-10 text-amber-500 animate-pulse" /></div>
                  <h3 className="text-2xl font-black text-white mb-3 tracking-tighter uppercase">Standings Locked</h3>
                  <p className="text-sm font-bold text-white/40 max-w-[300px] leading-relaxed">The competitive standings are currently under review. Results will be unveiled on <br/><span className={`${theme.textPrimary} mt-2 block`}>{new Date(test.resultAnnounceAt!).toLocaleString()}</span></p>
                </div>
              ) : loading ? (
                <div className="py-32 flex flex-col items-center justify-center gap-6">
                   <div className="relative"><Loader2 className={`w-16 h-16 animate-spin ${theme.textPrimary}`} /><div className={`absolute inset-0 ${theme.bgPrimarySoft} blur-2xl animate-pulse`} /></div>
                   <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Synchronizing Standings...</p>
                </div>
              ) : rankings.length > 0 ? (
                <div className="space-y-4">
                  {rankings.map((rank, index) => (
                    <motion.div 
                      key={rank.uid || index}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                       className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 group relative overflow-hidden ${
                        index === 0 ? 'bg-amber-500/5 border-amber-500/20' : 
                        index === 1 ? 'bg-slate-400/5 border-slate-400/20' : 
                        index === 2 ? 'bg-orange-800/10 border-orange-800/20' : 
                        rank.uid === user?.id ? `${theme.bgPrimarySoft} ${theme.borderPrimarySoft}` : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]'
                      }`}
                    >
                      {index < 3 && <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent -translate-y-1/2 translate-x-1/2 rounded-full blur-2xl" />}
                      
                      <div className="flex items-center gap-5 relative z-10">
                        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center text-lg font-black transition-all ${
                          index === 0 ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 
                          index === 1 ? 'bg-slate-400 text-black shadow-lg shadow-slate-400/20' : 
                          index === 2 ? 'bg-orange-800 text-white shadow-lg shadow-orange-800/20' : 
                          'bg-white/5 text-white/30 group-hover:text-white'
                        }`}>
                          {index < 3 ? <Medal className="w-5 h-5 md:w-6 h-6" /> : index + 1}
                        </div>
                        
                        <div className="flex flex-col min-w-0">
                           <div className="flex items-center gap-2">
                             <span className={`text-base font-black tracking-tight truncate ${rank.uid === user?.id ? 'text-white' : 'text-white/80'}`}>{rank.name}</span>
                             {rank.uid === user?.id && <span className={`px-2 py-0.5 ${theme.bgPrimarySoft} ${theme.textPrimary} text-[7px] font-black uppercase rounded-full tracking-widest border ${theme.borderPrimarySoft}`}>You</span>}
                           </div>
                           <span className="text-[9px] font-bold text-white/30 uppercase tracking-[0.1em] flex items-center gap-2">
                             <Clock className="w-2.5 h-2.5" /> {rank.timeTaken}s • Accuracy: {rank.score}%
                           </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end relative z-10 shrink-0">
                        <span className={`text-2xl font-black tabular-nums tracking-tighter ${
                          index === 0 ? 'text-amber-500' : 
                          index === 1 ? 'text-slate-400' : 
                          index === 2 ? 'text-orange-800' : 
                          'text-white'
                        }`}>{rank.score}</span>
                        <span className="text-[7px] font-black text-white/20 uppercase tracking-widest">Points</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-24 text-center space-y-6">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5"><User className="w-10 h-10 text-white/10" /></div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-white tracking-tighter uppercase">Arena Empty</h3>
                    <p className="text-xs font-bold text-white/20 uppercase tracking-widest">Be the first to leave your mark in this domain.</p>
                  </div>
                  <button 
                    onClick={() => { setLoading(true); DbService.subscribeToLeaderboard(test.id, (data) => { setRankings(data); setLoading(false); }, test.slug); }}
                    className={`px-8 py-4 ${theme.bgPrimarySoft} ${theme.textPrimary} border ${theme.borderPrimarySoft} rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all`}
                  >
                    Force Discovery Sync
                  </button>
                </div>
              )}
            </div>
            
            <div className="mt-10 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
               <div className="flex -space-x-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-[#050505] bg-white/5 flex items-center justify-center overflow-hidden">
                       <User className="w-5 h-5 text-white/20" />
                    </div>
                  ))}
                  <div className={`w-10 h-10 rounded-full border-2 border-[#050505] ${theme.primary} flex items-center justify-center text-[10px] font-black text-white`}>
                     +{Math.max(0, rankings.length - 3)}
                  </div>
               </div>
               <button 
                 onClick={onClose}
                 className="w-full md:w-auto px-12 py-5 bg-white text-black font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl"
               >
                 Close Protocol
               </button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const getThemeConfig = (themeName?: string) => {
  const themes: Record<string, any> = {
    dark: {
      bg: 'bg-[#050505]',
      primary: 'bg-primary',
      textPrimary: 'text-primary',
      accent: 'text-primary',
      groupHoverText: 'group-hover:text-primary',
      borderPrimary: 'border-primary',
      borderPrimarySoft: 'border-primary/20',
      bgPrimarySoft: 'bg-primary/10',
      gradient: 'from-primary via-indigo-500 to-primary',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.4)]',
      orb1: 'bg-primary/5',
      orb2: 'bg-indigo-500/5'
    },
    neon: {
      bg: 'bg-[#0f051a]',
      primary: 'bg-pink-500',
      textPrimary: 'text-pink-500',
      accent: 'text-pink-500',
      groupHoverText: 'group-hover:text-pink-500',
      borderPrimary: 'border-pink-500',
      borderPrimarySoft: 'border-pink-500/20',
      bgPrimarySoft: 'bg-pink-500/10',
      gradient: 'from-pink-500 via-cyan-400 to-pink-500',
      glow: 'shadow-[0_0_15px_rgba(236,72,153,0.4)]',
      orb1: 'bg-pink-500/10',
      orb2: 'bg-cyan-500/10'
    },
    emerald: {
      bg: 'bg-[#051a05]',
      primary: 'bg-emerald-500',
      textPrimary: 'text-emerald-500',
      accent: 'text-emerald-500',
      groupHoverText: 'group-hover:text-emerald-500',
      borderPrimary: 'border-emerald-500',
      borderPrimarySoft: 'border-emerald-500/20',
      bgPrimarySoft: 'bg-emerald-500/10',
      gradient: 'from-emerald-500 via-lime-400 to-emerald-500',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]',
      orb1: 'bg-emerald-500/10',
      orb2: 'bg-lime-500/10'
    },
    royal: {
      bg: 'bg-[#120a1a]',
      primary: 'bg-amber-500',
      textPrimary: 'text-amber-500',
      accent: 'text-amber-500',
      groupHoverText: 'group-hover:text-amber-500',
      borderPrimary: 'border-amber-500',
      borderPrimarySoft: 'border-amber-500/20',
      bgPrimarySoft: 'bg-amber-500/10',
      gradient: 'from-amber-500 via-yellow-400 to-amber-500',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',
      orb1: 'bg-amber-500/10',
      orb2: 'bg-yellow-500/10'
    },
    crimson: {
      bg: 'bg-[#1a0a0a]',
      primary: 'bg-rose-500',
      textPrimary: 'text-rose-500',
      accent: 'text-rose-500',
      groupHoverText: 'group-hover:text-rose-500',
      borderPrimary: 'border-rose-500',
      borderPrimarySoft: 'border-rose-500/20',
      bgPrimarySoft: 'bg-rose-500/10',
      gradient: 'from-rose-500 via-orange-400 to-rose-500',
      glow: 'shadow-[0_0_15px_rgba(244,63,94,0.4)]',
      orb1: 'bg-rose-500/10',
      orb2: 'bg-orange-500/10'
    }
  };
  return themes[themeName || 'dark'] || themes.dark;
};
