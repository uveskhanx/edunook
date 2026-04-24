import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { DbService, Subscription } from '@/lib/db-service';
import { Layout } from '@/components/Layout';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkle, ShootingStar, Crown, 
  CheckCircle, ArrowLeft, ArrowRight,
  ShieldCheck, Percent, Lightning
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { PaymentModal } from '@/components/Subscription/PaymentModal';

export const Route = createFileRoute('/subscription')({
  component: SubscriptionPage,
});

const PLANS = [
  {
    id: 'spark',
    name: 'Spark',
    icon: ShootingStar,
    description: 'Perfect for beginners starting their learning journey.',
    price: { monthly: 0, yearly: 0 },
    features: [
      'Access to all free courses',
      'Access to buy paid courses',
      'Community forums',
      'Standard support'
    ],
    color: 'from-blue-500 to-cyan-500',
    buttonText: 'Current Plan'
  },
  {
    id: 'edge',
    name: 'Edge',
    icon: Sparkle,
    description: 'Level up with exclusive perks and better visibility.',
    price: { monthly: 299, yearly: 2999 },
    features: [
      'Verified Blue Badge',
      '15% Course Discounts',
      'Priority visibility',
      'Early access to features',
      'Ad-free experience'
    ],
    highlight: 'Most Popular',
    color: 'from-primary to-accent',
    buttonText: 'Upgrade to Edge'
  },
  {
    id: 'elite',
    name: 'Elite',
    icon: Crown,
    description: 'The ultimate EduNook experience for serious learners.',
    price: { monthly: 399, yearly: 3500},
    features: [
      'Gold Premium Badge',
      '30% Maximum Discounts',
      '1-on-1 Priority Support',
      'All Edge features included',
      'Custom profile themes'
    ],
    highlight: 'Best Value',
    color: 'from-amber-400 to-orange-600',
    buttonText: 'Get Elite Access'
  }
];

function SubscriptionPage() {
  const { user, dbUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Payment Modal State
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (authLoading) return null;
  if (!user) {
    navigate({ to: '/login' });
    return null;
  }

  const currentPlan = dbUser?.subscription?.planId || 'spark';

  const handleSelectPlan = (plan: any) => {
    if (plan.id === currentPlan) return;
    if (plan.id === 'spark') {
      // Free plan - update directly
      confirmPlanUpdate(plan.id);
      return;
    }
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const confirmPlanUpdate = async (planId: string) => {
    setUpdating(planId);
    
    const { SubscriptionGuard } = await import('@/lib/subscription-guard');
    
    const newSub: Subscription = {
      planId: planId as any,
      billingCycle: billingCycle,
      status: 'active',
      subscribedAt: new Date().toISOString(),
      expiresAt: SubscriptionGuard.getExpirationDate(billingCycle),
      lastNotifiedDaysRemaining: 999 // Reset notification tracker
    };

    try {
      await DbService.updateSubscription(user.id, newSub);
      toast.success(`Welcome to EduNook ${planId.toUpperCase()}!`, {
        description: `Your ${billingCycle} plan is now active.`
      });
      setTimeout(() => navigate({ to: '/settings' }), 1500);
    } catch (err) {
      toast.error("Subscription failed. Please try again.");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <Layout showSettings={false}>
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-12 md:py-24">
        
        {/* Back Button */}
        <button 
          onClick={() => navigate({ to: '/settings' })}
          className="group mb-12 flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-black uppercase tracking-widest">Back to Settings</span>
        </button>

        {/* Header */}
        <div className="text-center mb-16 space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary text-xs font-black uppercase tracking-widest mb-4"
          >
            <ShieldCheck size={16} />
            Secure Billing
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-tight">
            Choose Your <span className="premium-gradient-text italic">Momentum.</span>
          </h1>
          <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto">
            Unlock premium learning tools, exclusive discounts, and a verified identity on EduNook.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-6 mb-16">
          <span className={`text-sm font-black uppercase tracking-widest transition-colors ${billingCycle === 'monthly' ? 'text-white' : 'text-muted-foreground'}`}>Monthly</span>
          <button 
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="w-16 h-8 bg-white/5 border border-white/10 rounded-full p-1 relative transition-colors hover:border-primary/50"
          >
             <motion.div 
               animate={{ x: billingCycle === 'yearly' ? 32 : 0 }}
               className="w-6 h-6 bg-primary rounded-full shadow-lg shadow-primary/20"
             />
          </button>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-black uppercase tracking-widest transition-colors ${billingCycle === 'yearly' ? 'text-white' : 'text-muted-foreground'}`}>Yearly</span>
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded-md border border-emerald-500/20">
              SAVE 30%
            </span>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PLANS.map((plan, idx) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={`relative flex flex-col p-8 rounded-[3rem] border transition-all duration-500 ${
                plan.highlight 
                  ? 'bg-white/[0.04] border-primary/30 shadow-2xl shadow-primary/5 scale-105 z-10' 
                  : 'bg-white/[0.02] border-white/5 hover:border-white/10'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-xl">
                  {plan.highlight}
                </div>
              )}

              <div className="mb-8">
                <div className={`w-16 h-16 rounded-3xl bg-gradient-to-br ${plan.color} p-0.5 mb-6`}>
                  <div className="w-full h-full bg-[#050505] rounded-[1.4rem] flex items-center justify-center text-white">
                      <plan.icon size={32} weight="duotone" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-black text-foreground mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm font-medium pr-4 leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                <div className="mb-10">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-foreground tracking-tighter">
                      ₹{billingCycle === 'monthly' ? plan.price.monthly : Math.round(plan.price.yearly / 12)}
                    </span>
                    <span className="text-muted-foreground font-bold italic">/mo</span>
                  </div>
                  {billingCycle === 'yearly' && plan.price.yearly > 0 && (
                    <p className="mt-2 text-xs font-black text-primary uppercase tracking-widest">
                      Billed annually (₹{plan.price.yearly})
                    </p>
                  )}
                </div>

                <div className="flex-1 space-y-4 mb-12">
                  {plan.features.map(feature => (
                    <div key={feature} className="flex items-center gap-3">
                      <CheckCircle size={20} className="text-primary opacity-60" weight="bold" />
                      <span className="text-sm font-semibold text-foreground/70">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  disabled={currentPlan === plan.id || updating !== null}
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full py-5 rounded-[1.8rem] font-black text-[13px] uppercase tracking-[0.2em] transition-all active:scale-95 flex items-center justify-center gap-2 ${
                    currentPlan === plan.id
                      ? 'bg-muted text-muted-foreground/30 cursor-default border border-border'
                      : plan.highlight
                        ? 'premium-gradient-bg text-white shadow-xl shadow-primary/20 hover:scale-105'
                        : 'bg-foreground text-background hover:bg-primary hover:text-white shadow-xl hover:scale-105'
                  }`}
                >
                  {updating === plan.id ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {currentPlan === plan.id ? 'Current Plan' : plan.id === 'spark' ? 'Downgrade to Spark' : `Get ${plan.name}`}
                      {currentPlan !== plan.id && plan.id !== 'spark' && <ArrowRight weight="bold" />}
                    </>
                  )}
                </button>
              </motion.div>
            ))}
          </div>

          {/* Footer Note */}
          <div className="mt-24 p-10 rounded-[3rem] bg-muted/30 border border-border flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                  <Lightning size={32} weight="duotone" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-foreground mb-1">Unsure about your choice?</h4>
                  <p className="text-muted-foreground text-sm font-medium opacity-60">You can cancel or switch plans at any time from your settings. No strings attached.</p>
                </div>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
                <Percent size={20} />
                <span className="text-xs font-black uppercase tracking-widest italic">All prices in INR (₹)</span>
            </div>
          </div>

        </div>

        {/* Global Payment Modal */}
        <PaymentModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => confirmPlanUpdate(selectedPlan?.id)}
          planName={selectedPlan?.name || ''}
          amount={`₹${billingCycle === 'monthly' ? selectedPlan?.price.monthly : selectedPlan?.price.yearly}`}
          billingCycle={billingCycle === 'monthly' ? '/ month' : '/ year'}
        />
      </Layout>
    );
  }
