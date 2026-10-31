import React from 'react';
import { LineInkColor, LINE_INK_COLORS } from '@/types/noteLine';
import { Mic, MicOff, Pen, Redo2, Sparkles, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AIWritingAssistant } from './AIWritingAssistant';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';

interface PenPaletteProps {
  currentColor: LineInkColor;
  onColorChange: (color: LineInkColor) => void;
  selectedCount: number;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  realPenMode: boolean;
  onRealPenModeChange: (enabled: boolean) => void;
  currentText?: string;
  onInsertText?: (text: string) => void;
  /** Preferred path: insert organised (structured) note lines. */
  onInsertStructured?: (lines: import('@/lib/noteStructure').StructuredLine[]) => void;
  showAiAssistant?: boolean;
  premiumLocked?: boolean;
  onPremiumTap?: () => void;
}

export const PenPalette: React.FC<PenPaletteProps> = ({
  currentColor,
  onColorChange,
  selectedCount,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  realPenMode,
  onRealPenModeChange,
  currentText = '',
  onInsertText,
  onInsertStructured,
  showAiAssistant = true,
  premiumLocked = false,
  onPremiumTap,
}) => {
  const dictation = useSpeechDictation({
    onFinalTranscript: (text) => {
      onInsertText?.(text);
    },
  });

  return (
    <div className="flex flex-col gap-4 p-4 bg-surface/30 backdrop-blur-sm rounded-2xl border border-[color:var(--nk-glass-border)] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Pen className="w-4 h-4 text-accent-rose" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">Pen Palette</h3>
            <p className="text-[11px] text-muted-foreground">
              {selectedCount > 0 ? `${selectedCount} line(s) selected` : 'Select a line'}
            </p>
          </div>
        </div>

        {showAiAssistant && onInsertText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <AIWritingAssistant
                    currentText={currentText}
                    onInsertText={onInsertText}
                    onInsertStructured={onInsertStructured}
                    locked={premiumLocked}
                    onLockedTap={onPremiumTap}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">AI Writing Assistant</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Voice to text */}
      {onInsertText && (
        <div className="p-3 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-foreground">Dictation</p>
              <p className="text-[10px] text-muted-foreground">Speak and we’ll insert the text into your note</p>
            </div>

            <Button
              type="button"
              variant={dictation.isListening ? 'default' : 'outline'}
              size="sm"
              className="gap-2 rounded-xl"
              onClick={async () => {
                if (premiumLocked) {
                  onPremiumTap?.();
                  return;
                }
                if (!dictation.isSupported) return;
                if (dictation.isListening) {
                  dictation.stop();
                } else {
                  await dictation.start();
                }
              }}
              disabled={!dictation.isSupported}
              title={
                !dictation.isSupported
                  ? 'Dictation is not supported in this browser'
                  : dictation.isListening
                    ? 'Stop dictation'
                    : 'Start dictation'
              }
            >
              {dictation.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span className="text-xs">
                {premiumLocked ? 'Premium' : dictation.isListening ? 'Stop' : 'Dictate'}
              </span>
            </Button>
          </div>

          {(dictation.interimTranscript || dictation.errorMessage) && (
            <div className="mt-2 text-[11px] leading-relaxed">
              {dictation.errorMessage ? (
                <p className="text-destructive">{dictation.errorMessage}</p>
              ) : (
                <p className="text-muted-foreground">
                  <span className="font-medium">Listening:</span> {dictation.interimTranscript}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Pen Colors */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Ink Colors
        </label>
        <div className="grid grid-cols-3 gap-1.5 max-h-[180px] overflow-y-auto scrollbar-hide p-1">
          <TooltipProvider>
            {LINE_INK_COLORS.map((ink) => (
              <Tooltip key={ink.value}>
                <TooltipTrigger asChild>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onColorChange(ink.value);
                    }}
                    className={
                      `
                      relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all duration-200
                      ${currentColor === ink.value
                        ? 'border-primary bg-primary/5 shadow-sm scale-105'
                        : 'border-transparent hover:border-border hover:bg-muted/50'
                      }
                    `
                    }
                  >
                    <div
                      className="w-7 h-7 rounded-full shadow-inner flex items-center justify-center"
                      style={{ backgroundColor: ink.hex }}
                    >
                      {currentColor === ink.value && <Pen className="w-3 h-3 text-white/90" />}
                    </div>
                    <span className="text-[10px] font-medium text-foreground truncate w-full text-center">{ink.label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Switch to {ink.label} ink</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      </div>

      {/* Real Pen Mode */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <div>
            <span className="text-xs font-medium text-foreground">Real Pen Mode</span>
            <p className="text-[10px] text-muted-foreground">Varies ink shade & thickness</p>
          </div>
        </div>
        <Switch
          checked={realPenMode}
          onCheckedChange={onRealPenModeChange}
          className="data-[state=checked]:bg-accent"
        />
      </div>

      {/* Undo/Redo */}
      <div className="flex gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                className="flex-1 gap-1.5 rounded-xl"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="text-xs">Undo</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo last change on selected line</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onRedo}
                disabled={!canRedo}
                className="flex-1 gap-1.5 rounded-xl"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span className="text-xs">Redo</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo last change on selected line</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Quick tip */}
      <div className="p-2.5 bg-muted/20 rounded-lg border border-border/50">
        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
          <strong>Tip:</strong> Hold <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">Ctrl</kbd> + click to select multiple lines
        </p>
      </div>
    </div>
  );
};
