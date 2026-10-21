import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_WINDOW = 3600;
const MAX_REQUESTS_PER_WINDOW = 20;

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    console.log(`Analyze handwriting request from user: ${userId}`);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { allowed, remaining, resetAt } = await checkRateLimit(adminClient, userId, 'analyze-handwriting');
    
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please try again later.", retryAfter: Math.ceil((resetAt.getTime() - Date.now()) / 1000) }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": "0", "X-RateLimit-Reset": resetAt.toISOString() } }
      );
    }

    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    const estimatedSize = (imageBase64.length * 3) / 4;
    if (estimatedSize > maxSizeBytes) {
      return new Response(
        JSON.stringify({ error: "Image too large. Maximum 5MB allowed." }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!imageBase64.startsWith('data:image/')) {
      return new Response(
        JSON.stringify({ error: "Invalid image format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling AI for forensic handwriting analysis (DNA v2)...");

    const systemPrompt = `You are an expert forensic handwriting analyst and typographer. Analyze the uploaded handwriting sample image with EXTREME precision for NikNote 4.0's Handwriting DNA Engine.

Your task is to find the CLOSEST matching Google Font from this list and provide EXACT calibration parameters for 14 DNA variables:

Available Fonts (use exact key):
- "caveat" — casual, slightly rushed, natural flow
- "kalam" — neat, rounded, consistent
- "patrick-hand" — clean, friendly, printed style
- "shadows-into-light" — light, airy, feminine
- "indie-flower" — youthful, bubbly, playful
- "dancing-script" — elegant, flowing cursive
- "architects-daughter" — technical, precise, neat
- "satisfy" — bold, artistic, confident
- "gloria-hallelujah" — playful, energetic, casual
- "covered-by-your-grace" — delicate, flowing
- "rock-salt" — rough, textured, bold
- "reenie-beanie" — quick, informal, natural
- "homemade-apple" — rustic, authentic
- "nothing-you-could-do" — loose, casual, fast
- "cedarville-cursive" — classic cursive, connected
- "la-belle-aurore" — vintage, romantic, elegant

Return a JSON object with these EXACT 14 DNA fields + metadata:

{
  "suggestedFont": "font-key from list above",
  "fontSize": number (14-40, size relative to ruled lines if visible),
  "lineSpacing": number (24-60, gap between baselines in px),
  "wordSpacing": number (2-12, gap between words in px),
  "inkColor": "blue" | "black" | "red" | "green" | "purple" | "brown" | "teal" | "orange" | "pink" | "navy" | "burgundy" | "gold",
  
  "slant": number (-15 to 15, degrees; negative = left lean, 0 = upright, positive = right lean),
  "strokeThickness": number (0.5-3.0, pen stroke weight),
  "penPressure": number (0.1-1.0, 0.1=very light feathery, 1.0=very heavy bold),
  "baselineDrift": number (0-5, how much writing drifts from baseline in px),
  "letterSpacing": number (0-5, average letter spacing in px),
  "characterSize": number (16-40, character height in px),
  "sizeVariation": number (0-0.3, coefficient of size variation across characters),
  
  "strokeSpeed": number (0.5-2.0, estimated writing speed; 0.5=slow/careful, 2.0=fast/rushed),
  "imperfectionLevel": number (0-1.0, how imperfect/natural the writing is; 0=perfect/robotic, 1.0=very messy),
  "curveSmoothness": number (0-1.0, how smooth the curves are; 0=sharp/angular, 1.0=very smooth),
  "connectionStyle": "print" | "cursive" | "mixed",
  "loopSize": number (0.5-1.5, size of loops in letters like e, l, g; 0.5=tight, 1.5=large),
  
  "analysisNotes": "2-3 sentence explanation of why this font and parameters were chosen",
  "confidence": number (0-1, how confident you are in the match),
  "qualityWarning": null or "string describing image quality issues"
}

CRITICAL ANALYSIS CHECKLIST:
1. SLANT — Is writing tilted left, right, or upright? Measure precisely in degrees.
2. PRESSURE — Are strokes thick/bold or thin/light? Look at line weight variation.
3. STROKE THICKNESS — How thick are individual pen strokes?
4. SPACING — Are letters crowded or spread apart? Are words close or far?
5. BASELINE DRIFT — Does writing stay on the line or drift up/down? How much wobble?
6. SIZE — How large are letters relative to ruled lines (if visible)?
7. SIZE VARIATION — Do characters vary in size? Some bigger, some smaller?
8. SPEED — Does the writing look rushed (thinner, more connected, less precise) or careful?
9. IMPERFECTIONS — How "human" is the writing? Imperfect spacing, varying thickness, etc.
10. CURVES — Are letter curves smooth and flowing or sharp and angular?
11. CONNECTIONS — Are letters connected (cursive) or separate (print) or mixed?
12. LOOPS — Are loops in letters like e, l, g, d tight or large and open?
13. IMAGE QUALITY — If the image is blurry, poorly lit, or hard to read, set qualityWarning.

The goal is to make the digital output 95-99% INDISTINGUISHABLE from the original handwriting.
Respond ONLY with the raw JSON object. No markdown, no explanation, just JSON.`;

    // Try primary provider, fallback to secondary
    let response: Response | null = null;
    let usedProvider = '';

    // Try OpenAI first for vision (better at detailed analysis)
    if (OPENAI_API_KEY) {
      try {
        console.log("Trying OpenAI for handwriting analysis...");
        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyze this handwriting sample with forensic precision for DNA v2. Return ONLY the JSON object with all 14 DNA parameters."
                  },
                  {
                    type: "image_url",
                    image_url: { url: imageBase64 }
                  }
                ]
              }
            ],
            max_tokens: 2000,
            temperature: 0.15,
          }),
        });
        
        if (response.ok) {
          usedProvider = 'openai';
        } else if (response.status === 429 || response.status === 402) {
          console.log("OpenAI quota/rate limit reached");
          response = null;
        } else {
          const errText = await response.text();
          console.error("OpenAI error:", response.status, errText);
          response = null;
        }
      } catch (err) {
        console.error("OpenAI request failed:", err);
        response = null;
      }
    }


    if (!response || !response.ok) {
      const status = response?.status || 500;
      const errorText = response ? await response.text() : 'No provider available';
      console.error("All providers failed:", status, errorText);
      
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "API credits required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to analyze handwriting. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error("No content in AI response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "Failed to analyze handwriting. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let analysisResult;
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanContent);
      
      // Normalize with safe defaults — all 14 DNA parameters
      analysisResult = {
        // Font & basic settings
        suggestedFont: parsed.suggestedFont || 'caveat',
        fontSize: Math.min(40, Math.max(14, parsed.fontSize || 24)),
        lineSpacing: Math.min(60, Math.max(24, parsed.lineSpacing || 32)),
        wordSpacing: Math.min(12, Math.max(2, parsed.wordSpacing || 4)),
        inkColor: parsed.inkColor || 'blue',
        
        // Core DNA parameters (6)
        slant: Math.min(15, Math.max(-15, parsed.slant || 0)),
        strokeThickness: Math.min(3, Math.max(0.5, parsed.strokeThickness || 1)),
        penPressure: Math.min(1, Math.max(0.1, parsed.penPressure || parsed.penPressureFeel || 0.5)),
        baselineDrift: Math.min(5, Math.max(0, parsed.baselineDrift || parsed.baselineJitterAmount || 1)),
        letterSpacing: Math.min(5, Math.max(0, parsed.letterSpacing || parsed.letterSpacingVariation || 0.5)),
        characterSize: Math.min(40, Math.max(16, parsed.characterSize || parsed.fontSize || 24)),
        sizeVariation: Math.min(0.3, Math.max(0, parsed.sizeVariation || 0.1)),
        
        // Advanced DNA parameters (4)
        strokeSpeed: Math.min(2, Math.max(0.5, parsed.strokeSpeed || 1.0)),
        imperfectionLevel: Math.min(1, Math.max(0, parsed.imperfectionLevel || 0.2)),
        curveSmoothness: Math.min(1, Math.max(0, parsed.curveSmoothness || 0.8)),
        connectionStyle: ['print', 'cursive', 'mixed'].includes(parsed.connectionStyle) ? parsed.connectionStyle : 'mixed',
        loopSize: Math.min(1.5, Math.max(0.5, parsed.loopSize || 1.0)),
        
        // Backward compat fields (mapped from DNA)
        penPressureFeel: Math.min(1, Math.max(0.1, parsed.penPressure || parsed.penPressureFeel || 0.5)),
        baselineJitter: parsed.baselineDrift > 0.5,
        baselineJitterAmount: Math.min(5, Math.max(0, parsed.baselineDrift || 1)),
        strokeRandomness: (parsed.imperfectionLevel || 0.2) > 0.3,
        letterSpacingVariation: Math.min(3, Math.max(0, parsed.letterSpacing || 0)),
        
        // Metadata
        analysisNotes: parsed.analysisNotes || '',
        confidence: Math.min(1, Math.max(0, parsed.confidence || 0.85)),
        qualityWarning: parsed.qualityWarning || null,
        
        // DNA v2 marker
        dnaVersion: '2.0',
      };
      
      console.log(`Forensic DNA v2 analysis complete (${usedProvider}):`, JSON.stringify({
        font: analysisResult.suggestedFont,
        slant: analysisResult.slant,
        pressure: analysisResult.penPressure,
        speed: analysisResult.strokeSpeed,
        imperfection: analysisResult.imperfectionLevel,
        confidence: analysisResult.confidence,
      }));
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError, content);
      return new Response(
        JSON.stringify({ error: "Failed to parse analysis. Please try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(analysisResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": String(remaining), "X-RateLimit-Reset": resetAt.toISOString() } }
    );
  } catch (error) {
    console.error("Error in analyze-handwriting function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to analyze handwriting. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
