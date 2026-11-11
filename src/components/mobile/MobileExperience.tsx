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
        title,
        blocks: customBlocks?.length ? customBlocks : blocksFromNoteText(text),
        notebookId: id,
        style,
        font,
        inkColor,
      })
    );
    navigate(`/?editor=1${id ? `&notebook=${id}` : ''}`);
  };

  const openNotebook = async (notebook: Notebook) => {
    if (!user?.id || notebook.user_id !== user.id) { toast.error('That note is not available in this account.'); return; }
    const { data, error } = await supabase.from('pages').select('content').eq('notebook_id', notebook.id).eq('user_id', user.id).order('page_number').limit(1);
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
    isLocal: false,
    notebook: n as Notebook | undefined,
  }));

  const allNotes = Array.from(new Map([...cloudItems, ...localNoteItems].map((note) => [note.id, note])).values());
  const visibleNotes = allNotes
    .filter((n) => n.title.toLowerCase().includes(query.toLowerCase()) && (category === 'All' || n.tags.includes(category)))
    .sort((a, b) => (sort ? a.title.localeCompare(b.title) : 0));

  const localOwnerId = user?.id || 'local-device-guest';
  const deleteLocalNote = (id: string) => {
    removeLocalNoteForOwner(id, localOwnerId);
    setLocalNotes(readLocalDeviceNotes(user?.id, guest));
    toast.success('Note deleted');
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
          <DropdownMenuItem
            onClick={() => {
              if (note.notebook) {
                if (window.confirm(`Delete ${note.title}?`)) deleteNotebook(note.id);
              } else if (note.isLocal) {
                deleteLocalNote(note.id);
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
                { label: 'NikAI', icon: Sparkles, customImg: '/nikai-mark.png', tone: 'blue', action: () => navigate('/ai') },
                { label: 'Write Note', icon: PenLine, customImg: '', tone: 'green', action: () => navigate('/?editor=1&new=1') },
                { label: 'Templates', icon: LayoutGrid, customImg: '', tone: 'blue', action: () => navigate('/templates') },
                { label: 'Playground', icon: Shapes, customImg: '', tone: 'blue', action: () => navigate('/playground') },
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
            {allNotes.length > 0 ? (
              <div className="nn-note-list">
                {allNotes.slice(0, 3).map((n) => noteCard(n, true))}
              </div>
            ) : (
              <div className="nn-empty">
                <BookOpen />
                <h2>No notes yet</h2>
                <p>Your workspace starts blank. Create a note when you are ready.</p>
                <Button onClick={() => navigate('/?editor=1&new=1')}>Start writing</Button>
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
