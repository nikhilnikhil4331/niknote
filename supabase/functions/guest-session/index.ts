import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

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

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = String(body?.action || 'create');
    const displayName = String(body?.displayName || '').trim().slice(0, 40) || 'Guest';

    // Upgrade existing guest account to real permanent email + password keeping the EXACT SAME UUID
    if (action === 'upgrade') {
      const authHeader = req.headers.get('Authorization') || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const newEmail = String(body?.newEmail || '').trim().toLowerCase();
      const newPassword = String(body?.newPassword || '');
      const fullName = String(body?.fullName || displayName).trim().slice(0, 60) || 'NikNote User';

      if (!token || !newEmail || newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: 'Valid email and password (min 6 chars) required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: caller, error: callerErr } = await admin.auth.getUser(token);
      if (callerErr || !caller?.user) {
        return new Response(
          JSON.stringify({ error: 'Guest session expired. Please retry.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updErr } = await admin.auth.admin.updateUserById(caller.user.id, {
        email: newEmail,
        password: newPassword,
        email_confirm: true,
        user_metadata: {
          ...caller.user.user_metadata,
          full_name: fullName,
          is_guest: false,
          upgraded_at: new Date().toISOString(),
        },
      });

      if (updErr) {
        return new Response(
          JSON.stringify({ error: updErr.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await admin.from('profiles').upsert(
        { user_id: caller.user.id, display_name: fullName },
        { onConflict: 'user_id' }
      );

      const { data: signed, error: signErr } = await publicClient.auth.signInWithPassword({
        email: newEmail,
        password: newPassword,
      });

      if (signErr || !signed.session) {
        return new Response(
          JSON.stringify({ upgraded: true, user_id: caller.user.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          upgraded: true,
          access_token: signed.session.access_token,
          refresh_token: signed.session.refresh_token,
          user: signed.user,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resume an already-stored guest credential if valid
    const resumeEmail = String(body?.email || '').trim().toLowerCase();
    const resumePassword = String(body?.password || '');
    if (resumeEmail && resumePassword) {
      const { data: resumed, error: resumeErr } = await publicClient.auth.signInWithPassword({
        email: resumeEmail,
        password: resumePassword,
      });
      if (!resumeErr && resumed?.session && resumed?.user) {
        if (body?.displayName) {
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
    }

    // Create a brand-new real cloud guest session immediately
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
