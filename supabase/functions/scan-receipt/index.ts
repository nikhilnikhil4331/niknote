// Scan a receipt photo and return a suggested expense (amount, category, note, date).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Education", "Health", "Other"];
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: {
    ...corsHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" },
    });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return json({ error: "Please sign in to scan receipts" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Receipt service is not configured" }, 503);

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Please sign in to scan receipts" }, 401);

  let image: unknown;
  try {
    const body = await req.json();
    image = body?.image;
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
  if (typeof image !== "string" || !/^data:image\/(png|jpe?g|webp);base64,/.test(image)) {
    return json({ error: "Upload a PNG, JPG or WEBP photo" }, 400);
  }
  if (image.length > 7_000_000) return json({ error: "Photo is too large (max 5MB)" }, 413);

  const providerKey = Deno.env.get("LOVABLE_API_KEY");
  if (!providerKey) return json({ error: "Receipt AI is not configured. Add LOVABLE_API_KEY to Supabase Edge Function secrets." }, 503);

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const now = new Date();
  const since = new Date(now.getTime() - RATE_WINDOW_MS).toISOString();
  const { count, error: countError } = await admin
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", authData.user.id)
    .eq("endpoint", "scan-receipt")
    .gte("window_start", since);
  if (countError) {
    console.error("Receipt rate-limit lookup failed:", countError.message);
    return json({ error: "Receipt service is temporarily unavailable" }, 503);
  }
  if ((count || 0) >= RATE_LIMIT) return json({ error: "Hourly receipt scan limit reached. Please try again later." }, 429);
  const { error: insertError } = await admin.from("rate_limits").insert({
    user_id: authData.user.id,
    endpoint: "scan-receipt",
    window_start: now.toISOString(),
  });
  if (insertError) {
    console.error("Receipt rate-limit write failed:", insertError.message);
    return json({ error: "Receipt service is temporarily unavailable" }, 503);
  }

  const today = now.toISOString().slice(0, 10);
  let upstream: Response;
  try {
    upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": providerKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: Deno.env.get("SCAN_RECEIPT_MODEL") || "google/gemini-3.8-flash",
        stream: true,
        messages: [
          {
            role: "system",
            content: `You read shop receipts and bills. Reply with ONLY a JSON object: {"amount": number (final total paid), "category": one of ${JSON.stringify(CATEGORIES)}, "note": short merchant/item description (max 40 chars), "date": "YYYY-MM-DD" (receipt date, or ${today} if unreadable), "currency": ISO code}. If it is not a receipt, reply {"error":"not_a_receipt"}.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Read this receipt." },
              { type: "image_url", image_url: { url: image } },
            ],
          },
        ],
      }),
      signal: req.signal,
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") return new Response(null, { status: 499 });
    console.error("Receipt AI provider request failed:", error);
    return json({ error: "Could not reach the AI provider. Please try again." }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status;
    const text = await upstream.text().catch(() => "");
    console.error("Receipt AI provider returned an error:", status, text.slice(0, 300));
    if (status === 429) return json({ error: "Too many scans right now — try again in a minute." }, 429);
    if (status === 402) return json({ error: "AI credits are used up. Please add credits to continue." }, 402);
    return json({ error: "Could not read the receipt. Please try again." }, 502);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim().startsWith("data:")) continue;
        const data = line.trim().replace(/^data:\s*/, "");
        if (!data || data === "[DONE]") continue;
        try { text += JSON.parse(data)?.choices?.[0]?.delta?.content ?? ""; } catch { /* incomplete SSE frame */ }
      }
    }
    buffer += decoder.decode();
    if (buffer.trim().startsWith("data:")) {
      const data = buffer.trim().replace(/^data:\s*/, "");
      try { text += JSON.parse(data)?.choices?.[0]?.delta?.content ?? ""; } catch { /* trailing partial */ }
    }
  } catch (error) {
    console.error("Receipt AI stream failed:", error);
    return json({ error: "Receipt processing was interrupted. Please try again." }, 502);
  } finally {
    reader.releaseLock();
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return json({ error: "Could not read the receipt. Try a clearer photo." }, 422);
  let result: Record<string, unknown>;
  try { result = JSON.parse(match[0]); } catch { return json({ error: "Could not read the receipt. Try a clearer photo." }, 422); }
  if (result.error) return json({ error: "That photo doesn't look like a receipt." }, 422);
  const amount = Number(result.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
    return json({ error: "Couldn't find a valid total on this receipt." }, 422);
  }

  const date = typeof result.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(result.date)
    ? result.date
    : today;
  return json({
    amount: Math.round(amount * 100) / 100,
    category: CATEGORIES.includes(String(result.category)) ? result.category : "Other",
    note: String(result.note ?? "").slice(0, 60),
    date,
    currency: typeof result.currency === "string" ? result.currency.slice(0, 3).toUpperCase() : null,
  });
});
