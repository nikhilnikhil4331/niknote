export const MAX_DOCUMENT_PAGES = 20;
export const MAX_DOCUMENT_OCR_PAGES = 8;
export const MAX_DOCUMENT_TEXT_CHARS = 16_000;

export interface ExtractedPdfPage {
  lines: string[];
  scanImage?: string;
}

export interface PdfReadResult {
  pages: ExtractedPdfPage[];
  totalPages?: number;
}

export interface DocumentExtractionDependencies {
  readPdf(file: File, maxPages: number): Promise<PdfReadResult>;
  readImageDataUrl(file: File): Promise<string>;
  ocrImage(imageDataUrl: string): Promise<string>;
}

function truncateText(text: string): string {
  if (text.length <= MAX_DOCUMENT_TEXT_CHARS) return text;
  const marker = '\n\n[Document text was truncated to fit the processing limit.]';
  return `${text.slice(0, MAX_DOCUMENT_TEXT_CHARS - marker.length).trimEnd()}${marker}`;
}

/** Extract bounded PDF text locally and OCR only a capped number of scan pages. */
export async function extractDocumentText(
  file: File,
  dependencies: DocumentExtractionDependencies
): Promise<string> {
  if (file.type.startsWith('image/')) {
    const imageDataUrl = await dependencies.readImageDataUrl(file);
    const text = (await dependencies.ocrImage(imageDataUrl)).trim();
    if (!text) throw new Error('No readable text was found in this image.');
    return truncateText(text);
  }

  if (file.type !== 'application/pdf') {
    throw new Error('Choose a PDF or a supported image file.');
  }

  const { pages, totalPages } = await dependencies.readPdf(file, MAX_DOCUMENT_PAGES);
  if (!pages.length) throw new Error('No pages could be read from this PDF.');

  const pageTexts: string[] = [];
  let ocrPages = 0;
  let skippedScanPages = 0;

  for (const [index, page] of pages.entries()) {
    let pageText = page.lines.map((line) => line.trim()).filter(Boolean).join('\n');
    if (page.scanImage) {
      if (ocrPages < MAX_DOCUMENT_OCR_PAGES) {
        ocrPages += 1;
        const ocrText = (await dependencies.ocrImage(page.scanImage)).trim();
        if (ocrText) pageText = ocrText;
      } else {
        skippedScanPages += 1;
      }
    }

    if (pageText) pageTexts.push(`Page ${index + 1}\n${pageText}`);
  }

  if (!pageTexts.length) {
    throw new Error('No readable text was found. This PDF may be empty or image-only.');
  }

  if (skippedScanPages) {
    pageTexts.push(`[OCR was limited to ${MAX_DOCUMENT_OCR_PAGES} scanned pages; ${skippedScanPages} additional scanned page(s) were not OCR-processed.]`);
  }
  if (typeof totalPages === 'number' && totalPages > pages.length) {
    pageTexts.push(`[Only the first ${pages.length} of ${totalPages} PDF pages were processed.]`);
  }

  return truncateText(pageTexts.join('\n\n'));
}
