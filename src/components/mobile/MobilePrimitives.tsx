import { ComponentType, ReactNode } from 'react';
import { Sun, Sparkles, Moon, Coffee, Home, BookOpen, Plus, User, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';
import { haptic } from '@/hooks/useHaptics';
import { useMobileAppearance } from './useMobileAppearance';
import { NikAIMarkIcon } from '@/components/nikai/NikAIBrand';

export function IconButton({ icon: Icon, label, onClick, className = '', disabled = false }: { icon: ComponentType<{ className?: string }>; label: string; onClick: () => void; className?: string; disabled?: boolean }) {
  return <Button variant="ghost" size="icon" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={cn('nn-icon', className)}><Icon className="h-5 w-5" /></Button>;
}
export function MobileHeader({ title, children, onBack }: { title: string; children?: ReactNode; onBack?: () => void }) {
  const navigate = useNavigate();
  return <header className="nn-header"><IconButton icon={ChevronLeft} label="Back" onClick={onBack || (() => navigate('/'))} /><h1>{title}</h1><div className="flex items-center">{children || <span className="w-11" />}</div></header>;
}
export function ThemeSelector({ theme, onChange }: { theme: string; onChange: (value: string) => void }) {
  return <div className="nn-themes">{[{ id: 'calm', name: 'Calm', icon: Sun }, { id: 'focus', name: 'Focus', icon: Sparkles }, { id: 'dark', name: 'Dark', icon: Moon }, { id: 'vintage', name: 'Vintage', icon: Coffee }].map(({ id, name, icon: Icon }) => <Button variant="ghost" key={id} className={cn('nn-theme', theme === id && 'nn-selected')} onClick={() => onChange(id)} aria-pressed={theme === id}><Icon className="h-5 w-5" /><span>{name}</span></Button>)}</div>;
}
export function MobileNavigation({ active }: { active: string }) {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const { appearance } = useMobileAppearance();
  const items = [{ id: 'home', label: 'Home', icon: Home, path: '/' }, { id: 'notes', label: 'Notes', icon: BookOpen, path: '/notebooks' }, { id: 'create', label: 'Create note', icon: Plus, path: '/?editor=1&new=1' }, { id: 'ai', label: 'NikAI', icon: NikAIMarkIcon, path: '/ai' }, { id: 'profile', label: 'Profile', icon: User, path: '/account' }];
  const index = items.findIndex(item => item.id === active);
  const noMotion = reducedMotion || !appearance.animations;
  return <nav className="nn-navigation nn-navigation-swift" aria-label="Main navigation"><div className="nn-nav-track" aria-hidden="true"><motion.div className="nn-nav-highlight" initial={false} animate={{ x: `${Math.max(0, index) * 100}%`, opacity: index < 0 ? 0 : 1 }} transition={noMotion ? { duration: 0 } : { type: 'spring', stiffness: 440, damping: 34, mass: .7 }} /></div>{items.map(({ id, label, icon: Icon, path }) => <Button variant="ghost" key={id} aria-label={label} title={label} aria-current={active === id ? 'page' : undefined} className={cn('nn-nav-item', active === id && 'nn-active', id === 'create' && 'nn-create')} onClick={() => { if (active === id) return; haptic('selection'); navigate(path); }}><motion.span className="nn-nav-icon" animate={{ y: active === id ? -2 : 0, scale: active === id ? 1.08 : 1 }} transition={noMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 25 }}><Icon className="h-5 w-5" /></motion.span>{id !== 'create' && <span>{label}</span>}</Button>)}</nav>;
}