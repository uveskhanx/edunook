import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, Flag, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { DbService } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { sendFeedbackEmailAction } from '@/lib/server/email-actions';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: string;
  targetType: 'user' | 'course' | 'chat';
  targetName: string;
}

const REASONS = [
  { id: 'abusing', label: 'Abusive Behavior', icon: ShieldAlert, color: 'text-rose-500' },
  { id: 'violation', label: 'Community Violation', icon: Flag, color: 'text-amber-500' },
  { id: 'spam', label: 'Spam or Scam', icon: MessageSquare, color: 'text-blue-500' },
  { id: 'inappropriate', label: 'Inappropriate Content', icon: AlertCircle, color: 'text-orange-500' },
  { id: 'private', label: 'Private Issue', icon: ShieldAlert, color: 'text-purple-500' },
  { id: 'other', label: 'Other Issues', icon: AlertCircle, color: 'text-slate-500' }
];

export function ReportModal({ isOpen, onClose, targetId, targetType, targetName }: ReportModalProps) {
  const { user, dbUser } = useAuth();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) return toast.error("Please select a primary reason.");
    if (!user) return toast.error("Authentication required.");
    
    setIsSubmitting(true);
    try {
      const reportMessage = `[SECURITY REPORT]
Target: ${targetName} (${targetId})
Type: ${targetType.toUpperCase()}
Reason: ${selectedReason}
Description: ${description}
Timestamp: ${new Date().toLocaleString()}`;

      const data = { 
        email: user.email || 'unknown@edunook.com', 
        type: 'Account Report', 
        message: reportMessage, 
        username: dbUser?.username || 'student',
        userId: user.id
      };

      try {
        const edunookUid = await DbService.getUidByUsername('edunook');
        if (!edunookUid) {
          throw new Error('Admin account @edunook was not found.');
        }

        const chatId = await DbService.getOrCreateChat(user.id, edunookUid);
        const messageId = await DbService.sendMessage(chatId, user.id, `[SYSTEM SIGNAL: Account Report]\n${reportMessage}`);
        await DbService.deleteMessageForMe(user.id, chatId, messageId);
      } catch (chatErr) {
        console.warn('Direct account report delivery failed; falling back to server route:', chatErr);
        await sendFeedbackEmailAction({ data });
      }
      
      setIsSuccess(true);
      toast.success("Intelligence Report Filed Successfully.");
      setTimeout(() => {
        onClose();
        setIsSuccess(false);
        setSelectedReason('');
        setDescription('');
      }, 2000);
    } catch (err) {
      toast.error("Signal Transmission Failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />
          
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-card border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            {isSuccess ? (
              <div className="p-12 text-center space-y-6">
                <div className="w-24 h-24 bg-success/20 rounded-full flex items-center justify-center mx-auto border border-success/40 shadow-[0_0_50px_rgba(var(--success-rgb),0.3)]">
                  <CheckCircle2 className="w-12 h-12 text-success" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Report Encrypted</h3>
                  <p className="text-muted-foreground text-sm font-medium">Our moderation intelligence has received your signal. We will investigate the target immediately.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-rose-500/20 rounded-2xl flex items-center justify-center border border-rose-500/40">
                      <ShieldAlert className="w-6 h-6 text-rose-500" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white uppercase tracking-tight">Security Incident</h2>
                      <p className="text-[10px] font-black text-rose-500/60 uppercase tracking-widest">Reporting: {targetName}</p>
                    </div>
                  </div>
                  <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-all text-white/40 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto chat-scrollbar">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-1">Select Reason</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {REASONS.map(reason => {
                        const Icon = reason.icon;
                        const isSelected = selectedReason === reason.id;
                        return (
                          <button
                            key={reason.id}
                            onClick={() => setSelectedReason(reason.id)}
                            className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${
                              isSelected 
                                ? 'bg-white/10 border-white/20 shadow-xl' 
                                : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                              isSelected ? 'bg-white text-black' : 'bg-white/5 border-white/5 group-hover:bg-white/10'
                            }`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <span className={`text-xs font-bold uppercase tracking-tight ${isSelected ? 'text-white' : 'text-white/60'}`}>
                              {reason.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-1">Additional Intelligence</label>
                    <textarea 
                      placeholder="Describe the incident in your own words for our auditors..."
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      className="w-full h-32 bg-white/[0.03] border border-white/5 rounded-2xl p-5 text-sm text-white focus:outline-none focus:border-white/20 transition-all resize-none placeholder:text-white/10 font-medium"
                    />
                  </div>
                </div>

                <div className="p-8 bg-white/[0.02] border-t border-white/5 flex gap-4">
                  <button 
                    onClick={onClose}
                    className="flex-1 py-4 bg-white/5 text-white/60 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    Cancel Signal
                  </button>
                  <button 
                    disabled={isSubmitting || !selectedReason}
                    onClick={handleSubmit}
                    className="flex-[2] py-4 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-rose-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 disabled:scale-100 flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "File Formal Report"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function Loader2(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
