// ============================================================
// NikNote — Dynamic Document Title & Meta Hook
// Updates page title + meta description + canonical cleanly
// ============================================================

import { useEffect } from 'react';
import { getCanonicalUrl, resolveRouteSeo } from '@/lib/seoConfig';

interface PageMeta {
  title: string;
  description?: string;
}

const DEFAULT_META: PageMeta = {
  title: 'Text to Handwriting Converter & Notes Maker | NikNote',
  description:
    'Turn typed text into handwritten-style notes online. Choose a style, paper and ink, preview pages, and export a PDF. Explore Hindi-English study tools too.',
};

export function useDocumentTitle(meta: PageMeta) {
  useEffect(() => {
    const descEl = document.querySelector('meta[name="description"]');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const canonical = document.querySelector('link[rel="canonical"]');

    document.title = meta.title;
    if (meta.description && descEl) {
      descEl.setAttribute('content', meta.description);
    }
    ogTitle?.setAttribute('content', meta.title);
    if (meta.description) ogDescription?.setAttribute('content', meta.description);

    if (canonical && typeof window !== 'undefined') {
      const seo = resolveRouteSeo(window.location.pathname);
      canonical.setAttribute('href', getCanonicalUrl(seo.canonicalPath));
    }
  }, [meta.title, meta.description]);
}

export { DEFAULT_META };
