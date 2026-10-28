import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function inferSegment(institution: string, students: string, plan: string): string {
  const hay = `${institution} ${plan}`.toLowerCase();
  if (/coaching|institute|academy|classes|tuition|tutorial/.test(hay)) return "coaching";
  if (/college|university|polytechnic/.test(hay)) return "college";
  if (/school/.test(hay)) return "school";
  const n = Number(students);
  if (Number.isFinite(n) && n > 0 && n <= 60) return "teacher";
  return "unknown";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const name = clean(body.name, 120);
    const email = clean(body.email, 200).toLowerCase();
    const phone = clean(body.phone, 30);
    const institution = clean(body.institution, 160);
    const message = clean(body.message, 2000);
    const plan = clean(body.plan, 60);
    const studentsRaw = clean(String(body.students ?? ""), 20);
    const students = /^\d{1,6}$/.test(studentsRaw) ? Number(studentsRaw) : null;

    if (!name || !institution || !EMAIL_RE.test(email)) {
      return new Response(
        JSON.stringify({ error: "A valid name, institution and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const segment = inferSegment(institution, studentsRaw, plan);

    // Durable pipeline record. This is the system of record for sales follow-up.
    const { data: lead, error: leadError } = await adminClient
      .from("sales_leads")
      .upsert(
        {
          name,
          email,
          phone: phone || null,
          institution,
          segment,
          students,
          message: message || null,
          plan: plan || null,
          source: "website",
          stage: "new",
        },
        { onConflict: "email,institution", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();

    if (leadError) {
      // Never silently swallow this: a lost lead is lost revenue.
      console.error("sales_leads insert failed:", leadError);
    }

    // Keep the legacy event trail so existing dashboards keep working.
    const { error: eventError } = await adminClient.from("analytics_events").insert({
      event_type: "b2b_lead",
      event_data: {
        name,
        email,
        phone,
        institution,
        students: studentsRaw,
        plan,
        segment,
        lead_id: lead?.id ?? null,
        source: "niknote_website",
        timestamp: new Date().toISOString(),
      },
    });
    if (eventError) console.error("Analytics save error:", eventError);

    if (leadError) {
      return new Response(
        JSON.stringify({ error: "Could not save your details. Please email us directly." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`B2B LEAD stored: ${name} | ${institution} | ${segment} | ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Received. We will reply within one working day.",
        leadId: lead?.id ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
