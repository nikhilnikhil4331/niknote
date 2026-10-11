import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Palette, Type, Sparkles, Mic, MicOff, FileText } from 'lucide-react';
import { NoteSettings, FONT_OPTIONS, PAGE_STYLE_OPTIONS } from '@/types/notes';
import { LineInkColor, LINE_INK_COLORS } from '@/types/noteLine';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { PaperEffectsControls } from '@/components/paper/PaperEffects';

interface MobileStyleSheetProps {
  isOpen: boolean;
  onClose: () => void;
  settings: NoteSettings;
  updateSettings: (updates: Partial<NoteSettings>) => void;
  currentColor: LineInkColor;
  onColorChange: (color: LineInkColor) => void;
  realPenMode: boolean;
  onRealPenModeChange: (enabled: boolean) => void;
  // Voice input
  isListening?: boolean;
  onToggleVoice?: () => void;
  voiceSupported?: boolean;
}

export const MobileStyleSheet: React.FC<MobileStyleSheetProps> = ({
  isOpen, onClose, settings, updateSettings, currentColor, onColorChange, 
  realPenMode, onRealPenModeChange, isListening, onToggleVoice, voiceSupported = true,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 300) onClose();
            }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl rounded-t-3xl border-t border-border/50 shadow-2xl"
            style={{ maxHeight: '75vh' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-border/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Palette className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold text-base">Style Settings</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-xl">
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Content */}
            <ScrollArea className="h-[calc(75vh-80px)]">
              <div className="p-5 space-y-6">
                {/* INK COLORS */}
                <section>
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Palette className="w-3 h-3" /> Ink Colors
                  </Label>
                  <div className="grid grid-cols-4 gap-2">
                    {LINE_INK_COLORS.map((ink) => (
                      <motion.button
                        key={ink.value}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => onColorChange(ink.value)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-all",
                          currentColor === ink.value
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-transparent hover:bg-muted/50"
                        )}
                      >
                        <div className="w-7 h-7 rounded-full shadow-inner" style={{ backgroundColor: ink.hex }} />
                        <span className="text-[9px] font-medium text-muted-foreground">{ink.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </section>

                {/* FONT SELECTION */}
                <section>
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Type className="w-3 h-3" /> Font Style
                  </Label>
                  <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                    {FONT_OPTIONS.filter(f => f.value !== 'custom').map((font) => (
                      <motion.button
                        key={font.value}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => updateSettings({ font: font.value })}
                        className={cn(
                          "p-3 rounded-xl border-2 text-left transition-all",
                          settings.font === font.value
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-primary/40"
                        )}
                      >
                        <span className="text-[10px] text-muted-foreground block mb-1">{font.label}</span>
                        <span className={cn(font.className, "text-base leading-tight block truncate")}>
                          Hello world
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </section>

                {/* PAPER TYPE */}
                <section>
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Paper Type
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {PAGE_STYLE_OPTIONS.map((style) => (
                      <motion.button
                        key={style.value}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => updateSettings({ pageStyle: style.value })}
                        className={cn(
                          "flex flex-col items-center p-2.5 rounded-xl border-2 transition-all",
                          settings.pageStyle === style.value
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-primary/40"
                        )}
                      >
                        <span className="text-xs font-medium">{style.label}</span>
                        <span className="text-[9px] text-muted-foreground">{style.description}</span>
                      </motion.button>
                    ))}
                  </div>
                </section>

                {/* PEN & EFFECTS */}
                <section>
                  <PaperEffectsControls fx={settings.paperEffects} pen={settings.penType} onChange={updateSettings} />
                </section>

                {/* SPACING & SIZE */}
                <section>
                  <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
                    Spacing & Size
                  </Label>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs text-foreground">Font Size</span>
                        <span className="text-xs font-medium text-primary">{settings.fontSize}px</span>
                      </div>
                      <Slider value={[settings.fontSize]} onValueChange={([v]) => updateSettings({ fontSize: v })} min={16} max={40} step={1} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs text-foreground">Line Spacing</span>
                        <span className="text-xs font-medium text-primary">{settings.lineSpacing}px</span>
                      </div>
                      <Slider value={[settings.lineSpacing]} onValueChange={([v]) => updateSettings({ lineSpacing: v })} min={24} max={60} step={2} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs text-foreground">Word Spacing</span>
                        <span className="text-xs font-medium text-primary">{settings.wordSpacing}px</span>
                      </div>
                      <Slider value={[settings.wordSpacing]} onValueChange={([v]) => updateSettings({ wordSpacing: v })} min={2} max={12} step={1} />
                    </div>
                  </div>
                </section>

                {/* VOICE INPUT */}
                {onToggleVoice && (
                  <section>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={onToggleVoice}
                      className={cn(
                        "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all",
                        isListening
                          ? "border-red-500/50 bg-red-500/10"
                          : "border-border/50 hover:border-primary/40"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        isListening ? "bg-red-500/20" : "bg-primary/10"
                      )}>
                        {isListening ? <MicOff className="w-5 h-5 text-red-500" /> : <Mic className="w-5 h-5 text-primary" />}
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-medium block">
                          {isListening ? 'Stop Listening' : 'Voice Input'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {isListening ? 'Tap to stop dictation' : 'Speak to type hands-free'}
                        </span>
                      </div>
                    </motion.button>
                  </section>
                )}

                {/* REAL PEN MODE */}
                <section>
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-accent" />
                      <div>
                        <span className="text-xs font-medium">Real Pen Mode</span>
                        <p className="text-[10px] text-muted-foreground">Varies ink shade & thickness</p>
                      </div>
                    </div>
                    <Switch checked={realPenMode} onCheckedChange={onRealPenModeChange} />
                  </div>
                </section>

                <div className="h-8" />
              </div>
            </ScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
