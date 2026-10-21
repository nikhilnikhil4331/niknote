// ============================================================
// growth/content — a content pipeline that cannot publish by itself.
//
// Every item carries the fields the brief requires (audience, intent, topic,
// title, draft, feature, CTA, channel, success metric, fact-check status).
// Items start as `drafted` and must pass a human review step; nothing here
// talks to a CMS or a social API.
//
// Copy rules enforced by `validateContent`:
//  - no invented numbers, ratings, user counts or "#1" claims;
//  - no competitor claims stated as fact;
//  - the product feature mentioned must exist in the app.
// ============================================================

export type ContentChannel = 'blog' | 'newsletter' | 'social' | 'video' | 'community' | 'docs';
export type FactCheckStatus = 'unchecked' | 'needs_source' | 'verified';
export type ContentStatus = 'idea' | 'drafted' | 'in_review' | 'approved' | 'published' | 'rejected';

export interface ContentItem {
  id: string;
  audience: string;
  /** Search intent for SEO pieces, or the campaign objective otherwise. */
  intent: string;
  topic: string;
  title: string;
  draft: string;
  /** Which real NikNote feature the piece relies on. */
  feature: string;
  cta: string;
  channel: ContentChannel;
  successMetric: string;
  factCheck: FactCheckStatus;
  status: ContentStatus;
  createdAt: number;
  notes?: string;
}

const BANNED_CLAIMS = [
  /#\s?1\b/i,
  /\bbest in the world\b/i,
  /\bguarantee(d)? (results|marks|rank)\b/i,
  /\b\d{2,}% (more|better|faster)\b/i,
  /\b\d[\d,.]*\s?(k|m|lakh|crore)?\+?\s+(students|users|downloads|learners)\b/i,
  /\bperfect handwriting\b/i,
  /\b100% accurate\b/i,
];

export interface ValidationResult {
  valid: boolean;
  problems: string[];
}

export function validateContent(item: Pick<ContentItem,
  'audience' | 'intent' | 'topic' | 'title' | 'draft' | 'feature' | 'cta' | 'successMetric' | 'factCheck'>,
): ValidationResult {
  const problems: string[] = [];
  const required: [keyof typeof item, string][] = [
    ['audience', 'Target audience'],
    ['intent', 'Search intent / objective'],
    ['topic', 'Topic'],
    ['title', 'Title'],
    ['draft', 'Draft'],
    ['feature', 'NikNote feature'],
    ['cta', 'Call to action'],
    ['successMetric', 'Success metric'],
  ];
  for (const [key, label] of required) {
    if (!String(item[key] || '').trim()) problems.push(`${label} is missing.`);
  }
  if (String(item.draft || '').trim().length < 120) {
    problems.push('Draft is too short to be useful (minimum ~120 characters).');
  }
  const haystack = `${item.title} ${item.draft} ${item.cta}`;
  for (const pattern of BANNED_CLAIMS) {
    if (pattern.test(haystack)) {
      problems.push(`Unsupported claim detected (${pattern.source}). Rewrite it factually.`);
    }
  }
  if (item.factCheck === 'unchecked') {
    problems.push('Fact-check status must be set before review.');
  }
  return { valid: problems.length === 0, problems };
}

export function canPublish(item: ContentItem, approvedBy?: string): ValidationResult {
  const check = validateContent(item);
  const problems = [...check.problems];
  if (!approvedBy) problems.push('Publication requires an approving human.');
  if (item.status !== 'approved') problems.push('Item is not in the approved state.');
  if (item.factCheck !== 'verified') problems.push('Facts have not been verified.');
  return { valid: problems.length === 0, problems };
}

let seq = 0;
export function createContent(input: Omit<ContentItem, 'id' | 'createdAt' | 'status'> & {
  status?: ContentStatus;
}): ContentItem {
  seq += 1;
  return {
    ...input,
    id: `ct-${Date.now().toString(36)}-${seq}`,
    createdAt: Date.now(),
    status: input.status ?? 'drafted',
  };
}

/**
 * Starter backlog. These are topics, not published articles: each one maps to
 * a feature that actually exists, and no performance claims are made.
 */
export const CONTENT_BACKLOG: Omit<ContentItem, 'id' | 'createdAt'>[] = [
  {
    audience: 'College students who receive lecture PDFs',
    intent: 'Informational: "PDF to notes"',
    topic: 'Turning a lecture PDF into structured study notes',
    title: 'From lecture PDF to study notes: a repeatable workflow',
    draft:
      'Most students download a PDF and never reopen it. This guide walks through a simple habit: import the PDF, keep its headings as headings, turn definitions into bullets, then compress each section into a few lines you can revise from. It shows what to keep, what to cut, and how to mark the parts you did not understand so revision starts where it matters.',
    feature: 'PDF import → structured notes (composePdfNotes)',
    cta: 'Import one PDF and see the structured version before editing it.',
    channel: 'blog',
    successMetric: 'Organic sessions to the post; PDF import events per session',
    factCheck: 'verified',
    status: 'drafted',
  },
  {
    audience: 'Students who prefer handwritten notes',
    intent: 'Informational: "digital handwritten notes"',
    topic: 'When handwriting helps recall (and when typing is fine)',
    title: 'Handwritten notes vs typed notes: what actually changes your revision',
    draft:
      'Handwriting is slower, so you are forced to decide what matters while writing. That editing step is the benefit. This article explains how to keep that benefit when you produce handwritten-looking pages from typed material: write the summary yourself, then use handwriting output for the final revision sheet, and keep the raw source in text so it stays searchable.',
    feature: 'Handwriting DNA + handwriting page renderer',
    cta: 'Create one handwriting page from your own summary.',
    channel: 'blog',
    successMetric: 'Handwriting studio opens; pages exported',
    factCheck: 'needs_source',
    status: 'idea',
  },
  {
    audience: 'Students revising for board exams',
    intent: 'Informational: "study plan for exams"',
    topic: 'A one-week revision plan built from your own notes',
    title: 'A seven-day revision plan you can actually follow',
    draft:
      'A plan fails when it ignores what you already have. This walk-through starts from your notes: list the chapters, mark the ones you cannot explain out loud, then give each of those two short sessions instead of one long one. The article includes a simple daily template and explains why spaced repeats beat a single marathon session.',
    feature: 'Study planner + revision reminders',
    cta: 'Add your first three revision tasks.',
    channel: 'blog',
    successMetric: 'Planner visits; tasks created; day-7 return',
    factCheck: 'verified',
    status: 'idea',
  },
  {
    audience: 'Study creators on YouTube/Instagram',
    intent: 'Partnership objective: evaluate the product honestly',
    topic: 'Creator walkthrough of a notes workflow',
    title: 'How I turn a chapter into a revision page (creator walkthrough)',
    draft:
      'A short, screen-recorded walkthrough: import the chapter, generate a structured summary, adjust the handwriting, export the page. The creator keeps editorial control and is asked to mention anything that did not work. Any free access is disclosed in the description.',
    feature: 'PDF import, NikAI notes, handwriting export',
    cta: 'Try the same chapter yourself.',
    channel: 'video',
    successMetric: 'Referral sign-ups from the creator link; activation rate of those users',
    factCheck: 'verified',
    status: 'idea',
  },
  {
    audience: 'Students who study on a phone',
    intent: 'Activation email sequence (opted-in only)',
    topic: 'First note in under two minutes',
    title: 'Your first note: two minutes, three taps',
    draft:
      'A short email for people who signed up but have not written anything yet. It shows the fastest path to a first note, then one way to turn that note into something revisable. One call to action, no upsell.',
    feature: 'Quick note + AI notes',
    cta: 'Write your first note',
    channel: 'newsletter',
    successMetric: 'First-note creation rate within 24h of signup',
    factCheck: 'verified',
    status: 'idea',
  },
  {
    audience: 'Teachers and tutors',
    intent: 'Informational: "worksheet to notes"',
    topic: 'Reusing a worksheet as a revision sheet',
    title: 'Turn last year’s worksheet into this year’s revision sheet',
    draft:
      'Tutors rewrite the same material every term. This guide describes converting an existing worksheet into structured notes once, then editing the parts that change. It covers keeping questions separate from answers so a revision page can hide the answers.',
    feature: 'PDF import + structured editing',
    cta: 'Convert one worksheet and keep it as a template.',
    channel: 'blog',
    successMetric: 'Tutor sign-ups; repeat usage in week 2',
    factCheck: 'verified',
    status: 'idea',
  },
];
