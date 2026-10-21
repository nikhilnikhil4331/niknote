// ============================================================
// growth/outreach — honest draft generation.
//
// The draft must only contain things we actually observed. There is no
// "I loved your recent post" filler, because the agent has not read it; the
// evidence lines the researcher recorded are the only personalisation we allow.
// ============================================================

import type { Prospect } from './prospects';
import { canContact, scoreProspect } from './prospects';

export interface OutreachDraft {
  subject: string;
  body: string;
  /** Why this draft exists, shown to the reviewer. */
  rationale: string[];
  /** Anything the reviewer must confirm before sending. */
  openQuestions: string[];
}

const SENDER = 'Nikhil Jatav, NikNote';

export function draftOutreach(prospect: Prospect, sender = SENDER): OutreachDraft {
  const gate = canContact(prospect);
  if (!gate.allowed) {
    throw new Error(`Cannot draft outreach: ${gate.reasons.join(' ')}`);
  }
  const score = scoreProspect(prospect);

  const evidenceLines = prospect.evidence
    .filter(item => item.trim().length >= 12)
    .slice(0, 2)
    .map(item => `• ${item.trim()}`);

  const body = [
    `Hi ${prospect.name} team,`,
    '',
    `I'm ${sender.split(',')[0]} — I build NikNote, a study-notes app for students (notes, PDF-to-notes, handwriting pages, flashcards).`,
    '',
    `I'm reaching out because of what's publicly visible here:`,
    ...evidenceLines,
    '',
    `Idea: ${prospect.collaborationIdea.trim()}`,
    '',
    'If it is useful, I can share a free creator account so you can judge it yourself. If this is not relevant, tell me and I will not follow up.',
    '',
    '— ' + sender,
    'niknote.online',
  ].join('\n');

  const openQuestions: string[] = [];
  if (!prospect.publicContact) openQuestions.push('Which published channel should this be sent to?');
  if (prospect.kind === 'creator') openQuestions.push('Is any free access going to be disclosed in the video/post?');
  if (!prospect.audienceNote) openQuestions.push('Is the audience size needed to prioritise this?');

  return {
    subject: `NikNote × ${prospect.name} — notes workflow for your students`,
    body,
    rationale: [
      `Qualification score ${score.total}/100.`,
      ...score.reasons,
      'Only publicly recorded observations are quoted.',
    ],
    openQuestions,
  };
}

/** Blocks obvious bulk-mail mistakes before a human even sees the draft. */
export function lintOutreach(draft: OutreachDraft): string[] {
  const problems: string[] = [];
  if (draft.body.length < 200) problems.push('Message is too short to be specific.');
  if (/\[[^\]]+\]/.test(draft.body)) problems.push('Unfilled placeholder found.');
  if (/\b(guarantee|100%|#1|best in the world)\b/i.test(draft.body)) {
    problems.push('Unsupported marketing claim in the message.');
  }
  if (!/unsubscribe|not relevant|will not follow up/i.test(draft.body)) {
    problems.push('No opt-out sentence — required for cold outreach.');
  }
  const lines = draft.body.split('\n').filter(Boolean);
  if (lines.length < 8) problems.push('Message does not explain why it is relevant.');
  return problems;
}
