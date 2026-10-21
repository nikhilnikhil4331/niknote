import { styledWords } from '@/lib/inlineMarks';
import React, { useMemo, useEffect, useState, useRef, memo, forwardRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { NoteLine, LINE_INK_COLORS, generateRealPenVariation } from '@/types/noteLine';
import { NoteSettings } from '@/types/notes';
import {
  HandwritingDNA,
  getDefaultDNA,
} from '@/components/handwriting-dna/HandwritingDNAEngine';

// ============================================================
// HandwritingLine — one written line of a paper page.
//
// Realism notes:
//  - Variation is deterministic *per line and per word* (hashed),
//    so the same word never repeats with identical geometry and two
//    lines never share a rhythm (the old sin(wordIndex) pattern did).
//  - Baseline drift, left-margin drift, word rotation, slight
//    vertical scale and ink bleed are all tiny and restrained.
//  - Structured blocks (headings, lists, equations, callouts, code)
//    render as real document elements, not flat sentences — this is
//    what makes an AI answer read like prepared notes.
// ============================================================

interface HandwritingLineProps {
  line: NoteLine;
  lineIndex: number;
  settings: NoteSettings;
  realPenMode: boolean;
  fontClass: string;
  isNewText?: boolean;
  // Legacy DNA parameters (from analysis) — still supported
  slant?: number;
  penPressure?: number;
  strokeThickness?: number;
  baselineJitterAmount?: number;
  letterSpacingVariation?: number;
  // Full DNA profile from HandwritingDNAEngine v2
  dna?: HandwritingDNA;
}

const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const SERIF = "'Georgia', 'Iowan Old Style', 'Times New Roman', serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

type BlockPresentation = {
  fontSize?: string;
  fontWeight?: number;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  letterSpacing?: string;
  marker?: string;
  textAlign?: 'left' | 'center';
  underline?: boolean;
  uppercase?: boolean;
  marginTop?: number;
  marginBottom?: number;
  padding?: string;
  background?: string;
  border?: string;
  borderLeft?: string;
  borderRadius?: string;
  color?: string;
  hangingIndent?: number;
};

const BLOCK_ALIASES: Record<string, string> = {
  heading1: 'h1',
  heading2: 'h2',
  heading3: 'h3',
  quote: 'callout',
  table: 'table',
};

const BLOCK_STYLE: Record<string, BlockPresentation> = {
  h1: { fontSize: '1.5em', fontWeight: 800, underline: true, marginTop: 6, letterSpacing: '-0.01em' },
  h2: { fontSize: '1.26em', fontWeight: 700, underline: true, marginTop: 4 },
  h3: { fontSize: '1.1em', fontWeight: 700, marginTop: 2 },
  bullet: { marker: '•', hangingIndent: 16 },
  numbered: { hangingIndent: 16 },
  todo: { hangingIndent: 16 },
  equation: {
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: '1.04em',
    letterSpacing: '0.01em',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  code: {
    fontFamily: MONO,
    fontSize: '0.82em',
    letterSpacing: '0',
    padding: '6px 9px',
    background: 'rgba(24, 24, 27, 0.045)',
    border: '1px solid rgba(24, 24, 27, 0.08)',
    borderRadius: '6px',
  },
  callout: {
    borderLeft: '3px solid rgba(16, 122, 87, 0.55)',
    background: 'rgba(16, 122, 87, 0.055)',
    borderRadius: '0 6px 6px 0',
    padding: '4px 8px',
    fontSize: '0.96em',
  },
  divider: {},
};

/** Deterministic 0..1 noise, unique per (line, word, salt). */
function noise(lineIndex: number, wordIndex: number, salt = 1): number {
  let x = Math.imul(lineIndex + 7, 374761393) ^ Math.imul(wordIndex + 13, 668265263) ^ Math.imul(salt, 2654435761);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x = x ^ (x >>> 16);
  return (x >>> 0) / 4294967295;
}

const centered = (n: number) => n * 2 - 1; // -1..1

interface AnimatedWordProps {
  word: string;
  wordIndex: number;
  lineIndex: number;
  wordSpacing: number;
  baselineVariation: number;
  delay: number;
  isNew: boolean;
  letterSpacingVariation: number;
  consistency: number;
  rotationAmount: number;
  verticalScale: number;
  inkOpacity: number;
  bold?: boolean;
  baseWeight: number;
}

const AnimatedWord = memo<AnimatedWordProps>(({
  word,
  wordIndex,
  lineIndex,
  wordSpacing,
  baselineVariation,
  delay,
  isNew,
  letterSpacingVariation,
  consistency,
  rotationAmount,
  verticalScale,
  inkOpacity,
  bold,
  baseWeight,
}) => {
  const reduced = !!useReducedMotion();

  // Per-word, per-line geometry. Higher consistency = calmer writing.
  const variation = useMemo(() => {
    const calm = Math.max(0.25, Math.min(1, 1 - consistency / 130));
    const n1 = centered(noise(lineIndex, wordIndex, 1));
    const n2 = centered(noise(lineIndex, wordIndex, 2));
    const n3 = centered(noise(lineIndex, wordIndex, 3));
    const n4 = noise(lineIndex, wordIndex, 4);
    const n5 = centered(noise(lineIndex, wordIndex, 5));
    const n6 = centered(noise(lineIndex, wordIndex, 6));
    return {
      y: n1 * baselineVariation + n2 * 0.6,
      x: n3 * 0.5,
      rotate: n1 * rotationAmount * calm,
      scaleY: 1 + n2 * 0.035 * calm + (verticalScale - 1),
      // Words are never the same width or size twice: a pen speeds up and
      // slows down, so the size breathes by a couple of percent.
      scaleX: 1 + n3 * 0.022 * calm,
      fontSize: 1 + n5 * 0.018 * calm,
      // Pressure, not weight: a little more ink on one word than the next.
      weight: Math.round(n6 * 46 * calm),
      letterSpacing: letterSpacingVariation > 0 ? n4 * letterSpacingVariation : 0,
      opacity: Math.max(0.82, Math.min(1, inkOpacity - n2 * 0.05 * calm)),
    };
  }, [lineIndex, wordIndex, baselineVariation, rotationAmount, verticalScale, letterSpacingVariation, inkOpacity, consistency]);

  const style: React.CSSProperties = {
    marginRight: `${wordSpacing}px`,
    display: 'inline-block',
    position: 'relative',
    top: `${variation.y.toFixed(2)}px`,
    left: `${variation.x.toFixed(2)}px`,
    transform: `rotate(${variation.rotate.toFixed(3)}deg) scale(${variation.scaleX.toFixed(4)}, ${variation.scaleY.toFixed(4)})`,
    transformOrigin: 'center bottom',
    letterSpacing: variation.letterSpacing ? `${variation.letterSpacing.toFixed(2)}px` : undefined,
    fontSize: `${variation.fontSize.toFixed(4)}em`,
    // Weight only ever nudges the line's own weight — headings stay bold.
    fontWeight: Math.min(900, Math.max(300, (bold ? Math.max(baseWeight, 700) : baseWeight) + (bold ? 0 : variation.weight))),
    opacity: variation.opacity,
    willChange: undefined,
  };

  if (!isNew || reduced) return <span style={style}>{word}</span>;

  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: variation.opacity }}
      transition={{ duration: 0.14, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={style}
    >
      {word}
    </motion.span>
  );
});

AnimatedWord.displayName = 'AnimatedWord';

export const HandwritingLine = memo(forwardRef<HTMLDivElement, HandwritingLineProps>(({
  line,
  lineIndex,
  settings,
  realPenMode,
  fontClass,
  isNewText = false,
  slant: propSlant = 0,
  penPressure: propPenPressure = 0.5,
  strokeThickness: propStrokeThickness = 1,
  baselineJitterAmount: propBaselineJitter = 2,
  letterSpacingVariation: propLetterSpacingVar = 0,
  dna,
}, ref) => {
  const prevTextRef = useRef(line.text);
  const [animatingWords, setAnimatingWords] = useState<Set<number>>(new Set());
  const reduced = !!useReducedMotion();

  useEffect(() => {
    const prevWords = prevTextRef.current.split(' ');
    const currentWords = line.text.split(' ');

    if (line.text !== prevTextRef.current) {
      const newWordIndices = new Set<number>();
      currentWords.forEach((word, index) => {
        if (index >= prevWords.length || word !== prevWords[index]) newWordIndices.add(index);
      });
      prevTextRef.current = line.text;
      if (newWordIndices.size > 0 && !reduced) {
        setAnimatingWords(newWordIndices);
        const timeout = setTimeout(() => setAnimatingWords(new Set()), 480);
        return () => clearTimeout(timeout);
      }
    }
    prevTextRef.current = line.text;
  }, [line.text, reduced]);

  const inkColor = LINE_INK_COLORS.find(c => c.value === line.color);
  const baseHsl = inkColor?.hsl || '220 20% 12%';
  const [h, s, l] = baseHsl.split(' ').map(v => parseFloat(v));
  const variation = generateRealPenVariation(lineIndex, realPenMode);

  // Resolve DNA params: prefer the full DNA profile, fall back to individual props.
  const resolvedDNA = dna || getDefaultDNA();
  const slant = dna ? dna.slant : propSlant;
  const penPressure = dna ? dna.penPressure : propPenPressure;
  const strokeThickness = dna ? dna.strokeThickness : propStrokeThickness;
  const baselineJitterAmount = dna ? dna.baselineDrift : propBaselineJitter;
  const letterSpacingVariation = dna ? dna.letterSpacing : propLetterSpacingVar;
  const consistency = resolvedDNA.consistency ?? 70;
  const rotationAmount = 0.35 + (100 - consistency) * 0.012;

  const rawBlock = line.blockType && line.blockType !== 'text' ? line.blockType : undefined;
  const block = rawBlock ? (BLOCK_ALIASES[rawBlock] ?? rawBlock) : undefined;
  const presentation = block ? BLOCK_STYLE[block] : undefined;
  // The editor already prefixes list markers / icons into the text; never
  // print a second bullet in front of the writer's own.
  const textHasMarker = /^(?:[•☐☑▸▪·]|\d+[.)])\s+/.test(String(line.text ?? '').trimStart());
  const showMarker = !!presentation?.marker && !textHasMarker;

  // A page of handwriting drifts: margins wander a pixel or two, lines
  // slowly descend, and the whole block leans with the writer's slant.
  const lineNoise = useMemo(() => ({
    margin: centered(noise(lineIndex, 0, 11)) * 1.6,
    descend: lineIndex * 0.12,
    baseline: centered(noise(lineIndex, 0, 12)) * (baselineJitterAmount * 0.45),
  }), [lineIndex, baselineJitterAmount]);

  const lineStyle = useMemo<React.CSSProperties>(() => {
    const skewDeg = slant ? -slant * 0.5 : 0;
    const pressureWeight = Math.round(300 + penPressure * 400);
    const textStrokeWidth = strokeThickness > 1.5 ? `${(strokeThickness - 1) * 0.3}px` : undefined;

    const ink = realPenMode
      ? {
        color: `hsl(${h + variation.hueShift} ${s}% ${Math.max(10, Math.min(50, l + (variation.thickness - 1) * 20))}%)`,
        opacity: variation.opacity,
      }
      : { color: `hsl(${baseHsl})`, opacity: 1 };

    return {
      ...ink,
      marginLeft: `${(lineNoise.margin).toFixed(2)}px`,
      transform: `translateY(${(lineNoise.baseline + lineNoise.descend).toFixed(2)}px)${skewDeg ? ` skewX(${skewDeg}deg)` : ''}`,
      fontWeight: Math.max(pressureWeight, presentation?.fontWeight ?? 0),
      WebkitTextStroke: textStrokeWidth ? `${textStrokeWidth} currentColor` : undefined,
      // A hair of ink spread — restrained, never a glow.
      textShadow: realPenMode ? '0 0 0.35px currentColor' : undefined,
    };
  }, [realPenMode, h, s, l, baseHsl, variation, slant, penPressure, strokeThickness, lineNoise, presentation?.fontWeight]);

  const visualLines = useMemo(() => String(line.text ?? '').split(/\r?\n/), [line.text]);

  const baselineVariation = dna
    ? Math.max(0.6, dna.baselineDrift * 0.55)
    : (settings.baselineJitter ? Math.max(0.8, baselineJitterAmount * 0.5) : 0);

  const lineHeightPx = Math.max(24, Math.round(settings.lineSpacing || 32));
  const presentationSize = presentation?.fontSize ? parseFloat(presentation.fontSize) : 1;
  const effectiveFontSize = line.fontSize ?? settings.fontSize * (Number.isFinite(presentationSize) ? presentationSize : 1);
  // Headings are allowed to be taller than a rule; body lines stay on the rule.
  const lineBoxPx = Math.max(lineHeightPx, Math.round(effectiveFontSize * 1.42));
  // The weight the whole line is written at; each word then breathes around it.
  const authoredWeight = typeof line.fontWeight === 'number' ? line.fontWeight : 0;
  const baseWeight = Math.max(
    Math.round(300 + penPressure * 400),
    authoredWeight,
    presentation?.fontWeight ?? 0,
  );

  const wrapperStyle: React.CSSProperties = {
    display: 'block',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    ...lineStyle,
    ...(line.fontSize ? { fontSize: `${line.fontSize}px` } : {}),
    ...(line.fontWeight ? { fontWeight: line.fontWeight } : {}),
    ...(presentation?.fontSize && !line.fontSize
      ? { fontSize: `calc(${settings.fontSize}px * ${presentation.fontSize.replace('em', '')})` }
      : {}),
    ...(presentation?.fontFamily ? { fontFamily: presentation.fontFamily } : {}),
    ...(presentation?.fontStyle ? { fontStyle: presentation.fontStyle } : {}),
    ...(presentation?.letterSpacing ? { letterSpacing: presentation.letterSpacing } : {}),
    ...(presentation?.textAlign ? { textAlign: presentation.textAlign } : {}),
    ...(presentation?.padding ? { padding: presentation.padding } : {}),
    ...(presentation?.background ? { background: presentation.background } : {}),
    ...(presentation?.border ? { border: presentation.border } : {}),
    ...(presentation?.borderLeft ? { borderLeft: presentation.borderLeft } : {}),
    ...(presentation?.borderRadius ? { borderRadius: presentation.borderRadius } : {}),
    ...(presentation?.marginTop ? { marginTop: `${presentation.marginTop}px` } : {}),
    ...(presentation?.marginBottom ? { marginBottom: `${presentation.marginBottom}px` } : {}),
    ...(presentation?.hangingIndent
      ? {
        paddingLeft: `${presentation.hangingIndent + (line.indent ?? 0) * 16}px`,
        textIndent: showMarker ? `-${presentation.hangingIndent}px` : undefined,
      }
      : line.indent ? { paddingLeft: `${line.indent * 20}px` } : {}),
  };

  const visualLineStyle: React.CSSProperties = {
    display: 'block',
    minHeight: `${lineBoxPx}px`,
    lineHeight: `${lineBoxPx}px`,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    paddingBottom: '1px',
  };

  // ---- non-prose document elements --------------------------------
  if (block === 'divider') {
    return (
      <div ref={ref} className={fontClass} style={{ minHeight: `${lineHeightPx}px`, display: 'flex', alignItems: 'center' }}>
        <span
          aria-hidden="true"
          style={{
            display: 'block',
            width: '100%',
            height: 1,
            background: `hsl(${baseHsl} / 0.28)`,
            transform: 'rotate(-0.12deg)',
          }}
        />
      </div>
    );
  }

  if (line.text === '') {
    return (
      <div ref={ref} className={fontClass} style={{ ...wrapperStyle, ...visualLineStyle }}>
        <span className="opacity-0 select-none">&nbsp;</span>
      </div>
    );
  }

  // Code is not handwritten on real notes — keep it legible.
  if (block === 'code') {
    return (
      <div ref={ref} className={fontClass} style={{ ...wrapperStyle, minHeight: `${lineHeightPx}px` }}>
        <pre style={{ margin: 0, fontFamily: MONO, fontSize: `${settings.fontSize * 0.7}px`, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
          {line.text}
        </pre>
      </div>
    );
  }

  const words = visualLines[0] ? styledWords(visualLines[0]) : [];

  return (
    <div ref={ref} className={fontClass} style={wrapperStyle}>
      {visualLines.map((textLine, vIndex) => {
        const styled = vIndex === 0 ? words : styledWords(textLine);
        const lineWords = styled.map(w => w.text);
        const baseDelay = vIndex * 0.02;
        const headingUnderline = presentation?.underline && vIndex === visualLines.length - 1;

        return (
          <div
            key={`${line.id}-vline-${vIndex}`}
            style={{
              ...visualLineStyle,
              ...(headingUnderline
                ? {
                  textDecoration: 'underline',
                  textDecorationThickness: '1.5px',
                  textUnderlineOffset: '4px',
                  textDecorationColor: `hsl(${baseHsl} / 0.3)`,
                }
                : {}),
            }}
          >
            {textLine === '' ? (
              <span className="opacity-0 select-none">&nbsp;</span>
            ) : (
              <>
                {showMarker && vIndex === 0 && (
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: presentation.hangingIndent ?? 16,
                      opacity: 0.85,
                      fontWeight: 600,
                    }}
                  >
                    {presentation.marker}
                  </span>
                )}
                {lineWords.map((word, wordIndex) => (
                  <React.Fragment key={`${vIndex}-${wordIndex}-${word}`}>
                    <span
                      style={{
                        fontStyle: styled[wordIndex]?.italic ? 'italic' : undefined,
                      }}
                    >
                    <AnimatedWord
                      bold={styled[wordIndex]?.bold}
                      baseWeight={baseWeight}
                      word={word}
                      wordIndex={wordIndex}
                      lineIndex={lineIndex}
                      wordSpacing={0}
                      baselineVariation={baselineVariation}
                      delay={baseDelay + wordIndex * 0.03}
                      isNew={isNewText || animatingWords.has(wordIndex)}
                      letterSpacingVariation={letterSpacingVariation}
                      consistency={consistency}
                      rotationAmount={rotationAmount}
                      verticalScale={1 + (100 - consistency) * 0.0002}
                      inkOpacity={realPenMode ? variation.opacity : 1}
                    />
                    </span>
                    {wordIndex < lineWords.length - 1 && (
                      <span
                        style={{
                          // Word gaps breathe a little instead of being uniform.
                          marginRight: `${((dna ? dna.wordSpacing : settings.wordSpacing) || 4) + centered(noise(lineIndex, wordIndex, 21)) * 0.9}px`,
                        }}
                      >
                        {' '}
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}));

HandwritingLine.displayName = 'HandwritingLine';
