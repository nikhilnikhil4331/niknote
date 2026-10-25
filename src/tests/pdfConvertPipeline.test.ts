import { beforeEach, describe, expect, test, vi } from 'vitest';
import JSZip from 'jszip';

// pdf.js needs a real worker/canvas; the pipeline only needs its text API,
// so the whole extraction layer is faked here — deterministic and instant.
const PAGES = [
  {
    width: 595,
    height: 842,
    items: [
      { str: 'NikNote PDF Tools', x: 40, y: 780, size: 22, width: 190 },
      { str: 'Yeh ek test line hai', x: 40, y: 740, size: 11, width: 120 },
      { str: 'Ravi', x: 40, y: 700, size: 11, width: 26 },
      { str: '92', x: 240, y: 700, size: 11, width: 14 },
    ],
  },
];

function fakeDocument() {
  return {
    numPages: PAGES.length,
    async getPage(index: number) {
      const page = PAGES[index - 1];
      return {
        getViewport: () => ({ width: page.width, height: page.height }),
        getTextContent: async () => ({
          items: page.items.map((item) => ({
            str: item.str,
            width: item.width,
            height: item.size,
            transform: [item.size, 0, 0, item.size, item.x, item.y],
          })),
        }),
        cleanup: () => {},
      };
    },
    destroy: async () => {},
  };
}

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({ promise: Promise.resolve(fakeDocument()) }),
}));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'worker-url' }));

let convert: typeof import('@/lib/pdfConvert');

beforeEach(async () => {
  convert = await import('@/lib/pdfConvert');
});

describe('PDF → Word pipeline', () => {
  test('writes every extracted line into word/document.xml', async () => {
    const docx = await convert.pdfToDocx(new Uint8Array([1, 2, 3]), { pageBreaks: false });
    expect(String.fromCharCode(...docx.slice(0, 2))).toBe('PK');

    const zip = await JSZip.loadAsync(docx);
    const document = await zip.file('word/document.xml')!.async('string');
    expect(document).toContain('NikNote PDF Tools');
    expect(document).toContain('Yeh ek test line hai');
    expect(document).toContain('Ravi');
  });

  test('big text becomes a heading', async () => {
    const docx = await convert.pdfToDocx(new Uint8Array([1]), { detectHeadings: true });
    const zip = await JSZip.loadAsync(docx);
    const document = await zip.file('word/document.xml')!.async('string');
    expect(document).toMatch(/Heading1|Heading 1|"Heading1"/);
  });
});

describe('PDF → Excel pipeline', () => {
  test('one sheet per page, cells split by column gaps', async () => {
    const xlsx = await convert.pdfToXlsx(new Uint8Array([1]), { perPage: true });
    const zip = await JSZip.loadAsync(xlsx);
    const workbook = await zip.file('xl/workbook.xml')!.async('string');
    expect(workbook).toContain('name="Page 1"');

    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet).toContain('NikNote PDF Tools');
    expect(sheet).toContain('<c r="A3" t="inlineStr"><is><t xml:space="preserve">Ravi</t></is></c>');
    expect(sheet).toContain('<c r="B3" t="inlineStr"><is><t xml:space="preserve">92</t></is></c>');
  });

  test('single-sheet mode adds a page marker', async () => {
    const xlsx = await convert.pdfToXlsx(new Uint8Array([1]), { perPage: false });
    const zip = await JSZip.loadAsync(xlsx);
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
    expect(sheet).toContain('page 1 khatam');
  });
});
