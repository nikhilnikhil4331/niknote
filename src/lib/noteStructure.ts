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
import { Block, BlockCell, BlockType, ChartType, createBlock, generateBlockId } from '@/types/block';
import { decodeGraphSpec, graphToSVG } from '@/lib/noteGraphs';

/**
 * Convert structured lines to BlockEditor blocks (home note canvas).
 * Block types carry their own markers, so list prefixes stored in
 * structured text (numbered "1. ", todo "☐ ") are stripped here.
 */
export function structuredToBlocks(structured: StructuredLine[]): Block[] {
  return structured.map((s) => {
    const base = (type: BlockType, content: string): Block => ({
      ...createBlock(type, content),
      color: s.color,
      ...(s.indent ? { indent: s.indent } : {}),
    });

    switch (s.blockType) {
      case 'h1': return base('heading1', s.text);
      case 'h2': return base('heading2', s.text);
      case 'h3': return base('heading3', s.text);
      case 'bullet': return base('bullet', s.text);
      case 'numbered': return base('numbered', s.text.replace(/^\d+[.)]\s+/, ''));
      case 'todo': {
        const checked = s.text.startsWith('☑');
        return { ...base('todo', s.text.replace(/^[☐☑]\s+/, '')), checked };
      }
      case 'code': return { ...base('code', s.text), language: s.language || 'code' };
      case 'callout': return { ...base('callout', s.text), emoji: s.emoji || '💡' };
      case 'divider': return base('divider', '');
      case 'equation': return base('equation', s.text);
      case 'image': {
        const image = base('image', s.text);
        image.url = s.url;
        image.caption = s.caption;
        return image;
      }
      case 'table': {
        const table = base('table', '');
        if (s.tableData) table.tableData = cloneTableData(s.tableData);
        return table;
      }
      case 'chart': {
        const chart = base('chart', s.text);
        chart.chartType = s.chartType || 'bar';
        if (s.tableData) chart.tableData = cloneTableData(s.tableData);
        return chart;
      }
      case 'graph': {
        const spec = decodeGraphSpec(s.text);
        if (!spec) return base('text', s.text);
        const svg = graphToSVG(spec);
        const dataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
        const image = base('image', '');
        image.url = dataUri;
        image.caption = spec.label;
        return image;
      }
      default: return base('text', s.text);
    }
  });
}

function cloneTableData(data: NonNullable<Block['tableData']>): NonNullable<Block['tableData']> {
  return {
    headers: [...data.headers],
    colCount: data.headers.length,
    rows: data.rows.map((row) => row.map((cell) => ({ ...cell }))),
  };
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
  | 'graph'
  | 'image'
  | 'table'
  | 'chart';

export interface StructuredLine {
  text: string;
  blockType: BlockLineType;
  color: LineInkColor;
  indent: number;
  url?: string;
  caption?: string;
  language?: string;
  emoji?: string;
  chartType?: ChartType;
  tableData?: NonNullable<Block['tableData']>;
}

/** Strip inline markdown decoration but keep the human wording. */
export function cleanInline(raw: string): string {
  return raw
    // Keep bold/italic markers: the handwriting renderer understands these
    // and can style the words without flattening AI emphasis into plain text.
    .replace(/`([^`]+)`/g, '$1')
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
  numCounters: Map<number, number>;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function tableDataFromRows(headersInput: string[], rowsInput: unknown[][]): NonNullable<Block['tableData']> {
  const maxColumns = Math.min(8, Math.max(1, headersInput.length, ...rowsInput.map((row) => row.length)));
  const headers = Array.from({ length: maxColumns }, (_, index) =>
    cleanInline(headersInput[index] || '') || (index === 0 ? 'Label' : `Column ${index + 1}`)
  );
  const rows = rowsInput.slice(0, 100).map((row) =>
    Array.from({ length: maxColumns }, (_, columnIndex) => {
      const raw = row[columnIndex];
      const content = cellText(raw);
      const numeric = typeof raw === 'number' || (content.trim() !== '' && Number.isFinite(Number(content)));
      const cell: BlockCell = {
        id: generateBlockId(),
        content,
        type: numeric ? 'number' : 'text',
      };
      return cell;
    })
  );
  return { headers, rows, colCount: headers.length };
}

function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  cells.push(value.trim());
  return cells;
}

function chartLine(
  title: string,
  chartType: ChartType,
  headers: string[],
  rows: unknown[][],
): StructuredLine | null {
  const data = tableDataFromRows(headers, rows);
  if (data.headers.length < 2 || data.rows.length === 0) return null;
  return {
    text: cleanInline(title).slice(0, 120),
    blockType: 'chart',
    color: 'blue',
    indent: 0,
    chartType,
    tableData: data,
  };
}

/** Parse JSON or CSV from a `chart` code fence into editable chart source data. */
function parseChartFence(source: string): StructuredLine | null {
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);
  let chartType: ChartType = 'bar';
  let title = '';
  const dataLines = [...lines];
  while (dataLines.length) {
    const metadata = dataLines[0].match(/^(?:type|chartType|title)\s*:\s*(.*)$/i);
    if (!metadata) break;
    const key = dataLines.shift()!.split(':', 1)[0].toLowerCase();
    if (key === 'title') title = metadata[1].trim();
    else if (['bar', 'line', 'pie', 'area'].includes(metadata[1].trim().toLowerCase())) {
      chartType = metadata[1].trim().toLowerCase() as ChartType;
    }
  }

  let raw: unknown;
  try {
    raw = JSON.parse(dataLines.join('\n'));
  } catch {
    if (dataLines.length < 2) return null;
    const csv = dataLines.map(parseCsvRow);
    return chartLine(title, chartType, csv[0], csv.slice(1));
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const typeValue = value.type ?? value.chartType;
  if (typeof typeValue === 'string' && ['bar', 'line', 'pie', 'area'].includes(typeValue.toLowerCase())) {
    chartType = typeValue.toLowerCase() as ChartType;
  }
  if (typeof value.title === 'string') title = value.title;

  let headers = Array.isArray(value.headers) ? value.headers.map(cellText) : [];
  let rows: unknown[][] = Array.isArray(value.rows)
    ? value.rows.map((row) => Array.isArray(row) ? row : [])
    : Array.isArray(value.data)
      ? value.data.map((row) => Array.isArray(row) ? row : row && typeof row === 'object' ? row as unknown as unknown[] : [])
      : [];

  if (Array.isArray(value.labels) && Array.isArray(value.values)) {
    headers = [typeof value.label === 'string' ? value.label : 'Label', typeof value.valueLabel === 'string' ? value.valueLabel : 'Value'];
    rows = value.labels.map((label, index) => [label, (value.values as unknown[])[index]]);
  } else if (Array.isArray(value.labels) && Array.isArray(value.datasets)) {
    const datasets = value.datasets.filter((dataset): dataset is Record<string, unknown> => Boolean(dataset && typeof dataset === 'object'));
    headers = [typeof value.label === 'string' ? value.label : 'Label', ...datasets.map((dataset, index) => cellText(dataset.label || dataset.name) || `Series ${index + 1}`)];
    rows = value.labels.map((label, rowIndex) => [label, ...datasets.map((dataset) => Array.isArray(dataset.data) ? dataset.data[rowIndex] : '')]);
  } else if (rows.length && rows[0] && !Array.isArray(rows[0])) {
    const objectRows = rows as unknown as Record<string, unknown>[];
    const keys = Object.keys(objectRows[0]);
    if (!headers.length) {
      const labelKey = keys.find((key) => /^(label|category|name|x)$/i.test(key)) || keys[0];
      headers = [labelKey, ...keys.filter((key) => key !== labelKey)];
    }
    rows = objectRows.map((row) => headers.map((header) => row[header]));
  }

  if (!headers.length && rows.length && rows[0].length >= 2) {
    headers = ['Label', ...Array.from({ length: rows[0].length - 1 }, (_, index) => `Series ${index + 1}`)];
  }
  if (headers.length < 2 || !rows.length) return null;
  return chartLine(title, chartType, headers, rows);
}

function flushCode(st: ParseState) {
  if (st.codeBuf.length) {
    const code = st.codeBuf.join('\n');
    const language = st.codeLang || 'code';
    if (language.toLowerCase() === 'chart') {
      const chart = parseChartFence(code);
      if (chart) st.out.push(chart);
      else st.out.push({ text: code, blockType: 'code', color: 'burgundy', indent: 0, language });
    } else {
      st.out.push({ text: code, blockType: 'code', color: 'burgundy', indent: 0, language });
    }
    st.codeBuf = [];
    st.codeLang = '';
  }
}

function flushMath(st: ParseState) {
  if (st.mathBuf.length) {
    st.out.push({ text: st.mathBuf.join(' ').replace(/\s+/g, ' ').trim(), blockType: 'equation', color: 'blue', indent: 0 });
    st.mathBuf = [];
  }
}

function push(st: ParseState, s: Omit<StructuredLine, 'indent'> & { indent?: number }) {
  st.out.push({ indent: 0, ...s });
}

function isMarkdownTableRow(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.includes('|') && !/^```/.test(trimmed);
}

function splitMarkdownTableRow(raw: string): string[] {
  let source = raw.trim();
  if (source.startsWith('|')) source = source.slice(1);
  if (source.endsWith('|') && !source.endsWith('\\|')) source = source.slice(0, -1);
  const cells: string[] = [];
  let cell = '';
  let escaped = false;
  let inCode = false;
  for (const char of source) {
    if (escaped) {
      cell += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '`') {
      inCode = !inCode;
      cell += char;
    } else if (char === '|' && !inCode) {
      cells.push(cleanInline(cell));
      cell = '';
    } else {
      cell += char;
    }
  }
  if (escaped) cell += '\\';
  cells.push(cleanInline(cell));
  return cells;
}

function isMarkdownTableSeparator(raw: string): boolean {
  if (!isMarkdownTableRow(raw)) return false;
  const cells = splitMarkdownTableRow(raw);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function isSafeMarkdownImageUrl(rawUrl: string): boolean {
  const url = rawUrl.trim();
  if (url.length > 2_000_000) return false;
  return /^https:\/\/[^\s]+$/i.test(url)
    || /^\/(?!\/)[^\s]*$/.test(url)
    || /^(?:\.\.\/|\.\/)[^\s]*$/.test(url)
    || /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(url);
}

function parseMarkdownImage(raw: string): StructuredLine | null {
  const match = raw.trim().match(/^!\[([^\]]*)\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+["']([^"']*)["'])?\s*\)$/);
  if (!match) return null;
  const url = match[2].startsWith('<') && match[2].endsWith('>') ? match[2].slice(1, -1) : match[2];
  const alt = cleanInline(match[1]);
  const caption = cleanInline(match[3] || '') || alt;
  if (!isSafeMarkdownImageUrl(url)) {
    return { text: alt || 'Image unavailable', blockType: 'text', color: 'black', indent: 0 };
  }
  return { text: alt, blockType: 'image', color: 'blue', indent: 0, url, caption };
}

function pushTextWithInlineImages(
  st: ParseState,
  rawText: string,
  color: LineInkColor,
  blockType: BlockLineType,
  indent = 0,
): boolean {
  const token = /!\[([^\]]*)\]\(\s*(<[^>]+>|[^)\s]+)(?:\s+["']([^"']*)["'])?\s*\)/g;
  const matches = Array.from(rawText.matchAll(token));
  if (!matches.length) return false;

  let cursor = 0;
  for (const match of matches) {
    const before = rawText.slice(cursor, match.index);
    if (before.trim()) push(st, { text: cleanInline(before), blockType, color, indent });
    const image = parseMarkdownImage(match[0]);
    if (image) push(st, image);
    cursor = (match.index || 0) + match[0].length;
  }
  const after = rawText.slice(cursor);
  if (after.trim()) push(st, { text: cleanInline(after), blockType, color, indent });
  return true;
}

/**
 * Convert a full AI markdown response into structured note lines.
 * Deterministic & pure — safe to unit test and reuse everywhere
 * (AI Writing Assistant, inline menus, PDF studio, imports).
 */
export function markdownToStructuredLines(markdown: string): StructuredLine[] {
  const st: ParseState = {
    out: [], inCode: false, codeLang: '', codeBuf: [],
    inMathBlock: false, mathBuf: [], blankRun: 0, numCounters: new Map(),
  };

  const lines = (markdown || '').replace(/\r/g, '').split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const raw = lines[lineIndex];
    const line = raw.replace(/\t/g, '  ');
    const trimmed = line.trim();
    const leadingWhitespace = line.match(/^\s*/)?.[0].length || 0;
    const indent = Math.min(3, Math.floor(leadingWhitespace / 2));

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
      push(st, { text: trimmed.slice(2, -2).trim(), blockType: 'equation', color: 'blue' });
      st.numCounters.clear();
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
      st.numCounters.clear();
      continue;
    }
    if (/^(\/\/\/+|---+|\*\*\*+|___+)$/.test(trimmed)) {
      // meaningful divider (markdown hr or stray '///' separator)
      push(st, { text: '', blockType: 'divider', color: 'black' });
      st.blankRun = 0;
      st.numCounters.clear();
      continue;
    }
    if (st.blankRun > 1) push(st, { text: '', blockType: 'text', color: 'black' });
    st.blankRun = 0;

    // ---- headings ------------------------------------------------------
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = Math.min(3, h[1].length) as 1 | 2 | 3;
      const key = `h${level}` as 'h1' | 'h2' | 'h3';
      if (!pushTextWithInlineImages(st, h[2], HEADING_COLORS[key], key)) {
        push(st, { text: cleanInline(h[2]), blockType: key, color: HEADING_COLORS[key] });
      }
      st.numCounters.clear();
      continue;
    }

    // ---- standalone Markdown images -----------------------------------
    const image = parseMarkdownImage(trimmed);
    if (image) {
      push(st, image);
      st.numCounters.clear();
      continue;
    }

    // ---- Markdown tables (kept as editable table blocks) ---------------
    if (isMarkdownTableRow(trimmed) && lineIndex + 1 < lines.length) {
      const nextRow = lines[lineIndex + 1].trim();
      const hasSeparator = isMarkdownTableSeparator(nextRow);
      if (hasSeparator || isMarkdownTableRow(nextRow)) {
        const headers = splitMarkdownTableRow(trimmed);
        const rows: string[][] = [];
        let cursor = lineIndex + (hasSeparator ? 2 : 1);
        while (cursor < lines.length && isMarkdownTableRow(lines[cursor].trim())) {
          const tableRow = lines[cursor].trim();
          if (!isMarkdownTableSeparator(tableRow)) rows.push(splitMarkdownTableRow(tableRow));
          cursor += 1;
        }
        push(st, {
          text: '',
          blockType: 'table',
          color: 'navy',
          tableData: tableDataFromRows(headers, rows),
        });
        lineIndex = cursor - 1;
        st.numCounters.clear();
        continue;
      }
    }

    // ---- callouts / blockquotes ----------------------------------------
    if (trimmed.startsWith('>')) {
      const callout = trimmed.replace(/^>\s?/, '');
      if (!pushTextWithInlineImages(st, callout, 'green', 'callout')) {
        push(st, { text: cleanInline(callout), blockType: 'callout', color: 'green' });
      }
      st.numCounters.clear();
      continue;
    }

    // ---- checklists ------------------------------------------------------
    const todo = trimmed.match(/^[-*]\s*\[( |x|X)\]\s+(.+)$/);
    if (todo) {
      push(st, {
        text: `${todo[1].toLowerCase() === 'x' ? '☑' : '☐'} ${cleanInline(todo[2])}`,
        blockType: 'todo',
        color: 'blue',
        indent,
      });
      st.numCounters.clear();
      continue;
    }

    // ---- bullets ---------------------------------------------------------
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      if (!pushTextWithInlineImages(st, bullet[1], 'blue', 'bullet', indent)) {
        push(st, { text: cleanInline(bullet[1]), blockType: 'bullet', color: 'blue', indent });
      }
      st.numCounters.clear();
      continue;
    }

    // ---- numbered lists ----------------------------------------------------
    const num = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (num) {
      for (const previousIndent of st.numCounters.keys()) {
        if (previousIndent > indent) st.numCounters.delete(previousIndent);
      }
      const nextNumber = (st.numCounters.get(indent) || 0) + 1;
      st.numCounters.set(indent, nextNumber);
      const outputStart = st.out.length;
      if (pushTextWithInlineImages(st, num[2], 'blue', 'numbered', indent)) {
        const firstTextBlock = st.out.slice(outputStart).find((block) => block.blockType === 'numbered');
        if (firstTextBlock) firstTextBlock.text = `${nextNumber}. ${firstTextBlock.text}`;
      } else {
        push(st, { text: `${nextNumber}. ${cleanInline(num[2])}`, blockType: 'numbered', color: 'blue', indent });
      }
      continue;
    }

    // ---- inline math on a single line: $E = mc^2$ ----------
    if (trimmed.startsWith('$') && trimmed.endsWith('$') && !trimmed.startsWith('$$') && trimmed.length > 3) {
      push(st, { text: trimmed.slice(1, -1).trim(), blockType: 'equation', color: 'blue' });
      st.numCounters.clear();
      continue;
    }

    // ---- tables ------------------------------------------------------------
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Separator rows (|---|:--:|) carry no content — skip them
      if (/^[\s|:-]+$/.test(trimmed)) { st.numCounters.clear(); continue; }
      const cells = trimmed.slice(1, -1).split('|').map(c => cleanInline(c)).filter(Boolean);
      if (cells.length) {
        push(st, { text: cells.join('   ·   '), blockType: 'text', color: 'navy' });
      }
      st.numCounters.clear();
      continue;
    }

    // ---- plain text -----------------------------------------------------------
    if (!pushTextWithInlineImages(st, trimmed, 'black', 'text')) {
      push(st, { text: cleanInline(trimmed), blockType: 'text', color: 'black' });
    }
    st.numCounters.clear();
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
