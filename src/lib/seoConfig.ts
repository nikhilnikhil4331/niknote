// ============================================================
// NikNote — Centralized Technical SEO & Route Metadata Registry
// Single source of truth for titles, descriptions, canonicals,
// indexing directives, ViewContent classification, and sitemap.
// ============================================================

import { blogPosts, type BlogPost } from '@/content/blogPosts';

export const CANONICAL_ORIGIN = 'https://www.niknote.online';

export type PageCategory =
  | 'home'
  | 'landing'
  | 'feature'
  | 'pricing'
  | 'b2b'
  | 'blog_index'
  | 'blog_post'
  | 'docs'
  | 'legal'
  | 'auth'
  | 'checkout'
  | 'workspace'
  | 'admin'
  | 'utility'
  | 'not_found';

export interface RouteSeoEntry {
  path: string;
  title: string;
  description: string;
  canonicalPath: string;
  robots: 'index, follow' | 'noindex, follow' | 'noindex, nofollow';
  pageType: PageCategory;
  /** Include in public sitemap.xml */
  inSitemap: boolean;
  /** Fire Meta Pixel ViewContent when visited (with marketing consent) */
  trackViewContent?: boolean;
  /** Optional verified modification date (YYYY-MM-DD) — never fabricated */
  lastmod?: string;
}

export const PUBLIC_INDEXABLE_ROUTES: RouteSeoEntry[] = [
  {
    path: '/',
    title: 'NikNote — Create Realistic Handwritten Notes Online | AI Study & PDF Tools',
    description:
      'Create, customize, organize, and export realistic handwritten-style notes online with NikNote. Includes 16+ handwriting styles, Hindi & English AI study assistant, PDF editor, OCR scanner, quizzes, and flashcards.',
    canonicalPath: '/',
    robots: 'index, follow',
    pageType: 'home',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/welcome',
    title: 'How NikNote Works — Realistic Handwriting Editor, AI Tutor & PDF Export',
    description:
      'See how NikNote converts typed text into realistic handwritten pages on ruled, graph, or dotted paper, explains study topics in Hindi & English, and exports 300 DPI PDFs.',
    canonicalPath: '/welcome',
    robots: 'index, follow',
    pageType: 'landing',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/landing',
    title: 'NikNote Features — Handwriting Studio, AI Solver & Study Workspace',
    description:
      'Explore NikNote features for students: 16+ handwriting styles, custom Handwriting DNA, an AI doubt solver, flashcards, and print-ready PDF export.',
    canonicalPath: '/landing',
    robots: 'index, follow',
    pageType: 'landing',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/ai',
    title: 'NikAI Study Assistant — Hindi & English AI Tutor, Quizzes & Smart Notes',
    description:
      'Learn concepts in Hindi or English with NikAI. Generate structured study notes, practice interactive MCQs, and save notes directly to your NikNote notebook.',
    canonicalPath: '/ai',
    robots: 'index, follow',
    pageType: 'feature',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/ai-solver',
    title: 'AI Doubt & Homework Solver Online — Step-by-Step Study Help | NikNote',
    description:
      'Solve Physics, Chemistry, Mathematics, Biology, and exam questions step-by-step in Hindi and English with the NikNote AI Solver.',
    canonicalPath: '/ai-solver',
    robots: 'index, follow',
    pageType: 'feature',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/pdf-editor',
    title: 'Free Online PDF Editor — Edit Text, Annotate, Highlight & Export | NikNote',
    description:
      'Read, search, highlight, draw, edit existing PDF text lines in place, reorder or delete pages safely, and export sharp PDFs directly in your browser.',
    canonicalPath: '/pdf-editor',
    robots: 'index, follow',
    pageType: 'feature',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/pdf-tools',
    title: 'Free PDF Tools Online — Merge, Split, Compress, PDF to Word/Excel & OCR | NikNote',
    description:
      'Fast browser-based PDF tools: merge, split, compress, add watermarks or page numbers, convert PDFs to Word or Excel, run searchable OCR, and lock or unlock PDFs.',
    canonicalPath: '/pdf-tools',
    robots: 'index, follow',
    pageType: 'feature',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/scan-notes',
    title: 'Scan Handwritten Notes to Text (OCR) — English & Hindi | NikNote',
    description:
      'Turn photos or screenshots of handwritten and printed notes into editable digital notebook pages using on-device English/Hindi OCR or NikAI cursive recognition.',
    canonicalPath: '/scan-notes',
    robots: 'index, follow',
    pageType: 'feature',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/documents',
    title: 'Document Intelligence — Summarize Study PDFs & Extract Key Notes | NikNote',
    description:
      'Upload study PDFs and class handouts to extract structured summaries, key concepts, and revision notes with NikNote Document Intelligence.',
    canonicalPath: '/documents',
    robots: 'index, follow',
    pageType: 'feature',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/flashcards',
    title: 'Online Study Flashcards — Active Recall & Exam Revision | NikNote',
    description:
      'Create, organize, and practice revision flashcards for school boards, JEE, NEET, UPSC, and college exams with NikNote Flashcards.',
    canonicalPath: '/flashcards',
    robots: 'index, follow',
    pageType: 'feature',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/habit',
    title: 'NikNote Habit & Focus Timer — Study Routine, Pomodoro & Streak Tracker',
    description:
      'Stay consistent with an offline-capable Pomodoro focus timer, daily study habit tracker, streak analytics, hydration, and sleep logs.',
    canonicalPath: '/habit',
    robots: 'index, follow',
    pageType: 'feature',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/schools',
    title: 'NikNote for Teachers & Tuition Centres — Handwritten Worksheet Maker',
    description:
      'Turn typed questions into realistic handwritten worksheets, assignments and answer keys in minutes. Teacher plans from ₹999/year. Free 30-day pilot for one department.',
    canonicalPath: '/schools',
    robots: 'index, follow',
    pageType: 'b2b',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/upgrade',
    title: 'NikNote Pricing & Plans — Free Tier, Student Pro (₹49/wk) & Premium (₹99/mo)',
    description:
      'Compare NikNote Free, Student Pro (₹49/week) and Premium (₹99/month). Premium adds the AI writing assistant, voice dictation, handwriting import and AI style matching. UPI, cards and wallets.',
    canonicalPath: '/upgrade',
    robots: 'index, follow',
    pageType: 'pricing',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/handbook',
    title: 'NikNote Handbook — Product Philosophy, Study Workflows & Guide',
    description:
      'Read the official NikNote handbook covering product principles, handwriting note workflows, offline support, and student study tools.',
    canonicalPath: '/handbook',
    robots: 'index, follow',
    pageType: 'docs',
    inSitemap: true,
  },
  {
    path: '/blog',
    title: 'NikNote Blog — Handwritten Notes Tutorials, AI Study Tips & Exam Guides',
    description:
      'Step-by-step guides on converting text to handwriting, making CBSE, JEE, NEET & UPSC notes, using flashcards, and studying effectively in Hindi and English.',
    canonicalPath: '/blog',
    robots: 'index, follow',
    pageType: 'blog_index',
    inSitemap: true,
    trackViewContent: true,
  },
  {
    path: '/privacy',
    title: 'Privacy Policy — NikNote',
    description:
      'Read how NikNote processes account data, notes, AI prompts, payments, analytics, advertising cookies, and your privacy choices.',
    canonicalPath: '/privacy',
    robots: 'index, follow',
    pageType: 'legal',
    inSitemap: true,
  },
  {
    path: '/terms',
    title: 'Terms & Conditions — NikNote',
    description:
      'Terms governing your use of NikNote handwriting notes, AI study features, uploaded content ownership, and paid plans.',
    canonicalPath: '/terms',
    robots: 'index, follow',
    pageType: 'legal',
    inSitemap: true,
  },
  {
    path: '/refunds',
    title: 'Refund Policy — NikNote',
    description:
      'Details on NikNote subscription billing, duplicate charge review, and how to contact support@niknote.online regarding payment issues.',
    canonicalPath: '/refunds',
    robots: 'index, follow',
    pageType: 'legal',
    inSitemap: true,
  },
];

const NON_INDEXABLE_ROUTES: Record<string, Omit<RouteSeoEntry, 'path' | 'inSitemap'>> = {
  // Duplicate aliases — point canonical to primary route and prevent duplicate indexing
  '/home': {
    title: 'NikNote — Handwritten Notes Workspace',
    description: 'Open your NikNote handwriting editor and study workspace.',
    canonicalPath: '/',
    robots: 'noindex, follow',
    pageType: 'home',
  },
  '/studio': {
    title: 'NikNote Studio — Handwriting Editor',
    description: 'Write and customize realistic handwritten notes in NikNote Studio.',
    canonicalPath: '/',
    robots: 'noindex, follow',
    pageType: 'workspace',
  },
  '/nikai': {
    title: 'NikAI Study Assistant — NikNote',
    description: 'NikAI study workspace for explanations, notes, and quizzes.',
    canonicalPath: '/ai',
    robots: 'noindex, follow',
    pageType: 'feature',
  },
  '/ai-workspace': {
    title: 'NikAI Workspace — NikNote',
    description: 'NikAI study workspace for explanations, notes, and quizzes.',
    canonicalPath: '/ai',
    robots: 'noindex, follow',
    pageType: 'feature',
  },
  '/agents': {
    title: 'AI Study Agents — NikNote',
    description: 'NikAI study agents for explanations, notes, and quizzes.',
    canonicalPath: '/ai',
    robots: 'noindex, follow',
    pageType: 'feature',
  },
  '/ai-classic': {
    title: 'Classic AI Assistant — NikNote',
    description: 'NikNote classic AI study assistant.',
    canonicalPath: '/ai',
    robots: 'noindex, follow',
    pageType: 'feature',
  },
  '/pdf': {
    title: 'PDF Editor — NikNote',
    description: 'Edit, annotate, and export PDFs in NikNote.',
    canonicalPath: '/pdf-editor',
    robots: 'noindex, follow',
    pageType: 'feature',
  },
  '/institutions': {
    title: 'NikNote for Institutions — Schools & Coaching Plans',
    description: 'Institutional plans for schools, colleges, and coaching centers.',
    canonicalPath: '/schools',
    robots: 'noindex, follow',
    pageType: 'b2b',
  },

  // Auth, Checkout, User-Private & Internal Admin/Utility routes — strictly noindex, nofollow
  '/login': {
    title: 'Sign In — NikNote',
    description: 'Sign in to access your synced NikNote notebooks and study tools.',
    canonicalPath: '/login',
    robots: 'noindex, nofollow',
    pageType: 'auth',
  },
  '/signup': {
    title: 'Create Account — NikNote',
    description: 'Create a NikNote account to sync notes across devices.',
    canonicalPath: '/signup',
    robots: 'noindex, nofollow',
    pageType: 'auth',
  },
  '/auth': {
    title: 'Account Access — NikNote',
    description: 'Sign in or continue to your NikNote workspace.',
    canonicalPath: '/auth',
    robots: 'noindex, nofollow',
    pageType: 'auth',
  },
  '/reset-password': {
    title: 'Reset Password — NikNote',
    description: 'Reset your NikNote account password.',
    canonicalPath: '/reset-password',
    robots: 'noindex, nofollow',
    pageType: 'auth',
  },
  '/payment': {
    title: 'Checkout — NikNote Premium',
    description: 'Complete your NikNote Student Pro or Premium subscription securely via Razorpay.',
    canonicalPath: '/upgrade',
    robots: 'noindex, nofollow',
    pageType: 'checkout',
  },
  '/donate': {
    title: 'Support NikNote',
    description: 'Support independent student tool development at NikNote.',
    canonicalPath: '/donate',
    robots: 'noindex, nofollow',
    pageType: 'checkout',
  },
  '/onboarding': {
    title: 'Welcome Setup — NikNote',
    description: 'Customize your NikNote study preferences.',
    canonicalPath: '/onboarding',
    robots: 'noindex, nofollow',
    pageType: 'utility',
  },
  '/account': {
    title: 'Account Settings — NikNote',
    description: 'Manage your NikNote profile, plan, and preferences.',
    canonicalPath: '/account',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/account-details': {
    title: 'Account Details — NikNote',
    description: 'Manage your NikNote account details.',
    canonicalPath: '/account',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/notebooks': {
    title: 'My Notebooks — NikNote',
    description: 'Your personal notebooks in NikNote.',
    canonicalPath: '/notebooks',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/notes': {
    title: 'My Notes — NikNote',
    description: 'Your saved notes in NikNote.',
    canonicalPath: '/notebooks',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/tasks': {
    title: 'Tasks — NikNote',
    description: 'Your task board in NikNote.',
    canonicalPath: '/tasks',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/calendar': {
    title: 'Calendar — NikNote',
    description: 'Your notes, tasks and focus sessions on one calendar.',
    canonicalPath: '/calendar',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/focus': {
    title: 'Focus Timer — NikNote',
    description: 'Pomodoro, countdown timer and stopwatch with real focus analytics.',
    canonicalPath: '/focus',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/shared': {
    title: 'Shared with Me — NikNote',
    description: 'Notes shared with you in NikNote.',
    canonicalPath: '/shared',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/trash': {
    title: 'Trash — NikNote',
    description: 'Deleted notes you can restore or remove permanently.',
    canonicalPath: '/trash',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/history': {
    title: 'Activity History — NikNote',
    description: 'Your recent study activity in NikNote.',
    canonicalPath: '/history',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/achievements': {
    title: 'Study Achievements — NikNote',
    description: 'Your study milestones and badges in NikNote.',
    canonicalPath: '/achievements',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/hub': {
    title: 'Tools Hub — NikNote',
    description: 'Quick access to NikNote tools and workspaces.',
    canonicalPath: '/hub',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/board': {
    title: 'Study Board — NikNote',
    description: 'Kanban-style study boards for planning tasks, deadlines and revision.',
    canonicalPath: '/board',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/money': {
    title: 'Student Budget Tracker — NikNote',
    description: 'Personal expense and budget tracker inside NikNote.',
    canonicalPath: '/money',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/routine': {
    title: 'Daily Routine Tracker — NikNote',
    description: 'Personal daily routine tracker in NikNote.',
    canonicalPath: '/habit',
    robots: 'noindex, nofollow',
    pageType: 'workspace',
  },
  '/appearance': {
    title: 'Appearance Settings — NikNote',
    description: 'Customize NikNote theme and motion settings.',
    canonicalPath: '/appearance',
    robots: 'noindex, nofollow',
    pageType: 'utility',
  },
  '/templates': {
    title: 'Note Templates — NikNote',
    description: 'Choose a note template in NikNote.',
    canonicalPath: '/templates',
    robots: 'noindex, nofollow',
    pageType: 'utility',
  },
  '/feedback': {
    title: 'Send Feedback — NikNote',
    description: 'Report bugs or request features for NikNote.',
    canonicalPath: '/feedback',
    robots: 'noindex, nofollow',
    pageType: 'utility',
  },
  '/checkup': {
    title: 'System Health Check-up — NikNote',
    description: 'Diagnostics for AI, PDF, OCR, and local storage.',
    canonicalPath: '/checkup',
    robots: 'noindex, nofollow',
    pageType: 'utility',
  },
  '/qa': {
    title: 'QA Console — NikNote',
    description: 'Internal quality assurance diagnostics.',
    canonicalPath: '/qa',
    robots: 'noindex, nofollow',
    pageType: 'utility',
  },
  '/audit': {
    title: 'Audit Reports — NikNote',
    description: 'Internal platform audit reports.',
    canonicalPath: '/audit',
    robots: 'noindex, nofollow',
    pageType: 'utility',
  },
  '/admin': {
    title: 'Admin — NikNote',
    description: 'Internal administration.',
    canonicalPath: '/admin',
    robots: 'noindex, nofollow',
    pageType: 'admin',
  },
  '/admin-login': {
    title: 'Admin Sign In — NikNote',
    description: 'Internal administration sign-in.',
    canonicalPath: '/admin-login',
    robots: 'noindex, nofollow',
    pageType: 'admin',
  },
  '/admin-panel-nikhil': {
    title: 'Admin Console — NikNote',
    description: 'Internal administration console.',
    canonicalPath: '/admin-panel-nikhil',
    robots: 'noindex, nofollow',
    pageType: 'admin',
  },
};

const publicRouteMap = new Map<string, RouteSeoEntry>(
  PUBLIC_INDEXABLE_ROUTES.map((r) => [r.path, r]),
);

const blogMap = new Map<string, BlogPost>(blogPosts.map((p) => [p.slug, p]));

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function getCanonicalUrl(canonicalPath: string): string {
  const clean = normalizePathname(canonicalPath);
  return clean === '/' ? `${CANONICAL_ORIGIN}/` : `${CANONICAL_ORIGIN}${clean}`;
}

export function resolveRouteSeo(pathname: string): RouteSeoEntry & { blogPost?: BlogPost } {
  const clean = normalizePathname(pathname);

  const pub = publicRouteMap.get(clean);
  if (pub) return pub;

  if (clean.startsWith('/blog/')) {
    const slug = clean.slice('/blog/'.length);
    const post = blogMap.get(slug);
    if (post) {
      return {
        path: clean,
        title: `${post.title} | NikNote Blog`,
        description: post.excerpt,
        canonicalPath: `/blog/${post.slug}`,
        robots: 'index, follow',
        pageType: 'blog_post',
        inSitemap: true,
        trackViewContent: true,
        lastmod: post.date,
        blogPost: post,
      };
    }
    return {
      path: clean,
      title: 'Article Not Found — NikNote Blog',
      description: 'The requested article could not be found. Browse all study guides on the NikNote Blog.',
      canonicalPath: '/blog',
      robots: 'noindex, follow',
      pageType: 'not_found',
      inSitemap: false,
    };
  }

  const nonIdx = NON_INDEXABLE_ROUTES[clean];
  if (nonIdx) {
    return {
      path: clean,
      inSitemap: false,
      ...nonIdx,
    };
  }

  return {
    path: clean,
    title: 'Page Not Found — NikNote',
    description: 'The requested page is not available. Return to NikNote.',
    canonicalPath: clean,
    robots: 'noindex, nofollow',
    pageType: 'not_found',
    inSitemap: false,
  };
}

export function getAllSitemapEntries(): { loc: string; lastmod?: string }[] {
  const entries: { loc: string; lastmod?: string }[] = PUBLIC_INDEXABLE_ROUTES.filter(
    (r) => r.inSitemap && r.robots === 'index, follow',
  ).map((r) => ({
    loc: getCanonicalUrl(r.canonicalPath),
    ...(r.lastmod ? { lastmod: r.lastmod } : {}),
  }));

  for (const post of blogPosts) {
    entries.push({
      loc: getCanonicalUrl(`/blog/${post.slug}`),
      ...(post.date ? { lastmod: post.date } : {}),
    });
  }

  return entries;
}
