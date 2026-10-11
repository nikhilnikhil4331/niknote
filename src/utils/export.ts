// ============================================================
// NikNote 4.0 — Enhanced PDF/Image Export Engine
// Production-grade: Multi-page, progress, error recovery,
// high-DPI, proper A4 sizing, dark/light mode support
// ============================================================

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export type ExportProgress = {
  current: number;
  total: number;
  percentage: number;
  status: 'preparing' | 'capturing' | 'rendering' | 'saving' | 'done';
};

export type ProgressCallback = (progress: ExportProgress) => void;

// A4 dimensions
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

// Wait for fonts and images
const waitForResources = async (): Promise<void> => {
  await document.fonts.ready;
  await new Promise(resolve => setTimeout(resolve, 500));
};

/**
 * Find visible page elements for export
 */
const findVisiblePageElements = (): HTMLElement[] => {
  // Method 1: data-export-page attribute
  const exportPages = document.querySelectorAll('[data-export-page="true"]');
  const visible = Array.from(exportPages).filter(el => {
    const rect = (el as HTMLElement).getBoundingClientRect();
    return rect.width > 50 && rect.height > 50 && rect.left > -5000;
  });
  if (visible.length > 0) return visible as unknown as HTMLElement[];

  // Method 2: Preview container
  const container = document.querySelector('[data-preview-container]')
    || document.querySelector('.paper-shadow')
    || document.querySelector('[class*="paper"]');
  if (container) return [container as HTMLElement];

  return [];
};

/**
 * Capture element to canvas with retry logic
 */
const captureToCanvas = async (
  element: HTMLElement,
  retries = 2
): Promise<HTMLCanvasElement> => {
  if (!element) throw new Error('Element not found');

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await waitForResources();

      const rect = element.getBoundingClientRect();
      const width = element.offsetWidth || rect.width || A4_WIDTH_PX;
      const height = element.offsetHeight || rect.height || A4_HEIGHT_PX;

      if (width < 10 || height < 10) {
        throw new Error(`Element too small: ${width}x${height}`);
      }

      const canvas = await html2canvas(element, {
        scale: window.innerWidth < 768 ? 2 : 3.125, // ~300 DPI on desktop, lighter on phones
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        allowTaint: true,
        foreignObjectRendering: false,
        imageTimeout: 15000,
        removeContainer: true,
        width: width,
        height: height,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        windowWidth: width,
        windowHeight: height,
        ignoreElements: (el) => {
          // Never drop stylesheets — they are display:none but carry every class style
          if (/^(STYLE|LINK|HEAD|META|TITLE|SCRIPT|NOSCRIPT)$/.test(el.tagName)) return false;
          const style = window.getComputedStyle(el);
          return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
        },
      });

      if (!canvas || canvas.width < 10 || canvas.height < 10) {
        throw new Error('Captured canvas is empty');
      }

      return canvas;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Capture attempt ${attempt + 1} failed:`, lastError.message);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('Failed to capture element');
};

/**
 * Main PDF export function
 */
export async function exportToPDF(
  elements: HTMLElement[],
  filename: string = 'niknote-notes',
  _pageSize?: string,
  onProgress?: ProgressCallback
): Promise<void> {
  // Find valid elements
  let validElements = elements.filter(el => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 10 && rect.height > 10;
  });

  if (validElements.length === 0) {
    console.warn('No valid elements provided, searching DOM...');
    validElements = findVisiblePageElements();
  }

  if (validElements.length === 0) {
    throw new Error('No pages found to export. Please make sure the preview is visible and has content.');
  }

  onProgress?.({ current: 0, total: validElements.length, percentage: 0, status: 'preparing' });
  await waitForResources();

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const total = validElements.length;

  for (let i = 0; i < validElements.length; i++) {
    onProgress?.({
      current: i + 1,
      total,
      percentage: Math.round(((i + 1) / total) * 100),
      status: 'capturing',
    });

    try {
      let canvas = await captureToCanvas(validElements[i]);
      const tilt = Number(validElements[i].dataset.tilt || 0);
      if (tilt) {
        // Natural page tilt: rotate the captured page on a white sheet
        const out = document.createElement('canvas');
        out.width = canvas.width; out.height = canvas.height;
        const ctx = out.getContext('2d')!;
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, out.width, out.height);
        ctx.translate(out.width / 2, out.height / 2);
        ctx.rotate((tilt * Math.PI) / 180);
        ctx.scale(0.97, 0.97);
        ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 18;
        ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        canvas = out;
      }
      const imgData = canvas.toDataURL('image/png', 1.0);

      if (i > 0) pdf.addPage();

      // Calculate aspect ratio to fit A4 without distortion
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const imgAspectRatio = imgWidth / imgHeight;
      const a4AspectRatio = A4_WIDTH_MM / A4_HEIGHT_MM;

      let finalWidth: number;
      let finalHeight: number;
      let x = 0;
      let y = 0;

      if (imgAspectRatio > a4AspectRatio) {
        // Image is wider than A4 — fit to width
        finalWidth = A4_WIDTH_MM;
        finalHeight = A4_WIDTH_MM / imgAspectRatio;
        y = (A4_HEIGHT_MM - finalHeight) / 2;
      } else {
        // Image is taller than A4 — fit to height
        finalHeight = A4_HEIGHT_MM;
        finalWidth = A4_HEIGHT_MM * imgAspectRatio;
        x = (A4_WIDTH_MM - finalWidth) / 2;
      }

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to capture page ${i + 1}:`, message);
      // Add blank page with error text instead of crashing
      if (i > 0) pdf.addPage();
      pdf.setFontSize(12);
      pdf.text(`Page ${i + 1}: Export failed`, 20, 30);
      pdf.setFontSize(8);
      pdf.text(message, 20, 40);
    }
  }

  onProgress?.({ current: total, total, percentage: 100, status: 'saving' });
  pdf.save(`${filename}.pdf`);
  onProgress?.({ current: total, total, percentage: 100, status: 'done' });
}

/**
 * Export single page as image (PNG or JPEG)
 */
export async function exportToImage(
  element: HTMLElement,
  format: 'png' | 'jpeg' = 'png',
  filename: string = 'niknote-note'
): Promise<void> {
  if (!element) {
    const found = findVisiblePageElements();
    if (found.length > 0) element = found[0];
    else throw new Error('No content to export');
  }

  const canvas = await captureToCanvas(element);
  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
  const quality = format === 'jpeg' ? 0.92 : undefined;

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), mimeType, quality);
  });

  if (!blob || blob.size < 100) {
    throw new Error('Generated file is empty or corrupted');
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.${format}`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Export multiple pages as individual images
 */
export async function exportAllPagesToImages(
  elements: HTMLElement[],
  format: 'png' | 'jpeg' = 'png',
  baseFilename: string = 'niknote-note',
  onProgress?: ProgressCallback
): Promise<void> {
  let validElements = elements.filter(el => el && el.getBoundingClientRect().width > 10);
  if (validElements.length === 0) validElements = findVisiblePageElements();
  if (validElements.length === 0) throw new Error('No pages found to export');

  const total = validElements.length;
  for (let i = 0; i < validElements.length; i++) {
    onProgress?.({
      current: i + 1,
      total,
      percentage: Math.round(((i + 1) / total) * 100),
      status: 'capturing',
    });
    try {
      const filename = total === 1 ? baseFilename : `${baseFilename}-page-${i + 1}`;
      await exportToImage(validElements[i], format, filename);
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`Failed to export page ${i + 1}:`, err);
    }
  }
}

/**
 * Convenience function
 */
export async function exportPages(
  elements: HTMLElement[],
  filename: string = 'niknote-notes',
  onProgress?: ProgressCallback
): Promise<void> {
  return exportToPDF(elements, filename, undefined, onProgress);
}
