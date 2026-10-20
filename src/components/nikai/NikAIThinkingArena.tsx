import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Flame, Gamepad2, Sparkles, Trophy, Zap } from 'lucide-react';
import { NikAIStarConstellation } from '@/components/nikai/NikAIBrand';

const HIGHSCORE_KEY = 'niknote.nikai.highscore.v1';

interface StarOrb {
  id: number;
  x: number; // percentage 8..90
  y: number; // percentage 14..80
  kind: 'gold' | 'astra' | 'bomb';
  bornAt: number;
  ttl: number;
}

interface BurstText {
  id: number;
  x: number;
  y: number;
  label: string;
  tone: 'good' | 'super' | 'bad';
}

interface MathChallenge {
  question: string;
  answer: number;
  options: number[];
}

function makeMathChallenge(): MathChallenge {
  const ops = ['+', '-', '×'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  const a = op === '×' ? Math.floor(Math.random() * 11) + 3 : Math.floor(Math.random() * 35) + 8;
  const b = op === '×' ? Math.floor(Math.random() * 9) + 3 : Math.floor(Math.random() * 25) + 4;
  const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
  const distractors = new Set<number>([answer]);
  while (distractors.size < 4) {
    const delta = (Math.floor(Math.random() * 9) + 1) * (Math.random() > 0.5 ? 1 : -1);
    distractors.add(answer + delta);
  }
  return {
    question: `${a} ${op} ${b}`,
    answer,
    options: Array.from(distractors).sort(() => Math.random() - 0.5),
  };
}

interface NikAIThinkingArenaProps {
  isStreaming: boolean;
  thinkingText?: string;
  modelName?: string;
  forceOpen?: boolean;
  onCloseManual?: () => void;
}

const THINKING_PHASES = [
  'Scanning Session Memory & Personal Context…',
  ' Synthesizing Concepts through Astra Neural Core…',
  'Structuring Exam-Grade Notes, Formulas & Examples…',
  'Polishing Clarity & Finalizing Response…',
];

export const NikAIThinkingArena: React.FC<NikAIThinkingArenaProps> = ({
  isStreaming,
  thinkingText,
  modelName,
  forceOpen = false,
  onCloseManual,
}) => {
  const [miniMode, setMiniMode] = useState<'stars' | 'math'>('stars');
  const [gameExpanded, setGameExpanded] = useState(true);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(HIGHSCORE_KEY) || '0') || 0;
    } catch {
      return 0;
    }
  });
  const [orbs, setOrbs] = useState<StarOrb[]>([]);
  const [bursts, setBursts] = useState<BurstText[]>([]);
  const [mathQ, setMathQ] = useState<MathChallenge>(() => makeMathChallenge());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showReasoning, setShowReasoning] = useState(false);

  const idCounter = useRef(1);
  const active = (isStreaming && gameExpanded) || forceOpen;

  // Elapsed live neural timer while streaming
  useEffect(() => {
    if (!isStreaming) return;
    setElapsedMs(0);
    const t0 = performance.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Math.round(performance.now() - t0));
    }, 90);
    return () => window.clearInterval(timer);
  }, [isStreaming]);

  // Persist high score immediately
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      try {
        localStorage.setItem(HIGHSCORE_KEY, String(score));
      } catch {
        // ignore storage quota
      }
    }
  }, [score, highScore]);

  // Spawn interactive orbs smoothly while arena is active
  useEffect(() => {
    if (!active || miniMode !== 'stars') return;

    const spawn = () => {
      const roll = Math.random();
      const kind: StarOrb['kind'] = roll > 0.84 ? 'astra' : roll < 0.14 ? 'bomb' : 'gold';
      const id = idCounter.current++;
      const ttl = kind === 'astra' ? 1900 : 2500;
      const orb: StarOrb = {
        id,
        x: Math.floor(Math.random() * 78) + 10,
        y: Math.floor(Math.random() * 62) + 16,
        kind,
        bornAt: Date.now(),
        ttl,
      };
      setOrbs((prev) => [...prev.slice(-6), orb]);
    };

    spawn();
    const spawner = window.setInterval(spawn, 620);
    const cleaner = window.setInterval(() => {
      const now = Date.now();
      setOrbs((prev) => prev.filter((o) => now - o.bornAt < o.ttl));
      setBursts((prev) => prev.slice(-5));
    }, 250);

    return () => {
      window.clearInterval(spawner);
      window.clearInterval(cleaner);
    };
  }, [active, miniMode]);

  const catchOrb = useCallback((orb: StarOrb, e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    setOrbs((prev) => prev.filter((o) => o.id !== orb.id));
    const bid = idCounter.current++;

    if (orb.kind === 'bomb') {
      setCombo(0);
      setScore((s) => Math.max(0, s - 15));
      setBursts((b) => [...b, { id: bid, x: orb.x, y: orb.y, label: '-15 💥', tone: 'bad' }]);
      return;
    }

    setCombo((prevCombo) => {
      const nextCombo = prevCombo + 1;
      const base = orb.kind === 'astra' ? 25 : 10;
      const gained = base + Math.min(nextCombo - 1, 5) * 5;
      setScore((s) => s + gained);
      setBursts((b) => [
        ...b,
        {
          id: bid,
          x: orb.x,
          y: orb.y,
          label: orb.kind === 'astra' ? `+${gained} 💎 ASTRA!` : `+${gained} ✦`,
          tone: orb.kind === 'astra' ? 'super' : 'good',
        },
      ]);
      return nextCombo;
    });
  }, []);

  const answerMath = (choice: number) => {
    if (choice === mathQ.answer) {
      const nextCombo = combo + 1;
      const pts = 20 + Math.min(nextCombo, 5) * 5;
      setCombo(nextCombo);
      setScore((s) => s + pts);
    } else {
      setCombo(0);
    }
    setMathQ(makeMathChallenge());
  };

  const phaseIndex = Math.min(THINKING_PHASES.length - 1, Math.floor(elapsedMs / 1800));

  if (!isStreaming && !forceOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6 }}
      className="my-3 overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-600/[0.08] via-fuchsia-500/[0.06] to-amber-500/[0.07] shadow-md backdrop-blur-md"
    >
      {/* Top Neural Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-500/20 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <NikAIStarConstellation size={24} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold tracking-tight bg-gradient-to-r from-violet-600 via-pink-600 to-amber-500 bg-clip-text text-transparent">
                {isStreaming ? 'NikAI Astra Thinking…' : 'NikAI Star Reflex Arena'}
              </span>
              {isStreaming && (
                <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-violet-700 dark:text-violet-300">
                  {(elapsedMs / 1000).toFixed(1)}s
                </span>
              )}
              {modelName && (
                <span className="hidden sm:inline rounded-md bg-background/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {modelName}
                </span>
              )}
            </div>
            {isStreaming && (
              <p className="truncate text-[11px] text-muted-foreground">
                {THINKING_PHASES[phaseIndex]}
              </p>
            )}
          </div>
        </div>

        {/* Score + Mode Controls */}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-bold text-foreground shadow-2xs">
            <Zap className="h-3 w-3 text-amber-500" />
            {score}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
            <Trophy className="h-3 w-3 text-amber-500" />
            Best {highScore}
          </span>

          {forceOpen && onCloseManual ? (
            <button
              type="button"
              onClick={onCloseManual}
              className="rounded-lg bg-background/80 px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setGameExpanded((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg bg-background/80 px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
            >
              <Gamepad2 className="h-3.5 w-3.5 text-fuchsia-500" />
              <span>{gameExpanded ? 'Hide Game' : 'Play Mini-Game'}</span>
              {gameExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>

      {/* Liquid Animated Neural Wave Strip */}
      {isStreaming && (
        <div className="relative h-1 w-full overflow-hidden bg-violet-500/15">
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.15, repeat: Infinity, ease: 'linear' }}
            className="h-full w-1/2"
            style={{
              background: 'linear-gradient(90deg, transparent, #7C3AED, #DB2777, #F59E0B, transparent)',
            }}
          />
        </div>
      )}

      {/* Optional Collapsible Deep Reasoning Trace */}
      {thinkingText && (
        <div className="border-b border-violet-500/15 px-3.5 py-2 bg-background/40">
          <button
            type="button"
            onClick={() => setShowReasoning((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300"
          >
            <Sparkles className="h-3 w-3" />
            <span>{showReasoning ? 'Hide Astra Reasoning Chain' : 'Show Live Astra Reasoning Chain'}</span>
          </button>
          {showReasoning && (
            <pre className="mt-1.5 max-h-36 overflow-y-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-muted-foreground font-sans">
              {thinkingText}
            </pre>
          )}
        </div>
      )}

      {/* Interactive Playable Mini-Game Stage */}
      {active && (
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setMiniMode('stars')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                  miniMode === 'stars'
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-2xs'
                    : 'bg-background/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                ✦ Star Catch
              </button>
              <button
                type="button"
                onClick={() => setMiniMode('math')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                  miniMode === 'math'
                    ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-2xs'
                    : 'bg-background/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                ⚡ Brain Blitz
              </button>
            </div>

            {combo >= 2 && (
              <motion.span
                key={combo}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-fuchsia-600 to-amber-500 px-2.5 py-0.5 text-[10.5px] font-extrabold text-white shadow-xs"
              >
                <Flame className="h-3 w-3" />
                {combo}x COMBO!
              </motion.span>
            )}
          </div>

          {miniMode === 'stars' ? (
            <div
              data-testid="nikai-star-game"
              className="relative h-40 w-full select-none overflow-hidden rounded-xl border border-violet-500/20"
              style={{
                background:
                  'radial-gradient(circle at 20% 25%, rgba(124,58,237,0.22), transparent 55%), radial-gradient(circle at 80% 75%, rgba(219,39,119,0.20), transparent 55%), linear-gradient(160deg, #160F29 0%, #1F1438 55%, #2B1747 100%)',
              }}
            >
              {/* Subtle Starfield Hint */}
              <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10.5px] font-medium text-white/55">
                Tap golden stars ✦ (+10) & purple Astra gems 💎 (+25) · Dodge bombs 💥!
              </div>

              <AnimatePresence>
                {orbs.map((orb) => (
                  <motion.button
                    key={orb.id}
                    type="button"
                    aria-label={orb.kind === 'bomb' ? 'Bomb orb' : 'Star orb'}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: [0.92, 1.1, 0.96], opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    onPointerDown={(e) => catchOrb(orb, e)}
                    style={{ left: `${orb.x}%`, top: `${orb.y}%` }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full text-lg shadow-lg active:scale-125 cursor-pointer ${
                      orb.kind === 'astra'
                        ? 'bg-gradient-to-br from-violet-400 via-fuchsia-500 to-pink-500 ring-2 ring-white/70 shadow-fuchsia-500/50'
                        : orb.kind === 'bomb'
                          ? 'bg-rose-950/90 border border-rose-500/60'
                          : 'bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 ring-2 ring-amber-200/70 shadow-amber-400/50'
                    }`}
                  >
                    <span>{orb.kind === 'astra' ? '💎' : orb.kind === 'bomb' ? '💥' : '✦'}</span>
                  </motion.button>
                ))}
              </AnimatePresence>

              {/* Floating Score Popups */}
              {bursts.map((b) => (
                <motion.span
                  key={b.id}
                  initial={{ opacity: 1, y: 0, scale: 0.85 }}
                  animate={{ opacity: 0, y: -26, scale: 1.15 }}
                  transition={{ duration: 0.65 }}
                  style={{ left: `${b.x}%`, top: `${b.y}%` }}
                  className={`pointer-events-none absolute -translate-x-1/2 text-xs font-extrabold ${
                    b.tone === 'super'
                      ? 'text-fuchsia-300'
                      : b.tone === 'bad'
                        ? 'text-rose-400'
                        : 'text-amber-300'
                  }`}
                >
                  {b.label}
                </motion.span>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-violet-500/20 bg-zinc-950/90 p-4 text-white">
              <span className="text-[11px] uppercase tracking-wider text-violet-300/80">
                 Instant Mental Warmup
              </span>
              <div className="my-2 text-2xl font-extrabold tracking-tight text-amber-300">
                {mathQ.question} = ?
              </div>
              <div className="grid w-full max-w-sm grid-cols-4 gap-2">
                {mathQ.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => answerMath(opt)}
                    className="min-h-[42px] rounded-xl border border-white/15 bg-white/10 text-sm font-bold text-white transition-all hover:bg-violet-600 active:scale-95"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
