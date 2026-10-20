const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-groq-key, x-gemini-key, x-openai-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NL = String.fromCharCode(10);

function buildPrompts(body: any): { system: string; user: string } {
  const context = typeof body.context === "string" && body.context ? `${NL}${NL}Context:${NL}${body.context}` : "";
  const text = String(body.text || "");
  if (body.action === "explain" || body.action === "custom") {
    return {
      system: `You are NikNote Asta Ultra AI — answer thoroughly, clearly, and helpfully using clean formatting when useful. Match the user's language (English, Hinglish, or Hindi).`,
      user: body.action === "explain"
        ? `Explain clearly step-by-step with intuitive examples and key takeaways:${NL}${NL}${text}${context}`
        : `${body.instruction ? String(body.instruction) + NL + NL : ""}${text}${context}`,
    };
  }
  const inlineSystem = "You are NikNote's inline writing assistant. Return clean, natural text directly without unnecessary filler. Preserve the user's language unless asked to translate.";
  switch (body.action) {
    case "improve": return { system: inlineSystem, user: `Improve clarity, flow, and impact:${NL}${NL}${text}${context}` };
    case "fix_grammar": return { system: inlineSystem, user: `Fix all grammar, spelling, and punctuation issues:${NL}${NL}${text}` };
    case "shorten": return { system: inlineSystem, user: `Make this concise while preserving every key point:${NL}${NL}${text}` };
    case "lengthen": return { system: inlineSystem, user: `Expand this thoughtfully with clear details and examples:${NL}${NL}${text}${context}` };
    case "continue": return { system: inlineSystem, user: `Continue writing naturally from where this stops:${NL}${NL}${text}${context}` };
    case "translate": return { system: inlineSystem, user: `Translate naturally into ${String(body.targetLanguage || "English")}:${NL}${NL}${text}` };
    case "summarize": return { system: inlineSystem, user: `Summarize clearly into key bullet points:${NL}${NL}${text}${context}` };
    default: return { system: inlineSystem, user: `${String(body.instruction || "Help with this text:")}${NL}${NL}${text}${context}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
  }
  if (!body || typeof body.text !== "string" || !body.text.trim()) {
    return Response.json({ error: "Text is required" }, { status: 400, headers: corsHeaders });
  }

  const groqKey = req.headers.get("x-groq-key") || Deno.env.get("GROQ_API_KEY") || Deno.env.get("VITE_GROQ_KEY") || "";
  const geminiKey = req.headers.get("x-gemini-key") || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_KEY") || "";
  const openaiKey = req.headers.get("x-openai-key") || Deno.env.get("OPENAI_API_KEY") || "";
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";

  const { system, user } = buildPrompts(body);

  let upstream: Response | null = null;
  let isGemini = false;

  if (groqKey) {
    upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      signal: req.signal,
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        stream: true,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    }).catch(() => null);
  }

  if ((!upstream || !upstream.ok) && geminiKey) {
    isGemini = true;
    upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: req.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
        }),
      }
    ).catch(() => null);
  }

  if ((!upstream || !upstream.ok) && (openaiKey || lovableKey)) {
    isGemini = false;
    const useLovable = Boolean(lovableKey);
    upstream = await fetch(
      useLovable ? "https://ai.gateway.lovable.dev/v1/chat/completions" : "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: useLovable
          ? { "Content-Type": "application/json", "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "fetch" }
          : { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        signal: req.signal,
        body: JSON.stringify({
          model: useLovable ? "google/gemini-2.5-flash" : "gpt-4o-mini",
          stream: true,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
      }
    ).catch(() => null);
  }

  if (!upstream || !upstream.ok || !upstream.body) {
    return Response.json({ error: "AI provider not configured in Supabase secrets; client /api/ai fallback active." }, { status: 503, headers: corsHeaders });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      const extract = (raw: string) => {
        const line = raw.trim();
        if (!line.startsWith("data:")) return "";
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") return "";
        try {
          const parsed = JSON.parse(data);
          if (isGemini) {
            return (parsed?.candidates?.[0]?.content?.parts || []).filter((p: any) => !p.thought).map((p: any) => p.text || "").join("");
          }
          return parsed?.choices?.[0]?.delta?.content || "";
        } catch {
          return "";
        }
      };
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(NL);
          buffer = lines.pop() || "";
          for (const l of lines) {
            const piece = extract(l);
            if (piece) controller.enqueue(encoder.encode(piece));
          }
        }
        buffer += decoder.decode();
        if (buffer.trim()) {
          const piece = extract(buffer);
          if (piece) controller.enqueue(encoder.encode(piece));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        reader.releaseLock();
      }
    },
    async cancel(reason) {
      await reader.cancel(reason).catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
});
