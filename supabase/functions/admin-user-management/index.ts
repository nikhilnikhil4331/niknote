// Admin User Management — list users with full activity, grant/revoke premium,
// adjust coins, ban/unban, delete. Authenticates admin via either:
//   (a) a valid Supabase JWT belonging to a user with role 'admin', OR
//   (b) an admin session token (x-admin-token header) stored in admin_sessions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function sha256(t: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function isAuthorizedAdmin(req: Request): Promise<boolean> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Path A — admin session token
  const adminToken = req.headers.get("x-admin-token");
  if (adminToken) {
    const hash = await sha256(adminToken);
    const { data } = await admin
      .from("admin_sessions")
      .select("id")
      .eq("token_hash", hash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (data) return true;
  }

  // Path B — signed-in user with admin role
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (userData?.user) {
      const { data: role } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (role) return true;
    }
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!(await isAuthorizedAdmin(req))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const raw = await req.text();
    let parsed: any = {};
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }
    const { action, payload = {} } = parsed;
    if (!action) {
      return new Response(JSON.stringify({ error: "Missing action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- LIST ----------
    if (action === "list_users") {
      // Source of truth = auth.users (so OLD signups without a profile row still appear)
      const authUsers: any[] = [];
      for (let page = 1; page <= 20; page++) {
        const { data: pageData, error: pageErr } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (pageErr) break;
        const batch = pageData?.users || [];
        authUsers.push(...batch);
        if (batch.length < 200) break;
      }

      const ids = authUsers.map(u => u.id);
      const [{ data: profileRows }, { data: subs }, { data: rewards }, { data: streaks }, { data: roleRows }] = await Promise.all([
        admin.from("profiles").select("user_id, display_name, avatar_url, created_at, onboarding_completed, use_case").in("user_id", ids),
        admin.from("user_subscriptions").select("user_id, plan_code, status, current_period_end").in("user_id", ids),
        admin.from("user_rewards").select("user_id, coins, total_earned, referral_code").in("user_id", ids),
        admin.from("user_streaks").select("user_id, current_streak, longest_streak, last_active_date").in("user_id", ids),
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      const profileMap = new Map((profileRows || []).map(p => [p.user_id, p]));


      // Counts per user (notebooks, pages, activities in last 7d, ai requests this month)
      const { data: notebookRows } = await admin.from("notebooks").select("user_id");
      const { data: pageRows } = await admin.from("pages").select("id, notebook_id");
      const { data: activityRows } = await admin
        .from("activity_logs")
        .select("user_id, created_at")
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
      const { data: featureRows } = await admin
        .from("feature_usage")
        .select("user_id, feature_name, usage_count, usage_month");

      const notebookCount = new Map<string, number>();
      (notebookRows || []).forEach(r => notebookCount.set(r.user_id, (notebookCount.get(r.user_id) || 0) + 1));
      // Pages via notebook -> user_id
      const notebookOwner = new Map<string, string>();
      // Re-query notebooks with id
      const { data: nbFull } = await admin.from("notebooks").select("id, user_id");
      (nbFull || []).forEach(n => notebookOwner.set(n.id, n.user_id));
      const pageCount = new Map<string, number>();
      (pageRows || []).forEach(p => {
        const uid = notebookOwner.get(p.notebook_id);
        if (uid) pageCount.set(uid, (pageCount.get(uid) || 0) + 1);
      });
      const activity7d = new Map<string, number>();
      const lastActive = new Map<string, string>();
      (activityRows || []).forEach(a => {
        if (!a.user_id) return;
        activity7d.set(a.user_id, (activity7d.get(a.user_id) || 0) + 1);
        const prev = lastActive.get(a.user_id);
        if (!prev || a.created_at > prev) lastActive.set(a.user_id, a.created_at);
      });
      const thisMonth = new Date().toISOString().slice(0, 7);
      const aiUsage = new Map<string, number>();
      (featureRows || []).forEach(f => {
        if (f.usage_month !== thisMonth) return;
        if (f.feature_name.includes("ai") || f.feature_name.includes("solver")) {
          aiUsage.set(f.user_id, (aiUsage.get(f.user_id) || 0) + f.usage_count);
        }
      });

      const adminIds = new Set((roleRows || []).filter(r => r.role === "admin").map(r => r.user_id));

      const now = Date.now();
      const users = authUsers.map((au: any) => {
        const uid = au.id;
        const p: any = profileMap.get(uid) || {};
        const sub = subs?.find(s => s.user_id === uid);
        const rw = rewards?.find(r => r.user_id === uid);
        const st = streaks?.find(s => s.user_id === uid);
        const activeStatus = sub?.status === "active" || sub?.status === "trialing";
        // No end date on an active sub = lifetime/ongoing
        const notExpired = !sub?.current_period_end
          || new Date(sub.current_period_end).getTime() > now;
        const isPremium = !!(activeStatus && notExpired);
        return {
          user_id: uid,
          email: au.email || au.user_metadata?.email || null,
          display_name: p.display_name
            || au.user_metadata?.full_name
            || au.user_metadata?.name
            || (au.email ? au.email.split("@")[0] : null),
          avatar_url: p.avatar_url || au.user_metadata?.avatar_url || null,
          created_at: au.created_at || p.created_at,
          has_profile: !!p.user_id,
          email_confirmed: !!(au.email_confirmed_at || au.confirmed_at),
          provider: au.app_metadata?.provider || "email",
          is_admin: adminIds.has(uid),
          onboarding_completed: p.onboarding_completed ?? false,
          use_case: p.use_case ?? null,
          plan: isPremium ? (sub?.plan_code || "premium") : "free",
          premium_until: isPremium ? (sub?.current_period_end ?? null) : null,
          sub_status: sub?.status || "none",
          coins: rw?.coins ?? 0,
          total_earned: rw?.total_earned ?? 0,
          referral_code: rw?.referral_code ?? null,
          current_streak: st?.current_streak ?? 0,
          longest_streak: st?.longest_streak ?? 0,
          last_active_date: st?.last_active_date ?? null,
          notebooks: notebookCount.get(uid) || 0,
          pages: pageCount.get(uid) || 0,
          activity_7d: activity7d.get(uid) || 0,
          ai_requests_month: aiUsage.get(uid) || 0,
          last_sign_in_at: au.last_sign_in_at || null,
          last_activity_at: lastActive.get(uid) || au.last_sign_in_at || null,
          banned_until: au.banned_until || null,
          is_banned: !!(au.banned_until && new Date(au.banned_until).getTime() > now),
        };
      }).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));


      return Response.json({ users }, { headers: corsHeaders });
    }

    // ---------- USER DETAIL ----------
    if (action === "user_detail") {
      const { user_id } = payload;
      const [acts, features, notebooks] = await Promise.all([
        admin.from("activity_logs").select("*").eq("user_id", user_id)
          .order("created_at", { ascending: false }).limit(100),
        admin.from("feature_usage").select("*").eq("user_id", user_id)
          .order("updated_at", { ascending: false }).limit(50),
        admin.from("notebooks").select("id, title, created_at, updated_at")
          .eq("user_id", user_id).order("updated_at", { ascending: false }).limit(50),
      ]);
      return Response.json({
        activities: acts.data || [],
        features: features.data || [],
        notebooks: notebooks.data || [],
      }, { headers: corsHeaders });
    }

    // ---------- GRANT PREMIUM ----------
    if (action === "grant_premium") {
      const { user_id, days = 30, plan_code = "admin_grant" } = payload;
      const { data: existing } = await admin.from("user_subscriptions")
        .select("current_period_end").eq("user_id", user_id).maybeSingle();
      const base = existing?.current_period_end
        ? Math.max(new Date(existing.current_period_end).getTime(), Date.now())
        : Date.now();
      const end = new Date(base + Number(days) * 86400000).toISOString();
      if (existing) {
        await admin.from("user_subscriptions").update({
          status: "active", plan_code, current_period_end: end,
        }).eq("user_id", user_id);
      } else {
        await admin.from("user_subscriptions").insert({
          user_id, status: "active", plan_code, current_period_end: end,
        });
      }
      return Response.json({ success: true, premium_until: end }, { headers: corsHeaders });
    }

    // ---------- REVOKE PREMIUM ----------
    if (action === "revoke_premium") {
      const { user_id } = payload;
      await admin.from("user_subscriptions").update({
        status: "inactive", current_period_end: new Date().toISOString(),
      }).eq("user_id", user_id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // ---------- SET COINS ----------
    if (action === "set_coins") {
      const { user_id, coins } = payload;
      const { data: existing } = await admin.from("user_rewards")
        .select("user_id").eq("user_id", user_id).maybeSingle();
      if (existing) {
        await admin.from("user_rewards").update({ coins: Number(coins) }).eq("user_id", user_id);
      } else {
        await admin.from("user_rewards").insert({ user_id, coins: Number(coins) });
      }
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // ---------- BAN / UNBAN ----------
    if (action === "ban_user") {
      const { user_id, hours = 87600 } = payload; // default ~10y
      const { error } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: `${hours}h`,
      } as any);
      if (error) throw error;
      return Response.json({ success: true }, { headers: corsHeaders });
    }
    if (action === "unban_user") {
      const { user_id } = payload;
      const { error } = await admin.auth.admin.updateUserById(user_id, {
        ban_duration: "none",
      } as any);
      if (error) throw error;
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // ---------- DELETE ----------
    if (action === "delete_user") {
      const { user_id } = payload;
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) throw error;
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // ---------- MAKE ADMIN / REMOVE ADMIN ----------
    if (action === "set_role") {
      const { user_id, role, grant } = payload; // grant: true|false
      if (grant) {
        await admin.from("user_roles").upsert({ user_id, role }, { onConflict: "user_id,role" });
      } else {
        await admin.from("user_roles").delete().eq("user_id", user_id).eq("role", role);
      }
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-user-management error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
