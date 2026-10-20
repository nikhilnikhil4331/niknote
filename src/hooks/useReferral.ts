// ============================================================
// NikNote 4.0 — Referral System Hook
// Viral Growth Engine: "Share NikNote, Get Free Premium"
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const REFERRAL_REWARD_DAYS = 7;
const PENDING_REFERRAL_KEY = "niknote:pending_referral";

type ReferralRow = {
  status: string | null;
  premium_days_awarded: number | null;
};

export interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  successfulReferrals: number;
  rewardDays: number; // Premium days earned from referrals
  pendingRewards: number; // Referrals who signed up but haven't subscribed yet
}

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

  const fetchStats = useCallback(async () => {
    if (!user) {
      setStats({ referralCode: "", totalReferrals: 0, successfulReferrals: 0, rewardDays: 0, pendingRewards: 0 });
      setLoading(false);
      return;
    }

    try {
      const [{ data: code, error: codeError }, { data: referrals, error }] = await Promise.all([
        supabase.rpc("get_or_create_referral_code"),
        supabase.from("referrals").select("status, premium_days_awarded").eq("referrer_id", user.id),
      ]);

      if (codeError) console.error("Referral code fetch error:", codeError);
      if (error) console.error("Referral fetch error:", error);

      const rows = (referrals ?? []) as ReferralRow[];
      const successfulReferrals = rows.filter((referral) => referral.status === "completed").length;
      const rewardDays = rows.reduce((sum, referral) => sum + Number(referral.premium_days_awarded || 0), 0);
      const pendingRewards = rows.filter((referral) => referral.status === "pending").length;

      setStats({
        referralCode: typeof code === "string" ? code : "",
        totalReferrals: rows.length,
        successfulReferrals,
        rewardDays,
        pendingRewards,
      });
    } catch (err) {
      console.error("Referral stats error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Save referral links for guests, then attribute them after their first sign-in.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const referralFromUrl = url.searchParams.get("ref")?.trim();
    if (referralFromUrl) {
      try {
        window.localStorage.setItem(PENDING_REFERRAL_KEY, referralFromUrl);
        url.searchParams.delete("ref");
        window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      } catch (err) {
        console.error("Could not save referral attribution:", err);
      }
    }

    if (!user) return;
    let active = true;
    let pendingCode: string | null = null;
    try {
      pendingCode = window.localStorage.getItem(PENDING_REFERRAL_KEY);
    } catch (err) {
      console.error("Could not read referral attribution:", err);
      return;
    }
    if (!pendingCode) return;

    void (async () => {
      try {
        const { error } = await supabase.rpc("track_referral", { p_referral_code: pendingCode });
        if (!active) return;
        if (error) {
          console.error("Referral attribution failed:", error);
          return;
        }
        window.localStorage.removeItem(PENDING_REFERRAL_KEY);
        await fetchStats();
      } catch (err) {
        console.error("Referral attribution failed:", err);
      }
    })();

    return () => {
      active = false;
    };
  }, [user, fetchStats]);

  // Track a referral through a database function; referral owners are not exposed to clients.
  const trackReferral = useCallback(async (referralCode: string) => {
    if (!user || !referralCode.trim()) return false;

    try {
      const { data, error } = await supabase.rpc("track_referral", {
        p_referral_code: referralCode.trim(),
      });
      if (error) {
        console.error("Referral insert error:", error);
        return false;
      }
      await fetchStats();
      return data === true;
    } catch (err) {
      console.error("Track referral error:", err);
      return false;
    }
  }, [user, fetchStats]);

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
