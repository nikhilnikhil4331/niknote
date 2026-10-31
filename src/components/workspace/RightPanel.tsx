import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PanelRightClose, Calendar, Clock, FileText, Hash, Type,
  ChevronRight, Pen, Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Block } from '@/types/block';
import { HandwritingFont, FONT_OPTIONS } from '@/types/notes';

interface RightPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  blocks: Block[];
  currentPage: number;
  totalPages: number;
  font: HandwritingFont;
  onFontChange: (font: HandwritingFont) => void;
  inkColor: string;
  createdAt?: string;
}

// Use FONT_OPTIONS from the design system

export const RightPanel: React.FC<RightPanelProps> = ({
  isOpen, onToggle, blocks, currentPage, totalPages,
  font, onFontChange, inkColor, createdAt,
}) => {
  // Word count
  const wordCount = useMemo(() => {
    return blocks.reduce((total, b) => {
      const words = b.content.trim().split(/\s+/).filter(Boolean);
      return total + words.length;
    }, 0);
  }, [blocks]);

  // Character count
  const charCount = useMemo(() => {
    return blocks.reduce((total, b) => total + b.content.length, 0);
  }, [blocks]);

  // Auto-generated outline from headings
  const outline = useMemo(() => {
    return blocks
      .filter(b => b.type === 'heading1' || b.type === 'heading2' || b.type === 'heading3')
      .map(b => ({
        id: b.id,
        text: b.content || 'Untitled',
        level: b.type === 'heading1' ? 1 : b.type === 'heading2' ? 2 : 3,
      }));
  }, [blocks]);

  // Block type counts
  const blockStats = useMemo(() => {
    const counts: Record<string, number> = {};
    blocks.forEach(b => { counts[b.type] = (counts[b.type] || 0) + 1; });
    return counts;
  }, [blocks]);

  const todoTotal = blockStats['todo'] || 0;
  const todoDone = blocks.filter(b => b.type === 'todo' && b.checked).length;

  if (!isOpen) return null;

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className="h-[calc(100vh-3.5rem)] border-l border-border/50 bg-sidebar flex flex-col flex-shrink-0 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <span className="text-sm font-semibold text-sidebar-foreground">Properties</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onToggle}>
          <PanelRightClose className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">

          {/* Page Info */}
          <Section title="Page Info">
            <PropRow icon={<FileText className="w-3.5 h-3.5" />} label="Page" value={`${currentPage} / ${totalPages}`} />
            <PropRow icon={<Calendar className="w-3.5 h-3.5" />} label="Created" value={createdAt || 'Just now'} />
            <PropRow icon={<Clock className="w-3.5 h-3.5" />} label="Modified" value="Now" />
          </Section>

          {/* Stats */}
          <Section title="Stats">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Words" value={wordCount} />
              <StatCard label="Characters" value={charCount} />
              <StatCard label="Blocks" value={blocks.length} />
              {todoTotal > 0 && (
                <StatCard label="Todos" value={`${todoDone}/${todoTotal}`} />
              )}
            </div>
          </Section>

          {/* Handwriting Style */}
          <Section title="Handwriting Style">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Pen className="w-3.5 h-3.5 text-muted-foreground" />
                <Select value={font} onValueChange={(v) => onFontChange(v as HandwritingFont)}>
                  <SelectTrigger className="h-8 text-xs rounded-lg flex-1 bg-muted/50 border-0">
                    <SelectValue placeholder="Select font" />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map(f => (
                      <SelectItem key={f.value} value={f.value} className="text-xs">
                        <span className={f.className}>{f.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: inkColor }} />
                  <span className="text-xs text-muted-foreground">{inkColor}</span>
                </div>
              </div>
              {/* Font preview */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                <p className="text-sm text-foreground leading-relaxed" style={{ fontFamily: font }}>
                  The quick brown fox jumps over the lazy dog.
                </p>
              </div>
            </div>
          </Section>

          {/* Outline */}
          <Section title="Outline">
            {outline.length > 0 ? (
              <div className="space-y-0.5">
                {outline.map(item => (
                  <button
                    key={item.id}
                    className={cn(
                      "flex items-center gap-1.5 w-full px-2 py-1.5 rounded-md text-left text-xs transition-colors hover:bg-sidebar-accent/50 text-sidebar-foreground",
                      item.level === 2 && "pl-5",
                      item.level === 3 && "pl-8",
                    )}
                  >
                    <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className={cn(
                      "truncate",
                      item.level === 1 && "font-semibold",
                      item.level === 2 && "font-medium",
                    )}>
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground px-2">
                Add headings (H1, H2, H3) to see an auto-generated outline here.
              </p>
            )}
          </Section>

          {/* Tags placeholder */}
          <Section title="Tags">
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-primary/10 text-accent-rose border border-primary/20">
                + Add tag
              </span>
            </div>
          </Section>

        </div>
      </ScrollArea>

      {/* Footer shortcut hint */}
      <div className="border-t border-border/30 px-4 py-2">
        <p className="text-[10px] text-muted-foreground text-center">
          Toggle with <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Ctrl + .</kbd>
        </p>
      </div>
    </motion.aside>
  );
};

// Sub-components

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h4>
    {children}
  </div>
);

const PropRow: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center justify-between py-1.5 text-xs">
    <span className="flex items-center gap-2 text-muted-foreground">
      {icon} {label}
    </span>
    <span className="text-sidebar-foreground font-medium">{value}</span>
  </div>
);

const StatCard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/30 text-center">
    <p className="text-lg font-bold text-sidebar-foreground leading-none">{value}</p>
    <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
  </div>
);
