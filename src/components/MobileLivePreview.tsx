 import React, { useEffect, useRef, useMemo } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
 import { NoteLine, LINE_INK_COLORS, generateRealPenVariation } from '@/types/noteLine';
 import { NoteSettings, FONT_OPTIONS } from '@/types/notes';
 import { Eye, ChevronUp, ChevronDown } from 'lucide-react';
 import { cn } from '@/lib/utils';

interface MobileLivePreviewProps {
  lines: NoteLine[];
  settings: NoteSettings;
  realPenMode: boolean;
  isVisible: boolean;
  onToggle: () => void;
  isExpanded: boolean;
}

export const MobileLivePreview: React.FC<MobileLivePreviewProps> = ({
  lines,
  settings,
  realPenMode,
  isVisible,
  onToggle,
  isExpanded,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fontClass = FONT_OPTIONS.find(f => f.value === settings.font)?.className || 'font-handwriting-1';

 // CRITICAL: Auto-scroll to bottom when content changes (especially after paste)
   useEffect(() => {
     if (containerRef.current) {
       // Use requestAnimationFrame to ensure DOM is updated before scrolling
       requestAnimationFrame(() => {
         if (containerRef.current) {
           containerRef.current.scrollTop = containerRef.current.scrollHeight;
         }
       });
     }
   }, [lines, isExpanded, lines.length]); // Also trigger on lines.length change for paste updates

  // Get the last few lines for preview
  const previewLines = useMemo(() => {
    const count = isExpanded ? lines.length : Math.min(3, lines.length);
    return lines.slice(-count);
  }, [lines, isExpanded]);

  const getLineStyle = (line: NoteLine, lineIndex: number): React.CSSProperties => {
    const inkColor = LINE_INK_COLORS.find(c => c.value === line.color);
    const baseHsl = inkColor?.hsl || '220 20% 12%';
    const [h, s, l] = baseHsl.split(' ').map(v => parseFloat(v));
    const variation = generateRealPenVariation(lineIndex, realPenMode);

    const baseStyle: React.CSSProperties = {
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      lineHeight: 1.6,
    };

    if (realPenMode) {
      const adjustedH = h + variation.hueShift;
      const adjustedL = Math.max(10, Math.min(50, l + (variation.thickness - 1) * 20));
      return {
        ...baseStyle,
        color: `hsl(${adjustedH} ${s}% ${adjustedL}%)`,
        opacity: variation.opacity,
      };
    }

    return { ...baseStyle, color: `hsl(${baseHsl})` };
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-20 left-3 right-3 z-20 lg:hidden"
    >
      <div className="bg-card/95 backdrop-blur-xl rounded-2xl border border-border/60 shadow-2xl overflow-hidden">
        {/* Header */}
        <motion.button
          onClick={onToggle}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5",
            "text-sm font-medium text-foreground",
            "hover:bg-muted/50 transition-colors",
            "border-b border-border/30"
          )}
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <Eye className="w-3.5 h-3.5 text-accent-rose" />
            </div>
            <span>Live Preview</span>
            <span className="text-xs text-muted-foreground">
              ({lines.filter(l => l.text.trim()).length} lines)
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          )}
        </motion.button>

        {/* Preview Content - CRITICAL: Flow-based layout with flex column, no absolute positioning */}
        <motion.div
          ref={containerRef}
          initial={false}
          animate={{ 
            height: isExpanded ? 200 : 100,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={cn(
            "overflow-y-auto overflow-x-hidden px-4 py-3",
            "bg-surface dark:bg-paper"
          )}
          style={{
            // CRITICAL: Flow-based layout - each line is a block, no overlapping
            display: 'flex',
            flexDirection: 'column',
            gap: 0,
          }}
        >
          <AnimatePresence mode="popLayout">
            {previewLines.map((line) => {
              const globalIndex = lines.indexOf(line);
 return (
                 <motion.div
                   key={line.id}
                   initial={{ opacity: 0, y: -4 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, height: 0 }}
                   transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                   className={cn(
                     fontClass,
                     "text-base",
                     "transition-colors duration-150"
                   )}
                    style={{
                      ...getLineStyle(line, globalIndex),
                      // CRITICAL: Block-level layout for mobile paste - each line flows naturally
                      display: 'block',
                      minHeight: '48px',
                      lineHeight: '48px',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      wordBreak: 'break-word',
                      // Mobile-optimized padding for touch targets
                      paddingTop: '0px',
                      paddingBottom: '0px',
                    }}
                 >
                   {line.text || (
                     <span className="text-muted-foreground/30 italic text-sm">
                       {globalIndex === 0 ? "Start typing..." : "\u00A0"}
                     </span>
                   )}
                 </motion.div>
              );
            })}
          </AnimatePresence>

          {lines.every(l => !l.text.trim()) && (
            <div className="text-center text-muted-foreground/40 text-sm italic py-4">
              Your handwritten preview will appear here
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

MobileLivePreview.displayName = 'MobileLivePreview';
