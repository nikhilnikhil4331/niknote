// Niknote — Mobile bottom navigation (editor). Glass bar, CSS-only transitions for touch reliability.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine, Palette, Sparkles, MoreHorizontal, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/hooks/useHaptics';

export type MobileTab = 'write' | 'style' | 'preview' | 'ai';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onShare?: () => void;
  onScan?: () => void;
  onExport?: () => void;
  onAIWorkspace?: () => void;
  isExporting?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ activeTab, onTabChange }) => {
  const navigate = useNavigate();
  const tabs: { id: MobileTab; label: string; icon: React.ElementType }[] = [
    { id: 'write', label: 'Write', icon: PenLine },
    { id: 'style', label: 'Style', icon: Palette },
    { id: 'ai', label: 'AI', icon: Sparkles },
    { id: 'preview', label: 'More', icon: MoreHorizontal },
  ];

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 lg:hidden px-3 pb-[max(env(safe-area-inset-bottom),8px)]" style={{ touchAction: 'manipulation' }}>
      <div className="mx-auto max-w-md flex items-center justify-around h-16 rounded-[1.75rem] border border-border/70 bg-background/80 backdrop-blur-2xl shadow-[0_10px_40px_-12px_hsl(var(--primary)/0.35)] px-1.5">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button key={id} onClick={() => { haptic('selection'); onTabChange(id); }}
              className={cn('flex-1 flex flex-col items-center justify-center gap-0.5 h-12 rounded-2xl transition-all duration-200 active:scale-90',
                active ? 'bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-md' : 'text-muted-foreground')}
              style={{ WebkitTapHighlightColor: 'transparent' }} aria-current={active ? 'page' : undefined}>
              <Icon className="w-[19px] h-[19px]" strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          );
        })}
        <button onClick={() => { haptic('light'); navigate('/hub'); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 h-12 rounded-2xl text-muted-foreground active:scale-90 transition"
          style={{ WebkitTapHighlightColor: 'transparent' }}>
          <LayoutGrid className="w-[19px] h-[19px]" />
          <span className="text-[10px] font-semibold">Apps</span>
        </button>
      </div>
    </div>
  );
};
