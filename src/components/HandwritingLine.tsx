import React, { useMemo, useEffect, useState, useRef, memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { NoteLine, LINE_INK_COLORS, generateRealPenVariation } from '@/types/noteLine';
import { NoteSettings } from '@/types/notes';
import {
  HandwritingDNA,
  getDefaultDNA,
  generateLineVariation,
  generateWordVariation,
} from '@/components/handwriting-dna/HandwritingDNAEngine';

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
  // NEW: Full DNA profile from HandwritingDNAEngine v2
  dna?: HandwritingDNA;
}

interface AnimatedWordProps {
  word: string;
  wordIndex: number;
  wordSpacing: number;
  baselineVariation: number;
  delay: number;
  isNew: boolean;
  letterSpacingVariation: number;
  // DNA v2 per-word variation
  wordCSS?: React.CSSProperties;
}

const AnimatedWord = memo<AnimatedWordProps>(({
  word, wordIndex, wordSpacing, baselineVariation, delay, isNew, letterSpacingVariation, wordCSS,
}) => {
  const yOffset = useMemo(() => {
    return Math.sin(wordIndex * 3.7) * baselineVariation;
  }, [wordIndex, baselineVariation]);

  // Per-character letter spacing variation
  const letterStyle = useMemo(() => {
    if (letterSpacingVariation <= 0) return undefined;
    return { letterSpacing: `${(Math.sin(wordIndex * 5.3) * letterSpacingVariation).toFixed(2)}px` };
  }, [wordIndex, letterSpacingVariation]);

  // Merge DNA word CSS with existing styles
  const mergedStyle: React.CSSProperties = {
    marginRight: `${wordSpacing}px`,
    display: 'inline',
    position: 'relative' as const,
    top: `${yOffset}px`,
    ...letterStyle,
    ...(wordCSS || {}),
  };

  // If wordCSS provides its own top, override the default jitter
  if (wordCSS?.top !== undefined) {
    mergedStyle.top = wordCSS.top;
  }

  if (!isNew) {
    return (
      <span style={mergedStyle}>
        {word}
      </span>
    );
  }

  return (
    <motion.span
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: yOffset }}
      transition={{ duration: 0.15, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        marginRight: `${wordSpacing}px`,
        display: 'inline',
        position: 'relative',
        ...letterStyle,
        ...(wordCSS || {}),
      }}
    >
      {word.split('').map((char, charIndex) => (
        <motion.span
          key={charIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.08, delay: delay + charIndex * 0.025, ease: 'easeOut' }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
});

AnimatedWord.displayName = 'AnimatedWord';

export const HandwritingLine = memo(forwardRef<HTMLDivElement, HandwritingLineProps>(({
  line, lineIndex, settings, realPenMode, fontClass, isNewText = false,
  slant: propSlant = 0, penPressure: propPenPressure = 0.5, strokeThickness: propStrokeThickness = 1,
  baselineJitterAmount: propBaselineJitter = 2, letterSpacingVariation: propLetterSpacingVar = 0,
  dna,
}, ref) => {
  const prevTextRef = useRef(line.text);
  const [animatingWords, setAnimatingWords] = useState<Set<number>>(new Set());

  useEffect(() => {
    const prevWords = prevTextRef.current.split(' ');
    const currentWords = line.text.split(' ');

    if (line.text !== prevTextRef.current) {
      const newWordIndices = new Set<number>();
      currentWords.forEach((word, index) => {
        if (index >= prevWords.length || word !== prevWords[index]) {
          newWordIndices.add(index);
        }
      });

      if (newWordIndices.size > 0) {
        setAnimatingWords(newWordIndices);
        const timeout = setTimeout(() => setAnimatingWords(new Set()), 500);
        prevTextRef.current = line.text;
        return () => clearTimeout(timeout);
      }
    }

    prevTextRef.current = line.text;
  }, [line.text]);

  const inkColor = LINE_INK_COLORS.find(c => c.value === line.color);
  const baseHsl = inkColor?.hsl || '220 20% 12%';
  const [h, s, l] = baseHsl.split(' ').map(v => parseFloat(v));
  const variation = generateRealPenVariation(lineIndex, realPenMode);

  // Resolve DNA params: prefer full DNA profile, fall back to individual props
  const resolvedDNA = dna || getDefaultDNA();
  const slant = dna ? dna.slant : propSlant;
  const penPressure = dna ? dna.penPressure : propPenPressure;
  const strokeThickness = dna ? dna.strokeThickness : propStrokeThickness;
  const baselineJitterAmount = dna ? dna.baselineDrift : propBaselineJitter;
  const letterSpacingVariation = dna ? dna.letterSpacing : propLetterSpacingVar;

  // Generate DNA-powered line variation (v2)
  const dnaLineCSS = useMemo(() => {
    if (dna) {
      return generateLineVariation(dna, lineIndex);
    }
    return undefined;
  }, [dna, lineIndex]);

  const lineStyle = useMemo(() => {
    // Baseline jitter with configurable amount
    const effectiveJitterAmount = settings.baselineJitter ? baselineJitterAmount : 0;
    const jitterX = effectiveJitterAmount > 0 ? (Math.sin(lineIndex * 7) * effectiveJitterAmount) : 0;

    // Slant transform (CSS skewX — negative slant = right lean visually)
    const skewDeg = slant ? -slant * 0.5 : 0;

    // Pressure-based font weight: light pressure = 300, heavy = 700
    const pressureWeight = Math.round(300 + penPressure * 400);

    // Stroke thickness affects text-stroke (webkit) for extra weight
    const textStrokeWidth = strokeThickness > 1.5 ? `${(strokeThickness - 1) * 0.3}px` : undefined;

    // Base style from legacy calculation
    const baseStyle = realPenMode ? (() => {
      const adjustedH = h + variation.hueShift;
      const adjustedL = Math.max(10, Math.min(50, l + (variation.thickness - 1) * 20));
      return {
        color: `hsl(${adjustedH} ${s}% ${adjustedL}%)`,
        opacity: variation.opacity,
        fontWeight: Math.max(pressureWeight, variation.thickness > 1 ? 500 : 400) as number,
        marginLeft: `${jitterX}px`,
        transform: skewDeg !== 0 ? `skewX(${skewDeg}deg)` : undefined,
        WebkitTextStroke: textStrokeWidth ? `${textStrokeWidth} currentColor` : undefined,
      };
    })() : {
      color: `hsl(${baseHsl})`,
      marginLeft: `${jitterX}px`,
      fontWeight: pressureWeight as number,
      transform: skewDeg !== 0 ? `skewX(${skewDeg}deg)` : undefined,
      WebkitTextStroke: textStrokeWidth ? `${textStrokeWidth} currentColor` : undefined,
    };

    // Merge DNA line variation if available (v2)
    if (dnaLineCSS) {
      return {
        ...baseStyle,
        ...dnaLineCSS,
        // Preserve color from baseStyle (DNA doesn't control ink color)
        color: baseStyle.color,
      };
    }

    return baseStyle;
  }, [lineIndex, settings.baselineJitter, realPenMode, h, s, l, baseHsl, variation, slant, penPressure, strokeThickness, baselineJitterAmount, dnaLineCSS]);

  const visualLines = useMemo(() => {
    return String(line.text ?? '').split(/\r?\n/);
  }, [line.text]);

  // Use DNA-driven baseline variation when available
  const baselineVariation = dna
    ? (dna.baselineDrift * 0.75)
    : (settings.baselineJitter ? Math.max(1.5, baselineJitterAmount * 0.75) : 0);

  const wrapperStyle: React.CSSProperties = {
    display: 'block',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    ...lineStyle,
    // Block type styling from editor (headings, etc.)
    ...(line.fontSize ? { fontSize: `${line.fontSize}px` } : {}),
    ...(line.fontWeight ? { fontWeight: line.fontWeight } : {}),
    ...(line.indent ? { paddingLeft: `${line.indent * 20}px` } : {}),
  };

  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
  const effectiveLineHeightPx = isMobileViewport ? 48 : settings.lineSpacing;

  const visualLineStyle: React.CSSProperties = {
    display: 'block',
    minHeight: `${effectiveLineHeightPx}px`,
    lineHeight: `${effectiveLineHeightPx}px`,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  if (line.text === '') {
    return (
      <div ref={ref} className={fontClass} style={{ ...wrapperStyle, ...visualLineStyle }}>
        <span className="opacity-0 select-none">&nbsp;</span>
      </div>
    );
  }

  return (
    <div ref={ref} className={fontClass} style={wrapperStyle}>
      {visualLines.map((textLine, vIndex) => {
        const styled = styledWords(textLine);
        const words = styled.map(w => w.text);
        const baseDelay = vIndex * 0.02;

        return (
          <div key={`${line.id}-vline-${vIndex}`} style={visualLineStyle}>
            {textLine === '' ? (
              <span className="opacity-0 select-none">&nbsp;</span>
            ) : (
              words.map((word, wordIndex) => (
                <React.Fragment key={`${vIndex}-${wordIndex}-${word}`}>
                  <span style={{ fontWeight: styled[wordIndex].bold ? 700 : undefined, fontStyle: styled[wordIndex].italic ? 'italic' : undefined }}>
                  <AnimatedWord
                    word={word}
                    wordIndex={wordIndex}
                    wordSpacing={0}
                    baselineVariation={baselineVariation}
                    delay={baseDelay + wordIndex * 0.03}
                    isNew={isNewText || animatingWords.has(wordIndex)}
                    letterSpacingVariation={letterSpacingVariation}
                    wordCSS={dna ? generateWordVariation(dna, lineIndex, wordIndex) : undefined}
                  />
                  </span>

                  {wordIndex < words.length - 1 && (
                    <span style={{ marginRight: `${dna ? dna.wordSpacing : settings.wordSpacing}px` }}> </span>
                  )}
                </React.Fragment>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}));

HandwritingLine.displayName = 'HandwritingLine';
