import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { readLimitedJson } from '../_shared/aiSecurity.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-larprouter-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const MAX_REQUESTS_PER_WINDOW = 50; // 50 requests per hour for writing assist

async function checkRateLimit(
  supabase: any,
  userId: string,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date; unavailable?: boolean }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW * 1000);
  
  const { count, error } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .gte('window_start', windowStart.toISOString());

  if (error) {
    console.error('Rate limit check error:', error);
    return { allowed: false, remaining: 0, resetAt: new Date(now.getTime() + RATE_LIMIT_WINDOW * 1000), unavailable: true };
  }

  const currentCount = count || 0;
  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - currentCount - 1);
  const resetAt = new Date(now.getTime() + RATE_LIMIT_WINDOW * 1000);
  
  if (currentCount >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0, resetAt };
  }

  const { error: insertError } = await supabase.from('rate_limits').insert({
    user_id: userId,
    endpoint,
    window_start: now.toISOString(),
  });
  if (insertError) {
    console.error('Rate limit reservation error:', insertError);
    return { allowed: false, remaining: 0, resetAt, unavailable: true };
  }

  return { allowed: true, remaining, resetAt };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization") || '';
    const token = /^Bearer\s+(\S+)$/i.exec(authHeader)?.[1] || '';
    if (!token) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create client with the user's token for authentication
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user's JWT - getUser validates the token server-side
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error("JWT verification failed:", userError?.message || "No user found");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    console.log(`AI writing assist request from user: ${userId}`);

    // Check rate limit using service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { allowed, remaining, resetAt, unavailable } = await checkRateLimit(adminClient, userId, 'ai-writing-assist');
    if (unavailable) {
      return new Response(JSON.stringify({ error: 'AI rate limit is temporarily unavailable' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!allowed) {
      console.log(`Rate limit exceeded for user: ${userId}`);
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil((resetAt.getTime() - Date.now()) / 1000)
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": resetAt.toISOString()
          } 
        }
      );
    }

    const parsedBody = await readLimitedJson(req, 128 * 1024);
    if (!parsedBody.ok) {
      return new Response(JSON.stringify({ error: parsedBody.reason === 'too_large' ? 'Request body too large' : 'Invalid JSON body' }), {
        status: parsedBody.reason === 'too_large' ? 413 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!parsedBody.value || typeof parsedBody.value !== 'object' || Array.isArray(parsedBody.value)) {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const body = parsedBody.value as Record<string, unknown>;
    const mode = typeof body.mode === 'string' ? body.mode.slice(0, 40) : '';
    const text = typeof body.text === 'string' ? body.text : '';
    const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt : '';

    if (!text.trim()) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (text.length > 64_000 || systemPrompt.length > 12_000) {
      return new Response(JSON.stringify({ error: 'Text or system prompt is too large' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LARPROUTER_API_KEY = (req.headers.get("x-larprouter-key") || Deno.env.get("LARPROUTER_API_KEY") || "").trim();
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

    if (!LARPROUTER_API_KEY && !GROQ_API_KEY && !OPENAI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("No AI provider key configured (LARPROUTER_API_KEY / GROQ_API_KEY)");
    }

    const userPrompt = mode === 'generate' 
      ? `Write about the following topic: ${text}`
      : `Process the following text: ${text}`;

    const upstreamUrl = LARPROUTER_API_KEY
      ? "https://larprouter.com/v1/chat/completions"
      : GROQ_API_KEY
        ? "https://api.groq.com/openai/v1/chat/completions"
        : OPENAI_API_KEY
          ? "https://api.openai.com/v1/chat/completions"
          : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const upstreamKey = LARPROUTER_API_KEY || GROQ_API_KEY || OPENAI_API_KEY || LOVABLE_API_KEY;
    const upstreamModel = LARPROUTER_API_KEY
      ? "deepseek-v4.1-flash"
      : GROQ_API_KEY
        ? "llama-3.3-70b-versatile"
        : OPENAI_API_KEY
          ? "gpt-4o-mini"
          : "google/gemini-3-flash-preview";

    const response = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${upstreamKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: upstreamModel,
        messages: [
          { role: "system", content: systemPrompt || "You are a helpful writing assistant." },
          { role: "user", content: userPrompt }
        ],
        stream: true,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("AI service error");
    }

    // Return the streaming response
    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/event-stream",
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": resetAt.toISOString()
      },
    });
  } catch (error) {
    console.error("AI writing assist error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
