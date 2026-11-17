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
const SOCIAL_IMAGE_URL = 'https://www.niknote.online/og-image.jpg';
const SOCIAL_IMAGE_ALT = 'NikNote — handwritten-style notes and study tools';

const ROUTE_GUIDES = {
  '/': {
    heading: 'Turn typed text into handwritten notes',
    sections: [
      {
        heading: 'Create a handwritten-style page',
        paragraphs: [
          'Type or paste your notes, choose an available handwriting style, and preview how the page will look before exporting it.',
          'Use ruled, graph, dotted or plain paper, then choose an ink colour and adjust the page to suit your notes.',
        ],
        items: [
          { href: '/editor/new', label: 'Open the handwriting notes editor' },
          { href: '/blog/how-to-convert-text-to-handwriting', label: 'Read the text-to-handwriting guide' },
        ],
      },
      {
        heading: 'Study and document tools in one place',
        paragraphs: [
          'NikNote also brings together Hindi and English study assistance, flashcards, PDF utilities and OCR for turning readable note images into editable text.',
        ],
        items: [
          { href: '/ai', label: 'Explore the Hindi and English AI study assistant' },
          { href: '/pdf-tools', label: 'Browse PDF tools' },
          { href: '/scan-notes', label: 'Try the notes OCR scanner' },
        ],
      },
    ],
  },
  '/landing': {
    heading: 'Explore NikNote’s handwriting and study tools',
    sections: [
      {
        heading: 'From typed text to printable notes',
        paragraphs: ['Choose a handwriting style, paper and ink, preview your work, and export the finished notes as a PDF.'],
        items: [{ href: '/editor/new', label: 'Try the handwriting editor' }],
      },
      {
        heading: 'More ways to learn and organize',
        paragraphs: ['Use NikAI for study explanations, practice with flashcards, scan notes with OCR, or work with PDFs in your browser.'],
        items: [
          { href: '/ai', label: 'AI study assistant' },
          { href: '/flashcards', label: 'Study flashcards' },
          { href: '/pdf-editor', label: 'Online PDF editor' },
        ],
      },
    ],
  },
  '/ai': {
    heading: 'AI study assistant in Hindi and English',
    sections: [
      {
        heading: 'Ask a study question and review the explanation',
        paragraphs: [
          'Use NikAI to explore a topic in Hindi, English or Hinglish. You can ask for explanations, study notes, quiz questions or flashcards.',
          'AI-generated material can be incomplete or incorrect, so compare important answers with your class notes and trusted learning materials.',
        ],
        items: [
          { href: '/ai-solver', label: 'Open the step-by-step study solver' },
          { href: '/documents', label: 'Review study PDFs with Document Intelligence' },
          { href: '/flashcards', label: 'Practice with flashcards' },
        ],
      },
    ],
  },
  '/ai-solver': {
    heading: 'Work through study questions step by step',
    sections: [
      {
        heading: 'Use explanations to support your own learning',
        paragraphs: [
          'Enter a maths, physics, chemistry, biology or other study question and review the solution steps in Hindi or English.',
          'Check calculations and important facts against your course material; use the explanation to understand the method rather than as a substitute for your own work.',
        ],
        items: [
          { href: '/ai', label: 'Ask NikAI about a study topic' },
          { href: '/flashcards', label: 'Review key concepts with flashcards' },
        ],
      },
    ],
  },
  '/pdf-editor': {
    heading: 'Edit and annotate PDFs in your browser',
    sections: [
      {
        heading: 'Review pages and mark up a document',
        paragraphs: [
          'Open a PDF to highlight passages, draw, add annotations, and organize pages. Text editing is available for supported PDF content.',
          'Review the exported file before sharing or printing, especially when the source PDF uses unusual fonts or scanned pages.',
        ],
        items: [
          { href: '/pdf-tools', label: 'Explore merge, split and other PDF tools' },
          { href: '/scan-notes', label: 'Extract text from a note image with OCR' },
        ],
      },
    ],
  },
  '/pdf-tools': {
    heading: 'Free PDF tools for everyday document tasks',
    sections: [
      {
        heading: 'Combine, split and prepare PDF files',
        paragraphs: [
          'Choose a PDF utility such as merge, split, compression, page numbering or OCR. Select your files, check the settings, and review the result before downloading.',
          'For scanned pages, OCR output may need correction. Keep a copy of the original document when accuracy matters.',
        ],
        items: [
          { href: '/pdf-editor', label: 'Open the PDF editor' },
          { href: '/documents', label: 'Summarize a study PDF' },
        ],
      },
    ],
  },
  '/scan-notes': {
    heading: 'Scan notes and review the extracted text',
    sections: [
      {
        heading: 'Turn a readable note image into editable text',
        paragraphs: [
          'Capture or upload an image and run OCR to recognize supported printed or handwritten text. Review and correct the result because recognition quality depends on handwriting, lighting and image clarity.',
          'NikNote supports English and Hindi OCR workflows. Very cursive writing, low contrast or blurred images may need manual correction.',
        ],
        items: [
          { href: '/pdf-tools', label: 'Use OCR and other PDF tools' },
          { href: '/editor/new', label: 'Edit notes in the handwriting workspace' },
        ],
      },
    ],
  },
  '/documents': {
    heading: 'Review study PDFs with Document Intelligence',
    sections: [
      {
        heading: 'Find key ideas for revision',
        paragraphs: [
          'Use Document Intelligence to review a study PDF or class handout and create a structured summary of key ideas. Check important details in the original source before relying on an AI-generated summary.',
        ],
        items: [
          { href: '/ai', label: 'Ask NikAI about a concept' },
          { href: '/flashcards', label: 'Turn key ideas into revision cards' },
        ],
      },
    ],
  },
  '/flashcards': {
    heading: 'Make and review online study flashcards',
    sections: [
      {
        heading: 'Practice active recall',
        paragraphs: [
          'Create question-and-answer cards for a topic, then try to recall the answer before checking it. Edit cards that are unclear and revisit the concepts you missed.',
          'Flashcards are a study aid, not a replacement for the syllabus, class material or exam practice.',
        ],
        items: [
          { href: '/ai', label: 'Generate study material with NikAI' },
          { href: '/ai-solver', label: 'Work through a question step by step' },
        ],
      },
    ],
  },
  '/schools': {
    heading: 'Create handwritten-style worksheets for teaching',
    sections: [
      {
        heading: 'Prepare materials with the NikNote editor',
        paragraphs: [
          'Teachers and tutors can use the handwriting editor to prepare notes or worksheet-style pages and export them as PDFs. Try the editor first, then contact NikNote to discuss institution requirements.',
          'Institutional features and pricing depend on the requirements discussed; NikNote does not currently advertise a self-serve school dashboard on this page.',
        ],
        items: [
          { href: '/editor/new', label: 'Try the notes editor' },
          { href: '/handbook', label: 'Read the product handbook' },
        ],
      },
    ],
  },
};

const RELATED_ROUTE_PATHS = {
  '/': ['/landing', '/ai', '/pdf-editor', '/pdf-tools', '/blog'],
  '/landing': ['/', '/ai', '/ai-solver', '/schools'],
  '/ai': ['/ai-solver', '/documents', '/flashcards', '/blog'],
  '/ai-solver': ['/ai', '/documents', '/flashcards'],
  '/pdf-editor': ['/pdf-tools', '/scan-notes', '/'],
  '/pdf-tools': ['/pdf-editor', '/scan-notes', '/documents'],
  '/scan-notes': ['/pdf-tools', '/pdf-editor', '/'],
  '/documents': ['/ai', '/flashcards', '/blog'],
  '/flashcards': ['/ai', '/ai-solver', '/blog'],
  '/habit': ['/flashcards', '/blog', '/'],
  '/schools': ['/', '/upgrade', '/handbook'],
  '/upgrade': ['/', '/landing', '/schools'],
  '/handbook': ['/', '/blog', '/ai'],
  '/blog': ['/', '/ai', '/flashcards', '/scan-notes'],
  '/privacy': ['/terms', '/refunds', '/'],
  '/terms': ['/privacy', '/refunds', '/'],
  '/refunds': ['/upgrade', '/privacy', '/terms'],
};

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

function setHeadMeta(html, attribute, key, value) {
  const tag = `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`;
  const marker = `<meta ${attribute}="${key}"`;
  const start = html.indexOf(marker);

  if (start >= 0) {
    const end = html.indexOf('>', start);
    if (end >= 0) return `${html.slice(0, start)}${tag}${html.slice(end + 1)}`;
  }

  return html.replace('</head>', `  ${tag}\n</head>`);
}

/** Apply route-specific <head> metadata to the built index.html. */
function applyHead(html, {
  title,
  description,
  canonical,
  robots,
  jsonLd,
  ogType = 'website',
  articlePublishedTime,
}) {
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

  for (const [attribute, key, value] of [
    ['property', 'og:site_name', SITE_NAME],
    ['property', 'og:locale', 'en_IN'],
    ['property', 'og:type', ogType],
    ['property', 'og:image', SOCIAL_IMAGE_URL],
    ['property', 'og:image:type', 'image/jpeg'],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:image:alt', SOCIAL_IMAGE_ALT],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:image', SOCIAL_IMAGE_URL],
    ['name', 'twitter:image:alt', SOCIAL_IMAGE_ALT],
  ]) {
    out = setHeadMeta(out, attribute, key, value);
  }
  if (articlePublishedTime) {
    out = setHeadMeta(out, 'property', 'article:published_time', articlePublishedTime);
  }

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
  const candidatePaths = RELATED_ROUTE_PATHS[currentPath] || ['/','/blog','/ai'];
  const items = candidatePaths
    .map((candidate) => routes.find((route) => route.canonicalPath === candidate))
    .filter((route) => route && route.canonicalPath !== currentPath)
    .map((route) => {
      const label = route.title.split(/[—|]/)[0].trim();
      return `<li><a href="${escapeHtml(route.canonicalPath)}">${escapeHtml(label)}</a></li>`;
    })
    .join('');
  return items
    ? `<nav aria-label="Related NikNote pages"><h2>Related tools and guides</h2><ul>${items}</ul></nav>`
    : '';
}

function renderPageArticle(route, blogPosts) {
  const guide = ROUTE_GUIDES[route.canonicalPath];
  const heading = guide?.heading || route.title;
  let content = `<article><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(route.description)}</p>`;

  for (const section of guide?.sections || []) {
    content += `<section><h2>${escapeHtml(section.heading)}</h2>`;
    for (const paragraph of section.paragraphs || []) {
      content += `<p>${escapeHtml(paragraph)}</p>`;
    }
    if (section.items?.length) {
      content += '<ul>';
      for (const item of section.items) {
        content += `<li><a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a></li>`;
      }
      content += '</ul>';
    }
    content += '</section>';
  }

  if (route.canonicalPath === '/blog') {
    content += '<section><h2>Latest study and handwriting guides</h2><ul>';
    for (const post of blogPosts) {
      content += `<li><a href="/blog/${escapeHtml(post.slug)}">${escapeHtml(post.title)}</a> — ${escapeHtml(post.excerpt)}</li>`;
    }
    content += '</ul></section>';
  }

  content += '<p><a href="/editor/new">Try the NikNote handwriting editor</a></p>';
  content += '</article>';
  return content;
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
    const content = renderPageArticle(route, blogPosts) + linkList(routes, route.canonicalPath);

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: route.title,
      description: route.description,
      url: canonical,
      isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: CANONICAL_ORIGIN },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: CANONICAL_ORIGIN },
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
      `<p><a href="/editor/new">Try it in the NikNote editor</a></p>` +
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
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: CANONICAL_ORIGIN,
        logo: { '@type': 'ImageObject', url: `${CANONICAL_ORIGIN}/niknote-logo.png` },
      },
      keywords: post.tags.join(', '),
      inLanguage: 'en-IN',
    };

    let html = applyHead(baseHtml, {
      title: `${post.title} | NikNote Blog`,
      description,
      canonical,
      robots: 'index, follow, max-image-preview:large, max-snippet:-1',
      ogType: 'article',
      ...(post.date ? { articlePublishedTime: post.date } : {}),
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
    const content = renderPageArticle(home, blogPosts) + linkList(routes, '/');
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
