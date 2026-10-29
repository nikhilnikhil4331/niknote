// ============================================================
// NikNote — timer completion chime (Web Audio, no assets).
// Sound is strictly opt-out via the timer settings and only ever
// plays after a user gesture (start), so browser autoplay rules
// are respected. Everything fails silently when AudioContext is
// unavailable (SSR, tests, restricted iframes).
// ============================================================

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = typeof window !== 'undefined' ? (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Called from a click handler to unlock audio early. */
export function primeAudio() {
  audioCtx();
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, peak = 0.16) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

/** Soft two-tone completion chime (≈0.9s). */
export function playCompletionChime(enabled: boolean) {
  if (!enabled) return;
  const ac = audioCtx();
  if (!ac) return;
  try {
    const t = ac.currentTime;
    tone(ac, 659.25, t, 0.32);          // E5
    tone(ac, 880.0, t + 0.16, 0.36);    // A5
    tone(ac, 1174.66, t + 0.34, 0.55, 0.12); // D6 tail
  } catch {
    /* silent */
  }
}

/** Short single tick for lap/stop feedback. */
export function playTick(enabled: boolean) {
  if (!enabled) return;
  const ac = audioCtx();
  if (!ac) return;
  try {
    tone(ac, 987.77, ac.currentTime, 0.12, 0.08); // B5 blip
  } catch {
    /* silent */
  }
}
