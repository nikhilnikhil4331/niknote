import { FREE_TRIAL } from "@/config/features";
import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
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
  const mountedRef = useRef(true);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [usageMap, setUsageMap] = useState<Record<string, number>>({});

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const currentDay = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const isLocalOnlyGuest = Boolean(user?.id && String(user.id).startsWith("local-guest-"));

  const fetchSubscription = useCallback(async () => {
    if (!user || isLocalOnlyGuest) {
      if (!mountedRef.current) return;
      setIsPremium(false);
      setStatus(null);
      setCurrentPeriodEnd(null);
      setLoading(false);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const result = await Promise.race([
        supabase
          .from("user_subscriptions")
          .select("status, current_period_end, plan_code")
          .eq("user_id", user.id)
          .maybeSingle(),
        new Promise<{ data: null; error: { message: "timeout" } }>((resolve) => {
          timer = setTimeout(() => resolve({ data: null, error: { message: "timeout" } }), 8000);
        }),
      ]);

      if (!mountedRef.current) return;
      const { data, error } = result as any;

      if (error) {
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
    } catch {
      if (mountedRef.current) setIsPremium(false);
    } finally {
      if (timer) clearTimeout(timer);
      if (mountedRef.current) setLoading(false);
    }
  }, [user, isLocalOnlyGuest]);

  const fetchUsage = useCallback(async () => {
    if (!user || isLocalOnlyGuest) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const result = await Promise.race([
        supabase
          .from("feature_usage")
          .select("feature_name, usage_count, usage_month")
          .eq("user_id", user.id),
        new Promise<{ data: null }>((resolve) => {
          timer = setTimeout(() => resolve({ data: null }), 8000);
        }),
      ]);

      if (!mountedRef.current) return;
      const { data } = result as any;

      if (data) {
        const map: Record<string, number> = {};
        data.forEach((row: any) => {
          map[`${row.feature_name}_${row.usage_month}`] = row.usage_count;
        });
        setUsageMap(map);
      }
    } catch {
      // Usage data is optional
    } finally {
      if (timer) clearTimeout(timer);
    }
  }, [user, isLocalOnlyGuest]);

  useEffect(() => {
    void fetchSubscription();
    void fetchUsage();
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
      const access = checkFeatureAccess(feature);
      if (!access.allowed) return false;

      const config = FREE_LIMITS[feature];
      const usageMonth = config.period === "month" ? currentMonth : currentDay;
      const key = `${feature}_${usageMonth}`;

      if (!user || isLocalOnlyGuest) {
        if (mountedRef.current) {
          setUsageMap((prev) => ({ ...prev, [key]: access.used + 1 }));
        }
        return true;
      }

      try {
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
          return false;
        }

        if (mountedRef.current) {
          setUsageMap((prev) => ({ ...prev, [key]: access.used + 1 }));
        }
        return true;
      } catch {
        return false;
      }
    },
    [isPremium, user, isLocalOnlyGuest, checkFeatureAccess, currentMonth, currentDay]
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
