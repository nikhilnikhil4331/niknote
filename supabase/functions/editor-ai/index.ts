// ============================================================
// Editor AI — streaming Lovable AI Gateway proxy for NikNote
// Powers Improve / Fix / Shorten / Lengthen / Continue / Translate / Summarize / Explain / Custom
// Emits raw text chunks over a plain text/plain stream (mobile-friendly, no SSE overhead).
// ============================================================

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Action =
  | "improve" | "fix_grammar" | "shorten" | "lengthen"
  | "continue" | "translate" | "summarize" | "explain" | "custom";

interface Body {
  action: Action;
  text: string;                 // primary text (selection or block content)
  context?: string;             // surrounding block/page text (optional)
  targetLanguage?: string;      // for translate
  instruction?: string;         // for custom
}

const SYSTEM_BASE = `You are NikNote's inline writing assistant. You edit or produce text that will directly replace or extend the user's note.
Rules:
- Return ONLY the new text — no preamble, no quotes, no markdown fences, no "Here is…".
- Preserve the user's language (Hindi, English, Hinglish) unless asked to translate.
- Match the tone and register of the original.
- Keep formatting minimal; no headings unless the input had them.`;

function buildPrompt(b: Body): { system: string; user: string } {
  const ctx = b.context ? `\n\nSurrounding context (for reference only, do not repeat):\n${b.context}` : "";
  switch (b.action) {
    case "improve":
      return { system: SYSTEM_BASE, user: `Improve the clarity, flow and word choice of this text. Keep the meaning identical.\n\nText:\n${b.text}${ctx}` };
    case "fix_grammar":
      return { system: SYSTEM_BASE, user: `Fix grammar, spelling and punctuation. Do not change meaning or tone.\n\nText:\n${b.text}` };
    case "shorten":
      return { system: SYSTEM_BASE, user: `Rewrite this text to be significantly shorter while keeping every key point.\n\nText:\n${b.text}` };
    case "lengthen":
      return { system: SYSTEM_BASE, user: `Expand this text with more detail, examples and clarification. Keep the original voice.\n\nText:\n${b.text}${ctx}` };
    case "continue":
      return { system: SYSTEM_BASE, user: `Continue writing from where this text ends. Match the style and topic. Add 1-3 sentences.\n\nText so far:\n${b.text}${ctx}` };
    case "translate":
      return { system: SYSTEM_BASE, user: `Translate this text to ${b.targetLanguage || "English"}. Keep proper nouns.\n\nText:\n${b.text}` };
    case "summarize":
      return { system: SYSTEM_BASE, user: `Summarize this text in 1-3 concise sentences.\n\nText:\n${b.text}${ctx}` };
    case "explain":
      return { system: SYSTEM_BASE, user: `Explain this in simple terms suitable for a student. Be clear and concrete.\n\nText:\n${b.text}` };
    case "custom":
      return { system: SYSTEM_BASE, user: `${b.instruction || "Rewrite this text."}\n\nText:\n${b.text}${ctx}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.action || (!body.text && body.action !== "custom") ) {
    return new Response(JSON.stringify({ error: "Missing action or text" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { system, user } = buildPrompt(body);

  const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      stream: true,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    const status = upstream.status === 429 ? 429 : upstream.status === 402 ? 402 : 500;
    const message =
      status === 429 ? "Rate limit reached. Please wait a moment and try again."
      : status === 402 ? "AI credits exhausted. Please add credits to continue."
      : `AI gateway error: ${errText.slice(0, 200) || upstream.statusText}`;
    return new Response(JSON.stringify({ error: message }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Transform OpenAI-compatible SSE stream into a plain text/plain stream of content deltas.
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffered = "";

  const outStream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffered += decoder.decode(value, { stream: true });
          const lines = buffered.split("\n");
          buffered = lines.pop() || "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const delta = json?.choices?.[0]?.delta?.content;
              if (typeof delta === "string" && delta.length > 0) {
                controller.enqueue(encoder.encode(delta));
              }
            } catch {
              // ignore parse errors on partial chunks
            }
          }
        }
      } catch (err) {
        controller.error(err);
        return;
      }
      controller.close();
    },
  });

  return new Response(outStream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
