import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Sparkles } from 'lucide-react';
import { useNotebooks, usePages } from '@/hooks/useNotebooks';
import {
  aiCall,
  buildOrganisationPrompt,
  buildStudyPlanPrompt,
  buildSuggestedPrompts,
  parseOrganisation,
  parsePlan,
  pageToText,
  summariseNote,
  type OrgGroup,
} from '@/lib/agentWorkflows';
import { AstaMarkdown } from '@/components/asta/AstaMarkdown';

type Result =
  | { kind: 'summary' | 'ask'; title: string; text: string }
  | { kind: 'org'; title: string; groups: OrgGroup[] }
  | { kind: 'plan'; title: string; items: string[] };

export function AgentWorkflows() {
  const [open, setOpen] = useState(false);
  return (
    <div className="shrink-0 border-b border-border/60 bg-muted/30 px-4 sm:px-7">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 py-2 text-sm font-semibold text-foreground/80 hover:text-foreground"
        aria-expanded={open}
      >
        <Sparkles className="h-4 w-4 text-primary" />
        Agent workflows
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <WorkflowsPanel />}
    </div>
  );
}

// Hooks live here so nothing touches auth until the panel is opened.
function WorkflowsPanel() {
  const { notebooks } = useNotebooks();
  const [notebookId, setNotebookId] = useState<string>('');
  const selectedId = notebookId || notebooks[0]?.id || '';
  const { pages } = usePages(selectedId || null);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState<Record<number, boolean>>({});

  const selectedTitle = notebooks.find(n => n.id === selectedId)?.title || 'my notes';

  const run = async (kind: 'summary' | 'org' | 'plan' | 'ask', prompt?: string) => {
    setBusy(kind);
    setError('');
    setResult(null);
    setStep('');
    setDone({});
    try {
      if (kind === 'summary') {
        const text = pages.map(p => pageToText(p.content)).join('\n\n');
        if (!text.trim()) throw new Error('This notebook has no written content yet.');
        const out = await summariseNote(text, aiCall, setStep);
        setResult({ kind: 'summary', title: `Summary — ${selectedTitle}`, text: out });
      } else if (kind === 'org') {
        const items = pages
          .map(p => ({ title: p.title || 'Untitled page', preview: pageToText(p.content).slice(0, 140) }))
          .filter(i => i.preview);
        if (items.length < 2) throw new Error('Need at least 2 pages with content to organise.');
        const groups = parseOrganisation(await aiCall(buildOrganisationPrompt(items)));
        if (!groups.length) throw new Error('The AI did not return a usable grouping — try again.');
        setResult({ kind: 'org', title: `Suggested organisation — ${selectedTitle}`, groups });
      } else if (kind === 'plan') {
        const titles = pages.map(p => p.title || 'Untitled page');
        if (!titles.length) throw new Error('This notebook has no pages yet.');
        const items = parsePlan(await aiCall(buildStudyPlanPrompt(titles, days)));
        if (!items.length) throw new Error('The AI did not return a usable plan — try again.');
        setResult({ kind: 'plan', title: `${days}-day plan — ${selectedTitle}`, items });
      } else {
        const text = await aiCall(prompt || '');
        setResult({ kind: 'ask', title: 'Answer', text });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI request failed — check your connection or AI keys in the AI settings.');
    } finally {
      setBusy(null);
      setStep('');
    }
  };

  const copyOrg = async (groups: OrgGroup[]) => {
    const text = groups.map(g => `## ${g.name}\n${g.notes.map(n => `- ${n}`).join('\n')}${g.reason ? `\n(${g.reason})` : ''}`).join('\n\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="pb-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedId}
              onChange={e => setNotebookId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              aria-label="Notebook for agent workflows"
            >
              {notebooks.length === 0 && <option value="">No notebooks yet</option>}
              {notebooks.map(n => (
                <option key={n.id} value={n.id}>{n.title}</option>
              ))}
            </select>
            <button type="button" disabled={!!busy || !selectedId} onClick={() => run('summary')} className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {busy === 'summary' ? 'Working…' : 'Summarise'}
            </button>
            <button type="button" disabled={!!busy || !selectedId} onClick={() => run('org')} className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium disabled:opacity-50">
              {busy === 'org' ? 'Working…' : 'Organise notes'}
            </button>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="number"
                min={1}
                max={30}
                value={days}
                onChange={e => setDays(Math.max(1, Math.min(30, Number(e.target.value) || 7)))}
                className="h-9 w-16 rounded-md border border-input bg-background px-2 text-sm"
                aria-label="Plan length in days"
              />
              days
            </label>
            <button type="button" disabled={!!busy || !selectedId} onClick={() => run('plan')} className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium disabled:opacity-50">
              {busy === 'plan' ? 'Working…' : 'Study plan'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {buildSuggestedPrompts(selectedTitle).map(p => (
              <button
                key={p}
                type="button"
                disabled={!!busy}
                onClick={() => run('ask', p)}
                className="rounded-full border border-input bg-background px-3 py-1 text-xs text-foreground/80 hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
          {step && <p className="text-xs text-muted-foreground">{step}</p>}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {result && (
            <div className="rounded-lg border border-border/60 bg-background p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{result.title}</h3>
                {result.kind === 'org' && (
                  <button type="button" onClick={() => copyOrg(result.groups)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
              {result.kind === 'org' ? (
                <ul className="space-y-3">
                  {result.groups.map(g => (
                    <li key={g.name}>
                      <p className="text-sm font-medium">{g.name}</p>
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {g.notes.map(n => (
                          <li key={n} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{n}</li>
                        ))}
                      </ul>
                      {g.reason && <p className="mt-1 text-xs text-muted-foreground">{g.reason}</p>}
                    </li>
                  ))}
                </ul>
              ) : result.kind === 'plan' ? (
                <ul className="space-y-1.5">
                  {result.items.map((item, i) => (
                    <li key={i}>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!done[i]}
                          onChange={() => setDone(d => ({ ...d, [i]: !d[i] }))}
                          className="mt-1 h-4 w-4 rounded border-input"
                        />
                        <span className={done[i] ? 'line-through text-muted-foreground' : ''}>{item}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <AstaMarkdown content={result.text} />
              )}
            </div>
    )}
    </div>
  );
}