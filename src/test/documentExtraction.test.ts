import { describe, expect, it, vi } from 'vitest';
import {
  extractDocumentText,
  MAX_DOCUMENT_OCR_PAGES,
  MAX_DOCUMENT_PAGES,
  MAX_DOCUMENT_TEXT_CHARS,
} from '@/lib/documentExtraction';

describe('bounded document text extraction', () => {
  it('combines local PDF text with OCR text for scanned pages', async () => {
    const file = new File(['pdf'], 'study-notes.pdf', { type: 'application/pdf' });
    const readPdf = vi.fn(async () => ({
      pages: [
        { lines: ['Newton laws', 'Force equals mass times acceleration'] },
        { lines: [], scanImage: 'data:image/jpeg;base64,c2Nhbg==' },
      ],
      totalPages: 2,
    }));
    const ocrImage = vi.fn(async () => 'F = m × a');
    const text = await extractDocumentText(file, {
      readPdf,
      readImageDataUrl: vi.fn(),
      ocrImage,
    });

    expect(readPdf).toHaveBeenCalledWith(file, MAX_DOCUMENT_PAGES);
    expect(ocrImage).toHaveBeenCalledWith('data:image/jpeg;base64,c2Nhbg==');
    expect(text).toContain('Page 1\nNewton laws\nForce equals mass times acceleration');
    expect(text).toContain('Page 2\nF = m × a');
  });

  it('caps OCR work and reports page limits for long scanned PDFs', async () => {
    const file = new File(['pdf'], 'large-scan.pdf', { type: 'application/pdf' });
    const pages = Array.from({ length: MAX_DOCUMENT_PAGES }, (_, index) => ({
      lines: [],
      scanImage: `data:image/jpeg;base64,page${index}`,
    }));
    const ocrImage = vi.fn(async (image: string) => `OCR ${image.slice(-1)}`);
    const text = await extractDocumentText(file, {
      readPdf: vi.fn(async (_file, maxPages) => ({ pages: pages.slice(0, maxPages), totalPages: 24 })),
      readImageDataUrl: vi.fn(),
      ocrImage,
    });

    expect(ocrImage).toHaveBeenCalledTimes(MAX_DOCUMENT_OCR_PAGES);
    expect(text).toContain(`OCR was limited to ${MAX_DOCUMENT_OCR_PAGES} scanned pages`);
    expect(text).toContain('Only the first 20 of 24 PDF pages were processed');
  });

  it('uses OCR for standalone images and enforces the extracted-text limit', async () => {
    const image = new File(['image'], 'page.png', { type: 'image/png' });
    const readImageDataUrl = vi.fn(async () => 'data:image/png;base64,aW1hZ2U=');
    const ocrImage = vi.fn(async () => 'Recognized words');
    await expect(extractDocumentText(image, {
      readPdf: vi.fn(),
      readImageDataUrl,
      ocrImage,
    })).resolves.toBe('Recognized words');
    expect(ocrImage).toHaveBeenCalledWith('data:image/png;base64,aW1hZ2U=');

    const pdf = new File(['pdf'], 'long.pdf', { type: 'application/pdf' });
    const longText = 'a'.repeat(MAX_DOCUMENT_TEXT_CHARS + 100);
    const bounded = await extractDocumentText(pdf, {
      readPdf: vi.fn(async () => ({ pages: [{ lines: [longText] }], totalPages: 1 })),
      readImageDataUrl: vi.fn(),
      ocrImage: vi.fn(),
    });
    expect(bounded.length).toBeLessThanOrEqual(MAX_DOCUMENT_TEXT_CHARS);
    expect(bounded).toContain('[Document text was truncated');
  });

  it('rejects unsupported files and documents with no readable content', async () => {
    const unsupported = new File(['data'], 'notes.txt', { type: 'text/plain' });
    await expect(extractDocumentText(unsupported, {
      readPdf: vi.fn(), readImageDataUrl: vi.fn(), ocrImage: vi.fn(),
    })).rejects.toThrow('Choose a PDF');

    const scanned = new File(['pdf'], 'blank.pdf', { type: 'application/pdf' });
    await expect(extractDocumentText(scanned, {
      readPdf: vi.fn(async () => ({ pages: [], totalPages: 0 })),
      readImageDataUrl: vi.fn(), ocrImage: vi.fn(),
    })).rejects.toThrow('No pages could be read');
  });
});
