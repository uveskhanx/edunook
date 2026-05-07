import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShieldCheck, ArrowRight, CheckCircle,
  Lightning, CircleNotch, Info
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import {
  createEdgeSubscription,
  loadRazorpayCheckout,
  RazorpaySubscriptionResponse,
  verifyEdgeSubscription,
} from '@/lib/razorpay-client';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  planName: string;
  amount: string;
  billingCycle: 'monthly' | 'yearly';
}

export function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  userEmail,
  userName,
  planName,
  amount,
  billingCycle,
}: PaymentModalProps) {
  const [step, setStep] = useState<'details' | 'processing' | 'success'>('details');

  const resetAndClose = () => {
    onClose();
    setTimeout(() => setStep('details'), 250);
  };

  const handlePay = async () => {
    if (!userId) {
      toast.error('Please sign in before paying.');
      return;
    }

    setStep('processing');
    const toastId = toast.loading('Creating secure subscription...');

    try {
      const [subscription, loaded] = await Promise.all([
        createEdgeSubscription(userId, billingCycle),
        loadRazorpayCheckout(),
      ]);

      if (!loaded || !window.Razorpay) {
        throw new Error('Razorpay Checkout could not be loaded.');
      }

      toast.loading('Opening Razorpay Checkout...', { id: toastId });

      await new Promise<void>((resolve, reject) => {
        const razorpay = new window.Razorpay!({
          key: subscription.key_id,
          subscription_id: subscription.subscription_id,
          name: 'EduNook',
          description: `${planName} ${billingCycle} subscription`,
          image: '/logo.png',
          prefill: {
            name: userName || '',
            email: userEmail || '',
          },
          theme: { color: '#6366f1' },
          handler: async (response: RazorpaySubscriptionResponse) => {
            try {
              toast.loading('Verifying subscription...', { id: toastId });
              await verifyEdgeSubscription({
                user_id: userId,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment was cancelled.')),
          },
        });
        razorpay.open();
      });

      setStep('success');
      toast.success('Subscription activated!', { id: toastId });
      setTimeout(() => {
        onSuccess();
        resetAndClose();
      }, 1500);
    } catch (err) {
      setStep('details');
      toast.error(err instanceof Error ? err.message : 'Subscription payment failed.', { id: toastId });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={step === 'processing' ? undefined : resetAndClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-border bg-card shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <ShieldCheck size={24} weight="duotone" />
              </div>
              <span className="text-sm font-black uppercase tracking-widest text-foreground">Razorpay Checkout</span>
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              disabled={step === 'processing'}
              className="p-2 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
              aria-label="Close checkout"
            >
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
                  <div className="rounded-3xl border border-border bg-muted p-6">
                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground opacity-70">Selected Plan</span>
                    <div className="mt-2 flex items-center justify-between gap-4">
                      <h3 className="text-xl font-black text-foreground">
                        {planName} <span className="text-primary italic">{billingCycle}</span>
                      </h3>
                      <span className="text-2xl font-black text-foreground">{amount}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 rounded-2xl border border-primary/10 bg-primary/5 p-4">
                    <Info size={18} className="shrink-0 text-primary" />
                    <p className="text-[11px] font-medium leading-relaxed text-primary">
                      EduNook Edge subscriptions are processed by Razorpay. No split transfer is created for this plan; it goes fully to the platform.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handlePay}
                    className="flex h-16 w-full items-center justify-center gap-2 rounded-[1.5rem] bg-primary text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    Pay with Razorpay
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
                  className="flex flex-col items-center space-y-6 py-12 text-center"
                >
                  <div className="relative">
                    <CircleNotch size={80} className="animate-spin text-primary" weight="thin" />
                    <Lightning size={32} className="absolute inset-0 m-auto animate-pulse text-primary" weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-foreground italic">Verifying Payment</h3>
                    <p className="text-sm font-medium text-muted-foreground">Waiting for secure Razorpay confirmation...</p>
                  </div>
                </motion.div>
              )}

              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center space-y-6 py-12 text-center"
                >
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                    <CheckCircle size={56} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-foreground italic">Welcome to {planName}!</h3>
                    <p className="mt-2 px-8 text-sm font-medium leading-relaxed text-muted-foreground">
                      Your payment was verified and premium benefits are active.
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
