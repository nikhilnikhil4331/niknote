import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ClipboardCopy, FlaskConical, Inbox, Pause, Play, Plus,
  Sparkles, Trash2, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AUTONOMOUS_SENDING, canExecute, confirmManualSend, createApproval, decide, hasDuplicate,
  isPaused, manualSendReady, remainingBudget, setPaused, submitForReview, totalSpent,
  type ApprovalItem,
} from '@/lib/growth/approvals';
import { buildDraft, draftToPlainText, mailtoLink } from '@/lib/growth/email';
import {
  buildFunnelReport, clearGrowthEvents, funnelToCsv, track,
} from '@/lib/growth/funnel';
import { CONTENT_BACKLOG, canPublish, validateContent } from '@/lib/growth/content';
import { EXPERIMENT_BACKLOG, evaluateExperiment } from '@/lib/growth/experiments';
import { draftOutreach, lintOutreach } from '@/lib/growth/outreach';
import {
  canContact, scoreProspect, TARGET_SEGMENTS, type Prospect, type ProspectKind,
} from '@/lib/growth/prospects';
import {
  loadApprovals, loadBudgetMinor, loadProspects, saveApprovals, saveProspects,
} from '@/lib/growth/store';
import { fetchServerFunnel, syncGrowthEvents, unsyncedGrowthEventCount, type ServerFunnelRow } from '@/lib/growth/sync';

type Tab = 'funnel' | 'prospects' | 'approvals' | 'content' | 'experiments';

const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: 'funnel', label: 'Funnel', icon: Activity },
  { id: 'prospects', label: 'Prospects', icon: Users },
  { id: 'approvals', label: 'Approvals', icon: Inbox },
  { id: 'content', label: 'Content', icon: Sparkles },
  { id: 'experiments', label: 'Experiments', icon: FlaskConical },
];

function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'amber' | 'rose' | 'violet' }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${tones[tone]}`}>
      {children}
    </span>
  );
}

const emptyProspect = {
  name: '', website: '', publicContact: '', kind: 'community' as ProspectKind,
  relevance: '', collaborationIdea: '', evidence: '',
};

export const GrowthStudio: React.FC = () => {
  const [tab, setTab] = useState<Tab>('funnel');
  const [paused, setPausedState] = useState(true);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [budget, setBudget] = useState(0);
  const [decisionName, setDecisionName] = useState('');
  const [form, setForm] = useState(emptyProspect);
  const [report, setReport] = useState(() => buildFunnelReport());
  const [version, setVersion] = useState(0);
  const [serverRows, setServerRows] = useState<ServerFunnelRow[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverBusy, setServerBusy] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    setPausedState(isPaused());
    setProspects(loadProspects());
    setApprovals(loadApprovals());
    setBudget(loadBudgetMinor());
    setReport(buildFunnelReport());
    setPendingSync(unsyncedGrowthEventCount());
  }, [version]);

  const refreshServerFunnel = async () => {
    setServerBusy(true);
    const sync = await syncGrowthEvents();
    const result = await fetchServerFunnel(30);
    setServerRows(result.rows);
    setServerError(result.error ?? null);
    setPendingSync(unsyncedGrowthEventCount());
    setServerBusy(false);
    if (sync.error && sync.error !== 'no-consent') {
      setServerError(prev => prev ?? `Upload failed: ${sync.error}`);
    }
  };

  useEffect(() => {
    void refreshServerFunnel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spent = totalSpent(approvals);

  const addProspect = () => {
    if (!form.name.trim() || !form.website.trim()) {
      toast.error('Name and public website are required.');
      return;
    }
    const prospect: Prospect = {
      id: `p-${Date.now().toString(36)}`,
      name: form.name.trim(),
      website: form.website.trim(),
      publicContact: form.publicContact.trim() || undefined,
      kind: form.kind,
      relevance: form.relevance.trim(),
      collaborationIdea: form.collaborationIdea.trim(),
      evidence: form.evidence.split('\n').map(s => s.trim()).filter(Boolean),
      researchDate: new Date().toISOString().slice(0, 10),
      stage: 'researched',
    };
    const next = saveProspects([...prospects, prospect]);
    setProspects(next);
    setForm(emptyProspect);
    toast.success('Prospect added — qualify it before drafting anything.');
  };

  const updateStage = (id: string, stage: Prospect['stage']) => {
    const next = saveProspects(prospects.map(p => (p.id === id ? { ...p, stage } : p)));
    setProspects(next);
  };

  const createDraft = (prospect: Prospect) => {
    const gate = canContact(prospect);
    if (!gate.allowed) {
      toast.error(gate.reasons[0]);
      return;
    }
    const key = `outreach:${prospect.id}`;
    if (hasDuplicate(approvals, key)) {
      toast.info('A draft already exists for this prospect.');
      return;
    }
    // Approving the record is a human step that must happen before a draft.
    const draft = draftOutreach(prospect);
    const problems = lintOutreach(draft);
    const item = submitForReview(
      createApproval({
        kind: 'partnership_message',
        title: `Outreach · ${prospect.name}`,
        summary: draft.rationale.join(' '),
        body: `Subject: ${draft.subject}\n\n${draft.body}`,
        dedupeKey: key,
        contactEmail: prospect.publicContact,
      }),
    );
    setApprovals(saveApprovals([...approvals, item]));
    updateStage(prospect.id, 'drafted');
    toast[problems.length ? 'warning' : 'success'](
      problems.length ? `Draft created — reviewer note: ${problems[0]}` : 'Draft created and queued for review.',
    );
  };

  const decideItem = (item: ApprovalItem, decision: 'approved' | 'rejected') => {
    try {
      const updated = decide(item, decision, decisionName);
      setApprovals(saveApprovals(approvals.map(a => (a.id === item.id ? updated : a))));
      toast.success(decision === 'approved' ? 'Approved. Still nothing is sent automatically.' : 'Rejected.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not record the decision.');
    }
  };

  const openInMailApp = (item: ApprovalItem) => {
    const gate = manualSendReady(item);
    if (!gate.allowed) {
      toast.error(gate.reasons[0]);
      return;
    }
    const subjectLine = (item.body || '').split('\n').find(line => /^Subject:\s*/i.test(line));
    const subject = subjectLine ? subjectLine.replace(/^Subject:\s*/i, '') : item.title;
    const body = (item.body || '').replace(/^Subject:.*\n+/i, '');
    const built = buildDraft({
      to: item.contactEmail || '',
      subject,
      body,
      senderName: decisionName.trim() || 'NikNote',
      senderEmail: item.contactEmail || '',
    });
    if ('error' in built) {
      toast.error(built.error);
      return;
    }
    const { href, tooLong } = mailtoLink(built.draft);
    if (tooLong) {
      void navigator.clipboard.writeText(draftToPlainText(built.draft));
      toast.warning('Message is long for a mail link — copied to the clipboard instead.');
      return;
    }
    window.location.href = href;
  };

  const confirmSend = (item: ApprovalItem) => {
    if (!decisionName.trim()) {
      toast.error('Type your name first — a send needs a named human.');
      return;
    }
    const gate = manualSendReady(item);
    if (!gate.allowed) {
      toast.error(gate.reasons[0]);
      return;
    }
    if (!window.confirm('Only confirm after you actually sent it from your mail app. Continue?')) return;
    try {
      const executed = confirmManualSend(item, decisionName.trim());
      setApprovals(saveApprovals(approvals.map(a => (a.id === item.id ? executed : a))));
      toast.success('Recorded as sent by you — NikNote did not send any email.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not record the send.');
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied — send it yourself from your own inbox.');
    } catch {
      toast.error('Clipboard blocked by the browser.');
    }
  };

  const contentItems = useMemo(
    () => CONTENT_BACKLOG.map(item => ({ ...item, createdAt: 0, id: item.title })),
    [],
  );

  return (
    <div className="space-y-4" data-testid="growth-studio">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Growth workspace</h2>
          <p className="text-xs text-slate-500">
            Draft-only by design: {AUTONOMOUS_SENDING ? 'autonomous sending ON' : 'nothing is sent or published automatically'}.
            Budget remaining ₹{(remainingBudget(spent, budget) / 100).toFixed(0)} of ₹{(budget / 100).toFixed(0)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={paused ? 'amber' : 'green'}>{paused ? 'Jobs paused' : 'Jobs running'}</Badge>
          <button
            type="button"
            data-testid="growth-pause-toggle"
            onClick={() => {
              const next = !paused;
              setPaused(!next);
              setPausedState(next);
              toast.success(next ? 'Scheduled growth jobs paused.' : 'Scheduled growth jobs resumed.');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            type="button"
            onClick={() => setVersion(v => v + 1)}
            className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              tab === id ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'funnel' && (
        <div className="space-y-4">
          {!report.consentGiven && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <p>
                Analytics consent is not given on this device, so no events are being recorded.
                The report stays empty until a visitor accepts optional analytics.
              </p>
            </div>
          )}
          {report.insufficientData && (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Sample size is {report.sampleSize} sign-ups. Retention and conversion rates are
              intentionally left blank until there is enough data — no estimates are invented.
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Stage</th>
                  <th className="px-3 py-2 font-semibold">Sessions</th>
                  <th className="px-3 py-2 font-semibold">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {report.stages.map(stage => (
                  <tr key={stage.label} className="border-t">
                    <td className="px-3 py-2 font-medium text-slate-800">{stage.label}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-700">{stage.value}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-700">
                      {stage.conversion === null ? '—' : `${stage.conversion}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {report.retention.map(window => (
              <div key={window.window} className="rounded-xl border bg-white p-3">
                <div className="text-xs font-bold uppercase text-slate-500">Retention {window.window}</div>
                <div className="mt-1 text-lg font-bold text-slate-900">
                  {window.rate === null ? 'insufficient data' : `${window.rate}%`}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{window.note}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold uppercase text-slate-500">Server funnel (last 30 days)</div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Aggregated counts from <code>growth_events</code>. This is what crosses devices.
                  {pendingSync > 0 ? ` ${pendingSync} event(s) on this device are not uploaded yet.` : ' Everything on this device is uploaded.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { void refreshServerFunnel(); }}
                disabled={serverBusy}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {serverBusy ? 'Refreshing…' : 'Sync + refresh'}
              </button>
            </div>

            {serverError && (
              <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                Could not read the server funnel: {serverError}. Nothing is estimated below.
              </p>
            )}

            {serverRows.length === 0 ? (
              <p className="mt-2 text-[11px] text-slate-500">
                No server-side events yet. With consent, events upload in small batches and appear here
                once they land.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="py-1 pr-3 font-semibold">Event</th>
                      <th className="py-1 pr-3 font-semibold">Events</th>
                      <th className="py-1 pr-3 font-semibold">Unique actors</th>
                      <th className="py-1 font-semibold">Latest day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      serverRows.reduce<Record<string, { events: number; actors: number; day: string }>>((acc, row) => {
                        const current = acc[row.name] ?? { events: 0, actors: 0, day: row.day };
                        acc[row.name] = {
                          events: current.events + Number(row.events),
                          actors: current.actors + Number(row.unique_actors),
                          day: row.day > current.day ? row.day : current.day,
                        };
                        return acc;
                      }, {}),
                    )
                      .sort((a, b) => b[1].events - a[1].events)
                      .map(([name, value]) => (
                        <tr key={name} className="border-t border-slate-100">
                          <td className="py-1 pr-3 font-medium text-slate-800">{name}</td>
                          <td className="py-1 pr-3 tabular-nums text-slate-700">{value.events}</td>
                          <td className="py-1 pr-3 tabular-nums text-slate-700">{value.actors}</td>
                          <td className="py-1 tabular-nums text-slate-500">{value.day}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <p className="mt-1 text-[10.5px] text-slate-400">
                  Unique actors per day sum; a person active on several days counts once per day.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-3">
            <div className="text-xs font-bold uppercase text-slate-500">Feature adoption</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {report.featureAdoption.map(feature => (
                <Badge key={feature.feature} tone="violet">
                  {feature.feature}: {feature.uses} events
                </Badge>
              ))}
              {!report.featureAdoption.some(f => f.uses > 0) && (
                <span className="text-[11px] text-slate-500">No consented events recorded yet.</span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([funnelToCsv(report)], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'niknote-funnel.csv';
                link.click();
                URL.revokeObjectURL(url);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ClipboardCopy className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              type="button"
              data-testid="growth-clear-events"
              onClick={() => {
                clearGrowthEvents();
                setReport(buildFunnelReport());
                toast.success('Local growth events cleared.');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete local analytics
            </button>
          </div>
        </div>
      )}

      {tab === 'prospects' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-3">
            <h3 className="text-sm font-bold text-slate-800">Add a prospect (public information only)</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Organisation / creator name"
                className="rounded-lg border px-2.5 py-1.5 text-xs"
              />
              <input
                value={form.website}
                onChange={e => setForm({ ...form, website: e.target.value })}
                placeholder="https://public-site.example"
                className="rounded-lg border px-2.5 py-1.5 text-xs"
              />
              <select
                value={form.kind}
                onChange={e => setForm({ ...form, kind: e.target.value as ProspectKind })}
                className="rounded-lg border px-2.5 py-1.5 text-xs"
              >
                {TARGET_SEGMENTS.map(segment => (
                  <option key={segment.kind} value={segment.kind}>{segment.label}</option>
                ))}
              </select>
              <input
                value={form.publicContact}
                onChange={e => setForm({ ...form, publicContact: e.target.value })}
                placeholder="Published channel (e.g. partnerships form)"
                className="rounded-lg border px-2.5 py-1.5 text-xs"
              />
              <textarea
                value={form.relevance}
                onChange={e => setForm({ ...form, relevance: e.target.value })}
                placeholder="Why is this organisation relevant?"
                className="sm:col-span-2 rounded-lg border px-2.5 py-1.5 text-xs"
                rows={2}
              />
              <textarea
                value={form.evidence}
                onChange={e => setForm({ ...form, evidence: e.target.value })}
                placeholder="Public observations, one per line (page you actually looked at)"
                className="sm:col-span-2 rounded-lg border px-2.5 py-1.5 text-xs"
                rows={2}
              />
              <textarea
                value={form.collaborationIdea}
                onChange={e => setForm({ ...form, collaborationIdea: e.target.value })}
                placeholder="Concrete collaboration idea"
                className="sm:col-span-2 rounded-lg border px-2.5 py-1.5 text-xs"
                rows={2}
              />
            </div>
            <button
              type="button"
              onClick={addProspect}
              className="mt-2 inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
            >
              <Plus className="w-3.5 h-3.5" /> Add prospect
            </button>
          </div>

          {prospects.length === 0 && (
            <p className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-600">
              No prospects yet. Start from a segment: {TARGET_SEGMENTS.map(s => s.label).join(' · ')}.
            </p>
          )}

          <div className="space-y-2">
            {prospects.map(prospect => {
              const score = scoreProspect(prospect);
              const gate = canContact(prospect);
              return (
                <div key={prospect.id} className="rounded-xl border bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{prospect.name}</div>
                      <a href={prospect.website} target="_blank" rel="noreferrer" className="text-[11px] text-violet-700 underline">
                        {prospect.website}
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge tone={score.total >= 60 ? 'green' : score.total >= 40 ? 'amber' : 'rose'}>
                        score {score.total}
                      </Badge>
                      <select
                        value={prospect.stage}
                        onChange={e => updateStage(prospect.id, e.target.value as Prospect['stage'])}
                        className="rounded-lg border px-2 py-1 text-[11px]"
                      >
                        {['discovered', 'researched', 'qualified', 'drafted', 'approved', 'contacted', 'replied', 'won', 'declined', 'opted_out'].map(stage => (
                          <option key={stage} value={stage}>{stage}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => createDraft(prospect)}
                        className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700 hover:bg-violet-100"
                      >
                        Draft outreach
                      </button>
                    </div>
                  </div>
                  {prospect.evidence.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-slate-600">
                      {prospect.evidence.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  )}
                  {score.blockers.length > 0 && (
                    <p className="mt-1 text-[11px] text-amber-700">Blocked: {score.blockers.join(' ')}</p>
                  )}
                  {!gate.allowed && (
                    <p className="mt-1 text-[11px] text-slate-500">{gate.reasons[0]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'approvals' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3">
            <label className="text-[11px] font-semibold text-slate-600" htmlFor="growth-reviewer">
              Reviewer name (required to approve)
            </label>
            <input
              id="growth-reviewer"
              value={decisionName}
              onChange={e => setDecisionName(e.target.value)}
              placeholder="Your name"
              className="rounded-lg border px-2.5 py-1.5 text-xs"
            />
            <Badge tone="slate">Draft-only · you send from your own mail app</Badge>
          </div>

          {approvals.length === 0 && (
            <p className="rounded-xl border bg-slate-50 p-3 text-xs text-slate-600">
              Nothing waiting. Drafts created from the Prospects tab appear here for review.
            </p>
          )}

          {approvals.map(item => (
            <div key={item.id} className="rounded-xl border bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-slate-900">{item.title}</div>
                  <div className="text-[11px] text-slate-500">{item.kind} · risk {item.risk}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={item.status === 'approved' ? 'green' : item.status === 'rejected' ? 'rose' : 'amber'}>
                    {item.status}
                  </Badge>
                  {item.status === 'pending_review' && (
                    <>
                      <button
                        type="button"
                        onClick={() => decideItem(item, 'approved')}
                        className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => decideItem(item, 'rejected')}
                        className="rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {item.status === 'approved' && (
                    <>
                      <button
                        type="button"
                        onClick={() => openInMailApp(item)}
                        className="rounded-lg border px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                        title={manualSendReady(item).allowed ? 'Opens your mail app with the draft' : manualSendReady(item).reasons.join(' ')}
                      >
                        Open in mail app
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmSend(item)}
                        className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white hover:bg-slate-800"
                      >
                        I sent it
                      </button>
                    </>
                  )}
                </div>
              </div>
              {item.body && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-semibold text-slate-600">View message</summary>
                  <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700">{item.body}</pre>
                  <button
                    type="button"
                    onClick={() => copy(item.body || '')}
                    className="mt-1 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    <ClipboardCopy className="w-3 h-3" /> Copy
                  </button>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'content' && (
        <div className="space-y-3">
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Drafts are proposals, not publications. Copy one into your editor, edit it in your own
            voice, and only then move it through review.
          </p>
          {contentItems.map(item => {
            const problems = validateContent(item);
            const publish = canPublish(item, '');
            return (
              <div key={item.title} className="rounded-xl border bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold text-slate-900">{item.title}</div>
                  <Badge tone={problems.valid ? 'green' : 'amber'}>{item.channel}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {item.audience} · {item.intent} · metric: {item.successMetric}
                </p>
                <p className="mt-2 text-xs text-slate-700">{item.draft}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone="violet">{item.feature}</Badge>
                  <Badge tone={item.factCheck === 'verified' ? 'green' : 'amber'}>facts: {item.factCheck}</Badge>
                  <button
                    type="button"
                    onClick={() => copy(item.draft)}
                    className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold text-slate-700"
                  >
                    <ClipboardCopy className="w-3 h-3" /> Copy draft
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Publish blocked: {publish.problems[0]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'experiments' && (
        <div className="space-y-3">
          {EXPERIMENT_BACKLOG.map(experiment => {
            const verdict = evaluateExperiment(experiment);
            return (
              <div key={experiment.id} className="rounded-xl border bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-bold text-slate-900">{experiment.id}</div>
                  <Badge tone={experiment.status === 'running' ? 'green' : 'slate'}>{experiment.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-700">{experiment.hypothesis}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Metric: {experiment.primaryMetric} · guardrails: {experiment.guardrailMetrics.join(', ')}
                </p>
                <p className="mt-2 text-[11px] font-semibold text-slate-700">
                  {verdict.evaluable
                    ? `${verdict.significant ? 'Significant' : 'Not significant'} · lift ${verdict.liftPercent ?? '—'}% · p ${verdict.pValue ?? '—'}`
                    : verdict.reason}
                </p>
                <p className="text-[11px] text-slate-500">{verdict.recommendation}</p>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Events recorded locally: {report.stages[0]?.value ?? 0} visitor sessions ·{' '}
        {report.consentGiven ? 'consent given' : 'consent not given'} ·{' '}
        <button type="button" className="underline" onClick={() => track('visitor_landing', { page: 'growth-studio' })}>
          self-test event
        </button>
      </p>
    </div>
  );
};

export default GrowthStudio;
