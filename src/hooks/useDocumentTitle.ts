// ============================================================
// NikNote 4.0 — Dynamic Document Title Hook
// Updates page title + meta description per route
// ============================================================

import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description?: string;
}

const DEFAULT_META: PageMeta = {
  title: 'NikNote — Free AI Study App for Indian Students | Handwriting Notes + AI Teacher',
  description: 'NikNote — India ka #1 AI Study App! Convert text to 16+ handwriting styles. AI Teacher (Hindi+English), Quiz Generator, Flashcards. Free shuru karo!',
};

export function useDocumentTitle(meta: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title;
    const descEl = document.querySelector('meta[name="description"]');
    const previousDescription = descEl?.getAttribute('content');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const previousOgTitle = ogTitle?.getAttribute('content');
    const previousOgDescription = ogDescription?.getAttribute('content');
    document.title = meta.title;

    // Update meta description if provided
    if (meta.description) {
      if (descEl) {
        descEl.setAttribute('content', meta.description);
      }
    }
    ogTitle?.setAttribute('content', meta.title);
    if (meta.description) ogDescription?.setAttribute('content', meta.description);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', `https://www.niknote.online${window.location.pathname}`);

    return () => {
      document.title = prevTitle;
      if (previousDescription !== null && previousDescription !== undefined) descEl?.setAttribute('content', previousDescription);
      if (previousOgTitle !== null && previousOgTitle !== undefined) ogTitle?.setAttribute('content', previousOgTitle);
      if (previousOgDescription !== null && previousOgDescription !== undefined) ogDescription?.setAttribute('content', previousOgDescription);
      if (canonical) canonical.setAttribute('href', 'https://www.niknote.online/');
    };
  }, [meta.title, meta.description]);
}

export { DEFAULT_META };
