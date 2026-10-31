// ============================================================
// NikNote Check-up — ek tap me pata karo ki AI, PDF, OCR aur
// storage sab is device (website ya APK) par chal rahe hain.
// Results aate-aate dikhte hain, AI ka intezaar poora page nahi rokta.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, FileText, Loader2, RefreshCw, ScanText,
  Smartphone, Sparkles, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAiEndpoint, runAllChecks, type CheckResult } from '@/lib/appHealth';

type Row = { id: CheckResult['id']; label: string; icon: React.FC<{ className?: string }> };

const ROWS: Row[] = [
  { id: 'ai', label: 'NikAI (AI)', icon: Sparkles },
  { id: 'pdf', label: 'PDF engine (edit, convert, protect)', icon: FileText },
  { id: 'ocr', label: 'OCR (searchable PDF)', icon: ScanText },
  { id: 'device', label: 'Device', icon: Smartphone },
];

const CHIP: Record<CheckResult['status'], string> = {
  ok: 'bg-success/10 text-success dark:text-success',
  warn: 'bg-nk-warm-600/10 text-accent-warm dark:text-accent-warm',
  fail: 'bg-primary/10 text-accent-rose dark:text-accent-rose',
};

const CHIP_LABEL: Record<CheckResult['status'], string> = {
  ok: 'Ready',
  warn: 'Dhyan do',
  fail: 'Fail',
};

function StatusIcon({ status }: { status?: CheckResult['status'] }) {
  if (!status) return <Loader2 className="h-4.5 w-4.5 animate-spin text-muted-foreground" />;
  if (status === 'ok') return <CheckCircle2 className="h-5 w-5 text-success" />;
  if (status === 'warn') return <AlertTriangle className="h-5 w-5 text-accent-warm" />;
  return <XCircle className="h-5 w-5 text-accent-rose" />;
}

export default function Checkup() {
  const [results, setResults] = useState<Partial<Record<CheckResult['id'], CheckResult>>>({});
  const [running, setRunning] = useState(false);
  const endpoint = getAiEndpoint();

  const run = useCallback(async () => {
    setRunning(true);
    setResults({});
    try {
      await runAllChecks((result) => {
        setResults((prev) => ({ ...prev, [result.id]: result }));
      });
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const done = Object.values(results).filter(Boolean) as CheckResult[];
  const failed = done.filter((r) => r.status === 'fail').length;
  const warned = done.filter((r) => r.status === 'warn').length;
  const finished = done.length === ROWS.length;
  const allGood = finished && failed === 0 && warned === 0;

  const headline = running && !finished
    ? `Check chal raha hai… (${done.length}/${ROWS.length})`
    : allGood
      ? 'Sab kuch ready hai ✅'
      : failed > 0
        ? `${failed} cheez fail ho rahi hai`
        : `${warned} cheez par dhyan do`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-nk-purple/10 via-background to-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            to="/hub"
            className="grid h-9 w-9 place-items-center rounded-full border border-border/60 bg-card/80 text-muted-foreground transition hover:text-foreground"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight">Check-up</h1>
            <p className="truncate text-[11px] text-muted-foreground">AI · PDF · OCR · device — sab yahin test hota hai</p>
          </div>
          <Button size="sm" variant="outline" onClick={run} disabled={running} className="gap-1.5">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Test
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-4">
        <div
          className={`rounded-3xl border p-4 ${
            allGood
              ? 'border-[color:hsl(var(--success)/0.5)] bg-[color:hsl(var(--success)/0.6)] dark:bg-success/10'
              : failed > 0
                ? 'border-[color:hsl(var(--accent-rose-hsl)/0.5)] bg-[color:hsl(var(--accent-rose-hsl)/0.6)] dark:bg-primary/10'
                : 'border-border/60 bg-card/70'
          }`}
        >
          <p className="text-sm font-bold">{headline}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            AI ka raasta:{' '}
            <span className="font-semibold">
              {endpoint.route === 'gateway' ? 'NikNote cloud gateway' : 'is site ka /api/ai'}
            </span>
            {' · '}Ye check device par hi chalta hai, koi data kahin nahi jaata.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          {ROWS.map(({ id, label, icon: Icon }) => {
            const result = results[id];
            return (
              <div key={id} className="rounded-2xl border border-border/60 bg-card/80 p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10">
                    <Icon className="h-4 w-4 text-accent-cool dark:text-accent-cool" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{result?.label || label}</p>
                      {result ? (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${CHIP[result.status]}`}>
                          {CHIP_LABEL[result.status]}
                        </span>
                      ) : null}
                      <StatusIcon status={result?.status} />
                    </div>
                    <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">
                      {result?.detail || 'Check ho raha hai…'}
                    </p>
                    {result ? (
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">{result.ms} ms</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-3xl border border-border/60 bg-card/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agar kuch fail ho</p>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li>• <strong className="font-semibold">AI fail:</strong> internet check karo, phir “Test” dobara dabao. APK me AI NikNote cloud se chalta hai, to site band ho to AI bhi rukega.</li>
            <li>• <strong className="font-semibold">OCR warning:</strong> sirf pehli baar model download hota hai — Wi-Fi par ek baar chala lo, uske baad cache se chalega.</li>
            <li>• <strong className="font-semibold">PDF fail:</strong> app ka naya version install karo (niknote.online se APK).</li>
            <li>• <strong className="font-semibold">Storage band:</strong> browser me site data / cookies allow karo, warna notes save nahi honge.</li>
          </ul>
          <a
            href={`${endpoint.url}?probe=1`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-between rounded-2xl border border-dashed border-border/70 bg-background/60 px-3 py-2 text-xs transition hover:border-primary/60"
          >
            <span className="font-semibold">AI ka seedha proof (JSON)</span>
            <span className="text-muted-foreground">
              {endpoint.route === 'gateway' ? '/api/ai?probe=1' : 'is site ka /api/ai?probe=1'}
            </span>
          </a>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link to="/ai" className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm transition hover:border-primary/60">
              <span className="font-semibold">NikAI kholo</span>
              <span className="block text-[11px] text-muted-foreground">Asli sawaal pooch ke test karo</span>
            </Link>
            <Link to="/pdf-tools" className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm transition hover:border-primary/60">
              <span className="font-semibold">PDF Tools</span>
              <span className="block text-[11px] text-muted-foreground">Word, Excel, OCR, protect</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
