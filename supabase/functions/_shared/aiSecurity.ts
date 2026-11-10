export type AIUserAuthorization =
  | { userId: string; quota: Record<string, unknown> }
  | { response: Response };

function env(name: string): string {
  const runtime = globalThis as unknown as { Deno?: { env?: { get?: (key: string) => string | undefined } } };
  return String(runtime.Deno?.env?.get?.(name) || '').trim();
}

function jsonError(
  status: number,
  error: string,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, ...extraHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Require a real Supabase user token and consume a fixed server-owned hourly
 * quota before any provider-backed AI call. Never trust a client-supplied
 * quota value and fail closed if auth or quota storage is unavailable.
 */
export async function requireAIUser(
  req: Request,
  corsHeaders: Record<string, string>,
  hourlyLimit = 30
): Promise<AIUserAuthorization> {
  const authorization = req.headers.get('authorization') || '';
  const token = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]?.trim() || '';
  if (!token) return { response: jsonError(401, 'authentication_required', corsHeaders) };

  const supabaseUrl = (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/+$/, '');
  const anonKey = env('SUPABASE_ANON_KEY') || env('SUPABASE_PUBLISHABLE_KEY');
  if (!supabaseUrl || !anonKey) {
    return { response: jsonError(503, 'ai_auth_unavailable', corsHeaders) };
  }

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      signal: req.signal,
    });
    if (!userResponse.ok) return { response: jsonError(401, 'invalid_session', corsHeaders) };
    const user = await userResponse.json().catch(() => null);
    if (!user || typeof user.id !== 'string' || !user.id) {
      return { response: jsonError(401, 'invalid_session', corsHeaders) };
    }

    const quotaResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_ai_quota`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_limit: hourlyLimit, p_window_seconds: 3600 }),
      signal: req.signal,
    });
    if (!quotaResponse.ok) {
      return { response: jsonError(503, 'ai_quota_unavailable', corsHeaders) };
    }

    const rows = await quotaResponse.json().catch(() => null);
    const quota = Array.isArray(rows) ? rows[0] : rows;
    if (!quota || typeof quota.allowed !== 'boolean') {
      return { response: jsonError(503, 'ai_quota_unavailable', corsHeaders) };
    }
    if (!quota.allowed) {
      const resetAt = typeof quota.reset_at === 'string' ? Date.parse(quota.reset_at) : NaN;
      const retryAfter = Number.isFinite(resetAt)
        ? String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)))
        : '3600';
      return {
        response: jsonError(429, 'ai_rate_limit_exceeded', corsHeaders, { 'Retry-After': retryAfter }),
      };
    }

    return { userId: user.id, quota };
  } catch {
    return { response: jsonError(503, 'ai_auth_unavailable', corsHeaders) };
  }
}

export type LimitedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: 'too_large' | 'invalid_json' };

/** Read JSON without accepting an unbounded/chunked request body. */
export async function readLimitedJson(req: Request, maximumBytes: number): Promise<LimitedJsonResult> {
  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    return { ok: false, reason: 'too_large' };
  }
  if (!req.body) return { ok: false, reason: 'invalid_json' };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: 'invalid_json' };
  } finally {
    try { reader.releaseLock(); } catch { /* stream may already be cancelled */ }
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, reason: 'invalid_json' };
  }
}
