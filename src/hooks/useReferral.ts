// ============================================================
// NikNote 4.0 — Referral System Hook
// Viral Growth Engine: "Share NikNote, Get Free Premium"
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  successfulReferrals: number;
  rewardDays: number; // Premium days earned from referrals
  pendingRewards: number; // Referrals who signed up but haven't subscribed yet
}

const REFERRAL_REWARD_DAYS = 7; // 7 days premium per successful referral
const MAX_FREE_DAYS_PER_MONTH = 30; // Cap at 1 month free per month

export function useReferral() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStats>({
    referralCode: "",
    totalReferrals: 0,
    successfulReferrals: 0,
    rewardDays: 0,
    pendingRewards: 0,
  });
  const [loading, setLoading] = useState(true);

  // Generate referral code from user ID
  const generateReferralCode = useCallback((userId: string): string => {
    // Create a short, shareable code from user ID
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1 to avoid confusion
    let code = "NIK";
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(userId.charCodeAt(i % userId.length) % chars.length);
    }
    return code;
  }, []);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const code = generateReferralCode(user.id);

      // Get referrals from database
      const { data: referrals, error } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", user.id);

      if (error) {
        console.error("Referral fetch error:", error);
      }

      const totalReferrals = referrals?.length || 0;
      const successfulReferrals = referrals?.filter(r => r.status === "completed")?.length || 0;
      const rewardDays = successfulReferrals * REFERRAL_REWARD_DAYS;
      const pendingRewards = referrals?.filter(r => r.status === "pending")?.length || 0;

      setStats({
        referralCode: code,
        totalReferrals,
        successfulReferrals,
        rewardDays,
        pendingRewards,
      });
    } catch (err) {
      console.error("Referral stats error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, generateReferralCode]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Track a referral when someone signs up with a code
  const trackReferral = useCallback(async (referralCode: string) => {
    if (!user) return false;

    try {
      // Look up who owns this referral code
      const { data: allUsers, error: userError } = await supabase
        .from("profiles")
        .select("id");

      if (userError || !allUsers) return false;

      // Find the referrer by matching generated code
      let referrerId: string | null = null;
      for (const u of allUsers) {
        if (generateReferralCode(u.id) === referralCode) {
          referrerId = u.id;
          break;
        }
      }

      if (!referrerId || referrerId === user.id) return false; // Can't refer yourself

      // Create referral record
      const { error: insertError } = await supabase
        .from("referrals")
        .upsert({
          referrer_id: referrerId,
          referred_id: user.id,
          referral_code: referralCode,
          status: "pending",
          created_at: new Date().toISOString(),
        }, { onConflict: "referred_id" });

      if (insertError) {
        console.error("Referral insert error:", insertError);
        return false;
      }

      // Give referrer 7 days free premium when referred user subscribes
      // (This is triggered in verify-razorpay-payment when a referred user pays)
      return true;
    } catch (err) {
      console.error("Track referral error:", err);
      return false;
    }
  }, [user, generateReferralCode]);

  // Get shareable link
  const getShareLink = useCallback(() => {
    if (!stats.referralCode) return "https://www.niknote.online";
    return `https://www.niknote.online?ref=${stats.referralCode}`;
  }, [stats.referralCode]);

  // Get WhatsApp share text
  const getWhatsAppText = useCallback(() => {
    const link = getShareLink();
    return `🎓 NikNote — AI Notes App for Students! ✨\n\nWrite notes in YOUR handwriting with AI 🖊️\nSolve problems instantly with AI 🧠\nGenerate flashcards, summaries & more!\n\nDownload FREE: ${link}\n\nUse my code: ${stats.referralCode} for 7 days FREE Premium! 🎉`;
  }, [getShareLink, stats.referralCode]);

  // Share via WhatsApp
  const shareViaWhatsApp = useCallback(() => {
    const text = encodeURIComponent(getWhatsAppText());
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }, [getWhatsAppText]);

  // Share via native share API
  const shareNative = useCallback(async () => {
    const link = getShareLink();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "NikNote — AI Notes App",
          text: getWhatsAppText(),
          url: link,
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, [getShareLink, getWhatsAppText]);

  // Copy link
  const copyLink = useCallback(async () => {
    const link = getShareLink();
    try {
      await navigator.clipboard.writeText(link);
      return true;
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    }
  }, [getShareLink]);

  return {
    stats,
    loading,
    trackReferral,
    getShareLink,
    getWhatsAppText,
    shareViaWhatsApp,
    shareNative,
    copyLink,
    REFERRAL_REWARD_DAYS,
  };
}
