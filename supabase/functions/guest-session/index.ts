import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { readLimitedJson } from '../_shared/aiSecurity.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function randomHex(bytes = 12): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function requesterIp(req: Request): string | null {
  // Prefer the platform's single-address headers. Supabase's gateway appends its
  // observed client address to x-forwarded-for; use the last hop, never the
  // caller-controlled first hop.
  const forwarded = (req.headers.get('x-forwarded-for') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const candidate = (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    forwarded.at(-1) || ''
  ).trim();
  if (!candidate || candidate.length > 128 || /[\s,]/.test(candidate)) return null;
  return candidate;
}

async function guestQuotaBucket(req: Request, secret: string): Promise<string | null> {
  const ip = requesterIp(req);
  if (!ip || !secret) return null;

  // Keying the digest prevents a caller from precomputing another IP's quota
  // bucket from the public edge-function request contract.
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`guest-session-v1:${ip}`)
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function checkGuestCreationQuota(
  adminClient: {
    rpc: (name: string, args: { p_bucket: string; p_limit: number; p_window_seconds: number }) => PromiseLike<{ data: unknown; error: unknown }>;
  },
  req: Request,
  secret: string
): Promise<Response | null> {
  const bucket = await guestQuotaBucket(req, secret);
  if (!bucket) {
    return new Response(JSON.stringify({ error: 'Could not determine request origin' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await adminClient.rpc('consume_anon_quota', {
    p_bucket: bucket,
    p_limit: 5,
    p_window_seconds: 3600,
  });
  if (error) {
    return new Response(JSON.stringify({ error: 'Guest sign-in is temporarily unavailable' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const quota = Array.isArray(data) ? data[0] : data;
  if (!quota || typeof quota.allowed !== 'boolean') {
    return new Response(JSON.stringify({ error: 'Guest sign-in is temporarily unavailable' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!quota.allowed) {
    const resetAt = typeof quota.reset_at === 'string' ? Date.parse(quota.reset_at) : NaN;
    const retryAfter = Number.isFinite(resetAt)
      ? String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)))
      : '3600';
    return new Response(JSON.stringify({ error: 'Guest creation rate limit exceeded' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': retryAfter },
    });
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const parsed = await readLimitedJson(req, 8192);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.reason === 'too_large' ? 'Request body too large' : 'Invalid JSON body' }), {
      status: parsed.reason === 'too_large' ? 413 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const body = parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)
    ? parsed.value as Record<string, unknown>
    : {};

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const action = String(body.action || 'create');
    if (action !== 'create') {
      return new Response(JSON.stringify({ error: 'Unsupported guest session action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const displayName = String(body.displayName || body.guest_name || body.guestName || body.full_name || '').trim().slice(0, 40) || 'Guest';

    // Resume an already-stored guest credential if valid. Resuming an existing
    // account does not consume a quota slot because no account is created.
    const resumeEmail = String(body.email || '').trim().toLowerCase();
    const resumePassword = String(body.password || '');
    if (resumeEmail || resumePassword) {
      if (!resumeEmail || !resumePassword) {
        return new Response(JSON.stringify({ error: 'Both saved guest credentials are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: resumed, error: resumeErr } = await publicClient.auth.signInWithPassword({
        email: resumeEmail,
        password: resumePassword,
      });
      if (resumeErr || !resumed?.session || !resumed?.user) {
        return new Response(JSON.stringify({ error: 'Saved guest workspace could not be resumed' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (body.displayName) {
        await admin.from('profiles').upsert(
          { user_id: resumed.user.id, display_name: displayName },
          { onConflict: 'user_id' }
        );
      }
      return new Response(
        JSON.stringify({
          access_token: resumed.session.access_token,
          refresh_token: resumed.session.refresh_token,
          user: resumed.user,
          email: resumeEmail,
          password: resumePassword,
          resumed: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Quota state is written through the service-role-only RPC. The RPC itself
    // fixes the per-IP limit and window so neither anon nor authenticated users
    // can choose a bucket or inflate their quota.
    const quotaError = await checkGuestCreationQuota(admin, req, serviceRoleKey);
    if (quotaError) return quotaError;

    const guestId = randomHex(8);
    const email = `guest_${guestId}@guest.niknote.online`;
    const password = `NkGuest!${randomHex(16)}`;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: displayName,
        is_guest: true,
        guest_created_at: new Date().toISOString(),
      },
    });

    if (createErr || !created?.user) {
      return new Response(
        JSON.stringify({ error: createErr?.message || 'Failed to provision guest workspace' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await admin.from('profiles').upsert(
      { user_id: created.user.id, display_name: displayName },
      { onConflict: 'user_id' }
    );

    const { data: signedIn, error: signInErr } = await publicClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInErr || !signedIn?.session) {
      return new Response(
        JSON.stringify({ error: signInErr?.message || 'Failed to sign in guest workspace' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        access_token: signedIn.session.access_token,
        refresh_token: signedIn.session.refresh_token,
        user: signedIn.user,
        email,
        password,
        resumed: false,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unexpected server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
