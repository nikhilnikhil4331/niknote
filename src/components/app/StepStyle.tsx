import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Paintbrush, Type, FileText, Sliders, X, Check } from 'lucide-react';
import { NoteSettings, FONT_OPTIONS, PAGE_STYLE_OPTIONS, INK_COLOR_OPTIONS, HandwritingFont, PageStyle, InkColor } from '@/types/notes';
import { NoteLine } from '@/types/noteLine';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

interface StepStyleProps {
  settings: NoteSettings;
  onUpdateSettings: (updates: Partial<NoteSettings>) => void;
  lines: NoteLine[];
}

type StyleTab = 'colors' | 'fonts' | 'paper' | 'effects';

const TABS: { key: StyleTab; icon: React.ElementType; label: string }[] = [
  { key: 'colors', icon: Paintbrush, label: 'Ink Colors' },
  { key: 'fonts', icon: Type, label: 'Font Styles' },
  { key: 'paper', icon: FileText, label: 'Paper & Layout' },
  { key: 'effects', icon: Sliders, label: 'Effects' },
];

export const StepStyle: React.FC<StepStyleProps> = ({ settings, onUpdateSettings, lines }) => {
  const [activeTab, setActiveTab] = useState<StyleTab>('colors');

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Tab Bar */}
      <div className="flex gap-1 px-3 pt-3 pb-2 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <motion.button
              key={tab.key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </motion.button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'colors' && <ColorsSection settings={settings} onUpdate={onUpdateSettings} />}
            {activeTab === 'fonts' && <FontsSection settings={settings} onUpdate={onUpdateSettings} />}
            {activeTab === 'paper' && <PaperSection settings={settings} onUpdate={onUpdateSettings} />}
            {activeTab === 'effects' && <EffectsSection settings={settings} onUpdate={onUpdateSettings} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

/* ─── Ink Colors ───────────────────────────── */
const ColorsSection: React.FC<{ settings: NoteSettings; onUpdate: (u: Partial<NoteSettings>) => void }> = ({ settings, onUpdate }) => {
  const [rippleColor, setRippleColor] = useState<string | null>(null);

  return (
    <div className="space-y-4 pt-2">
      <SectionHeader title="Choose Ink Color" subtitle="Select the color for your handwritten text" />
      <div className="grid grid-cols-4 gap-3">
        {INK_COLOR_OPTIONS.map((color) => {
          const isSelected = settings.inkColor === color.value;
          return (
            <motion.button
              key={color.value}
              whileTap={{ scale: 0.88 }}
              onClick={() => {
                onUpdate({ inkColor: color.value });
                setRippleColor(color.hex);
                setTimeout(() => setRippleColor(null), 400);
              }}
              className={cn(
                "relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all",
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-transparent hover:bg-muted/40"
              )}
            >
              <div className="relative">
                <motion.div
                  className="w-10 h-10 rounded-xl shadow-md"
                  style={{ backgroundColor: color.hex }}
                  animate={isSelected ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.3 }}
                />
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </motion.div>
                )}
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{color.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Font Styles ──────────────────────────── */
const FontsSection: React.FC<{ settings: NoteSettings; onUpdate: (u: Partial<NoteSettings>) => void }> = ({ settings, onUpdate }) => {
  const categories = [...new Set(FONT_OPTIONS.filter(f => f.value !== 'custom').map(f => f.category))];

  return (
    <div className="space-y-5 pt-2">
      {categories.map((cat) => (
        <div key={cat}>
          <SectionHeader title={cat} subtitle={cat === 'Casual' ? 'Clean, everyday writing' : cat === 'Messy' ? 'Authentic, imperfect style' : 'Elegant, flowing scripts'} />
          <div className="grid grid-cols-2 gap-2">
            {FONT_OPTIONS.filter(f => f.category === cat).map((font) => {
              const isSelected = settings.font === font.value;
              return (
                <motion.button
                  key={font.value}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onUpdate({ font: font.value })}
                  className={cn(
                    "relative p-3 rounded-xl border-2 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/50 hover:border-border"
                  )}
                >
                  {/* Live font preview */}
                  <span className={cn(font.className, "text-lg text-foreground block truncate")}>
                    {font.label}
                  </span>
                  <span className={cn(font.className, "text-xs text-muted-foreground block mt-0.5")}>
                    The quick brown fox
                  </span>
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── Paper & Layout ───────────────────────── */
const PaperSection: React.FC<{ settings: NoteSettings; onUpdate: (u: Partial<NoteSettings>) => void }> = ({ settings, onUpdate }) => {
  const categories = [...new Set(PAGE_STYLE_OPTIONS.map(p => p.category))];

  return (
    <div className="space-y-5 pt-2">
      {categories.map((cat) => (
        <div key={cat}>
          <SectionHeader title={cat} />
          <div className="grid grid-cols-3 gap-2">
            {PAGE_STYLE_OPTIONS.filter(p => p.category === cat).map((paper) => {
              const isSelected = settings.pageStyle === paper.value;
              return (
                <motion.button
                  key={paper.value}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onUpdate({ pageStyle: paper.value })}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border/40 hover:border-border"
                  )}
                >
                  <PaperPreviewMini style={paper.value} />
                  <span className="text-[10px] font-medium text-foreground">{paper.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

/* ─── Effects ──────────────────────────────── */
const EffectsSection: React.FC<{ settings: NoteSettings; onUpdate: (u: Partial<NoteSettings>) => void }> = ({ settings, onUpdate }) => (
  <div className="space-y-6 pt-2">
    <SectionHeader title="Fine-tune Your Style" subtitle="Adjust spacing, size, and handwriting effects" />

    <SliderControl
      label="Font Size"
      value={settings.fontSize}
      min={14} max={36} step={1}
      onChange={(v) => onUpdate({ fontSize: v })}
      displayValue={`${settings.fontSize}px`}
    />
    <SliderControl
      label="Line Spacing"
      value={settings.lineSpacing}
      min={20} max={56} step={2}
      onChange={(v) => onUpdate({ lineSpacing: v })}
      displayValue={`${settings.lineSpacing}px`}
    />
    <SliderControl
      label="Word Spacing"
      value={settings.wordSpacing}
      min={0} max={16} step={1}
      onChange={(v) => onUpdate({ wordSpacing: v })}
      displayValue={`${settings.wordSpacing}px`}
    />

    <div className="space-y-3">
      <ToggleControl
        label="Baseline Jitter"
        description="Natural handwriting wobble"
        enabled={settings.baselineJitter}
        onChange={(v) => onUpdate({ baselineJitter: v })}
      />
      <ToggleControl
        label="Stroke Randomness"
        description="Vary stroke thickness per line"
        enabled={settings.strokeRandomness}
        onChange={(v) => onUpdate({ strokeRandomness: v })}
      />
      <ToggleControl
        label="Show Margin Line"
        description="Red margin line on left"
        enabled={settings.showMarginLine}
        onChange={(v) => onUpdate({ showMarginLine: v })}
      />
    </div>
  </div>
);

/* ─── Shared UI Components ─────────────────── */
const SectionHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="mb-3">
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
  </div>
);

const SliderControl: React.FC<{
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; displayValue: string;
}> = ({ label, value, min, max, step, onChange, displayValue }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{displayValue}</span>
    </div>
    <Slider
      value={[value]}
      min={min} max={max} step={step}
      onValueChange={(v) => onChange(v[0])}
      className="w-full"
    />
  </div>
);

const ToggleControl: React.FC<{
  label: string; description: string; enabled: boolean; onChange: (v: boolean) => void;
}> = ({ label, description, enabled, onChange }) => (
  <motion.button
    whileTap={{ scale: 0.98 }}
    onClick={() => onChange(!enabled)}
    className={cn(
      "w-full flex items-center justify-between p-3 rounded-xl border transition-all",
      enabled ? "border-primary/30 bg-primary/5" : "border-border/40"
    )}
  >
    <div className="text-left">
      <span className="text-xs font-medium text-foreground block">{label}</span>
      <span className="text-[10px] text-muted-foreground">{description}</span>
    </div>
    <div className={cn(
      "w-10 h-6 rounded-full p-0.5 transition-colors",
      enabled ? "bg-primary" : "bg-muted"
    )}>
      <motion.div
        className="w-5 h-5 rounded-full bg-surface shadow-sm"
        animate={{ x: enabled ? 16 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </div>
  </motion.button>
);

/* ─── Mini paper preview thumbnails ────────── */
const PaperPreviewMini: React.FC<{ style: string }> = ({ style }) => {
  const base = "w-10 h-14 rounded-sm border border-border/50 overflow-hidden";

  const getPreviewStyle = (): React.CSSProperties => {
    switch (style) {
      case 'ruled': return { backgroundColor: '#fff', backgroundImage: 'repeating-linear-gradient(transparent, transparent 3px, #c8d6e5 3px, #c8d6e5 3.5px)' };
      case 'graph': return { backgroundColor: '#fff', backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, #c8d6e580 3px, #c8d6e580 3.5px), repeating-linear-gradient(90deg, transparent, transparent 3px, #c8d6e580 3px, #c8d6e580 3.5px)' };
      case 'dotted': return { backgroundColor: '#fff', backgroundImage: 'radial-gradient(circle, #c8d6e5 0.5px, transparent 0.5px)', backgroundSize: '4px 4px' };
      case 'legal': return { backgroundColor: '#FFFDE7' };
      case 'vintage': return { backgroundColor: '#F5E6D3' };
      case 'kraft': return { backgroundColor: '#C4A77D' };
      case 'blueprint': return { backgroundColor: '#1E3A5F' };
      default: return { backgroundColor: '#fff' };
    }
  };

  return <div className={base} style={getPreviewStyle()} />;
};
