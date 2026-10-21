// ============================================================
// growth/prospects — Harvey-inspired partnership research, minus the spam.
//
// Harvey's prospecting loop is: discover → research → qualify → draft →
// approve → send → classify replies → learn. The valuable part is the
// *qualification with visible evidence* and the fact that nothing leaves the
// building without a human. The dangerous part is automated mass outreach.
//
// So this module models the pipeline, not the sending:
//   - every prospect carries the evidence behind the match;
//   - scoring is deterministic and explainable (no hidden model score);
//   - `canContact()` is a hard gate (qualified + evidence + channel + not
//     opted out), and even then only an approved draft may be sent by a human.
//
// Only public business information belongs in these records. There is no
// field for personal email, phone number or social profile scraping.
// ============================================================

export type ProspectKind =
  | 'creator'
  | 'community'
  | 'tutor'
  | 'institution'
  | 'newsletter'
  | 'blog'
  | 'integration';

export type ProspectStage =
  | 'discovered'
  | 'researched'
  | 'qualified'
  | 'drafted'
  | 'approved'
  | 'contacted'
  | 'replied'
  | 'won'
  | 'declined'
  | 'opted_out';

export interface Prospect {
  id: string;
  /** Organisation or creator name. */
  name: string;
  /** Public website (https, no tracking params). */
  website: string;
  /** Publicly listed business channel, e.g. "partnerships form on /contact". */
  publicContact?: string;
  kind: ProspectKind;
  /** Why this prospect is relevant, in one or two sentences. */
  relevance: string;
  /** Concrete collaboration idea. */
  collaborationIdea: string;
  /** What we actually observed (page, post, programme). No speculation. */
  evidence: string[];
  researchDate: string;
  stage: ProspectStage;
  /** Optional audience hint taken from public pages, never estimated traffic. */
  audienceNote?: string;
  owner?: string;
  notes?: string;
}

export interface ProspectScore {
  total: number;
  relevance: number;
  audienceFit: number;
  evidenceQuality: number;
  collaborationValue: number;
  reasons: string[];
  blockers: string[];
}

const KIND_AUDIENCE_FIT: Record<ProspectKind, number> = {
  community: 18,
  creator: 16,
  tutor: 15,
  institution: 14,
  newsletter: 12,
  blog: 10,
  integration: 8,
};

function normaliseDomain(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '')
    .trim();
}

export function prospectDomain(prospect: Pick<Prospect, 'website'>): string {
  return normaliseDomain(prospect.website);
}

/**
 * Transparent 0–100 score. Each component is capped and explained, so two
 * people (or an agent and a human) can disagree with a specific number
 * instead of an opaque ranking.
 */
export function scoreProspect(prospect: Prospect): ProspectScore {
  const reasons: string[] = [];
  const blockers: string[] = [];

  // Relevance: is the relevance note specific (a real sentence) or vague?
  const relevanceWords = prospect.relevance.trim().split(/\s+/).filter(Boolean).length;
  const relevance = Math.min(25, relevanceWords * 1.5);
  if (relevanceWords >= 8) reasons.push('Relevance is described specifically.');
  else blockers.push('Relevance note is too short to justify outreach.');

  // Evidence quality: public, checkable observations.
  const evidence = prospect.evidence.filter(item => item.trim().length >= 12);
  const evidenceQuality = Math.min(25, evidence.length * 9);
  if (evidence.length) reasons.push(`${evidence.length} public observation(s) recorded.`);
  else blockers.push('No verifiable public evidence recorded.');

  const audienceFit = KIND_AUDIENCE_FIT[prospect.kind] ?? 8;
  reasons.push(`Audience type: ${prospect.kind}.`);

  const hasIdea = prospect.collaborationIdea.trim().length >= 20;
  let collaborationValue = hasIdea ? 20 : 6;
  if (hasIdea) reasons.push('A concrete collaboration offer is written down.');
  else blockers.push('Collaboration idea is missing or too vague.');

  if (!prospect.publicContact) {
    collaborationValue -= 4;
    blockers.push('No public business channel recorded yet.');
  }

  if (prospect.stage === 'opted_out') {
    blockers.push('Prospect opted out — never contact again.');
  }

  const total = Math.max(
    0,
    Math.min(
      100,
      Math.round(relevance + evidenceQuality + audienceFit + collaborationValue),
    ),
  );

  return {
    total: prospect.stage === 'opted_out' ? 0 : total,
    relevance: Math.round(relevance),
    audienceFit,
    evidenceQuality,
    collaborationValue: Math.round(collaborationValue),
    reasons,
    blockers,
  };
}

/** Hard gate before any message may be drafted for sending. */
export function canContact(prospect: Prospect): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (prospect.stage === 'opted_out') reasons.push('Prospect opted out.');
  if (prospect.stage === 'declined') reasons.push('Prospect already declined.');
  if (!['qualified', 'drafted', 'approved'].includes(prospect.stage)) {
    reasons.push('Prospect must be researched and qualified first.');
  }
  if (!prospect.evidence.some(item => item.trim().length >= 12)) {
    reasons.push('At least one verifiable public observation is required.');
  }
  if (!prospect.publicContact) reasons.push('No public business contact channel recorded.');
  return { allowed: reasons.length === 0, reasons };
}

/** Same website twice is the same organisation — keep one record. */
export function dedupeProspects(prospects: Prospect[]): Prospect[] {
  const seen = new Map<string, Prospect>();
  for (const prospect of prospects) {
    const key = prospectDomain(prospect);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, prospect);
      continue;
    }
    // Keep the further-along record, but merge evidence.
    const order: ProspectStage[] = [
      'discovered', 'researched', 'qualified', 'drafted', 'approved', 'contacted',
      'replied', 'won', 'declined', 'opted_out',
    ];
    const winner = order.indexOf(prospect.stage) > order.indexOf(existing.stage) ? prospect : existing;
    const loser = winner === prospect ? existing : prospect;
    seen.set(key, {
      ...winner,
      evidence: Array.from(new Set([...winner.evidence, ...loser.evidence])),
    });
  }
  return [...seen.values()];
}

/** Starter list of segments worth researching. No contact details invented. */
export const TARGET_SEGMENTS = [
  {
    kind: 'community' as ProspectKind,
    label: 'College study / exam-prep communities',
    why: 'They already share notes and timetables; a notes + PDF workflow fits their existing behaviour.',
  },
  {
    kind: 'creator' as ProspectKind,
    label: 'Study and handwriting creators',
    why: 'Their audience asks for notes and handwriting tips; a demo is genuinely useful content.',
  },
  {
    kind: 'tutor' as ProspectKind,
    label: 'Independent tutors and small coaching centres',
    why: 'They produce worksheets weekly and need fast PDF-to-notes conversion.',
  },
  {
    kind: 'institution' as ProspectKind,
    label: 'Schools and colleges with public partnership pages',
    why: 'Institutional access is a real product fit, but only through their published channels.',
  },
  {
    kind: 'integration' as ProspectKind,
    label: 'Study tools with public APIs',
    why: 'Calendar or flashcard interoperability; verify terms before promising anything.',
  },
];
