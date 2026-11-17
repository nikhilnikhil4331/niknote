import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { readLimitedJson } from "../_shared/aiSecurity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_BODY_BYTES = 100_000;
const MAX_CONTENT_CHARS = 16_000;

const RATE_LIMIT_WINDOW = 3600;
const MAX_REQUESTS_PER_WINDOW = 30;

type ProcessMode = 'solve' | 'improve' | 'summarize' | 'rewrite' | 'explain' | 'template' | 'notes';
type UserMode = 'student' | 'college' | 'professional';
const processModes: ProcessMode[] = ['solve', 'improve', 'summarize', 'rewrite', 'explain', 'template', 'notes'];
const userModes: UserMode[] = ['student', 'college', 'professional'];

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
  if (currentCount >= MAX_REQUESTS_PER_WINDOW) return { allowed: false, remaining: 0, resetAt };

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

function jsonResponse(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, ...headers, "Content-Type": "application/json" },
  });
}

function getSystemPrompt(processMode: ProcessMode, userMode: UserMode): string {
  const toneGuide: Record<UserMode, string> = {
    student: "Use simple, clear language suitable for school students (grades 6-12). Be friendly and educational. Include examples when helpful.",
    college: "Use academic language appropriate for university students. Be thorough and include relevant references or context.",
    professional: "Use formal, business-appropriate language. Be concise and action-oriented. Focus on key insights.",
  };
  const modePrompts: Record<ProcessMode, string> = {
    solve: "You are an expert tutor and problem solver. Give a clear step-by-step solution, explain the concepts, highlight the final answer, and add tips for similar problems.",
    improve: "You are a professional writing assistant. Fix grammar and spelling, improve clarity and structure, and preserve the original meaning.",
    summarize: "You are an expert at creating concise, accurate summaries. Capture the key ideas and make the answer easy to scan.",
    rewrite: "You are a skilled rewriter. Express the same ideas in fresh language, improve readability, preserve facts, and match the requested tone.",
    explain: "You are a patient teacher. Break down complex concepts, define key terms, use useful examples, and build understanding step by step.",
    template: "You are an expert at creating well-formatted documents. Use an appropriate title, headings, introduction, main sections, and conclusion.",
    notes: "You are a study-notes expert. Organize the content with clear headings, key facts, definitions, summaries, and useful memory aids.",
  };
  return `${modePrompts[processMode]}\n\n${toneGuide[userMode]}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || '';
    if (!/^Bearer\s+\S+/i.test(authHeader)) return jsonResponse({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      console.error("JWT verification failed:", userError);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = userData.user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { allowed, remaining, resetAt, unavailable } = await checkRateLimit(adminClient, userId, 'process-document');
    if (unavailable) {
      return jsonResponse({ error: 'Document processing rate limit is temporarily unavailable' }, 503);
    }
    if (!allowed) {
      return jsonResponse(
        { error: "Rate limit exceeded. Please try again later.", retryAfter: Math.ceil((resetAt.getTime() - Date.now()) / 1000) },
        429,
        { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": resetAt.toISOString() }
      );
    }

    const parsed = await readLimitedJson(req, MAX_BODY_BYTES);
    if (!parsed.ok) {
      return jsonResponse({ error: parsed.reason === 'too_large' ? 'Request body too large' : 'Invalid JSON body' }, parsed.reason === 'too_large' ? 413 : 400);
    }
    const body = parsed.value && typeof parsed.value === 'object' && !Array.isArray(parsed.value)
      ? parsed.value as Record<string, unknown>
      : {};
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const processMode = typeof body.processMode === 'string' ? body.processMode : '';
    const userMode = typeof body.userMode === 'string' ? body.userMode : '';
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
    const additionalInstructions = typeof body.additionalInstructions === 'string'
      ? body.additionalInstructions.trim().slice(0, 1000)
      : '';

    if (!content) return jsonResponse({ error: "Content is required" }, 400);
    if (content.length > MAX_CONTENT_CHARS) {
      return jsonResponse({ error: `Content exceeds the ${MAX_CONTENT_CHARS} character limit` }, 413);
    }
    if (!processModes.includes(processMode as ProcessMode) || !userModes.includes(userMode as UserMode)) {
      return jsonResponse({ error: "A valid processMode and userMode are required" }, 400);
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) return jsonResponse({ error: "Document processing is not configured" }, 503);

    let userPrompt = content;
    if (title) userPrompt = `Title: ${title}\n\n${userPrompt}`;
    if (additionalInstructions) userPrompt += `\n\nAdditional Instructions: ${additionalInstructions}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: getSystemPrompt(processMode as ProcessMode, userMode as UserMode) },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return jsonResponse({ error: "Rate limit exceeded. Please try again in a moment." }, 429);
      if (aiResponse.status === 402) return jsonResponse({ error: "AI credits exhausted. Please add credits to continue." }, 402);
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errorText);
      return jsonResponse({ error: "AI service error" }, 502);
    }

    const providerResult = await aiResponse.json().catch(() => null);
    const analysis = providerResult?.choices?.[0]?.message?.content;
    if (typeof analysis !== 'string' || !analysis.trim()) {
      console.error("AI Gateway returned an empty document result");
      return jsonResponse({ error: "AI service returned an invalid response" }, 502);
    }

    // Logging is best-effort; it must not discard a completed analysis.
    try {
      await supabase.from('activity_logs').insert({
        user_id: userId,
        action: 'ai_document_process',
        category: 'ai',
        details: { processMode, userMode, contentLength: content.length },
        page_url: '/documents',
      });
    } catch (logError) {
      console.warn("Document activity log failed:", logError);
    }

    return jsonResponse(
      { text: content, content: analysis.trim(), processMode },
      200,
      { "X-RateLimit-Remaining": String(remaining), "X-RateLimit-Reset": resetAt.toISOString() }
    );
  } catch (error) {
    console.error("Document processing error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
