// ============================================================
// Editor AI — authenticated, rate-limited streaming AI proxy.
// Provider credentials stay in Supabase Edge Function secrets.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Action =
  | "improve" | "fix_grammar" | "shorten" | "lengthen"
  | "continue" | "translate" | "summarize" | "explain" | "custom";

interface Body {
  action: Action;
  text: string;
  context?: string;
  targetLanguage?: string;
  instruction?: string;
}

const ACTIONS = new Set<Action>([
  "improve", "fix_grammar", "shorten", "lengthen", "continue",
  "translate", "summarize", "explain", "custom",
]);
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;

const SYSTEM_BASE = `You are NikNote's inline writing assistant. You edit or produce text that will directly replace or extend the user's note.
Rules:
- Return ONLY the new text — no preamble, no quotes, no markdown fences, no "Here is…".
- Preserve the user's language (Hindi, English, Hinglish) unless asked to translate.
- Match the tone and register of the original.
- Keep formatting minimal; no headings unless the input had them.`;

function jsonResponse(payload: Record<string, unknown>, status: number) {
  return Response.json(payload, {
    status,
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function buildPrompt(body: Body): { system: string; user: string } {
  const context = body.context
    ? `\n\nSurrounding context (for reference only, do not repeat):\n${body.context}`
    : "";
  switch (body.action) {
    case "improve":
      return { system: SYSTEM_BASE, user: `Improve the clarity, flow and word choice of this text. Keep the meaning identical.\n\nText:\n${body.text}${context}` };
    case "fix_grammar":
      return { system: SYSTEM_BASE, user: `Fix grammar, spelling and punctuation. Do not change meaning or tone.\n\nText:\n${body.text}` };
    case "shorten":
      return { system: SYSTEM_BASE, user: `Rewrite this text to be significantly shorter while keeping every key point.\n\nText:\n${body.text}` };
    case "lengthen":
      return { system: SYSTEM_BASE, user: `Expand this text with more detail, examples and clarification. Keep the original voice.\n\nText:\n${body.text}${context}` };
    case "continue":
      return { system: SYSTEM_BASE, user: `Continue writing from where this text ends. Match the style and topic. Add 1-3 sentences.\n\nText so far:\n${body.text}${context}` };
    case "translate":
      return { system: SYSTEM_BASE, user: `Translate this text to ${body.targetLanguage || "English"}. Keep proper nouns.\n\nText:\n${body.text}` };
    case "summarize":
      return { system: SYSTEM_BASE, user: `Summarize this text in 1-3 concise sentences.\n\nText:\n${body.text}${context}` };
    case "explain":
      return { system: SYSTEM_BASE, user: `Explain this in simple terms suitable for a student. Be clear and concrete.\n\nText:\n${body.text}` };
    case "custom":
      return { system: SYSTEM_BASE, user: `${body.instruction || "Rewrite this text."}\n\nText:\n${body.text}${context}` };
  }
}

function parseBody(value: unknown): Body | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.action !== "string" || !ACTIONS.has(candidate.action as Action)) return null;
  if (typeof candidate.text !== "string" || candidate.text.trim().length === 0 || candidate.text.length > 20_000) return null;
  if (candidate.context !== undefined && (typeof candidate.context !== "string" || candidate.context.length > 8_000)) return null;
  if (candidate.targetLanguage !== undefined && (typeof candidate.targetLanguage !== "string" || candidate.targetLanguage.length > 100)) return null;
  if (candidate.instruction !== undefined && (typeof candidate.instruction !== "string" || candidate.instruction.length > 2_000)) return null;

  return {
    action: candidate.action as Action,
    text: candidate.text,
    context: typeof candidate.context === "string" ? candidate.context : undefined,
    targetLanguage: typeof candidate.targetLanguage === "string" ? candidate.targetLanguage : undefined,
    instruction: typeof candidate.instruction === "string" ? candidate.instruction : undefined,
  };
}

function deltaFromSseLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return null;
  const data = trimmed.slice(5).trim();
  if (!data || data === "[DONE]") return null;
  try {
    const json = JSON.parse(data);
    const delta = json?.choices?.[0]?.delta?.content;
    return typeof delta === "string" ? delta : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" },
    });
  }
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return jsonResponse({ error: "Sign in to use AI writing." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error("Supabase function environment is incomplete");
    return jsonResponse({ error: "AI service is not configured." }, 503);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) return jsonResponse({ error: "Your session is invalid. Please sign in again." }, 401);

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  if (!lovableKey && !openAiKey) {
    return jsonResponse({ error: "AI provider key is missing. Add LOVABLE_API_KEY or OPENAI_API_KEY in Supabase Edge Function secrets." }, 503);
  }

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }
  const body = parseBody(parsed);
  if (!body) return jsonResponse({ error: "Invalid request. Check action and text length." }, 400);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_WINDOW_MS).toISOString();
  const { count, error: rateReadError } = await admin
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", authData.user.id)
    .eq("endpoint", "editor-ai")
    .gte("window_start", windowStart);

  if (rateReadError) {
    console.error("AI rate-limit lookup failed:", rateReadError.message);
    return jsonResponse({ error: "AI service is temporarily unavailable." }, 503);
  }
  if ((count || 0) >= RATE_LIMIT) {
    return jsonResponse({ error: "Hourly AI limit reached. Please try again later." }, 429);
  }
  const { error: rateWriteError } = await admin.from("rate_limits").insert({
    user_id: authData.user.id,
    endpoint: "editor-ai",
    window_start: now.toISOString(),
  });
  if (rateWriteError) {
    console.error("AI rate-limit write failed:", rateWriteError.message);
    return jsonResponse({ error: "AI service is temporarily unavailable." }, 503);
  }

  const { system, user } = buildPrompt(body);
  const useLovable = Boolean(lovableKey);
  const providerUrl = useLovable
    ? "https://ai.gateway.lovable.dev/v1/chat/completions"
    : "https://api.openai.com/v1/chat/completions";
  const model = useLovable
    ? (Deno.env.get("EDITOR_AI_MODEL") || "google/gemini-3.6-flash")
    : (Deno.env.get("EDITOR_AI_OPENAI_MODEL") || "gpt-4o-mini");
  const upstreamHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (useLovable) {
    upstreamHeaders["Lovable-API-Key"] = lovableKey!;
    upstreamHeaders["X-Lovable-AIG-SDK"] = "fetch";
  } else {
    upstreamHeaders.Authorization = `Bearer ${openAiKey}`;
  }

  let upstream: Response;
  try {
    upstream = await fetch(providerUrl, {
      method: "POST",
      headers: upstreamHeaders,
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: req.signal,
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") return new Response(null, { status: 499 });
    console.error("AI provider request failed:", error);
    return jsonResponse({ error: "Could not reach the AI provider. Please try again." }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const providerStatus = upstream.status;
    const providerMessage = await upstream.text().catch(() => "");
    console.error("AI provider returned an error:", providerStatus, providerMessage.slice(0, 300));
    if (providerStatus === 402) return jsonResponse({ error: "AI credits are exhausted. Add credits to the provider account." }, 402);
    if (providerStatus === 429) return jsonResponse({ error: "AI provider is rate-limiting requests. Please wait and retry." }, 429);
    return jsonResponse({ error: "AI provider request failed. Please try again later." }, 502);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffered = "";
  const output = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emitLine = (line: string) => {
        const delta = deltaFromSseLine(line);
        if (delta) controller.enqueue(encoder.encode(delta));
      };
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffered += decoder.decode(value, { stream: true });
          const lines = buffered.split("\n");
          buffered = lines.pop() || "";
          for (const line of lines) emitLine(line);
        }
        buffered += decoder.decode();
        if (buffered.trim()) emitLine(buffered);
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => undefined);
    },
  });

  return new Response(output, {
    headers: {
      ...corsHeaders,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no",
    },
  });
});
