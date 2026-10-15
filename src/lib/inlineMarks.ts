// Inline bold/italic inside one line, stored as light markdown: **bold**, _italic_.
export type Mark = 'bold' | 'italic';
const TOKEN: Record<Mark, string> = { bold: '**', italic: '_' };

/** Wrap (or unwrap) the selected range with the marker. Returns new text and selection. */
export function toggleMark(text: string, start: number, end: number, mark: Mark) {
  const t = TOKEN[mark];
  if (start > end) [start, end] = [end, start];
  const before = text.slice(0, start), sel = text.slice(start, end), after = text.slice(end);
  // Already wrapped outside selection -> unwrap
  if (before.endsWith(t) && after.startsWith(t)) {
    return { text: before.slice(0, -t.length) + sel + after.slice(t.length), start: start - t.length, end: end - t.length };
  }
  // Selection itself includes markers -> unwrap
  if (sel.length >= t.length * 2 && sel.startsWith(t) && sel.endsWith(t)) {
    const inner = sel.slice(t.length, -t.length);
    return { text: before + inner + after, start, end: start + inner.length };
  }
  return { text: before + t + sel + t + after, start: start + t.length, end: end + t.length };
}

export interface StyledWord { text: string; bold: boolean; italic: boolean }

/** Split a visual line into words carrying bold/italic state; markers are removed. */
export function styledWords(line: string): StyledWord[] {
  let bold = false, italic = false;
  return line.split(' ').map(raw => {
    let w = raw;
    let b = bold, i = italic;
    // opening markers
    for (;;) {
      if (w.startsWith('**')) { bold = !bold; b = bold || b; w = w.slice(2); continue; }
      if (w.startsWith('_') && w.length > 1) { italic = !italic; i = italic || i; w = w.slice(1); continue; }
      break;
    }
    b = bold; i = italic;
    // closing markers
    for (;;) {
      if (w.endsWith('**') && bold) { bold = false; w = w.slice(0, -2); continue; }
      if (w.endsWith('_') && italic) { italic = false; w = w.slice(0, -1); continue; }
      break;
    }
    return { text: w, bold: b, italic: i };
  });
}

export const stripMarks = (line: string) => styledWords(line).map(w => w.text).join(' ');
