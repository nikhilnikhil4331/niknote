import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  absoluteUrl,
  blogPostJsonLd,
  resolveSeo,
  robotsDirective,
  siteJsonLd,
  type RouteSeo,
} from '@/lib/seo/meta';

const JSONLD_ATTR = 'data-seo-jsonld';

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el!.setAttribute(key, value));
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Writes the metadata for a resolved route (exported for tests). */
export function applySeo(seo: RouteSeo, pathname: string) {
  const url = absoluteUrl(seo.canonicalPath);
  document.title = seo.title;

  upsertMeta('meta[name="description"]', { name: 'description', content: seo.description });
  upsertMeta('meta[name="robots"]', { name: 'robots', content: robotsDirective(seo.indexable) });
  upsertMeta('meta[name="googlebot"]', {
    name: 'googlebot',
    content: robotsDirective(seo.indexable),
  });
  upsertLink('canonical', url);

  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: seo.title });
  upsertMeta('meta[property="og:description"]', {
    property: 'og:description',
    content: seo.description,
  });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url });
  upsertMeta('meta[property="og:type"]', {
    property: 'og:type',
    content: pathname.startsWith('/blog/') ? 'article' : 'website',
  });
  if (seo.ogImage) {
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: seo.ogImage });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: seo.ogImage });
  }
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: seo.title });
  upsertMeta('meta[name="twitter:description"]', {
    name: 'twitter:description',
    content: seo.description,
  });

  // Structured data: only for indexable pages, always rebuilt so a private
  // route cannot inherit schema from the previous page.
  document.head.querySelectorAll(`script[${JSONLD_ATTR}]`).forEach(node => node.remove());
  if (seo.indexable) {
    const blocks = pathname.startsWith('/blog/')
      ? [...siteJsonLd(), blogPostJsonLd(seo.title, seo.description, seo.canonicalPath)]
      : siteJsonLd();
    blocks.forEach(block => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute(JSONLD_ATTR, 'true');
      script.textContent = JSON.stringify(block);
      document.head.appendChild(script);
    });
  }
}

/**
 * Keeps document metadata in sync with the client router.
 * Mounted once inside <BrowserRouter> (see src/App.tsx).
 */
export function SeoManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    applySeo(resolveSeo(pathname), pathname);
  }, [pathname]);

  return null;
}

export default SeoManager;
