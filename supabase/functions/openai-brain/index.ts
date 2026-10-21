import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-groq-key, x-gemini-key, x-openai-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AGENT_PROMPTS: Record<string, string> = {
  teacher: `You are NikNote Asta Master Teacher — explain concepts clearly from intuition to exam mastery with real-life examples, formulas, worked examples, and exam pro-tips. Match user language (English / Hinglish / Hindi).`,
  notes: `You are NikNote Smart Notes Architect — build structured, revision-ready study notes with clear Markdown headings, bullet points, bold keywords, comparison tables, formulas, mnemonics, and 3 quick practice questions.`,
  research: `You are NikNote Deep Research Analyst — give accurate, verified, well-structured answers with clear reasoning, comparisons, and practical takeaways.`,
  diagram: `You are NikNote Visual Diagram & Flowchart Architect — explain visual relationships clearly using clean ASCII/Mermaid flowcharts, labeled structures, and step-by-step explanations.`,
  revision: `You are NikNote Rapid Revision Coach — create ultra-high-yield cheat sheets, formulas, memory mnemonics, and comparison tables.`,
  quiz: `You are NikNote Interactive Quiz Master — create 5 high-quality MCQs (Easy, Medium, Hard) with options A/B/C/D, Answer, and clear Explanation.`,
  assignment: `You are NikNote Exam & Assignment Solver — present Given, Formula/Concept, Step-by-Step Solution, Final Highlighted Answer, and Shortcut Tip.`,
  planner: `You are NikNote Study Planner — design realistic daily/weekly study timetables with milestones, Pomodoro blocks, and revision cycles.`,
  code: `You are NikNote Principal Software Architect — write clean, complete, production-ready code with explanations, edge cases, and Big-O complexity.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      messages: incomingMessages,
      prompt,
      agentType = "teacher",
      mode = "text",
      systemPrompt,
      noteContext,
    } = body || {};

    const groqKey = req.headers.get("x-groq-key") || Deno.env.get("GROQ_API_KEY") || "";
    const geminiKey = req.headers.get("x-gemini-key") || Deno.env.get("GEMINI_API_KEY") || "";
    const openaiKey = req.headers.get("x-openai-key") || Deno.env.get("OPENAI_API_KEY") || "";
    const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";

    const sys = [
      systemPrompt || AGENT_PROMPTS[agentType] || AGENT_PROMPTS.teacher,
      noteContext ? `\nAttached Note Context:\n${String(noteContext).slice(0, 12000)}` : "",
    ].join("");

    const chatMessages = Array.isArray(incomingMessages) && incomingMessages.length > 0
      ? incomingMessages
      : prompt
        ? [{ role: "user", content: String(prompt) }]
        : [];

    if (!chatMessages.length) {
      return Response.json({ error: "No prompt or messages provided" }, { status: 400, headers: corsHeaders });
    }

    const fullMessages = chatMessages[0]?.role === "system"
      ? chatMessages
      : [{ role: "system", content: sys }, ...chatMessages];

    // 1. Try Groq (ultra-fast ~300 tok/s)
    if (groqKey) {
      const model = mode === "vision" ? "meta-llama/llama-4-scout-17b-16e-instruct" : "llama-3.3-70b-versatile";
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({ model, messages: fullMessages, temperature: 0.55, max_tokens: 4096 }),
      });
      if (r.ok) {
        const d = await r.json();
        const content = d?.choices?.[0]?.message?.content || "";
        if (content) return Response.json({ content, response: content, model, provider: "groq" }, { headers: corsHeaders });
      }
    }

    // 2. Try Google Gemini 2.5 Flash
    if (geminiKey) {
      const contents = fullMessages
        .filter((m: any) => m.role !== "system")
        .map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
        }));
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: sys }] },
            contents,
            generationConfig: { temperature: 0.55, maxOutputTokens: 4096 },
          }),
        }
      );
      if (r.ok) {
        const d = await r.json();
        const content = (d?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
        if (content) return Response.json({ content, response: content, model: "gemini-2.5-flash", provider: "gemini" }, { headers: corsHeaders });
      }
    }

    // 3. Try OpenAI
    if (openaiKey) {
      const model = mode === "vision" ? "gpt-4o" : "gpt-4o-mini";
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({ model, messages: fullMessages, temperature: 0.55, max_tokens: 4096 }),
      });
      if (r.ok) {
        const d = await r.json();
        const content = d?.choices?.[0]?.message?.content || "";
        if (content) return Response.json({ content, response: content, model, provider: "openai" }, { headers: corsHeaders });
      }
    }

    // 4. Try Lovable Gateway
    if (lovableKey) {
      const model = mode === "vision" ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
        body: JSON.stringify({ model, messages: fullMessages }),
      });
      if (r.ok) {
        const d = await r.json();
        const content = d?.choices?.[0]?.message?.content || "";
        if (content) return Response.json({ content, response: content, model, provider: "lovable" }, { headers: corsHeaders });
      }
    }

    return Response.json(
      { error: "no_server_ai_key", message: "No AI key configured in Supabase secrets; use /api/ai endpoint." },
      { status: 503, headers: corsHeaders }
    );
  } catch (err: any) {
    return Response.json({ error: err?.message || "Unexpected error" }, { status: 500, headers: corsHeaders });
  }
});
