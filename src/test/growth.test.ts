import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTONOMOUS_PUBLISHING,
  AUTONOMOUS_SENDING,
  AUTONOMOUS_SPENDING,
  canExecute,
  createApproval,
  decide,
  hasDuplicate,
  isPaused,
  remainingBudget,
  submitForReview,
  totalSpent,
  type ApprovalItem,
} from '@/lib/growth/approvals';
import {
  buildFunnelReport,
  clearGrowthEvents,
  funnelToCsv,
  sanitizeProps,
  track,
  type GrowthEvent,
} from '@/lib/growth/funnel';
import {
  canContact,
  dedupeProspects,
  scoreProspect,
  TARGET_SEGMENTS,
  type Prospect,
} from '@/lib/growth/prospects';
import { draftOutreach, lintOutreach } from '@/lib/growth/outreach';
import { CONTENT_BACKLOG, canPublish, validateContent } from '@/lib/growth/content';
import { EXPERIMENT_BACKLOG, evaluateExperiment } from '@/lib/growth/experiments';

const CONSENT_KEY = 'niknote_optional_analytics';

const prospect: Prospect = {
  id: 'p1',
  name: 'Example Study Community',
  website: 'https://www.example-study.example/partnerships',
  publicContact: 'partnerships form on /contact',
  kind: 'community',
  relevance: 'A public college study community that shares notes and revision timetables weekly.',
  collaborationIdea: 'Publish a joint PDF-to-notes walkthrough and offer members free evaluation access.',
  evidence: ['Public partnerships page lists a notes-sharing programme for first-year students.'],
  researchDate: '2026-10-21',
  stage: 'qualified',
};

beforeEach(() => {
  localStorage.clear();
});

describe('analytics consent and payload safety', () => {
  it('records nothing without consent', () => {
    expect(track('visitor_landing', { page: 'home' })).toBe(false);
    expect(localStorage.getItem('niknote.growth.events.v1')).toBeNull();
  });

  it('records an allowlisted event after consent', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    expect(track('visitor_landing', { page: 'home', source: 'direct' })).toBe(true);
    const stored = JSON.parse(localStorage.getItem('niknote.growth.events.v1') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('visitor_landing');
  });

  it('drops note content, emails and oversized strings', () => {
    const clean = sanitizeProps({
      page: '/landing',
      feature: 'pdf_import',
      noteText: 'my private chemistry notes',
      email: 'student@example.com',
      title: 'Chapter 4',
      prompt: 'explain osmosis',
      source: 'x'.repeat(120),
      count: 3,
      ok: true,
    });
    expect(clean).toEqual({ page: '/landing', feature: 'pdf_import', count: 3, ok: true });
  });
});

describe('funnel report', () => {
  const day = 86_400_000;
  const now = Date.now();
  const events: GrowthEvent[] = [
    { id: 'e1', name: 'visitor_landing', at: now - 10 * day, session: 'a' },
    { id: 'e2', name: 'signup_completed', at: now - 10 * day, session: 'a' },
    { id: 'e3', name: 'first_note_created', at: now - 9 * day, session: 'a' },
    { id: 'e4', name: 'visitor_landing', at: now - 8 * day, session: 'b' },
    { id: 'e5', name: 'signup_completed', at: now - 8 * day, session: 'b' },
  ];

  it('computes stages from unique sessions, not raw events', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    const report = buildFunnelReport(events);
    expect(report.stages[0].value).toBe(2); // visitors
    expect(report.stages[1].value).toBe(2); // sign-ups
    expect(report.stages[2].value).toBe(1); // first note
    expect(report.stages[2].conversion).toBe(50);
  });

  it('does not report retention rates from a tiny cohort', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    const report = buildFunnelReport(events);
    const d1 = report.retention.find(r => r.window === 'd1');
    expect(d1?.rate).toBeNull();
    expect(d1?.note).toMatch(/too few/i);
    expect(report.insufficientData).toBe(true);
  });

  it('is honest when there is no data at all', () => {
    clearGrowthEvents();
    const report = buildFunnelReport([]);
    expect(report.hasData).toBe(false);
    expect(report.stages.every(stage => stage.value === 0)).toBe(true);
    expect(funnelToCsv(report)).toContain('stage,value,conversion_percent');
  });
});

describe('prospect qualification', () => {
  it('scores explainably and exposes blockers', () => {
    const score = scoreProspect(prospect);
    expect(score.total).toBeGreaterThan(50);
    expect(score.reasons.length).toBeGreaterThan(2);

    const vague = scoreProspect({ ...prospect, relevance: 'Good fit', evidence: [] });
    expect(vague.blockers.join(' ')).toMatch(/evidence/i);
    expect(vague.total).toBeLessThan(score.total);
  });

  it('requires evidence, a channel and a qualified stage before contacting', () => {
    expect(canContact(prospect).allowed).toBe(true);
    expect(canContact({ ...prospect, evidence: [] }).allowed).toBe(false);
    expect(canContact({ ...prospect, publicContact: undefined }).allowed).toBe(false);
    expect(canContact({ ...prospect, stage: 'opted_out' }).allowed).toBe(false);
    expect(scoreProspect({ ...prospect, stage: 'opted_out' }).total).toBe(0);
  });

  it('treats the same website as one prospect', () => {
    const duplicate = { ...prospect, id: 'p2', website: 'http://example-study.example/contact' };
    const merged = dedupeProspects([prospect, duplicate]);
    expect(merged).toHaveLength(1);
    expect(merged[0].evidence.length).toBeGreaterThan(0);
  });

  it('offers segments but no invented contacts', () => {
    expect(TARGET_SEGMENTS.length).toBeGreaterThan(3);
    for (const segment of TARGET_SEGMENTS) {
      expect(segment).not.toHaveProperty('email');
      expect(segment).not.toHaveProperty('contact');
    }
  });
});

describe('outreach drafts', () => {
  it('refuses to draft for an unqualified prospect', () => {
    expect(() => draftOutreach({ ...prospect, stage: 'discovered' })).toThrow(/Cannot draft/i);
  });

  it('quotes only recorded evidence and includes an opt-out', () => {
    const draft = draftOutreach(prospect);
    expect(draft.body).toContain(prospect.evidence[0]);
    expect(draft.body).toMatch(/will not follow up/i);
    expect(draft.rationale.join(' ')).toMatch(/score/i);
    expect(lintOutreach(draft)).toEqual([]);
  });

  it('flags placeholders and unsupported claims', () => {
    const bad = {
      subject: 'x',
      body: 'Hi [NAME], we guarantee 100% better marks. '.repeat(6),
      rationale: [],
      openQuestions: [],
    };
    const problems = lintOutreach(bad);
    expect(problems.join(' ')).toMatch(/placeholder/i);
    expect(problems.join(' ')).toMatch(/claim/i);
    expect(problems.join(' ')).toMatch(/opt-out/i);
  });
});

describe('approval queue', () => {
  const item = createApproval({
    kind: 'partnership_message',
    title: 'Outreach · Example',
    summary: 'Draft for review',
    body: 'Hello',
    dedupeKey: 'outreach:p1',
  });

  it('is never autonomous', () => {
    expect(AUTONOMOUS_SENDING).toBe(false);
    expect(AUTONOMOUS_PUBLISHING).toBe(false);
    expect(AUTONOMOUS_SPENDING).toBe(false);
  });

  it('starts as a draft and cannot execute before approval', () => {
    expect(item.status).toBe('draft');
    const pending = submitForReview(item);
    expect(pending.status).toBe('pending_review');
    expect(
      canExecute(pending, { spentMinor: 0, budgetMinor: 0, channelConfigured: true }).allowed,
    ).toBe(false);
  });

  it('needs a named human and blocks execution without a channel', () => {
    const pending = submitForReview(item);
    expect(() => decide(pending, 'approved', '  ')).toThrow(/named human/i);
    const approved = decide(pending, 'approved', 'Nikhil');
    expect(approved.decidedBy).toBe('Nikhil');
    expect(
      canExecute(approved, { spentMinor: 0, budgetMinor: 0, channelConfigured: false }).allowed,
    ).toBe(false);
    expect(
      canExecute(approved, { spentMinor: 0, budgetMinor: 0, channelConfigured: true }).allowed,
    ).toBe(true);
  });

  it('enforces the budget ceiling', () => {
    const paid = decide(
      submitForReview(createApproval({
        kind: 'paid_ad',
        title: 'Ad test',
        summary: 'Small test',
        dedupeKey: 'ad:1',
        costMinor: 50_000,
      })),
      'approved',
      'Nikhil',
    );
    const check = canExecute(paid, { spentMinor: 0, budgetMinor: 10_000, channelConfigured: true });
    expect(check.allowed).toBe(false);
    expect(check.reasons.join(' ')).toMatch(/budget/i);
    expect(remainingBudget(40_000, 50_000)).toBe(10_000);
  });

  it('never duplicates a draft for the same prospect', () => {
    expect(hasDuplicate([item], 'outreach:p1')).toBe(true);
    expect(hasDuplicate([item], 'outreach:p2')).toBe(false);
  });

  it('sums only executed spend', () => {
    const executed: ApprovalItem = { ...item, status: 'executed', costMinor: 250 };
    expect(totalSpent([item, executed])).toBe(250);
  });

  it('defaults scheduled jobs to paused', () => {
    expect(isPaused()).toBe(true);
  });
});

describe('content pipeline', () => {
  it('backlog items are complete and publishable only after review', () => {
    for (const item of CONTENT_BACKLOG) {
      const check = validateContent(item);
      // Some drafts are intentionally "needs_source"; everything else must be valid.
      if (item.factCheck === 'verified') {
        expect(check.problems.filter(p => !p.includes('Fact-check')), item.title).toEqual([]);
      }
      const publish = canPublish({ ...item, id: 'x', createdAt: 0 }, '');
      expect(publish.valid).toBe(false);
      expect(publish.problems.join(' ')).toMatch(/approving human|approved state|verified/i);
    }
  });

  it('rejects fabricated social proof', () => {
    const check = validateContent({
      ...CONTENT_BACKLOG[0],
      draft: `${CONTENT_BACKLOG[0].draft} Join 50,000+ students and the #1 notes app in India.`,
    });
    expect(check.valid).toBe(false);
    expect(check.problems.join(' ')).toMatch(/Unsupported claim/i);
  });
});

describe('experiments', () => {
  const running = EXPERIMENT_BACKLOG.find(e => e.status === 'running')!;

  it('refuses a verdict before the minimum sample is reached', () => {
    const small = evaluateExperiment({ ...running, results: [
      { arm: 'control', visitors: 5, conversions: 1 },
      { arm: 'variant', visitors: 6, conversions: 2 },
    ] });
    expect(small.evaluable).toBe(false);
    expect(small.significant).toBe(false);
    expect(small.recommendation).toMatch(/too small/i);
  });

  it('reports lift without claiming significance on a small difference', () => {
    const verdict = evaluateExperiment({ ...running, results: [
      { arm: 'control', visitors: 1000, conversions: 100 },
      { arm: 'variant', visitors: 1000, conversions: 105 },
    ] });
    expect(verdict.evaluable).toBe(true);
    expect(verdict.significant).toBe(false);
    expect(verdict.recommendation).toMatch(/control|longer/i);
  });

  it('flags a clear, large improvement', () => {
    const verdict = evaluateExperiment({ ...running, results: [
      { arm: 'control', visitors: 2000, conversions: 100 },
      { arm: 'variant', visitors: 2000, conversions: 160 },
    ] });
    expect(verdict.significant).toBe(true);
    expect(verdict.liftPercent).toBeGreaterThan(50);
  });
});
