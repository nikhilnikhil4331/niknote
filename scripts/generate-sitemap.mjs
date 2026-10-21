// Regenerate public/sitemap.xml from the public route table + blog posts.
// Run: node scripts/generate-sitemap.mjs
//
// Keeping the sitemap generated instead of hand-edited is the only way it
// stays honest: the previous file listed /upgrade (a payment page) and had no
// lastmod, and nothing would have caught a deleted blog post still being
// submitted to Google.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

export const ORIGIN = 'https://www.niknote.online';

/** Marketing pages that may be indexed (mirrors src/lib/seo/meta.ts). */
export const STATIC_PUBLIC_PATHS = [
  '/',
  '/welcome',
  '/landing',
  '/blog',
  '/schools',
  '/institutions',
  '/handbook',
  '/privacy',
  '/terms',
  '/refunds',
];

export function blogEntries() {
  const source = readFileSync(resolve(root, 'src/pages/Blog.tsx'), 'utf8');
  const entries = [];
  const blocks = source.split(/\n\s*\{\s*\n/).slice(1);
  for (const block of blocks) {
    const slug = /slug:\s*'([^']+)'/.exec(block);
    const date = /date:\s*'([^']+)'/.exec(block);
    if (!slug) continue;
    entries.push({ slug: slug[1], lastmod: date ? date[1] : null });
  }
  return entries;
}

export function buildSitemap() {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [];

  for (const path of STATIC_PUBLIC_PATHS) {
    urls.push({
      loc: `${ORIGIN}${path}`,
      lastmod: today,
      changefreq: path === '/' || path === '/blog' ? 'weekly' : 'monthly',
      priority: path === '/' ? '1.0' : path === '/blog' ? '0.8' : '0.6',
    });
  }

  for (const entry of blogEntries()) {
    urls.push({
      loc: `${ORIGIN}/blog/${entry.slug}`,
      lastmod: entry.lastmod || today,
      changefreq: 'monthly',
      priority: '0.7',
    });
  }

  const body = urls
    .map(
      u =>
        `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

if (process.argv[1] && process.argv[1].endsWith('generate-sitemap.mjs')) {
  const xml = buildSitemap();
  writeFileSync(resolve(root, 'public/sitemap.xml'), xml, 'utf8');
  console.log(`sitemap.xml written (${(xml.match(/<url>/g) || []).length} urls)`);
}
