// ============================================================
// Prerender integrity guard.
//
// NikNote is a client-rendered SPA. scripts/prerender.mjs writes a real HTML
// file per indexable route so search engines stop seeing 37 identical
// documents. These assertions fail CI if that output regresses.
//
// Requires `npm run build` to have run first (CI does this before tests).
// ============================================================
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

function readIfExists(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function fileForRoute(routePath: string): string {
  const clean = routePath === '/' ? '' : routePath.replace(/^\//, '');
  return clean ? path.join(dist, clean, 'index.html') : path.join(dist, 'index.html');
}

function sitemapRoutes(): string[] {
  const xml = readIfExists(path.join(root, 'public/sitemap.xml'));
  if (!xml) return [];
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return locs.map((loc) => new URL(loc).pathname);
}

function h1Count(html: string): number {
  return (html.match(/<h1[\s>]/gi) || []).length;
}

function jsonLdBlocks(html: string): string[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => m[1],
  );
}

describe('prerender output', () => {
  let routes: string[] = [];

  beforeAll(() => {
    routes = sitemapRoutes();
  });

  it('the sitemap actually lists routes', () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  it('every sitemap route has its own HTML file', () => {
    const missing: string[] = [];
    for (const route of routes) {
      if (!fs.existsSync(fileForRoute(route))) missing.push(route);
    }
    expect(missing, `routes without prerendered HTML: ${missing.join(', ')}`).toEqual([]);
  });

  it('every prerendered page has exactly one H1 and one canonical', () => {
    for (const route of routes) {
      const html = readIfExists(fileForRoute(route));
      if (!html) continue;
      expect(h1Count(html), `H1 count on ${route}`).toBe(1);
      const canonicals = html.match(/rel="canonical"/g) || [];
      expect(canonicals.length, `canonical count on ${route}`).toBe(1);
    }
  });

  it('no two pages share a title or a canonical URL', () => {
    const titles = new Map<string, string>();
    const canonicals = new Map<string, string>();

    for (const route of routes) {
      const html = readIfExists(fileForRoute(route));
      if (!html) continue;

      const title = (/<title>([\s\S]*?)<\/title>/i.exec(html) || [, ''])[1].trim();
      expect(title.length, `empty title on ${route}`).toBeGreaterThan(0);
      if (titles.has(title)) {
        throw new Error(`duplicate title "${title}" on ${route} and ${titles.get(title)}`);
      }
      titles.set(title, route);

      const canonical = (/<link\s+rel="canonical"\s+href="([^"]+)"/i.exec(html) || [, ''])[1];
      expect(canonical, `missing canonical on ${route}`).toMatch(/^https:\/\/www\.niknote\.online/);
      if (canonicals.has(canonical)) {
        throw new Error(`duplicate canonical ${canonical} on ${route} and ${canonicals.get(canonical)}`);
      }
      canonicals.set(canonical, route);
    }
  });

  it('every page carries valid JSON-LD structured data', () => {
    for (const route of routes) {
      const html = readIfExists(fileForRoute(route));
      if (!html) continue;
      const blocks = jsonLdBlocks(html);
      expect(blocks.length, `JSON-LD count on ${route}`).toBe(1);
      const parsed = JSON.parse(blocks[0]);
      expect(parsed['@context']).toBe('https://schema.org');
      expect(typeof parsed['@type']).toBe('string');
    }
  });

  it('every page keeps the app bundle so the SPA still boots', () => {
    for (const route of routes) {
      const html = readIfExists(fileForRoute(route));
      if (!html) continue;
      expect(html, `missing module script on ${route}`).toMatch(/<script type="module"[^>]+src="\/assets\//);
      expect(html, `missing #root on ${route}`).toMatch(/<div id="root">/);
    }
  });

  it('pages contain real body text, not just a loading shell', () => {
    for (const route of routes) {
      const html = readIfExists(fileForRoute(route));
      if (!html) continue;
      const body = /<div id="root">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '';
      const text = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      expect(text.length, `too little crawlable text on ${route}`).toBeGreaterThan(80);
    }
  });

  it('vercel.json routes every prerendered page before the SPA catch-all', () => {
    const cfg = JSON.parse(readIfExists(path.join(root, 'vercel.json')) || '{}');
    const rewrites: { source: string; destination: string }[] = cfg.rewrites || [];

    const catchAllIndex = rewrites.findIndex((r) => r.source === '/(.*)');
    expect(catchAllIndex, 'SPA catch-all rewrite must exist').toBeGreaterThan(-1);

    const destinations = new Set(rewrites.slice(0, catchAllIndex).map((r) => r.destination));
    const uncovered: string[] = [];

    for (const route of routes) {
      if (route === '/') continue;
      if (route.startsWith('/blog/')) {
        if (!destinations.has('/blog/:slug/index.html')) uncovered.push(route);
        continue;
      }
      if (!destinations.has(`${route}/index.html`)) uncovered.push(route);
    }

    expect(uncovered, `sitemap routes with no rewrite before catch-all: ${uncovered.join(', ')}`).toEqual([]);
  });
});
