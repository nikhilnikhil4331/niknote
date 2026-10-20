import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown, ChevronUp, Flame, Gamepad2, Sparkles, Trophy, Zap } from 'lucide-react';

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
  'Reading your note context…',
  'Working through the answer…',
  'Structuring headings, bullets & steps…',
  'Polishing the final draft…',
];

/**
 * NikAI Thinking Arena — minimal light companion panel.
 * While NikAI generates, the NikAI mark gently "pops" (the real brand
 * asset, never a redraw) and the phase + elapsed time stay honest.
 * The mini-game is a small, real-score distraction — collapsed by
 * default so the panel never competes with the answer.
 */
export const NikAIThinkingArena: React.FC<NikAIThinkingArenaProps> = ({
  isStreaming,
  thinkingText,
  modelName,
  forceOpen = false,
  onCloseManual,
}) => {
  const reducedMotion = useReducedMotion();
  const [miniMode, setMiniMode] = useState<'stars' | 'math'>('stars');
  const [gameExpanded, setGameExpanded] = useState(false); // collapsed by default
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
  const active = gameExpanded && (isStreaming || forceOpen);

  // Elapsed live timer while streaming
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

  // Spawn interactive orbs while the game is open
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
      setBursts((b) => [...b, { id: bid, x: orb.x, y: orb.y, label: '−15', tone: 'bad' }]);
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
          label: `+${gained}`,
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

  const phaseIndex = Math.min(THINKING_PHASES.length - 1, Math.floor(elapsedMs / 2200));

  if (!isStreaming && !forceOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="my-3 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
    >
      {/* Header — logo pop + honest status */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* The real NikAI mark, gently popping while generating */}
          <div className={`h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg ${isStreaming && !reducedMotion ? 'nn-nikai-pop' : ''}`}>
            <motion.img
              src="/nikai-mark.png"
              alt="NikAI"
              draggable={false}
              className="h-full w-full object-contain p-0.5"
              animate={
                isStreaming && !reducedMotion
                  ? { scale: [1, 1.08, 1] }
                  : { scale: 1 }
              }
              transition={
                isStreaming && !reducedMotion
                  ? { duration: 1.15, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 0.2 }
              }
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                {isStreaming ? 'NikAI is writing…' : 'NikAI mini-game'}
              </span>
              {isStreaming && (
                <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                  {(elapsedMs / 1000).toFixed(1)}s
                </span>
              )}
              {modelName && (
                <span className="hidden sm:inline rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
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

        {/* Real score + controls */}
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground">
            <Zap className="h-3 w-3 text-amber-500" />
            {score}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            <Trophy className="h-3 w-3 text-amber-500" />
            Best {highScore}
          </span>

          <button
            type="button"
            onClick={() => setGameExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-muted/70"
          >
            <Gamepad2 className="h-3.5 w-3.5 text-primary" />
            <span>{gameExpanded ? 'Hide game' : 'Play'}</span>
            {gameExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {forceOpen && onCloseManual && (
            <button
              type="button"
              onClick={onCloseManual}
              className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
            >
              Done
            </button>
          )}
        </div>
      </div>

      {/* Progress hairline while streaming */}
      {isStreaming && (
        <div className="h-0.5 w-full overflow-hidden bg-muted/60">
          <motion.div
            animate={reducedMotion ? { width: '40%' } : { x: ['-100%', '200%'] }}
            transition={reducedMotion ? { duration: 0.3 } : { duration: 1.4, repeat: Infinity, ease: 'linear' }}
            className="h-full w-1/2 bg-primary/70"
          />
        </div>
      )}

      {/* Optional collapsible reasoning trace */}
      {thinkingText && (
        <div className="border-t border-border/50 px-3.5 py-2">
          <button
            type="button"
            onClick={() => setShowReasoning((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="h-3 w-3" />
            <span>{showReasoning ? 'Hide reasoning' : 'Show reasoning'}</span>
          </button>
          {showReasoning && (
            <pre className="mt-1.5 max-h-36 overflow-y-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-muted-foreground font-sans">
              {thinkingText}
            </pre>
          )}
        </div>
      )}

      {/* Mini-game — minimal light stage, collapsed by default */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMiniMode('stars')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      miniMode === 'stars' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Star catch
                  </button>
                  <button
                    type="button"
                    onClick={() => setMiniMode('math')}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      miniMode === 'math' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Brain blitz
                  </button>
                </div>

                {combo >= 2 && (
                  <motion.span
                    key={combo}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-700"
                  >
                    <Flame className="h-3 w-3" />
                    {combo}× combo
                  </motion.span>
                )}
              </div>

              {miniMode === 'stars' ? (
                <div
                  data-testid="nikai-star-game"
                  className="relative h-40 w-full select-none overflow-hidden rounded-xl border border-border/60 bg-muted/30"
                >
                  <div className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[10.5px] font-medium text-muted-foreground">
                    Catch ✦ +10 · ◆ +25 · avoid the bomb −15
                  </div>

                  <AnimatePresence>
                    {orbs.map((orb) => (
                      <motion.button
                        key={orb.id}
                        type="button"
                        aria-label={orb.kind === 'bomb' ? 'Bomb orb' : 'Star orb'}
                        initial={reducedMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }}
                        animate={reducedMotion ? { opacity: 1 } : { scale: [0.92, 1.08, 0.98], opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.35 }}
                        onPointerDown={(e) => catchOrb(orb, e)}
                        style={{ left: `${orb.x}%`, top: `${orb.y}%` }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full text-lg shadow-sm active:scale-125 cursor-pointer ${
                          orb.kind === 'astra'
                            ? 'bg-violet-100 text-violet-700 ring-2 ring-violet-300'
                            : orb.kind === 'bomb'
                              ? 'bg-rose-100 text-rose-700 ring-2 ring-rose-300'
                              : 'bg-amber-100 text-amber-600 ring-2 ring-amber-300'
                        }`}
                      >
                        <span>{orb.kind === 'astra' ? '◆' : orb.kind === 'bomb' ? '✕' : '✦'}</span>
                      </motion.button>
                    ))}
                  </AnimatePresence>

                  {/* Floating score popups */}
                  {bursts.map((b) => (
                    <motion.span
                      key={b.id}
                      initial={{ opacity: 1, y: 0, scale: 0.9 }}
                      animate={{ opacity: 0, y: -22, scale: 1.1 }}
                      transition={{ duration: 0.6 }}
                      style={{ left: `${b.x}%`, top: `${b.y}%` }}
                      className={`pointer-events-none absolute -translate-x-1/2 text-xs font-bold ${
                        b.tone === 'super' ? 'text-violet-600' : b.tone === 'bad' ? 'text-rose-500' : 'text-amber-600'
                      }`}
                    >
                      {b.label}
                    </motion.span>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-border/60 bg-muted/20 p-4">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Quick mental warmup
                  </span>
                  <div className="my-2 text-2xl font-bold tracking-tight text-foreground">
                    {mathQ.question} = ?
                  </div>
                  <div className="grid w-full max-w-sm grid-cols-4 gap-2">
                    {mathQ.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => answerMath(opt)}
                        className="min-h-[42px] rounded-xl border border-border/70 bg-background text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-95"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
