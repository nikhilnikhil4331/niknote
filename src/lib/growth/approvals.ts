// ============================================================
// growth/approvals — the human gate that stands between an AI draft and the
// outside world.
//
// Every consequential action (outreach, publishing, spending, tracking
// changes) becomes an ApprovalItem. An item is created as a draft, can be
// moved to review, and only a human decision can approve it. There is no code
// path from "generated" to "sent": `canExecute()` requires an approved status,
// a named human decider and a budget that has not been exceeded.
//
// Default mode is draft-only. `AUTONOMOUS_SENDING` is a constant `false` and
// is asserted by tests so nobody flips it silently.
// ============================================================

export const AUTONOMOUS_SENDING = false;
export const AUTONOMOUS_PUBLISHING = false;
export const AUTONOMOUS_SPENDING = false;

export type ApprovalKind =
  | 'partnership_message'
  | 'email_campaign'
  | 'article'
  | 'social_post'
  | 'paid_ad'
  | 'paid_data'
  | 'landing_change'
  | 'tracking_change';

export type ApprovalStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'cancelled';

export interface ApprovalItem {
  id: string;
  kind: ApprovalKind;
  title: string;
  /** Short description of what will happen if approved. */
  summary: string;
  /** The exact message/article body that would go out. */
  body?: string;
  /** low = reversible and internal, medium = public, high = spending/legal. */
  risk: 'low' | 'medium' | 'high';
  createdAt: number;
  requestedBy: 'agent' | 'human';
  status: ApprovalStatus;
  /** dedupeKey prevents drafting the same outreach twice. */
  dedupeKey: string;
  /** Cost in minor units (paise), 0 when free. */
  costMinor?: number;
  /** Public business email the human will send this to (never scraped). */
  contactEmail?: string;
  decidedBy?: string;
  decidedAt?: number;
  executedAt?: number;
  /** Only set after a named human confirms they sent it from their own client. */
  executedBy?: string;
  rejectionReason?: string;
}

const HIGH_RISK: ApprovalKind[] = ['paid_ad', 'paid_data', 'email_campaign', 'tracking_change'];

export function defaultRisk(kind: ApprovalKind): ApprovalItem['risk'] {
  if (HIGH_RISK.includes(kind)) return 'high';
  if (kind === 'landing_change' || kind === 'social_post' || kind === 'article') return 'medium';
  return 'low';
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `ap-${Date.now().toString(36)}-${counter}`;
}

export interface CreateApprovalInput {
  kind: ApprovalKind;
  title: string;
  summary: string;
  body?: string;
  dedupeKey: string;
  costMinor?: number;
  requestedBy?: 'agent' | 'human';
  contactEmail?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value?: string): string | undefined {
  const email = (value || '').trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : undefined;
}

/** Always creates a draft. Approval is a separate, human action. */
export function createApproval(input: CreateApprovalInput): ApprovalItem {
  return {
    id: nextId(),
    kind: input.kind,
    title: input.title.trim().slice(0, 160),
    summary: input.summary.trim().slice(0, 400),
    body: input.body,
    risk: defaultRisk(input.kind),
    createdAt: Date.now(),
    requestedBy: input.requestedBy ?? 'agent',
    status: 'draft',
    dedupeKey: input.dedupeKey,
    costMinor: input.costMinor ?? 0,
    contactEmail: normalizeEmail(input.contactEmail),
  };
}

export function submitForReview(item: ApprovalItem): ApprovalItem {
  if (item.status !== 'draft') return item;
  return { ...item, status: 'pending_review' };
}

export function decide(
  item: ApprovalItem,
  decision: 'approved' | 'rejected',
  human: string,
  reason?: string,
): ApprovalItem {
  const who = human.trim();
  if (!who) throw new Error('A named human is required to approve or reject.');
  if (!['pending_review', 'draft'].includes(item.status)) return item;
  return {
    ...item,
    status: decision,
    decidedBy: who,
    decidedAt: Date.now(),
    rejectionReason: decision === 'rejected' ? reason : undefined,
  };
}

/**
 * Whether a human can send this from their own mail client. NikNote has no
 * provider, so "executing" means: approved + a public email on file. The send
 * itself still happens outside the app.
 */
export function manualSendReady(item: ApprovalItem): ExecuteCheck {
  const reasons: string[] = [];
  if (item.status !== 'approved') reasons.push('Item is not approved by a human.');
  if (!item.decidedBy) reasons.push('No human decision recorded.');
  if (!normalizeEmail(item.contactEmail)) reasons.push('No public contact email recorded.');
  return { allowed: reasons.length === 0, reasons };
}

/** Records a send the human confirmed. Throws if the gates are not met. */
export function confirmManualSend(item: ApprovalItem, human: string): ApprovalItem {
  const who = human.trim();
  if (!who) throw new Error('A named person must confirm the send.');
  const check = manualSendReady(item);
  if (!check.allowed) throw new Error(check.reasons.join(' '));
  return { ...item, status: 'executed', executedAt: Date.now(), executedBy: who };
}

export interface ExecuteCheck {
  allowed: boolean;
  reasons: string[];
}

/**
 * The single gate used before any external effect. `spentMinor` is the sum of
 * already-executed spend plus this item; `budgetMinor` is the campaign ceiling.
 */
export function canExecute(
  item: ApprovalItem,
  context: { spentMinor: number; budgetMinor: number; channelConfigured: boolean },
): ExecuteCheck {
  const reasons: string[] = [];
  if (item.status !== 'approved') reasons.push('Item is not approved by a human.');
  if (!item.decidedBy) reasons.push('No human decision recorded.');
  if (!context.channelConfigured) reasons.push('No sending channel is configured (draft-only mode).');
  const cost = item.costMinor ?? 0;
  if (cost > 0 && context.spentMinor + cost > context.budgetMinor) {
    reasons.push('Campaign budget would be exceeded.');
  }
  return { allowed: reasons.length === 0, reasons };
}

export function remainingBudget(spentMinor: number, budgetMinor: number): number {
  return Math.max(0, budgetMinor - spentMinor);
}

export function totalSpent(items: ApprovalItem[]): number {
  return items
    .filter(item => item.status === 'executed')
    .reduce((sum, item) => sum + (item.costMinor ?? 0), 0);
}

/** Never draft the same message twice for the same prospect. */
export function hasDuplicate(items: ApprovalItem[], dedupeKey: string): boolean {
  return items.some(item => item.dedupeKey === dedupeKey && item.status !== 'cancelled');
}

export function outstandingReviews(items: ApprovalItem[]): ApprovalItem[] {
  return items.filter(item => item.status === 'pending_review');
}

/** A kill switch for scheduled jobs. Persisted so a refresh cannot re-arm it. */
export const GROWTH_PAUSE_KEY = 'niknote.growth.paused.v1';

export function isPaused(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(GROWTH_PAUSE_KEY) !== 'off';
}

export function setPaused(paused: boolean): void {
  try {
    localStorage.setItem(GROWTH_PAUSE_KEY, paused ? 'on' : 'off');
  } catch { /* ignore */ }
}
