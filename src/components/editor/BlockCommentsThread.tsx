// ============================================================
// BlockCommentsThread — mobile-first bottom sheet for block-level comments
// Realtime updates via supabase channel; @-mention aware composer.
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MentionPopup, MentionItem } from "./MentionPopup";
import { cn } from "@/lib/utils";

interface BlockComment {
  id: string;
  block_id: string;
  body: string;
  author_id: string;
  mentions: MentionItem[];
  created_at: string;
  author_name?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  blockId: string;
  notebookId?: string | null;
  tasks?: MentionItem[];
}

export const BlockCommentsThread: React.FC<Props> = ({ open, onClose, blockId, notebookId, tasks }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<BlockComment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [mentions, setMentions] = useState<MentionItem[]>([]);
  const [mentionState, setMentionState] = useState<{ query: string; anchor: number; position: { top: number; left: number } } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load + subscribe
  useEffect(() => {
    if (!open || !blockId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("block_comments")
        .select("*")
        .eq("block_id", blockId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setComments((data || []) as unknown as BlockComment[]);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`block_comments:${blockId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "block_comments", filter: `block_id=eq.${blockId}` },
        (payload) => {
          setComments(prev => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as unknown as BlockComment;
              if (prev.some(c => c.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === "DELETE") {
              return prev.filter(c => c.id !== (payload.old as { id: string }).id);
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as unknown as BlockComment;
              return prev.map(c => c.id === row.id ? row : c);
            }
            return prev;
          });
        })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [open, blockId]);

  // Autoscroll on new comment
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [comments.length]);

  const submit = async () => {
    if (!user || !body.trim()) return;
    setSending(true);
    const { error } = await supabase.from("block_comments").insert({
      block_id: blockId,
      notebook_id: notebookId ?? null,
      author_id: user.id,
      body: body.trim(),
      mentions: mentions as unknown as object,
    });
    setSending(false);
    if (!error) { setBody(""); setMentions([]); }
  };

  const removeComment = async (id: string) => {
    await supabase.from("block_comments").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  // @ trigger in composer
  const onBodyChange = (v: string) => {
    setBody(v);
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart;
    // Find last '@' before caret with no whitespace after
    const before = v.slice(0, caret);
    const at = before.lastIndexOf("@");
    if (at === -1 || (at > 0 && !/\s/.test(before[at - 1]))) {
      setMentionState(null);
      return;
    }
    const query = before.slice(at + 1);
    if (/\s/.test(query)) { setMentionState(null); return; }
    const rect = el.getBoundingClientRect();
    setMentionState({ query, anchor: at, position: { top: rect.top - 8, left: rect.left } });
  };

  const insertMention = (item: MentionItem) => {
    if (!mentionState || !textareaRef.current) return;
    const el = textareaRef.current;
    const caret = el.selectionStart;
    const token = `@[${item.label}](${item.type}:${item.id})`;
    const next = body.slice(0, mentionState.anchor) + token + " " + body.slice(caret);
    setBody(next);
    setMentions(m => [...m, item]);
    setMentionState(null);
    requestAnimationFrame(() => {
      const pos = mentionState.anchor + token.length + 1;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const formattedComments = useMemo(() => comments, [comments]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[color:var(--nk-scrim)] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className={cn(
              "fixed z-[101] left-0 right-0 bottom-0 bg-surface rounded-t-3xl shadow-2xl",
              "max-h-[85dvh] flex flex-col",
              "sm:left-auto sm:right-6 sm:bottom-6 sm:w-[380px] sm:rounded-3xl sm:max-h-[70dvh]"
            )}
          >
            <div className="pt-2 pb-1 flex justify-center sm:hidden">
              <div className="w-10 h-1.5 rounded-full bg-surface-hover" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-subtle">
              <div>
                <div className="text-[15px] font-semibold text-fg-primary">Comments</div>
                <div className="text-[11px] text-fg-muted">{formattedComments.length} {formattedComments.length === 1 ? "reply" : "replies"}</div>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center" aria-label="Close">
                <X className="w-4 h-4 text-fg-muted" />
              </button>
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
              {loading ? (
                <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-fg-muted/70" /></div>
              ) : formattedComments.length === 0 ? (
                <div className="text-center py-10 text-[12px] text-fg-muted/70">No comments yet — start the discussion.</div>
              ) : (
                formattedComments.map(c => (
                  <div key={c.id} className="group flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-[color:hsl(var(--primary)/0.12)] text-fg-secondary text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
                      {(c.author_name || "U").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-fg-muted mb-0.5">
                        {new Date(c.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="text-[13px] text-fg-primary whitespace-pre-wrap break-words">
                        {renderBodyWithMentions(c.body)}
                      </div>
                    </div>
                    {user?.id === c.author_id && (
                      <button
                        onClick={() => removeComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[color:hsl(var(--error)/0.14)] text-fg-muted/70 hover:text-error"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Composer */}
            <div className="px-3 pt-2 pb-[max(env(safe-area-inset-bottom),10px)] border-t border-subtle">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={(e) => onBodyChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !mentionState) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={1}
                  placeholder="Reply… (use @ to mention)"
                  style={{ fontSize: "16px" }}
                  className="flex-1 min-h-11 max-h-32 rounded-xl border border-subtle px-3 py-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:hsl(var(--focus-ring-hsl))] focus:border-primary focus:ring-2 focus:ring-primary resize-none text-[14px]"
                />
                <button
                  onClick={submit}
                  disabled={!body.trim() || sending}
                  className="h-11 w-11 rounded-xl bg-gradient-to-r from-nk-purple to-nk-rose text-white flex items-center justify-center disabled:opacity-40"
                  aria-label="Send"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>

          <MentionPopup
            isOpen={!!mentionState}
            query={mentionState?.query || ""}
            position={mentionState?.position || { top: 0, left: 0 }}
            onSelect={insertMention}
            onClose={() => setMentionState(null)}
            tasks={tasks}
          />
        </>
      )}
    </AnimatePresence>
  );
};

// Render @[label](type:id) tokens as pills
function renderBodyWithMentions(body: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /@\[([^\]]+)\]\(([a-z]+):([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) parts.push(<span key={`t-${key++}`}>{body.slice(last, m.index)}</span>);
    parts.push(
      <span key={`m-${key++}`} className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-[color:hsl(var(--primary)/0.12)] text-fg-secondary text-[12px] font-medium">
        @{m[1]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) parts.push(<span key={`t-${key++}`}>{body.slice(last)}</span>);
  return parts;
}

export default BlockCommentsThread;
