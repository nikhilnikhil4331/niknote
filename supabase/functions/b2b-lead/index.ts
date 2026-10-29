// Public inquiry form. The service role saves one durable lead; no personal
// contact details are copied into analytics or application logs.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (value: unknown, max = 200) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function inferSegment(institution: string, students: number | null): string {
  const name = institution.toLowerCase();
  if (/coaching|institute|academy|classes|tuition|tutorial/.test(name)) return 'coaching';
  if (/college|university|polytechnic/.test(name)) return 'college';
  if (/school/.test(name)) return 'school';
  if (students && students <= 60) return 'teacher';
  return 'unknown';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) return reply({ error: 'Inquiry service unavailable. Please email support.' }, 503);

  let body: any;
  try {
    const raw = await req.text();
    if (raw.length > 12000) return reply({ error: 'Inquiry is too long' }, 413);
    body = JSON.parse(raw);
  } catch {
    return reply({ error: 'Invalid inquiry' }, 400);
  }
  try {
    const name = clean(body?.name, 120);
    const email = clean(body?.email, 200).toLowerCase();
    const institution = clean(body?.institution, 160);
    const phone = clean(body?.phone, 30);
    const message = clean(body?.message, 2000);
    const rawStudents = clean(String(body?.students ?? ''), 20);
    const students = /^\d{1,6}$/.test(rawStudents) && Number(rawStudents) > 0 ? Number(rawStudents) : null;
    if (!name || !institution || !emailPattern.test(email)) {
      return reply({ error: 'A valid name, institution and email are required' }, 400);
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/sales_leads?on_conflict=email,institution&select=id`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify({
        name, email, institution, phone: phone || null, message: message || null,
        students, segment: inferSegment(institution, students),
        plan: 'institution_inquiry', source: 'website', stage: 'new',
      }),
    });
    if (!res.ok) {
      console.error('Could not save institution inquiry', res.status);
      return reply({ error: 'Could not save your inquiry. Please email support.' }, 503);
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length !== 1) {
      // The old message was not changed: do not claim a repeat inquiry was saved.
      return reply({ error: 'An inquiry already exists for this email and institution. Please email support to add details.' }, 409);
    }
    return reply({ success: true, message: 'Inquiry received.' });
  } catch {
    return reply({ error: 'Could not save your inquiry. Please email support.' }, 503);
  }
});
