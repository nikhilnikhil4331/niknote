// ============================================================
// NikNote PDF Tools — Compress
// Re-renders every page as a JPEG and rebuilds the PDF, which is
// exactly what "compress my PDF" means for scanned / photo-heavy files.
// Browser only (needs a canvas), so it is dynamically imported by the UI.
// ============================================================

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type CompressQuality = 'tiny' | 'balanced' | 'sharp';

export type CompressOptions = {
  quality?: CompressQuality;
  onProgress?: (done: number, total: number) => void;
};

const QUALITY_PRESETS: Record<CompressQuality, { jpeg: number; scale: number; label: string; hint: string }> = {
  tiny: { jpeg: 0.45, scale: 1.25, label: 'Smallest', hint: 'Best for sharing on WhatsApp' },
  balanced: { jpeg: 0.65, scale: 1.6, label: 'Balanced', hint: 'Recommended for most PDFs' },
  sharp: { jpeg: 0.82, scale: 2, label: 'Sharper', hint: 'Keeps small text readable' },
};

export function compressPreset(quality: CompressQuality) {
  return QUALITY_PRESETS[quality] || QUALITY_PRESETS.balanced;
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Uint8Array {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function compressPdf(
  input: Uint8Array | ArrayBuffer,
  options: CompressOptions = {}
): Promise<{ bytes: Uint8Array; before: number; after: number }> {
  const preset = compressPreset(options.quality || 'balanced');
  const source = input instanceof Uint8Array ? input : new Uint8Array(input);
  const before = source.byteLength;

  const doc = await pdfjs.getDocument({
    // pdf.js takes ownership of the buffer, so hand it a copy.
    data: source.slice(0),
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;

  const out = await PDFDocument.create();
  const total = doc.numPages;

  for (let i = 1; i <= total; i += 1) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: preset.scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable on this device');

    // White background — otherwise transparent scans turn black in JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const jpeg = canvasToJpeg(canvas, preset.jpeg);
    const image = await out.embedJpg(jpeg);
    const target = out.addPage([base.width, base.height]);
    target.drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });

    canvas.width = 0;
    canvas.height = 0;
    page.cleanup();
    options.onProgress?.(i, total);
  }

  await doc.destroy();
  out.setProducer('NikNote PDF Tools');
  const bytes = await out.save();
  return { bytes, before, after: bytes.byteLength };
}
