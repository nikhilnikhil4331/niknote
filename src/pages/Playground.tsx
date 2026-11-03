import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { useDesktopNotes } from '@/components/desktop/notes';
import { PlaygroundCanvas, type PlaygroundCanvasHandle } from '@/components/playground/PlaygroundCanvas';
import { PlaygroundHeader, type AppThemeMode } from '@/components/playground/PlaygroundHeader';
import { PlaygroundSidebar } from '@/components/playground/PlaygroundSidebar';
import { PlaygroundNotesPreview } from '@/components/playground/PlaygroundNotesPreview';
import { BlockLibrary } from '@/components/playground/BlockLibrary';
import { usePlayground } from '@/hooks/usePlayground';
import { playgroundToNoteText, type PlaygroundTheme } from '@/lib/playground';
import '@/components/playground/playground.css';

export default function PlaygroundPage() {
  const navigate = useNavigate();
  const canvasRef = useRef<PlaygroundCanvasHandle>(null);
  const playground = usePlayground();
  const { active: notes, openNew: openNoteEditor } = useDesktopNotes();
  const [libraryOpen, setLibraryOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 1180);
  const [documentsOpen, setDocumentsOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 900);
  const [presentation, setPresentation] = useState(false);
  const [notesPreview, setNotesPreview] = useState(false);
  const [appMode, setAppMode] = useState<AppThemeMode>(() => {
    const value = localStorage.getItem('niknote.playground.appTheme');
    return value === 'dark' || value === 'system' ? value : 'light';
  });
  const [tabs, setTabs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('niknote.playground.tabs.v1') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const dark = appMode === 'dark' || (appMode === 'system' && media.matches);
      document.documentElement.classList.toggle('pg-app-dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    document.documentElement.classList.add('pg-playground-route');
    applyTheme();
    media.addEventListener('change', applyTheme);
    return () => {
      media.removeEventListener('change', applyTheme);
      document.documentElement.classList.remove('pg-playground-route', 'pg-app-dark', 'pg-presenting');
      document.documentElement.style.colorScheme = '';
    };
  }, [appMode]);

  useEffect(() => {
    localStorage.setItem('niknote.playground.appTheme', appMode);
  }, [appMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('pg-presenting', presentation);
  }, [presentation]);

  useEffect(() => {
    if (!playground.ready) return;
    localStorage.setItem('niknote.playground.canvasTheme', playground.doc.theme);
    setTabs((previous) => {
      const valid = previous.filter((id) => playground.index.some((entry) => entry.id === id));
      const next = valid.includes(playground.doc.id) ? valid : [...valid, playground.doc.id];
      const limited = next.slice(-5);
      localStorage.setItem('niknote.playground.tabs.v1', JSON.stringify(limited));
      return limited;
    });
  }, [playground.doc.id, playground.doc.theme, playground.index, playground.ready]);

  const createCanvas = useCallback(() => {
    setNotesPreview(false);
    playground.createCanvas();
    if (window.innerWidth < 900) setDocumentsOpen(false);
  }, [playground]);

  const closeTab = (id: string) => {
    if (tabs.length <= 1 && id === playground.doc.id) {
      toast.info('Keep one canvas tab open, or create another tab first.');
      return;
    }
    const remaining = tabs.filter((tabId) => tabId !== id);
    setTabs(remaining);
    localStorage.setItem('niknote.playground.tabs.v1', JSON.stringify(remaining));
    if (id === playground.doc.id && remaining[0]) playground.openCanvas(remaining[0]);
  };

  const renameCanvas = (id: string, title: string) => {
    void playground.renameCanvas(id, title).then(({ cloudError }) => {
      if (cloudError) toast.error('Name changed on this device, but cloud sync failed.');
    });
  };

  const deleteCanvas = async (id: string) => {
    const entry = playground.index.find((candidate) => candidate.id === id);
    if (!window.confirm(`Delete “${entry?.title || 'this canvas'}”? This removes its local copy${playground.isCloud ? ' and cloud copy' : ''}.`)) return;
    const result = await playground.deleteCanvas(id);
    if (result.cloudError) toast.error('Deleted on this device, but the cloud copy could not be deleted.');
    else toast.success(playground.isCloud ? 'Canvas deleted' : 'Canvas deleted from this device');
  };

  const setCanvasTheme = (theme: PlaygroundTheme) => {
    playground.apply((draft) => { draft.theme = theme; }, { touch: false });
  };

  const openNoteDraft = (options: { title: string; text: string; canvasId: string }) => {
    if (!playground.flushLocal()) {
      toast.error('Save the canvas on this device before opening Notes Taking.');
      return;
    }
    openNoteEditor(options);
  };

  const openCanvasInNotes = () => {
    const reference = `${window.location.origin}/playground?id=${encodeURIComponent(playground.doc.id)}`;
    openNoteDraft({
      title: playground.doc.title || 'Untitled playground',
      text: playgroundToNoteText(playground.doc, reference),
      canvasId: playground.doc.id,
    });
  };

  return (
    <DesktopShell>
      <div className={`pg-page${presentation ? ' is-presenting' : ''}`}>
        {!presentation && (
          <PlaygroundHeader
            title={playground.doc.title}
            entries={playground.index}
            tabs={tabs.includes(playground.doc.id) || !playground.ready ? tabs : [...tabs, playground.doc.id]}
            activeId={playground.doc.id}
            objects={playground.doc.objects}
            saveState={playground.saveState}
            syncMessage={playground.syncMessage}
            appMode={appMode}
            canvasTheme={playground.doc.theme}
            documentsOpen={documentsOpen}
            notesPreview={notesPreview}
            onToggleDocuments={() => setDocumentsOpen((value) => !value)}
            onToggleNotesPreview={() => setNotesPreview((value) => !value)}
            onTitle={(title) => playground.apply((draft) => { draft.title = title; })}
            onOpen={playground.openCanvas}
            onCloseTab={closeTab}
            onCreate={createCanvas}
            onSelectObject={(id) => canvasRef.current?.focusObject(id)}
            onAppMode={setAppMode}
            onCanvasTheme={setCanvasTheme}
          />
        )}
        {presentation && <button className="pg-exit-presentation" onClick={() => setPresentation(false)}><X size={14} /> Exit presentation</button>}
        {playground.syncMessage && !presentation && <div className="pg-sync-notice">{playground.syncMessage}</div>}

        <div className="pg-workspace-body">
          {!presentation && documentsOpen && (
            <PlaygroundSidebar
              entries={playground.index}
              activeId={playground.doc.id}
              onOpen={(id) => { playground.openCanvas(id); if (window.innerWidth < 900) setDocumentsOpen(false); }}
              onCreate={createCanvas}
              onDuplicate={playground.duplicateCanvas}
              onDelete={(id) => void deleteCanvas(id)}
              onMeta={playground.updateIndexEntry}
              onRename={renameCanvas}
              onReorder={playground.reorderCanvases}
              onClose={() => setDocumentsOpen(false)}
            />
          )}
          <main className="pg-canvas-main">
            {playground.ready ? (
              notesPreview ? (
                <PlaygroundNotesPreview doc={playground.doc} onBack={() => setNotesPreview(false)} onOpenNotes={openCanvasInNotes} />
              ) : (
                <PlaygroundCanvas
                  ref={canvasRef}
                  doc={playground.doc}
                  apply={playground.apply}
                  onViewportChange={playground.updateViewport}
                  beginTransaction={playground.beginTransaction}
                  undo={playground.undo}
                  redo={playground.redo}
                  canUndo={playground.canUndo}
                  canRedo={playground.canRedo}
                  libraryOpen={libraryOpen}
                  onToggleLibrary={() => setLibraryOpen((value) => !value)}
                  onPresentation={() => setPresentation(true)}
                  onOpenDocument={(object) => openNoteDraft({
                    title: (object.text || 'Canvas note').split('\n')[0].slice(0, 80),
                    text: `${object.text || object.subtitle || ''}\n\nCanvas reference: ${window.location.origin}/playground?id=${encodeURIComponent(playground.doc.id)}`,
                    canvasId: playground.doc.id,
                  })}
                />
              )
            ) : (
              <div className="pg-loading"><img src="/niknote-logo.png" alt="NikNote" /><span>Opening your playground…</span></div>
            )}
          </main>
          {!presentation && !notesPreview && libraryOpen && (
            <BlockLibrary
              notes={notes.map((note) => ({ id: note.id, title: note.title }))}
              onAdd={(kind, overrides) => {
                const linkedOverrides = kind === 'link' && overrides?.href?.includes('editor=1')
                  ? { ...overrides, href: `${overrides.href}&canvas=${encodeURIComponent(playground.doc.id)}` }
                  : overrides;
                if (kind === 'text') canvasRef.current?.writeText(linkedOverrides);
                else {
                  const id = canvasRef.current?.addBlock(kind, linkedOverrides);
                  if (kind === 'chart' && id) canvasRef.current?.editObject(id);
                }
                if (window.innerWidth < 700) setLibraryOpen(false);
              }}
              onImage={() => canvasRef.current?.openImagePicker()}
              onPen={() => { canvasRef.current?.setTool('pen'); if (window.innerWidth < 700) setLibraryOpen(false); }}
              onAI={() => navigate('/ai')}
              onClose={() => setLibraryOpen(false)}
            />
          )}
        </div>

      </div>
    </DesktopShell>
  );
}
