// Agent workflows: multi-step AI tasks (summarise, organise, plan) built on the
// existing /api/ai gateway via runAstaCompletion. No new dependencies.
import { runAstaCompletion } from '@/lib/aiEngine';

// shortcut: one map pass + one reduce; notes beyond ~10 chunks would nest reduces, add recursion if that ever appears
export const CHUNK_CHARS = 6000;

export function chunkText(text: string, maxChars: number = CHUNK_CHARS): string[] {
  const clean = text.replace(/\s+\n/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];
  const chunks: string[] = [];
  let cur = '';
  const flush = () => { if (cur) { chunks.push(cur); cur = ''; } };
  for (const para of clean.split('\n')) {
    if (para.length > maxChars) {
      flush();
      let rest = para;
      while (rest.length > maxChars) { chunks.push(rest.slice(0, maxChars)); rest = rest.slice(maxChars); }
      cur = rest;
      continue;
    }
    if ((cur ? cur + '\n' + para : para).length > maxChars) flush();
    cur = cur ? cur + '\n' + para : para;
  }
  flush();
  return chunks;
}

export function pageToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map(b => (b && typeof (b as { content?: unknown }).content === 'string' ? (b as { content: string }).content : ''))
    .filter(line => line.trim() !== '')
    .join('\n')
    .trim();
}

export type AICall = (prompt: string) => Promise<string>;

export const aiCall: AICall = async prompt => (await runAstaCompletion({ prompt, mode: 'auto' })).content;

const summaryPrompt = (text: string) =>
  `Summarize the following notes into crisp high-signal bullet points. Keep names, numbers and formulas exact. Reply with the bullets only.\n\n${text}`;

export async function summariseNote(text: string, call: AICall, onStep?: (step: string) => void): Promise<string> {
  const chunks = chunkText(text);
  if (!chunks.length) return '';
  if (chunks.length === 1) {
    onStep?.('Summarising…');
    return call(summaryPrompt(chunks[0]));
  }
  const parts: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    onStep?.(`Reading part ${i + 1} of ${chunks.length}…`);
    parts.push(await call(summaryPrompt(chunks[i])));
  }
  onStep?.('Combining into one summary…');
  return call(`Combine these partial summaries into one crisp bullet summary without duplication:\n\n${parts.join('\n\n---\n\n')}`);
}

export interface OrgGroup { name: string; notes: string[]; reason: string; }

export function buildOrganisationPrompt(items: { title: string; preview: string }[]): string {
  const list = items.map(i => `- ${i.title}: ${i.preview}`).join('\n');
  return [
    'Group these notes into 2-6 study topics.',
    'Reply with JSON only, exactly this shape: {"groups":[{"name":string,"notes":[string],"reason":string}]}.',
    'Copy note titles exactly as given.',
    '',
    list,
  ].join('\n');
}

export function parseOrganisation(raw: string): OrgGroup[] {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  try {
    const json = JSON.parse(raw.slice(start, end + 1));
    const groups = Array.isArray(json?.groups) ? json.groups : [];
    return groups
      .filter((g: unknown) => !!g && typeof (g as OrgGroup).name === 'string' && Array.isArray((g as OrgGroup).notes))
      .map((g: any) => ({
        name: g.name as string,
        notes: (g.notes as unknown[]).filter((n): n is string => typeof n === 'string'),
        reason: typeof g.reason === 'string' ? g.reason : '',
      }))
      .filter((g: OrgGroup) => g.notes.length > 0);
  } catch {
    return [];
  }
}

export function buildStudyPlanPrompt(titles: string[], days: number): string {
  return `Make a ${days}-day study plan covering these notes: ${titles.join(', ')}. Reply as a plain list, one task per line, each line prefixed "Day N: " where N is the day number.`;
}

export function parsePlan(raw: string): string[] {
  return raw
    .split('\n')
    .map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(l => l.length > 0);
}

export function buildSuggestedPrompts(noteTitle?: string): string[] {
  const t = noteTitle || 'my notes';
  return [
    `Summarise "${t}" in 5 bullet points`,
    `Make a 7-day revision plan for "${t}"`,
    `What are the likely exam questions from "${t}"?`,
    `Explain "${t}" like I am 12`,
  ];
}
