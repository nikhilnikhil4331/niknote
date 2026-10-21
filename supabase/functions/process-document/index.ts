import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";


// Direct provider resolution — no reseller gateway in the path.
// Groq is preferred (cheap + fast); OpenAI is the fallback. Both speak the
// OpenAI chat-completions schema, so the request/response shapes stay identical.
function resolveProvider() {
  const groq = Deno.env.get("GROQ_API_KEY") || "";
  const openai = Deno.env.get("OPENAI_API_KEY") || "";
  if (groq) {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: groq,
      provider: "groq",
      textModel: "llama-3.3-70b-versatile",
      visionModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    };
  }
  if (openai) {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      key: openai,
      provider: "openai",
      textModel: "gpt-4o-mini",
      visionModel: "gpt-4o",
    };
  }
  return null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const MAX_REQUESTS_PER_WINDOW = 30; // 30 document processing requests per hour

async function checkRateLimit(
  supabase: any,
  userId: string,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
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
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW, resetAt: new Date(now.getTime() + RATE_LIMIT_WINDOW * 1000) };
  }

  const currentCount = count || 0;
  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - currentCount - 1);
  const resetAt = new Date(now.getTime() + RATE_LIMIT_WINDOW * 1000);
  
  if (currentCount >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0, resetAt };
  }

  await supabase.from('rate_limits').insert({
    user_id: userId,
    endpoint,
    window_start: now.toISOString(),
  });

  return { allowed: true, remaining, resetAt };
}

type ProcessMode = 'solve' | 'improve' | 'summarize' | 'rewrite' | 'explain' | 'template' | 'notes';
type UserMode = 'student' | 'college' | 'professional';

interface ProcessRequest {
  content: string;
  processMode: ProcessMode;
  userMode: UserMode;
  title?: string;
  additionalInstructions?: string;
}

function getSystemPrompt(processMode: ProcessMode, userMode: UserMode): string {
  const toneGuide = {
    student: "Use simple, clear language suitable for school students (grades 6-12). Be friendly and educational. Include examples when helpful.",
    college: "Use academic language appropriate for university students. Be thorough and include relevant references or context.",
    professional: "Use formal, business-appropriate language. Be concise and action-oriented. Focus on key insights.",
  };

  const modePrompts: Record<ProcessMode, string> = {
    solve: `You are an expert tutor and problem solver. Analyze the given homework/assignment problem and provide:
1. Clear step-by-step solution
2. Explanation of the concepts involved
3. The final answer highlighted
4. Tips for similar problems

${toneGuide[userMode]}`,
    
    improve: `You are a professional writing assistant. Improve the given text by:
1. Fixing grammar, spelling, and punctuation
2. Enhancing clarity and readability
3. Improving flow and structure
4. Maintaining the original meaning

${toneGuide[userMode]}`,
    
    summarize: `You are an expert at creating concise summaries. Create a summary that:
1. Captures all key points
2. Is organized with bullet points or numbered lists
3. Highlights the most important information
4. Is easy to scan and review

${toneGuide[userMode]}`,
    
    rewrite: `You are a skilled rewriter. Rewrite the given content to:
1. Express the same ideas in fresh language
2. Improve readability and engagement
3. Maintain factual accuracy
4. Match the requested tone

${toneGuide[userMode]}`,
    
    explain: `You are a patient teacher. Explain the given content by:
1. Breaking down complex concepts
2. Using analogies and examples
3. Defining key terms
4. Building understanding step by step

${toneGuide[userMode]}`,
    
    template: `You are an expert at creating well-formatted documents. Create a properly structured assignment/document with:
1. Appropriate title and headings
2. Introduction paragraph
3. Main content sections
4. Conclusion
5. Professional formatting

${toneGuide[userMode]}`,
    
    notes: `You are a study notes expert. Convert the content into organized study notes with:
1. Clear headings and subheadings
2. Bullet points for key facts
3. Highlighted definitions
4. Quick reference summaries
5. Memory aids where helpful

${toneGuide[userMode]}`,
  };

  return modePrompts[processMode];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user JWT
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      console.error("JWT verification failed:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    console.log(`Document processing request from user: ${userId}`);

    // Check rate limit using service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { allowed, remaining, resetAt } = await checkRateLimit(adminClient, userId, 'process-document');
    
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

    const { content, processMode, userMode, title, additionalInstructions }: ProcessRequest = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: "Content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const provider = resolveProvider();
    if (!provider) {
      return new Response(
        JSON.stringify({ error: "AI is not configured on the server yet." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = getSystemPrompt(processMode, userMode);
    let userPrompt = content;
    
    if (title) {
      userPrompt = `Title: ${title}\n\n${content}`;
    }
    
    if (additionalInstructions) {
      userPrompt += `\n\nAdditional Instructions: ${additionalInstructions}`;
    }

    const response = await fetch(provider.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.textModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        stream: true,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("AI service error");
    }

    // Log this activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'ai_document_process',
      category: 'ai',
      details: { processMode, userMode, contentLength: content.length },
      page_url: '/ai-solver',
    });

    return new Response(response.body, {
      headers: { 
        ...corsHeaders, 
        "Content-Type": "text/event-stream",
        "X-RateLimit-Remaining": String(remaining),
        "X-RateLimit-Reset": resetAt.toISOString()
      },
    });
  } catch (error) {
    console.error("Document processing error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
