// ============================================================
// NikNote 4.0 — Referral Widget
// "Share NikNote, Get 7 Days FREE Premium Per Friend!"
// Shows on upgrade page, account page, and after PDF export
// ============================================================

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Share2, MessageCircle, Gift, Users, Sparkles, Crown } from "lucide-react";
import { useReferral } from "@/hooks/useReferral";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ReferralWidgetProps {
  compact?: boolean; // Compact mode for inline display
  showRewardPreview?: boolean; // Show what they get
}

export const ReferralWidget: React.FC<ReferralWidgetProps> = ({ compact = false, showRewardPreview = true }) => {
  const { stats, loading, shareViaWhatsApp, copyLink, REFERRAL_REWARD_DAYS } = useReferral();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const success = await copyLink();
    if (success) {
      setCopied(true);
      toast.success("Link copied! Share with friends 🎉");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    shareViaWhatsApp();
    toast.success("Share with friends on WhatsApp! 📱");
  };

  if (loading) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
        <Gift className="h-5 w-5 text-green-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-green-700">Share & Get {REFERRAL_REWARD_DAYS} Days FREE!</div>
          <div className="text-[10px] text-green-600/70">{stats.totalReferrals} friends referred</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center hover:bg-green-500/20 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-green-600" />}
          </button>
          <button
            onClick={handleWhatsApp}
            className="h-7 w-7 rounded-lg bg-green-500/10 flex items-center justify-center hover:bg-green-500/20 transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5 text-green-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-2xl border border-green-200 dark:border-green-800/30 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-base">Share & Earn Free Premium! 🎁</h3>
            <p className="text-xs text-white/80">Get {REFERRAL_REWARD_DAYS} days FREE per friend</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="text-center p-2 rounded-xl bg-white/50 dark:bg-white/5">
          <Users className="h-4 w-4 text-green-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-green-700">{stats.totalReferrals}</div>
          <div className="text-[10px] text-green-600/70">Friends Referred</div>
        </div>
        <div className="text-center p-2 rounded-xl bg-white/50 dark:bg-white/5">
          <Crown className="h-4 w-4 text-amber-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-amber-600">{stats.rewardDays}</div>
          <div className="text-[10px] text-amber-600/70">Free Days Earned</div>
        </div>
        <div className="text-center p-2 rounded-xl bg-white/50 dark:bg-white/5">
          <Sparkles className="h-4 w-4 text-purple-600 mx-auto mb-1" />
          <div className="text-lg font-bold text-purple-600">{stats.pendingRewards}</div>
          <div className="text-[10px] text-purple-600/70">Pending</div>
        </div>
      </div>

      {/* Referral Code */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white/70 dark:bg-white/5 border border-green-200/50">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-green-600/70 mb-0.5">Your Referral Code</div>
            <div className="text-lg font-mono font-bold text-green-700 tracking-wider">{stats.referralCode || "NIKNOTE"}</div>
          </div>
          <button
            onClick={handleCopy}
            className="h-9 px-3 rounded-lg bg-green-500 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-green-600 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Share Buttons */}
      <div className="px-4 pb-4 space-y-2">
        <Button
          onClick={handleWhatsApp}
          className="w-full rounded-xl bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold h-11"
        >
          <MessageCircle className="h-4 w-4 mr-2" />
          Share on WhatsApp
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleCopy}
            variant="outline"
            className="rounded-xl h-9 text-xs"
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copy Link
          </Button>
          <Button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: "NikNote — AI Notes App",
                  text: `Use my code ${stats.referralCode} for ${REFERRAL_REWARD_DAYS} days FREE Premium on NikNote!`,
                  url: `https://www.niknote.online?ref=${stats.referralCode}`,
                });
              }
            }}
            variant="outline"
            className="rounded-xl h-9 text-xs"
          >
            <Share2 className="h-3.5 w-3.5 mr-1.5" />
            More Options
          </Button>
        </div>
      </div>

      {/* Reward Preview */}
      {showRewardPreview && (
        <div className="px-4 pb-4">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30">
            <div className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              How It Works
            </div>
            <div className="space-y-1.5">
              {[
                "1️⃣ Share your link/code with friends",
                "2️⃣ Friend signs up & tries NikNote",
                `3️⃣ You get ${REFERRAL_REWARD_DAYS} days FREE Premium! 🎉`,
                "4️⃣ No limit — refer 5 friends = 35 days FREE!"
              ].map((step, i) => (
                <div key={i} className="text-[11px] text-amber-700/80">{step}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
