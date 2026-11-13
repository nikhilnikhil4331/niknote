import { PenLine, Eraser, Highlighter, Type, Image, Mic, BookOpen, MoreHorizontal, Save, FileDown, ScanLine, Sparkles, Settings2, Undo2, Redo2, Share2, ChevronLeft, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { IconButton } from './MobilePrimitives';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

export type EditorSaveStatus = 'saved' | 'saving' | 'unsaved' | 'offline' | 'error';

export function MobileEditorHeader({ title, onTitle, onSave, onExport, onStyle, onScan, onShare, exporting, saving, saveStatus = 'saved', isDark = false, onToggleDark }: {
  title: string;
  onTitle: (title: string) => void;
  onSave: () => void;
  onExport: () => void;
  onStyle: () => void;
  onScan: () => void;
  onShare: () => void;
  exporting: boolean;
  saving: boolean;
  saveStatus?: EditorSaveStatus;
  isDark?: boolean;
  onToggleDark?: () => void;
}) {
  const navigate = useNavigate();
  const statusLabel = saveStatus === 'saving' ? 'Saving' : saveStatus === 'unsaved' ? 'Unsaved' : saveStatus === 'offline' ? 'On device' : saveStatus === 'error' ? 'Retry save' : 'Saved';
  return <header className="nn-header nn-editor-header">
    <IconButton icon={ChevronLeft} label="Back to home" onClick={() => navigate('/home')} />
    <div className="nn-editor-title-wrap">
      <input className="nn-editor-title" aria-label="Note title" value={title} onChange={e => onTitle(e.target.value)} />
      <span className={`nn-editor-save-state nn-save-${saveStatus}`} role="status">{statusLabel}</span>
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Note options" className="nn-icon"><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onSave} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving…' : 'Save now'}</DropdownMenuItem>
        <DropdownMenuItem onClick={onExport} disabled={exporting}><FileDown className="mr-2 h-4 w-4" />Export PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={onStyle}><Settings2 className="mr-2 h-4 w-4" />Paper & pen style</DropdownMenuItem>
        <DropdownMenuItem onClick={onScan}><ScanLine className="mr-2 h-4 w-4" />DNA Scanner</DropdownMenuItem>
        <DropdownMenuItem onClick={onShare}><Share2 className="mr-2 h-4 w-4" />Share note</DropdownMenuItem>
        {onToggleDark && <DropdownMenuItem onClick={onToggleDark}>{isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}{isDark ? 'Light mode' : 'Dark mode'}</DropdownMenuItem>}
        <DropdownMenuItem onClick={() => navigate('/ai')}><Sparkles className="mr-2 h-4 w-4" />Open NikAI</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </header>;
}

export function MobileEditorToolbar({ active, onTool, listening }: { active: string; onTool: (tool: string) => void; listening: boolean }) {
  return <nav className="nn-editor-toolbar" aria-label="Editor tools">{[{ id: 'pen', label: 'Pen', icon: PenLine }, { id: 'eraser', label: 'Eraser', icon: Eraser }, { id: 'highlighter', label: 'Highlighter', icon: Highlighter }, { id: 'text', label: 'Text', icon: Type }, { id: 'image', label: 'Image', icon: Image }, { id: 'voice', label: 'Voice', icon: Mic }].map(({ id, label, icon: Icon }) => <Button variant="ghost" key={id} aria-label={id === 'voice' && listening ? 'Stop voice' : label} aria-pressed={active === id} className={cn('nn-editor-tool', (active === id || id === 'voice' && listening) && 'nn-tool-active')} onClick={() => onTool(id)}><Icon /><span>{label}</span></Button>)}</nav>;
}