// ============================================================
// MentionPopup — @-mention search: People / Pages / Tasks
// Client-side fuzzy filter; supabase-backed people & pages
// Insert token: @[label](type:id)
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import useDebounce from "@/hooks/useDebounce";
import { User, FileText, CheckSquare } from "lucide-react";

export type MentionType = "person" | "page" | "task";

export interface MentionItem {
  id: string;
  type: MentionType;
  label: string;
  sublabel?: string;
}

interface Props {
  isOpen: boolean;
  query: string;
  position: { top: number; left: number };
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  /** Tasks derived from the current document (todo blocks) */
  tasks?: MentionItem[];
}

const TAB_META: Record<MentionType, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  person: { label: "People", Icon: User },
  page:   { label: "Pages",  Icon: FileText },
  task:   { label: "Tasks",  Icon: CheckSquare },
};

export const MentionPopup: React.FC<Props> = ({
  isOpen, query, position, onSelect, onClose, tasks = [],
}) => {
  const [tab, setTab] = useState<MentionType>("person");
  const [people, setPeople] = useState<MentionItem[]>([]);
  const [pages, setPages] = useState<MentionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 120);

  // Fetch people (profiles) + pages (notebooks) once when opened
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      const [{ data: profs }, { data: nbs }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, avatar_url").limit(50),
        supabase.from("notebooks").select("id, title").order("updated_at", { ascending: false }).limit(50),
      ]);
      if (cancelled) return;
      setPeople(
        (profs || []).map((p: { user_id: string; display_name: string | null; avatar_url: string | null }) => ({
          id: p.user_id,
          type: "person" as const,
          label: p.display_name || "Unnamed",
          sublabel: p.avatar_url || undefined,
        }))
      );
      setPages(
        (nbs || []).map((n: { id: string; title: string | null }) => ({
          id: n.id,
          type: "page" as const,
          label: n.title || "Untitled",
        }))
      );
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const source = tab === "person" ? people : tab === "page" ? pages : tasks;
    if (!q) return source.slice(0, 25);
    return source.filter(i => i.label.toLowerCase().includes(q)).slice(0, 25);
  }, [tab, debouncedQuery, people, pages, tasks]);

  useEffect(() => { setSelectedIndex(0); }, [tab, debouncedQuery, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") {
        const item = filtered[selectedIndex];
        if (item) { e.preventDefault(); onSelect(item); }
      }
      else if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "Tab") {
        e.preventDefault();
        const order: MentionType[] = ["person", "page", "task"];
        const idx = order.indexOf(tab);
        setTab(order[(idx + (e.shiftKey ? -1 : 1) + order.length) % order.length]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, filtered, selectedIndex, tab, onSelect, onClose]);

  if (!isOpen) return null;

  const top = Math.min(position.top, window.innerHeight - 340);
  const left = Math.min(position.left, window.innerWidth - 300);

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-[280px] max-h-[320px] overflow-hidden rounded-xl border border-subtle bg-surface shadow-2xl flex flex-col"
      style={{ top, left }}
    >
      {/* Tabs */}
      <div className="flex border-b border-subtle">
        {(Object.keys(TAB_META) as MentionType[]).map((t) => {
          const meta = TAB_META[t];
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors",
                active ? "text-accent-cool border-b-2 border-primary -mb-px" : "text-fg-muted hover:text-fg-primary"
              )}
            >
              <meta.Icon className="w-3 h-3" /> {meta.label}
            </button>
          );
        })}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-fg-muted/70">No matches</div>
        ) : (
          filtered.map((item, idx) => (
            <button
              key={`${item.type}-${item.id}`}
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={() => onSelect(item)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors",
                idx === selectedIndex ? "bg-[color:hsl(var(--primary)/0.12)]" : "hover:bg-muted"
              )}
            >
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-[10px] font-semibold text-fg-secondary">
                {item.label.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-fg-primary truncate">{item.label}</div>
                {item.sublabel && item.type !== "person" && (
                  <div className="text-[10px] text-fg-muted/70 truncate">{item.sublabel}</div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default MentionPopup;
