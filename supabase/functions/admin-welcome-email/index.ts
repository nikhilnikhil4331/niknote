/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase Auth/PostgREST responses are runtime-validated by the function. */
// Admin-only, one-recipient-per-message welcome email sender. It deliberately
// accepts only the fixed NikNote welcome template; no HTML or recipient address
// is accepted from the browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { buildNikNoteWelcomeEmail, NIKNOTE_WELCOME_TEMPLATE_ID } from "../_shared/admin-welcome-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { ...corsHeaders, "Cache-Control": "no-store" },
});
const MAX_RECIPIENTS_PER_SEND = 25;
const MAX_RECIPIENTS_IN_LIST = 200;
const ALLOWED_RECENT_DAYS = new Set([7, 30, 90]);
const GUEST_EMAIL_SUFFIX = "@guest.niknote.online";

function isEmailAddress(value: string): boolean {
  return value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeDisplayName(user: any, email: string): string {
  const metadata = user?.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
  const preferred = [metadata.full_name, metadata.name, metadata.display_name]
    .find((value) => typeof value === "string" && value.trim());
  const raw = typeof preferred === "string"
    ? preferred
    : email.split("@")[0].replace(/[._+-]+/g, " ").replace(/\b\p{L}/gu, (letter: string) => letter.toUpperCase());
  return Array.from(raw, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("").replace(/\s+/g, " ").trim().slice(0, 100) || "creator";
}

function isConfirmedEmailUser(user: any): boolean {
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  return !!(user?.email_confirmed_at || user?.confirmed_at)
    && isEmailAddress(email)
    && !email.endsWith(GUEST_EMAIL_SUFFIX);
}

function isWithinWindow(user: any, days: number, now = Date.now()): boolean {
  const createdAt = Date.parse(user?.created_at || "");
  return Number.isFinite(createdAt) && createdAt >= now - days * 24 * 60 * 60 * 1000 && createdAt <= now + 60_000;
}

function toRecipient(user: any, alreadySentAt?: string | null) {
  const email = String(user.email).trim().toLowerCase();
  return {
    user_id: user.id,
    email,
    display_name: safeDisplayName(user, email),
    created_at: user.created_at,
    already_sent: !!alreadySentAt,
    sent_at: alreadySentAt || null,
  };
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isAuthorizedAdmin(req: Request, admin: any, supabaseUrl: string, anonKey: string): Promise<boolean> {
  const token = req.headers.get("x-admin-token") || "";
  if (token && token.length <= 256) {
    const { data: session, error } = await admin
      .from("admin_sessions")
      .select("id")
      .eq("token_hash", await sha256(token))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!error && session) return true;
  }

  const authorization = req.headers.get("Authorization") || "";
  if (/^Bearer\s+\S+$/i.test(authorization) && anonKey) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (userId) {
      const { data: role, error } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!error && role) return true;
    }
  }
  return false;
}

async function loadUsers(admin: any): Promise<{ users: any[]; truncated: boolean }> {
  const users: any[] = [];
  const maxPages = 20;
  let truncated = false;
  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error("Could not load registered users");
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < 200) return { users, truncated: false };
  }
  truncated = true;
  return { users, truncated };
}

async function getAdminIds(admin: any, ids: string[]): Promise<Set<string>> {
  const adminIds = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const batch = ids.slice(offset, offset + 200);
    if (!batch.length) continue;
    const { data, error } = await admin.from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .in("user_id", batch);
    if (error) throw new Error("Could not verify recipient eligibility");
    (data || []).forEach((row: any) => adminIds.add(row.user_id));
  }
  return adminIds;
}

async function loadSentWelcomeLogs(admin: any, ids: string[]): Promise<Map<string, string>> {
  const sentAt = new Map<string, string>();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const batch = ids.slice(offset, offset + 200);
    if (!batch.length) continue;
    const { data, error } = await admin.from("customer_email_logs")
      .select("user_id, created_at")
      .eq("template_id", NIKNOTE_WELCOME_TEMPLATE_ID)
      .eq("status", "sent")
      .in("user_id", batch)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Could not check welcome email history");
    (data || []).forEach((row: any) => {
      if (row.user_id && !sentAt.has(row.user_id)) sentAt.set(row.user_id, row.created_at);
    });
  }
  return sentAt;
}

async function listRecipients(admin: any, days: number) {
  const { users, truncated: usersTruncated } = await loadUsers(admin);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recent = users
    .filter((user: any) => isConfirmedEmailUser(user) && isWithinWindow(user, days) && Date.parse(user.created_at) >= cutoff)
    .sort((a: any, b: any) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const candidateUsers = recent.slice(0, MAX_RECIPIENTS_IN_LIST);
  const adminIds = await getAdminIds(admin, candidateUsers.map((user: any) => user.id));
  const eligibleUsers = candidateUsers.filter((user: any) => !adminIds.has(user.id));
  const sentAt = await loadSentWelcomeLogs(admin, eligibleUsers.map((user: any) => user.id));
  const recipients = eligibleUsers.map((user: any) => toRecipient(user, sentAt.get(user.id)));
  return {
    recipients,
    truncated: usersTruncated || recent.length > MAX_RECIPIENTS_IN_LIST,
    recentDays: days,
    templateId: NIKNOTE_WELCOME_TEMPLATE_ID,
    maxRecipientsPerSend: MAX_RECIPIENTS_PER_SEND,
  };
}

async function loadResendConfig(admin: any) {
  const { data, error } = await admin.from("mailflare_config")
    .select("provider, resend_api_key, from_name, from_email, reply_to")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw new Error("Welcome email configuration is unavailable");

  const apiKey = typeof data?.resend_api_key === "string" ? data.resend_api_key.trim() : "";
  const fromEmail = typeof data?.from_email === "string" ? data.from_email.trim().toLowerCase() : "";
  const fromName = (typeof data?.from_name === "string" ? data.from_name : "NikNote")
    .replace(/[^A-Za-z0-9 ._-]/g, "").trim().slice(0, 80) || "NikNote";
  const replyToValue = typeof data?.reply_to === "string" ? data.reply_to.trim().toLowerCase() : "";
  const replyTo = isEmailAddress(replyToValue) ? replyToValue : "";
  if (data?.provider !== "resend" || !apiKey || !isEmailAddress(fromEmail)) {
    throw new Error("Welcome email is not configured");
  }
  return { apiKey, fromEmail, fromName, replyTo };
}

async function sendWelcomeBatch(admin: any, ids: string[], days: number) {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_RECIPIENTS_PER_SEND || !ids.every(isUuid)) {
    return { status: 400, body: { error: `Choose between 1 and ${MAX_RECIPIENTS_PER_SEND} valid recipients.` } };
  }
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length !== ids.length) {
    return { status: 400, body: { error: "Duplicate recipients are not allowed." } };
  }

  const lookups = await Promise.all(uniqueIds.map(async (id) => {
    const { data, error } = await admin.auth.admin.getUserById(id);
    if (error && error.status !== 404) throw new Error("Could not verify recipient accounts");
    return data?.user || null;
  }));
  const idToUser = new Map<string, any>();
  lookups.forEach((user, index) => { if (user) idToUser.set(uniqueIds[index], user); });
  const existingIds = uniqueIds.filter((id) => idToUser.has(id));
  const adminIds = await getAdminIds(admin, existingIds);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const sentAt = await loadSentWelcomeLogs(admin, existingIds);

  const eligible: any[] = [];
  const results: Array<{ user_id: string; email?: string; status: "accepted" | "skipped" | "failed"; reason?: string; audit_logged?: boolean }> = [];
  for (let index = 0; index < uniqueIds.length; index += 1) {
    const id = uniqueIds[index];
    const user = idToUser.get(id);
    const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
    if (!user || !isConfirmedEmailUser(user) || !isWithinWindow(user, days) || Date.parse(user.created_at) < cutoff || adminIds.has(id)) {
      results.push({ user_id: id, ...(email ? { email } : {}), status: "skipped", reason: "not_eligible" });
      continue;
    }
    if (sentAt.has(id)) {
      results.push({ user_id: id, email, status: "skipped", reason: "already_sent" });
      continue;
    }
    eligible.push({ user, email });
  }

  if (eligible.length === 0) {
    return { status: 200, body: { results, accepted: 0, skipped: results.length, failed: 0 } };
  }

  const sender = await loadResendConfig(admin);
  // One message per recipient keeps addresses private and makes partial outcomes explicit.
  for (const { user, email } of eligible) {
    const rendered = buildNikNoteWelcomeEmail(safeDisplayName(user, email));
    let providerMessageId: string | null = null;
    let sendError: string | null = null;
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sender.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `${NIKNOTE_WELCOME_TEMPLATE_ID}-${user.id}`,
        },
        body: JSON.stringify({
          from: `${sender.fromName} <${sender.fromEmail}>`,
          to: [email],
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
          ...(sender.replyTo ? { reply_to: sender.replyTo } : {}),
          tags: [
            { name: "purpose", value: "transactional" },
            { name: "label", value: "welcome-email" },
          ],
        }),
      });
      if (!response.ok) {
        sendError = `Resend returned HTTP ${response.status}`;
      } else {
        const providerResult = await response.json().catch(() => ({}));
        providerMessageId = typeof providerResult?.id === "string" ? providerResult.id : null;
      }
    } catch {
      sendError = "Email provider request failed";
    }

    const logStatus = sendError ? "failed" : "sent";
    const { error: logError } = await admin.from("customer_email_logs").insert({
      recipient_email: email,
      recipient_name: safeDisplayName(user, email),
      user_id: user.id,
      from_address: `${sender.fromName} <${sender.fromEmail}>`,
      subject: rendered.subject,
      template_id: NIKNOTE_WELCOME_TEMPLATE_ID,
      provider: "resend",
      status: logStatus,
      provider_message_id: providerMessageId,
      error_message: sendError,
      metadata: { template_version: 1, source: "admin-panel" },
    });
    if (logError) console.error("Welcome email audit log insert failed");

    results.push(sendError
      ? { user_id: user.id, email, status: "failed", reason: sendError, audit_logged: !logError }
      : { user_id: user.id, email, status: "accepted", audit_logged: !logError });
  }

  return {
    status: 200,
    body: {
      results,
      accepted: results.filter((result) => result.status === "accepted").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      failed: results.filter((result) => result.status === "failed").length,
      provider: "resend",
    },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey || !anonKey) return reply({ error: "Welcome email service unavailable" }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (!(await isAuthorizedAdmin(req, admin, supabaseUrl, anonKey))) {
      return reply({ error: "Admin access required" }, 401);
    }

    let requestBody: any;
    try { requestBody = await req.json(); } catch { return reply({ error: "Invalid JSON body" }, 400); }
    const action = requestBody?.action;
    const payload = requestBody?.payload && typeof requestBody.payload === "object" ? requestBody.payload : {};
    if (action === "list_recipients") {
      const days = Number(payload.days);
      if (!ALLOWED_RECENT_DAYS.has(days)) return reply({ error: "Choose a 7, 30, or 90 day signup window." }, 400);
      return reply(await listRecipients(admin, days));
    }
    if (action === "send_welcome") {
      const days = Number(payload.days);
      if (!ALLOWED_RECENT_DAYS.has(days)) return reply({ error: "Choose a 7, 30, or 90 day signup window." }, 400);
      const result = await sendWelcomeBatch(admin, payload.user_ids, days);
      return reply(result.body, result.status);
    }
    return reply({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("Admin welcome email request failed:", error instanceof Error ? error.message : "unknown error");
    return reply({ error: "Welcome email service is temporarily unavailable" }, 503);
  }
});
