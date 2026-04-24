import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ShieldCheck, CreditCard, 
  Lock, ArrowRight, CheckCircle,
  Lightning, CircleNotch, Info
} from '@phosphor-icons/react';
import { toast } from 'sonner';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  planName: string;
  amount: string;
  billingCycle: string;
}

export function PaymentModal({ isOpen, onClose, onSuccess, planName, amount, billingCycle }: PaymentModalProps) {
  const [step, setStep] = useState<'details' | 'processing' | 'success'>('details');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  const handlePay = () => {
    setStep('processing');
    setTimeout(() => {
      setStep('success');
      toast.success("Transaction Successful!");
      setTimeout(() => {
        onSuccess();
        onClose();
        // Reset for next time
        setTimeout(() => setStep('details'), 500);
      }, 2000);
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Content */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md bg-card border border-border rounded-[2.5rem] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <ShieldCheck size={24} weight="duotone" />
              </div>
              <span className="text-sm font-black uppercase tracking-widest text-foreground">Secure Checkout</span>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-2">
              <X size={24} />
            </button>
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
              {step === 'details' && (
                <motion.div 
                  key="details"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-6"
                >
                  {/* Plan Summary */}
                  <div className="bg-muted p-6 rounded-3xl border border-border">
                     <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Selected Plan</span>
                     <div className="flex items-center justify-between mt-1">
                        <h3 className="text-xl font-black text-foreground">{planName} <span className="text-primary italic">{billingCycle}</span></h3>
                        <span className="text-2xl font-black text-foreground">{amount}</span>
                     </div>
                  </div>

                  {/* Card Simulation */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Card Number</label>
                       <div className="relative">
                          <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
                          <input 
                            type="text" 
                            placeholder="4242 4242 4242 4242"
                            value={cardNumber}
                            onChange={(e) => setCardNumber(e.target.value)}
                            className="w-full h-14 bg-muted border border-border rounded-2xl pl-12 pr-4 text-sm font-bold focus:border-primary outline-none transition-all"
                          />
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Expiry Date</label>
                          <input 
                            type="text" 
                            placeholder="MM/YY"
                            value={expiry}
                            onChange={(e) => setExpiry(e.target.value)}
                            className="w-full h-14 bg-muted border border-border rounded-2xl px-4 text-sm font-bold focus:border-primary outline-none transition-all"
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">CVV</label>
                          <div className="relative">
                             <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                             <input 
                               type="password" 
                               placeholder="***"
                               maxLength={3}
                               value={cvv}
                               onChange={(e) => setCvv(e.target.value)}
                               className="w-full h-14 bg-muted border border-border rounded-2xl pl-11 pr-4 text-sm font-bold focus:border-primary outline-none transition-all"
                             />
                          </div>
                       </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex gap-3">
                     <Info size={18} className="text-primary shrink-0" />
                     <p className="text-[10px] font-medium text-primary leading-relaxed">
                        This is a secure mock payment. No real funds will be deducted from your account. Enjoy your premium experience!
                     </p>
                  </div>

                  <button 
                    onClick={handlePay}
                    disabled={!cardNumber || !expiry || !cvv}
                    className="w-full h-16 bg-primary text-white rounded-[1.5rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                  >
                    Pay & Unlock {planName}
                    <ArrowRight weight="bold" />
                  </button>
                </motion.div>
              )}

              {step === 'processing' && (
                <motion.div 
                  key="processing"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="py-12 flex flex-col items-center text-center space-y-6"
                >
                  <div className="relative">
                    <CircleNotch size={80} className="text-primary animate-spin" weight="thin" />
                    <Lightning size={32} className="absolute inset-0 m-auto text-primary animate-pulse" weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-foreground italic">Verifying Payment</h3>
                    <p className="text-sm text-muted-foreground font-medium">Securing your EduNook account...</p>
                  </div>
                </motion.div>
              )}

              {step === 'success' && (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="py-12 flex flex-col items-center text-center space-y-6"
                >
                   <div className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                      <CheckCircle size={56} weight="duotone" />
                   </div>
                   <div>
                      <h3 className="text-3xl font-black text-foreground italic">Welcome to {planName}!</h3>
                      <p className="text-sm text-muted-foreground font-medium px-8 leading-relaxed mt-2">
                        Your transaction was successful. All premium benefits are now active on your profile.
                      </p>
                   </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
