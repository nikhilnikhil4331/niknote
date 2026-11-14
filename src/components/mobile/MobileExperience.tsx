import { GuestUpgradeCard } from '@/components/auth/GuestUpgradeCard';
import { MobileTrackerCards } from './MobileTrackerCards';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, Search, X, Sparkles, ScanLine, LayoutGrid, Upload, BookOpen, Brain, Dna, Code,
  Lightbulb, Star, MoreHorizontal, ArrowRight, SlidersHorizontal, Crown, Settings,
  HelpCircle, FileText, Trash2, Share2, Wallet, CalendarCheck, ChevronRight, Bell,
  Shield, Send, Paperclip, History, PenLine, RefreshCw, Loader2, Shapes,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { isGuestUser, useAuth } from '@/contexts/AuthContext';
import { useNotebooks, Notebook } from '@/hooks/useNotebooks';
import { usePremium } from '@/hooks/usePremium';
import { useAIStream } from '@/hooks/useAIStream';
import { supabase } from '@/integrations/supabase/client';
import { Block, createBlock } from '@/types/block';
import type { HandwritingFont, InkColor } from '@/types/notes';
import { noteTemplates as templates, blocksFromNoteText } from '@/lib/noteTemplates';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { IconButton, MobileHeader, MobileNavigation, ThemeSelector } from './MobilePrimitives';
import { useMobileAppearance } from './useMobileAppearance';
import { motion, useReducedMotion } from 'framer-motion';
import { useAccountName } from '@/hooks/useAccountName';
import { greeting as getDesktopGreeting, useNoteMeta } from '@/components/desktop/store';
import { CLOUD_SYNC_EVENT, notifyLocalDataChanged } from '@/lib/cloudSyncEngine';
import { findLocalNoteForOwner, readLocalNotesForOwner, removeLocalNoteForOwner, upsertLocalNoteForOwner, type LocalNoteRecord } from '@/lib/localNoteStore';

const AstaAIWorkspace = lazy(() => import('@/components/asta/AstaAIWorkspace'));

type LocalDeviceNotebook = LocalNoteRecord & {
  blocks?: Block[];
  font?: HandwritingFont;
  ink_color?: InkColor;
};

function readLocalDeviceNotes(ownerId: string | null | undefined, allowLegacyClaim = false): LocalDeviceNotebook[] {
  return readLocalNotesForOwner(ownerId, { allowLegacyClaim }) as LocalDeviceNotebook[];
}

export function MobileExperience() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { user, signOut } = useAuth();
  const guest = isGuestUser(user);
  const premium = usePremium();
  const { notebooks, loading, deleteNotebook, updateNotebook } = useNotebooks();
  const { meta, setPrevFolder } = useNoteMeta();
  const { appearance, update, attributes } = useMobileAppearance();
  const [drawer, setDrawer] = useState(false);
  const [welcome, setWelcome] = useState(true);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState(false);
  const [localNotes, setLocalNotes] = useState<LocalDeviceNotebook[]>(() => readLocalDeviceNotes(user?.id, guest));

  const ai = useAIStream();
  useEffect(() => () => ai.cancel(), []);
  useEffect(() => {
    const refresh = () => setLocalNotes(readLocalDeviceNotes(user?.id, guest));
    refresh();
    window.addEventListener(CLOUD_SYNC_EVENT, refresh);
    return () => window.removeEventListener(CLOUD_SYNC_EVENT, refresh);
  }, [pathname, search, user?.id, guest]);

  const inputRef = useRef<HTMLInputElement>(null);
  const { fullName, firstName } = useAccountName();
  const reducedMotion = useReducedMotion();
  const page = pathname === '/notebooks' || pathname === '/notes' || pathname === '/trash'
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
    setCategory(pathname === '/trash' ? 'Trash' : new URLSearchParams(search).get('category') || 'All');
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

  const prepareNote = (
    title: string,
    text: string,
    id?: string,
    style?: string,
    customBlocks?: Block[],
    font?: HandwritingFont,
    inkColor?: InkColor,
  ) => {
    sessionStorage.setItem(
      'niknote-mobile-open',
      JSON.stringify({
        ownerId: user?.id,
        title,
        blocks: customBlocks?.length ? customBlocks : blocksFromNoteText(text),
        notebookId: id,
        style,
        font,
        inkColor,
      })
    );
    navigate(`/editor/${id ? encodeURIComponent(id) : 'new'}`);
  };

  const openNotebook = async (notebook: Notebook) => {
    if (!user?.id || notebook.user_id !== user.id) { toast.error('That note is not available in this account.'); return; }
    const { data, error } = await supabase.from('pages').select('content').eq('notebook_id', notebook.id).eq('user_id', user.id).order('page_number').limit(1);
    if (error) { toast.error('Could not open note'); return; }
    const content = data?.[0]?.content;
    sessionStorage.setItem(
      'niknote-mobile-open',
      JSON.stringify({
        ownerId: user.id,
        title: notebook.title,
        blocks: Array.isArray(content) && content.length ? content : [createBlock()],
        notebookId: notebook.id,
        style: notebook.page_style,
      })
    );
    navigate(`/editor/${encodeURIComponent(notebook.id)}`);
  };

  const localNoteItems = localNotes.map((ln) => ({
    id: ln.id,
    title: ln.title || 'Untitled Note',
    time: new Date(ln.updated_at || ln.updatedAt || Date.now()).toLocaleDateString(),
    tags: ln.tags?.length ? ln.tags : ['Notes'],
    pages: null as number | null,
    icon: FileText,
    tone: 'blue',
    text: ln.content || (ln.blocks ? ln.blocks.map((b) => b.content).join('\n') : ''),
    localBlocks: ln.blocks,
    localStyle: ln.page_style,
    localFont: ln.font,
    localInkColor: ln.ink_color,
    folder: ln.folder ?? null,
    isTrashed: Boolean(ln.trashedAt) || ln.folder === '__trash__',
    isLocal: true,
    notebook: undefined as Notebook | undefined,
  }));

  const cloudItems = notebooks.map((n) => ({
    id: n.id,
    title: n.title,
    time: new Date(n.updated_at).toLocaleDateString(),
    tags: n.tags?.length ? n.tags : ['Notes'],
    pages: null as number | null,
    icon: FileText,
    tone: 'blue',
    text: '',
    localBlocks: undefined as Block[] | undefined,
    localStyle: n.page_style,
    localFont: undefined as HandwritingFont | undefined,
    localInkColor: undefined as InkColor | undefined,
    folder: n.folder ?? null,
    isTrashed: n.folder === '__trash__',
    isLocal: false,
    notebook: n as Notebook | undefined,
  }));

  const allNotes = Array.from(new Map([...cloudItems, ...localNoteItems].map((note) => [note.id, note])).values());
  const activeNotes = allNotes.filter((note) => !note.isTrashed);
  const homeGreeting = getDesktopGreeting();
  const homeDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const heroName = guest ? 'Guest' : firstName || 'there';
  const trashView = pathname === '/trash' || category === 'Trash';
  const visibleNotes = allNotes
    .filter((note) => note.title.toLowerCase().includes(query.toLowerCase()))
    .filter((note) => trashView
      ? note.isTrashed
      : !note.isTrashed && (category === 'All' || note.tags.includes(category)))
    .sort((a, b) => (sort ? a.title.localeCompare(b.title) : 0));

  const localOwnerId = user?.id || 'local-device-guest';
  const moveToTrash = async (note: typeof allNotes[number]) => {
    if (note.isTrashed) return;
    setPrevFolder(note.id, note.folder);
    if (note.notebook) {
      const updated = await updateNotebook(note.id, { folder: '__trash__' });
      if (updated) toast.success('Moved to Trash');
      return;
    }
    if (note.isLocal) {
      const current = findLocalNoteForOwner(note.id, localOwnerId, { allowLegacyClaim: guest });
      if (!current) return;
      const now = new Date().toISOString();
      upsertLocalNoteForOwner({ ...current, folder: '__trash__', trashedAt: now, updated_at: now }, localOwnerId, {}, { allowLegacyClaim: guest });
      setLocalNotes(readLocalDeviceNotes(user?.id, guest));
      notifyLocalDataChanged();
      toast.success('Moved to Trash');
    }
  };
  const restoreFromTrash = async (note: typeof allNotes[number]) => {
    const folder = meta[note.id]?.prevFolder ?? null;
    if (note.notebook) {
      const updated = await updateNotebook(note.id, { folder });
      if (updated) toast.success('Restored');
      return;
    }
    if (note.isLocal) {
      const current = findLocalNoteForOwner(note.id, localOwnerId, { allowLegacyClaim: guest });
      if (!current) return;
      upsertLocalNoteForOwner({ ...current, folder, trashedAt: null, updated_at: new Date().toISOString() }, localOwnerId, {}, { allowLegacyClaim: guest });
      setLocalNotes(readLocalDeviceNotes(user?.id, guest));
      notifyLocalDataChanged();
      toast.success('Restored');
    }
  };
  const deleteForever = (note: typeof allNotes[number]) => {
    if (note.notebook) {
      void deleteNotebook(note.id);
    } else if (note.isLocal) {
      removeLocalNoteForOwner(note.id, localOwnerId);
      setLocalNotes(readLocalDeviceNotes(user?.id, guest));
      notifyLocalDataChanged();
      toast.success('Deleted forever');
    }
  };
  const selectCategory = (nextCategory: string) => {
    if (nextCategory === 'Trash') {
      navigate('/trash');
      return;
    }
    setCategory(nextCategory);
    const target = nextCategory === 'All'
      ? '/notebooks'
      : `/notebooks?category=${encodeURIComponent(nextCategory)}`;
    if (pathname !== '/notebooks' || search !== (nextCategory === 'All' ? '' : `?category=${encodeURIComponent(nextCategory)}`)) {
      navigate(target);
    }
  };

  const renameLocalNote = (id: string, title: string) => {
    const current = findLocalNoteForOwner(id, localOwnerId, { allowLegacyClaim: guest });
    if (current) upsertLocalNoteForOwner({ ...current, title, updated_at: new Date().toISOString() }, localOwnerId, {}, { allowLegacyClaim: guest });
    setLocalNotes(readLocalDeviceNotes(user?.id, guest));
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
            : prepareNote(note.title, note.text, note.isLocal ? note.id : undefined, note.localStyle, note.localBlocks, note.localFont, note.localInkColor)
        }
      >
        <span className={cn('nn-note-icon', `nn-tone-${note.tone}`)}>
          <note.icon className="h-7 w-7" />
        </span>
        <span className="nn-note-copy">
          <strong>{note.title}</strong>
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
                : prepareNote(note.title, note.text, note.isLocal ? note.id : undefined, note.localStyle, note.localBlocks, note.localFont, note.localInkColor)
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
          {trashView ? (
            <>
              <DropdownMenuItem onClick={() => { void restoreFromTrash(note); }}>Restore note</DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  if (window.confirm(`Delete “${note.title}” forever? This cannot be undone.`)) deleteForever(note);
                }}
              >
                Delete forever
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={() => { void moveToTrash(note); }}>Move to Trash</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );

  return (
    <div className="nn-mobile" {...attributes}>
      {page === 'home' ? (
        <header className="nn-header">
          <IconButton icon={Menu} label="Open menu" onClick={() => setDrawer(true)} />
          <div className="nn-logo" aria-label="NikNote">
            <img className="nn-logo-mark" src="/images/brand/niknote-primary-mark.png" alt="" aria-hidden="true" />
            <img className="nn-logo-wordmark" src="/images/brand/niknote-primary-wordmark.png" alt="NikNote" />
          </div>
          <IconButton icon={Search} label="Search notes" onClick={() => navigate('/notebooks?search=1')} />
        </header>
      ) : (
        <MobileHeader title={trashView ? 'Trash' : ({ notes: 'All Notes', profile: 'Profile', appearance: 'Appearance', templates: 'Templates' }[page] || '')}>
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
            <div className="nn-home-toolbar">
              <span className="nn-home-date">{homeDate}</span>
              <ThemeSelector theme={appearance.theme} onChange={(theme) => update({ theme })} />
            </div>
            {welcome && (
              <section className="nn-dashboard-hero" data-testid="mobile-dashboard-hero">
                <IconButton icon={X} label="Dismiss welcome" className="nn-welcome-close" onClick={() => setWelcome(false)} />
                <div className="nn-hero-copy">
                  <span className="nn-hero-eyebrow">YOUR PERSONAL WORKSPACE</span>
                  <h1>
                    {homeGreeting.text},<br />
                    <span>{heroName}</span>{' '}
                    <span className="nn-hero-emoji" aria-hidden="true">{homeGreeting.emoji}</span>
                  </h1>
                  <p className="nn-hero-quote">“A small step everyday leads to big results.”</p>
                  <div className="nn-hero-chips">
                    <span className="nn-hero-chip"><BookOpen /> {activeNotes.length} note{activeNotes.length === 1 ? '' : 's'}</span>
                    <span className="nn-hero-chip"><Sparkles /> Ideas start here</span>
                  </div>
                </div>
                <img
                  className="nn-hero-art"
                  src="/images/brand/niknote-write-it-down.png"
                  alt=""
                  aria-hidden="true"
                />
              </section>
            )}
            <div className="nn-quick-actions">
              {[
                { label: 'NikAI', icon: Sparkles, customImg: '/nikai-mark.png', tone: 'blue', action: () => navigate('/ai') },
                { label: 'Write Note', icon: PenLine, customImg: '', tone: 'green', action: () => navigate('/editor/new') },
                { label: 'Templates', icon: LayoutGrid, customImg: '', tone: 'blue', action: () => navigate('/templates') },
                { label: 'Playground', icon: Shapes, customImg: '', tone: 'blue', action: () => navigate('/playground') },
                { label: 'Draw Board', icon: ScanLine, customImg: '', tone: 'pink', action: () => navigate('/board') },
                { label: 'PDF Edit', icon: FileText, customImg: '', tone: 'gold', action: () => navigate('/pdf-editor') },
              ].map(({ label, icon: Icon, customImg, tone, action }) => (
                <Button variant="ghost" className="nn-quick" key={label} onClick={action}>
                  <span className={cn('nn-quick-icon', `nn-quick-icon-${tone}`)}>
                    {customImg ? (
                      <img src={customImg} alt="" aria-hidden="true" />
                    ) : (
                      <Icon className={cn('h-5 w-5', `nn-ink-${tone}`)} />
                    )}
                  </span>
                  <span>{label}</span>
                </Button>
              ))}
            </div>
            <MobileTrackerCards />
            <div className="nn-section-heading">
              <h2>Recent Notes</h2>
              <Button variant="ghost" className="nn-see-all" onClick={() => navigate('/notebooks')}>
                See all <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            {activeNotes.length > 0 ? (
              <div className="nn-note-list">
                {activeNotes.slice(0, 3).map((n) => noteCard(n, true))}
              </div>
            ) : (
              <div className="nn-empty">
                <BookOpen />
                <h2>No notes yet</h2>
                <p>Your workspace starts blank. Create a note when you are ready.</p>
                <Button onClick={() => navigate('/editor/new')}>Start writing</Button>
              </div>
            )}
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
              {['All', 'Study', 'Work', 'Personal', 'Important', 'Trash'].map((c) => (
                <Button
                  key={c}
                  variant="ghost"
                  aria-pressed={category === c}
                  className={cn('nn-pill', category === c && 'nn-selected')}
                  onClick={() => selectCategory(c)}
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
                <Button onClick={() => trashView ? navigate('/notebooks') : navigate('/editor/new')}>
                  {trashView ? 'Back to All Notes' : 'Create a note'}
                </Button>
              </div>
            )}
            {!trashView && <Button className="nn-fab" size="icon" aria-label="Create note" onClick={() => navigate('/editor/new')}>
              <span className="text-3xl font-light">+</span>
            </Button>}
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
                    onClick={() => prepareNote(t.title, t.text, undefined, t.style, undefined, t.font, t.inkColor)}
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
          <section className="nn-appearance-settings">
            <h2 className="nn-setting-title">Appearance mode</h2>
            <p className="text-sm text-muted-foreground">Your choice is saved globally and used across NikNote.</p>
            <ThemeSelector theme={appearance.theme} onChange={(theme) => update({ theme })} />
          </section>
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
                  if (guest && !window.confirm('You are a guest. Signing out permanently loses access to your notes and trackers unless you add an email first. Sign out anyway?')) return;
                  await signOut();
                  navigate('/home');
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
              { name: 'Home', icon: BookOpen, to: '/home' },
              { name: 'NikAI', icon: Sparkles, to: '/ai' },
              { name: 'Notebook Studio', icon: PenLine, to: '/editor/new' },
              { name: 'DNA Scanner', icon: ScanLine, to: '/editor/new?panel=scan' },
              { name: 'Documents', icon: FileText, to: '/documents' },
              { name: 'Notebooks', icon: BookOpen, to: '/notebooks' },
              { name: 'Trash', icon: Trash2, to: '/trash' },
              { name: 'Draw Board', icon: LayoutGrid, to: '/board' },
              { name: 'Playground', icon: Shapes, to: '/playground' },
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
