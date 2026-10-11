import { PaperEffectsOverlay, pageTilt, penClass } from '@/components/paper/PaperEffects';
import React, { useMemo, forwardRef, useImperativeHandle, useRef, useState, useEffect, memo } from 'react';
import { NoteLine } from '@/types/noteLine';
import { NoteSettings, FONT_OPTIONS, PAGE_SIZE_OPTIONS } from '@/types/notes';
import { useIsMobile } from '@/hooks/use-mobile';
import { DEFAULT_RESPONSIVE_MARGINS, calculateLinesPerPage } from '@/hooks/useResponsiveMargins';
import { HandwritingLine } from './HandwritingLine';
import { InlineContent } from '@/types/noteLine';
import { InlineContentRenderer } from './InlineContentRenderer';
import { HandwritingDNA } from '@/components/handwriting-dna/HandwritingDNAEngine';

interface NotebookPreviewProps {
  lines: NoteLine[];
  settings: NoteSettings;
  realPenMode: boolean;
  pageNumber?: number;
  totalPages?: number;
  forExport?: boolean; // When true, renders at full size without scaling
  inlineContent?: InlineContent[];
  onUpdateContent?: (id: string, updates: Partial<InlineContent>) => void;
  onDeleteContent?: (id: string) => void;
  dna?: HandwritingDNA;
}

export interface NotebookPreviewHandle {
  getPageElements: () => HTMLElement[];
}

// Page component - memoized for performance
const NotebookPage = memo<{
  pageLines: NoteLine[];
  pageIndex: number;
  totalPageCount: number;
  linesPerPage: number;
  settings: NoteSettings;
  realPenMode: boolean;
  fontClass: string;
  paperStyle: React.CSSProperties;
  margins: { top: number; right: number; bottom: number; left: number };
  sizeConfig: { width: number; height: number };
  showSpiral: boolean;
  showHolePunches: boolean;
  showCornellLayout: boolean;
  isBlueprint: boolean;
  isKraft: boolean;
  isVintage: boolean;
  pageRef: React.RefCallback<HTMLDivElement>;
  scale: number;
  forExport: boolean;
  dna?: HandwritingDNA;
}>(({
  pageLines,
  pageIndex,
  totalPageCount,
  linesPerPage,
  settings,
  realPenMode,
  fontClass,
  paperStyle,
  margins,
  sizeConfig,
  showSpiral,
  showHolePunches,
  showCornellLayout,
  isBlueprint,
  isKraft,
  isVintage,
  pageRef,
  scale,
  forExport,
  dna,
}) => {
  const getTextColor = (): string => {
    if (isBlueprint) return 'hsl(200 80% 80%)';
    if (isKraft) return 'hsl(30 15% 25%)';
    return 'hsl(222 47% 11%)'; // Foreground color
  };

  return (
    <div
      className={`${forExport ? '' : 'animate-scale-in hover-lift'} origin-top`}
      style={{ 
        width: `${sizeConfig.width}px`,
        // CRITICAL: Never export scaled pages (causes tiny-corner output)
        transform: [!forExport && scale < 1 ? `scale(${scale})` : '', pageTilt(settings.paperEffects, pageIndex) ? `rotate(${pageTilt(settings.paperEffects, pageIndex)}deg)` : ''].join(' ').trim() || undefined,
        transformOrigin: 'top center',
        marginBottom: !forExport && scale < 1 ? `${-(sizeConfig.height * (1 - scale))}px` : undefined,
        animationDelay: forExport ? undefined : `${pageIndex * 50}ms`,
      }}
    >
      <div
        ref={pageRef}
        data-export-page="true"
        className={`w-full paper-shadow relative overflow-hidden ${penClass(settings.penType)} ${isBlueprint ? 'rounded-none' : ''}`}
        style={{
          ...paperStyle,
          aspectRatio: `${sizeConfig.width}/${sizeConfig.height}`,
          // CRITICAL: Lock exact A4 pixel height for export so html2canvas captures 1:1
          height: forExport ? `${sizeConfig.height}px` : undefined,
          paddingTop: `${margins.top}px`,
          paddingRight: `${margins.right}px`,
          paddingBottom: `${margins.bottom}px`,
          paddingLeft: showSpiral ? `${margins.left + 30}px` : `${margins.left}px`,
        }}
      >
        <PaperEffectsOverlay fx={settings.paperEffects} pageIndex={pageIndex} />

        {/* Spiral binding */}
        {showSpiral && (
          <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col items-center justify-start pt-4 gap-3" style={{ background: 'linear-gradient(to right, #d1d5db, #e5e7eb)' }}>
            {Array.from({ length: 25 }).map((_, i) => (
              <div 
                key={i} 
                className="w-5 h-5 rounded-full border-2"
                style={{ 
                  borderColor: '#6b7280',
                  backgroundColor: '#ffffff',
                  boxShadow: 'inset 1px 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.1)',
                }}
              />
            ))}
          </div>
        )}

        {/* Hole punches */}
        {showHolePunches && (
          <div className="absolute left-3 top-0 bottom-0 flex flex-col items-center justify-center gap-[180px]">
            {[0, 1, 2].map((i) => (
              <div 
                key={i} 
                className="w-6 h-6 rounded-full"
                style={{ 
                  backgroundColor: 'rgba(156, 163, 175, 0.2)',
                  boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.2), inset -1px -1px 2px rgba(255,255,255,0.1)',
                }}
              />
            ))}
          </div>
        )}

        {/* Cornell notes layout */}
        {showCornellLayout && (
          <>
            <div className="absolute top-[80px] bottom-[120px] w-0.5" style={{ left: '25%', backgroundColor: 'hsla(0, 65%, 60%, 0.6)' }} />
            <div className="absolute left-0 right-0 h-0.5" style={{ bottom: '120px', backgroundColor: 'hsla(0, 65%, 60%, 0.6)' }} />
            <div className="absolute text-[8px] font-medium uppercase tracking-wider" style={{ top: '65px', left: '10px', color: 'rgba(107, 114, 128, 0.5)' }}>Cues</div>
            <div className="absolute text-[8px] font-medium uppercase tracking-wider" style={{ top: '65px', left: '27%', color: 'rgba(107, 114, 128, 0.5)' }}>Notes</div>
            <div className="absolute text-[8px] font-medium uppercase tracking-wider" style={{ bottom: '105px', left: '10px', color: 'rgba(107, 114, 128, 0.5)' }}>Summary</div>
          </>
        )}

        {/* Margin line - only show if explicitly enabled */}
        {settings.showMarginLine && margins.left > 30 && !showSpiral && (
          <div className="absolute top-0 bottom-0 w-0.5" style={{ left: `${margins.left - 10}px`, backgroundColor: 'hsla(0, 65%, 60%, 0.4)' }} />
        )}

        {/* Vintage paper effects */}
        {isVintage && (
          <>
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'linear-gradient(to bottom right, rgba(120, 53, 15, 0.2), transparent, rgba(120, 53, 15, 0.1))' }} />
            <div className="absolute top-0 left-0 right-0 h-2" style={{ background: 'linear-gradient(to bottom, rgba(120, 53, 15, 0.1), transparent)' }} />
            <div className="absolute bottom-0 left-0 right-0 h-3" style={{ background: 'linear-gradient(to top, rgba(120, 53, 15, 0.15), transparent)' }} />
          </>
        )}

        {/* Header */}
        {settings.headerFooter.showHeader && (
          <div className={`${fontClass} text-sm mb-4 flex justify-between`} style={{ fontSize: settings.fontSize * 0.6, color: getTextColor() }}>
            {settings.headerFooter.name && <span>Name: {settings.headerFooter.name}</span>}
            {settings.headerFooter.rollNo && <span>Roll No: {settings.headerFooter.rollNo}</span>}
            {settings.headerFooter.subject && <span>Subject: {settings.headerFooter.subject}</span>}
          </div>
        )}

        {/* Lines content with handwriting animation - CRITICAL: Flow-based layout with flex-direction: column */}
        <div 
          className="leading-relaxed" 
          style={{ 
            fontSize: `${settings.fontSize}px`, 
            marginLeft: showCornellLayout ? '26%' : 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 0, // Lines manage their own spacing via lineHeight
          }}
        >
          {pageLines.map((line, lineIndex) => {
            const globalLineIndex = pageIndex * linesPerPage + lineIndex;
            return (
              <HandwritingLine
                key={line.id}
                line={line}
                lineIndex={globalLineIndex}
                settings={settings}
                realPenMode={realPenMode}
                fontClass={fontClass}
                isNewText={false}
                dna={dna}
              />
            );
          })}
        </div>

        {/* Page number - always shown, centered at bottom */}
        {settings.headerFooter.showPageNumber && (
          <div 
            className={`absolute left-0 right-0 ${fontClass} text-center`}
            style={{ 
              bottom: `${Math.min(margins.bottom - 20, 16)}px`,
              fontSize: settings.fontSize * 0.5, 
              color: getTextColor(),
              paddingLeft: margins.left,
              paddingRight: margins.right,
            }}
          >
            <span>Page {pageIndex + 1} of {totalPageCount}</span>
          </div>
        )}
      </div>
    </div>
  );
});

NotebookPage.displayName = 'NotebookPage';

export const NotebookPreview = forwardRef<NotebookPreviewHandle, NotebookPreviewProps>(
  ({ lines, settings, realPenMode, forExport = false, inlineContent, onUpdateContent, onDeleteContent, dna }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const isMobile = useIsMobile();
    const [containerWidth, setContainerWidth] = useState(0);

    const fontClass = FONT_OPTIONS.find(f => f.value === settings.font)?.className || 'font-handwriting-1';
    const sizeConfig = PAGE_SIZE_OPTIONS.find(s => s.value === settings.pageSize) || PAGE_SIZE_OPTIONS[0];
    
    // Use responsive margins - for export, always use desktop margins
    const margins = useMemo(() => {
      if (forExport) {
        return DEFAULT_RESPONSIVE_MARGINS.desktop;
      }
      return isMobile ? DEFAULT_RESPONSIVE_MARGINS.mobile : DEFAULT_RESPONSIVE_MARGINS.desktop;
    }, [isMobile, forExport]);

    // Calculate lines per page with proper margins
    const linesPerPage = useMemo(() => {
      return calculateLinesPerPage(
        sizeConfig.height,
        settings.lineSpacing,
        margins,
        settings.headerFooter.showHeader,
        settings.headerFooter.showPageNumber
      );
    }, [sizeConfig.height, settings.lineSpacing, margins, settings.headerFooter.showHeader, settings.headerFooter.showPageNumber]);

    // Calculate scale to fit page in container
    useEffect(() => {
      if (forExport) return; // Don't scale for export
      
      const updateWidth = () => {
        if (containerRef.current) {
          setContainerWidth(containerRef.current.clientWidth);
        }
      };
      updateWidth();
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }, [forExport]);

    // Calculate the scale factor to fit the page within container
    const scale = useMemo(() => {
      if (forExport) return 1;
      if (!containerWidth || containerWidth <= 0) return 1;
      
      const padding = isMobile ? 24 : 48;
      const availableWidth = containerWidth - padding;
      const pageWidth = sizeConfig.width;
      
      if (availableWidth < pageWidth) {
        return Math.max(0.4, availableWidth / pageWidth);
      }
      return 1;
    }, [containerWidth, sizeConfig.width, isMobile, forExport]);

    // Split lines into pages based on calculated lines per page
    const pages = useMemo(() => {
      const result: NoteLine[][] = [];
      const effectiveLinesPerPage = Math.max(1, linesPerPage);
      
      for (let i = 0; i < lines.length; i += effectiveLinesPerPage) {
        result.push(lines.slice(i, i + effectiveLinesPerPage));
      }
      
      // Always have at least one page
      return result.length > 0 ? result : [[]];
    }, [lines, linesPerPage]);

    useImperativeHandle(ref, () => ({
      getPageElements: () => {
        return pageRefs.current.filter((el): el is HTMLDivElement => el !== null);
      },
    }));

    const showSpiral = settings.pageStyle === 'spiral';
    const showHolePunches = settings.pageStyle === 'hole-punched';
    const showCornellLayout = settings.pageStyle === 'cornell';
    const isBlueprint = settings.pageStyle === 'blueprint';
    const isKraft = settings.pageStyle === 'kraft';
    const isVintage = settings.pageStyle === 'vintage';

    const paperStyle = useMemo<React.CSSProperties>(() => {
      const pureWhite = '#FFFFFF';
      const lineColor = 'hsl(210, 35%, 85%)';
      
      switch (settings.pageStyle) {
        case 'ruled':
          return {
            backgroundColor: pureWhite,
            backgroundImage: `repeating-linear-gradient(transparent, transparent 31px, ${lineColor} 31px, ${lineColor} 32px)`,
          };
        case 'single-line':
          return {
            backgroundColor: pureWhite,
            backgroundImage: `repeating-linear-gradient(transparent, transparent 47px, ${lineColor} 47px, ${lineColor} 48px)`,
          };
        case 'graph':
          return {
            backgroundColor: pureWhite,
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 19px, ${lineColor} 19px, ${lineColor} 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, ${lineColor} 19px, ${lineColor} 20px)`,
          };
        case 'dotted':
          return {
            backgroundColor: pureWhite,
            backgroundImage: `radial-gradient(circle, ${lineColor} 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          };
        case 'college':
          return {
            backgroundColor: pureWhite,
            backgroundImage: `repeating-linear-gradient(transparent, transparent 23px, ${lineColor} 23px, ${lineColor} 24px)`,
          };
        case 'legal':
          return {
            backgroundColor: '#FFFDE7',
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, hsl(210, 40%, 70%) 31px, hsl(210, 40%, 70%) 32px)',
          };
        case 'spiral':
        case 'hole-punched':
          return {
            backgroundColor: pureWhite,
            backgroundImage: `repeating-linear-gradient(transparent, transparent 31px, ${lineColor} 31px, ${lineColor} 32px)`,
          };
        case 'vintage':
          return {
            backgroundColor: '#F5E6D3',
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, hsl(25, 30%, 70%) 31px, hsl(25, 30%, 70%) 32px)',
          };
        case 'kraft':
          return {
            backgroundColor: '#C4A77D',
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, hsl(30, 25%, 45%) 31px, hsl(30, 25%, 45%) 32px)',
          };
        case 'blueprint':
          return {
            backgroundColor: '#1E3A5F',
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, hsl(210, 50%, 45%) 19px, hsl(210, 50%, 45%) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, hsl(210, 50%, 45%) 19px, hsl(210, 50%, 45%) 20px)',
          };
        case 'music-sheet':
          return {
            backgroundColor: pureWhite,
            backgroundImage: `repeating-linear-gradient(transparent 0px, transparent 7px, ${lineColor} 7px, ${lineColor} 8px, transparent 8px, transparent 15px, ${lineColor} 15px, ${lineColor} 16px, transparent 16px, transparent 23px, ${lineColor} 23px, ${lineColor} 24px, transparent 24px, transparent 31px, ${lineColor} 31px, ${lineColor} 32px, transparent 32px, transparent 39px, ${lineColor} 39px, ${lineColor} 40px, transparent 40px, transparent 60px)`,
          };
        case 'cornell':
          return {
            backgroundColor: pureWhite,
            backgroundImage: `repeating-linear-gradient(transparent, transparent 31px, ${lineColor} 31px, ${lineColor} 32px)`,
          };
        case 'plain':
        default:
          return { backgroundColor: pureWhite };
      }
    }, [settings.pageStyle]);

    return (
      <div 
        ref={containerRef} 
        data-preview-container="true"
        className={`h-full overflow-y-auto scroll-smooth relative ${forExport ? 'p-0' : 'p-3 sm:p-6'}`}
      >
        <div className="flex flex-col items-center gap-4 sm:gap-6">
          {pages.map((pageLines, pageIndex) => (
            <NotebookPage
              key={pageIndex}
              pageLines={pageLines}
              pageIndex={pageIndex}
              totalPageCount={pages.length}
              linesPerPage={linesPerPage}
              settings={settings}
              realPenMode={realPenMode}
              fontClass={fontClass}
              paperStyle={paperStyle}
              margins={margins}
              sizeConfig={sizeConfig}
              showSpiral={showSpiral}
              showHolePunches={showHolePunches}
              showCornellLayout={showCornellLayout}
              isBlueprint={isBlueprint}
              isKraft={isKraft}
              isVintage={isVintage}
              pageRef={(el) => { pageRefs.current[pageIndex] = el; }}
              scale={scale}
              forExport={forExport}
              dna={dna}
            />
          ))}

          {/* Inline content (images/diagrams) - shown below pages */}
          {inlineContent && inlineContent.length > 0 && (
            <div className="w-full max-w-[595px] p-4 flex flex-wrap gap-3 justify-center bg-muted/30 rounded-xl border border-border/50">
              {inlineContent.map((content) => (
                <InlineContentRenderer
                  key={content.id}
                  content={content}
                  onUpdate={onUpdateContent}
                  onDelete={onDeleteContent}
                  editable={!forExport}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!forExport && (lines.length === 0 || (lines.length === 1 && lines[0].text === '')) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none animate-fade-in">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(107, 114, 128, 0.1)' }}>
                <svg className="w-8 h-8" style={{ color: 'rgba(107, 114, 128, 0.5)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h3 className="font-medium mb-1" style={{ color: 'hsl(222, 47%, 11%)' }}>Start Writing</h3>
              <p className="text-sm max-w-[240px]" style={{ color: 'rgba(107, 114, 128, 0.7)' }}>
                Type in the notebook on the left to see your handwritten notes appear here
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }
);

NotebookPreview.displayName = 'NotebookPreview';
