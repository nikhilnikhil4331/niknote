import { useEffect } from 'react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { trackPricingViewed } from '@/utils/analytics';
import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Crown, CheckCircle2, Sparkles, Shield, Zap,
  CreditCard, Star, Brain, BookOpen, Flame, Users, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { usePremium } from '@/hooks/usePremium';
import { TrustBar } from '@/components/premium/TrustBar';
import { PlanArt } from '@/components/motion/FeatureArt';
import { trackPremiumUpgradeClick } from '@/lib/tracking';

const plans = [
  {
    code: 'weekly',
    label: 'Student Pro',
    price: 49,
    period: '/week',
    icon: Zap,
    badge: 'Try First',
    features: ['All AI features', '16+ handwriting styles', 'PDF export', 'Voice dictation'],
  },
  {
    code: 'monthly',
    label: 'Premium',
    price: 99,
    period: '/month',
    icon: Star,
    popular: true,
    badge: 'Most Popular',
    features: ['Everything in Student Pro', 'Priority AI responses', 'AI flashcards & quizzes', 'Early access to new features'],
  },
];

const allFeatures = [
  { icon: Sparkles, text: 'AI Note Generator', desc: 'Unlimited AI notes' },
  { icon: Brain, text: 'AI Solver', desc: 'Solve any problem' },
  { icon: Star, text: 'AI Flashcards', desc: 'Auto study cards' },
  { icon: BookOpen, text: 'Voice Dictation', desc: 'Speak to write' },
  { icon: Crown, text: '16+ Handwriting Styles', desc: 'Your handwriting, AI-powered' },
  { icon: Zap, text: 'Unlimited Exports', desc: 'PDF, image, share' },
  { icon: Shield, text: 'Priority AI', desc: 'Faster responses' },
  { icon: Sparkles, text: 'AI Text Tools', desc: 'Rewrite, summarize' },
];

const Upgrade = () => {
  useDocumentTitle({ title: 'Upgrade to Premium — NikNote | AI Study App', description: 'Unlock all NikNote premium features — AI notes, handwriting, quizzes, flashcards. Starting ₹49/week.' });
  const navigate = useNavigate();
  const { isPremium } = usePremium();
  const [selected, setSelected] = React.useState<'weekly' | 'monthly'>('monthly');

  const activePlan = plans.find((p) => p.code === selected)!;

  useEffect(() => {
    trackPricingViewed(selected);
  }, [selected]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-background to-secondary/20 pb-32 sm:pb-12">
      <header
        className="sticky top-0 z-50 bg-background/85 backdrop-blur-xl border-b border-border/50"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="container mx-auto px-3 h-14 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl h-10 w-10">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="ml-2 font-semibold text-base sm:text-lg">Upgrade to Premium</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-4xl space-y-6">
        <TrustBar variant="card" />

        <div className="text-center space-y-3">
          <div className="flex justify-center"><PlanArt /></div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-primary/10 via-orange-500/10 to-pink-500/10 text-xs sm:text-sm font-medium border border-primary/10">
            <Flame className="h-4 w-4 text-orange-500" />
            Student Pro ₹49/week · Premium ₹99/month
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            {isPremium ? "You're Premium! 🎉" : 'Unlock Your Full Potential'}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto text-sm">
            {isPremium
              ? 'All premium features are active. Keep creating amazing notes!'
              : 'The ultimate AI study companion — write, solve, and learn smarter.'}
          </p>
        </div>

        {isPremium ? (
          <div className="text-center py-8">
            <Button onClick={() => navigate('/')} className="rounded-xl">Go to Editor</Button>
          </div>
        ) : (
          <>
            {/* Segmented plan selector — mobile-first */}
            <div className="relative grid grid-cols-2 p-1 bg-muted/50 rounded-2xl border border-border/40">
              <div
                aria-hidden="true"
                className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-background shadow-md border border-border/40 transition-[left] duration-300 ease-out motion-reduce:transition-none"
                style={{ left: selected === 'weekly' ? 4 : 'calc(50%)' }}
              />
              {plans.map((plan) => {
                const isSel = selected === plan.code;
                return (
                  <button
                    key={plan.code}
                    onClick={() => setSelected(plan.code as 'weekly' | 'monthly')}
                    className="relative z-10 flex flex-col items-center justify-center py-2.5 px-2 rounded-xl transition-colors"
                  >
                    <span className={`text-[11px] font-semibold uppercase tracking-wide ${isSel ? 'text-primary' : 'text-muted-foreground'}`}>
                      {plan.label}
                    </span>
                    <span className={`text-sm font-bold mt-0.5 ${isSel ? 'text-foreground' : 'text-muted-foreground'}`}>
                      ₹{plan.price}<span className="text-[10px] font-medium">{plan.period}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected plan detail card */}
            <motion.div
              key={activePlan.code}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative bg-card rounded-3xl border-2 border-primary shadow-xl shadow-primary/10 p-5"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-primary/60 rounded-t-3xl" />
              {activePlan.badge && (
                <div className="absolute top-3 right-3 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                  {activePlan.badge}
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                <activePlan.icon className="h-5 w-5 text-primary" />
                <span className="font-semibold">{activePlan.label}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold">₹{activePlan.price}</span>
                <span className="text-sm text-muted-foreground">{activePlan.period}</span>
              </div>
              <ul className="space-y-2.5 mb-2">
                {activePlan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {allFeatures.map((feature, index) => (
                <motion.div
                  key={feature.text}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border border-border/30 text-center"
                >
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <feature.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-xs font-semibold leading-tight">{feature.text}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{feature.desc}</div>
                </motion.div>
              ))}
            </div>

            {/* Desktop inline CTA */}
            <div className="hidden sm:block">
              <Button
                onClick={() => {
                  trackPremiumUpgradeClick({
                    planName: activePlan.label,
                    buttonLocation: 'upgrade_desktop_cta',
                    conversionSource: 'upgrade_page',
                    pageType: 'pricing',
                  });
                  navigate(`/payment?plan=${activePlan.code}`);
                }}
                className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-base font-semibold"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Get {activePlan.label} — ₹{activePlan.price}{activePlan.period}
              </Button>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-5 border border-primary/20 text-center space-y-2"
            >
              <Users className="h-7 w-7 text-primary mx-auto" />
              <h3 className="text-base font-bold">For teachers &amp; institutions</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Teacher plans from ₹999/year, tuition centres from ₹4,999/year, and a free
                30-day pilot for one department.
              </p>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate('/schools')}>
                See teacher plans
              </Button>
            </motion.div>

            <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Secured by Razorpay</span>
              <span>UPI · Cards · Wallets</span>
              <span>Cancel Anytime</span>
            </div>
          </>
        )}
      </main>

      {/* Sticky mobile CTA */}
      {!isPremium && (
        <div
          className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50 px-4 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
        >
          <Button
            onClick={() => {
              trackPremiumUpgradeClick({
                planName: activePlan.label,
                buttonLocation: 'upgrade_mobile_sticky',
                conversionSource: 'upgrade_page',
                pageType: 'pricing',
              });
              navigate(`/payment?plan=${activePlan.code}`);
            }}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-sm font-semibold shadow-lg shadow-primary/20"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Continue — ₹{activePlan.price}{activePlan.period}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Upgrade;

