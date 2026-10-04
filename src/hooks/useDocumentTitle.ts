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
    document.title = meta.title;

    // Update meta description if provided
    if (meta.description) {
      const descEl = document.querySelector('meta[name="description"]');
      if (descEl) {
        descEl.setAttribute('content', meta.description);
      }
    }
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', `https://www.niknote.online${window.location.pathname}`);

    return () => {
      document.title = prevTitle;
      if (canonical) canonical.setAttribute('href', 'https://www.niknote.online/');
    };
  }, [meta.title, meta.description]);
}

export { DEFAULT_META };
