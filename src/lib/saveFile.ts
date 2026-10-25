// ============================================================
// NikNote — reliable file saving for web, PWA and the Android APK
// Browsers, Android WebView and desktop all "download" differently,
// so every export goes through this one helper:
//   1. Native APK  → Filesystem (Documents) + Share sheet
//   2. Mobile web  → Web Share API with the real file
//   3. Everything  → hidden <a download> blob link
// ============================================================

import { Capacitor } from '@capacitor/core';

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

function toBlob(bytes: Uint8Array | Blob, mime: string): Blob {
  if (bytes instanceof Blob) return bytes;
  return new Blob([bytes as unknown as BlobPart], { type: mime });
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as unknown as number[]);
  }
  return btoa(binary);
}

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function isTouchDevice(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if ((navigator as any)?.maxTouchPoints > 0) return true;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    return Boolean(coarse);
  } catch {
    return false;
  }
}

async function saveNative(bytes: Uint8Array, filename: string): Promise<SaveResult> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const { Share } = await import('@capacitor/share');

  // App-scoped Documents folder: no storage permission needed on any Android version.
  const written = await Filesystem.writeFile({
    path: filename,
    data: toBase64(bytes),
    directory: Directory.Documents,
    recursive: true,
  });

  try {
    await Share.share({
      title: filename,
      text: 'Saved with NikNote',
      url: written.uri,
      dialogTitle: 'Save or share your PDF',
    });
    return 'shared';
  } catch {
    // Share sheet unavailable/dismissed — the file is already in Documents.
    return 'downloaded';
  }
}

async function saveWeb(blob: Blob, filename: string, mime: string): Promise<SaveResult> {
  const nav = navigator as any;

  // Phone browsers: the share sheet can write straight into Files/Drive/WhatsApp.
  // On desktop we always take the classic download path — it's more predictable.
  if (isTouchDevice() && nav?.canShare && nav?.share && typeof File !== 'undefined') {
    try {
      const file = new File([blob], filename, { type: mime });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: filename });
        return 'shared';
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return 'cancelled';
      // fall through to the classic download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  return 'downloaded';
}

/** Saves any generated file and tells the caller what happened. */
export async function saveFile(
  bytes: Uint8Array | Blob,
  filename: string,
  mime = 'application/pdf'
): Promise<SaveResult> {
  const blob = toBlob(bytes, mime);
  if (isNativeApp()) {
    try {
      const raw = bytes instanceof Blob ? new Uint8Array(await bytes.arrayBuffer()) : bytes;
      return await saveNative(raw, filename);
    } catch {
      // Native plugin missing → still let the WebView try a normal download.
      return saveWeb(blob, filename, mime);
    }
  }
  return saveWeb(blob, filename, mime);
}

/** Opens the file in a new tab (used as a last-resort preview escape hatch). */
export function openFileInNewTab(bytes: Uint8Array | Blob, mime = 'application/pdf'): boolean {
  try {
    const url = URL.createObjectURL(toBlob(bytes, mime));
    const win = window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return Boolean(win);
  } catch {
    return false;
  }
}
