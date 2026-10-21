// ============================================================
// ai-proxy — one server-side door to the AI providers.
//
// Why: the app shipped VITE_GEMINI_KEY / VITE_GROQ_KEY inside the browser
// bundle, so anyone could copy them and spend the owner's quota. This function
// holds the keys server-side and enforces a per-user hourly quota before any
// provider call.
//
// Contract:
//   POST /functions/v1/ai-proxy
//   Authorization: Bearer <user access token>   (verify_jwt = true)
//   { messages: [{ role, content }], system?, temperature?, maxTokens? }
//   → { content, provider, model, quota: { used, remaining, resetAt } }
//
// Failure modes are explicit so the client can fall back honestly:
//   401 unauthenticated · 429 quota exhausted · 503 provider not configured
//
// It never logs prompt text and never returns provider error bodies verbatim.
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LIMITS = {
  maxMessages: 24,
  maxCharsPerMessage: 8000,
  maxTotalChars: 32000,
};

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizeMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > LIMITS.maxMessages) return null;
  const out: ChatMessage[] = [];
  let total = 0;
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null;
    const role = (raw as { role?: unknown }).role;
    const content = (raw as { content?: unknown }).content;
    if (role !== 'user' && role !== 'assistant' && role !== 'system') return null;
    if (typeof content !== 'string' || !content.trim()) return null;
    if (content.length > LIMITS.maxCharsPerMessage) return null;
    total += content.length;
    out.push({ role, content });
  }
  return total > LIMITS.maxTotalChars ? null : out;
}

async function enforceQuota(req: Request, limit: number): Promise<
  | { ok: true; used: number; remaining: number; resetAt: string }
  | { ok: false; used: number; resetAt: string }
  | { ok: 'error'; message: string }
> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const authHeader = req.headers.get('Authorization') || '';
  if (!supabaseUrl || !anonKey) return { ok: 'error', message: 'server not configured' };

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_ai_quota`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: authHeader,
    },
    body: JSON.stringify({ p_limit: limit, p_window_seconds: 3600 }),
  });

  if (!res.ok) {
    return { ok: 'error', message: res.status === 401 ? 'unauthenticated' : 'quota check failed' };
  }

  const rows = (await res.json()) as Array<{
    allowed: boolean;
    used: number;
    remaining: number;
    reset_at: string;
  }>;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return { ok: 'error', message: 'quota check returned nothing' };

  return row.allowed
    ? { ok: true, used: row.used, remaining: row.remaining, resetAt: row.reset_at }
    : { ok: false, used: row.used, resetAt: row.reset_at };
}

async function callGemini(messages: ChatMessage[], system: string | undefined, temperature: number) {
  const key = Deno.env.get('GEMINI_API_KEY') || '';
  if (!key) return null;
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: messages
          .filter(m => m.role !== 'system')
          .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          })),
        generationConfig: { temperature, maxOutputTokens: 4096 },
      }),
    },
  );

  if (!res.ok) return null;
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((p: { text?: string }) => p?.text || '').join('').trim()
    : '';
  return text ? { content: text, provider: 'gemini', model } : null;
}

async function callGroq(messages: ChatMessage[], system: string | undefined, temperature: number) {
  const key = Deno.env.get('GROQ_API_KEY') || '';
  if (!key) return null;
  const model = Deno.env.get('GROQ_MODEL') || 'llama-3.3-70b-versatile';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages.filter(m => m.role !== 'system'),
      ],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = String(data?.choices?.[0]?.message?.content || '').trim();
  return text ? { content: text, provider: 'groq', model } : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  if (!req.headers.get('Authorization')) {
    return json({ error: 'unauthenticated' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const messages = sanitizeMessages(body.messages);
  if (!messages) return json({ error: 'messages must be 1–24 short text turns' }, 400);

  const system = typeof body.system === 'string' ? body.system.slice(0, 12000) : undefined;
  const temperature = typeof body.temperature === 'number'
    ? Math.min(1, Math.max(0, body.temperature))
    : 0.55;

  const configured = Boolean(Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GROQ_API_KEY'));
  if (!configured) {
    // Honest 503: the client shows "AI is not configured" and can fall back.
    return json({ error: 'provider_not_configured' }, 503);
  }

  const quotaLimit = Number(Deno.env.get('AI_HOURLY_LIMIT') || 40);
  const quota = await enforceQuota(req, Number.isFinite(quotaLimit) ? quotaLimit : 40);

  if (quota.ok === 'error') {
    return json({ error: quota.message === 'unauthenticated' ? 'unauthenticated' : 'quota_unavailable' }, quota.message === 'unauthenticated' ? 401 : 500);
  }
  if (quota.ok === false) {
    return json({ error: 'quota_exhausted', resetAt: quota.resetAt }, 429);
  }

  const result = (await callGemini(messages, system, temperature)) ||
    (await callGroq(messages, system, temperature));

  if (!result) {
    return json({ error: 'provider_failed' }, 502);
  }

  return json({
    ...result,
    quota: { used: quota.used, remaining: quota.remaining, resetAt: quota.resetAt },
  });
});
