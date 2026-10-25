// ============================================================
// NikNote Check-up — ek tap me pata karo ki AI, PDF, OCR aur
// storage sab is device (website ya APK) par chal rahe hain.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, CheckCircle2, FileText, Loader2, RefreshCw, ScanText,
  Smartphone, Sparkles, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAiEndpoint, runAllChecks, type CheckResult } from '@/lib/appHealth';

const ICONS: Record<CheckResult['id'], React.FC<{ className?: string }>> = {
  ai: Sparkles,
  pdf: FileText,
  ocr: ScanText,
  device: Smartphone,
};

function StatusIcon({ status }: { status: CheckResult['status'] }) {
  if (status === 'ok') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (status === 'warn') return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  return <XCircle className="h-5 w-5 text-rose-500" />;
}

const CHIP: Record<CheckResult['status'], string> = {
  ok: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  fail: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
};

const CHIP_LABEL: Record<CheckResult['status'], string> = {
  ok: 'Ready',
  warn: 'Dhyan do',
  fail: 'Fail',
};

export default function Checkup() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const endpoint = getAiEndpoint();

  const run = useCallback(async () => {
    setRunning(true);
    try {
      setResults(await runAllChecks());
    } finally {
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const failed = results.filter((r) => r.status === 'fail').length;
  const warned = results.filter((r) => r.status === 'warn').length;
  const allGood = results.length > 0 && failed === 0 && warned === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-500/10 via-background to-background pb-24">
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
              ? 'border-emerald-400/50 bg-emerald-50/60 dark:bg-emerald-500/10'
              : failed > 0
                ? 'border-rose-400/50 bg-rose-50/60 dark:bg-rose-500/10'
                : 'border-border/60 bg-card/70'
          }`}
        >
          <p className="text-sm font-bold">
            {running && results.length === 0
              ? 'Check chal raha hai…'
              : allGood
                ? 'Sab kuch ready hai ✅'
                : failed > 0
                  ? `${failed} cheez fail ho rahi hai`
                  : `${warned} cheez par dhyan do`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            AI ka raasta: <span className="font-semibold">{endpoint.route === 'gateway' ? 'NikNote cloud gateway' : 'is site ka /api/ai'}</span>
            {' · '}Ye check device par hi chalta hai, koi data kahin nahi jaata.
          </p>
        </div>

        <div className="mt-4 space-y-2">
          {(results.length > 0 ? results : []).map((result) => {
            const Icon = ICONS[result.id];
            return (
              <div key={result.id} className="rounded-2xl border border-border/60 bg-card/80 p-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-500/10">
                    <Icon className="h-4.5 w-4.5 text-violet-600 dark:text-violet-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">{result.label}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${CHIP[result.status]}`}>
                        {CHIP_LABEL[result.status]}
                      </span>
                      <StatusIcon status={result.status} />
                    </div>
                    <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">{result.detail}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground/70">{result.ms} ms</p>
                  </div>
                </div>
              </div>
            );
          })}

          {running && results.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/70 p-4">
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground">AI ka jawab aane ka intezaar…</p>
            </div>
          ) : null}
        </div>

        <div className="mt-5 rounded-3xl border border-border/60 bg-card/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agar kuch fail ho</p>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li>• <strong className="font-semibold">AI fail:</strong> internet check karo, phir “Test” dobara dabao. APK me AI NikNote cloud se chalta hai, to site band ho to AI bhi rukega.</li>
            <li>• <strong className="font-semibold">OCR warning:</strong> sirf pehli baar model download hota hai — Wi-Fi par ek baar chala lo, uske baad cache se chalega.</li>
            <li>• <strong className="font-semibold">PDF fail:</strong> app ka naya version install karo (niknote.online se APK).</li>
            <li>• <strong className="font-semibold">Storage band:</strong> browser me site data / cookies allow karo, warna notes save nahi honge.</li>
          </ul>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link to="/ai" className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm transition hover:border-violet-400/60">
              <span className="font-semibold">NikAI kholo</span>
              <span className="block text-[11px] text-muted-foreground">Asli sawaal pooch ke test karo</span>
            </Link>
            <Link to="/pdf-tools" className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 text-sm transition hover:border-violet-400/60">
              <span className="font-semibold">PDF Tools</span>
              <span className="block text-[11px] text-muted-foreground">Word, Excel, OCR, protect</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
