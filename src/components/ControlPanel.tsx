import React from 'react';
import { NoteSettings, PAGE_STYLE_OPTIONS, INK_COLOR_OPTIONS, DiagramImage, PAGE_SIZE_OPTIONS } from '@/types/notes';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { FontPreviewPanel } from './FontPreviewPanel';
import { TableConfigPanel } from './TableConfigPanel';
import { DiagramImport } from './DiagramImport';
import { HandwritingAnalyzer } from './HandwritingAnalyzer';
import { HandwritingTextImporter } from './HandwritingTextImporter';
import { PaperEffectsControls } from '@/components/paper/PaperEffects';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  Type, 
  Palette, 
  FileText, 
  Sparkles,
  User,
  Hash,
  BookOpen,
  ImageIcon,
  Table2,
  Layout,
  Settings,
  Wand2,
  FileBox,
  Lock,
  Upload
} from 'lucide-react';

// Map ink colors to CSS color values for the swatches
const INK_COLOR_MAP: Record<string, string> = {
  blue: 'hsl(215 85% 40%)',
  black: 'hsl(220 20% 12%)',
  red: 'hsl(0 72% 50%)',
  green: 'hsl(145 65% 38%)',
  purple: 'hsl(265 60% 50%)',
  brown: 'hsl(25 55% 38%)',
  teal: 'hsl(175 60% 38%)',
  orange: 'hsl(28 92% 52%)',
  pink: 'hsl(340 82% 48%)',
  navy: 'hsl(230 70% 30%)',
  burgundy: 'hsl(340 85% 30%)',
  gold: 'hsl(38 95% 50%)',
};

// Group page styles by category
const groupedPageStyles = PAGE_STYLE_OPTIONS.reduce((acc, style) => {
  const category = style.category || 'Other';
  if (!acc[category]) acc[category] = [];
  acc[category].push(style);
  return acc;
}, {} as Record<string, typeof PAGE_STYLE_OPTIONS>);

interface ControlPanelProps {
  settings: NoteSettings;
  updateSettings: (updates: Partial<NoteSettings>) => void;
  updateMargins: (updates: Partial<NoteSettings['margins']>) => void;
  updateHeaderFooter: (updates: Partial<NoteSettings['headerFooter']>) => void;
  tableData: string[][];
  onTableDataChange: (data: string[][]) => void;
  diagrams: DiagramImage[];
  onAddDiagram: (diagram: DiagramImage) => void;
  onRemoveDiagram: (id: string) => void;
  onUpdateDiagram: (id: string, updates: Partial<DiagramImage>) => void;
  premiumLocked?: boolean;
  onPremiumTap?: () => void;
  onImportText?: (lines: string[]) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  updateSettings,
  updateMargins,
  updateHeaderFooter,
  tableData,
  onTableDataChange,
  diagrams,
  onAddDiagram,
  onRemoveDiagram,
  onUpdateDiagram,
  premiumLocked = false,
  onPremiumTap,
  onImportText,
}) => {
  return (
    <ScrollArea className="h-[calc(100vh-10rem)]">
      <div className="p-4">
        {/* Panel Header */}
        <div className="flex items-center gap-2.5 mb-4 px-1">
          <div className="w-8 h-8 rounded-xl gradient-bg flex items-center justify-center">
            <Settings className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">Customize</h2>
            <p className="text-[11px] text-muted-foreground">Adjust your note style</p>
          </div>
        </div>

        <Accordion type="multiple" defaultValue={["ai-analyzer", "typography", "ink-paper"]} className="space-y-2">
          {/* AI Handwriting Analyzer */}
          <AccordionItem value="ai-analyzer" className="border border-border/50 rounded-xl px-4 overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Wand2 className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="text-left">
                  <span className="font-medium text-sm">AI Style Matcher</span>
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded-full">New</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <p className="text-xs text-muted-foreground mb-3">
                Upload your handwriting and AI will analyze it to create a matching style.
              </p>
              <div className="relative">
                {premiumLocked && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center">
                    <div className="rounded-2xl border border-border/60 bg-background/80 backdrop-blur p-4 w-full">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Lock className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">Premium feature</p>
                          <p className="text-xs text-muted-foreground">Tap to unlock AI Style Matcher</p>
                        </div>
                      </div>
                      <Button onClick={onPremiumTap} className="w-full mt-3 rounded-xl" size="sm">
                        Unlock Premium
                      </Button>
                    </div>
                  </div>
                )}

                <div className={premiumLocked ? 'pointer-events-none opacity-40' : ''}>
                  <HandwritingAnalyzer
                    onApplyStyle={(newSettings) => {
                      Object.entries(newSettings).forEach(([key, value]) => {
                        if (value !== undefined) {
                          updateSettings({ [key]: value } as Partial<NoteSettings>);
                        }
                      });
                    }}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Handwriting Text Importer */}
          {onImportText && (
            <AccordionItem value="text-importer" className="border border-border/50 rounded-xl px-4 overflow-hidden bg-gradient-to-br from-accent/5 to-primary/5">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                    <Upload className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="text-left">
                    <span className="font-medium text-sm">Import Handwriting</span>
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded-full">OCR</span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Upload a photo of handwritten notes and AI will extract the text.
                </p>
                <div className="relative">
                  {premiumLocked && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                      <div className="rounded-2xl border border-border/60 bg-background/80 backdrop-blur p-4 w-full">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Lock className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">Premium feature</p>
                            <p className="text-xs text-muted-foreground">Tap to unlock Handwriting Import</p>
                          </div>
                        </div>
                        <Button onClick={onPremiumTap} className="w-full mt-3 rounded-xl" size="sm">
                          Unlock Premium
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className={premiumLocked ? 'pointer-events-none opacity-40' : ''}>
                    <HandwritingTextImporter onImportText={onImportText} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Typography */}
          <AccordionItem value="typography" className="border border-border/50 rounded-xl px-4 overflow-hidden bg-secondary/20">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Type className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="font-medium text-sm">Typography</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-5">
                <div>
                  <Label className="control-label">Handwriting Style</Label>
                  <FontPreviewPanel
                    selectedFont={settings.font}
                    onSelectFont={(font) => updateSettings({ font })}
                    inkColor={settings.inkColor}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="control-label mb-0">Font Size</Label>
                    <span className="text-xs font-medium text-primary">{settings.fontSize}px</span>
                  </div>
                  <Slider
                    value={[settings.fontSize]}
                    onValueChange={([value]) => updateSettings({ fontSize: value })}
                    min={16}
                    max={40}
                    step={1}
                    className="mt-1"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="control-label mb-0">Line Spacing</Label>
                    <span className="text-xs font-medium text-primary">{settings.lineSpacing}px</span>
                  </div>
                  <Slider
                    value={[settings.lineSpacing]}
                    onValueChange={([value]) => updateSettings({ lineSpacing: value })}
                    min={24}
                    max={60}
                    step={2}
                    className="mt-1"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label className="control-label mb-0">Word Spacing</Label>
                    <span className="text-xs font-medium text-primary">{settings.wordSpacing}px</span>
                  </div>
                  <Slider
                    value={[settings.wordSpacing]}
                    onValueChange={([value]) => updateSettings({ wordSpacing: value })}
                    min={2}
                    max={12}
                    step={1}
                    className="mt-1"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Ink & Paper */}
          <AccordionItem value="ink-paper" className="border border-border/50 rounded-xl px-4 overflow-hidden bg-secondary/20">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Palette className="w-3.5 h-3.5 text-accent" />
                </div>
                <span className="font-medium text-sm">Ink & Paper</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-5">
                <div>
                  <Label className="control-label">Ink Color</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {INK_COLOR_OPTIONS.map((ink) => (
                      <button
                        key={ink.value}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateSettings({ inkColor: ink.value });
                        }}
                        className={`
                          selection-btn
                          ${settings.inkColor === ink.value 
                            ? 'selection-btn-active' 
                            : 'selection-btn-inactive'
                          }
                        `}
                      >
                        <div 
                          className="w-5 h-5 rounded-full shadow-inner ring-1 ring-black/5"
                          style={{ backgroundColor: INK_COLOR_MAP[ink.value] || ink.value }}
                        />
                        <span className="text-[10px] text-muted-foreground font-medium">{ink.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="control-label">Page Style</Label>
                  <div className="space-y-3 mt-2 max-h-[300px] overflow-y-auto scrollbar-hide">
                    {Object.entries(groupedPageStyles).map(([category, styles]) => (
                      <div key={category}>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">{category}</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          {styles.map((style) => (
                            <button
                              key={style.value}
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                updateSettings({ pageStyle: style.value });
                              }}
                              className={`
                                flex flex-col items-start p-2.5 rounded-xl border-2 transition-all text-left
                                ${settings.pageStyle === style.value 
                                  ? 'border-primary bg-primary/5 shadow-sm' 
                                  : 'border-border/50 hover:border-primary/40 hover:bg-secondary/50'
                                }
                              `}
                            >
                              <span className="text-xs font-semibold text-foreground">{style.label}</span>
                              <span className="text-[9px] text-muted-foreground mt-0.5">{style.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-2">
                  <PaperEffectsControls fx={settings.paperEffects} pen={settings.penType} onChange={updateSettings} />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Page Size */}
          <AccordionItem value="page-size" className="border border-border/50 rounded-xl px-4 overflow-hidden bg-secondary/20">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                  <FileBox className="w-3.5 h-3.5 text-accent" />
                </div>
                <span className="font-medium text-sm">Page Size</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid grid-cols-2 gap-2">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size.value}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      updateSettings({ pageSize: size.value });
                    }}
                    className={`
                      flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left
                      ${settings.pageSize === size.value 
                        ? 'border-primary bg-primary/5 shadow-sm' 
                        : 'border-border/50 hover:border-primary/40 hover:bg-secondary/50'
                      }
                    `}
                  >
                    <span className="text-sm font-semibold text-foreground">{size.label}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{size.description}</span>
                  </button>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Margins */}
          <AccordionItem value="margins" className="border border-border/50 rounded-xl px-4 overflow-hidden bg-secondary/20">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Layout className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="font-medium text-sm">Page Margins</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid grid-cols-2 gap-4">
                {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                  <div key={side}>
                    <div className="flex justify-between items-center mb-1.5">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold capitalize">{side}</Label>
                      <span className="text-[10px] font-medium text-primary">{settings.margins[side]}px</span>
                    </div>
                    <Slider
                      value={[settings.margins[side]]}
                      onValueChange={([value]) => updateMargins({ [side]: value })}
                      min={20}
                      max={80}
                      step={5}
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Table */}
          <AccordionItem value="table" className="border border-border/50 rounded-xl px-4 overflow-hidden bg-secondary/20">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Table2 className="w-3.5 h-3.5 text-accent" />
                </div>
                <span className="font-medium text-sm">Table</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <TableConfigPanel
                settings={settings}
                updateSettings={updateSettings}
                tableData={tableData}
                onTableDataChange={onTableDataChange}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Diagrams */}
          <AccordionItem value="diagrams" className="border border-border/50 rounded-xl px-4 overflow-hidden bg-secondary/20">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ImageIcon className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="font-medium text-sm">Diagrams & Images</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <DiagramImport
                diagrams={diagrams}
                onAddDiagram={onAddDiagram}
                onRemoveDiagram={onRemoveDiagram}
                onUpdateDiagram={onUpdateDiagram}
                inkColor={settings.inkColor}
              />
            </AccordionContent>
          </AccordionItem>

          {/* Effects */}
          <AccordionItem value="effects" className="border border-border/50 rounded-xl px-4 overflow-hidden bg-secondary/20">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                </div>
                <span className="font-medium text-sm">Realism Effects</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/30">
                  <div>
                    <Label className="text-sm font-medium">Baseline Jitter</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Natural line variation</p>
                  </div>
                  <Switch
                    checked={settings.baselineJitter}
                    onCheckedChange={(checked) => updateSettings({ baselineJitter: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/30">
                  <div>
                    <Label className="text-sm font-medium">Stroke Randomness</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Imperfect letter shapes</p>
                  </div>
                  <Switch
                    checked={settings.strokeRandomness}
                    onCheckedChange={(checked) => updateSettings({ strokeRandomness: checked })}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Header/Footer */}
          <AccordionItem value="header-footer" className="border border-border/50 rounded-xl px-4 overflow-hidden bg-secondary/20">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="font-medium text-sm">Header & Footer</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/30">
                  <Label className="text-sm font-medium">Show Header</Label>
                  <Switch
                    checked={settings.headerFooter.showHeader}
                    onCheckedChange={(checked) => updateHeaderFooter({ showHeader: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/30">
                  <Label className="text-sm font-medium">Page Numbers</Label>
                  <Switch
                    checked={settings.headerFooter.showPageNumber}
                    onCheckedChange={(checked) => updateHeaderFooter({ showPageNumber: checked })}
                  />
                </div>

                {settings.headerFooter.showHeader && (
                  <div className="space-y-3 mt-4 animate-fade-in">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Your Name"
                        value={settings.headerFooter.name}
                        onChange={(e) => updateHeaderFooter({ name: e.target.value })}
                        className="pl-10 rounded-xl bg-background/50 border-border/50"
                      />
                    </div>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Roll Number"
                        value={settings.headerFooter.rollNo}
                        onChange={(e) => updateHeaderFooter({ rollNo: e.target.value })}
                        className="pl-10 rounded-xl bg-background/50 border-border/50"
                      />
                    </div>
                    <div className="relative">
                      <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Subject"
                        value={settings.headerFooter.subject}
                        onChange={(e) => updateHeaderFooter({ subject: e.target.value })}
                        className="pl-10 rounded-xl bg-background/50 border-border/50"
                      />
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </ScrollArea>
  );
};
