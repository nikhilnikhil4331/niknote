// ============================================================
// NikNote PDF Tools — conversion (PDF → Word / Excel)
//
// 1. pdf.js se har page ka text + position nikalta hai
// 2. Word  → `docx` (MIT) se real .docx (headings auto-detect)
// 3. Excel → hand-written OOXML + jszip se real .xlsx
//    (SheetJS CE npm build me ek purana CVE hai, isliye khud likha —
//     sirf inline strings, aur Excel/LibreOffice/Sheets sab khol lete hain)
// ============================================================

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type RawTextItem = { str: string; x: number; y: number; width: number; size: number };

export type TextLine = {
  /** baseline y (PDF points, bottom-up) */
  y: number;
  /** font size in points */
  size: number;
  text: string;
  /** same line, split into columns at wide gaps → Excel cells */
  cells: string[];
};

export type PageText = { page: number; width: number; height: number; lines: TextLine[] };

const MIN_GAP = 0.28; // space between words (× font size)
const CELL_GAP = 1.8; // column break (× font size)

/** Groups positioned glyph runs into lines (and Excel-style cells). Pure + tested. */
export function groupTextItems(items: RawTextItem[]): TextLine[] {
  const usable = items.filter((item) => item.str && item.str.trim().length > 0);
  if (usable.length === 0) return [];

  const sorted = [...usable].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 1.5) return b.y - a.y;
    return a.x - b.x;
  });

  const rows: RawTextItem[][] = [];
  for (const item of sorted) {
    const row = rows[rows.length - 1];
    if (row) {
      const anchor = row[0];
      const tolerance = Math.max(2.5, Math.max(anchor.size, item.size) * 0.45);
      if (Math.abs(anchor.y - item.y) <= tolerance) {
        row.push(item);
        continue;
      }
    }
    rows.push([item]);
  }

  return rows.map((row) => {
    const ordered = [...row].sort((a, b) => a.x - b.x);
    let text = '';
    const cells: string[] = [];
    let cell = '';
    let cursorEnd: number | null = null;

    for (const item of ordered) {
      const size = item.size || 10;
      const gap = cursorEnd === null ? 0 : item.x - cursorEnd;
      if (cursorEnd !== null && gap > size * CELL_GAP) {
        if (cell.trim()) cells.push(cell.trim());
        cell = item.str;
        text += ' ';
        text += item.str;
      } else {
        if (cursorEnd !== null && gap > size * MIN_GAP) {
          cell += ' ';
          text += ' ';
        }
        cell += item.str;
        text += item.str;
      }
      cursorEnd = item.x + item.width;
    }

    if (cell.trim()) cells.push(cell.trim());
    const size = Math.max(...ordered.map((item) => item.size || 10));
    return {
      y: ordered[0].y,
      size,
      text: text.replace(/\s+$/g, ''),
      cells: cells.length > 0 ? cells : [text.trim()],
    };
  });
}

async function openDocument(bytes: Uint8Array | ArrayBuffer, password?: string) {
  const data = bytes instanceof Uint8Array ? bytes.slice(0) : new Uint8Array(bytes);
  return pdfjs.getDocument({ data, password, isEvalSupported: false }).promise;
}

export async function extractPdfPages(
  bytes: Uint8Array | ArrayBuffer,
  options: { password?: string; pages?: number[] } = {}
): Promise<PageText[]> {
  const doc = await openDocument(bytes, options.password);
  const wanted = options.pages && options.pages.length > 0 ? new Set(options.pages) : null;
  const out: PageText[] = [];

  for (let i = 1; i <= doc.numPages; i += 1) {
    if (wanted && !wanted.has(i)) continue;
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: RawTextItem[] = [];

    for (const raw of content.items as any[]) {
      const str = typeof raw.str === 'string' ? raw.str : '';
      if (!str.trim()) continue;
      const transform = raw.transform || [1, 0, 0, 1, 0, 0];
      items.push({
        str,
        x: transform[4],
        y: transform[5],
        width: raw.width || str.length * (raw.height || 10) * 0.5,
        size: Math.abs(raw.height || transform[3] || 10) || 10,
      });
    }

    out.push({ page: i, width: viewport.width, height: viewport.height, lines: groupTextItems(items) });
    page.cleanup();
  }

  await doc.destroy();
  return out;
}

// ── PDF → Word (.docx) ──────────────────────────────────────

export type DocxOptions = {
  title?: string;
  pageBreaks?: boolean;
  detectHeadings?: boolean;
  onProgress?: (done: number, total: number) => void;
};

function medianSize(pages: PageText[]): number {
  const sizes = pages.flatMap((page) => page.lines.map((line) => line.size)).filter((n) => n > 0);
  if (sizes.length === 0) return 11;
  const sorted = sizes.sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 11;
}

export async function pdfToDocx(
  bytes: Uint8Array | ArrayBuffer,
  options: DocxOptions = {}
): Promise<Uint8Array> {
  const pages = await extractPdfPages(bytes);
  if (pages.every((page) => page.lines.length === 0)) {
    throw new Error('Is PDF me koi text layer nahi mila — pehle OCR chalao');
  }

  // Loaded lazily: docx + jszip sirf tab download hote hain jab Word export karo.
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = await import('docx');
  const body = medianSize(pages);
  const detectHeadings = options.detectHeadings ?? true;

  const children: any[] = [];
  if (options.title) {
    children.push(new Paragraph({ text: options.title, heading: HeadingLevel.TITLE }));
  }

  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0 && (options.pageBreaks ?? true)) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    for (const line of page.lines) {
      const isHeading = detectHeadings && line.size >= body * 1.18;
      const isTitle = detectHeadings && line.size >= body * 1.45;
      children.push(
        new Paragraph({
          heading: isTitle ? HeadingLevel.HEADING_1 : isHeading ? HeadingLevel.HEADING_2 : undefined,
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: line.text,
              bold: isHeading || undefined,
              size: Math.round(Math.max(9, Math.min(28, line.size)) * 2), // half-points
            }),
          ],
        })
      );
    }

    options.onProgress?.(pageIndex + 1, pages.length);
  });

  const doc = new Document({
    creator: 'NikNote PDF Tools',
    title: options.title || 'NikNote export',
    description: 'Converted from PDF on-device by NikNote',
    sections: [
      {
        properties: {
          page: {
            size: {
              width: Math.round((pages[0]?.width || 595) * 20), // twips
              height: Math.round((pages[0]?.height || 842) * 20),
            },
          },
        },
        children,
      },
    ],
  });

  const arrayBuffer = await Packer.toArrayBuffer(doc);
  return new Uint8Array(arrayBuffer);
}

// ── PDF → Excel (.xlsx) ─────────────────────────────────────

export type Sheet = { name: string; rows: string[][] };

export type XlsxOptions = {
  /** one sheet per PDF page (default) or everything in a single sheet */
  perPage?: boolean;
  onProgress?: (done: number, total: number) => void;
};

function escapeXml(value: string): string {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index: number): string {
  let name = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetXml(rows: string[][]): string {
  const columns = Math.max(1, ...rows.map((row) => row.length));
  const cols = `<cols>${Array.from({ length: columns }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="24" customWidth="1"/>`).join('')}</cols>`;
  const data = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
          if (value === '' || value == null) return '';
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews>${cols}<sheetData>${data}</sheetData></worksheet>`;
}

function safeSheetName(name: string, used: Set<string>): string {
  const base = String(name || 'Sheet').replace(/[\\/*?:[\]]/g, '-').slice(0, 28) || 'Sheet';
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${base.slice(0, 26)} ${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

/** Builds a valid .xlsx (OOXML) with inline strings. Pure + tested. */
export async function buildXlsx(sheets: Sheet[]): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Set<string>();
  const clean = sheets.length > 0 ? sheets : [{ name: 'Sheet1', rows: [['']] }];

  const sheetEntries = clean.map((sheet, index) => ({
    id: index + 1,
    name: safeSheetName(sheet.name, used),
    xml: sheetXml(sheet.rows),
  }));

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetEntries
      .map(
        (entry) =>
          `<Override PartName="/xl/worksheets/sheet${entry.id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
      )
      .join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
  );

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries
      .map((entry) => `<sheet name="${escapeXml(entry.name)}" sheetId="${entry.id}" r:id="rId${entry.id}"/>`)
      .join('')}</sheets></workbook>`
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetEntries
      .map(
        (entry) =>
          `<Relationship Id="rId${entry.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${entry.id}.xml"/>`
      )
      .join('')}<Relationship Id="rId${sheetEntries.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
  );

  zip.file(
    'xl/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`
  );

  sheetEntries.forEach((entry) => zip.file(`xl/worksheets/sheet${entry.id}.xml`, entry.xml));

  const buffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

export async function pdfToXlsx(
  bytes: Uint8Array | ArrayBuffer,
  options: XlsxOptions = {}
): Promise<Uint8Array> {
  const pages = await extractPdfPages(bytes);
  if (pages.every((page) => page.lines.length === 0)) {
    throw new Error('Is PDF me koi text layer nahi mila — pehle OCR chalao');
  }

  const perPage = options.perPage ?? true;
  let sheets: Sheet[];

  if (perPage) {
    sheets = pages.map((page) => ({
      name: `Page ${page.page}`,
      rows: page.lines.map((line) => (line.cells.length > 0 ? line.cells : [line.text])),
    }));
  } else {
    const rows: string[][] = [];
    pages.forEach((page) => {
      page.lines.forEach((line) => rows.push(line.cells.length > 0 ? line.cells : [line.text]));
      rows.push([`— page ${page.page} khatam —`]);
    });
    sheets = [{ name: 'PDF text', rows }];
  }

  options.onProgress?.(pages.length, pages.length);
  return buildXlsx(sheets);
}
