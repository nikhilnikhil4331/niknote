// ============================================================
// NikNote 6.0 — Unified Asta Ultra AI Engine
// Powers Mobile /ai, Desktop /ai, Editor AI, @AI Mentions,
// Homework Vision Solver, Notes Architect & Interactive Quizzes.
//
// 4-Tier Resilient Execution Chain:
//   1. /api/ai (Vercel Serverless Edge Function — server-side SSE stream)
//   2. Direct Cloud SSE Stream (Groq Llama 3.3 70B / GPT-OSS 120B + Gemini 2.5)
//   3. Supabase Edge Function (openai-brain)
//   4. Built-in Offline STEM / Study / Code / Writing Synthesis Engine
// ============================================================

import { supabase } from '@/integrations/supabase/client';

export type AstaMode =
  | 'auto'
  | 'deep'
  | 'teacher'
  | 'solver'
  | 'code'
  | 'notes'
  | 'quiz'
  | 'write';

export type AstaModelChoice =
  | 'auto'
  | 'llama-3.3-70b'
  | 'gpt-oss-120b'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash';

export interface AstaImageAttachment {
  name?: string;
  mimeType: string;
  dataUrl: string;
}

export interface AstaChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: AstaImageAttachment[];
}

export interface AstaCustomKeys {
  groqKey?: string;
  geminiKey?: string;
  openaiKey?: string;
}

export interface AstaStreamOptions {
  messages: AstaChatTurn[];
  mode?: AstaMode;
  model?: AstaModelChoice;
  noteContext?: string;
  action?: string;
  targetLanguage?: string;
  instruction?: string;
  signal?: AbortSignal;
  onMeta?: (meta: { model: string; provider: string }) => void;
  onThinking?: (delta: string, fullThinking: string) => void;
  onToken?: (delta: string, fullText: string) => void;
}

export interface AstaResult {
  content: string;
  thinking: string;
  model: string;
  provider: string;
  latencyMs: number;
  followUps: string[];
}

const KEYS_STORAGE_KEY = 'niknote.ai.keys.v1';

export function readCustomAIKeys(): AstaCustomKeys {
  try {
    const raw = localStorage.getItem(KEYS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      groqKey: typeof parsed.groqKey === 'string' ? parsed.groqKey.trim() : '',
      geminiKey: typeof parsed.geminiKey === 'string' ? parsed.geminiKey.trim() : '',
      openaiKey: typeof parsed.openaiKey === 'string' ? parsed.openaiKey.trim() : '',
    };
  } catch {
    return {};
  }
}

export function saveCustomAIKeys(keys: AstaCustomKeys): void {
  try {
    localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify({
      groqKey: (keys.groqKey || '').trim(),
      geminiKey: (keys.geminiKey || '').trim(),
      openaiKey: (keys.openaiKey || '').trim(),
    }));
  } catch {
    // ignore storage quota errors
  }
}

function getEffectiveClientKeys(): { groq: string; gemini: string; openai: string } {
  const custom = readCustomAIKeys();
  const env = (import.meta as any)?.env || {};
  return {
    groq: (custom.groqKey || env.VITE_GROQ_KEY || '').trim(),
    gemini: (custom.geminiKey || env.VITE_GEMINI_KEY || '').trim(),
    openai: (custom.openaiKey || env.VITE_OPENAI_KEY || '').trim(),
  };
}

export async function probeAstaProviders(): Promise<{ cloudReady: boolean; providers: string[] }> {
  const localKeys = getEffectiveClientKeys();
  const active = new Set<string>();
  if (localKeys.groq) active.add('Groq Llama 3.3 70B');
  if (localKeys.gemini) active.add('Google Gemini 2.5');
  if (localKeys.openai) active.add('OpenAI GPT-4o');

  try {
    const res = await fetch('/api/ai', { method: 'GET' });
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      if (data?.providers?.groq) active.add('Groq Llama 3.3 70B');
      if (data?.providers?.gemini) active.add('Google Gemini 2.5');
      if (data?.providers?.openai) active.add('OpenAI GPT-4o');
    }
  } catch {
    // ignore network check failure
  }

  return {
    cloudReady: active.size > 0,
    providers: Array.from(active),
  };
}

const CLIENT_SYSTEM_PROMPTS: Record<AstaMode, string> = {
  auto: `You are **NikNote Asta Ultra**, a ChatGPT-Ultra class AI assistant for studying, coding, problem-solving, and writing. Match the user's language naturally (English, Hinglish, or Hindi). Give complete, insightful, well-structured Markdown answers with clear headings, bold key concepts, tables, formulas, and fenced code blocks where helpful.`,
  deep: `You are **NikNote Asta Deep Think** — reason step by step from first principles, verify every equation/edge case, and highlight the final conclusion clearly. Match user language (English / Hinglish / Hindi).`,
  teacher: `You are **NikNote AI Master Teacher** — explain with: 1) 30-Second Intuition & real-life analogy, 2) Deep Step-by-Step Breakdown, 3) Key Formulas/Definitions, 4) Worked Example, 5) Exam Pro-Tip. Match user language.`,
  solver: `You are **NikNote Exam & Homework Solver** — write Given -> Formula/Concept -> Step-by-Step Working -> Verification -> Final Highlighted Answer -> Shortcut Trick.`,
  code: `You are **NikNote Principal Software Architect** — write clean, complete, production-ready fenced code blocks with clear explanations, edge cases, and Time/Space Complexity.`,
  notes: `You are **NikNote Smart Notes Architect** — build revision-ready Markdown study notes with Overview, Bullet Points with **bold keywords**, Comparison Table, Formulas, Memory Mnemonic, and 3 Practice Questions.`,
  quiz: `You are **NikNote Interactive Quiz Master** — generate 5 high-yield MCQs (Easy to Hard). Format each question strictly as:\n### Q1. [Question]\n- A) [Option]\n- B) [Option]\n- C) [Option]\n- D) [Option]\n**Answer:** [A/B/C/D]\n**Explanation:** [Why correct]`,
  write: `You are **NikNote Writing Studio Pro** — craft clear, compelling, natural prose, summaries, grammar fixes, or translations matching the requested language and tone.`,
};

export function generateFollowUpSuggestions(query: string, mode: AstaMode): string[] {
  const clean = query.replace(/\s+/g, ' ').trim();
  const shortTopic = clean.length > 42 ? `${clean.slice(0, 40).trim()}…` : clean || 'this topic';
  const hinglish = /\b(kya|kaise|kyu|samjhao|batao|likho|karo|hai|ke|ki|aur|mein|se)\b/i.test(clean);

  if (mode === 'quiz') {
    return hinglish
      ? [`Aur 5 tough JEE/UPSC level MCQs banao`, `Is topic ke short revision notes banao`, `Weak concepts ko example se samjhao`]
      : [`Give me 5 harder exam-level MCQs`, `Turn this into 1-page revision notes`, `Explain the trickiest concept with an example`];
  }
  if (mode === 'code') {
    return [
      `Add unit tests & edge cases for this code`,
      `Can we optimize the time/space complexity further?`,
      `Explain dry-run step by step with sample input`,
    ];
  }
  return hinglish
    ? [
        `Is topic pe 5 MCQ quiz le lo 🎯`,
        `Exam-ready short revision notes banao 📓`,
        `Ek real-life solved numerical example dikhao 🧮`,
      ]
    : [
        `Quiz me with 5 interactive MCQs 🎯`,
        `Create crisp revision notes on "${shortTopic}" 📓`,
        `Walk through a solved example step by step 🧠`,
      ];
}

// ── Tier 1: Same-origin /api/ai SSE stream ──
async function tryServerlessStream(opts: AstaStreamOptions): Promise<{ content: string; thinking: string; model: string; provider: string } | null> {
  const custom = readCustomAIKeys();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (custom.groqKey) headers['X-Groq-Key'] = custom.groqKey;
  if (custom.geminiKey) headers['X-Gemini-Key'] = custom.geminiKey;
  if (custom.openaiKey) headers['X-OpenAI-Key'] = custom.openaiKey;

  const res = await fetch('/api/ai', {
    method: 'POST',
    headers,
    signal: opts.signal,
    body: JSON.stringify({
      messages: opts.messages,
      mode: opts.mode || 'auto',
      model: opts.model || 'auto',
      noteContext: opts.noteContext,
      action: opts.action,
      targetLanguage: opts.targetLanguage,
      instruction: opts.instruction,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) return null;
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/event-stream')) return null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let thinking = '';
  let model = 'asta-ultra';
  let provider = 'cloud';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.meta) {
            model = parsed.model || model;
            provider = parsed.provider || provider;
            opts.onMeta?.({ model, provider });
          }
          if (parsed.thinking) {
            thinking += parsed.thinking;
            opts.onThinking?.(parsed.thinking, thinking);
          }
          if (parsed.delta) {
            content += parsed.delta;
            opts.onToken?.(parsed.delta, content);
          }
        } catch {
          // ignore partial SSE JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return content.trim() ? { content, thinking, model, provider } : null;
}

// ── Tier 2: Direct Browser Cloud Stream (Groq / Gemini / OpenAI) ──
async function tryDirectCloudStream(opts: AstaStreamOptions): Promise<{ content: string; thinking: string; model: string; provider: string } | null> {
  const keys = getEffectiveClientKeys();
  if (!keys.groq && !keys.gemini && !keys.openai) return null;

  const mode = opts.mode || 'auto';
  const sys = [
    CLIENT_SYSTEM_PROMPTS[mode] || CLIENT_SYSTEM_PROMPTS.auto,
    opts.noteContext?.trim() ? `\n\nAttached Note Context:\n${opts.noteContext.slice(0, 12000)}` : '',
  ].join('');

  const turns = opts.messages.filter((m) => m.role !== 'system');
  const hasImages = turns.some((m) => m.images && m.images.length > 0);

  // Try Gemini first when images exist or Gemini model requested, else Groq first for ~300 tok/s speed
  const preferGemini = hasImages || opts.model?.startsWith('gemini') || (!keys.groq && Boolean(keys.gemini));

  const tryGroq = async () => {
    if (!keys.groq) return null;
    const model = hasImages
      ? 'meta-llama/llama-4-scout-17b-16e-instruct'
      : opts.model === 'gpt-oss-120b' || mode === 'deep'
        ? 'openai/gpt-oss-120b'
        : 'llama-3.3-70b-versatile';

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keys.groq}` },
      signal: opts.signal,
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.55,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: sys },
          ...turns.map((m) =>
            m.images?.length && m.role === 'user'
              ? {
                  role: 'user',
                  content: [
                    { type: 'text', text: m.content || 'Analyze this image carefully.' },
                    ...m.images.map((img) => ({ type: 'image_url', image_url: { url: img.dataUrl } })),
                  ],
                }
              : { role: m.role, content: m.content }
          ),
        ],
      }),
    });
    if (!res.ok || !res.body) return null;
    opts.onMeta?.({ model, provider: 'groq' });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let thinking = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;
          const d = line.slice(5).trim();
          if (!d || d === '[DONE]') continue;
          try {
            const p = JSON.parse(d)?.choices?.[0]?.delta;
            if (p?.reasoning) { thinking += p.reasoning; opts.onThinking?.(p.reasoning, thinking); }
            if (p?.content) { content += p.content; opts.onToken?.(p.content, content); }
          } catch { /* skip */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
    return content.trim() ? { content, thinking, model, provider: 'groq' } : null;
  };

  const tryGemini = async () => {
    if (!keys.gemini) return null;
    const model = opts.model === 'gemini-2.5-pro' ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(keys.gemini)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: opts.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sys }] },
          contents: turns.map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [
              ...(m.content ? [{ text: m.content }] : []),
              ...(m.images || []).map((img) => ({
                inline_data: {
                  mime_type: img.mimeType || 'image/jpeg',
                  data: img.dataUrl.includes(',') ? img.dataUrl.split(',')[1] : img.dataUrl,
                },
              })),
            ],
          })),
          generationConfig: { temperature: 0.55, maxOutputTokens: 4096 },
        }),
      }
    );
    if (!res.ok || !res.body) return null;
    opts.onMeta?.({ model, provider: 'gemini' });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let thinking = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;
          const d = line.slice(5).trim();
          if (!d || d === '[DONE]') continue;
          try {
            const parts = JSON.parse(d)?.candidates?.[0]?.content?.parts || [];
            for (const p of parts) {
              if (typeof p?.text === 'string') {
                if (p.thought) { thinking += p.text; opts.onThinking?.(p.text, thinking); }
                else { content += p.text; opts.onToken?.(p.text, content); }
              }
            }
          } catch { /* skip */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
    return content.trim() ? { content, thinking, model, provider: 'gemini' } : null;
  };

  if (preferGemini) {
    return (await tryGemini().catch(() => null)) || (await tryGroq().catch(() => null));
  }
  return (await tryGroq().catch(() => null)) || (await tryGemini().catch(() => null));
}

// ── Tier 3: Supabase Edge Function fallback ──
async function trySupabaseEdge(opts: AstaStreamOptions): Promise<{ content: string; thinking: string; model: string; provider: string } | null> {
  try {
    const modeMap: Record<AstaMode, string> = {
      auto: 'teacher',
      deep: 'research',
      teacher: 'teacher',
      solver: 'assignment',
      code: 'code',
      notes: 'notes',
      quiz: 'quiz',
      write: 'notes',
    };
    const { data, error } = await supabase.functions.invoke('openai-brain', {
      body: {
        messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
        agentType: modeMap[opts.mode || 'auto'] || 'teacher',
        noteContext: opts.noteContext,
      },
    });
    if (error || !data) return null;
    const text = (data.content || data.response || '').trim();
    if (!text) return null;
    opts.onMeta?.({ model: data.model || 'edge-brain', provider: data.provider || 'supabase' });
    opts.onToken?.(text, text);
    return { content: text, thinking: '', model: data.model || 'edge-brain', provider: data.provider || 'supabase' };
  } catch {
    return null;
  }
}

// ── Tier 4: Built-in Offline STEM / Code / Study / Math Engine ──
function solveMathExpression(input: string): string | null {
  // Quadratic solver: ax^2 + bx + c = 0
  const quad = input.replace(/\s+/g, '').match(/^([+-]?\d*\.?\d*)x(?:\^2|²)([+-]\d*\.?\d*)x([+-]\d+\.?\d*)=0$/i);
  if (quad) {
    const a = quad[1] === '' || quad[1] === '+' ? 1 : quad[1] === '-' ? -1 : Number(quad[1]);
    const b = quad[2] === '+' ? 1 : quad[2] === '-' ? -1 : Number(quad[2]);
    const c = Number(quad[3]);
    if (Number.isFinite(a) && a !== 0 && Number.isFinite(b) && Number.isFinite(c)) {
      const D = b * b - 4 * a * c;
      const roots = D >= 0
        ? `x₁ = ${((-b + Math.sqrt(D)) / (2 * a)).toFixed(4).replace(/\.?0+$/, '')},  x₂ = ${((-b - Math.sqrt(D)) / (2 * a)).toFixed(4).replace(/\.?0+$/, '')}`
        : `Complex roots: x = ${(-b / (2 * a)).toFixed(3)} ± ${(Math.sqrt(-D) / (2 * a)).toFixed(3)}i`;
      return `## Quadratic Equation Step-by-Step Solution

### 1. Given Equation
\`${a}x² ${b >= 0 ? '+' : '-'} ${Math.abs(b)}x ${c >= 0 ? '+' : '-'} ${Math.abs(c)} = 0\`
- **a** = ${a}, **b** = ${b}, **c** = ${c}

### 2. Discriminant Formula
\`D = b² - 4ac = (${b})² - 4(${a})(${c}) = ${b * b} - (${4 * a * c}) = ${D}\`

### 3. Quadratic Formula
\`x = (-b ± √D) / (2a)\`

### ✅ Final Answer
**${roots}**`;
    }
  }

  // Safe arithmetic / scientific evaluator
  const cleaned = input
    .replace(/^(solve|calculate|what is|evaluate|compute|kitna hoga|value of)\s+/i, '')
    .replace(/\?+$/, '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/\^/g, '**')
    .trim();

  if (/^[0-9+\-*/().%\s*]+$/.test(cleaned) && /[+\-*/%]/.test(cleaned) && /\d/.test(cleaned)) {
    try {
      // Safe validated numeric expression only
      const value = Function(`"use strict"; return (${cleaned});`)();
      if (typeof value === 'number' && Number.isFinite(value)) {
        const formatted = Number.isInteger(value) ? String(value) : Number(value.toFixed(8)).toString();
        return `## Instant Calculation Result\n\n- **Expression:** \`${cleaned}\`\n- **Result:** **${formatted}**`;
      }
    } catch {
      return null;
    }
  }
  return null;
}

async function synthesizeOfflineAstaResponse(opts: AstaStreamOptions): Promise<{ content: string; thinking: string; model: string; provider: string }> {
  const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user')?.content || '';
  const mathSolved = solveMathExpression(lastUser);
  if (mathSolved) {
    opts.onMeta?.({ model: 'asta-symbolic-math', provider: 'local' });
    opts.onToken?.(mathSolved, mathSolved);
    return { content: mathSolved, thinking: '', model: 'asta-symbolic-math', provider: 'local' };
  }

  // Delegate to enriched knowledge engine when available, with streamed chunk feel
  const { buildOfflineKnowledgeResponse } = await import('@/lib/astaOfflineBrain');
  const full = buildOfflineKnowledgeResponse(lastUser, opts.mode || 'auto', opts.noteContext, opts.action, opts.targetLanguage);
  opts.onMeta?.({ model: 'asta-local-core', provider: 'local' });

  const words = full.split(/(\s+)/);
  let built = '';
  const step = 6;
  for (let i = 0; i < words.length; i += step) {
    if (opts.signal?.aborted) break;
    const chunk = words.slice(i, i + step).join('');
    built += chunk;
    opts.onToken?.(chunk, built);
    await new Promise((r) => setTimeout(r, 8));
  }
  return { content: built || full, thinking: '', model: 'asta-local-core', provider: 'local' };
}

// ── Public Entry Points ──
export async function streamAstaAI(opts: AstaStreamOptions): Promise<AstaResult> {
  const t0 = performance.now();
  const lastUser = [...opts.messages].reverse().find((m) => m.role === 'user')?.content || '';
  const mode = opts.mode || 'auto';

  const result =
    (await tryServerlessStream(opts).catch((err) => {
      if (err?.name === 'AbortError') throw err;
      return null;
    })) ||
    (await tryDirectCloudStream(opts).catch((err) => {
      if (err?.name === 'AbortError') throw err;
      return null;
    })) ||
    (await trySupabaseEdge(opts).catch(() => null)) ||
    (await synthesizeOfflineAstaResponse(opts));

  return {
    ...result,
    latencyMs: Math.max(1, Math.round(performance.now() - t0)),
    followUps: generateFollowUpSuggestions(lastUser, mode),
  };
}

export async function runAstaCompletion(params: {
  prompt: string;
  history?: AstaChatTurn[];
  mode?: AstaMode;
  noteContext?: string;
}): Promise<AstaResult> {
  const messages: AstaChatTurn[] = [
    ...(params.history || []),
    { role: 'user', content: params.prompt },
  ];
  return streamAstaAI({
    messages,
    mode: params.mode || 'auto',
    noteContext: params.noteContext,
  });
}
