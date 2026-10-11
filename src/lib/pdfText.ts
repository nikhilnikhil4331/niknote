// Read a PDF in the browser: text lines per page, plus a JPEG for pages that are scans (no text layer).
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export interface PdfPage { lines: string[]; scanImage?: string }

export async function readPdf(file: File, maxPages = 30): Promise<{ pages: PdfPage[]; firstPageImage: string }> {
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: PdfPage[] = [];
  let firstPageImage = '';
  for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    // Group text items into lines by their vertical position
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as any[]) {
      if (!it.str) continue;
      const y = Math.round(it.transform[5] / 3) * 3;
      const row = rows.get(y) ?? [];
      row.push({ x: it.transform[4], s: it.str });
      rows.set(y, row);
    }
    const lines = [...rows.entries()].sort((a, b) => b[0] - a[0])
      .map(([, r]) => r.sort((a, b) => a.x - b.x).map(t => t.s).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    const needsScan = lines.join('').length < 20;
    let img: string | undefined;
    if (needsScan || n === 1) {
      const viewport = page.getViewport({ scale: needsScan ? 2 : 1 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      img = canvas.toDataURL('image/jpeg', 0.85);
      if (n === 1) firstPageImage = img;
    }
    pages.push({ lines, scanImage: needsScan ? img : undefined });
  }
  return { pages, firstPageImage };
}
