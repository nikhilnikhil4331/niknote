// ============================================================
// growth/experiments — a backlog with honest statistics.
//
// The rule that matters: never call a result "significant" from a small
// sample, and never report a metric whose denominator is missing. Failed and
// stopped experiments stay in the log; deleting them is how teams learn the
// wrong lesson.
// ============================================================

export type ExperimentStatus = 'backlog' | 'running' | 'completed' | 'stopped';
export type ExperimentChannel = 'landing' | 'onboarding' | 'content' | 'partnership' | 'product';

export interface Experiment {
  id: string;
  hypothesis: string;
  segment: string;
  change: string;
  mechanism: string;
  primaryMetric: string;
  guardrailMetrics: string[];
  cost: 'none' | 'low' | 'medium' | 'high';
  effort: 'small' | 'medium' | 'large';
  status: ExperimentStatus;
  /** Minimum sample per arm before a decision is allowed. */
  minSample: number;
  startedAt?: number;
  stoppedAt?: number;
  /** Observed counts per arm. */
  results?: { arm: string; visitors: number; conversions: number }[];
  decision?: string;
  createdAt: number;
}

/** Two-proportion z-test; returns null when the sample is too small. */
export function zTest(
  a: { visitors: number; conversions: number },
  b: { visitors: number; conversions: number },
): { z: number; pValue: number } | null {
  if (a.visitors <= 0 || b.visitors <= 0) return null;
  const p1 = a.conversions / a.visitors;
  const p2 = b.conversions / b.visitors;
  const pooled = (a.conversions + b.conversions) / (a.visitors + b.visitors);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.visitors + 1 / b.visitors));
  if (!se) return null;
  const z = (p1 - p2) / se;
  // Normal approximation (two-sided), adequate for the sample sizes we allow.
  const pValue = 2 * (1 - normalCdf(Math.abs(z)));
  return { z, pValue };
}

function normalCdf(x: number): number {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? 1 - p : p;
}

export interface ExperimentVerdict {
  evaluable: boolean;
  reason: string;
  liftPercent: number | null;
  pValue: number | null;
  significant: boolean;
  recommendation: string;
}

/**
 * Decide what an experiment can honestly say. `significant` is only ever true
 * when every arm meets the experiment's minimum sample and p < 0.05.
 */
export function evaluateExperiment(experiment: Experiment): ExperimentVerdict {
  const results = experiment.results ?? [];
  if (results.length < 2) {
    return {
      evaluable: false,
      reason: 'At least two arms are required.',
      liftPercent: null,
      pValue: null,
      significant: false,
      recommendation: 'Keep collecting data or add a control arm.',
    };
  }
  const [control, variant] = results;
  const smallest = Math.min(control.visitors, variant.visitors);
  if (smallest < experiment.minSample) {
    return {
      evaluable: false,
      reason: `Smallest arm has ${smallest} visitors; ${experiment.minSample} needed.`,
      liftPercent: null,
      pValue: null,
      significant: false,
      recommendation: 'Do not decide yet — the sample is too small to trust.',
    };
  }

  const lift =
    control.conversions === 0
      ? null
      : ((variant.conversions / variant.visitors) / (control.conversions / control.visitors) - 1) * 100;
  const test = zTest(control, variant);
  const significant = !!test && test.pValue < 0.05;

  return {
    evaluable: true,
    reason: significant
      ? 'Difference is unlikely to be due to chance at this sample size.'
      : 'No clear difference at this sample size.',
    liftPercent: lift === null ? null : Number(lift.toFixed(1)),
    pValue: test ? Number(test.pValue.toFixed(4)) : null,
    significant,
    recommendation: significant
      ? 'Adopt the variant and keep the guardrail metrics under observation.'
      : 'Keep the control, or run longer before changing the product.',
  };
}

const NOW = 0;

export const EXPERIMENT_BACKLOG: Experiment[] = [
  {
    id: 'exp-landing-headline',
    hypothesis:
      'A concrete outcome headline ("Turn a chapter into revision notes") converts more visitors to sign-up than a feature list.',
    segment: 'First-time visitors from organic search',
    change: 'Landing headline + subhead copy only; layout unchanged.',
    mechanism: 'Visitors recognise their own task faster, so fewer bounce before reading the value.',
    primaryMetric: 'Sign-up starts per visitor session',
    guardrailMetrics: ['First-note creation rate', 'Bounce on mobile'],
    cost: 'none',
    effort: 'small',
    status: 'backlog',
    minSample: 400,
    createdAt: NOW,
  },
  {
    id: 'exp-first-note-empty-state',
    hypothesis:
      'Showing a pre-filled sample note in the editor increases first-note creation within 24h.',
    segment: 'New sign-ups',
    change: 'Empty editor state offers a one-tap starter note.',
    mechanism: 'Removes the blank-page decision and demonstrates structure.',
    primaryMetric: 'Share of new users with a saved note in 24h',
    guardrailMetrics: ['Account deletion rate', 'Support requests about clutter'],
    cost: 'none',
    effort: 'small',
    status: 'backlog',
    minSample: 300,
    createdAt: NOW,
  },
  {
    id: 'exp-pdf-guide',
    hypothesis:
      'A PDF-to-notes guide attracts qualified organic traffic that activates better than generic AI-notes traffic.',
    segment: 'Students searching "PDF to notes"',
    change: 'Publish one detailed workflow article linked from the app import screen.',
    mechanism: 'Intent match: the visitor has a document and a deadline.',
    primaryMetric: 'Activated users per 100 organic sessions',
    guardrailMetrics: ['Average time to first note'],
    cost: 'none',
    effort: 'medium',
    status: 'backlog',
    minSample: 500,
    createdAt: NOW,
  },
  {
    id: 'exp-ics-export',
    hypothesis: 'Offering calendar export (ICS) increases planner adoption and week-2 return.',
    segment: 'Students who created at least one task',
    change: 'Add "Add to calendar" on study tasks generating a standard .ics file.',
    mechanism: 'The plan leaves the app and becomes part of the student’s day.',
    primaryMetric: 'Week-2 return among planner users',
    guardrailMetrics: ['Task completion rate'],
    cost: 'none',
    effort: 'small',
    status: 'running',
    minSample: 200,
    createdAt: NOW,
    results: [
      { arm: 'control', visitors: 48, conversions: 11 },
      { arm: 'ics-export', visitors: 52, conversions: 16 },
    ],
  },
];
