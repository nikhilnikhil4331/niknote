#!/usr/bin/env node
/**
 * NikNote — static prerenderer.
 *
 * NikNote is a client-rendered SPA: every route ships the same index.html.
 * Google therefore sees 37 identical documents instead of 37 distinct pages,
 * and titles/canonicals only exist after JavaScript runs.
 *
 * This script writes a real HTML file per indexable route, with:
 *   - route-specific <title>, description, canonical, OG/Twitter tags
 *   - route-specific JSON-LD (BlogPosting / WebPage / BreadcrumbList)
 *   - real server-rendered <main> content inside #root
 *   - real <a href> internal links that work without JavaScript
 *
 * Deliberately browser-free: Puppeteer's Chrome download is unavailable in
 * CI and in many build sandboxes, so this uses Node + esbuild only.
 *
 * Runs automatically via `prebuild`. Output: dist/<route>/index.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const SITE_NAME = 'NikNote';
const AUTHOR = 'Nikhil Jatav';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Inline markdown -> HTML. Escapes first, so no raw HTML can leak through. */
function renderInline(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/(^|\s)\*([^*]+)\*(?=\s|$)/g, '$1<em>$2</em>');
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** Minimal markdown renderer covering exactly the syntax our posts use. */
function renderMarkdown(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let listType = null;
  let paragraph = [];

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };
  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    // Tables: a row line immediately followed by a |---|---| separator.
    if (
      trimmed.startsWith('|') &&
      lines[i + 1] &&
      /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1]) &&
      lines[i + 1].includes('-')
    ) {
      flushParagraph();
      closeList();
      const header = splitTableRow(trimmed);
      const rows = [];
      let j = i + 2;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        rows.push(splitTableRow(lines[j]));
        j += 1;
      }
      out.push('<table><thead><tr>');
      for (const cell of header) out.push(`<th>${renderInline(cell)}</th>`);
      out.push('</tr></thead><tbody>');
      for (const row of rows) {
        out.push('<tr>');
        for (const cell of row) out.push(`<td>${renderInline(cell)}</td>`);
        out.push('</tr>');
      }
      out.push('</tbody></table>');
      i = j - 1;
      continue;
    }

    const heading = /^(#{2,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      if (listType !== 'ul') {
        closeList();
        out.push('<ul>');
        listType = 'ul';
      }
      out.push(`<li>${renderInline(trimmed.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      if (listType !== 'ol') {
        closeList();
        out.push('<ol>');
        listType = 'ol';
      }
      out.push(`<li>${renderInline(trimmed.replace(/^\d+\.\s+/, ''))}</li>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  return out.join('\n');
}

async function loadSeoModule() {
  const result = await build({
    // seoConfig does not re-export blogPosts, so bundle a tiny virtual entry
    // that surfaces both the route registry and the post catalogue.
    stdin: {
      contents: [
        "export * from './src/lib/seoConfig';",
        "export { blogPosts } from './src/content/blogPosts';",
      ].join('\n'),
      resolveDir: rootDir,
      loader: 'ts',
      sourcefile: 'prerender-entry.ts',
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    alias: { '@': path.join(rootDir, 'src') },
  });
  const code = result.outputFiles[0].text;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`;
  return import(dataUrl);
}

/**
 * Rebuild a pristine base document.
 *
 * `dist/index.html` is both the input and the output of the root route, so a
 * second run would otherwise stack duplicate JSON-LD blocks and fail to find
 * `<div id="root"></div>`. Stripping our own previous output makes the script
 * idempotent.
 */
function normalizeBase(html) {
  let out = html;
  out = out.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, '');
  out = out.replace(/<div id="root">[\s\S]*?<\/div>/, '<div id="root"></div>');
  // Real crawlable content now lives in #root, so the generic noscript
  // fallback (identical on every route) only creates duplicate H1s.
  out = out.replace(/<noscript>[\s\S]*?<\/noscript>\s*/gi, '');
  return out;
}

/** Apply route-specific <head> metadata to the built index.html. */
function applyHead(html, { title, description, canonical, robots, jsonLd }) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeCanonical = escapeHtml(canonical);

  let out = html;

  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  out = out.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${safeDesc}" />`,
  );
  out = out.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${safeCanonical}" />`,
  );
  out = out.replace(
    /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="robots" content="${robots}" />`,
  );
  out = out.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${safeCanonical}" />`,
  );
  out = out.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${safeTitle}" />`,
  );
  out = out.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${safeDesc}" />`,
  );
  out = out.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${safeTitle}" />`,
  );
  out = out.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${safeDesc}" />`,
  );

  if (jsonLd) {
    const block = `  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>\n  </head>`;
    out = out.replace(/\s*<\/head>/i, `\n${block}`);
  }
  return out;
}

/**
 * Visible, semantic, no-JS-required content. React replaces #root on mount,
 * so this is crawlable content plus a fast first paint rather than an
 * alternative UI.
 */
function renderBody(content) {
  return `<div id="root"><main style="max-width:760px;margin:0 auto;padding:32px 20px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.65;color:#111827;">${content}</main></div>`;
}

function linkList(routes, currentPath) {
  const items = routes
    .filter((r) => r.canonicalPath !== currentPath)
    .map((r) => {
      const label = r.title.split(/[—|]/)[0].trim();
      return `<li><a href="${escapeHtml(r.canonicalPath)}">${escapeHtml(label)}</a></li>`;
    })
    .join('');
  return `<nav aria-label="More from NikNote"><h2>More from NikNote</h2><ul>${items}</ul></nav>`;
}

async function main() {
  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error('dist/index.html not found — run `npm run build` first.');
  }

  const seo = await loadSeoModule();
  const { PUBLIC_INDEXABLE_ROUTES, CANONICAL_ORIGIN, blogPosts } = seo;

  const routes = PUBLIC_INDEXABLE_ROUTES.filter(
    (r) => r.inSitemap && r.robots === 'index, follow',
  );

  const baseHtml = normalizeBase(fs.readFileSync(indexPath, 'utf8'));
  const written = [];

  const writeRoute = (routePath, html) => {
    const dir = routePath === '/' ? distDir : path.join(distDir, routePath.replace(/^\//, ''));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
    written.push(routePath);
  };

  // 1. Static routes from the SEO registry.
  for (const route of routes) {
    const canonical = `${CANONICAL_ORIGIN}${route.canonicalPath === '/' ? '/' : route.canonicalPath}`;
    const isBlogIndex = route.canonicalPath === '/blog';

    let content = `<article><h1>${escapeHtml(route.title)}</h1><p>${escapeHtml(route.description)}</p>`;

    if (isBlogIndex) {
      content += '<ul>';
      for (const post of blogPosts) {
        content += `<li><a href="/blog/${escapeHtml(post.slug)}">${escapeHtml(post.title)}</a> — ${escapeHtml(post.excerpt)}</li>`;
      }
      content += '</ul>';
    }

    content += `<p><a href="/studio">Open the NikNote editor</a></p>`;
    content += '</article>';
    content += linkList(routes, route.canonicalPath);

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: route.title,
      description: route.description,
      url: canonical,
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: CANONICAL_ORIGIN },
      publisher: { '@type': 'Person', name: AUTHOR },
    };

    let html = applyHead(baseHtml, {
      title: route.title,
      description: route.description,
      canonical,
      robots: 'index, follow, max-image-preview:large, max-snippet:-1',
      jsonLd,
    });
    html = html.replace('<div id="root"></div>', renderBody(content));
    writeRoute(route.canonicalPath, html);
  }

  // 2. Blog posts — the only pages with genuinely unique long-form content.
  for (const post of blogPosts) {
    const routePath = `/blog/${post.slug}`;
    const canonical = `${CANONICAL_ORIGIN}${routePath}`;
    const description = post.excerpt;

    const article = renderMarkdown(post.content);
    const content =
      `<article>` +
      `<p><a href="/blog">← All guides</a></p>` +
      `<h1>${escapeHtml(post.title)}</h1>` +
      `<p><em>${escapeHtml(post.category)} · ${escapeHtml(post.readTime)}` +
      (post.date ? ` · ${escapeHtml(post.date)}` : '') +
      `</em></p>` +
      `${article}` +
      `<p><a href="/studio">Try it in the NikNote editor</a></p>` +
      `</article>` +
      linkList(routes, routePath);

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description,
      url: canonical,
      mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
      ...(post.date ? { datePublished: post.date } : {}),
      author: { '@type': 'Person', name: AUTHOR },
      publisher: { '@type': 'Person', name: AUTHOR },
      keywords: post.tags.join(', '),
      inLanguage: 'en-IN',
    };

    let html = applyHead(baseHtml, {
      title: `${post.title} | NikNote Blog`,
      description,
      canonical,
      robots: 'index, follow, max-image-preview:large, max-snippet:-1',
      jsonLd,
    });
    html = html.replace('<div id="root"></div>', renderBody(content));
    writeRoute(routePath, html);
  }

  // 3. Root route gets the same treatment.
  const home = routes.find((r) => r.canonicalPath === '/');
  if (home) {
    const canonical = `${CANONICAL_ORIGIN}/`;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: SITE_NAME,
      url: canonical,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web, Android',
      description: home.description,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
        description: 'Free tier available; one-time Premium passes start at ₹49 for 7 days.',
      },
      author: { '@type': 'Person', name: AUTHOR },
    };
    let html = applyHead(baseHtml, {
      title: home.title,
      description: home.description,
      canonical,
      robots: 'index, follow, max-image-preview:large, max-snippet:-1',
      jsonLd,
    });
    const content =
      `<article><h1>${escapeHtml(home.title)}</h1><p>${escapeHtml(home.description)}</p>` +
      `<p><a href="/studio">Open the NikNote editor</a> · <a href="/blog">Read the study guides</a> · <a href="/schools">NikNote for teachers</a></p>` +
      `</article>` +
      linkList(routes, '/');
    html = html.replace('<div id="root"></div>', renderBody(content));
    fs.writeFileSync(indexPath, html, 'utf8');
    written.push('/');
  }

  const unique = [...new Set(written)];
  console.log(`prerender: wrote ${unique.length} route HTML files`);
  console.log(`  ${unique.slice(0, 6).join(', ')}${unique.length > 6 ? `, +${unique.length - 6} more` : ''}`);
}

main().catch((err) => {
  console.error('prerender failed:', err);
  process.exit(1);
});
