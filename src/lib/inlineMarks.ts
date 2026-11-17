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
  let bold = false;
  let italic = false;

  return line.split(' ').map((raw) => {
    let word = raw;

    // Opening markers are kept in the note's editable text and interpreted
    // here for the handwritten preview. Triple emphasis means bold + italic.
    for (;;) {
      if ((word.startsWith('***') || word.startsWith('___')) && word.length > 3) {
        bold = !bold;
        italic = !italic;
        word = word.slice(3);
        continue;
      }
      if (word.startsWith('**') && word.length > 2) {
        bold = !bold;
        word = word.slice(2);
        continue;
      }
      if (word.startsWith('__') && word.length > 2) {
        bold = !bold;
        word = word.slice(2);
        continue;
      }
      if ((word.startsWith('_') || word.startsWith('*')) && word.length > 1) {
        italic = !italic;
        word = word.slice(1);
        continue;
      }
      break;
    }

    const styled = { bold, italic };
    const punctuation = word.match(/[.,!?;:]+$/)?.[0] || '';
    let core = punctuation ? word.slice(0, -punctuation.length) : word;

    // Closing markers can sit just before punctuation (for example
    // **Term:**), so remove them from the core rather than the full token.
    for (;;) {
      if ((core.endsWith('***') || core.endsWith('___')) && (bold || italic)) {
        bold = false;
        italic = false;
        core = core.slice(0, -3);
        continue;
      }
      if (core.endsWith('**') && bold) {
        bold = false;
        core = core.slice(0, -2);
        continue;
      }
      if (core.endsWith('__') && bold) {
        bold = false;
        core = core.slice(0, -2);
        continue;
      }
      if ((core.endsWith('_') || core.endsWith('*')) && italic) {
        italic = false;
        core = core.slice(0, -1);
        continue;
      }
      break;
    }

    return { text: `${core}${punctuation}`, ...styled };
  });
}

export const stripMarks = (line: string) => styledWords(line).map(w => w.text).join(' ');
