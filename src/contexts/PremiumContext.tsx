import { FREE_TRIAL } from "@/config/features";
import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type PremiumFeature =
  | "ai_note_generator"
  | "ai_solver"
  | "ai_text_tools"
  | "handwriting_styles"
  | "image_pdf_convert"
  | "voice_to_notes"
  | "ai_flashcards";

const FREE_LIMITS: Record<PremiumFeature, { limit: number; period: "day" | "month" }> = {
  ai_note_generator: { limit: 3, period: "month" },
  ai_solver: { limit: 3, period: "day" },
  ai_text_tools: { limit: 5, period: "day" },
  handwriting_styles: { limit: 1, period: "month" },
  image_pdf_convert: { limit: 2, period: "month" },
  voice_to_notes: { limit: 3, period: "month" },
  ai_flashcards: { limit: 1, period: "month" },
};

interface PremiumContextType {
  isPremium: boolean;
  loading: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  refresh: () => Promise<void>;
  checkFeatureAccess: (feature: PremiumFeature) => { allowed: boolean; used: number; limit: number };
  incrementUsage: (feature: PremiumFeature) => Promise<boolean>;
  usageMap: Record<string, number>;
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined);

export const usePremiumContext = () => {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error("usePremiumContext must be inside PremiumProvider");
  return ctx;
};

export const PremiumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [usageMap, setUsageMap] = useState<Record<string, number>>({});

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const currentDay = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setIsPremium(false);
      setStatus(null);
      setCurrentPeriodEnd(null);
      setLoading(false);
      return;
    }

    try {
      // Mobile-safe: timeout after 8 seconds
      const result = await Promise.race([
        supabase
          .from("user_subscriptions")
          .select("status, current_period_end, plan_code")
          .eq("user_id", user.id)
          .maybeSingle(),
        new Promise<{ data: null; error: { message: 'timeout' } }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 8000)
        )
      ]);

      const { data, error } = result as any;

      if (error) {
        if (error.message === 'timeout') {
          console.warn('Subscription fetch timed out (slow network)');
        } else {
          console.error("Subscription fetch error:", error);
        }
        setIsPremium(false);
      } else if (data) {
        const isActive = data.status === "active";
        const notExpired = data.current_period_end
          ? new Date(data.current_period_end) > new Date()
          : false;
        setIsPremium(isActive && notExpired);
        setStatus(data.status);
        setCurrentPeriodEnd(data.current_period_end);
      } else {
        setIsPremium(false);
        setStatus(null);
        setCurrentPeriodEnd(null);
      }
    } catch (err) {
      // Network error — allow app to function, just set free tier
      console.warn("Premium check failed (network):", err);
      setIsPremium(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchUsage = useCallback(async () => {
    if (!user) return;
    try {
      // Mobile-safe: timeout after 8 seconds
      const result = await Promise.race([
        supabase
          .from("feature_usage")
          .select("feature_name, usage_count, usage_month")
          .eq("user_id", user.id),
        new Promise<{ data: null }>((resolve) =>
          setTimeout(() => resolve({ data: null }), 8000)
        )
      ]);

      const { data } = result as any;

      if (data) {
        const map: Record<string, number> = {};
        data.forEach((row) => {
          map[`${row.feature_name}_${row.usage_month}`] = row.usage_count;
        });
        setUsageMap(map);
      }
    } catch (err) {
      // Silently fail — usage data is optional
      console.warn("Usage fetch failed (network):", err);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
    fetchUsage();
  }, [fetchSubscription, fetchUsage]);

  const checkFeatureAccess = useCallback(
    (feature: PremiumFeature) => {
      if (FREE_TRIAL || isPremium) return { allowed: true, used: 0, limit: Infinity };

      const config = FREE_LIMITS[feature];
      const key = config.period === "month"
        ? `${feature}_${currentMonth}`
        : `${feature}_${currentDay}`;
      const used = usageMap[key] || 0;

      return { allowed: used < config.limit, used, limit: config.limit };
    },
    [isPremium, usageMap, currentMonth, currentDay]
  );

  const incrementUsage = useCallback(
    async (feature: PremiumFeature): Promise<boolean> => {
      if (FREE_TRIAL || isPremium) return true;
      if (!user) return false;

      const access = checkFeatureAccess(feature);
      if (!access.allowed) return false;

      const config = FREE_LIMITS[feature];
      const usageMonth = config.period === "month" ? currentMonth : currentDay;

      try {
        // Upsert usage
        const { error } = await supabase
          .from("feature_usage")
          .upsert(
            {
              user_id: user.id,
              feature_name: feature,
              usage_month: usageMonth,
              usage_count: access.used + 1,
            },
            { onConflict: "user_id,feature_name,usage_month" }
          );

        if (error) {
          console.error("Usage increment failed:", error);
          return false;
        }

        // Update local state
        const key = `${feature}_${usageMonth}`;
        setUsageMap((prev) => ({ ...prev, [key]: access.used + 1 }));
        return true;
      } catch (err) {
        console.error("Usage increment error:", err);
        return false;
      }
    },
    [isPremium, user, checkFeatureAccess, currentMonth, currentDay]
  );

  return (
    <PremiumContext.Provider
      value={{
        isPremium: FREE_TRIAL || isPremium,
        loading,
        status,
        currentPeriodEnd,
        refresh: fetchSubscription,
        checkFeatureAccess,
        incrementUsage,
        usageMap,
      }}
    >
      {children}
    </PremiumContext.Provider>
  );
};
