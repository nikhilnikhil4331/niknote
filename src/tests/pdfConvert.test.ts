import { describe, expect, test } from 'vitest';
import JSZip from 'jszip';
import { buildXlsx, groupTextItems, type RawTextItem } from '@/lib/pdfConvert';

const item = (str: string, x: number, y: number, size = 10, width = 5): RawTextItem => ({
  str,
  x,
  y,
  size,
  width,
});

describe('text layout grouping', () => {
  test('joins runs on the same baseline into one line', () => {
    const lines = groupTextItems([
      item('Hello', 10, 700),
      item('World', 45, 700),
      item('Next line', 10, 680),
    ]);
    expect(lines.map((line) => line.text)).toEqual(['Hello World', 'Next line']);
  });

  test('sorts out-of-order items and ignores empties', () => {
    const lines = groupTextItems([
      item('second', 60, 500),
      item('   ', 10, 500),
      item('first', 10, 500),
    ]);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('first second');
  });

  test('wide gaps become Excel cells', () => {
    const lines = groupTextItems([
      item('Name', 20, 600, 12, 26),
      item('Marks', 220, 600, 12, 30),
      item('Ravi', 20, 580, 12, 24),
      item('92', 220, 580, 12, 12),
    ]);
    expect(lines[0].cells).toEqual(['Name', 'Marks']);
    expect(lines[1].cells).toEqual(['Ravi', '92']);
  });

  test('empty input is safe', () => {
    expect(groupTextItems([])).toEqual([]);
  });
});

describe('xlsx writer', () => {
  test('produces a real OOXML workbook', async () => {
    const bytes = await buildXlsx([
      { name: 'Page 1', rows: [['Name', 'Marks'], ['Ravi', '92'], ['A&B <test>', '88']] },
      { name: 'Page 2', rows: [['Only one column']] },
    ]);
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(String.fromCharCode(...bytes.slice(0, 2))).toBe('PK');

    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files).sort();
    expect(names).toContain('xl/workbook.xml');
    expect(names).toContain('xl/worksheets/sheet1.xml');
    expect(names).toContain('xl/worksheets/sheet2.xml');

    const workbook = await zip.file('xl/workbook.xml')!.async('string');
    expect(workbook).toContain('name="Page 1"');
    expect(workbook).toContain('name="Page 2"');

    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet).toContain('<c r="A1" t="inlineStr"><is><t xml:space="preserve">Name</t></is></c>');
    expect(sheet).toContain('<c r="B2" t="inlineStr"><is><t xml:space="preserve">92</t></is></c>');
    // XML escaping keeps & < > from breaking the file
    expect(sheet).toContain('A&amp;B &lt;test&gt;');
  });

  test('clamps long and duplicate sheet names', async () => {
    const long = 'A very long sheet name that exceeds the excel limit';
    const bytes = await buildXlsx([
      { name: long, rows: [['a']] },
      { name: long, rows: [['b']] },
    ]);
    const zip = await JSZip.loadAsync(bytes);
    const workbook = await zip.file('xl/workbook.xml')!.async('string');
    const names = [...workbook.matchAll(/name="([^"]+)"/g)].map((m) => m[1]);
    expect(names).toHaveLength(2);
    expect(names[0]).not.toBe(names[1]);
    names.forEach((name) => expect(name.length).toBeLessThanOrEqual(31));
  });
});
