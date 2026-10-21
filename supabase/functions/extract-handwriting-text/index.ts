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

// Rate limiting configuration - OCR is expensive, stricter limits
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds
const MAX_REQUESTS_PER_WINDOW = 60; // per hour; PDFs send one request per scanned page

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

interface OCRResult {
  extractedText: string;
  lines: string[];
  confidence: number;
  warnings: string[];
  success: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // Verify the user's JWT
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData?.user) {
      console.error("JWT verification failed:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;
    console.log(`Extract handwriting text request from user: ${userId}`);

    // Check rate limit using service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { allowed, remaining, resetAt } = await checkRateLimit(adminClient, userId, 'extract-handwriting-text');
    
    if (!allowed) {
      console.log(`Rate limit exceeded for user: ${userId}`);
      return new Response(
        JSON.stringify({ 
          error: "Rate limit exceeded. OCR requests are limited to prevent abuse. Please try again later.",
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

    const { imageBase64, retryAttempt = 0 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Server-side image size validation (10MB limit for OCR)
    const maxSizeBytes = 10 * 1024 * 1024;
    const estimatedSize = (imageBase64.length * 3) / 4;
    if (estimatedSize > maxSizeBytes) {
      return new Response(
        JSON.stringify({ error: "Image too large. Maximum 10MB allowed." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate base64 image format
    if (!imageBase64.startsWith('data:image/')) {
      return new Response(
        JSON.stringify({ error: "Invalid image format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const provider = resolveProvider();
    if (!provider) {
      console.error("No AI provider key configured (GROQ_API_KEY / OPENAI_API_KEY)");
      return new Response(
        JSON.stringify({ error: "AI is not configured on the server yet." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Calling ${provider.provider} for handwriting OCR extraction...`);

    // OCR-focused system prompt
    const systemPrompt = `You are an advanced OCR (Optical Character Recognition) specialist with expertise in reading handwritten text. Your task is to extract ALL text from the provided handwriting image with MAXIMUM accuracy.

EXTRACTION RULES:
1. Read EVERY word in the image, left to right, top to bottom
2. Preserve EXACT line breaks where they appear in the handwriting
3. Preserve paragraph structure (blank lines between paragraphs)
4. DO NOT add any interpretation or correction - extract exactly what is written
5. If a word is unclear, make your best attempt but mark uncertainty with [?]
6. Preserve original capitalization
7. Preserve punctuation marks as written
8. Handle crossed out text by omitting it entirely
9. For numbered or bulleted lists, preserve the numbering/bullets

QUALITY ASSESSMENT:
- Rate your confidence in the extraction from 0.0 to 1.0
- Note any specific issues (blurry sections, unusual handwriting, faded ink)

RESPOND WITH THIS EXACT JSON STRUCTURE:
{
  "extractedText": "full extracted text with preserved line breaks",
  "lines": ["line 1", "line 2", "line 3"],
  "confidence": 0.95,
  "warnings": ["list any quality issues"],
  "success": true
}

If the image does not contain readable handwriting:
{
  "extractedText": "",
  "lines": [],
  "confidence": 0,
  "warnings": ["Reason why text could not be extracted"],
  "success": false
}`;

    const userPrompt = `Extract ALL handwritten text from this image with maximum accuracy.
- Read every word carefully
- Preserve line breaks exactly as written
- Rate your confidence in the extraction
- Note any unclear sections

Respond ONLY with the JSON object, no markdown or explanations.`;

    const response = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${provider.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.visionModel,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1, // Low temperature for accurate extraction
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI provider error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "API credits required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to extract text. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI OCR response received");
    
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Failed to extract text. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the JSON response
    let ocrResult: OCRResult;
    try {
      // Remove any markdown code blocks if present
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanContent);
      
      // Normalize and clean the extracted text
      const cleanedText = cleanExtractedText(parsed.extractedText || '');
      const cleanedLines = parsed.lines?.map((line: string) => cleanExtractedText(line)) || 
                          cleanedText.split('\n').filter((line: string) => line.trim());
      
      ocrResult = {
        extractedText: cleanedText,
        lines: cleanedLines,
        confidence: parsed.confidence || 0.5,
        warnings: parsed.warnings || [],
        success: parsed.success !== false && cleanedText.length > 0,
      };
      
      console.log(`OCR extraction complete. Confidence: ${ocrResult.confidence}, Lines: ${ocrResult.lines.length}`);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError, content);
      return new Response(
        JSON.stringify({ error: "Failed to parse extraction result. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check confidence threshold and potentially retry
    const MIN_CONFIDENCE = 0.4;
    if (ocrResult.confidence < MIN_CONFIDENCE && retryAttempt < 1) {
      console.log(`Low confidence (${ocrResult.confidence}), suggesting retry...`);
      ocrResult.warnings.push("Low confidence extraction. Consider uploading a clearer image.");
    }

    // If extraction failed completely
    if (!ocrResult.success) {
      const failureMessage = ocrResult.warnings.length > 0 
        ? ocrResult.warnings.join('. ') 
        : "Handwriting unclear, please upload a clearer image";
      
      return new Response(
        JSON.stringify({ 
          ...ocrResult,
          error: failureMessage,
          shouldRetry: retryAttempt < 1,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(ocrResult),
      { 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": String(remaining),
          "X-RateLimit-Reset": resetAt.toISOString()
        } 
      }
    );
  } catch (error) {
    console.error("Error in extract-handwriting-text function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to extract text. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Clean and normalize extracted text
 * - Remove random characters and noise
 * - Normalize line breaks
 * - Preserve paragraph structure
 */
function cleanExtractedText(text: string): string {
  if (!text) return '';
  
  let cleaned = text
    // Normalize various line endings to \n
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove common OCR noise patterns (isolated random characters)
    .replace(/(?:^|\s)[^\w\s]{1,2}(?:\s|$)/g, ' ')
    // Remove excessive whitespace but preserve paragraph breaks
    .replace(/[ \t]+/g, ' ')
    // Normalize multiple newlines to max 2 (paragraph break)
    .replace(/\n{3,}/g, '\n\n')
    // Trim whitespace from each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Remove leading/trailing whitespace
    .trim();
  
  // Remove lines that are just punctuation or single characters (likely noise)
  cleaned = cleaned
    .split('\n')
    .filter(line => {
      const stripped = line.replace(/[\s.,;:!?-]/g, '');
      return stripped.length > 1 || line.trim() === '';
    })
    .join('\n');
  
  return cleaned;
}
