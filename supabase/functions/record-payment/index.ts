import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role client to verify user token
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Extract token and verify it using getUser with the token
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error("JWT verification failed:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerId = userData.user.id;
    console.log(`Authenticated user: ${callerId}`);
    
    // Parse request body
    const body = await req.json();
    const { planCode, userId, status } = body;

    // Check if caller is admin (for admin operations)
    const { data: adminCheck } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();

    const isAdmin = !!adminCheck;
    console.log(`User ${callerId} is admin: ${isAdmin}`);

    // Admin operation: toggle premium for another user
    if (userId && isAdmin) {
      console.log(`Admin ${callerId} updating user ${userId} to status: ${status || 'active'}`);
      
      const newStatus = status || "active";
      const periodDays = newStatus === "active" ? 30 : 0;
      const periodEnd = newStatus === "active" 
        ? new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { error: upsertError } = await adminClient
        .from("user_subscriptions")
        .upsert(
          {
            user_id: userId,
            plan_code: planCode || "admin_granted",
            status: newStatus,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        console.error("Failed to update subscription:", upsertError);
        return new Response(
          JSON.stringify({ error: "Failed to update subscription" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Successfully updated subscription for ${userId}`);
      return new Response(
        JSON.stringify({ success: true, message: `User subscription ${newStatus}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin trying to update user but not admin
    if (userId && !isAdmin) {
      console.error(`Non-admin ${callerId} tried to update user ${userId}`);
      return new Response(
        JSON.stringify({ error: "Forbidden: Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Use verified checkout to activate a subscription" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in record-payment function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
