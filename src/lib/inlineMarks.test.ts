import { describe, expect, it } from 'bun:test';
import { styledWords, toggleMark } from './inlineMarks';

describe('inline marks', () => {
  it('wraps only the selected words in bold', () => {
    expect(toggleMark('buy milk now', 4, 8, 'bold').text).toBe('buy **milk** now');
  });
  it('toggling again removes bold', () => {
    const r = toggleMark('buy milk now', 4, 8, 'bold');
    expect(toggleMark(r.text, r.start, r.end, 'bold').text).toBe('buy milk now');
  });
  it('only marked words render bold/italic', () => {
    const w = styledWords('a **big red** _cat_ ok');
    expect(w.map(x => [x.text, x.bold, x.italic])).toEqual([
      ['a', false, false], ['big', true, false], ['red', true, false], ['cat', false, true], ['ok', false, false],
    ]);
  });
  it('plain underscores inside words stay text', () => {
    expect(styledWords('snake_case')[0]).toEqual({ text: 'snake_case', bold: false, italic: false });
  });
});
