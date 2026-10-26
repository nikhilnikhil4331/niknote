import { GuestUpgradeCard } from '@/components/auth/GuestUpgradeCard';
import { MobileTrackerCards } from './MobileTrackerCards';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, Search, X, Sparkles, ScanLine, LayoutGrid, Upload, BookOpen, Brain, Dna, Code,
  Lightbulb, Star, MoreHorizontal, ArrowRight, SlidersHorizontal, Crown, Settings,
  HelpCircle, FileText, Trash2, Share2, Wallet, CalendarCheck, ChevronRight, Bell,
  Shield, Send, Paperclip, History, PenLine, RefreshCw, Smartphone, PanelTop, Check, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useNotebooks, Notebook } from '@/hooks/useNotebooks';
import { usePremium } from '@/hooks/usePremium';
import { useAIStream } from '@/hooks/useAIStream';
import { supabase } from '@/integrations/supabase/client';
import { Block, createBlock } from '@/types/block';
import { noteTemplates as templates, blocksFromNoteText } from '@/lib/noteTemplates';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { IconButton, MobileHeader, MobileNavigation, ThemeSelector } from './MobilePrimitives';
import { useMobileAppearance } from './useMobileAppearance';
import { motion, useReducedMotion } from 'framer-motion';
import { useAccountName } from '@/hooks/useAccountName';
import { CLOUD_SYNC_EVENT, notifyLocalDataChanged } from '@/lib/cloudSyncEngine';

const AstaAIWorkspace = lazy(() => import('@/components/asta/AstaAIWorkspace'));

interface LocalDeviceNotebook {
  id: string;
  title: string;
  blocks?: Block[];
  content?: string;
  page_style?: string;
  tags?: string[];
  updated_at?: string;
  updatedAt?: string;
  trashedAt?: string | null;
}

const examples = [
  { id: 'sample-os', title: 'Operating System', pages: 6, time: '2 hours ago', tags: ['Study', 'OS'], icon: BookOpen, tone: 'blue', text: '# Operating System\nAn operating system manages hardware and software resources.\n## Core functions\n• Process management\n• Memory management\n• File systems and security' },
  { id: 'sample-ai', title: 'Machine Learning', pages: 12, time: 'Yesterday', tags: ['Study', 'AI', 'ML'], icon: Brain, tone: 'pink', text: '# Machine Learning\nMachine learning helps computers learn patterns from data.\n• Supervised learning\n• Unsupervised learning\n• Reinforcement learning' },
  { id: 'sample-web', title: 'Web Development', pages: 8, time: '3 days ago', tags: ['Work', 'Web', 'Projects'], icon: Code, tone: 'cyan', text: '# Web Development\nHTML structures content, CSS styles it, and JavaScript adds interaction.' },
  { id: 'sample-ideas', title: 'Ideas & Thoughts', pages: 4, time: '5 days ago', tags: ['Personal', 'Ideas'], icon: Lightbulb, tone: 'gold', text: '# Ideas & Thoughts\nSmall ideas can become meaningful projects.\n• Read something new\n• Capture a thought\n• Make time to create' },
  { id: 'sample-important', title: 'Important', pages: 10, time: '1 week ago', tags: ['Study', 'Important'], icon: Star, tone: 'orange', text: '# Important\nKeep your priorities clear.\nReview exam dates and revision goals.' },
  { id: 'sample-dna', title: 'DNA Scan Notes', pages: 3, time: '1 week ago', tags: ['Study', 'Science', 'DNA'], icon: Dna, tone: 'blue', text: '# DNA Scan Notes\nYour handwriting has a unique rhythm, spacing, and slant.' },
];

function readLocalDeviceNotes(): LocalDeviceNotebook[] {
  const map = new Map<string, LocalDeviceNotebook>();
  try {
    const mobileList: LocalDeviceNotebook[] = JSON.parse(localStorage.getItem('niknote.mobile.notebooks.v1') || '[]');
    if (Array.isArray(mobileList)) {
      for (const n of mobileList) {
        if (n?.id) map.set(n.id, n);
      }
    }
  } catch { /* ignore */ }
  try {
    const aiSaved: LocalDeviceNotebook[] = JSON.parse(localStorage.getItem('niknote.notes.v1') || '[]');
    if (Array.isArray(aiSaved)) {
      for (const n of aiSaved) {
        if (n?.id && !n.trashedAt && !map.has(n.id)) map.set(n.id, n);
      }
    }
  } catch { /* ignore */ }
  return Array.from(map.values());
}

export function MobileExperience() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { user, signOut } = useAuth();
  const premium = usePremium();
  const { notebooks, loading, deleteNotebook, updateNotebook } = useNotebooks();
  const { appearance, update, attributes } = useMobileAppearance();
  const [drawer, setDrawer] = useState(false);
  const [welcome, setWelcome] = useState(true);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState(false);
  const [localNotes, setLocalNotes] = useState<LocalDeviceNotebook[]>(() => readLocalDeviceNotes());
  const [hiddenSamples, setHiddenSamples] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('niknote-hidden-samples') || '[]'); } catch { return []; }
  });

  const ai = useAIStream();
  useEffect(() => () => ai.cancel(), []);
  useEffect(() => {
    const refresh = () => setLocalNotes(readLocalDeviceNotes());
    refresh();
    window.addEventListener(CLOUD_SYNC_EVENT, refresh);
    return () => window.removeEventListener(CLOUD_SYNC_EVENT, refresh);
  }, [pathname, search]);

  const inputRef = useRef<HTMLInputElement>(null);
  const { fullName, firstName } = useAccountName();
  const reducedMotion = useReducedMotion();
  const page = pathname === '/notebooks' || pathname === '/notes'
    ? 'notes'
    : pathname === '/ai'
      ? 'ai'
      : pathname === '/account'
        ? 'profile'
        : pathname === '/appearance'
          ? 'appearance'
          : pathname === '/templates'
            ? 'templates'
            : 'home';
  const pageOrder = ['home', 'notes', 'templates', 'ai', 'profile', 'appearance'];
  const previousPage = useRef(page);
  const direction = pageOrder.indexOf(page) >= pageOrder.indexOf(previousPage.current) ? 1 : -1;
  useEffect(() => { previousPage.current = page; }, [page]);
  useEffect(() => {
    setQuery('');
    setCategory(new URLSearchParams(search).get('category') || 'All');
    setSearchOpen(new URLSearchParams(search).has('search'));
  }, [pathname, search]);

  // Render full ChatGPT-Ultra Asta AI Workspace when on /ai
  if (page === 'ai') {
    return (
      <Suspense fallback={null}>
        <AstaAIWorkspace />
      </Suspense>
    );
  }

  const prepareNote = (title: string, text: string, id?: string, style?: string, customBlocks?: Block[]) => {
    sessionStorage.setItem(
      'niknote-mobile-open',
      JSON.stringify({
        title,
        blocks: customBlocks?.length ? customBlocks : blocksFromNoteText(text),
        notebookId: id,
        style,
      })
    );
    navigate(`/?editor=1${id ? `&notebook=${id}` : ''}`);
  };

  const openNotebook = async (notebook: Notebook) => {
    const { data, error } = await supabase.from('pages').select('content').eq('notebook_id', notebook.id).order('page_number').limit(1);
    if (error) { toast.error('Could not open note'); return; }
    const content = data?.[0]?.content;
    sessionStorage.setItem(
      'niknote-mobile-open',
      JSON.stringify({
        title: notebook.title,
        blocks: Array.isArray(content) && content.length ? content : [createBlock()],
        notebookId: notebook.id,
        style: notebook.page_style,
      })
    );
    navigate(`/?editor=1&notebook=${notebook.id}`);
  };

  const localNoteItems = localNotes.map((ln, i) => ({
    ...examples[i % examples.length],
    id: ln.id,
    title: ln.title || 'Untitled Note',
    time: new Date(ln.updated_at || ln.updatedAt || Date.now()).toLocaleDateString(),
    tags: ln.tags?.length ? ln.tags : ['Notes'],
    pages: null as number | null,
    text: ln.content || (ln.blocks ? ln.blocks.map((b) => b.content).join('\n') : ''),
    localBlocks: ln.blocks,
    localStyle: ln.page_style,
    isLocal: true,
    notebook: undefined as Notebook | undefined,
  }));

  const cloudItems = notebooks.map((n, i) => ({
    ...examples[i % examples.length],
    id: n.id,
    title: n.title,
    time: new Date(n.updated_at).toLocaleDateString(),
    tags: n.tags?.length ? n.tags : ['Notes'],
    pages: null as number | null,
    localBlocks: undefined as Block[] | undefined,
    localStyle: n.page_style,
    isLocal: false,
    notebook: n as Notebook | undefined,
  }));

  const sampleItems = examples
    .filter((n) => !hiddenSamples.includes(n.id))
    .map((n) => ({
      ...n,
      localBlocks: undefined as Block[] | undefined,
      localStyle: undefined as string | undefined,
      isLocal: false,
      notebook: undefined as Notebook | undefined,
    }));

  const allNotes = [...cloudItems, ...localNoteItems, ...(cloudItems.length === 0 && localNoteItems.length === 0 ? sampleItems : sampleItems.slice(0, 3))];
  const visibleNotes = allNotes
    .filter((n) => n.title.toLowerCase().includes(query.toLowerCase()) && (category === 'All' || n.tags.includes(category)))
    .sort((a, b) => (sort ? a.title.localeCompare(b.title) : 0));

  const deleteLocalNote = (id: string) => {
    try {
      const m = JSON.parse(localStorage.getItem('niknote.mobile.notebooks.v1') || '[]').filter((x: any) => x.id !== id);
      localStorage.setItem('niknote.mobile.notebooks.v1', JSON.stringify(m));
    } catch { /* ignore */ }
    try {
      const n = JSON.parse(localStorage.getItem('niknote.notes.v1') || '[]').filter((x: any) => x.id !== id);
      localStorage.setItem('niknote.notes.v1', JSON.stringify(n));
    } catch { /* ignore */ }
    setLocalNotes(readLocalDeviceNotes());
    toast.success('Note deleted');
  };

  const renameLocalNote = (id: string, title: string) => {
    try {
      const m = JSON.parse(localStorage.getItem('niknote.mobile.notebooks.v1') || '[]').map((x: any) => (x.id === id ? { ...x, title } : x));
      localStorage.setItem('niknote.mobile.notebooks.v1', JSON.stringify(m));
    } catch { /* ignore */ }
    try {
      const n = JSON.parse(localStorage.getItem('niknote.notes.v1') || '[]').map((x: any) => (x.id === id ? { ...x, title } : x));
      localStorage.setItem('niknote.notes.v1', JSON.stringify(n));
    } catch { /* ignore */ }
    setLocalNotes(readLocalDeviceNotes());
    notifyLocalDataChanged();
  };

  const noteCard = (note: typeof allNotes[number], compact = false) => (
    <article className="nn-note" key={note.id}>
      <Button
        variant="ghost"
        className="nn-note-open"
        onClick={() =>
          note.notebook
            ? openNotebook(note.notebook)
            : prepareNote(note.title, note.text, note.isLocal ? note.id : undefined, note.localStyle, note.localBlocks)
        }
      >
        <span className={cn('nn-note-icon', `nn-tone-${note.tone}`)}>
          <note.icon className="h-7 w-7" />
        </span>
        <span className="nn-note-copy">
          <strong>{compact && note.id === 'sample-ideas' ? 'Ideas' : note.title}</strong>
          <small>{note.pages ? `${note.pages} pages · ` : ''}{note.time}</small>
          {!compact && <span className="nn-tags">{note.tags.map((tag) => <span key={tag}>{tag}</span>)}</span>}
          {compact && <span className="nn-note-dots">•••</span>}
        </span>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="nn-icon" aria-label={`Options for ${note.title}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() =>
              note.notebook
                ? openNotebook(note.notebook)
                : prepareNote(note.title, note.text, note.isLocal ? note.id : undefined, note.localStyle, note.localBlocks)
            }
          >
            Open note
          </DropdownMenuItem>
          {(note.notebook || note.isLocal) && (
            <DropdownMenuItem
              onClick={async () => {
                const title = window.prompt('Note title', note.title);
                if (!title?.trim()) return;
                if (note.notebook) await updateNotebook(note.id, { title: title.trim() });
                else renameLocalNote(note.id, title.trim());
              }}
            >
              Rename
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => {
              if (note.notebook) {
                if (window.confirm(`Delete ${note.title}?`)) deleteNotebook(note.id);
              } else if (note.isLocal) {
                deleteLocalNote(note.id);
              } else {
                const next = [...hiddenSamples, note.id];
                setHiddenSamples(next);
                localStorage.setItem('niknote-hidden-samples', JSON.stringify(next));
              }
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );

  return (
    <div className="nn-mobile" {...attributes}>
      {page === 'home' ? (
        <header className="nn-header">
          <IconButton icon={Menu} label="Open menu" onClick={() => setDrawer(true)} />
          <div className="nn-logo"><img src="/niknote-logo.png" alt="NikNote" /></div>
          <IconButton icon={Search} label="Search notes" onClick={() => navigate('/notebooks?search=1')} />
        </header>
      ) : (
        <MobileHeader title={{ notes: 'All Notes', profile: 'Profile', appearance: 'Appearance', templates: 'Templates' }[page] || ''}>
          {page === 'notes' ? (
            <>
              <IconButton icon={Search} label="Search notes" onClick={() => setSearchOpen((v) => !v)} />
              <IconButton icon={SlidersHorizontal} label="Sort notes by title" onClick={() => setSort((v) => !v)} />
            </>
          ) : undefined}
        </MobileHeader>
      )}

      <motion.main
        key={page}
        initial={reducedMotion || !appearance.animations ? false : { opacity: 0.4, x: direction * 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="nn-content"
      >
        {page === 'home' && (
          <>
            <ThemeSelector theme={appearance.theme} onChange={(theme) => update({ theme })} />
            {welcome && (
              <section className="nn-welcome">
                <IconButton icon={X} label="Dismiss welcome" className="nn-welcome-close" onClick={() => setWelcome(false)} />
                <h2>
                  {user ? `Welcome back${firstName ? `, ${firstName}` : ''}` : <>Welcome to <img src="/niknote-logo.png" alt="Niknote" className="nn-welcome-logo" /></>}
                </h2>
                <p>Turn your ideas into beautiful notes + NikAI</p>
                <div className="nn-book-visual" aria-hidden="true"><BookOpen /><PenLine /><span>✦</span><span>✧</span></div>
              </section>
            )}
            <MobileTrackerCards />
            <div className="nn-quick-actions">
              {[
                { label: 'NikAI', icon: Sparkles, customImg: '/nikai-mark.png', tone: 'purple', action: () => navigate('/ai') },
                { label: 'Write Note', icon: PenLine, customImg: '', tone: 'green', action: () => navigate('/?editor=1&new=1') },
                { label: 'Templates', icon: LayoutGrid, customImg: '', tone: 'purple', action: () => navigate('/templates') },
                { label: 'Draw Board', icon: ScanLine, customImg: '', tone: 'pink', action: () => navigate('/board') },
                { label: 'PDF Edit', icon: FileText, customImg: '', tone: 'gold', action: () => navigate('/pdf-editor') },
              ].map(({ label, icon: Icon, customImg, tone, action }) => (
                <Button variant="ghost" className="nn-quick" key={label} onClick={action}>
                  {customImg ? (
                    <img src={customImg} alt="" aria-hidden="true" className="h-6 w-auto object-contain" />
                  ) : (
                    <Icon className={cn('h-6 w-6', `nn-ink-${tone}`)} />
                  )}
                  <span>{label}</span>
                </Button>
              ))}
            </div>
            <div className="nn-section-heading">
              <h2>Recent Notes</h2>
              <Button variant="ghost" className="nn-see-all" onClick={() => navigate('/notebooks')}>
                See all <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="nn-note-list">
              {allNotes.slice(0, 3).map((n) => noteCard(n, true))}
            </div>
          </>
        )}

        {page === 'notes' && (
          <>
            {(searchOpen || query) && (
              <input
                ref={inputRef}
                autoFocus
                className="nn-input mb-4"
                placeholder="Search your notes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            )}
            <div className="nn-pills">
              {(category === 'Important' || category === 'Trash'
                ? ['All', 'Study', 'Work', 'Personal', category]
                : ['All', 'Study', 'Work', 'Personal']
              ).map((c) => (
                <Button
                  key={c}
                  variant="ghost"
                  className={cn('nn-pill', category === c && 'nn-selected')}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
            <div className="nn-note-list">
              {loading && !localNotes.length ? [1, 2, 3].map((i) => <div className="nn-note nn-skeleton" key={i} />) : visibleNotes.map((n) => noteCard(n))}
            </div>
            {!loading && !visibleNotes.length && (
              <div className="nn-empty">
                <BookOpen />
                <h2>{category === 'Trash' ? 'No recoverable notes' : 'No notes here yet'}</h2>
                {category === 'Trash' && <p className="text-center text-xs">Deleted notebooks are permanently removed.</p>}
                <Button onClick={() => navigate('/?editor=1&new=1')}>Create a note</Button>
              </div>
            )}
            <Button className="nn-fab" size="icon" aria-label="Create note" onClick={() => navigate('/?editor=1&new=1')}>
              <span className="text-3xl font-light">+</span>
            </Button>
          </>
        )}

        {page === 'templates' && (
          <>
            <div className="nn-template-heading">
              <span className="nn-template-eyebrow">YOUR NEXT PAGE</span>
              <h2>A fresh start.</h2>
            </div>
            <div className="nn-pills" aria-label="Template categories">
              {['All', 'Study', 'Notes', 'Planner', 'Other'].map((c) => (
                <Button
                  variant="ghost"
                  aria-pressed={category === c}
                  className={cn('nn-pill', category === c && 'nn-selected')}
                  key={c}
                  onClick={() => navigate(c === 'All' ? '/templates' : `/templates?category=${c}`)}
                >
                  {c}
                </Button>
              ))}
            </div>
            <div className="nn-template-grid">
              {templates
                .filter((t) => category === 'All' || t.category === category)
                .map((t) => (
                  <Button
                    variant="ghost"
                    className="nn-template"
                    key={t.title}
                    aria-label={`Use ${t.title} template`}
                    onClick={() => prepareNote(t.title, t.text, undefined, t.style)}
                  >
                    <div className={cn('nn-template-preview', `nn-template-${t.layout}`)} aria-hidden="true">
                      <span className="nn-template-paper-label">{t.category}</span>
                      <strong>{t.title}</strong>
                      <div className="nn-template-paper-body">
                        {t.text
                          .split('\n')
                          .filter((line) => line.trim() && !line.startsWith('# '))
                          .slice(0, 5)
                          .map((line, i) => (
                            <span key={i} className={cn(line.startsWith('## ') && 'nn-template-paper-section')}>
                              {line.replace(/^## /, '').replace(/^\[\] /, '□ ')}
                            </span>
                          ))}
                        {!t.text && <PenLine />}
                        <i />
                        <i />
                      </div>
                    </div>
                    <span className="nn-template-caption">
                      <strong>{t.title}</strong>
                      <ArrowRight className="h-4 w-4" />
                    </span>
                    <small>{t.desc}</small>
                  </Button>
                ))}
            </div>
          </>
        )}

        {page === 'appearance' && (
          <>
            <ThemeSelector theme={appearance.theme} onChange={(theme) => update({ theme })} />
            <h2 className="nn-setting-title">Color Theme</h2>
            <div className="nn-color-swatches">
              {['purple', 'blue', 'pink', 'orange', 'green', 'cyan'].map((color) => (
                <Button
                  variant="ghost"
                  key={color}
                  aria-label={`${color} color theme`}
                  aria-pressed={appearance.color === color}
                  className={cn('nn-swatch', `nn-swatch-${color}`, appearance.color === color && 'nn-swatch-selected')}
                  onClick={() => update({ color })}
                >
                  {appearance.color === color && <Check className="h-4 w-4" />}
                </Button>
              ))}
            </div>
            <h2 className="nn-setting-title">App Layout</h2>
            <div className="nn-layouts">
              {[
                { id: 'default', name: 'Default', icon: Smartphone },
                { id: 'compact', name: 'Compact', icon: PanelTop },
                { id: 'spacious', name: 'Spacious', icon: LayoutGrid },
              ].map(({ id, name, icon: Icon }) => (
                <Button
                  variant="ghost"
                  key={id}
                  className={cn('nn-layout', appearance.layout === id && 'nn-layout-selected')}
                  onClick={() => update({ layout: id })}
                >
                  <Icon className="h-8 w-8" />
                  <span>{name}</span>
                </Button>
              ))}
            </div>
            <div className="nn-settings-group">
              {[
                { key: 'glass' as const, label: 'Glass Effect', icon: Settings },
                { key: 'animations' as const, label: 'Animations', icon: Sparkles },
                { key: 'realPen' as const, label: 'Real Pen Mode', icon: PenLine },
              ].map(({ key, label, icon: Icon }) => (
                <div className="nn-settings-row" key={key}>
                  <Icon className="h-5 w-5 text-primary" />
                  <label htmlFor={`setting-${key}`}>{label}</label>
                  <Switch id={`setting-${key}`} checked={appearance[key]} onCheckedChange={(value) => update({ [key]: value })} />
                </div>
              ))}
            </div>
          </>
        )}

        {page === 'profile' && (
          <>
            <GuestUpgradeCard />
            <div className="nn-profile">
              <div className="nn-avatar">{firstName[0]}</div>
              <h2>{fullName}</h2>
              <p>{user?.email || 'Device workspace active · All tools unlocked'}</p>
              <span className="nn-plan"><Crown className="h-4 w-4" />{premium.isPremium ? 'NikNote Pro' : 'Free Plan'}</span>
            </div>
            <div className="nn-settings-group">
              {[
                { label: 'NikAI', icon: Sparkles, customImg: '/nikai-mark.png', action: () => navigate('/ai') },
                { label: 'PDF Studio (edit & sign)', icon: FileText, customImg: '', action: () => navigate('/pdf-editor') },
                { label: 'PDF Tools (Word, Excel, OCR, protect)', icon: FileText, customImg: '', action: () => navigate('/pdf-tools') },
                { label: 'Check-up (AI, PDF, OCR test)', icon: FileText, customImg: '', action: () => navigate('/checkup') },
                { label: 'Account', icon: Settings, customImg: '', action: () => navigate('/account-details') },
                { label: 'Appearance', icon: LayoutGrid, customImg: '', action: () => navigate('/appearance') },
                {
                  label: 'Notifications',
                  icon: Bell,
                  customImg: '',
                  action: async () => {
                    if (!('Notification' in window)) { toast.info('Notifications are unavailable on this browser'); return; }
                    const permission = await Notification.requestPermission();
                    toast.info(permission === 'granted' ? 'Notifications enabled' : 'Notifications not enabled');
                  },
                },
                { label: 'Privacy', icon: Shield, customImg: '', action: () => navigate('/privacy') },
                { label: 'Donate', icon: Crown, customImg: '', action: () => navigate('/donate') },
                { label: 'Help & Feedback', icon: HelpCircle, customImg: '', action: () => navigate('/feedback') },
              ].map(({ label, icon: Icon, customImg, action }) => (
                <Button variant="ghost" className="nn-profile-row" key={label} onClick={action}>
                  {customImg ? (
                    <img src={customImg} alt="" aria-hidden="true" className="h-5 w-auto object-contain" />
                  ) : (
                    <Icon className="h-5 w-5 text-primary" />
                  )}
                  <span>{label}</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ))}
            </div>
            <Button variant="ghost" className="nn-premium" onClick={() => navigate('/donate')}>
              <Crown />
              <span>
                <strong>Support NikNote</strong>
                <small>Everything is free — donate if you like it</small>
              </span>
              <ArrowRight />
            </Button>
            {user && (
              <Button
                variant="ghost"
                className="w-full mt-6 text-muted-foreground"
                onClick={async () => {
                  if ((user as any)?.is_anonymous && !window.confirm('You are a guest. Signing out permanently loses access to your notes and trackers unless you add an email first. Sign out anyway?')) return;
                  await signOut();
                  navigate('/');
                }}
              >
                Sign out
              </Button>
            )}
          </>
        )}
      </motion.main>

      {!['appearance', 'templates'].includes(page) && (
        <MobileNavigation active={page === 'notes' ? 'notes' : page === 'profile' ? 'profile' : 'home'} />
      )}

      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="nn-drawer nn-mobile" {...attributes}>
          <SheetTitle className="sr-only">NikNote menu</SheetTitle>
          <div className="nn-drawer-profile">
            <div className="nn-avatar">{firstName[0]}</div>
            <div>
              <strong>{fullName}</strong>
              <small>{user?.email || 'Your personal study space'}</small>
            </div>
            <Crown className="h-5 w-5 nn-ink-orange" />
          </div>
          <div className="nn-drawer-menu">
            {[
              { name: 'Home', icon: BookOpen, to: '/' },
              { name: 'NikAI', icon: Sparkles, to: '/ai' },
              { name: 'Notebook Studio', icon: PenLine, to: '/?editor=1' },
              { name: 'DNA Scanner', icon: ScanLine, to: '/?editor=1&panel=scan' },
              { name: 'Documents', icon: FileText, to: '/documents' },
              { name: 'Notebooks', icon: BookOpen, to: '/notebooks' },
              { name: 'Draw Board', icon: LayoutGrid, to: '/board' },
            ].map(({ name, icon: Icon, to }) => (
              <Button
                variant="ghost"
                className={cn('nn-drawer-link', name === 'Home' && 'nn-drawer-active')}
                key={name}
                onClick={() => { setDrawer(false); navigate(to); }}
              >
                <Icon />
                <span>{name}</span>
                {name === 'NikAI' && <small>ASTRA</small>}
              </Button>
            ))}
            <div className="nn-divider" />
            <p className="nn-drawer-label">⌄ Pages</p>
            {[
              { name: 'All Notes', icon: FileText, to: '/notebooks' },
              { name: 'Important', icon: Star, to: '/notebooks?category=Important' },
              { name: 'Money Tracker', icon: Wallet, to: '/money' },
              { name: 'Daily Routine', icon: CalendarCheck, to: '/routine' },
              { name: 'Habit Tracker', icon: Brain, to: '/habit' },
              { name: 'History', icon: Share2, to: '/history' },
            ].map(({ name, icon: Icon, to }) => (
              <Button
                variant="ghost"
                className="nn-drawer-link"
                key={name}
                onClick={() => { setDrawer(false); navigate(to); }}
              >
                <Icon />
                <span>{name}</span>
              </Button>
            ))}
            <div className="nn-divider" />
            <Button variant="ghost" className="nn-drawer-link" onClick={() => { setDrawer(false); navigate('/appearance'); }}>
              <Settings />Settings
            </Button>
            <Button variant="ghost" className="nn-drawer-link" onClick={() => { setDrawer(false); navigate('/feedback'); }}>
              <HelpCircle />Help & Feedback
            </Button>
          </div>
          <Button variant="ghost" className="nn-premium" onClick={() => { setDrawer(false); navigate('/donate'); }}>
            <Crown />
            <span>
              <strong>Donate</strong>
              <small>Everything is free — support NikNote</small>
            </span>
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
