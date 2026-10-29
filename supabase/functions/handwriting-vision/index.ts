// Paid handwriting tools use the same server-side vision gateway as NikAI.
// A valid user and active entitlement are checked here before any image is sent.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const fonts = ['caveat', 'kalam', 'patrick-hand', 'shadows-into-light', 'indie-flower', 'dancing-script', 'architects-daughter', 'satisfy', 'gloria-hallelujah', 'covered-by-your-grace', 'rock-salt', 'reenie-beanie', 'homemade-apple', 'nothing-you-could-do', 'cedarville-cursive', 'la-belle-aurore'];
const inks = ['blue', 'black', 'red', 'green', 'purple', 'brown', 'teal', 'orange', 'pink', 'gold', 'navy', 'burgundy'];
const bounded = (value: unknown, low: number, high: number, fallback: number) => {
  const n = typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const url = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !anon || !service) return reply({ error: 'Handwriting service is temporarily unavailable.' }, 503);
  try {
    const authorization = req.headers.get('Authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(authorization)) return reply({ error: 'Please sign in first.' }, 401);
    const userRes = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: authorization } });
    if (!userRes.ok) return reply({ error: 'Please sign in first.' }, 401);
    const user = await userRes.json();
    if (typeof user?.id !== 'string' || !user.id) return reply({ error: 'Please sign in first.' }, 401);
    const adminHeaders = { apikey: service, Authorization: `Bearer ${service}` };
    const entitlement = await fetch(`${url}/rest/v1/user_subscriptions?select=status,current_period_end&user_id=eq.${encodeURIComponent(user.id)}&status=eq.active&current_period_end=gt.${encodeURIComponent(new Date().toISOString())}&limit=1`, { headers: adminHeaders });
    if (!entitlement.ok) return reply({ error: 'Could not check premium access. Please try again.' }, 503);
    const subscriptions = await entitlement.json();
    if (!Array.isArray(subscriptions) || !subscriptions.length) return reply({ error: 'An active Premium pass is required.' }, 403);

    const body = await req.json().catch(() => ({}));
    const kind = body?.kind;
    const image = body?.imageBase64;
    if (kind !== 'style' && kind !== 'ocr') return reply({ error: 'Invalid handwriting request.' }, 400);
    if (typeof image !== 'string' || image.length > 3_500_000 || !/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(image)) {
      return reply({ error: 'Please upload a supported image under 2.5 MB after resizing.' }, 400);
    }

    const rateCheck = await fetch(`${url}/rest/v1/rpc/reserve_handwriting_request`, {
      method: 'POST', headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ _user_id: user.id, _endpoint: `handwriting-vision-${kind}` }),
    });
    if (!rateCheck.ok) return reply({ error: 'Handwriting service is temporarily unavailable.' }, 503);
    const allowed = await rateCheck.json();
    if (allowed === false) return reply({ error: 'Handwriting limit reached. Please try again later.' }, 429);
    if (allowed !== true) return reply({ error: 'Handwriting service is temporarily unavailable.' }, 503);

    const instruction = kind === 'ocr'
      ? 'Read the handwriting in this image. Preserve line breaks and do not invent unclear words. Use [?] for uncertain words. Return only JSON: {"extractedText":"...", "lines":["..."], "confidence":0.0, "warnings":[], "success":true}. If nothing is readable, return success false and an empty string.'
      : `Estimate the closest handwriting style from this photo. This is a visual approximation, not a forensic measurement. Choose suggestedFont from: ${fonts.join(', ')}. Return only JSON with suggestedFont, fontSize (14-40), lineSpacing (24-60), wordSpacing (2-12), inkColor, slant (-15 to 15), strokeThickness (0.5-3), penPressureFeel (0.1-1 visual estimate), baselineJitterAmount (0-5), letterSpacingVariation (0-3), analysisNotes, confidence (0-1), and qualityWarning (string or null).`;
    const gateway = await fetch('https://www.niknote.online/api/ai', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: 'astra-vision', mode: 'vision', stream: false,
        messages: [
          { role: 'system', content: 'Return the requested JSON object only, without markdown or commentary.' },
          { role: 'user', content: instruction, images: [{ dataUrl: image }] },
        ],
      }),
    });
    if (!gateway.ok) return reply({ error: 'AI vision is temporarily unavailable. Please try again.' }, 503);
    const result = await gateway.json();
    if (typeof result?.content !== 'string') return reply({ error: 'AI vision returned an unreadable result. Please try again.' }, 502);
    const text = result.content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { return reply({ error: 'AI vision returned an unreadable result. Please try again.' }, 502); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return reply({ error: 'AI vision returned an unreadable result. Please try again.' }, 502);

    if (kind === 'ocr') {
      const extractedText = typeof parsed.extractedText === 'string' ? parsed.extractedText.slice(0, 50_000) : '';
      const modelLines = Array.isArray(parsed.lines) ? parsed.lines.filter((v: unknown) => typeof v === 'string').map((v: string) => v.slice(0, 5000)).slice(0, 1000) : [];
      const lines = modelLines.length ? modelLines : extractedText.split('\n');
      const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.filter((v: unknown) => typeof v === 'string').slice(0, 10) : [];
      const success = parsed.success !== false && Boolean(extractedText.trim());
      return reply({ extractedText, lines, warnings, confidence: bounded(parsed.confidence, 0, 1, 0), success,
        ...(success ? {} : { error: 'No readable handwriting was found. Try a clearer image.', shouldRetry: true }) });
    }

    if (!fonts.includes(parsed.suggestedFont) || typeof parsed.analysisNotes !== 'string') {
      return reply({ error: 'AI vision could not find a usable style. Try a clearer image.' }, 502);
    }
    const font = parsed.suggestedFont;
    const ink = inks.includes(parsed.inkColor) ? parsed.inkColor : 'blue';
    const drift = bounded(parsed.baselineJitterAmount, 0, 5, 1);
    return reply({
      suggestedFont: font, fontSize: bounded(parsed.fontSize, 14, 40, 24),
      lineSpacing: bounded(parsed.lineSpacing, 24, 60, 32), wordSpacing: bounded(parsed.wordSpacing, 2, 12, 4),
      inkColor: ink, slant: bounded(parsed.slant, -15, 15, 0), strokeThickness: bounded(parsed.strokeThickness, 0.5, 3, 1),
      penPressureFeel: bounded(parsed.penPressureFeel, 0.1, 1, 0.5), baselineJitter: drift > 0.5,
      baselineJitterAmount: drift, strokeRandomness: true, letterSpacingVariation: bounded(parsed.letterSpacingVariation, 0, 3, 0),
      analysisNotes: typeof parsed.analysisNotes === 'string' ? parsed.analysisNotes.slice(0, 1000) : 'This is an approximate visual match.',
      confidence: bounded(parsed.confidence, 0, 1, 0), qualityWarning: typeof parsed.qualityWarning === 'string' ? parsed.qualityWarning.slice(0, 500) : null,
    });
  } catch (error) {
    console.error('Handwriting vision request failed', error);
    return reply({ error: 'Handwriting service is temporarily unavailable. Please try again.' }, 503);
  }
});
