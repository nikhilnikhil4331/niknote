import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Plan period days
const PLAN_PERIOD_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  annual: 365,
  lifetime: 36500, // 100 years = forever
};

async function hmacSha256(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const msgData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeySecret) {
      return new Response(JSON.stringify({ error: "Payment system not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);

    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planCode } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !planCode) {
      return new Response(JSON.stringify({ error: "Missing payment details" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify signature
    const expectedSignature = await hmacSha256(
      razorpayKeySecret,
      `${razorpay_order_id}|${razorpay_payment_id}`
    );

    const expected = new TextEncoder().encode(expectedSignature);
    const supplied = new TextEncoder().encode(String(razorpay_signature));
    let mismatch = expected.length !== supplied.length;
    for (let i = 0; i < expected.length; i++) mismatch = (supplied[i] !== expected[i]) || mismatch;
    if (mismatch) {
      console.error(`Signature mismatch for user ${userId}`);
      return new Response(JSON.stringify({ error: "Payment verification failed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Payment verified for user ${userId}, payment: ${razorpay_payment_id}, plan: ${planCode}`);

    const credentials = btoa(`${Deno.env.get("RAZORPAY_KEY_ID")}:${razorpayKeySecret}`);
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`, { headers: { Authorization: `Basic ${credentials}` } });
    const orderResponse = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(razorpay_order_id)}`, { headers: { Authorization: `Basic ${credentials}` } });
    if (!paymentResponse.ok || !orderResponse.ok) {
      return new Response(JSON.stringify({ error: "Payment provider could not confirm purchase" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const payment = await paymentResponse.json();
    const order = await orderResponse.json();
    const amount = planCode === "weekly" ? 4900 : planCode === "monthly" ? 9900 : 0;
    if (!amount || payment.id !== razorpay_payment_id || payment.order_id !== razorpay_order_id || !["captured", "authorized"].includes(payment.status) || payment.amount !== amount || payment.currency !== "INR" || order.id !== razorpay_order_id || order.amount !== amount || order.currency !== "INR" || order.notes?.user_id !== userId || order.notes?.plan_code !== planCode) {
      return new Response(JSON.stringify({ error: "Purchase details do not match" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { error: activationError } = await adminClient.rpc("activate_verified_purchase", {
      _user_id: userId, _payment_id: razorpay_payment_id, _order_id: razorpay_order_id, _plan_code: planCode, _amount_paise: amount,
    });
    if (activationError) {
      console.error("Failed to activate verified purchase:", activationError);
      return new Response(JSON.stringify({ error: "Failed to activate subscription" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record analytics event
    try {
      await adminClient.from("analytics_events").insert({
        user_id: userId,
        event_type: "payment_success",
        event_data: {
          plan_code: planCode,
          payment_id: razorpay_payment_id,
        },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to record analytics (non-critical):", e);
    }

    console.log(`Subscription activated for ${userId}, plan: ${planCode}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Payment verified and subscription activated!",
      planCode,
      periodDays: PLAN_PERIOD_DAYS[planCode],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
