// ============================================================
// noteStructure — turns raw AI / pasted Markdown into clean,
// organized NoteLines so the notes page reads like a human-made
// study document — never like a raw model response.
//
// Handles: #/##/### headings, bold/italic/code inline, bullets,
// numbered lists, checklists, code fences, $$ / $ LaTeX (kept as
// tidy equation lines), tables (rendered as aligned rows),
// horizontal rules, stray '///' separators, and collapses
// repeated blank lines.
// ============================================================

import { NoteLine, LineInkColor, generateLineId } from '@/types/noteLine';
import { Block, createBlock, BlockType } from '@/types/block';
import { decodeGraphSpec, graphToSVG } from '@/lib/noteGraphs';
import { latexToText } from '@/lib/mathText';

/**
 * Convert structured lines to BlockEditor blocks (home note canvas).
 * Block types carry their own markers, so list prefixes stored in
 * structured text (numbered "1. ", todo "☐ ") are stripped here.
 */
export function structuredToBlocks(structured: StructuredLine[]): Block[] {
  return structured.map(s => {
    const base = (type: BlockType, content: string): Block => createBlock(type, content);
    switch (s.blockType) {
      case 'h1': return base('heading1', s.text);
      case 'h2': return base('heading2', s.text);
      case 'h3': return base('heading3', s.text);
      case 'bullet': return { ...base('bullet', s.text), indent: s.indent };
      case 'numbered': return base('numbered', s.text.replace(/^\d+\.\s+/, ''));
      case 'todo': {
        const checked = s.text.startsWith('☑');
        return { ...base('todo', s.text.replace(/^[☐☑]\s+/, '')), checked };
      }
      case 'code': return { ...base('code', s.text), language: 'code' };
      case 'callout': return { ...base('callout', s.text), emoji: '💡' };
      case 'divider': return base('divider', '');
      case 'equation': return base('equation', s.text);
      case 'graph': {
        const spec = decodeGraphSpec(s.text);
        if (!spec) return base('text', s.text);
        const svg = graphToSVG(spec);
        const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
        return { ...base('image', ''), url: dataUri, caption: spec.label };
      }
      default: return base('text', s.text);
    }
  });
}

export type BlockLineType =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'code'
  | 'callout'
  | 'divider'
  | 'equation'
  | 'graph';

export interface StructuredLine {
  text: string;
  blockType: BlockLineType;
  color: LineInkColor;
  indent: number;
}

/** Strip inline markdown decoration but keep the human wording. */
export function cleanInline(raw: string): string {
  return raw
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2')
    .replace(/_{1,2}(.+?)_{1,2}/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\$\$([^$]+)\$\$/g, (_m, math: string) => ` ${latexToText(math)} `)
    .replace(/(?<!\\)\$([^$\n]+)(?<!\\)\$/g, (_m, math: string) => ` ${latexToText(math)} `)
    .replace(/\\\((.+?)\\\)/g, (_m, math: string) => ` ${latexToText(math)} `)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [label](url) -> label
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Light noise remover for single-line AI replacements
 * (used when an inline AI action rewrites a selected sentence).
 * Removes markdown tokens without re-structuring anything.
 */
export function stripMarkdownNoise(text: string): string {
  return text
    .replace(/^#{1,6}\s+/m, '')
    .replace(/\$\$?/g, '')
    .replace(/^\/\/\/+\s*$/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[-*•]\s+/gm, '• ')
    .trim();
}

const HEADING_COLORS: Record<'h1' | 'h2' | 'h3', LineInkColor> = {
  h1: 'purple',
  h2: 'navy',
  h3: 'black',
};

interface ParseState {
  out: StructuredLine[];
  inCode: boolean;
  codeLang: string;
  codeBuf: string[];
  inMathBlock: boolean;
  mathBuf: string[];
  blankRun: number;
  numCounter: number;
}

function flushCode(st: ParseState) {
  if (st.codeBuf.length) {
    st.out.push({ text: st.codeBuf.join('\n'), blockType: 'code', color: 'burgundy', indent: 0 });
    st.codeBuf = [];
  }
}

function flushMath(st: ParseState) {
  if (st.mathBuf.length) {
    st.out.push({ text: latexToText(st.mathBuf.join(' ').replace(/\s+/g, ' ').trim()), blockType: 'equation', color: 'blue', indent: 0 });
    st.mathBuf = [];
  }
}

function push(st: ParseState, s: Omit<StructuredLine, 'indent'> & { indent?: number }) {
  st.out.push({ indent: 0, ...s });
}

/**
 * Convert a full AI markdown response into structured note lines.
 * Deterministic & pure — safe to unit test and reuse everywhere
 * (AI Writing Assistant, inline menus, PDF studio, imports).
 */
export function markdownToStructuredLines(markdown: string): StructuredLine[] {
  const st: ParseState = {
    out: [], inCode: false, codeLang: '', codeBuf: [],
    inMathBlock: false, mathBuf: [], blankRun: 0, numCounter: 0,
  };

  const lines = (markdown || '').replace(/\r/g, '').split('\n');

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();

    // ---- code fences -------------------------------------------------
    const fence = trimmed.match(/^```(\w*)\s*$/);
    if (fence) {
      if (!st.inCode) {
        st.inCode = true;
        st.codeLang = fence[1] || '';
        st.codeBuf = [];
      } else {
        st.inCode = false;
        flushCode(st);
      }
      continue;
    }
    if (st.inCode) {
      st.codeBuf.push(line);
      continue;
    }

    // ---- block math: $$ ... $$ ---------------------------------------
    if (trimmed.startsWith('$$') && trimmed.endsWith('$$') && trimmed.length > 4) {
      // single-line block math: $$E = mc^2$$
      push(st, { text: latexToText(trimmed.slice(2, -2).trim()), blockType: 'equation', color: 'blue' });
      st.numCounter = 0;
      continue;
    }
    if (trimmed === '$$') {
      if (!st.inMathBlock) {
        st.inMathBlock = true;
        st.mathBuf = [];
      } else {
        st.inMathBlock = false;
        flushMath(st);
      }
      continue;
    }
    if (st.inMathBlock) {
      if (trimmed) st.mathBuf.push(trimmed);
      continue;
    }

    // ---- separators & blank lines ------------------------------------
    if (!trimmed) {
      st.blankRun++;
      st.numCounter = 0;
      continue;
    }
    if (/^(\/\/\/+|---+|\*\*\*+|___+)$/.test(trimmed)) {
      // meaningful divider (markdown hr or stray '///' separator)
      push(st, { text: '', blockType: 'divider', color: 'black' });
      st.blankRun = 0;
      st.numCounter = 0;
      continue;
    }
    if (st.blankRun > 1) push(st, { text: '', blockType: 'text', color: 'black' });
    st.blankRun = 0;

    // ---- headings ------------------------------------------------------
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = Math.min(3, h[1].length) as 1 | 2 | 3;
      const key = `h${level}` as 'h1' | 'h2' | 'h3';
      push(st, { text: cleanInline(h[2]), blockType: key, color: HEADING_COLORS[key] });
      st.numCounter = 0;
      continue;
    }

    // ---- callouts / blockquotes ----------------------------------------
    if (trimmed.startsWith('>')) {
      push(st, { text: cleanInline(trimmed.replace(/^>\s?/, '')), blockType: 'callout', color: 'green' });
      st.numCounter = 0;
      continue;
    }

    // ---- checklists ------------------------------------------------------
    const todo = trimmed.match(/^[-*]\s*\[( |x|X)\]\s+(.+)$/);
    if (todo) {
      push(st, { text: `${todo[1].toLowerCase() === 'x' ? '☑' : '☐'} ${cleanInline(todo[2])}`, blockType: 'todo', color: 'blue' });
      st.numCounter = 0;
      continue;
    }

    // ---- bullets ---------------------------------------------------------
    const indentMatch = line.match(/^(\s+)*/);
    const indent = indentMatch ? Math.min(3, Math.floor(indentMatch[0].length / 2)) : 0;
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      push(st, { text: cleanInline(bullet[1]), blockType: 'bullet', color: 'blue', indent });
      st.numCounter = 0;
      continue;
    }

    // ---- numbered lists ----------------------------------------------------
    const num = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (num) {
      st.numCounter += 1;
      push(st, { text: `${st.numCounter}. ${cleanInline(num[2])}`, blockType: 'numbered', color: 'blue' });
      continue;
    }

    // ---- inline math on a single line: $E = mc^2$ ----------
    if (trimmed.startsWith('$') && trimmed.endsWith('$') && !trimmed.startsWith('$$') && trimmed.length > 3) {
      push(st, { text: latexToText(trimmed.slice(1, -1).trim()), blockType: 'equation', color: 'blue' });
      st.numCounter = 0;
      continue;
    }

    // ---- tables ------------------------------------------------------------
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Separator rows (|---|:--:|) carry no content — skip them
      if (/^[\s|:\-]+$/.test(trimmed)) { st.numCounter = 0; continue; }
      const cells = trimmed.slice(1, -1).split('|').map(c => cleanInline(c)).filter(Boolean);
      if (cells.length) {
        push(st, { text: cells.join('   ·   '), blockType: 'text', color: 'navy' });
      }
      st.numCounter = 0;
      continue;
    }

    // ---- a fully bold short line is a heading, not a paragraph -------------
    const boldHeading = trimmed.match(/^\*\*([^*]{2,80})\*\*:?$/);
    if (boldHeading) {
      push(st, { text: cleanInline(boldHeading[1]), blockType: 'h3', color: HEADING_COLORS.h3 });
      st.numCounter = 0;
      continue;
    }

    // ---- plain text -----------------------------------------------------------
    push(st, { text: cleanInline(trimmed), blockType: 'text', color: 'black' });
    st.numCounter = 0;
  }

  if (st.inCode) flushCode(st);
  if (st.inMathBlock) flushMath(st);

  // Trim leading/trailing empty lines
  while (st.out.length && !st.out[0].text && st.out[0].blockType === 'text') st.out.shift();
  while (st.out.length) {
    const last = st.out[st.out.length - 1];
    if (!last.text && (last.blockType === 'text' || last.blockType === 'divider')) st.out.pop();
    else break;
  }

  return st.out.length ? st.out : [{ text: (markdown || '').trim() || '', blockType: 'text', color: 'black', indent: 0 }];
}

/** Build persistent NoteLine[] (with ids) from structured lines. */
export function structuredToNoteLines(structured: StructuredLine[], baseColor?: LineInkColor): NoteLine[] {
  return structured.map((s, i) => ({
    id: generateLineId(),
    text: s.text,
    color: baseColor ?? s.color,
    timestamp: Date.now() + i,
    blockType: s.blockType,
    indent: s.indent,
  }));
}

/** Map a NoteLine block type onto the block editor vocabulary. */
const LINE_TO_BLOCK: Record<string, BlockType> = {
  h1: 'heading1',
  h2: 'heading2',
  h3: 'heading3',
  bullet: 'bullet',
  numbered: 'numbered',
  todo: 'todo',
  callout: 'callout',
  code: 'code',
  equation: 'equation',
  divider: 'divider',
};

/**
 * Lines → editor blocks **without losing structure**.
 * Without this, switching pages flattened every AI heading, list and
 * equation back into plain paragraphs (and duplicated list numbers).
 */
export function noteLinesToBlocks(lines: NoteLine[]): Block[] {
  const blocks: Block[] = [];
  for (const line of lines) {
    const type = LINE_TO_BLOCK[line.blockType ?? ''] ?? 'text';
    if (type === 'divider') {
      blocks.push({ ...createBlock('divider', ''), color: line.color });
      continue;
    }
    if (!line.text.trim()) continue;
    if (type === 'numbered') {
      blocks.push({ ...createBlock('numbered', line.text.replace(/^\d+[.)]\s+/, '')), color: line.color });
      continue;
    }
    if (type === 'todo') {
      const checked = line.text.trim().startsWith('☑');
      blocks.push({ ...createBlock('todo', line.text.replace(/^[☐☑]\s+/, '')), checked, color: line.color });
      continue;
    }
    blocks.push({ ...createBlock(type, line.text), color: line.color, indent: line.indent });
  }
  return blocks.length ? blocks : [createBlock('text', '')];
}
