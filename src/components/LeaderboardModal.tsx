/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Clock, User, Zap, Loader2, X as CloseIcon, XCircle, Award, Target, Star, ChevronUp, Medal } from 'lucide-react';
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
      try {
        const unsubscribe = DbService.subscribeToLeaderboard(test.id, (data, err) => {
          if (err) {
            setError(err);
          } else {
            setRankings(data);
          }
          setLoading(false);
        });
        return () => unsubscribe();
      } catch (err) {
        console.error('[Leaderboard] Subscription error:', err);
        setError(err);
        setLoading(false);
      }
    }
  }, [test]);

  // Find user's own rank
  const myRankData = useMemo(() => {
    if (!user || rankings.length === 0) return null;
    const idx = rankings.findIndex(r => r.uid === user.id);
    if (idx === -1) return null;
    return { ...rankings[idx], rank: idx + 1 };
  }, [user, rankings]);

  if (!test) return null;

  const resultsPending = test?.resultAnnounceAt && test.resultAnnounceAt !== 'immediate' && new Date(test.resultAnnounceAt) > new Date();

  return (
    <Dialog open={!!test} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#050505] border-white/10 rounded-[3rem] p-0 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-primary animate-gradient-x" />
        
        <div className="p-8 md:p-12">
            <DialogHeader className="space-y-6 mb-10">
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                     <div className="w-16 h-16 md:w-20 md:h-20 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center border border-primary/20 shadow-2xl">
                        <Trophy className="w-8 h-8 md:w-10 md:h-10" />
                     </div>
                     <div className="text-left">
                        <DialogTitle className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter leading-none mb-2">Hall of Fame</DialogTitle>
                        <DialogDescription className="text-white/30 font-black uppercase text-[10px] tracking-[0.3em] flex items-center gap-2">
                           <Target className="w-3 h-3 text-primary" /> {test.title} Arena
                        </DialogDescription>
                     </div>
                  </div>
                  <button onClick={onClose} className="p-4 hover:bg-white/5 rounded-2xl transition-all text-white/20 hover:text-white"><CloseIcon className="w-6 h-6" /></button>
              </div>
            </DialogHeader>

            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-4 custom-scrollbar relative">
              {error ? (
                <div className="py-24 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-8 border border-rose-500/20 shadow-2xl"><XCircle className="w-10 h-10 text-rose-500" /></div>
                  <h3 className="text-2xl font-black text-white mb-3 tracking-tighter uppercase">Security Guard Active</h3>
                  <p className="text-sm font-bold text-white/40 max-w-[320px] leading-relaxed">This leaderboard is protected by end-to-end encryption. Complete the assessment to view standings.</p>
                </div>
              ) : resultsPending ? (
                <div className="py-24 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mb-8 border border-amber-500/20"><Clock className="w-10 h-10 text-amber-500 animate-pulse" /></div>
                  <h3 className="text-2xl font-black text-white mb-3 tracking-tighter uppercase">Sanctuary of Silence</h3>
                  <p className="text-sm font-bold text-white/40 max-w-[300px] leading-relaxed">The competitive standings are currently locked. Results will be unveiled on <br/><span className="text-primary mt-2 block">{new Date(test.resultAnnounceAt!).toLocaleString()}</span></p>
                </div>
              ) : loading ? (
                <div className="py-32 flex flex-col items-center justify-center gap-6">
                   <div className="relative"><Loader2 className="w-16 h-16 animate-spin text-primary" /><div className="absolute inset-0 bg-primary/20 blur-2xl animate-pulse" /></div>
                   <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em]">Synchronizing Standings...</p>
                </div>
              ) : rankings.length > 0 ? (
                <div className="space-y-4">
                  {rankings.map((rank, index) => (
                    <motion.div 
                      key={rank.uid || index}
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
                      className={`flex items-center justify-between p-6 rounded-[2.5rem] border transition-all duration-500 group relative overflow-hidden ${
                        index === 0 ? 'bg-gradient-to-r from-amber-500/10 to-transparent border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.1)]' : 
                        index === 1 ? 'bg-gradient-to-r from-slate-400/10 to-transparent border-slate-400/30' : 
                        index === 2 ? 'bg-gradient-to-r from-orange-800/20 to-transparent border-orange-800/30' : 
                        rank.uid === user?.id ? 'bg-primary/10 border-primary/40' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                      }`}
                    >
                      {index < 3 && <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-white/5 to-transparent -translate-y-1/2 translate-x-1/2 rounded-full blur-2xl" />}
                      
                      <div className="flex items-center gap-6">
                         <div className="w-12 flex flex-col items-center shrink-0">
                            {index === 0 ? <Medal className="w-8 h-8 text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" /> : 
                             index === 1 ? <Medal className="w-8 h-8 text-slate-300" /> : 
                             index === 2 ? <Medal className="w-8 h-8 text-orange-700" /> : 
                             <span className="text-xl font-black text-white/20 tabular-nums tracking-tighter">#{index + 1}</span>}
                         </div>
                         <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-[1.25rem] bg-black border border-white/10 flex items-center justify-center font-black text-2xl border-white/10 overflow-hidden relative group-hover:scale-105 transition-transform">
                              {rank.avatar ? <img src={rank.avatar} className="w-full h-full object-cover" alt="" /> : <User className="w-6 h-6 text-white/20" />}
                              {rank.uid === user?.id && <div className="absolute inset-0 border-2 border-primary rounded-[1.25rem] z-10 animate-pulse" />}
                            </div>
                            <div>
                              <p className={`font-black text-lg tracking-tight truncate max-w-[150px] md:max-w-[220px] ${rank.uid === user?.id ? 'text-primary' : 'text-white'}`}>{rank.name} {rank.uid === user?.id && '(You)'}</p>
                              <div className="flex items-center gap-3 mt-1">
                                 <span className="text-[9px] font-black text-white/20 uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-3 h-3" /> {rank.timeTaken}s</span>
                                 <div className="w-1 h-1 rounded-full bg-white/10" />
                                 <span className="text-[9px] font-black text-white/20 uppercase tracking-widest flex items-center gap-1.5"><Star className="w-3 h-3 text-primary/40" /> Rank Mastery</span>
                              </div>
                            </div>
                         </div>
                      </div>
                      <div className="text-right shrink-0">
                         <p className={`text-3xl font-black tabular-nums tracking-tighter ${index === 0 ? 'text-amber-400' : 'text-white'}`}>{rank.score}<span className="text-sm opacity-30 ml-0.5">%</span></p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-32 text-center opacity-20 flex flex-col items-center gap-6">
                   <Zap className="w-20 h-20 text-primary animate-pulse" />
                   <div className="space-y-2">
                      <p className="text-sm font-black uppercase tracking-[0.4em]">Standings Initializing</p>
                      <p className="text-[10px] font-bold">The arena is waiting for its first contender.</p>
                   </div>
                </div>
              )}
            </div>

            {/* Persistent Personal Rank Footer */}
            {myRankData && myRankData.rank > 10 && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-8 p-6 bg-primary/10 border border-primary/30 rounded-[2.5rem] flex items-center justify-between shadow-2xl">
                  <div className="flex items-center gap-5">
                      <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center font-black text-sm">#{myRankData.rank}</div>
                      <div>
                         <p className="text-sm font-black text-white uppercase tracking-tight">Your Global Standing</p>
                         <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">Outperforming {Math.max(0, rankings.length - myRankData.rank)} Learners</p>
                      </div>
                  </div>
                  <div className="text-right">
                      <p className="text-2xl font-black text-white tracking-tighter">{myRankData.score}%</p>
                  </div>
              </motion.div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 mt-10">
                <button onClick={onClose} className="flex-1 py-6 rounded-[2rem] bg-white text-black font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl hover:scale-[1.02] active:scale-95 transition-all">Dismiss Standing</button>
                <button className="flex-1 py-6 rounded-[2rem] bg-white/5 border border-white/10 text-white/60 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 transition-all">Global Report</button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
