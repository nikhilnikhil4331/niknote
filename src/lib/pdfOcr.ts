// ============================================================
// NikNote PDF Tools — OCR → searchable PDF
//
// pdf.js har page ko image me render karta hai, tesseract.js (Apache-2.0)
// usme se text + word boxes nikalta hai, aur pdf-lib wahi image + ek
// **invisible text layer** wali PDF banata hai. Result: photo/scan PDF
// bhi search + copy ho jaati hai, dikhne me bilkul same.
//
// Sab kuch device par hota hai. Pehli baar model (~5-15 MB) download hota
// hai (browser cache kar leta hai) — uske baad offline chalta hai.
// ============================================================

import 'regenerator-runtime/runtime.js'; // fontkit ko Indic shaping ke liye chahiye
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { sanitizePdfText } from './pdfTools';
import {
  OCR_QUALITY_SCALE, flattenOcrBlocks, hasDevanagari, wordToPdfBox,
  type OcrLanguage, type OcrQuality,
} from './pdfOcrMath';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const DEVANAGARI_FONT_URL = '/fonts/NotoSansDevanagari-Regular.ttf';

export type OcrProgress = {
  stage: 'model' | 'page' | 'build';
  label: string;
  done: number;
  total: number;
  /** 0..1 for the current tesseract sub-task, when available */
  progress?: number;
};

export type OcrOptions = {
  language?: OcrLanguage;
  quality?: OcrQuality;
  onProgress?: (progress: OcrProgress) => void;
  signal?: AbortSignal;
};

export type OcrResult = { bytes: Uint8Array; pages: number; words: number };

type PageJob = {
  canvas: HTMLCanvasElement;
  pageWidth: number;
  pageHeight: number;
};

async function renderPage(
  doc: any,
  pageNumber: number,
  scale: number
): Promise<PageJob & { words: Awaited<ReturnType<any>> }> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(viewport.width));
  canvas.height = Math.max(1, Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is unavailable on this device');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();

  return { canvas, pageWidth: base.width, pageHeight: base.height } as any;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.78): Uint8Array {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function ocrToSearchablePdf(
  input: Uint8Array | ArrayBuffer,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const language = options.language || 'eng';
  const quality = options.quality || 'balanced';
  const scale = OCR_QUALITY_SCALE[quality] ?? 2;
  const source = input instanceof Uint8Array ? input.slice(0) : new Uint8Array(input);

  options.onProgress?.({ stage: 'model', label: 'PDF khul raha hai…', done: 0, total: 1 });

  const doc = await pdfjs.getDocument({ data: source, isEvalSupported: false }).promise;
  const total = doc.numPages;

  // tesseract.js is ~1 MB of worker glue — only loaded when OCR is used.
  const tesseract = await import('tesseract.js');
  const worker = await tesseract.createWorker(language, tesseract.OEM.LSTM_ONLY, {
    logger: (message: any) => {
      if (!message || typeof message.progress !== 'number') return;
      options.onProgress?.({
        stage: 'model',
        label: message.status === 'recognizing text'
          ? 'Text pehchana ja raha hai…'
          : 'OCR model load ho raha hai (pehli baar thoda time lagta hai)…',
        done: 0,
        total,
        progress: message.progress,
      });
    },
  });

  const out = await PDFDocument.create();
  out.setProducer('NikNote PDF Tools (tesseract.js)');
  out.setCreator('NikNote');
  let devanagariFont: any = null;
  let fontkitReady = false;

  const getDevanagariFont = async () => {
    if (devanagariFont) return devanagariFont;
    if (!fontkitReady) {
      out.registerFontkit(fontkit as any);
      fontkitReady = true;
    }
    const response = await fetch(DEVANAGARI_FONT_URL);
    if (!response.ok) throw new Error('हिन्दी font load nahi hua');
    const bytes = new Uint8Array(await response.arrayBuffer());
    devanagariFont = await out.embedFont(bytes, { subset: true });
    return devanagariFont;
  };

  const latinFont = await out.embedFont(StandardFonts.Helvetica);
  let placedWords = 0;

  try {
    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      if (options.signal?.aborted) throw new Error('OCR cancel ho gaya');
      options.onProgress?.({
        stage: 'page',
        label: `Page ${pageNumber}/${total} padha ja raha hai…`,
        done: pageNumber - 1,
        total,
      });

      const job = await renderPage(doc, pageNumber, scale);
      const recognized = await worker.recognize(job.canvas, {}, { blocks: true });
      const words = flattenOcrBlocks((recognized as any)?.data?.blocks);

      const jpeg = canvasToJpeg(job.canvas);
      const image = await out.embedJpg(jpeg);
      const target = out.addPage([job.pageWidth, job.pageHeight]);
      target.drawImage(image, { x: 0, y: 0, width: job.pageWidth, height: job.pageHeight });

      for (const word of words) {
        const box = wordToPdfBox(
          word,
          { width: job.canvas.width, height: job.canvas.height },
          { width: job.pageWidth, height: job.pageHeight }
        );
        const isHindi = hasDevanagari(box.text);
        const text = isHindi ? box.text : sanitizePdfText(box.text);
        if (!text) continue;
        try {
          const font = isHindi ? await getDevanagariFont() : latinFont;
          target.drawText(text, { x: box.x, y: box.y, size: box.size, font, opacity: 0 });
          placedWords += 1;
        } catch {
          // ek word fail ho to poora page fail na ho
        }
      }

      job.canvas.width = 0;
      job.canvas.height = 0;

      options.onProgress?.({
        stage: 'page',
        label: `Page ${pageNumber}/${total} ready`,
        done: pageNumber,
        total,
      });
    }
  } finally {
    await worker.terminate();
    await doc.destroy();
  }

  if (placedWords === 0) {
    throw new Error('Koi text nahi pehchana — scan clear hai? Language badal ke dekho');
  }

  options.onProgress?.({ stage: 'build', label: 'Searchable PDF ban rahi hai…', done: total, total });
  const bytes = await out.save();
  return { bytes, pages: total, words: placedWords };
}
