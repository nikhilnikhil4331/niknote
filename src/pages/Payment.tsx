import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, CreditCard, Loader2, ShieldCheck } from 'lucide-react';
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
type RecoveredPayment = { paymentId?: unknown; planCode?: unknown; receiptSent?: unknown };
type RazorpayPaymentCallback = {
  razorpay_order_id?: unknown;
  razorpay_payment_id?: unknown;
  razorpay_signature?: unknown;
};
type RazorpayFailureResponse = { error?: { metadata?: { payment_id?: unknown } } };
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: 'INR';
  name: string;
  description: string;
  order_id: string;
  prefill: { email: string; name: string };
  theme: { color: string };
  handler: (response: RazorpayPaymentCallback) => Promise<void>;
  modal: { ondismiss: () => void };
};
type RazorpayInstance = {
  on: (event: 'payment.failed', handler: (response: RazorpayFailureResponse) => void) => void;
  open: () => void;
};
type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

function getRazorpay(): RazorpayConstructor | undefined {
  return (window as Window & { Razorpay?: RazorpayConstructor }).Razorpay;
}

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
    const data = await context?.clone().json() as { error?: unknown } | undefined;
    if (typeof data?.error === 'string') return data.error;
  } catch { /* use a safe message */ }
  return fallback;
}

function loadRazorpayScript(): Promise<boolean> {
  if (getRazorpay()) return Promise.resolve(true);
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
  const [receiptSent, setReceiptSent] = useState(false);
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
      const firstCheck = await supabase.functions.invoke('verify-razorpay-payment', { body: { recover: true } });
      let data = firstCheck.data;
      if (firstCheck.error) throw new Error(await functionError(firstCheck.error, 'Could not check payment right now. If charged, do not pay again.'));
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
        const recoveredPayments = data.recovered as RecoveredPayment[];
        const allReceiptsSent = recoveredPayments.every((item) => item.receiptSent === true);
        const receiptItem = recoveredPayments.find((item) => item.receiptSent !== true) || recoveredPayments[0];
        if (receiptItem?.planCode === 'weekly' || receiptItem?.planCode === 'monthly') setSelected(receiptItem.planCode);
        if (typeof receiptItem?.paymentId === 'string') setPaymentReference(receiptItem.paymentId);
        setReceiptSent(allReceiptsSent);
        if (!data.incomplete && allReceiptsSent) forgetOrder(user.id);
        setStep('success');
        toast.success('Payment verified and premium activated.');
        if (data.incomplete || !allReceiptsSent) toast.warning('Your receipt email has not gone through yet. You can retry below.');
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
      const options: RazorpayOptions = {
        key: data.keyId, amount: data.amount, currency: 'INR', name: 'NikNote',
        description: `${plan.label} — ${plan.duration} of access`, order_id: data.orderId,
        prefill: { email: isGuest ? '' : (data.userEmail || user.email || ''), name: user.user_metadata?.full_name || '' },
        theme: { color: '#3285F4' },
        handler: async (response) => {
          setCheckoutOpen(false);
          const paymentId = typeof response.razorpay_payment_id === 'string' ? response.razorpay_payment_id : '';
          setPaymentReference(paymentId);
          try {
            const { data: verified, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                razorpay_order_id: typeof response.razorpay_order_id === 'string' ? response.razorpay_order_id : data.orderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: typeof response.razorpay_signature === 'string' ? response.razorpay_signature : '',
                planCode: selected,
              },
            });
            if (verifyError || !verified?.success) throw new Error('Payment confirmation is pending.');
            recordVerified(paymentId, selected, data.orderId);
            const emailDelivered = verified?.receiptSent === true;
            setReceiptSent(emailDelivered);
            setPaymentReference(typeof verified?.paymentId === 'string' ? verified.paymentId : paymentId);
            if (emailDelivered) forgetOrder(user.id, data.orderId);
            await refreshAccess();
            setStep('success');
            toast.success('Payment verified and premium activated.');
            if (!emailDelivered) toast.warning('Your receipt email has not gone through yet. You can retry below.');
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
      const Razorpay = getRazorpay();
      if (!Razorpay) throw new Error('Could not load Razorpay checkout. Please check your connection.');
      const rzp = new Razorpay(options);
      rzp.on('payment.failed', (response) => {
        const reference = response.error?.metadata?.payment_id;
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
    <div className="nn-payment-recovery-wrap">
      <Button variant="outline" className="nn-payment-recovery w-full" disabled={checking || step === 'processing'} onClick={checkPreviousPayment}>
        {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {checking ? 'Checking payment…' : 'Already paid? Check payment'}
      </Button>
      <p className="nn-payment-recovery-note">This checks your existing order; it will not charge you again.</p>
    </div>
  );

  if (step === 'success') {
    return <main className="nn-payment-page nn-payment-state"><section className="nn-payment-state-card">
      <div className="nn-payment-check"><Check aria-hidden="true" /></div>
      <p className="nn-payment-kicker">Payment verified</p>
      <h1>Your next bright idea starts here.</h1>
      <p className="nn-payment-state-copy">Premium is active on this account. {receiptSent ? 'Your illustrated receipt is on its way to your checkout email.' : 'Your payment is verified; we couldn’t send the receipt yet. Try again below.'}</p>
      <img className="nn-payment-success-art" src="/images/email/niknote-payment-confirmation-hero.jpg" alt="An open notebook with colorful books, a blue pencil, and a coral pen" />
      {paymentReference && <div className="nn-payment-receipt-mini">
        <p><strong>Plan:</strong> {plan.label} · {plan.duration}</p>
        <p><strong>Amount:</strong> ₹{plan.price}</p>
        <p><strong>Payment ID:</strong> {paymentReference}</p>
      </div>}
      {!receiptSent && <Button variant="outline" className="nn-payment-retry w-full mb-3" disabled={checking} onClick={checkPreviousPayment}>
        {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {checking ? 'Retrying receipt…' : 'Retry receipt delivery'}
      </Button>}
      <Button onClick={() => navigate('/home')} className="nn-payment-button w-full">OPEN MY NIKNOTE</Button>
      <p className="nn-payment-support">Need a hand? <a href="mailto:support@niknote.online">support@niknote.online</a></p>
    </section></main>;
  }

  if (step === 'pending') {
    return <main className="nn-payment-page nn-payment-state"><section className="nn-payment-state-card">
      <div className="nn-payment-check nn-payment-check-pending"><ShieldCheck aria-hidden="true" /></div>
      <p className="nn-payment-kicker">Payment check</p>
      <h1>We’re checking with Razorpay.</h1>
      <p role="status" className="nn-payment-state-copy">{notice}</p>
      {paymentReference && <div className="nn-payment-receipt-mini"><p><strong>Payment reference:</strong> {paymentReference}</p></div>}
      {recovery}
      <p className="nn-payment-support">Need a hand? <a href="mailto:support@niknote.online">support@niknote.online</a></p>
      <Button variant="ghost" onClick={() => navigate('/editor/new')}>Back to editor</Button>
    </section></main>;
  }

  if (isPremium) {
    return <main className="nn-payment-page nn-payment-state"><section className="nn-payment-state-card">
      <div className="nn-payment-check"><Check aria-hidden="true" /></div>
      <p className="nn-payment-kicker">NikNote Premium</p>
      <h1>Your notebook is ready.</h1>
      <p className="nn-payment-state-copy">Your paid access is linked to this account.</p>
      {notice && <p role="status" className="nn-payment-note">{notice}</p>}
      {recovery}
      <Button onClick={() => navigate('/home')} className="nn-payment-button w-full mt-4">OPEN MY NIKNOTE</Button>
    </section></main>;
  }

  return (
    <div className="nn-payment-page pb-40">
      <header className="nn-payment-header">
        <div className="nn-payment-wrap nn-payment-header-inner">
          <Button variant="ghost" size="icon" className="nn-payment-back" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft className="h-5 w-5" /></Button>
          <img className="nn-payment-wordmark" src="/images/brand/niknote-primary-wordmark.png" alt="NikNote" />
          <span className="sr-only">Choose a Premium plan</span>
        </div>
      </header>
      <main className="nn-payment-wrap py-6">
        <section className="nn-payment-hero" aria-labelledby="payment-hero-heading">
          <div className="nn-payment-hero-copy">
            <span className="nn-payment-eyebrow">A little more room to create</span>
            <h1 id="payment-hero-heading">Give every idea a page.</h1>
            <p>Pick a one-time Premium pass and get back to making notes your way.</p>
          </div>
          <img className="nn-payment-hero-art" src="/images/email/niknote-payment-confirmation-hero.jpg" alt="An open notebook surrounded by colorful books and writing tools" />
        </section>

        <section className="nn-payment-card" aria-labelledby="payment-plan-heading">
          <p className="nn-payment-kicker">Choose your pass</p>
          <h2 id="payment-plan-heading">One payment. Your own pace.</h2>
          <div className="nn-payment-plan-grid">
            {(Object.keys(plans) as PlanCode[]).map((code) => (
              <button key={code} type="button" onClick={() => setSelected(code)} aria-pressed={selected === code}
                className="nn-payment-plan p-4 text-left">
                <span className="nn-payment-plan-name">{plans[code].label}</span>
                <span className="nn-payment-plan-price">₹{plans[code].price}</span>
                <span className="nn-payment-plan-duration">{plans[code].duration} access</span>
              </button>
            ))}
          </div>
          <p className="nn-payment-note">One payment, no automatic renewal. Access ends after {plan.duration}; pay again only if you want more time.</p>
        </section>

        <section className="nn-payment-card" aria-labelledby="payment-tools-heading">
          <p className="nn-payment-kicker">Inside your pass</p>
          <h2 id="payment-tools-heading">A few more tools for the page.</h2>
          <ul className="nn-payment-feature-list">
            {['AI writing assistant', 'Voice dictation', 'AI style matcher', 'Handwriting import'].map((item) => <li key={item}><Check className="h-4 w-4" aria-hidden="true" />{item}</li>)}
          </ul>
          <p className="nn-payment-note">Voice dictation depends on browser support; AI tools need an internet connection. Handwriting styles, AI notes, PDF tools and exports remain free.</p>
        </section>

        {isGuest && <section role="note" className="nn-payment-card nn-payment-guest">
          <p className="nn-payment-kicker">Before you pay</p>
          <h2>Protect your paid access.</h2>
          <p className="nn-payment-note">You are using a guest workspace. If browser data is cleared, it may be difficult to recover it. Save it with an email and password before paying.</p>
          <GuestUpgradeCard />
        </section>}

        <p className="nn-payment-security"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />Razorpay handles payment details. <a href="/refunds">Read the refund policy.</a></p>
        {notice && <p role="status" className="nn-payment-notice mt-4 p-3 text-sm">{notice}</p>}
        <div className="mt-5">{recovery}</div>
      </main>
      <div className="nn-payment-bottom">
        <div className="nn-payment-bottom-inner">
          <Button onClick={handlePay} disabled={step === 'processing' || checking} className="nn-payment-button w-full">
            {step === 'processing' ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{checkoutOpen ? 'Checkout open…' : 'Preparing checkout…'}</> : <><CreditCard className="h-4 w-4 mr-2" />Pay ₹{plan.price} for {plan.duration}</>}
          </Button>
          <p className="nn-payment-caption">One-time payment · no automatic renewal</p>
        </div>
      </div>
    </div>
  );
}
