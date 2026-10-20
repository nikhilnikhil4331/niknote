// ============================================================
// NikNote 6.0 — Asta Ultra AI Serverless Edge Endpoint (/api/ai)
// Multi-Model Streaming Router:
//   • Google Gemini 2.5 Pro / 2.5 Flash / 2.0 Flash (Multimodal + Deep Reasoning)
//   • Groq GPT-OSS 120B / Llama 3.3 70B Versatile / Llama 4 Scout Vision (~300 tok/s)
//   • OpenAI GPT-4o / GPT-4o-mini
// Reads server env vars (GROQ_API_KEY / VITE_GROQ_KEY, GEMINI_API_KEY /
// VITE_GEMINI_KEY, OPENAI_API_KEY / VITE_OPENAI_KEY) safely on the server
// without ever leaking secrets to the browser.
// ============================================================

export const config = {
  runtime: 'edge',
};

export interface AIMessageInput {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: { mimeType: string; dataUrl: string }[];
}

export interface AIRequestPayload {
  messages?: AIMessageInput[];
  prompt?: string;
  action?: string;
  mode?: 'auto' | 'deep' | 'teacher' | 'solver' | 'code' | 'notes' | 'quiz' | 'write';
  model?: string;
  noteContext?: string;
  targetLanguage?: string;
  instruction?: string;
  stream?: boolean;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Groq-Key, X-Gemini-Key, X-OpenAI-Key',
  'Cache-Control': 'no-store, no-transform',
  'X-Content-Type-Options': 'nosniff',
};

const MODE_SYSTEM_PROMPTS: Record<string, string> = {
  auto: `You are **NikNote Asta Ultra**, a flagship ChatGPT-class AI assistant built for students, developers, creators, and thinkers.
CORE PRINCIPLES:
- Match the user's language naturally: if they write in Hinglish (Hindi in Latin script), reply in clear, natural Hinglish with accurate English technical terms; if they write in English, reply in crisp, articulate English; if in Devanagari Hindi, reply in Hindi.
- Give deep, complete, genuinely useful answers — NEVER shallow filler or generic placeholders.
- Structure long explanations cleanly with Markdown headings (## / ###), concise bullet points, bold key terms, tables for comparisons, fenced code blocks (\`\`\`lang) for code, and clean step-by-step math derivations.
- For simple casual messages, reply warmly, concisely, and naturally.
- End substantive answers with 2–3 brief actionable takeaways or next-step questions when helpful.`,

  deep: `You are **NikNote Asta Deep Think** — first-principles reasoning engine for hard math, physics, algorithms, system design, logic puzzles, and multi-step analysis.
- Think carefully through edge cases, assumptions, and intermediate steps before concluding.
- Show clear step-by-step derivations, verify every calculation explicitly, highlight common pitfalls, and present the final conclusion clearly boxed/highlighted at the end.
- Mirror the user's language (English, Hinglish, or Hindi).`,

  teacher: `You are **NikNote AI Master Teacher** — the world's clearest, warmest teacher for school, JEE, NEET, UPSC, gate, and university learners.
STRUCTURE EVERY TEACHING EXPLANATION:
1. **30-Second Intuition** — crystal-clear plain-language summary + relatable real-life analogy.
2. **Core Concept & Deep Breakdown** — step-by-step explanation from basics to exam depth.
3. **Key Formulas / Rules / Definitions** — neatly formatted and explained variable-by-variable.
4. **Worked Example** — concrete solved example showing exact method.
5. **Exam Pro-Tip & Common Mistake** — what toppers watch out for.
Match the user's language (English / Hinglish / Hindi).`,

  solver: `You are **NikNote Exam & Homework Solver** (JEE / NEET / CBSE / ICSE / University / Competitive Exams).
- Read every detail of the problem (including attached images/equations if provided).
- Present: **Given** → **Concept / Formula Used** → **Step-by-Step Solution** (every algebraic/logical step shown clearly) → **Verification / Unit Check** → **Final Answer** clearly highlighted → **Fast Exam Shortcut** (if applicable).`,

  code: `You are **NikNote Principal Software Architect & Coding Mentor**.
- Write clean, complete, production-ready, bug-free code inside properly tagged fenced blocks (\`\`\`tsx, \`\`\`python, \`\`\`cpp, \`\`\`sql, etc.).
- Explain how the solution works, cover edge cases, and state **Time & Space Complexity** ($O(\\dots)$) clearly.
- Never omit critical imports or leave broken \`// TODO\` stubs.`,

  notes: `You are **NikNote Smart Study Notes Architect**.
Create clean, revision-ready notes ready to save directly into a notebook:
- **Title & Quick Overview**
- **Structured Headings & Bullet Points** with **bold keywords**
- **Comparison Table** (where helpful)
- **Important Formulas / Dates / Definitions**
- **Memory Trick / Mnemonic**
- **3 Self-Check Practice Questions** (with brief answers at the bottom).`,

  quiz: `You are **NikNote Interactive Quiz Master**.
Generate **5 high-quality MCQs** (mixing Easy, Medium, and Hard exam-level questions) on the user's topic.
Format EVERY question strictly using this exact clean Markdown pattern so the interactive quiz UI and Markdown reader both render it beautifully:

### Q1. [Question text]
- A) [Option A]
- B) [Option B]
- C) [Option C]
- D) [Option D]
**Answer:** [Correct letter, e.g. B]
**Explanation:** [Clear 1-3 line explanation of why it is correct and why traps are wrong]`,

  write: `You are **NikNote Writing Studio Pro** — expert editor, essayist, communicator, and translator.
Deliver polished, natural, compelling writing (essays, emails, cover letters, SOPs, speeches, summaries, rewrites, grammar fixes, and translations across English, Hindi, and Hinglish) tailored to the exact tone requested.`,
};

function getEnv(key: string): string {
  try {
    const proc = (globalThis as any).process;
    if (proc?.env?.[key]) return String(proc.env[key]).trim();
  } catch { /* edge isolate without process */ }
  return '';
}

function buildSystemPrompt(payload: AIRequestPayload): string {
  if (payload.action && payload.prompt) {
    const inlinePrompts: Record<string, string> = {
      improve: 'Improve clarity, flow, and impact while preserving meaning. Return clean text directly.',
      fix_grammar: 'Fix all grammar, spelling, and punctuation issues while preserving tone. Return only the corrected text.',
      shorten: 'Condense this to the sharpest, most essential points without losing key meaning.',
      lengthen: 'Expand this thoughtfully with clear structure, concrete examples, and depth.',
      continue: 'Continue writing naturally from where the text leaves off, matching voice and topic seamlessly.',
      translate: `Translate accurately and naturally into ${payload.targetLanguage || 'English'}.`,
      summarize: 'Summarize clearly into crisp, structured bullet points highlighting every key takeaway.',
      explain: 'Explain this clearly step-by-step in simple, intuitive student-friendly language with examples.',
    };
    if (inlinePrompts[payload.action]) return inlinePrompts[payload.action];
  }
  const base = MODE_SYSTEM_PROMPTS[payload.mode || 'auto'] || MODE_SYSTEM_PROMPTS.auto;
  if (payload.noteContext?.trim()) {
    return `${base}\n\n---\nUSER'S ATTACHED NOTE CONTEXT (use directly when answering):\n${payload.noteContext.slice(0, 14000)}\n---`;
  }
  return base;
}

function normalizeMessages(payload: AIRequestPayload): AIMessageInput[] {
  const sys = buildSystemPrompt(payload);
  const incoming = Array.isArray(payload.messages) && payload.messages.length > 0
    ? payload.messages
    : payload.prompt
      ? [{ role: 'user' as const, content: String(payload.prompt) }]
      : [];

  const filtered = incoming
    .filter((m) => m && typeof m.content === 'string' && (m.content.trim() || (m.images && m.images.length > 0)))
    .slice(-24);

  const hasSystem = filtered.some((m) => m.role === 'system');
  return hasSystem ? filtered : [{ role: 'system', content: sys }, ...filtered];
}

interface ProviderAttempt {
  provider: 'gemini' | 'groq' | 'openai';
  model: string;
  key: string;
}

function selectProviderChain(
  payload: AIRequestPayload,
  keys: { groq: string; gemini: string; openai: string },
  hasImages: boolean
): ProviderAttempt[] {
  const chain: ProviderAttempt[] = [];
  const push = (provider: 'gemini' | 'groq' | 'openai', model: string, key: string) => {
    if (!key) return;
    if (!chain.some((c) => c.provider === provider && c.model === model)) {
      chain.push({ provider, model, key });
    }
  };

  const requested = payload.model || 'auto';
  if (requested === 'gemini-2.5-pro') push('gemini', 'gemini-2.5-pro', keys.gemini);
  if (requested === 'gemini-2.5-flash') push('gemini', 'gemini-2.5-flash', keys.gemini);
  if (requested === 'llama-3.3-70b') push('groq', 'llama-3.3-70b-versatile', keys.groq);
  if (requested === 'gpt-oss-120b') push('groq', 'openai/gpt-oss-120b', keys.groq);

  if (hasImages) {
    push('gemini', 'gemini-2.5-flash', keys.gemini);
    push('gemini', 'gemini-2.0-flash', keys.gemini);
    push('groq', 'meta-llama/llama-4-scout-17b-16e-instruct', keys.groq);
    push('openai', 'gpt-4o', keys.openai);
    push('openai', 'gpt-4o-mini', keys.openai);
    return chain;
  }

  if (payload.mode === 'deep' || payload.mode === 'solver' || payload.mode === 'code') {
    push('gemini', 'gemini-2.5-pro', keys.gemini);
    push('groq', 'openai/gpt-oss-120b', keys.groq);
    push('gemini', 'gemini-2.5-flash', keys.gemini);
    push('groq', 'llama-3.3-70b-versatile', keys.groq);
    push('openai', 'gpt-4o', keys.openai);
    push('gemini', 'gemini-2.0-flash', keys.gemini);
    push('groq', 'llama-3.1-8b-instant', keys.groq);
    return chain;
  }

  // Ultra-fast high-intelligence default chain
  push('groq', 'llama-3.3-70b-versatile', keys.groq);
  push('gemini', 'gemini-2.5-flash', keys.gemini);
  push('groq', 'openai/gpt-oss-120b', keys.groq);
  push('openai', 'gpt-4o-mini', keys.openai);
  push('gemini', 'gemini-2.0-flash', keys.gemini);
  push('groq', 'llama-3.1-8b-instant', keys.groq);
  return chain;
}

async function openUpstream(
  attempt: ProviderAttempt,
  messages: AIMessageInput[],
  stream: boolean,
  signal?: AbortSignal
): Promise<Response> {
  if (attempt.provider === 'gemini') {
    const sysMsg = messages.find((m) => m.role === 'system');
    const convo = messages.filter((m) => m.role !== 'system');
    const contents = convo.map((m) => {
      const parts: any[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const img of m.images || []) {
        const comma = img.dataUrl.indexOf(',');
        const base64 = comma >= 0 ? img.dataUrl.slice(comma + 1) : img.dataUrl;
        parts.push({ inline_data: { mime_type: img.mimeType || 'image/jpeg', data: base64 } });
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts: parts.length ? parts : [{ text: ' ' }] };
    });

    const endpoint = stream
      ? `https://generativelanguage.googleapis.com/v1beta/models/${attempt.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(attempt.key)}`
      : `https://generativelanguage.googleapis.com/v1beta/models/${attempt.model}:generateContent?key=${encodeURIComponent(attempt.key)}`;

    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        ...(sysMsg ? { system_instruction: { parts: [{ text: sysMsg.content }] } } : {}),
        contents,
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: 4096,
        },
      }),
    });
  }

  const baseUrl = attempt.provider === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  const formatted = messages.map((m) => {
    if (m.images && m.images.length > 0 && m.role === 'user') {
      return {
        role: 'user',
        content: [
          { type: 'text', text: m.content || 'Analyze this image carefully and help me.' },
          ...m.images.map((img) => ({ type: 'image_url', image_url: { url: img.dataUrl } })),
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  return fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${attempt.key}`,
    },
    signal,
    body: JSON.stringify({
      model: attempt.model,
      stream,
      temperature: 0.55,
      max_tokens: 4096,
      messages: formatted,
    }),
  });
}

function extractSSEChunk(provider: 'gemini' | 'groq' | 'openai', rawLine: string): { delta?: string; thinking?: string } | null {
  const line = rawLine.trim();
  if (!line.startsWith('data:')) return null;
  const payload = line.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;
  try {
    const parsed = JSON.parse(payload);
    if (provider === 'gemini') {
      const parts = parsed?.candidates?.[0]?.content?.parts;
      if (!Array.isArray(parts)) return null;
      let delta = '';
      let thinking = '';
      for (const p of parts) {
        if (typeof p?.text === 'string') {
          if (p.thought) thinking += p.text;
          else delta += p.text;
        }
      }
      if (!delta && !thinking) return null;
      return { ...(delta ? { delta } : {}), ...(thinking ? { thinking } : {}) };
    }
    const choice = parsed?.choices?.[0]?.delta;
    const delta = typeof choice?.content === 'string' ? choice.content : '';
    const thinking = typeof choice?.reasoning === 'string' ? choice.reasoning : '';
    if (!delta && !thinking) return null;
    return { ...(delta ? { delta } : {}), ...(thinking ? { thinking } : {}) };
  } catch {
    return null;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const keys = {
    groq: (req.headers.get('x-groq-key') || getEnv('GROQ_API_KEY') || getEnv('VITE_GROQ_KEY')).trim(),
    gemini: (req.headers.get('x-gemini-key') || getEnv('GEMINI_API_KEY') || getEnv('VITE_GEMINI_KEY')).trim(),
    openai: (req.headers.get('x-openai-key') || getEnv('OPENAI_API_KEY') || getEnv('VITE_OPENAI_KEY')).trim(),
  };

  if (req.method === 'GET') {
    return Response.json(
      {
        ok: true,
        providers: {
          groq: Boolean(keys.groq),
          gemini: Boolean(keys.gemini),
          openai: Boolean(keys.openai),
        },
      },
      { headers: CORS_HEADERS }
    );
  }

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS_HEADERS });
  }

  let payload: AIRequestPayload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON request body' }, { status: 400, headers: CORS_HEADERS });
  }

  const messages = normalizeMessages(payload);
  if (messages.filter((m) => m.role !== 'system').length === 0) {
    return Response.json({ error: 'Please enter a message first.' }, { status: 400, headers: CORS_HEADERS });
  }

  const hasImages = messages.some((m) => Array.isArray(m.images) && m.images.length > 0);
  const attempts = selectProviderChain(payload, keys, hasImages);

  if (attempts.length === 0) {
    return Response.json(
      {
        error: 'no_cloud_keys',
        message: 'No cloud AI API key configured on this server instance.',
      },
      { status: 503, headers: CORS_HEADERS }
    );
  }

  const wantStream = payload.stream !== false;
  let lastError = 'AI provider unavailable';

  for (const attempt of attempts) {
    try {
      const upstream = await openUpstream(attempt, messages, wantStream, req.signal);
      if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text().catch(() => '');
        lastError = `${attempt.provider}/${attempt.model} (${upstream.status}): ${errText.slice(0, 180)}`;
        continue;
      }

      if (!wantStream) {
        const data = await upstream.json();
        const content = attempt.provider === 'gemini'
          ? (data?.candidates?.[0]?.content?.parts || []).filter((p: any) => !p.thought).map((p: any) => p.text || '').join('')
          : data?.choices?.[0]?.message?.content || '';
        return Response.json(
          { content, model: attempt.model, provider: attempt.provider },
          { headers: CORS_HEADERS }
        );
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let buffer = '';
          const emit = (obj: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          };
          emit({ meta: true, model: attempt.model, provider: attempt.provider });
          try {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';
              for (const line of lines) {
                const parsed = extractSSEChunk(attempt.provider, line);
                if (parsed) emit(parsed);
              }
            }
            buffer += decoder.decode();
            if (buffer.trim()) {
              for (const line of buffer.split('\n')) {
                const parsed = extractSSEChunk(attempt.provider, line);
                if (parsed) emit(parsed);
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
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
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'X-Accel-Buffering': 'no',
        },
      });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return new Response(null, { status: 499, headers: CORS_HEADERS });
      }
      lastError = `${attempt.provider}/${attempt.model}: ${err?.message || 'network failure'}`;
    }
  }

  return Response.json(
    { error: 'all_providers_failed', message: lastError },
    { status: 502, headers: CORS_HEADERS }
  );
}
