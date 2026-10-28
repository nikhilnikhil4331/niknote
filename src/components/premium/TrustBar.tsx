// ============================================================
// NikNote — honest checkout reassurance
//
// Replaces the previous UrgencyTimer, which was a manufactured scarcity
// device: it counted down to "end of today" and reset every single day, and
// told visitors "price badhne wala hai" (the price is about to go up) with
// no such change planned.
//
// India's Guidelines for Prevention and Regulation of Dark Patterns (2023)
// name false urgency and resetting countdown timers explicitly. Beyond the
// legal risk, it is simply dishonest, and it was sitting on the checkout
// page — the worst possible place to be caught lying.
//
// This component says only things that are true and checkable.
// ============================================================
import React from 'react';
import { ShieldCheck, XCircle, CreditCard, Lock } from 'lucide-react';

interface ValueProps {
  className?: string;
  variant?: 'banner' | 'card' | 'inline';
}

const BANNER_TEXT = '₹49/week or ₹99/month · cancel anytime · UPI, cards & wallets via Razorpay';
const INLINE_TEXT = 'Secure checkout via Razorpay';

export const TrustBar: React.FC<ValueProps> = ({ className = '', variant = 'banner' }) => {
  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center justify-center gap-1.5 ${className}`}>
        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{INLINE_TEXT}</span>
      </span>
    );
  }

  if (variant === 'banner') {
    return (
      <div className={`w-full bg-primary/5 border-b border-primary/10 ${className}`}>
        <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <CreditCard className="h-3.5 w-3.5" />
          <span>{BANNER_TEXT}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl bg-card border border-border/50 p-4 text-left space-y-2 ${className}`}
    >
      <div className="flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">No countdown, no fake discount.</span>{' '}
          The price shown is the price you pay. Payments run through Razorpay over UPI, cards or
          wallets.
        </p>
      </div>
      <div className="flex items-start gap-2">
        <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Cancel whenever you like from your account. If something breaks, email the developer
          directly and you get your money back.
        </p>
      </div>
    </div>
  );
};
