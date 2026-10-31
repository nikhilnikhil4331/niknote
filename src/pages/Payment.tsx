import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, CheckCircle, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GuestUpgradeCard } from '@/components/auth/GuestUpgradeCard';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuth } from '@/contexts/AuthContext';
import { usePremiumContext } from '@/contexts/PremiumContext';
import { usePremium } from '@/hooks/usePremium';
import { supabase } from '@/integrations/supabase/client';
import { trackBeginCheckout, trackVerifiedPurchase } from '@/lib/tracking';
import { trackCheckoutStarted, trackPaymentFailed, trackPaymentSucceeded } from '@/utils/analytics';
import { toast } from 'sonner';

type PlanCode = 'weekly' | 'monthly';
type Step = 'select' | 'processing' | 'pending' | 'success';

const plans = {
  weekly: { label: 'Student Pro', price: 49, duration: '7 days' },
  monthly: { label: 'Premium', price: 99, duration: '30 days' },
} satisfies Record<PlanCode, { label: string; price: number; duration: string }>;

const pendingKey = (userId: string) => `niknote:checkout:pending:${userId}`;
function rememberOrder(userId: string, orderId: string) {
  try { localStorage.setItem(pendingKey(userId), orderId); } catch { /* server also keeps the order */ }
}
function rememberedOrder(userId: string): string | undefined {
  try {
    const id = localStorage.getItem(pendingKey(userId));
    return id && /^order_[A-Za-z0-9]+$/.test(id) ? id : undefined;
  } catch { return undefined; }
}
function forgetOrder(userId: string, orderId?: string) {
  try {
    if (!orderId || localStorage.getItem(pendingKey(userId)) === orderId) localStorage.removeItem(pendingKey(userId));
  } catch { /* server is the source of truth */ }
}

async function functionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response })?.context;
  try {
    const data = await context?.clone().json();
    if (typeof data?.error === 'string') return data.error;
  } catch { /* use a safe message */ }
  return fallback;
}

function loadRazorpayScript(): Promise<boolean> {
  if ((window as any).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => resolve(false), 15000);
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => { clearTimeout(timer); resolve(true); };
    script.onerror = () => { clearTimeout(timer); resolve(false); };
    document.body.appendChild(script);
  });
}

export default function PaymentPage() {
  useDocumentTitle({ title: 'NikNote Premium — ₹49 for 7 days or ₹99 for 30 days', description: 'One-time access to NikNote Premium. No automatic renewal.' });
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, isGuest, loading: authLoading } = useAuth();
  const { isPremium, refresh: refreshPremium } = usePremium();
  const { refresh: refreshPremiumContext } = usePremiumContext();
  const [selected, setSelected] = useState<PlanCode>(params.get('plan') === 'weekly' ? 'weekly' : 'monthly');
  const [step, setStep] = useState<Step>('select');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const plan = plans[selected];

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth?redirect=/payment');
  }, [authLoading, user, navigate]);

  const refreshAccess = async () => {
    // The editor reads the context; other surfaces use the standalone hook.
    // Refresh both after the server has atomically activated the purchase.
    await Promise.all([refreshPremium(), refreshPremiumContext()]);
    window.dispatchEvent(new Event('niknote:subscription-updated'));
  };

  const recordVerified = (paymentId: string, planCode: PlanCode, orderId?: string) => {
    const purchasedPlan = plans[planCode];
    trackVerifiedPurchase({ transactionId: paymentId, orderId, planCode, planName: purchasedPlan.label, value: purchasedPlan.price, currency: 'INR' });
    trackPaymentSucceeded(planCode);
  };

  const checkPreviousPayment = async () => {
    if (!user || checking) return;
    setChecking(true);
    setNotice('');
    try {
      // The server queries only orders it created for this signed-in user and
      // verifies capture directly with Razorpay. This never opens a checkout.
      let { data, error } = await supabase.functions.invoke('verify-razorpay-payment', { body: { recover: true } });
      if (error) throw new Error(await functionError(error, 'Could not check payment right now. If charged, do not pay again.'));
      const savedOrder = rememberedOrder(user.id);
      if (!data?.success && savedOrder) {
        const specific = await supabase.functions.invoke('verify-razorpay-payment', { body: { recover: true, orderId: savedOrder } });
        if (specific.error) throw new Error(await functionError(specific.error, 'Could not check payment right now. If charged, do not pay again.'));
        data = specific.data;
      }
      await refreshAccess();
      if (data?.success && Array.isArray(data.recovered) && data.recovered.length) {
        for (const item of data.recovered) {
          if (typeof item.paymentId === 'string' && (item.planCode === 'weekly' || item.planCode === 'monthly')) {
            recordVerified(item.paymentId, item.planCode);
          }
        }
        if (!data.incomplete) forgetOrder(user.id);
        setStep('success');
        toast.success('Payment verified and premium activated.');
        if (data.incomplete) toast.warning('Some other orders could not be checked. Please check again later.');
      } else {
        setNotice('No pending captured payment was found yet. If money was deducted, do not pay again; retry later or contact support with your payment reference.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not check payment. If charged, do not pay again.');
    } finally {
      setChecking(false);
    }
  };

  const handlePay = async () => {
    if (!user || step === 'processing' || checking) return;
    setNotice('');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) {
        setNotice('A connected account is needed for checkout. Reconnect or sign in before paying.');
        return;
      }
    } catch {
      setNotice('Could not check your session. Reconnect before paying.');
      return;
    }
    setStep('processing');
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Could not load Razorpay checkout. Please check your connection.');
      const { data, error } = await supabase.functions.invoke('create-razorpay-order', { body: { planCode: selected } });
      if (error) throw new Error(await functionError(error, 'Could not create a payment order. No payment was attempted.'));
      if (!data?.orderId || !/^order_[A-Za-z0-9]+$/.test(data.orderId) ||
          typeof data.keyId !== 'string' || !data.keyId.startsWith('rzp_live_') ||
          data.amount !== plan.price * 100 || data.currency !== 'INR') {
        throw new Error('Payment order was incomplete. No payment was attempted.');
      }
      rememberOrder(user.id, data.orderId);
      const options = {
        key: data.keyId, amount: data.amount, currency: 'INR', name: 'NikNote',
        description: `${plan.label} — ${plan.duration} of access`, order_id: data.orderId,
        prefill: { email: isGuest ? '' : (data.userEmail || user.email || ''), name: user.user_metadata?.full_name || '' },
        theme: { color: '#7C5F9E' },
        handler: async (response: any) => {
          setCheckoutOpen(false);
          const paymentId = typeof response?.razorpay_payment_id === 'string' ? response.razorpay_payment_id : '';
          setPaymentReference(paymentId);
          try {
            const { data: verified, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                razorpay_order_id: response?.razorpay_order_id || data.orderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: response?.razorpay_signature || '',
                planCode: selected,
              },
            });
            if (verifyError || !verified?.success) throw new Error('Payment confirmation is pending.');
            recordVerified(paymentId, selected, data.orderId);
            forgetOrder(user.id, data.orderId);
            await refreshAccess();
            setStep('success');
            toast.success('Payment verified and premium activated.');
          } catch {
            // A timeout or delayed capture is not a failed payment. Never send
            // the customer back to the pay button without a recovery option.
            setStep('pending');
            setNotice('If money was deducted, do not pay again. Check the payment below or contact support.');
          }
        },
        modal: {
          ondismiss: () => {
            setCheckoutOpen(false);
            setStep('select');
            setNotice('Checkout closed. If money was deducted, check the previous payment before trying again.');
          },
        },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        const reference = response?.error?.metadata?.payment_id;
        if (typeof reference === 'string') setPaymentReference(reference);
        setCheckoutOpen(false);
        trackPaymentFailed(selected, 'provider_failed');
        setStep('pending');
        setNotice('Payment was not confirmed. If money was deducted, do not pay again; check the previous payment.');
      });
      setCheckoutOpen(true);
      trackBeginCheckout({ planCode: selected, planName: plan.label, value: plan.price, currency: 'INR' });
      trackCheckoutStarted(selected);
      rzp.open();
    } catch (error) {
      setCheckoutOpen(false);
      setStep('select');
      setNotice(error instanceof Error ? error.message : 'Checkout is temporarily unavailable. No payment was attempted.');
    }
  };

  if (authLoading || !user) return null;

  const recovery = (
    <div className="space-y-2">
      <Button variant="outline" className="w-full rounded-xl" disabled={checking || step === 'processing'} onClick={checkPreviousPayment}>
        {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {checking ? 'Checking payment…' : 'Already paid? Check payment'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">This checks your existing order; it will not charge you again.</p>
    </div>
  );

  if (step === 'success') {
    return <main className="min-h-screen flex items-center justify-center p-6 bg-background"><div className="max-w-sm text-center space-y-4">
      <CheckCircle className="h-14 w-14 mx-auto text-success" />
      <h1 className="text-2xl font-bold">Payment verified</h1>
      <p className="text-sm text-muted-foreground">Premium is active on this account.</p>
      <Button onClick={() => navigate('/')} className="rounded-xl">Go to editor</Button>
    </div></main>;
  }

  if (step === 'pending') {
    return <main className="min-h-screen flex items-center justify-center p-6 bg-background"><div className="max-w-sm w-full text-center space-y-4">
      <ShieldCheck className="h-14 w-14 mx-auto text-accent-warm" />
      <h1 className="text-xl font-bold">Payment confirmation pending</h1>
      <p role="status" className="text-sm text-muted-foreground">{notice}</p>
      {paymentReference && <p className="text-xs break-all">Payment reference: {paymentReference}</p>}
      {recovery}
      <p className="text-xs text-muted-foreground">Need help? <a className="underline" href="mailto:support@niknote.online">support@niknote.online</a></p>
      <Button variant="ghost" onClick={() => navigate('/')}>Back to editor</Button>
    </div></main>;
  }

  if (isPremium) {
    return <main className="min-h-screen flex items-center justify-center p-6 bg-background"><div className="max-w-sm w-full text-center space-y-4">
      <CheckCircle className="h-14 w-14 mx-auto text-success" />
      <h1 className="text-xl font-bold">Premium is active</h1>
      <p className="text-sm text-muted-foreground">Your paid access is linked to this account.</p>
      {notice && <p role="status" className="text-xs text-muted-foreground">{notice}</p>}
      {recovery}
      <Button onClick={() => navigate('/')} className="rounded-xl">Go to editor</Button>
    </div></main>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-primary/5 pb-32">
      <header className="sticky top-0 z-40 bg-background/95 border-b border-border/40">
        <div className="max-w-lg mx-auto px-4 h-16 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft className="h-5 w-5" /></Button>
          <div><h1 className="font-semibold">Go Premium</h1><p className="text-xs text-muted-foreground">Choose the access period that suits you</p></div>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <section className="rounded-2xl bg-card border border-border/60 p-5 space-y-3">
          <h2 className="font-semibold">Choose your one-time pass</h2>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(plans) as PlanCode[]).map((code) => (
              <button key={code} type="button" onClick={() => setSelected(code)} aria-pressed={selected === code}
                className={`rounded-xl border-2 p-4 text-left ${selected === code ? 'border-primary bg-primary/5' : 'border-border/50'}`}>
                <span className="block text-xs text-muted-foreground">{plans[code].label}</span>
                <span className="block text-2xl font-bold">₹{plans[code].price}</span>
                <span className="text-xs text-muted-foreground">{plans[code].duration} access</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">One payment, no automatic renewal. Access ends after {plan.duration}; pay again only if you want more time.</p>
        </section>
        <section className="rounded-2xl bg-card border border-border/60 p-5 space-y-3">
          <h2 className="font-semibold">Premium tools</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {['AI writing assistant', 'Voice dictation', 'AI style matcher', 'Handwriting import'].map((item) => <li key={item} className="flex gap-2"><Check className="h-4 w-4 text-success shrink-0" />{item}</li>)}
          </ul>
          <p className="text-xs text-muted-foreground">Voice dictation depends on browser support; AI tools require an internet connection. Handwriting styles, AI notes, PDF tools and exports remain free.</p>
        </section>
        {isGuest && <section role="note" className="rounded-2xl border border-[color:hsl(var(--accent-warm-hsl)/0.3)] bg-nk-warm-600/5 p-4 space-y-3">
          <p className="text-sm font-medium">Protect your paid access</p>
          <p className="text-xs text-muted-foreground">You are using a guest workspace. If browser data is cleared, it may be difficult to recover it. Save it with an email and password before paying.</p>
          <GuestUpgradeCard />
        </section>}
        <p className="text-xs text-muted-foreground flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0" />Razorpay handles payment details. <a className="underline" href="/refunds">Refund policy</a></p>
        {notice && <p role="status" className="rounded-xl bg-nk-warm-600/10 p-3 text-sm">{notice}</p>}
        {recovery}
      </main>
      <div className="fixed bottom-0 inset-x-0 z-40 bg-background/95 border-t border-border/40 p-4">
        <div className="max-w-lg mx-auto space-y-2">
          <Button onClick={handlePay} disabled={step === 'processing' || checking} className="w-full h-12 rounded-xl font-semibold">
            {step === 'processing' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{checkoutOpen ? 'Checkout open…' : 'Preparing checkout…'}</> : <><CreditCard className="h-4 w-4 mr-2" />Pay ₹{plan.price} for {plan.duration}</>}
          </Button>
          <p className="text-center text-xs text-muted-foreground">One-time payment · no automatic renewal</p>
        </div>
      </div>
    </div>
  );
}
