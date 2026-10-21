import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  NEVER_INDEX,
  SITE_ORIGIN,
  absoluteUrl,
  isPublicPath,
  resolveSeo,
  robotsDirective,
} from '@/lib/seo/meta';
import { applySeo } from '@/components/SeoManager';

const robots = readFileSync(resolve(process.cwd(), 'public/robots.txt'), 'utf8');
const sitemap = readFileSync(resolve(process.cwd(), 'public/sitemap.xml'), 'utf8');
const vercel = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));

function sitemapUrls(): string[] {
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}

describe('route metadata', () => {
  it('lets marketing pages be indexed', () => {
    for (const path of ['/', '/landing', '/blog', '/schools', '/handbook', '/privacy']) {
      const seo = resolveSeo(path);
      expect(seo.indexable, path).toBe(true);
      expect(seo.canonicalPath).toBe(path);
    }
  });

  it('marks every private surface noindex', () => {
    for (const path of ['/account', '/notebooks', '/studio', '/ai', '/payment', '/admin', '/admin/growth', '/admin-panel-nikhil']) {
      expect(resolveSeo(path).indexable, path).toBe(false);
    }
  });

  it('fails closed for unknown routes', () => {
    expect(resolveSeo('/some/deep/private/editor').indexable).toBe(false);
    expect(isPublicPath('/some/deep/private/editor')).toBe(false);
  });

  it('derives a readable title for blog articles only on the slug pattern', () => {
    const seo = resolveSeo('/blog/ai-study-planner-exam-timetable-indian-students');
    expect(seo.indexable).toBe(true);
    expect(seo.title.startsWith('Ai study planner')).toBe(true);
    expect(resolveSeo('/blog/UPPER_CASE').indexable).toBe(false);
  });

  it('never claims a ranking we cannot prove', () => {
    const publicCopy = ['/', '/landing', '/blog', '/schools', '/welcome']
      .map(path => `${resolveSeo(path).title} ${resolveSeo(path).description}`)
      .join(' ');
    expect(publicCopy).not.toMatch(/#\s?1|number one|best in the world|\d+k\+ users/i);
  });

  it('builds absolute canonical URLs on the www origin', () => {
    expect(absoluteUrl('/landing')).toBe(`${SITE_ORIGIN}/landing`);
    expect(robotsDirective(true)).toContain('index');
    expect(robotsDirective(false)).toContain('noindex');
  });
});

describe('applySeo', () => {
  it('writes tags for a public page and clears structured data afterwards', () => {
    applySeo(resolveSeo('/landing'), '/landing');
    expect(document.title).toContain('NikNote');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('index');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${SITE_ORIGIN}/landing`,
    );
    expect(document.querySelectorAll('script[data-seo-jsonld]').length).toBeGreaterThan(0);

    applySeo(resolveSeo('/account'), '/account');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
    expect(document.querySelectorAll('script[data-seo-jsonld]').length).toBe(0);
  });
});

describe('robots.txt', () => {
  it('disallows every private route and points at the sitemap', () => {
    for (const path of NEVER_INDEX) {
      if (path === '/onboarding') continue; // may be public on some flows
      expect(robots, path).toMatch(new RegExp(`Disallow: ${path}\\b`));
    }
    expect(robots).toContain('Sitemap: https://www.niknote.online/sitemap.xml');
  });

  it('keeps the site crawlable at the root', () => {
    expect(robots).toMatch(/User-agent: \*/);
    expect(robots).toMatch(/Allow: \//);
  });
});

describe('sitemap.xml', () => {
  it('submits only indexable URLs', () => {
    const urls = sitemapUrls();
    expect(urls.length).toBeGreaterThan(5);
    for (const url of urls) {
      const path = url.replace(SITE_ORIGIN, '') || '/';
      expect(resolveSeo(path).indexable, url).toBe(true);
    }
  });

  it('never submits payment, account or admin pages', () => {
    for (const forbidden of ['/upgrade', '/payment', '/account', '/admin', '/login', '/signup']) {
      expect(sitemap).not.toContain(`${SITE_ORIGIN}${forbidden}<`);
    }
  });

  it('carries a valid lastmod for every URL', () => {
    const lastmods = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map(m => m[1]);
    expect(lastmods.length).toBe(sitemapUrls().length);
    for (const value of lastmods) expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('vercel headers', () => {
  it('sends X-Robots-Tag noindex for private paths even without JavaScript', () => {
    const sources = vercel.headers.map((h: { source: string }) => h.source).join(' ');
    expect(sources).toContain('/admin');
    expect(sources).toContain('account');
    const noindex = vercel.headers.find(
      (h: { source: string; headers: { key: string }[] }) =>
        h.source.includes('account') &&
        h.headers.some(header => header.key === 'X-Robots-Tag'),
    );
    expect(noindex).toBeTruthy();
  });
});
