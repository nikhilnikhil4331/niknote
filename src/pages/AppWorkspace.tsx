import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useNoteSettings } from '@/hooks/useNoteSettings';
import { useNotebookPages } from '@/hooks/useNotebookPages';
import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useAutoPagination } from '@/hooks/useAutoPagination';
import { usePremium } from '@/hooks/usePremium';
import { useAuth } from '@/contexts/AuthContext';
import { useStreak } from '@/hooks/useStreak';
import { exportToPDF } from '@/utils/export';
import { NoteLine, LineInkColor, generateLineId, getDefaultColorForLine, LineHistory } from '@/types/noteLine';
import { toast } from 'sonner';
import { AppHeader } from '@/components/app/AppHeader';
import { BottomNavBar, AppStep } from '@/components/app/BottomNavBar';
import { StepContent } from '@/components/app/StepContent';
import { StepStyle } from '@/components/app/StepStyle';
import { StepPreview } from '@/components/app/StepPreview';

const TRANSITION_VARIANTS = {
  content: { initial: { opacity: 0, x: -30 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -30 } },
  style:   { initial: { opacity: 0, y: 30 },  animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 30 } },
  preview: { initial: { opacity: 0, x: 30 },  animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: 30 } },
};

const AppWorkspace = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<AppStep>('content');
  const [docTitle, setDocTitle] = useState('Untitled Note');
  const { settings, updateSettings } = useNoteSettings();
  const { triggerHaptic } = useHaptics();
  const { playClick, playSuccess } = useSoundEffects();
  const premium = usePremium();
  const streakData = useStreak();
  const [isExporting, setIsExporting] = useState(false);

  const {
    pages, currentPageIndex, currentPage, totalPages,
    goToPage, addNewPage, updateCurrentPageLines, flowOverflowFrom,
  } = useNotebookPages(user?.id);

  const [currentColor, setCurrentColor] = useState<LineInkColor>('black');
  const lines = currentPage.lines;
  const isPastingRef = useRef(false);

  const autoPagination = useAutoPagination({
    settings, lines, updateLines: updateCurrentPageLines,
    addNewPage, totalPages, currentPageIndex, goToPage,
  });

  useEffect(() => {
    if (isPastingRef.current) return;
    if (lines.length > autoPagination.linesPerPage) {
      flowOverflowFrom(currentPageIndex, autoPagination.linesPerPage);
    }
  }, [lines.length, autoPagination.linesPerPage, currentPageIndex, flowOverflowFrom]);

  // Line operations
  const updateLineText = useCallback((lineId: string, text: string) => {
    updateCurrentPageLines(lines.map((l) => l.id === lineId ? { ...l, text, timestamp: Date.now() } : l));
  }, [lines, updateCurrentPageLines]);

  const addLine = useCallback((afterLineId?: string): string => {
    const newId = generateLineId();
    const idx = afterLineId ? lines.findIndex((l) => l.id === afterLineId) + 1 : lines.length;
    const newLine: NoteLine = { id: newId, text: '', color: getDefaultColorForLine(idx), timestamp: Date.now() };
    const newLines = [...lines];
    newLines.splice(idx, 0, newLine);
    updateCurrentPageLines(newLines);
    return newId;
  }, [lines, updateCurrentPageLines]);

  const removeLine = useCallback((lineId: string) => {
    if (lines.length <= 1) {
      updateCurrentPageLines(lines.map((l) => l.id === lineId ? { ...l, text: '', timestamp: Date.now() } : l));
    } else {
      updateCurrentPageLines(lines.filter((l) => l.id !== lineId));
    }
  }, [lines, updateCurrentPageLines]);

  const mergeLinesUp = useCallback((lineId: string) => {
    const idx = lines.findIndex((l) => l.id === lineId);
    if (idx <= 0) return;
    const merged = { ...lines[idx - 1], text: lines[idx - 1].text + lines[idx].text, timestamp: Date.now() };
    const newLines = [...lines];
    newLines[idx - 1] = merged;
    newLines.splice(idx, 1);
    updateCurrentPageLines(newLines);
  }, [lines, updateCurrentPageLines]);

  const handlePaste = useCallback((rawText: string, atLineId?: string) => {
    const normalized = (rawText ?? '').replace(/\r/g, '');
    const pastedLines = normalized.split('\n');
    if (pastedLines.length <= 1) return;

    const insertIndex = atLineId ? lines.findIndex((l) => l.id === atLineId) : lines.length - 1;
    if (insertIndex === -1) return;

    const newLinesData = pastedLines.map((text, i) => ({
      id: generateLineId(), text,
      color: getDefaultColorForLine(insertIndex + i),
      timestamp: Date.now() + i,
    }));

    const currentLine = lines[insertIndex];
    const baseBefore = currentLine?.text === '' ? lines.slice(0, insertIndex) : lines.slice(0, insertIndex + 1);
    const baseAfter = currentLine?.text === '' ? lines.slice(insertIndex + 1) : lines.slice(insertIndex + 1);

    isPastingRef.current = true;
    const allNew = [...baseBefore, ...newLinesData, ...baseAfter];
    updateCurrentPageLines(allNew);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isPastingRef.current = false;
        if (allNew.length > autoPagination.linesPerPage) {
          flowOverflowFrom(currentPageIndex, autoPagination.linesPerPage);
        }
      });
    });
  }, [lines, updateCurrentPageLines, autoPagination.linesPerPage, flowOverflowFrom, currentPageIndex]);

  const getPlainText = useCallback(() => lines.map((l) => l.text).join('\n'), [lines]);

  const handleExportPDF = useCallback(async () => {
    const text = getPlainText();
    if (!text.trim()) { toast.error('Please add some content first'); return; }

    setIsExporting(true);
    triggerHaptic('medium');
    const toastId = toast.loading('Creating PDF...');

    try {
      const previewEls = Array.from(document.querySelectorAll('[data-export-page="true"]')) as HTMLElement[];
      if (!previewEls.length) {
        toast.error('Switch to Preview first', { id: toastId });
        setCurrentStep('preview');
        setIsExporting(false);
        return;
      }

      await exportToPDF(previewEls, docTitle || 'niknote-handwritten', settings.pageSize, (p) => {
        toast.loading(`Creating PDF: Page ${p.current}/${p.total}`, { id: toastId });
      });

      toast.success('PDF exported!', { id: toastId });
      playSuccess();
      triggerHaptic('success');
    } catch {
      toast.error('Export failed', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  }, [getPlainText, settings.pageSize, triggerHaptic, playSuccess, docTitle]);

  const handleStepChange = useCallback((step: AppStep) => {
    triggerHaptic('light');
    playClick();
    setCurrentStep(step);
  }, [triggerHaptic, playClick]);

  const wordCount = lines.reduce((acc, l) => acc + (l.text.trim() ? l.text.trim().split(/\s+/).length : 0), 0);
  const variant = TRANSITION_VARIANTS[currentStep];

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden">
      <AppHeader
        title={docTitle}
        onTitleChange={setDocTitle}
        onExport={handleExportPDF}
        isExporting={isExporting}
        wordCount={wordCount}
        currentPage={currentPageIndex + 1}
        totalPages={totalPages}
        currentStreak={streakData.streak.currentStreak}
      />

      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={variant.initial}
            animate={variant.animate}
            exit={variant.exit}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute inset-0"
          >
            {currentStep === 'content' && (
              <StepContent
                lines={lines}
                currentColor={currentColor}
                onUpdateLineText={updateLineText}
                onAddLine={addLine}
                onRemoveLine={removeLine}
                onMergeLinesUp={mergeLinesUp}
                onPaste={handlePaste}
                onColorChange={setCurrentColor}
              />
            )}
            {currentStep === 'style' && (
              <StepStyle settings={settings} onUpdateSettings={updateSettings} lines={lines} />
            )}
            {currentStep === 'preview' && (
              <StepPreview
                settings={settings}
                pages={pages}
                currentPageIndex={currentPageIndex}
                totalPages={totalPages}
                onGoToPage={goToPage}
                onExportPDF={handleExportPDF}
                isExporting={isExporting}
                isPremium={premium.isPremium}
                docTitle={docTitle}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNavBar currentStep={currentStep} onStepChange={handleStepChange} />
    </div>
  );
};

export default AppWorkspace;
