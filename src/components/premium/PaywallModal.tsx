import React from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Crown, Mic, Sparkles, Wand2, CreditCard, Brain, FileImage,
  BookOpen, Volume2, Star, Zap, Shield, Flame
} from "lucide-react";
import { type PremiumFeature } from "@/contexts/PremiumContext";

export interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: PremiumFeature;
  usedCount?: number;
  limitCount?: number;
}

const featureLabels: Record<PremiumFeature, { icon: any; label: string; desc: string }> = {
  ai_note_generator: { icon: Wand2, label: "AI Note Generator", desc: "Generate notes with AI" },
  ai_solver: { icon: Brain, label: "AI Solver", desc: "Step-by-step problem solving" },
  ai_text_tools: { icon: Sparkles, label: "AI Text Tools", desc: "Rewrite, summarize & more" },
  handwriting_styles: { icon: Wand2, label: "Handwriting DNA", desc: "Custom styles from your own writing" },
  image_pdf_convert: { icon: FileImage, label: "Image/PDF to Notes", desc: "Turn files into notes" },
  voice_to_notes: { icon: Volume2, label: "Voice to Notes", desc: "Speak instead of typing" },
  ai_flashcards: { icon: BookOpen, label: "AI Flashcards", desc: "Decks and cards from any topic" },
};

// This grid is shown after someone taps a locked feature, so it has to name
// what they actually hit. The previous list sold AI notes, solver and
// flashcards as premium — all three are free — and promised "unlimited" on
// tools whose caps are not enforced. See PricingPopup.tsx for the real list.
const allFeatures = [
  { icon: Wand2, label: "AI Writing Assistant", desc: "Rewrite, summarize, expand" },
  { icon: Mic, label: "Voice Dictation", desc: "Speak instead of typing" },
  { icon: Sparkles, label: "AI Style Matcher", desc: "Match your real handwriting" },
  { icon: FileImage, label: "Handwriting Import", desc: "Photo of notes to text" },
];

const plans = [
  { code: "weekly", label: "Student Pro", price: "₹49", period: "/week", icon: Zap },
  { code: "monthly", label: "Premium", price: "₹99", period: "/month", popular: true, icon: Star },
];

export const PaywallModal: React.FC<PaywallModalProps> = ({ open, onOpenChange, feature, usedCount, limitCount }) => {
  const navigate = useNavigate();

  const handleSelectPlan = (planCode: string) => {
    onOpenChange(false);
    navigate(`/payment?plan=${planCode}`);
  };

  const triggeredFeature = feature ? featureLabels[feature] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-3xl border-border/50 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 pb-3">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
                <Crown className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <DialogTitle className="text-lg">Upgrade to Premium</DialogTitle>
                <DialogDescription className="text-xs">
                  Premium access from ₹49 for 7 days
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {/* Honest reassurance. This used to claim "2,500+ students already
              premium" and "Offer ends soon!", neither of which was true. */}
          <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-muted-foreground">
            <span>Handwriting styles stay free</span>
            <span>•</span>
            <span className="font-semibold text-foreground">No automatic renewal</span>
          </div>
        </div>

        <div className="p-5 pt-2 space-y-4">
          {/* Usage warning */}
          {triggeredFeature && usedCount !== undefined && limitCount !== undefined && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                <triggeredFeature.icon className="h-4 w-4" />
                {triggeredFeature.label}
              </div>
              <p className="text-xs text-amber-600/80 mt-1">
                You've used {usedCount}/{limitCount} free uses. Upgrade to access Premium tools.
              </p>
            </div>
          )}

          {/* Premium Features - Compact */}
          <div className="grid grid-cols-2 gap-1.5">
            {allFeatures.map((f, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <f.icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="text-[11px] font-medium leading-tight">{f.label}</span>
              </div>
            ))}
          </div>

          {/* Plans */}
          <div className="grid grid-cols-2 gap-3">
            {plans.map((p) => (
              <button
                key={p.code}
                onClick={() => handleSelectPlan(p.code)}
                className={`relative p-3 rounded-xl border-2 bg-card hover:bg-primary/5 transition-all duration-200 text-left group ${
                  p.popular ? 'border-primary shadow-md shadow-primary/10' : 'border-border/50 hover:border-primary/50'
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap">
                    Best value
                  </span>
                )}
                <div className="flex items-center gap-1.5 mb-1">
                  <p.icon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-muted-foreground">{p.label}</span>
                </div>
                <div className="text-lg font-bold group-hover:text-primary transition-colors">
                  {p.price}
                </div>
                <div className="text-[10px] text-muted-foreground">{p.period}</div>
              </button>
            ))}
          </div>

          {/* CTA Button */}
          <button
            onClick={() => handleSelectPlan('weekly')}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold text-sm hover:from-primary/90 hover:to-primary/70 transition-all shadow-lg shadow-primary/20"
          >
            <CreditCard className="h-4 w-4 inline mr-2" />
            Continue with ₹49 for 7 days
          </button>

          {/* Optional sharing — no reward is promised. */}
          <div className="text-center">
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <button
              onClick={() => {
                const msg = encodeURIComponent('🎓 NikNote — Free AI Study App! ✨\n\n✍️ Handwriting notes (16+ styles)\n🧠 AI Teacher (Hindi!)\n📝 Quiz + Flashcards\n\nDownload FREE: https://www.niknote.online');
                window.open(`https://wa.me/?text=${msg}`, '_blank');
                onOpenChange(false);
              }}
              className="w-full py-2.5 rounded-xl border-2 border-green-500/30 bg-green-500/5 text-green-700 font-semibold text-xs hover:bg-green-500/10 transition-all flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.61.61l4.458-1.496A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.317 0-4.46-.756-6.204-2.038l-.432-.326-2.648.889.889-2.648-.326-.432A9.935 9.935 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
              Share NikNote on WhatsApp
            </button>
          </div>

          {/* Trust Signals */}
          <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Razorpay Secure
            </span>
            <span>•</span>
            <span>UPI, Cards</span>
            <span>•</span>
            <span>No automatic renewal</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
