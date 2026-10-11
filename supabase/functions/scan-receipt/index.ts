// Scan a receipt photo and return a suggested expense (amount, category, note, date)
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const CATEGORIES = ["Food", "Transport", "Shopping", "Bills", "Entertainment", "Education", "Health", "Other"];
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization") ?? "";
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
  if (!user) return json({ error: "Please sign in to scan receipts" }, 401);

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return json({ error: "AI is not configured" }, 500);

  let image: string;
  try {
    ({ image } = await req.json());
  } catch { return json({ error: "Invalid request" }, 400); }
  if (typeof image !== "string" || !/^data:image\/(png|jpe?g|webp);base64,/.test(image)) return json({ error: "Upload a PNG, JPG or WEBP photo" }, 400);
  if (image.length > 7_000_000) return json({ error: "Photo is too large (max 5MB)" }, 400);

  const today = new Date().toISOString().slice(0, 10);
  const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "google/gemini-3.8-flash",
      stream: true,
      messages: [
        { role: "system", content: `You read shop receipts and bills. Reply with ONLY a JSON object: {"amount": number (final total paid), "category": one of ${JSON.stringify(CATEGORIES)}, "note": short merchant/item description (max 40 chars), "date": "YYYY-MM-DD" (receipt date, or ${today} if unreadable), "currency": ISO code}. If it is not a receipt, reply {"error":"not_a_receipt"}.` },
        { role: "user", content: [{ type: "text", text: "Read this receipt." }, { type: "image_url", image_url: { url: image } }] },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const s = upstream.status;
    const msg = s === 429 ? "Too many scans right now — try again in a minute."
      : s === 402 ? "AI credits are used up. Please add credits to continue."
      : "Could not read the receipt. Please try again.";
    return json({ error: msg }, s === 429 || s === 402 || s === 403 ? s : 502);
  }

  const reader = upstream.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop() ?? "";
    for (const l of lines) {
      const d = l.trim().replace(/^data:\s*/, "");
      if (!d || d === "[DONE]" || !l.trim().startsWith("data:")) continue;
      try { text += JSON.parse(d)?.choices?.[0]?.delta?.content ?? ""; } catch { /* partial */ }
    }
  }

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return json({ error: "Could not read the receipt. Try a clearer photo." }, 422);
  let out: any;
  try { out = JSON.parse(match[0]); } catch { return json({ error: "Could not read the receipt. Try a clearer photo." }, 422); }
  if (out.error) return json({ error: "That photo doesn't look like a receipt." }, 422);
  const amount = Number(out.amount);
  if (!amount || amount <= 0) return json({ error: "Couldn't find the total on this receipt." }, 422);
  return json({
    amount: Math.round(amount * 100) / 100,
    category: CATEGORIES.includes(out.category) ? out.category : "Other",
    note: String(out.note ?? "").slice(0, 60),
    date: /^\d{4}-\d{2}-\d{2}$/.test(out.date) ? out.date : today,
    currency: typeof out.currency === "string" ? out.currency.slice(0, 3).toUpperCase() : null,
  });
});
