import { supabase } from '@/integrations/supabase/client';

// Keep the gateway request below its payload limit while retaining legible
// handwriting. Images are resized locally before they leave the browser.
export async function prepareHandwritingImage(dataUrl: string): Promise<string> {
  if (/^data:image\/(jpeg|png|webp|gif);base64,/i.test(dataUrl) && dataUrl.length <= 3_400_000) return dataUrl;
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error('Could not read this image. Try a JPEG or PNG.'));
    image.onload = () => {
      try {
        const scale = Math.min(1, 2000 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not resize the image on this device.');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const result = canvas.toDataURL('image/jpeg', 0.82);
        if (result.length > 3_400_000) throw new Error('Image is too large. Try a smaller photo.');
        resolve(result);
      } catch (error) { reject(error); }
    };
    image.src = dataUrl;
  });
}

export async function requestPaidHandwritingVision(kind: 'style' | 'ocr', imageBase64: string): Promise<any> {
  const image = await prepareHandwritingImage(imageBase64);
  const { data, error } = await supabase.functions.invoke('handwriting-vision', { body: { kind, imageBase64: image } });
  if (error) {
    const context = (error as unknown as { context?: Response }).context;
    let message = 'Handwriting service is temporarily unavailable. Please try again.';
    try {
      const payload = await context?.clone().json();
      if (typeof payload?.error === 'string') message = payload.error;
    } catch { /* keep safe fallback */ }
    throw Object.assign(new Error(message), { status: context?.status });
  }
  if (!data || typeof data !== 'object') throw new Error('Handwriting service returned an unreadable result.');
  return data;
}
