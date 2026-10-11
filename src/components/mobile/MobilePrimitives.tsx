import { ComponentType, ReactNode } from 'react';
import { Sun, Sparkles, Moon, Coffee, Home, BookOpen, Plus, User, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

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
  return <nav className="nn-navigation" aria-label="Main navigation">{[{ id: 'home', label: 'Home', icon: Home, path: '/' }, { id: 'notes', label: 'Notes', icon: BookOpen, path: '/notebooks' }, { id: 'create', label: 'Create note', icon: Plus, path: '/?editor=1&new=1' }, { id: 'ai', label: 'AI', icon: Sparkles, path: '/ai' }, { id: 'profile', label: 'Profile', icon: User, path: '/account' }].map(({ id, label, icon: Icon, path }) => <Button variant="ghost" key={id} aria-label={label} aria-current={active === id ? 'page' : undefined} className={cn('nn-nav-item', active === id && 'nn-active', id === 'create' && 'nn-create')} onClick={() => navigate(path)}><Icon className="h-5 w-5" />{id !== 'create' && <span>{label}</span>}</Button>)}</nav>;
}