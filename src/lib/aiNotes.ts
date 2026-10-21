// ============================================================
// aiNotes — the document composer that turns a raw AI answer into
// a document that reads like a human prepared it.
//
// Pipeline (each stage does real work):
//   raw markdown → noise + preamble removal → structure parse
//                → de-duplication → paragraph/line fitting
//                → restrained ink palette → editable note lines
//
// It never invents facts and never breaks equations: it only
// organises, trims and fits the text for a paper page.
// ============================================================

import { markdownToStructuredLines, cleanInline, type StructuredLine } from './noteStructure';

export interface ComposeOptions {
  /** Title hint (e.g. the chat title) used when the answer has no heading. */
  fallbackTitle?: string;
  /** Target characters per handwritten line. */
  maxLineChars?: number;
  /** Keep the pencil colour scheme restrained (default) or legacy multi-ink. */
  palette?: 'study' | 'multi-ink';
}

export interface ComposedNote {
  title: string;
  lines: StructuredLine[];
  /** Headings seen in the final document (useful for local "smart" checks). */
  headings: string[];
  wordCount: number;
}

/** A student writes in one or two inks — not a rainbow. */
const STUDY_INK: Record<string, StructuredLine['color']> = {
  h1: 'black',
  h2: 'black',
  h3: 'navy',
  text: 'navy',
  bullet: 'navy',
  numbered: 'navy',
  todo: 'navy',
  equation: 'black',
  callout: 'green',
  code: 'burgundy',
  divider: 'black',
  graph: 'navy',
};

const PREAMBLE = [
  /^(sure|certainly|of course|absolutely|great question|no problem|here(?:'s| is)|below (?:is|are)|the following)\b/i,
  /^as an ai\b/i,
  /^i (?:can|cannot|can't) (?:help|assist)\b/i,
];
const CHATTER = [
  /^(i hope (?:this|that) helps|hope (?:this|that) helps)\b/i,
  /^(let me know|feel free to (?:ask|reach out)|would you like me to|if you(?:'d| would) like)\b/i,
  /^(happy studying|good luck|all the best)\b/i,
  /^(note:|disclaimer:)\s*(this|the) (?:is|answer) (?:generated|produced) by ai/i,
];
const SUMMARY_OPENERS = [
  /^(in summary|in conclusion|to sum up|overall|summary:)\b/i,
];

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

function stripEmoji(text: string): string {
  return text.replace(EMOJI, '').replace(/\s{2,}/g, ' ').trim();
}

function normaliseHeadingKey(text: string): string {
  return stripEmoji(cleanInline(text))
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F ]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Greedy word wrap for a single sentence that is longer than a page line. */
function hardWrap(sentence: string, maxChars: number): string[] {
  const words = sentence.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= maxChars) current = `${current} ${word}`;
    else {
      out.push(current);
      current = word;
    }
  }
  if (current) out.push(current);
  return out;
}

/** Split prose into sentence groups that fit one written line. */
export function fitLines(text: string, maxChars = 74): string[] {
  const clean = stripEmoji(text).replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  // Keep table rows and code-ish content intact.
  if (clean.includes('   ·   ') || /^[|+\-]{3,}/.test(clean)) return [clean];

  const sentences = clean
    .split(/(?<=[.!?;]|[।])\s+(?=[A-Z0-9"'“\[(\u0900-\u097F])/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

  const segments: string[] = [];
  for (const sentence of sentences.length ? sentences : [clean]) {
    if (sentence.length <= maxChars) segments.push(sentence);
    else segments.push(...hardWrap(sentence, maxChars));
  }

  const lines: string[] = [];
  let current = '';
  for (const segment of segments) {
    if (!current) { current = segment; continue; }
    if (`${current} ${segment}`.length <= maxChars) current = `${current} ${segment}`;
    else { lines.push(current); current = segment; }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [clean];
}

/** Best available title for the document. */
export function inferNoteTitle(markdown: string, fallback = 'Study Notes'): string {
  const lines = String(markdown || '').replace(/\r/g, '').split('\n');
  const heading = lines.find(l => /^#{1,2}\s+\S/.test(l.trim()));
  const firstText = lines.find(l => l.trim() && !/^```/.test(l.trim()) && !/^\|/.test(l.trim()));
  const raw = heading ? heading.trim().replace(/^#{1,2}\s+/, '') : firstText?.trim() ?? '';
  const cleaned = stripEmoji(cleanInline(raw))
    .replace(/^[#>*\-\d.\s]+/, '')
    .replace(/[:.；;,]+$/, '')
    .trim();
  if (!cleaned) return fallback;
  const short = cleaned.length > 64 ? `${cleaned.slice(0, 61).trimEnd()}…` : cleaned;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/**
 * Compose a structured, human-looking study document from an AI answer.
 * Pure and deterministic — the editor, the mobile notes bridge and
 * PDF import can all share it.
 */
export function composeStudyNotes(markdown: string, options: ComposeOptions = {}): ComposedNote {
  const { fallbackTitle = 'Study Notes', maxLineChars = 74, palette = 'study' } = options;
  const raw = String(markdown || '').replace(/\r/g, '').replace(/\u00a0/g, ' ').trim();
  const parsed = markdownToStructuredLines(raw);

  const out: StructuredLine[] = [];
  const seenHeadings = new Set<string>();
  const seenParagraphs = new Set<string>();
  let summarySeen = false;
  let blankPending = false;
  let sawPreambleOrTitle = 0;

  const pushBlank = () => {
    if (!out.length) return;
    const last = out[out.length - 1];
    if (!last.text && last.blockType === 'text') return;
    out.push({ text: '', blockType: 'text', color: palette === 'study' ? STUDY_INK.text : 'black', indent: 0 });
  };

  const pushLine = (line: StructuredLine) => {
    if (blankPending && out.length) { pushBlank(); blankPending = false; }
    out.push(line);
  };

  for (const line of parsed) {
    const isBlank = !line.text.trim() && line.blockType === 'text';

    if (isBlank) { blankPending = true; continue; }

    let text = stripEmoji(line.text).trim();
    if (!text) continue;

    // Drop assistant chatter, but never drop real content.
    const isShort = text.length < 150;
    if (isShort && PREAMBLE.some(re => re.test(text)) && !/^#/.test(text)) {
      sawPreambleOrTitle++;
      if (sawPreambleOrTitle <= 2) continue;
    }
    if (isShort && CHATTER.some(re => re.test(text))) continue;
    if (isShort && SUMMARY_OPENERS.some(re => re.test(text))) {
      // One closing summary per document — models love repeating it.
      if (summarySeen) continue;
      summarySeen = true;
    }

    const isHeading = line.blockType === 'h1' || line.blockType === 'h2' || line.blockType === 'h3';
    if (isHeading) {
      const key = normaliseHeadingKey(text);
      if (!key || seenHeadings.has(key)) continue; // repeated section banners
      seenHeadings.add(key);
      if (/^(summary|conclusion|key takeaways|revision notes)$/i.test(key)) summarySeen = true;
      pushLine({ ...line, text, color: palette === 'study' ? STUDY_INK[line.blockType] : line.color });
      continue;
    }

    if (line.blockType === 'equation' || line.blockType === 'code' || line.blockType === 'divider' || line.blockType === 'graph' || line.blockType === 'callout') {
      pushLine({ ...line, text, color: palette === 'study' ? STUDY_INK[line.blockType] : line.color });
      continue;
    }

    // Body text: de-duplicate, then fit to the paper.
    const key = text.toLowerCase().replace(/\s+/g, ' ').slice(0, 220);
    if (seenParagraphs.has(key)) continue;
    seenParagraphs.add(key);

    if (line.blockType === 'bullet' || line.blockType === 'numbered' || line.blockType === 'todo') {
      pushLine({ ...line, text, color: palette === 'study' ? STUDY_INK[line.blockType] : line.color });
      continue;
    }

    const fitted = fitLines(text, maxLineChars);
    fitted.forEach(part => {
      pushLine({ ...line, text: part, color: palette === 'study' ? STUDY_INK.text : line.color });
    });
  }

  // Remove leading / trailing blank lines.
  while (out.length && !out[0].text.trim()) out.shift();
  while (out.length && !out[out.length - 1].text.trim()) out.pop();

  const headings = out.filter(l => l.blockType === 'h1' || l.blockType === 'h2' || l.blockType === 'h3').map(l => l.text);
  const wordCount = out.reduce((sum, l) => sum + l.text.trim().split(/\s+/).filter(Boolean).length, 0);

  return {
    title: inferNoteTitle(raw, fallbackTitle),
    lines: out.length ? out : [{ text: cleanInline(raw), blockType: 'text', color: STUDY_INK.text, indent: 0 }],
    headings,
    wordCount,
  };
}

/** Local (no-network) document health checks shown next to the editor. */
export interface NoteHints {
  wordCount: number;
  charCount: number;
  emptyPages: number;
  duplicateHeadings: string[];
  untitled: boolean;
  suggestedTitle: string | null;
}

export function inspectNoteDocument(
  lines: Array<{ text: string; blockType?: string }>,
  pages: Array<{ lines: Array<{ text: string }> }>,
  title?: string,
): NoteHints {
  const text = lines.map(l => l.text).join('\n');
  const headings = lines
    .filter(l => l.blockType && /^h[1-3]$/.test(l.blockType))
    .map(l => normaliseHeadingKey(l.text))
    .filter(Boolean);
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const h of headings) {
    if (seen.has(h)) duplicates.add(h);
    seen.add(h);
  }
  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const emptyPages = pages.filter(p => !p.lines.some(l => l.text.trim())).length;
  const untitled = !title || /^(untitled( note)?|study notes)$/i.test(title.trim());
  return {
    wordCount,
    charCount: text.length,
    emptyPages,
    duplicateHeadings: [...duplicates],
    untitled: untitled && wordCount > 0,
    suggestedTitle: untitled && wordCount > 0 ? inferNoteTitle(text) : null,
  };
}
