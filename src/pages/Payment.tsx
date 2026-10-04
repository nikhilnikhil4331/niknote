import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import {
  ArrowLeft, Check, Crown, Sparkles, CheckCircle, AlertCircle,
  Loader2, CreditCard, Shield, Zap, Star, Flame, Clock, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePremium } from "@/hooks/usePremium";
import { UrgencyTimer } from "@/components/urgency/UrgencyTimer";

type PlanCode = "weekly" | "monthly";
type PaymentStep = "select" | "processing" | "success" | "error";

interface Plan {
  code: PlanCode;
  label: string;
  price: number;
  period: string;
  popular?: boolean;
  badge?: string;
  icon: any;
}

const plans: Plan[] = [
  {
    code: "weekly", label: "Student Pro", price: 49, period: "/week",
    icon: Zap, badge: "Try First"
  },
  {
    code: "monthly", label: "Premium", price: 99, period: "/month",
    popular: true, icon: Star, badge: "Most Popular"
  },
];

const premiumFeatures = [
  { icon: Sparkles, text: "AI Note Generator", desc: "Unlimited AI notes" },
  { icon: Crown, text: "AI Solver", desc: "Solve any problem" },
  { icon: Zap, text: "AI Flashcards", desc: "Auto study cards" },
  { icon: Star, text: "Voice Dictation", desc: "Speak to write" },
  { icon: Sparkles, text: "16+ Handwriting Styles", desc: "Your handwriting DNA" },
  { icon: Crown, text: "PDF Export", desc: "Unlimited downloads" },
  { icon: Zap, text: "Priority AI", desc: "Faster responses" },
  { icon: Star, text: "AI Text Tools", desc: "Rewrite, summarize" },
];

// Load Razorpay SDK dynamically — with mobile timeout
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error("Razorpay script failed to load");
      resolve(false);
    };
    // Mobile timeout — if script doesn't load in 15 seconds, fail gracefully
    const timeout = setTimeout(() => {
      console.warn("Razorpay load timed out (slow network)");
      resolve(false);
    }, 15000);
    script.onload = () => { clearTimeout(timeout); resolve(true); };
    script.onerror = () => { clearTimeout(timeout); resolve(false); };
    document.body.appendChild(script);
  });
}

export default function PaymentPage() {
  useDocumentTitle({ title: 'Go Premium — NikNote | ₹49/week Student Pro, ₹99/month Premium', description: 'Upgrade to NikNote Premium — Unlimited AI notes, 16+ handwriting styles, voice dictation, priority AI. Starting ₹49/week.' });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { refresh: refreshPremium, isPremium } = usePremium();

  const initialPlan = (searchParams.get("plan") as PlanCode) || "monthly";
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>(initialPlan);
  const [paymentStep, setPaymentStep] = useState<PaymentStep>("select");
  const [verificationPending, setVerificationPending] = useState(false);

  const plan = plans.find((p) => p.code === selectedPlan)!;

  useEffect(() => {
    if (!user) {
      toast.error("Please sign in to subscribe");
      navigate("/auth?redirect=/payment");
    }
  }, [user, navigate]);

  const handlePay = async () => {
    if (!user) {
      toast.error("Pehle sign in karo!");
      navigate("/auth?redirect=/payment");
      return;
    }

    // Check if session is valid before proceeding
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        toast.error("Session expired! Please sign in again.");
        navigate("/auth?redirect=/payment");
        return;
      }
    } catch {
      toast.error("Network error. Internet check karo aur try again.");
      return;
    }

    const loaded = await loadRazorpayScript();
    if (!loaded) {
      toast.error("Payment system load nahi ho paya. Internet check karo aur dobara try karo.");
      return;
    }

    setVerificationPending(false);
    setPaymentStep("processing");

    try {
      const { data, error } = await supabase.functions.invoke("create-razorpay-order", {
        body: { planCode: selectedPlan },
      });

      if (error) {
        const errMsg = error.message || error.toString();
        console.error("Create order error:", errMsg);
        // If edge function not found, show specific error
        if (errMsg.includes("not found") || errMsg.includes("NOT_FOUND") || errMsg.includes("FunctionsHttpError")) {
          throw new Error("Payment system abhi setup ho rha hai. 2-3 minute mein try karo.");
        }
        throw new Error(errMsg || "Failed to create order");
      }

      if (!data?.orderId || !data?.keyId) {
        throw new Error("Payment response incomplete. Dobara try karo.");
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency || "INR",
        name: "NikNote",
        description: `${data.planLabel || selectedPlan} Premium Plan`,
        order_id: data.orderId,
        prefill: {
          email: data.userEmail || user.email || "",
          name: user.user_metadata?.full_name || "",
        },
        notes: {
          plan_code: selectedPlan,
          user_id: user.id,
        },
        theme: {
          color: "#6366f1",
        },
        // Mobile-friendly: send additional details for better UX
        config: {
          display: {
            language: 'en-IN',
            blocks: {
              amount: { text: `₹${plan.price} ${plan.period}` }
            }
          }
        },
        handler: async (response: any) => {
          try {
            if (!response.razorpay_payment_id) {
              throw new Error("No payment ID received");
            }

            const { data: verifyData, error: verifyError } = await supabase.functions.invoke("verify-razorpay-payment", {
              body: {
                razorpay_order_id: response.razorpay_order_id || data.orderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature || "",
                planCode: selectedPlan,
              },
            });

            if (verifyError || !verifyData?.success) {
              throw new Error("Payment could not be verified. Contact support@niknote.online with your payment ID; do not pay again yet.");
            }

            await refreshPremium();
            setPaymentStep("success");
            toast.success("🎉 Payment successful! Premium activated!");
            setTimeout(() => navigate("/"), 2500);
          } catch (err) {
            console.error("Verification error:", err);
            setVerificationPending(true);
            setPaymentStep("error");
            toast.error(err instanceof Error ? err.message : "Payment verification failed. Contact support@niknote.online before retrying.");
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentStep("select");
            toast.info("Payment cancel ho gaya. Koi baat nahi!");
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        console.error("Payment failed:", response.error);
        setPaymentStep("error");
        const failMsg = response.error?.description || "Payment fail ho gaya";
        toast.error(failMsg + ". Dobara try karo!");
      });
      rzp.open();
    } catch (err) {
      console.error("Payment error:", err);
      setPaymentStep("error");
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg + ". Dobara try karo!");
    }
  };

  const handleRetry = () => {
    setPaymentStep("select");
  };

  if (!user) return null;

  // Success Screen
  if (paymentStep === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-green-50/20 to-primary/5 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="text-center space-y-6 max-w-sm"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-500/30"
          >
            <CheckCircle className="w-12 h-12 text-white" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Premium Activated! 🎉</h1>
            <p className="text-muted-foreground">
              All premium features unlocked. Go create magic! ✨
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            Redirecting...
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Error Screen
  if (paymentStep === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-destructive/5 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6 max-w-sm"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground mb-2">{verificationPending ? "Verification Pending" : "Payment Failed"}</h1>
            <p className="text-muted-foreground text-sm">
              {verificationPending ? "If your account was charged, do not pay again. Contact support@niknote.online with your payment ID." : "Your payment couldn't be processed. Please try again."}
            </p>
          </div>
          {verificationPending ? <Button onClick={() => navigate("/")} className="rounded-xl">Back to Editor</Button> : <Button onClick={handleRetry} className="rounded-xl">Try Again</Button>}
        </motion.div>
      </div>
    );
  }

  if (isPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background">
        <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40 h-14 sm:h-16">
          <div className="max-w-lg mx-auto px-4 h-full flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-base font-semibold">You're Premium! 🎉</h1>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-8 text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-xl">
            <Crown className="h-10 w-10 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-bold">Premium Active ✨</h2>
          <p className="text-muted-foreground">All features unlocked! Keep creating amazing notes.</p>
          <Button onClick={() => navigate("/")} className="rounded-xl">Go to Editor</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40 h-14 sm:h-16">
        <div className="max-w-lg mx-auto px-4 h-full flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold truncate">Go Premium ✨</h1>
            <p className="text-xs text-muted-foreground truncate">Unlock everything</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
            <Crown className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-28">
        {/* Urgency Timer Card */}
        <UrgencyTimer variant="card" />

        {/* Social Proof Bar — Enhanced */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-primary/5 via-orange-500/5 to-pink-500/5 rounded-full text-xs font-medium border border-primary/10"
        >
          <Flame className="h-3.5 w-3.5 text-orange-500" />
          <span>2,500+ students already premium</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-green-600">4.8 ⭐</span>
          <span className="text-muted-foreground">•</span>
          <TrendingUp className="h-3 w-3 text-green-500" />
          <span className="text-green-600 font-semibold">₹49/week</span>
        </motion.div>

        {/* Premium Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl p-4 border border-border/50 shadow-lg"
        >
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Premium Features
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {premiumFeatures.map((feature, i) => (
              <motion.div
                key={feature.text}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-2 p-2 rounded-lg bg-secondary/30"
              >
                <feature.icon className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium leading-tight">{feature.text}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{feature.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Plan Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-3"
        >
          <h2 className="text-sm font-semibold text-foreground px-1">Choose Plan</h2>
          <div className="grid grid-cols-2 gap-3">
            {plans.map((p) => (
              <button
                key={p.code}
                onClick={() => setSelectedPlan(p.code)}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedPlan === p.code
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border/50 bg-card hover:border-border"
                }`}
              >
                {p.badge && (
                  <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                    p.popular ? 'bg-primary text-primary-foreground' : 'bg-orange-500/10 text-orange-600'
                  }`}>
                    {p.badge}
                  </span>
                )}
                <div className="flex items-center gap-1.5 mb-1">
                  <p.icon className={`h-3.5 w-3.5 ${selectedPlan === p.code ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-xs font-medium">{p.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">₹{p.price}</span>
                  <span className="text-xs text-muted-foreground">{p.period}</span>
                </div>
                {selectedPlan === p.code && (
                  <div className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Referral Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <Crown className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <div className="text-xs font-semibold text-green-700">Share & Get FREE Premium! 🎁</div>
              <div className="text-[10px] text-green-600/70">3 friends share = 7 days FREE premium</div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Sticky Pay Button */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/40 p-4">
        <div className="max-w-lg mx-auto space-y-2">
          {/* Urgency inline */}
          <UrgencyTimer variant="inline" className="justify-center" />
          <Button
            onClick={handlePay}
            disabled={paymentStep === "processing"}
            className="w-full h-14 rounded-2xl text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20 transition-all duration-300"
          >
            {paymentStep === "processing" ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5 mr-2" />
                Pay ₹{plan.price} — {plan.label} Plan
              </>
            )}
          </Button>
          <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Secured by Razorpay
            </span>
            <span>•</span>
            <span>UPI, Cards, Wallets</span>
            <span>•</span>
            <span>Cancel Anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
}
