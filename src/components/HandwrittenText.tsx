import React, { useMemo, memo } from 'react';
import { NoteSettings, FONT_OPTIONS, DiagramImage } from '@/types/notes';
// Deterministic pencil noise: the same word must not jump every re-render.
function noise(seed: number): number {
  let x = Math.imul(seed ^ 0x9e3779b9, 2654435761);
  x = Math.imul(x ^ (x >>> 15), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}

interface HandwrittenTextProps {
  text: string;
  settings: NoteSettings;
  pageNumber?: number;
  totalPages?: number;
  tableData?: string[][];
  diagrams?: DiagramImage[];
  // Handwriting DNA parameters
  slant?: number;
  penPressure?: number;
  strokeThickness?: number;
  baselineJitterAmount?: number;
  letterSpacingVariation?: number;
}

const HandwrittenWord = memo(({ 
  word, settings, index, letterSpacingVariation = 0,
}: { 
  word: string; settings: NoteSettings; index: number; letterSpacingVariation?: number;
}) => {
  const style = useMemo(() => {
    const seed = (index + 1) * 7919 + word.length * 104729;
    const jitterX = settings.baselineJitter ? (noise(seed) - 0.5) : 0;
    const jitterY = settings.baselineJitter ? (noise(seed + 1) - 0.5) * 2 : 0;
    const rotation = settings.strokeRandomness ? (noise(seed + 2) - 0.5) * 0.5 : 0;
    const opacity = settings.strokeRandomness ? 1 - noise(seed + 3) * 0.08 : 1;
    const extraSpacing = settings.strokeRandomness ? (noise(seed + 4) - 0.5) * 3 : 0;
    const letterSpace = letterSpacingVariation > 0 
      ? `${(Math.sin(index * 5.3) * letterSpacingVariation).toFixed(2)}px` 
      : undefined;

    return {
      transform: `translate(${jitterX}px, ${jitterY}px) rotate(${rotation}deg)`,
      opacity,
      marginRight: `${settings.wordSpacing + extraSpacing}px`,
      display: 'inline-block',
      letterSpacing: letterSpace,
    };
  }, [word, settings.baselineJitter, settings.strokeRandomness, settings.wordSpacing, index, letterSpacingVariation]);

  return <span style={style}>{word}</span>;
});

HandwrittenWord.displayName = 'HandwrittenWord';

const HandwrittenLine = memo(({ 
  line, settings, lineIndex, slant = 0, penPressure = 0.5, strokeThickness = 1, letterSpacingVariation = 0,
}: { 
  line: string; settings: NoteSettings; lineIndex: number;
  slant?: number; penPressure?: number; strokeThickness?: number; letterSpacingVariation?: number;
}) => {
  const words = line.split(' ');
  const lineJitter = settings.baselineJitter ? (noise(lineIndex * 104729 + 13) - 0.5) * 2 : 0;
  
  const skewDeg = slant ? -slant * 0.5 : 0;
  const pressureWeight = Math.round(300 + penPressure * 400);
  const textStrokeWidth = strokeThickness > 1.5 ? `${(strokeThickness - 1) * 0.3}px` : undefined;

  return (
    <div 
      style={{ 
        display: 'block',
        minHeight: `${settings.lineSpacing}px`,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        wordBreak: 'break-word',
        transform: `translateY(${lineJitter}px)${skewDeg !== 0 ? ` skewX(${skewDeg}deg)` : ''}`,
        fontWeight: pressureWeight,
        WebkitTextStroke: textStrokeWidth ? `${textStrokeWidth} currentColor` : undefined,
      }}
    >
      {words.map((word, wordIndex) => (
        <HandwrittenWord 
          key={`${lineIndex}-${wordIndex}`} 
          word={word} 
          settings={settings} 
          index={wordIndex} 
          letterSpacingVariation={letterSpacingVariation}
        />
      ))}
    </div>
  );
});

HandwrittenLine.displayName = 'HandwrittenLine';

export const HandwrittenText: React.FC<HandwrittenTextProps> = ({
  text, settings, pageNumber, totalPages, tableData, diagrams,
  slant = 0, penPressure = 0.5, strokeThickness = 1, baselineJitterAmount = 2, letterSpacingVariation = 0,
}) => {
  const fontClass = FONT_OPTIONS.find(f => f.value === settings.font)?.className || 'font-handwriting-1';
  const inkClass = `ink-${settings.inkColor}`;
  const pageStyleClass = `paper-${settings.pageStyle}`;
  const lines = text.split('\n');

  const paperStyle = useMemo<React.CSSProperties>(() => {
    switch (settings.pageStyle) {
      case 'ruled':
        return {
          backgroundColor: 'hsl(var(--paper-ruled))',
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, hsl(var(--line-color)) 31px, hsl(var(--line-color)) 32px)',
          backgroundPosition: '0 0',
        };
      case 'single-line':
        return {
          backgroundColor: 'hsl(var(--paper))',
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 47px, hsl(var(--line-color)) 47px, hsl(var(--line-color)) 48px)',
          backgroundPosition: '0 0',
        };
      case 'graph':
        return {
          backgroundColor: 'hsl(var(--paper))',
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, hsl(var(--line-color) / 0.5) 19px, hsl(var(--line-color) / 0.5) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, hsl(var(--line-color) / 0.5) 19px, hsl(var(--line-color) / 0.5) 20px)',
          backgroundPosition: '0 0',
        };
      case 'dotted':
        return {
          backgroundColor: 'hsl(var(--paper))',
          backgroundImage: 'radial-gradient(circle, hsl(var(--line-color)) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        };
      case 'college':
        return {
          backgroundColor: 'hsl(var(--paper-ruled))',
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 23px, hsl(var(--line-color)) 23px, hsl(var(--line-color)) 24px)',
          backgroundPosition: '0 0',
        };
      case 'legal':
        return {
          backgroundColor: 'hsl(50 80% 88%)',
          backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, hsl(210 40% 70%) 31px, hsl(210 40% 70%) 32px)',
          backgroundPosition: '0 0',
        };
      case 'plain':
      default:
        return { backgroundColor: 'hsl(var(--paper))' };
    }
  }, [settings.pageStyle]);

  return (
    <div 
      className={`w-full aspect-[210/297] ${pageStyleClass} paper-shadow relative overflow-hidden`}
      style={{
        ...paperStyle,
        color: `hsl(var(--ink-${settings.inkColor}))`,
        paddingTop: `${settings.margins.top}px`,
        paddingRight: `${settings.margins.right}px`,
        paddingBottom: `${settings.margins.bottom}px`,
        paddingLeft: `${settings.margins.left}px`,
      }}
    >
      {settings.headerFooter.showHeader && (
        <div className={`${fontClass} ${inkClass} text-sm mb-4 flex justify-between`} style={{ fontSize: settings.fontSize * 0.6 }}>
          {settings.headerFooter.name && <span>Name: {settings.headerFooter.name}</span>}
          {settings.headerFooter.rollNo && <span>Roll No: {settings.headerFooter.rollNo}</span>}
          {settings.headerFooter.subject && <span>Subject: {settings.headerFooter.subject}</span>}
        </div>
      )}

      {diagrams && diagrams.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 justify-center">
          {diagrams.map((diagram) => (
            <img key={diagram.id} src={diagram.src} alt={diagram.name} className="max-w-full h-auto rounded" style={{ maxHeight: '150px' }} />
          ))}
        </div>
      )}

      {settings.table.enabled && tableData && tableData.length > 0 && (
        <div className="mb-4 overflow-x-auto">
          <table className={`w-full ${fontClass} ${inkClass} ${settings.table.showBorders ? 'border border-current' : ''}`} style={{ fontSize: `${settings.fontSize * 0.8}px` }}>
            <tbody>
              {tableData.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex === 0 && settings.table.headerRow ? 'font-bold' : ''}>
                  {row.map((cell, colIndex) => (
                    <td key={colIndex} className={`p-2 text-center ${settings.table.showBorders ? 'border border-current' : ''}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div 
        className={`${fontClass} ${inkClass} leading-relaxed`} 
        style={{ fontSize: `${settings.fontSize}px`, display: 'flex', flexDirection: 'column', gap: 0 }}
      >
        {lines.map((line, index) => (
          <HandwrittenLine 
            key={index} 
            line={line} 
            settings={settings} 
            lineIndex={index}
            slant={slant}
            penPressure={penPressure}
            strokeThickness={strokeThickness}
            letterSpacingVariation={letterSpacingVariation}
          />
        ))}
      </div>

      {(settings.headerFooter.showFooter || settings.headerFooter.showPageNumber) && (
        <div className={`absolute bottom-4 left-0 right-0 ${fontClass} ${inkClass} text-center`} style={{ fontSize: settings.fontSize * 0.5, paddingLeft: settings.margins.left, paddingRight: settings.margins.right }}>
          {settings.headerFooter.showPageNumber && pageNumber && totalPages && <span>Page {pageNumber} of {totalPages}</span>}
        </div>
      )}
    </div>
  );
};
