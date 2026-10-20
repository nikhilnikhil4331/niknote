// Niknote — app-wide mobile dock for non-editor screens
import { Link, useLocation } from 'react-router-dom';
import { PenLine, Wallet, CalendarCheck, Layers, LayoutGrid, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/hooks/useHaptics';
import { MobileNavigation } from '@/components/mobile/MobilePrimitives';
import { useMobileAppearance } from '@/components/mobile/useMobileAppearance';

const ITEMS = [
  { to: '/', label: 'Notes', icon: PenLine },
  { to: '/habit', label: 'Habit', icon: Sprout },
  { to: '/money', label: 'Money', icon: Wallet },
  { to: '/routine', label: 'Routine', icon: CalendarCheck },
  { to: '/flashcards', label: 'Cards', icon: Layers },
  { to: '/hub', label: 'Apps', icon: LayoutGrid },
];

export function AppDock() {
  const { pathname } = useLocation();
  const { attributes } = useMobileAppearance();
  return <div className="nn-mobile md:hidden" {...attributes} style={{ minHeight: 0 }}><MobileNavigation active={pathname === '/ai' || pathname === '/nikai' ? 'ai' : pathname === '/account' ? 'profile' : pathname === '/notebooks' ? 'notes' : ''} /></div>;
}
