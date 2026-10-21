// ============================================================
// seo — one place that decides what a crawler is allowed to see.
//
// Why: NikNote is a client-routed SPA, so every URL serves the same
// index.html. Before this file, /account, /notebooks and even /admin served
// indexable metadata ("India ka #1 AI Study App") — a privacy and duplicate
// content problem. robots.txt is not a security boundary, and it does not stop
// a crawler that lands on a deep link.
//
// Rules implemented here:
//  - an explicit allowlist of PUBLIC marketing routes (indexable);
//  - everything else is noindex,nofollow, including /app and any unknown path;
//  - canonical URLs are always the https://www.niknote.online origin;
//  - copy makes no unverifiable claims ("#1", user counts, accuracy figures).
// ============================================================

export const SITE_ORIGIN = 'https://www.niknote.online';
export const SITE_NAME = 'NikNote';

export interface RouteSeo {
  title: string;
  description: string;
  /** Public marketing route → indexable. Everything else is noindex. */
  indexable: boolean;
  /** Absolute canonical path (no origin). */
  canonicalPath: string;
  ogImage?: string;
  /** JSON-LD blocks for this route. */
  jsonLd?: Record<string, unknown>[];
}

const OG_IMAGE = `${SITE_ORIGIN}/og-image.jpg`;

const HOME: RouteSeo = {
  title: 'NikNote — AI study notes, handwriting notes and PDF-to-notes',
  description:
    'NikNote turns your study material into organised notes: AI notes from any topic, text-to-handwriting pages, PDF import, flashcards and study tracking. Free to start. Works in the browser.',
  indexable: true,
  canonicalPath: '/',
  ogImage: OG_IMAGE,
};

/** Public, content-bearing pages. Only these may be indexed. */
const PUBLIC_ROUTES: Record<string, RouteSeo> = {
  '/': HOME,
  '/welcome': {
    title: 'Welcome to NikNote — how it works',
    description:
      'What NikNote does: AI notes, handwriting pages, PDF-to-notes, flashcards, a drawing board and study trackers. See how each part works before you sign up.',
    indexable: true,
    canonicalPath: '/welcome',
    ogImage: OG_IMAGE,
  },
  '/landing': {
    title: 'NikNote — write, organise and revise your study notes',
    description:
      'An AI study workspace for students: write notes, convert PDFs into structured notes, print them in handwriting, and revise with flashcards. Free plan available.',
    indexable: true,
    canonicalPath: '/landing',
    ogImage: OG_IMAGE,
  },
  '/blog': {
    title: 'NikNote Blog — study workflows, note-taking and exam prep guides',
    description:
      'Practical guides on study notes, handwriting practice, PDF workflows and exam preparation — written for students and teachers.',
    indexable: true,
    canonicalPath: '/blog',
    ogImage: OG_IMAGE,
  },
  '/schools': {
    title: 'NikNote for schools and coaching institutes',
    description:
      'Give your students an AI study workspace: notes, handwriting output, PDF import and revision tools. Talk to us about institutional access.',
    indexable: true,
    canonicalPath: '/schools',
    ogImage: OG_IMAGE,
  },
  '/institutions': {
    title: 'NikNote for educational institutions',
    description:
      'Institutional access to NikNote for colleges, schools and coaching centres — notes, handwriting pages, PDF-to-notes and revision workflows.',
    indexable: true,
    canonicalPath: '/institutions',
    ogImage: OG_IMAGE,
  },
  '/privacy': {
    title: 'NikNote privacy policy',
    description:
      'What NikNote stores, what stays on your device, what analytics we collect (only with consent) and how to delete your data.',
    indexable: true,
    canonicalPath: '/privacy',
  },
  '/terms': {
    title: 'NikNote terms of service',
    description: 'The terms that apply when you use NikNote.',
    indexable: true,
    canonicalPath: '/terms',
  },
  '/refunds': {
    title: 'NikNote refund policy',
    description: 'How refunds work for NikNote premium plans.',
    indexable: true,
    canonicalPath: '/refunds',
  },
  '/handbook': {
    title: 'NikNote handbook — how to use every feature',
    description:
      'A plain-English handbook for NikNote: notes, AI, handwriting, PDFs, flashcards, trackers and settings.',
    indexable: true,
    canonicalPath: '/handbook',
    ogImage: OG_IMAGE,
  },
};

const PRIVATE_TITLE = 'NikNote';
const PRIVATE_DESCRIPTION =
  'Private NikNote workspace. Sign in to open your notes — this page is not indexed.';

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_ROUTES[pathname]) return true;
  // Blog articles are public content, but only the canonical slug pattern.
  return /^\/blog\/[a-z0-9][a-z0-9-]{2,80}$/.test(pathname);
}

/**
 * Resolve metadata for any pathname. Unknown and app routes deliberately get
 * `indexable: false` — a deep link into the editor must never be listed.
 */
export function resolveSeo(pathname: string): RouteSeo {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/';

  const direct = PUBLIC_ROUTES[clean];
  if (direct) return direct;

  const blogMatch = /^\/blog\/([a-z0-9][a-z0-9-]{2,80})$/.exec(clean);
  if (blogMatch) {
    const slug = blogMatch[1];
    const words = slug.replace(/-/g, ' ');
    return {
      title: `${words.charAt(0).toUpperCase()}${words.slice(1)} — NikNote Blog`,
      description: `A practical NikNote guide: ${words}. Written for students and teachers who want a repeatable study workflow.`,
      indexable: true,
      canonicalPath: `/blog/${slug}`,
      ogImage: OG_IMAGE,
    };
  }

  return {
    title: PRIVATE_TITLE,
    description: PRIVATE_DESCRIPTION,
    indexable: false,
    canonicalPath: clean,
  };
}

export function absoluteUrl(pathname: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${SITE_ORIGIN}${path === '/' ? '/' : path}`;
}

export function robotsDirective(indexable: boolean): string {
  return indexable
    ? 'index, follow, max-image-preview:large, max-snippet:-1'
    : 'noindex, nofollow, noarchive, nosnippet';
}

/** Software + organisation schema, only injected on public routes. */
export function siteJsonLd(): Record<string, unknown>[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web, Android, iOS',
      url: SITE_ORIGIN,
      description:
        'NikNote is an AI study workspace: AI notes, text-to-handwriting pages, PDF-to-notes, flashcards and study tracking.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
        description: 'Free plan available',
      },
      featureList: [
        'AI notes from a topic or PDF',
        'Text to handwriting pages',
        'PDF import into structured notes',
        'Flashcards and revision questions',
        'Drawing board and study trackers',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/niknote-logo-512.png`,
      sameAs: [],
    },
  ];
}

export function blogPostJsonLd(title: string, description: string, path: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description,
    mainEntityOfPage: absoluteUrl(path),
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/niknote-logo-512.png` },
    },
  };
}

/** Routes that must never be submitted to a search engine. */
export const NEVER_INDEX = [
  '/account',
  '/account-details',
  '/notebooks',
  '/notes',
  '/history',
  '/flashcards',
  '/upgrade',
  '/payment',
  '/donate',
  '/login',
  '/signup',
  '/auth',
  '/admin',
  '/admin-login',
  '/admin-panel-nikhil',
  '/hub',
  '/board',
  '/money',
  '/routine',
  '/habit',
  '/ai',
  '/nikai',
  '/agents',
  '/documents',
  '/studio',
  '/templates',
  '/appearance',
  '/onboarding',
  '/feedback',
  '/qa',
  '/audit',
  '/lecture',
  '/planner',
  '/admin/growth',
] as const;

export function publicPaths(): string[] {
  return Object.keys(PUBLIC_ROUTES).filter(path => path !== '/');
}
