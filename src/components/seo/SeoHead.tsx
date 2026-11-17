// ============================================================
// NikNote — Route-Aware Technical SEO Head Manager
// Synchronizes title, description, canonical, robots, OpenGraph,
// Twitter tags, and valid JSON-LD structured data per route.
// ============================================================

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CANONICAL_ORIGIN, getCanonicalUrl, resolveRouteSeo } from '@/lib/seoConfig';

const SOCIAL_IMAGE_URL = `${CANONICAL_ORIGIN}/og-image.jpg`;
const SOCIAL_IMAGE_ALT = 'NikNote — handwritten-style notes and study tools';

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMeta(attr: 'name' | 'property', key: string): void {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function upsertCanonical(href: string): void {
  let link = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function SeoHead() {
  const { pathname } = useLocation();

  useEffect(() => {
    const seo = resolveRouteSeo(pathname);
    const canonicalUrl = getCanonicalUrl(seo.canonicalPath);

    document.title = seo.title;
    upsertMeta('name', 'description', seo.description);
    upsertMeta('name', 'robots', seo.robots);
    upsertCanonical(canonicalUrl);

    upsertMeta('property', 'og:site_name', 'NikNote');
    upsertMeta('property', 'og:locale', 'en_IN');
    upsertMeta('property', 'og:title', seo.title);
    upsertMeta('property', 'og:description', seo.description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:type', seo.pageType === 'blog_post' ? 'article' : 'website');
    upsertMeta('property', 'og:image', SOCIAL_IMAGE_URL);
    upsertMeta('property', 'og:image:type', 'image/jpeg');
    upsertMeta('property', 'og:image:width', '1200');
    upsertMeta('property', 'og:image:height', '630');
    upsertMeta('property', 'og:image:alt', SOCIAL_IMAGE_ALT);

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', seo.title);
    upsertMeta('name', 'twitter:description', seo.description);
    upsertMeta('name', 'twitter:image', SOCIAL_IMAGE_URL);
    upsertMeta('name', 'twitter:image:alt', SOCIAL_IMAGE_ALT);

    if (seo.pageType === 'blog_post' && seo.blogPost?.date) {
      upsertMeta('property', 'article:published_time', seo.blogPost.date);
    } else {
      removeMeta('property', 'article:published_time');
    }

    // Manage route-scoped JSON-LD schemas (never invent ratings/authors/FAQs)
    const existingSchemas = document.head.querySelectorAll('script[data-niknote-route-schema="true"]');
    existingSchemas.forEach((el) => el.remove());

    const schemas: Record<string, unknown>[] = [];

    if (seo.robots === 'index, follow' && seo.canonicalPath !== '/') {
      const items: Record<string, unknown>[] = [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${CANONICAL_ORIGIN}/`,
        },
      ];

      if (seo.pageType === 'blog_post' && seo.blogPost) {
        items.push(
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Blog',
            item: `${CANONICAL_ORIGIN}/blog`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: seo.blogPost.title,
            item: canonicalUrl,
          },
        );
      } else {
        items.push({
          '@type': 'ListItem',
          position: 2,
          name: seo.title.split('—')[0].split('|')[0].trim(),
          item: canonicalUrl,
        });
      }

      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items,
      });
    }

    if (seo.pageType === 'blog_post' && seo.blogPost) {
      const articleSchema: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: seo.blogPost.title,
        description: seo.blogPost.excerpt,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalUrl,
        },
        author: {
          '@type': 'Person',
          name: 'Nikhil Jatav',
          url: `${CANONICAL_ORIGIN}/`,
        },
        publisher: {
          '@type': 'Organization',
          name: 'NikNote',
          url: CANONICAL_ORIGIN,
          logo: {
            '@type': 'ImageObject',
            url: `${CANONICAL_ORIGIN}/niknote-logo.png`,
          },
        },
        image: SOCIAL_IMAGE_URL,
      };
      if (seo.blogPost.date) {
        articleSchema.datePublished = seo.blogPost.date;
      }
      schemas.push(articleSchema);
    }

    for (const schema of schemas) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-niknote-route-schema', 'true');
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    }
  }, [pathname]);

  return null;
}
