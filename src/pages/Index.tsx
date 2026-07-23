import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { NotionEditor } from '@/components/editor/NotionEditor';
import { useBlockEditor } from '@/hooks/useBlockEditor';
import { lazy } from 'react';
const SmartEditor = lazy(() => import('@/components/smart-editor/SmartEditor').then(m => ({ default: m.SmartEditor })));
const AIWorkspacePanel = lazy(() => import('@/components/ai-workspace/AIWorkspacePanel').then(m => ({ default: m.AIWorkspacePanel })));
import type { EditorSuggestion } from '@/components/smart-editor/SmartEditor';
import { NotebookPreview, NotebookPreviewHandle } from '@/components/NotebookPreview';
import { PenPalette } from '@/components/PenPalette';
const ControlPanel = lazy(() => import('@/components/ControlPanel').then(m => ({ default: m.ControlPanel })));
import { PageBar } from '@/components/PageBar';
import { MoodSelector } from '@/components/MoodSelector';
import { SlidePanel } from '@/components/SlidePanel';
import { MobileBottomNav, MobileTab } from '@/components/MobileBottomNav';
const MobileStyleSheet = lazy(() => import('@/components/MobileStyleSheet').then(m => ({ default: m.MobileStyleSheet })));
import { QuickStylesBar } from '@/components/QuickStylesBar';
import { useNoteSettings } from '@/hooks/useNoteSettings';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useDiagrams } from '@/hooks/useDiagrams';
import { useTableData } from '@/hooks/useTableData';
import { useNotebookPages } from '@/hooks/useNotebookPages';
import { useHaptics } from '@/hooks/useHaptics';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useMood } from '@/hooks/useMood';
import { useIsMobile } from '@/hooks/use-mobile';
import { exportToPDF, ExportProgress } from '@/utils/export';
import { toast } from 'sonner';
import { shareAsImage, shareAsPDF } from '@/utils/share';
const WorkspaceSidebar = lazy(() => import('@/components/workspace/WorkspaceSidebar').then(m => ({ default: m.WorkspaceSidebar })));
import {
  Settings2, Edit3, FileDown, Palette, Crown, LogIn,
  Gem, MoreVertical, Moon, Sun, RotateCcw, Share2, Image, FileText, Sparkles,
  LayoutGrid, Scan, Brain, PanelLeft, ChevronDown, MessageSquare, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NoteLine, LineInkColor, LINE_INK_COLORS, generateLineId, getDefaultColorForLine, LineHistory } from '@/types/noteLine';
import { createBlock } from '@/types/block';
import { InlineDiagram } from '@/types/noteLine';
import { useAutoPagination } from '@/hooks/useAutoPagination';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import { PaywallModal } from '@/components/premium/PaywallModal';
import { usePremium, PremiumFeature } from '@/hooks/usePremium';

import { useAuth } from '@/contexts/AuthContext';
import { useHandwritingDNA } from '@/contexts/HandwritingDNAContext';
const HandwritingScanner = lazy(() => import('@/components/handwriting-dna/HandwritingScanner').then(m => ({ default: m.HandwritingScanner })));
const CommandPalette = lazy(() => import('@/components/command-palette/CommandPalette').then(m => ({ default: m.CommandPalette })));
import { useUITheme, UI_THEMES, UITheme, getThemeClasses } from '@/utils/uiThemes';
import { cn } from '@/lib/utils';
import { HeaderProfileButton } from '@/components/HeaderProfileButton';
const DiagramToolbar = lazy(() => import('@/components/DiagramToolbar').then(m => ({ default: m.DiagramToolbar })));
import { useInlineContent } from '@/hooks/useInlineContent';
import { Toolbar } from '@/components/Toolbar';
import { ScrollArea } from '@/components/ui/scroll-area';

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dnaContext = useHandwritingDNA();
  const { theme: uiTheme, setTheme: setUITheme, classes: themeClasses } = useUITheme();
  const isMobile = useIsMobile();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [glassMode, setGlassMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);

  useEffect(() => { setSidebarOpen(!isMobile); }, [isMobile]);

  // Command Palette keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [pageDirection, setPageDirection] = useState<'left' | 'right' | 'none'>('none');
  const [showPenPanel, setShowPenPanel] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showScanPanel, setShowScanPanel] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showAIWorkspace, setShowAIWorkspace] = useState(false);

  // Mobile state
  const [mobileTab, setMobileTab] = useState<MobileTab>('write');
  const [showMobileStyleSheet, setShowMobileStyleSheet] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);

  const { settings, updateSettings, updateMargins, updateHeaderFooter, resetSettings } = useNoteSettings();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const { diagrams, addDiagram, removeDiagram, updateDiagram } = useDiagrams();
  const { tableData, updateTableData } = useTableData(settings.table.rows, settings.table.columns);
  const { content: inlineContent, addImage, addDiagram: addInlineDiagram, updateContent, removeContent } = useInlineContent();
  const { mood, changeMood, styles: moodStyles } = useMood();
  const previewRef = useRef<NotebookPreviewHandle>(null);
  const isPastingRef = useRef(false);
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const [exportMount, setExportMount] = useState(false);
  const { triggerHaptic } = useHaptics();
  const { playClick, playSuccess } = useSoundEffects();
  const premium = usePremium();
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [pendingFeature, setPendingFeature] = useState<PremiumFeature | null>(null);
  const requirePremium = useCallback((feature: PremiumFeature) => {
    setPendingFeature(feature);
    setPaywallOpen(true);
  }, []);
  const quickDictation = useSpeechDictation({
    onFinalTranscript: (text) => { handlePaste(text); }
  });

  const {
    pages, currentPageIndex, currentPage, totalPages,
    goToPage, nextPage, prevPage, addNewPage, deletePage,
    updateCurrentPageLines, flowOverflowFrom, canGoNext, canGoPrev
  } = useNotebookPages();

  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [currentColor, setCurrentColor] = useState<LineInkColor>('black');
  const [realPenMode, setRealPenMode] = useState(false);
  const [lineHistories, setLineHistories] = useState<Map<string, LineHistory>>(new Map());
  const lines = currentPage.lines;

  const blockEditor = useBlockEditor();
  const previewLines = blockEditor.blocks.some(b => b.content.trim()) ? blockEditor.lines : lines;
  const hasContent = blockEditor.blocks.some(b => b.content.trim()) || lines.some(l => l.text.trim());

  // Auto-trigger onboarding for new users + Welcome back toast + Streak
  useEffect(() => {
    if (user) {
      const hasSeenOnboarding = localStorage.getItem('niknote_onboarding_done');
      if (!hasSeenOnboarding) {
        navigate('/onboarding');
      } else {
        // Welcome back toast for returning users
        const lastVisit = localStorage.getItem('niknote_last_visit');
        const today = new Date().toISOString().split('T')[0];
        if (lastVisit && lastVisit !== today) {
          toast.success('Welcome back! 👋 Your streak continues 🔥');
        } else if (!lastVisit) {
          localStorage.setItem('niknote_last_visit', today);
        }
        localStorage.setItem('niknote_last_visit', today);

        // Referral reminder (show once every 7 days)
        const lastReferralPrompt = localStorage.getItem('niknote_referral_prompt');
        const daysSincePrompt = lastReferralPrompt ? (Date.now() - parseInt(lastReferralPrompt, 10)) / 86400000 : 999;
        if (daysSincePrompt >= 7) {
          setTimeout(() => {
            toast('Share NikNote with friends? 🎁', {
              description: '3 friends = 7 days FREE Premium!',
              duration: 8000,
              action: {
                label: 'Share 📱',
                onClick: () => {
                  const msg = encodeURIComponent('🎓 NikNote — Free AI Study App! ✨\n\n✍️ Handwriting notes (16+ styles)\n🧠 AI Teacher (Hindi!)\n📝 Quiz + Flashcards\n\nDownload FREE: https://niknote.online');
                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                }
              }
            });
            localStorage.setItem('niknote_referral_prompt', Date.now().toString());
          }, 10000);
        }
      }
    }
  }, [user, navigate]);

  useEffect(() => { setSelectedLines(new Set()); }, [currentPageIndex]);

  // Reset block editor when page changes — so new page starts fresh
  useEffect(() => {
    const currentPageContent = currentPage.lines;
    if (currentPageContent.length > 0 && currentPageContent.some(l => l.text.trim())) {
      // Page has content — convert lines to blocks
      const newBlocks = currentPageContent.filter(l => l.text.trim()).map(l => {
        const block = createBlock('text', l.text);
        block.color = l.color;
        return block;
      });
      blockEditor.setBlocks(newBlocks.length > 0 ? newBlocks : [createBlock('text', '')]);
    } else {
      // Empty page — reset to single empty block
      blockEditor.setBlocks([createBlock('text', '')]);
    }
  }, [currentPageIndex]);

  // Mobile tab handler
  const handleMobileTabChange = useCallback((tab: MobileTab) => {
    if (tab === 'style') { setShowMobileStyleSheet(true); return; }
    if (tab === 'ai') { navigate('/ai'); return; }
    setMobileTab(tab);
  }, [navigate]);

  // Editor focus tracking
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') setEditorFocused(true);
    };
    const handleFocusOut = (e: FocusEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        setTimeout(() => setEditorFocused(false), 200);
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // Line operations
  const saveToHistory = useCallback((lineId: string, line: NoteLine) => {
    setLineHistories((prev) => {
      const n = new Map(prev);
      const h = n.get(lineId) || { past: [], future: [] };
      n.set(lineId, { past: [...h.past.slice(-20), line], future: [] });
      return n;
    });
  }, []);

  const updateLineText = useCallback((lineId: string, text: string) => {
    const idx = lines.findIndex(l => l.id === lineId);
    if (idx === -1) return;
    saveToHistory(lineId, lines[idx]);
    updateCurrentPageLines(lines.map(l => l.id === lineId ? { ...l, text, timestamp: Date.now() } : l));
  }, [lines, saveToHistory, updateCurrentPageLines]);

  const updateLineColor = useCallback((lineId: string, color: LineInkColor) => {
    updateCurrentPageLines(lines.map(l => l.id === lineId ? { ...l, color, timestamp: Date.now() } : l));
  }, [lines, updateCurrentPageLines]);

  const updateSelectedLinesColor = useCallback((color: LineInkColor) => {
    if (selectedLines.size === 0) return;
    updateCurrentPageLines(lines.map(l => selectedLines.has(l.id) ? { ...l, color, timestamp: Date.now() } : l));
    setCurrentColor(color);
  }, [lines, selectedLines, updateCurrentPageLines]);

  const addLine = useCallback((afterLineId?: string): string => {
    const newId = generateLineId();
    const idx = afterLineId ? lines.findIndex(l => l.id === afterLineId) + 1 : lines.length;
    const newLine: NoteLine = { id: newId, text: '', color: getDefaultColorForLine(idx), timestamp: Date.now() };
    const newLines = [...lines];
    newLines.splice(idx, 0, newLine);
    updateCurrentPageLines(newLines);
    return newId;
  }, [lines, updateCurrentPageLines]);

  const removeLine = useCallback((lineId: string) => {
    if (lines.length <= 1) {
      updateCurrentPageLines(lines.map(l => l.id === lineId ? { ...l, text: '', timestamp: Date.now() } : l));
    } else {
      updateCurrentPageLines(lines.filter(l => l.id !== lineId));
    }
    setSelectedLines(prev => { const n = new Set(prev); n.delete(lineId); return n; });
  }, [lines, updateCurrentPageLines]);

  const selectLine = useCallback((lineId: string, multiSelect = false) => {
    setSelectedLines(prev => {
      if (multiSelect) { const n = new Set(prev); if (n.has(lineId)) n.delete(lineId); else n.add(lineId); return n; }
      return new Set([lineId]);
    });
    const line = lines.find(l => l.id === lineId);
    if (line) setCurrentColor(line.color);
  }, [lines]);

  const clearSelection = useCallback(() => { setSelectedLines(new Set()); }, []);

  const autoPagination = useAutoPagination({ settings, lines, updateLines: updateCurrentPageLines, addNewPage, totalPages, currentPageIndex, goToPage });

  const handlePaste = useCallback((rawText: string, atLineId?: string) => {
    const normalized = (rawText ?? '').replace(/\r/g, '');
    const pastedLines = normalized.split('\n');
    if (pastedLines.length <= 1) return;
    const insertIndex = atLineId ? lines.findIndex(l => l.id === atLineId) : lines.length - 1;
    if (insertIndex === -1) return;
    const newLinesData = pastedLines.map((text, i) => ({ id: generateLineId(), text, color: getDefaultColorForLine(insertIndex + i), timestamp: Date.now() + i }));
    const currentLine = lines[insertIndex];
    const baseBefore = (currentLine?.text ?? '') === '' ? lines.slice(0, insertIndex) : lines.slice(0, insertIndex + 1);
    const baseAfter = (currentLine?.text ?? '') === '' ? lines.slice(insertIndex + 1) : lines.slice(insertIndex + 1);
    isPastingRef.current = true;
    let inserted: NoteLine[] = [];
    let lastWorking: NoteLine[] = [...baseBefore, ...baseAfter];
    const batchSize = normalized.length > 500 ? 12 : 30;
    const tick = () => {
      const nextBatch = newLinesData.slice(inserted.length, inserted.length + batchSize);
      inserted = inserted.concat(nextBatch);
      lastWorking = [...baseBefore, ...inserted, ...baseAfter];
      updateCurrentPageLines(lastWorking);
      if (inserted.length < newLinesData.length) { setTimeout(tick, 0); return; }
      requestAnimationFrame(() => { requestAnimationFrame(() => {
        isPastingRef.current = false;
        if (lastWorking.length > autoPagination.linesPerPage) flowOverflowFrom(currentPageIndex, autoPagination.linesPerPage);
      }); });
    };
    tick();
  }, [lines, updateCurrentPageLines, autoPagination.linesPerPage, flowOverflowFrom, currentPageIndex]);

  useEffect(() => {
    if (isPastingRef.current) return;
    if (lines.length > autoPagination.linesPerPage) flowOverflowFrom(currentPageIndex, autoPagination.linesPerPage);
  }, [lines.length, autoPagination.linesPerPage, currentPageIndex, flowOverflowFrom]);

  const undoLine = useCallback((lineId: string) => {
    const h = lineHistories.get(lineId);
    if (!h || h.past.length === 0) return;
    const cur = lines.find(l => l.id === lineId);
    if (!cur) return;
    const prev = h.past[h.past.length - 1];
    setLineHistories(p => { const n = new Map(p); const hh = n.get(lineId)!; n.set(lineId, { past: hh.past.slice(0, -1), future: [cur, ...hh.future] }); return n; });
    updateCurrentPageLines(lines.map(l => l.id === lineId ? prev : l));
  }, [lines, lineHistories, updateCurrentPageLines]);

  const redoLine = useCallback((lineId: string) => {
    const h = lineHistories.get(lineId);
    if (!h || h.future.length === 0) return;
    const cur = lines.find(l => l.id === lineId);
    if (!cur) return;
    const next = h.future[0];
    setLineHistories(p => { const n = new Map(p); const hh = n.get(lineId)!; n.set(lineId, { past: [...hh.past, cur], future: hh.future.slice(1) }); return n; });
    updateCurrentPageLines(lines.map(l => l.id === lineId ? next : l));
  }, [lines, lineHistories, updateCurrentPageLines]);

  const canUndo = useCallback((lineId: string) => { const h = lineHistories.get(lineId); return h ? h.past.length > 0 : false; }, [lineHistories]);
  const canRedo = useCallback((lineId: string) => { const h = lineHistories.get(lineId); return h ? h.future.length > 0 : false; }, [lineHistories]);
  const getPlainText = useCallback(() => lines.map(l => l.text).join('\n'), [lines]);

  const mergeLinesUp = useCallback((lineId: string) => {
    const idx = lines.findIndex(l => l.id === lineId);
    if (idx <= 0) return;
    const merged: NoteLine = { ...lines[idx - 1], text: lines[idx - 1].text + lines[idx].text, timestamp: Date.now() };
    const newLines = [...lines]; newLines[idx - 1] = merged; newLines.splice(idx, 1);
    updateCurrentPageLines(newLines);
  }, [lines, updateCurrentPageLines]);

  const firstSelectedLineId = selectedLines.size > 0 ? Array.from(selectedLines)[0] : null;

  // Page navigation
  const handleNextPage = useCallback(() => { if (canGoNext) { setPageDirection('right'); triggerHaptic('light'); playClick(); nextPage(); } }, [canGoNext, nextPage, triggerHaptic, playClick]);
  const handlePrevPage = useCallback(() => { if (canGoPrev) { setPageDirection('left'); triggerHaptic('light'); playClick(); prevPage(); } }, [canGoPrev, prevPage, triggerHaptic, playClick]);
  const handleAddPage = useCallback(() => { setPageDirection('right'); triggerHaptic('medium'); playSuccess(); addNewPage(); toast.success('New page added!'); }, [addNewPage, triggerHaptic, playSuccess]);
  const handleDeletePage = useCallback((index: number) => { if (totalPages > 1) { deletePage(index); triggerHaptic('medium'); toast.success('Page deleted'); } }, [deletePage, totalPages, triggerHaptic]);
  const handleGoToPage = useCallback((index: number) => { setPageDirection(index > currentPageIndex ? 'right' : 'left'); triggerHaptic('light'); playClick(); goToPage(index); }, [currentPageIndex, goToPage, triggerHaptic, playClick]);

  const handleExportPDF = useCallback(async () => {
    // Get content from block editor
    const blockText = blockEditor.blocks.map(b => b.content).join('\n').trim();
    const lineText = lines.map(l => l.text).join('\n').trim();
    const contentText = blockText || lineText;
    
    if (!contentText && !settings.table.enabled && diagrams.length === 0) {
      toast.error('Pehle kuch content likho! ✍️');
      return;
    }
    
    setIsExporting(true);
    setExportProgress(null);
    triggerHaptic('medium');
    
    const toastId = toast.loading('PDF bana raha hai...');
    
    try {
      // METHOD 1: Try using jsPDF directly with text content — works everywhere
      const { jsPDF } = await import('jspdf');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });
      
      // Get font setting
      const fontFamily = settings.font || 'roman-regular';
      const fontSize = settings.fontSize || 24;
      const lineHeight = settings.lineSpacing || 32;
      
      // Set font
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(14);
      
      // Page dimensions
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);
      
      // Get ink color
      const inkData = LINE_INK_COLORS.find(c => c.value === currentColor);
      const textColor = inkData?.hex || '#000000';
      
      // Convert hex to RGB for jsPDF
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
      };
      
      const rgb = hexToRgb(textColor);
      pdf.setTextColor(rgb.r, rgb.g, rgb.b);
      
      // Split content into lines and paginate
      const contentLines = contentText.split('\n');
      let y = margin + 10;
      let pageNum = 1;
      
      for (const line of contentLines) {
        // Check if we need a new page
        if (y > pageHeight - margin - 10) {
          pdf.addPage();
          y = margin + 10;
          pageNum++;
        }
        
        // Handle headings (from block content)
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('## ')) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(18);
          const text = trimmedLine.replace(/^#+\s/, '');
          const wrapped = pdf.splitTextToSize(text, maxWidth);
          pdf.text(wrapped, margin, y);
          y += wrapped.length * 8 + 4;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(14);
        } else if (trimmedLine.startsWith('# ')) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(22);
          const text = trimmedLine.replace(/^#+\s/, '');
          const wrapped = pdf.splitTextToSize(text, maxWidth);
          pdf.text(wrapped, margin, y);
          y += wrapped.length * 10 + 4;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(14);
        } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
          // Bullet points
          pdf.setFontSize(13);
          const text = trimmedLine.replace(/^[-•]\s/, '');
          const wrapped = pdf.splitTextToSize(text, maxWidth - 8);
          pdf.text('•', margin + 2, y);
          pdf.text(wrapped, margin + 8, y);
          y += wrapped.length * 6 + 2;
        } else if (trimmedLine === '') {
          // Empty line = spacing
          y += 4;
        } else {
          // Regular text
          pdf.setFontSize(14);
          const wrapped = pdf.splitTextToSize(trimmedLine, maxWidth);
          pdf.text(wrapped, margin, y);
          y += wrapped.length * 6 + 1;
        }
      }
      
      // Add page number footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`NikNote — Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }
      
      // Save the PDF
      const filename = 'niknote-notes';
      pdf.save(`${filename}.pdf`);
      
      toast.success(`PDF download ho gaya! 📄 (${totalPages} page)`, { id: toastId });
      playSuccess();
      triggerHaptic('success');

      // 🎯 VIRAL GROWTH: Prompt sharing after successful PDF export
      setTimeout(() => {
        toast('Share NikNote with friends? 🎓', {
          description: '3 friends share = 7 days FREE Premium!',
          duration: 8000,
          action: {
            label: 'WhatsApp Share 📱',
            onClick: () => {
              const msg = encodeURIComponent(
                `🎓 NikNote — Free AI Study App! ✨\n\n✍️ Handwriting notes (16+ styles)\n🧠 AI Teacher (Hindi!)\n📝 Quiz + Flashcards generator\n\nDownload FREE: https://niknote.online\n3 dosto ko bhejo — Premium free! 🎁`
              );
              window.open(`https://wa.me/?text=${msg}`, '_blank');
              try {
                const clicks = parseInt(localStorage.getItem('niknote_share_clicks') || '0', 10);
                localStorage.setItem('niknote_share_clicks', (clicks + 1).toString());
              } catch {}
            }
          }
        });
      }, 1500);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('PDF export error:', msg);
      toast.error(`PDF fail: ${msg}`, {
        id: toastId,
        action: { label: 'Retry', onClick: () => handleExportPDF() }
      });
      triggerHaptic('error');
    } finally {
      setIsExporting(false);
      setExportProgress(null);
      setExportMount(false);
    }
  }, [blockEditor.blocks, lines, settings, currentColor, diagrams, triggerHaptic, playSuccess]);

  const handleReset = useCallback(() => { resetSettings(); triggerHaptic('medium'); toast.success('Settings reset'); }, [resetSettings, triggerHaptic]);

  const handleShareImage = useCallback(async () => {
    setShowShareMenu(false);
    const el = document.querySelector('[data-export-page="true"]') as HTMLElement ?? previewRef.current?.getPageElements()?.[0];
    if (!el) { toast.error('Switch to Preview first'); return; }
    setIsSharing(true);
    try { await shareAsImage(el, 'NikNote'); toast.success('Shared!'); }
    catch (e: any) { if (e?.name !== 'AbortError') toast.error('Share failed'); }
    finally { setIsSharing(false); }
  }, []);

  const handleSharePDF = useCallback(async () => {
    setShowShareMenu(false);
    const els = Array.from(document.querySelectorAll('[data-export-page="true"]')) as HTMLElement[];
    if (!els.length) { toast.error('Switch to Preview first'); return; }
    setIsSharing(true);
    try { await shareAsPDF(els, 'NikNote'); toast.success('PDF ready!'); }
    catch (e: any) { if (e?.name !== 'AbortError') toast.error('Share failed'); }
    finally { setIsSharing(false); }
  }, []);

  const handleColorChange = useCallback((color: typeof currentColor) => {
    if (selectedLines.size > 0) {
      updateSelectedLinesColor(color);
    }
    // Only set the current color for NEW blocks — do NOT change existing blocks
    blockEditor.setCurrentColor(color);
    setCurrentColor(color); triggerHaptic('selection'); playClick();
  }, [selectedLines, updateSelectedLinesColor, blockEditor, triggerHaptic, playClick]);

  const handleUndo = useCallback(() => { if (firstSelectedLineId) { undoLine(firstSelectedLineId); triggerHaptic('light'); } }, [firstSelectedLineId, undoLine, triggerHaptic]);
  const handleRedo = useCallback(() => { if (firstSelectedLineId) { redoLine(firstSelectedLineId); triggerHaptic('light'); } }, [firstSelectedLineId, redoLine, triggerHaptic]);

  const handleImageUpload = useCallback(() => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) { try { await addImage(file); toast.success('Image added!'); triggerHaptic('success'); } catch { toast.error('Failed'); } }
    };
    input.click();
  }, [addImage, triggerHaptic]);

  const handleAddInlineDiagram = useCallback((diagram: InlineDiagram) => { addInlineDiagram(diagram); toast.success('Shape added!'); triggerHaptic('light'); }, [addInlineDiagram, triggerHaptic]);

  const handleImportText = useCallback((importedLines: string[]) => {
    const flattened = importedLines.flatMap(chunk => String(chunk ?? '').split(/\r?\n/)).map(l => l.replace(/[\t ]+$/g, ''));
    const safeLines = flattened.length > 0 ? flattened : [''];
    const newLines = safeLines.map((text, i) => ({ id: generateLineId(), text, color: getDefaultColorForLine(i) as LineInkColor, timestamp: Date.now() + i }));
    if (newLines.length > 0) { updateCurrentPageLines(newLines); toast.success(`Imported ${newLines.length} lines!`); }
  }, [updateCurrentPageLines]);

  const controlPanelProps = {
    settings, updateSettings, updateMargins, updateHeaderFooter, tableData,
    onTableDataChange: updateTableData, diagrams, onAddDiagram: addDiagram,
    onRemoveDiagram: removeDiagram, onUpdateDiagram: updateDiagram,
    premiumLocked: !premium.isPremium, onPremiumTap: () => requirePremium('handwriting_styles'),
    onImportText: handleImportText
  };

  const pageVariants = {
    enter: (d: string) => ({ x: d === 'right' ? 300 : d === 'left' ? -300 : 0, opacity: 0, scale: 0.95 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (d: string) => ({ x: d === 'right' ? -300 : d === 'left' ? 300 : 0, opacity: 0, scale: 0.95 })
  };

  // ===================== RENDER =====================
  return (
    <div className={cn("flex flex-col transition-all duration-500 touch-manipulation", moodStyles.background, glassMode && "glass-mode", themeClasses.wrapper, isMobile ? "min-h-screen" : "h-[100dvh] overflow-hidden")}
         style={isMobile ? { touchAction: 'manipulation' } : undefined}>

      {/* ============ HEADER — Floating Glass Bar ============ */}
      <header className={cn(
        "sticky top-0 z-50 flex-shrink-0",
        isMobile 
          ? "bg-white border-b border-gray-100 h-12" 
          : "mx-3 mt-2 rounded-2xl bg-white/20 backdrop-blur-2xl border border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.08)] h-14"
      )}>
        <div className={cn("h-full flex items-center justify-between gap-2", isMobile ? "px-3" : "px-4 lg:px-5")}>
          {/* Left: toggle + logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(p => !p)}
              className={cn(
                "flex items-center justify-center rounded-lg transition-colors",
                isMobile ? "w-8 h-8 active:bg-gray-100" : "h-8 w-8 hover:bg-white/20"
              )}
              style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
            >
              <PanelLeft className="w-4 h-4 text-gray-600" />
            </button>
            <img 
              src="/niknote-logo.png" 
              alt="NikNote" 
              className={cn("select-none", isMobile ? "h-7" : "h-8")}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            />
            <span className={cn("font-extrabold bg-gradient-to-r from-orange-500 via-pink-500 to-purple-600 bg-clip-text text-transparent select-none", isMobile ? "text-sm" : "text-base")}>NikNote</span>
          </div>

          {/* Center: Mood pills (desktop) */}
          {!isMobile && (
            <div className="flex items-center gap-1.5 flex-shrink min-w-0">
              <MoodSelector currentMood={mood} onMoodChange={changeMood} />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setGlassMode(p => !p)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200",
                  glassMode
                    ? "bg-white/30 text-foreground shadow-sm backdrop-blur-sm"
                    : "bg-white/10 text-foreground/70 hover:bg-white/20 hover:text-foreground"
                )}
              >
                <Gem className="w-4 h-4" />
                <span className="hidden lg:inline">Glass</span>
              </motion.button>
            </div>
          )}

          {/* Right actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isMobile ? (
              <>
                <button
                  onClick={() => navigate('/ai')}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r from-violet-500 to-indigo-500 shadow-sm active:scale-95 transition-transform"
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI</span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button 
                      className="flex items-center justify-center w-8 h-8 rounded-lg active:bg-gray-100 transition-colors"
                      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
                    >
                      <MoreVertical className="w-4 h-4 text-gray-600" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-white/95 backdrop-blur-2xl border-gray-200 rounded-xl shadow-xl">
                    <DropdownMenuItem onClick={() => changeMood('calm')}>☀️ Calm</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeMood('focus')}>✨ Focus</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeMood('dark')}>🌙 Dark</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeMood('vintage')}>☕ Vintage</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeMood('study')}>📖 Study</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setGlassMode(p => !p)}>
                      <Gem className="w-4 h-4 mr-2" /> {glassMode ? 'Disable' : 'Enable'} Glass
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={toggleDark}>
                      {isDark ? <Sun className="w-4 h-4 mr-2" /> : <Moon className="w-4 h-4 mr-2" />}
                      {isDark ? 'Light' : 'Dark'} Mode
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowThemePicker(true)}><LayoutGrid className="w-4 h-4 mr-2" /> UI Themes</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleReset}><RotateCcw className="w-4 h-4 mr-2" /> Reset</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/notebooks')}><FileText className="w-4 h-4 mr-2" /> My Notebooks</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/feedback')}><MessageSquare className="w-4 h-4 mr-2" /> Feedback 💬</DropdownMenuItem>
                    {!premium.isPremium && <DropdownMenuItem onClick={() => navigate('/payment')}><Crown className="w-4 h-4 mr-2" /> Upgrade to Premium ✨</DropdownMenuItem>}
                    {!premium.isPremium && (() => {
                      const aiAccess = premium.checkFeatureAccess('ai_solver');
                      return aiAccess.limit < Infinity ? (
                        <div className="px-2 py-1.5 text-[10px] text-amber-600 flex items-center gap-1.5">
                          <Zap className="h-3 w-3" /> AI: {aiAccess.limit - aiAccess.used}/{aiAccess.limit} free left today
                        </div>
                      ) : null;
                    })()}
                    {user ? <DropdownMenuItem onClick={() => navigate('/account')}>👤 Account</DropdownMenuItem>
                      : <DropdownMenuItem onClick={() => navigate('/login')}><LogIn className="w-4 h-4 mr-2" /> Sign In</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                {/* Desktop: AI Solver glow button */}
                <motion.div whileTap={{ scale: 0.93 }} whileHover={{ scale: 1.04 }}>
                  <button
                    onClick={() => navigate('/ai')}
                    className="relative group flex items-center gap-2 h-9 px-5 rounded-full font-semibold text-xs text-white bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 shadow-[0_0_20px_rgba(127,90,240,0.4)] hover:shadow-[0_0_30px_rgba(127,90,240,0.6)] transition-all"
                  >
                    <span className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 blur-md transition-opacity -z-10" />
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    AI 4.0
                  </button>
                </motion.div>

                {/* DNA Scanner button */}
                <motion.div whileTap={{ scale: 0.93 }} whileHover={{ scale: 1.04 }}>
                  <button
                    onClick={() => setShowScanPanel(true)}
                    className="flex items-center gap-2 h-9 px-4 rounded-full font-semibold text-xs text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-[0_0_16px_rgba(16,185,129,0.3)] hover:shadow-[0_0_24px_rgba(16,185,129,0.5)] transition-all"
                  >
                    <Scan className="w-4 h-4" />
                    DNA Scan
                  </button>
                </motion.div>

                {/* AI Workspace button */}
                <motion.div whileTap={{ scale: 0.93 }} whileHover={{ scale: 1.04 }}>
                  <button
                    onClick={() => setShowAIWorkspace(true)}
                    className="flex items-center gap-2 h-9 px-4 rounded-full font-semibold text-xs text-white bg-gradient-to-r from-orange-500 to-red-500 shadow-[0_0_16px_rgba(249,115,22,0.3)] hover:shadow-[0_0_24px_rgba(249,115,22,0.5)] transition-all"
                  >
                    <Brain className="w-4 h-4" />
                    Workspace
                  </button>
                </motion.div>

                {user ? <HeaderProfileButton /> : (
                  <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="gap-1.5 rounded-full h-9 px-3 hover:bg-white/20">
                    <LogIn className="w-4 h-4" />
                    <span className="text-xs font-medium">Sign In</span>
                  </Button>
                )}

                <Toolbar onExportPDF={handleExportPDF} onReset={handleReset} isDark={isDark} onToggleDark={toggleDark} isExporting={isExporting} />
              </>
            )}
          </div>
        </div>
      </header>

      {/* ============ MOBILE SIDEBAR DRAWER — Simple, no AnimatePresence ============ */}
      {isMobile && sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/30"
            onClick={() => setSidebarOpen(false)}
            style={{ touchAction: 'manipulation' }}
          />
          <div
            className="fixed left-0 top-0 bottom-0 w-[280px] z-[61] bg-white shadow-2xl"
            style={{ transition: 'transform 0.3s ease' }}
          >
            <React.Suspense fallback={<div className="w-[240px] h-full bg-gray-50 animate-pulse" />}><WorkspaceSidebar isOpen={true} onToggle={() => setSidebarOpen(false)} onOpenCommandPalette={() => setShowCommandPalette(true)} /></React.Suspense>
          </div>
        </>
      )}

      {/* ============ BODY: 3-PANE LAYOUT ============ */}
      <div className={cn(
        "flex flex-1 min-h-0 gap-3",
        isMobile ? "" : "mt-2 mx-3 mb-3 overflow-hidden"
      )}>

        {/* LEFT SIDEBAR — desktop only */}
        {!isMobile && (
          <AnimatePresence>
            {sidebarOpen && (
              <div className="rounded-2xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
                <React.Suspense fallback={<div className="w-[240px] h-full bg-white/30 animate-pulse rounded-2xl" />}><WorkspaceSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(false)} onOpenCommandPalette={() => setShowCommandPalette(true)} /></React.Suspense>
              </div>
            )}
          </AnimatePresence>
        )}

        {/* ======== CENTER CONTENT ======== */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0 gap-3",
          isMobile ? "" : "overflow-hidden"
        )}>

          {/* Page Bar */}
          <div className={cn(
            "flex-shrink-0 rounded-2xl bg-white/20 backdrop-blur-xl border border-white/25 shadow-sm px-3 py-1.5",
            isMobile && "rounded-none border-0 border-b border-gray-100 bg-white/95 py-1"
          )}>
            <div className="max-w-4xl mx-auto">
              <PageBar
                currentPage={currentPageIndex + 1}
                totalPages={totalPages}
                onPrevPage={handlePrevPage}
                onNextPage={handleNextPage}
                onAddPage={handleAddPage}
                onDeletePage={handleDeletePage}
                canGoPrev={canGoPrev}
                canGoNext={canGoNext}
                onGoToPage={handleGoToPage}
              />
            </div>
          </div>

          {/* ---- MOBILE NOTION-STYLE INTEGRATED LAYOUT ---- */}
          {isMobile && (
            <div className="pb-24">
              {/* Mobile Floating Toolbar — above keyboard area */}
              <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-3 py-1.5"
                   style={{ touchAction: 'manipulation' }}>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                  <button 
                    onClick={() => navigate('/ai')}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r from-violet-500 to-indigo-500 shadow-sm flex-shrink-0 active:scale-95 transition-transform"
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
                  >
                    <Sparkles className="w-3 h-3" /> AI
                  </button>
                  <button 
                    onClick={() => setShowScanPanel(true)}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 flex-shrink-0 active:scale-95 transition-transform"
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
                  >
                    <Scan className="w-3 h-3" /> DNA
                  </button>
                  <button 
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-200 flex-shrink-0 active:scale-95 transition-transform disabled:opacity-40"
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
                  >
                    <FileDown className="w-3 h-3" /> PDF
                  </button>
                  <button 
                    onClick={() => setShowShareMenu(v => !v)}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-200 flex-shrink-0 active:scale-95 transition-transform"
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
                  >
                    <Share2 className="w-3 h-3" /> Share
                  </button>
                  <button 
                    onClick={() => setShowAIWorkspace(true)}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium text-orange-600 bg-orange-50 border border-orange-200 flex-shrink-0 active:scale-95 transition-transform"
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
                  >
                    <Brain className="w-3 h-3" /> Workspace
                  </button>
                </div>
              </div>

              {/* Mobile Page Title — Notion style */}
              <div className="px-4 pt-4 pb-0">
                <textarea
                  defaultValue="Untitled"
                  className="w-full text-[22px] font-bold bg-transparent border-0 outline-none resize-none text-gray-900 placeholder:text-gray-300 leading-tight"
                  rows={1}
                  style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                  onChange={(e) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                />
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-0.5 pb-2">
                  <span>{blockEditor.blocks.reduce((t, b) => t + b.content.trim().split(/\s+/).filter(Boolean).length, 0)} words</span>
                  <span className="text-gray-300">·</span>
                  <span>Page {currentPageIndex + 1} of {totalPages}</span>
                  <span className="text-gray-300">·</span>
                  <span>{blockEditor.blocks.length} blocks</span>
                </div>
              </div>

              {/* Mobile Notion Editor — Full width, clean */}
              <div className="px-2 pb-4">
                <NotionEditor
                  blocks={blockEditor.blocks}
                  onBlocksChange={blockEditor.setBlocks}
                  currentColor={currentColor}
                  onColorChange={handleColorChange}
                  onAIAction={() => setShowAIWorkspace(true)}
                  onOCRAction={() => setShowScanPanel(true)}
                  onExport={handleExportPDF}
                  dna={dnaContext.dna}
                  settings={settings}
                  pageNumber={currentPageIndex + 1}
                  totalPages={totalPages}
                />
              </div>

              {/* Mobile Handwriting Preview — Premium styled card */}
              {hasContent && (
                <div className="px-3 pb-4">
                  <div className="preview-card">
                    <div className="preview-card-header">
                      <span className="flex items-center gap-2 text-[12px] font-bold text-violet-700">✍️ Handwriting Preview</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleExportPDF}
                          disabled={isExporting}
                          className="flex items-center gap-1 h-6 px-2 rounded-lg text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 active:scale-95 transition-transform disabled:opacity-40"
                          style={{ touchAction: 'manipulation', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                        >
                          <FileDown className="w-3 h-3" /> PDF
                        </button>
                        <button
                          onClick={() => {
                            const el = document.getElementById('mobile-preview-section');
                            if (el) el.classList.toggle('hidden');
                          }}
                          className="flex items-center justify-center w-6 h-6 rounded-lg text-gray-400 hover:bg-gray-100 active:scale-95 transition-transform"
                          style={{ touchAction: 'manipulation', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div id="mobile-preview-section" className="max-h-[400px] overflow-y-auto">
                      <NotebookPreview
                        ref={previewRef}
                        lines={previewLines}
                        settings={settings}
                        realPenMode={realPenMode}
                        pageNumber={currentPageIndex + 1}
                        totalPages={totalPages}
                        inlineContent={inlineContent}
                        onUpdateContent={updateContent}
                        onDeleteContent={removeContent}
                        dna={dnaContext.dna}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile Share Menu — Simple, no AnimatePresence (touch fix) */}
              {showShareMenu && (
                <>
                  <div
                    className="fixed inset-0 z-[70] bg-black/30"
                    onClick={() => setShowShareMenu(false)}
                    style={{ touchAction: 'manipulation' }}
                  />
                  <div
                    className="fixed bottom-0 left-0 right-0 z-[71] bg-white rounded-t-2xl shadow-2xl p-5"
                  >
                    <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Share Notes</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={handleShareImage}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-medium active:scale-95 transition-transform"
                        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
                      >
                        <Image className="w-4 h-4" /> As Image
                      </button>
                      <button 
                        onClick={handleSharePDF}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-50 text-blue-700 text-sm font-medium active:scale-95 transition-transform"
                        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer' }}
                      >
                        <FileText className="w-4 h-4" /> As PDF
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ---- DESKTOP NOTION-STYLE LAYOUT ---- */}
          {!isMobile && (
            <div className="flex-1 flex overflow-hidden min-h-0 gap-0">
              {/* MAIN CONTENT — Notion-style integrated editor + preview */}
              <div className="flex-1 overflow-hidden flex flex-col min-w-0">
                <ScrollArea className="flex-1">
                  <div className="max-w-[900px] mx-auto px-6 py-4">
                    {/* Notion-style integrated editor */}
                    <motion.div
                      key={currentPage.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "rounded-2xl bg-white/60 backdrop-blur-xl border border-white/30 shadow-sm min-h-[calc(100vh-12rem)]",
                        moodStyles.paper
                      )}
                    >
                      {/* Page title area */}
                      <div className="px-8 pt-6 pb-2">
                        <textarea
                          defaultValue="Untitled"
                          className="w-full text-3xl font-bold bg-transparent border-0 outline-none resize-none text-foreground placeholder:text-muted-foreground/30"
                          rows={1}
                          onChange={(e) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                        />
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                          <span>{blockEditor.blocks.reduce((t, b) => t + b.content.trim().split(/\s+/).filter(Boolean).length, 0)} words</span>
                          <span>•</span>
                          <span>Page {currentPageIndex + 1}/{totalPages}</span>
                          <span>•</span>
                          <span>{blockEditor.blocks.length} blocks</span>
                        </div>
                      </div>

                      {/* Integrated Notion Editor */}
                      <div className="px-8 pb-8">
                        <NotionEditor
                          blocks={blockEditor.blocks}
                          onBlocksChange={blockEditor.setBlocks}
                          currentColor={currentColor}
                          onColorChange={handleColorChange}
                          onAIAction={(action) => {
                            setShowAIWorkspace(true);
                          }}
                          onOCRAction={() => setShowScanPanel(true)}
                          onExport={handleExportPDF}
                          dna={dnaContext.dna}
                          settings={settings}
                          pageNumber={currentPageIndex + 1}
                          totalPages={totalPages}
                        />
                      </div>

                      {/* Handwriting preview — Premium styled card */}
                      {hasContent && (
                        <div className="mx-8 mb-6">
                          <div className="preview-card">
                            <div className="preview-card-header">
                              <span className="flex items-center gap-2 text-[11px] font-bold text-violet-700">✍️ Handwriting Preview</span>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={handleExportPDF} disabled={isExporting} className="h-6 px-2 text-[10px] rounded-lg gap-1">
                                  <FileDown className="w-3 h-3" /> PDF
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setShowShareMenu(v => !v)} className="h-6 px-2 text-[10px] rounded-lg gap-1">
                                  <Share2 className="w-3 h-3" /> Share
                                </Button>
                              </div>
                            </div>
                            <div className="max-h-[500px] overflow-y-auto">
                              <NotebookPreview
                                ref={previewRef}
                                lines={previewLines}
                                settings={settings}
                              realPenMode={realPenMode}
                              pageNumber={currentPageIndex + 1}
                              totalPages={totalPages}
                              inlineContent={inlineContent}
                              onUpdateContent={updateContent}
                              onDeleteContent={removeContent}
                              dna={dnaContext.dna}
                            />
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>

                    {/* Smart suggestions below */}
                    <div className="mt-3">
                      <React.Suspense fallback={null}>
                        <SmartEditor
                          currentText={blockEditor.blocks.map(b => b.content).join('\n')}
                          onAccept={(suggestion: EditorSuggestion) => {
                            if (suggestion.insertText) {
                              const lastBlock = blockEditor.blocks[blockEditor.blocks.length - 1];
                              if (lastBlock) {
                                blockEditor.setBlocks(
                                  blockEditor.blocks.map(b =>
                                    b.id === lastBlock.id
                                      ? { ...b, content: b.content + suggestion.insertText }
                                      : b
                                  )
                                );
                              }
                            }
                            toast.success('💡 ' + suggestion.label);
                          }}
                          isFocused={editorFocused}
                        />
                      </React.Suspense>
                    </div>
                  </div>
                </ScrollArea>
              </div>

              {/* RIGHT SIDEBAR — Compact tools panel */}
              <div className="w-[260px] xl:w-[280px] flex-shrink-0 border-l border-border/30 bg-white/30 backdrop-blur-xl overflow-hidden flex flex-col">
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-3">
                    {/* Quick tools */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button variant="ghost" size="sm" onClick={() => setShowAIWorkspace(true)} className="h-8 px-2.5 rounded-xl text-[10px] gap-1 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
                        <Brain className="w-3 h-3 text-purple-500" /> AI Workspace
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowScanPanel(true)} className="h-8 px-2.5 rounded-xl text-[10px] gap-1 bg-emerald-50 border border-emerald-100">
                        <Scan className="w-3 h-3 text-emerald-500" /> DNA Scan
                      </Button>
                    </div>

                    {/* Pen Palette - compact */}
                    <PenPalette
                      currentColor={currentColor}
                      onColorChange={handleColorChange}
                      selectedCount={selectedLines.size}
                      onUndo={handleUndo}
                      onRedo={handleRedo}
                      canUndo={firstSelectedLineId ? canUndo(firstSelectedLineId) : false}
                      canRedo={firstSelectedLineId ? canRedo(firstSelectedLineId) : false}
                      realPenMode={realPenMode}
                      onRealPenModeChange={setRealPenMode}
                      currentText={getPlainText()}
                      onInsertText={(text) => handlePaste(text)}
                      premiumLocked={!premium.isPremium}
                      onPremiumTap={() => requirePremium('handwriting_styles')}
                    />

                    {/* Page Controls */}
                    <div>
                      <Button variant="ghost" size="sm" onClick={() => setShowControls(!showControls)} className="w-full gap-2 rounded-xl text-xs hover:bg-white/20">
                        <Settings2 className="w-4 h-4" /> {showControls ? 'Hide' : 'Show'} Page Settings
                      </Button>
                      <AnimatePresence>
                        {showControls && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden">
                            <React.Suspense fallback={<div className="h-20 bg-muted/10 rounded-xl animate-pulse" />}><ControlPanel {...controlPanelProps} /></React.Suspense>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Quick Export */}
                    <div className="p-3 rounded-xl bg-white/30 border border-white/20">
                      <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Export</h4>
                      <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting} className="gap-1.5 rounded-xl text-xs w-full bg-white/30">
                        <FileDown className="w-3.5 h-3.5" /> {isExporting ? 'Exporting...' : 'Export PDF'}
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* ============ MOBILE PANELS ============ */}
      <SlidePanel isOpen={showPenPanel} onClose={() => setShowPenPanel(false)} title="Pen Palette" icon={<Palette className="w-4 h-4 text-primary" />} side="right">
        <PenPalette currentColor={currentColor} onColorChange={handleColorChange} selectedCount={selectedLines.size} onUndo={handleUndo} onRedo={handleRedo} canUndo={firstSelectedLineId ? canUndo(firstSelectedLineId) : false} canRedo={firstSelectedLineId ? canRedo(firstSelectedLineId) : false} realPenMode={realPenMode} onRealPenModeChange={setRealPenMode} currentText={getPlainText()} onInsertText={(text) => handlePaste(text)} premiumLocked={!premium.isPremium} onPremiumTap={() => requirePremium('ai_text_tools')} />
      </SlidePanel>

      <SlidePanel isOpen={showStylePanel} onClose={() => setShowStylePanel(false)} title="Page Style" icon={<Settings2 className="w-4 h-4 text-primary" />} side="right">
        <React.Suspense fallback={<div className="h-20 bg-muted/10 rounded-xl animate-pulse" />}><ControlPanel {...controlPanelProps} /></React.Suspense>
      </SlidePanel>

      {/* Handwriting DNA Scanner Panel */}
      <SlidePanel isOpen={showScanPanel} onClose={() => setShowScanPanel(false)} title="Handwriting DNA Scanner" icon={<Scan className="w-4 h-4 text-emerald-500" />} side="right">
        <React.Suspense fallback={<div className="p-6 text-center text-sm text-muted-foreground">Loading Scanner...</div>}>
          <HandwritingScanner
            onDNAExtracted={(dna) => {
              dnaContext.updateDNA(dna);
              setShowScanPanel(false);
              toast.success(`✅ ${dna.styleName} DNA applied!`);
            }}
            onClose={() => setShowScanPanel(false)}
          />
        </React.Suspense>
      </SlidePanel>

      {/* Command Palette (Cmd+K) */}
      <React.Suspense fallback={null}>
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onNewNote={() => { setShowCommandPalette(false); }}
          onToggleTheme={toggleDark}
          onToggleSidebar={() => setSidebarOpen(p => !p)}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <MobileStyleSheet
          isOpen={showMobileStyleSheet}
          onClose={() => setShowMobileStyleSheet(false)}
          settings={settings}
          updateSettings={updateSettings}
          currentColor={currentColor}
          onColorChange={handleColorChange}
          realPenMode={realPenMode}
          onRealPenModeChange={setRealPenMode}
          isListening={quickDictation.isListening}
          onToggleVoice={() => {
            if (!premium.isPremium) { requirePremium('voice_to_notes'); return; }
            if (!quickDictation.isSupported) return;
            if (quickDictation.isListening) quickDictation.stop(); else quickDictation.start();
          }}
        />
      </React.Suspense>

      {/* Quick Styles Bar (mobile) */}
      {isMobile && mobileTab === 'write' && (
        <QuickStylesBar
          isVisible={editorFocused}
          currentColor={currentColor}
          currentFont={settings.font}
          onColorChange={handleColorChange}
          onFontChange={(font) => updateSettings({ font })}
          onOpenStyleSheet={() => setShowMobileStyleSheet(true)}
        />
      )}

      {/* Mobile Bottom Nav */}
      {isMobile && <MobileBottomNav activeTab={mobileTab} onTabChange={handleMobileTabChange} />}

      {/* Offscreen export DOM */}
      {exportMount && (
        <div ref={exportContainerRef} className="fixed left-[-10000px] top-0 pointer-events-none opacity-0" aria-hidden="true">
          <div className="flex flex-col gap-6">
            {pages.map((page, idx) => (
              <div key={page.id} style={{ width: 794, height: 1123 }}>
                <NotebookPreview lines={page.lines} settings={settings} realPenMode={realPenMode} pageNumber={idx + 1} totalPages={pages.length} forExport />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UI Theme Picker Modal */}
      <AnimatePresence>
        {showThemePicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[70]"
              onClick={() => setShowThemePicker(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-[10%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px] z-[71] bg-white/95 backdrop-blur-2xl rounded-2xl border border-white/30 shadow-2xl p-6 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-primary" />
                  UI Design System
                </h3>
                <button onClick={() => setShowThemePicker(false)} aria-label="Close theme picker" className="w-8 h-8 rounded-xl bg-muted/50 flex items-center justify-center hover:bg-muted">
                  ×
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Choose a design language for your workspace</p>
              <div className="grid grid-cols-2 gap-3">
                {UI_THEMES.map((t) => (
                  <motion.button
                    key={t.value}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setUITheme(t.value); setShowThemePicker(false); toast.success(`${t.emoji} ${t.label} applied!`); }}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left",
                      uiTheme === t.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/50 hover:border-primary/40"
                    )}
                  >
                    <span className="text-2xl mb-1">{t.emoji}</span>
                    <span className="text-sm font-semibold text-foreground">{t.label}</span>
                    <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <PaywallModal open={paywallOpen} onOpenChange={setPaywallOpen} />

      {/* AI Workspace Panel — Agents, Knowledge, Workflows */}
      <React.Suspense fallback={null}>
        <AIWorkspacePanel
          isOpen={showAIWorkspace}
          onClose={() => setShowAIWorkspace(false)}
          onInsertContent={(content) => {
            // Insert AI content as new blocks
            const lines = content.split('\n').filter(l => l.trim());
            const newBlocks = lines.map(line => ({
              id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: line.startsWith('#') ? 'heading2' : line.startsWith('-') ? 'bullet' : 'text' as any,
              content: line.replace(/^#+\s/, '').replace(/^[-*]\s/, ''),
              color: currentColor,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }));
            blockEditor.setBlocks([...blockEditor.blocks, ...newBlocks]);
            toast.success('AI content inserted! ✍️');
          }}
        />
      </React.Suspense>
    </div>
  );
};

export default Index;
