// ============================================================
// NikNote Desktop — Shared with me
// Open notes shared with you via link, and keep a history of
// shared links you have opened. Desktop only.
// ============================================================

import React, { useMemo, useState } from 'react';
import { Link2, ArrowRight, Users, Share2, MousePointerClick, History, X } from 'lucide-react';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { useDesktopNotes } from '@/components/desktop/notes';
import { useLocalStore } from '@/components/desktop/store';
import { toast } from 'sonner';

interface SharedLink {
  url: string;
  at: string;
}

const DesktopShared: React.FC = () => {
  const { active, trashed, guest } = useDesktopNotes();
  const [link, setLink] = useState('');
  const [history, setHistory] = useLocalStore<SharedLink[]>('niknote.desktop.sharedLinks.v1', []);

  const folders = useMemo(
    () => Array.from(new Set(active.map((n) => n.folder).filter(Boolean) as string[])),
    [active],
  );

  const openLink = (raw: string) => {
    const clean = raw.trim();
    if (!clean) return;
    let target = clean;
    try {
      const u = new URL(clean);
      // Same-site NikNote link → open in-app; external → new tab
      if (u.hostname === window.location.hostname || u.hostname.endsWith('niknote.online')) {
        target = u.pathname + u.search + u.hash;
        setHistory((prev) => [{ url: clean, at: new Date().toISOString() }, ...prev.filter((h) => h.url !== clean)].slice(0, 12));
        window.location.href = target;
        return;
      }
      window.open(u.toString(), '_blank', 'noopener,noreferrer');
    } catch {
      // allow raw paths like /?editor=1&notebook=...
      if (clean.startsWith('/')) {
        setHistory((prev) => [{ url: clean, at: new Date().toISOString() }, ...prev.filter((h) => h.url !== clean)].slice(0, 12));
        window.location.href = clean;
        return;
      }
      toast.error('That does not look like a valid NikNote link');
      return;
    }
    setHistory((prev) => [{ url: clean, at: new Date().toISOString() }, ...prev.filter((h) => h.url !== clean)].slice(0, 12));
    setLink('');
  };

  return (
    <DesktopShell counts={{ notes: active.length, trash: trashed.length }} folders={folders}>
      <div className="mx-auto w-full max-w-[900px] px-8 py-7">
        <div className="nd-anim">
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em]" style={{ color: 'var(--nd-text)' }}>Shared with me</h1>
          <p className="text-[12.5px]" style={{ color: 'var(--nd-text-3)' }}>
            Someone shared a NikNote with you? Paste the link to open it right here.
          </p>
        </div>

        {/* Paste link */}
        <div className="nd-card p-5 mt-6 nd-anim nd-anim-1">
          <div className="flex items-center gap-2 text-[14px] font-bold" style={{ color: 'var(--nd-text)' }}>
            <Link2 size={16} color="#6C5CE7" /> Open a shared note
          </div>
          <div className="flex gap-2 mt-3">
            <input
              className="nd-input flex-1"
              placeholder="Paste NikNote link… (e.g. https://www.niknote.online/?notebook=…)"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && openLink(link)}
            />
            <button className="nd-btn-primary" onClick={() => openLink(link)}>
              Open <ArrowRight size={14} />
            </button>
          </div>
          <p className="mt-2.5 text-[12px]" style={{ color: 'var(--nd-text-3)' }}>
            NikNote links open inside the app; other links open safely in a new tab.
          </p>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="nd-card mt-4 nd-anim nd-anim-2">
            <div className="flex items-center gap-2 px-5 pt-4 text-[13px] font-bold" style={{ color: 'var(--nd-text)' }}>
              <History size={14} color="#6C5CE7" /> Recently opened shared notes
            </div>
            <div className="p-2.5">
              {history.map((h) => (
                <div key={h.url} className="flex items-center gap-2.5 rounded-xl px-3 py-2 hover:bg-[#F8F7FF] transition-colors group">
                  <button className="flex-1 min-w-0 text-left" onClick={() => openLink(h.url)}>
                    <span className="block text-[13px] font-medium truncate" style={{ color: 'var(--nd-text)' }}>{h.url}</span>
                    <span className="block text-[11px]" style={{ color: 'var(--nd-text-3)' }}>
                      {new Date(h.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </button>
                  <button
                    className="nd-icon-btn !w-6 !h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove from history"
                    onClick={() => setHistory((prev) => prev.filter((x) => x.url !== h.url))}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How sharing works */}
        <div className="grid grid-cols-3 gap-4 mt-4 pb-10 nd-anim nd-anim-3">
          {[
            { icon: MousePointerClick, title: '1 · Open any note', sub: 'Pick a note from My Notes to open it in the editor.', color: '#6C5CE7', bg: '#ECE7FF' },
            { icon: Share2, title: '2 · Tap Share', sub: 'Use the Share button in the editor to copy a link or export.', color: '#2F6FED', bg: '#E1EEFF' },
            { icon: Users, title: '3 · Anyone can view', sub: 'Friends open your link and read the note — no app needed.', color: '#149A66', bg: '#DCF5E7' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="nd-card p-4">
                <span className="inline-flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 11, background: s.bg, color: s.color }}>
                  <Icon size={17} />
                </span>
                <div className="mt-2.5 text-[13.5px] font-bold" style={{ color: 'var(--nd-text)' }}>{s.title}</div>
                <div className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--nd-text-2)' }}>{s.sub}</div>
              </div>
            );
          })}
        </div>

        {guest && (
          <p className="text-center text-[12.5px] pb-4" style={{ color: 'var(--nd-text-3)' }}>
            Tip: sign in to keep your shared notes synced across phone and desktop.
          </p>
        )}
      </div>
    </DesktopShell>
  );
};

export default DesktopShared;
