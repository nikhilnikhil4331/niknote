#!/usr/bin/env node
/**
 * Auto-generates public/sitemap.xml from src/lib/seoConfig.ts + src/content/blogPosts.ts.
 * Runs automatically via `prebuild` (`npm run build`) or manually via `npm run sitemap`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function main() {
  const entryPoint = path.join(rootDir, 'src/lib/seoConfig.ts');
  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    alias: {
      '@': path.join(rootDir, 'src'),
    },
  });

  const code = result.outputFiles[0].text;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`;
  const seoModule = await import(dataUrl);

  const entries = seoModule.getAllSitemapEntries();

  // Safety assertions: canonical HTTPS origin, no duplicates, no non-indexable paths
  const seen = new Set();
  for (const entry of entries) {
    if (!entry.loc.startsWith('https://www.niknote.online')) {
      throw new Error(`Invalid non-canonical sitemap URL: ${entry.loc}`);
    }
    if (seen.has(entry.loc)) {
      throw new Error(`Duplicate sitemap URL detected: ${entry.loc}`);
    }
    seen.add(entry.loc);
  }

  const xmlLines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const entry of entries) {
    xmlLines.push('  <url>');
    xmlLines.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
    if (entry.lastmod) {
      xmlLines.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    }
    if (entry.changefreq) {
      xmlLines.push(`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`);
    }
    if (entry.priority) {
      xmlLines.push(`    <priority>${escapeXml(entry.priority)}</priority>`);
    }
    xmlLines.push('  </url>');
  }

  xmlLines.push('</urlset>');
  xmlLines.push('');

  const outPath = path.join(rootDir, 'public/sitemap.xml');
  fs.writeFileSync(outPath, xmlLines.join('\n'), 'utf8');
  console.log(`Generated ${outPath} with ${entries.length} canonical URLs.`);
}

main().catch((err) => {
  console.error('Failed to generate sitemap.xml:', err);
  process.exit(1);
});
