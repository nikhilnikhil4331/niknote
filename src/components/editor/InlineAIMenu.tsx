// ============================================================
// InlineAIMenu — mobile-first bottom sheet for inline AI actions
// Desktop falls back to a centered modal; both share the same UX.
// Actions: Improve, Fix grammar, Shorten, Lengthen, Continue, Summarize,
//          Translate, Explain, Custom prompt.
// ============================================================
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Wand2, SpellCheck, ChevronsRightLeft, StretchHorizontal,
  ArrowDownToLine, Languages, FileText, HelpCircle, X, Check, RotateCw, Loader2, Eye, GitCompare,
} from "lucide-react";
import { useAIStream, AIAction } from "@/hooks/useAIStream";
import { AIDiffView } from "./AIDiffView";
import { cn } from "@/lib/utils";

// Actions where a side-by-side diff makes sense (text is being transformed in-place)
const DIFF_ACTIONS: AIAction[] = ["improve", "fix_grammar", "shorten", "lengthen", "translate"];

interface InlineAIMenuProps {
  open: boolean;
  onClose: () => void;
  /** The block/selection text the AI should transform */
  text: string;
  /** Optional surrounding context (previous/next blocks joined) */
  context?: string;
  /** Called with the accepted output */
  onAccept: (output: string) => void;
}

interface ActionDef {
  id: AIAction;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
  needsInstruction?: boolean;
  needsLanguage?: boolean;
}

const ACTIONS: ActionDef[] = [
  { id: "improve",     label: "Improve writing",  hint: "Better clarity & flow",    Icon: Wand2 },
  { id: "fix_grammar", label: "Fix grammar",      hint: "Spelling & punctuation",   Icon: SpellCheck },
  { id: "shorten",     label: "Make shorter",     hint: "Trim without losing sense",Icon: ChevronsRightLeft },
  { id: "lengthen",    label: "Make longer",      hint: "Add detail & examples",    Icon: StretchHorizontal },
  { id: "continue",    label: "Continue writing", hint: "Extend from where it ends",Icon: ArrowDownToLine },
  { id: "summarize",   label: "Summarize",        hint: "1-3 crisp sentences",      Icon: FileText },
  { id: "translate",   label: "Translate to…",    hint: "Any language",             Icon: Languages, needsLanguage: true },
  { id: "explain",     label: "Explain simply",   hint: "Student-friendly",         Icon: HelpCircle },
  { id: "custom",      label: "Custom prompt…",   hint: "Tell the AI what to do",   Icon: Sparkles, needsInstruction: true },
];

export const InlineAIMenu: React.FC<InlineAIMenuProps> = ({
  open, onClose, text, context, onAccept,
}) => {
  const { output, status, error, run, reset } = useAIStream();
  const [chosen, setChosen] = useState<ActionDef | null>(null);
  const [instruction, setInstruction] = useState("");
  const [language, setLanguage] = useState("English");

  const [showDiff, setShowDiff] = useState(true);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      reset();
      setChosen(null);
      setInstruction("");
    }
  }, [open, reset]);

  // Lock body scroll while sheet is open (mobile)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const trigger = (act: ActionDef) => {
    setChosen(act);
    if (act.needsInstruction || act.needsLanguage) return; // wait for input
    run({ action: act.id, text, context });
  };

  const submitInputAction = () => {
    if (!chosen) return;
    run({
      action: chosen.id,
      text,
      context,
      instruction: chosen.needsInstruction ? instruction : undefined,
      targetLanguage: chosen.needsLanguage ? language : undefined,
    });
  };

  const retry = () => {
    if (!chosen) return;
    run({
      action: chosen.id,
      text,
      context,
      instruction: chosen.needsInstruction ? instruction : undefined,
      targetLanguage: chosen.needsLanguage ? language : undefined,
    });
  };

  const canAccept = status === "done" && output.trim().length > 0;

  const hasPreview = useMemo(
    () => chosen && (status === "streaming" || status === "done" || status === "error"),
    [chosen, status]
  );

  const showActionList = !hasPreview && !(chosen?.needsInstruction || chosen?.needsLanguage);
  const showInputForm = chosen && !hasPreview && (chosen.needsInstruction || chosen.needsLanguage);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
          />

          {/* Sheet (mobile-first bottom sheet; on desktop we constrain width and center) */}
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
            className={cn(
              "fixed z-[101] left-0 right-0 bottom-0 bg-white rounded-t-3xl shadow-2xl",
              "max-h-[85dvh] flex flex-col",
              "sm:left-1/2 sm:right-auto sm:bottom-6 sm:-translate-x-1/2 sm:w-[440px] sm:rounded-3xl sm:max-h-[80dvh]"
            )}
          >
            {/* Grabber */}
            <div className="pt-2 pb-1 flex justify-center sm:hidden">
              <div className="w-10 h-1.5 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#F4F1FC] border border-purple-100 flex items-center justify-center">
                  <img src="/nikai-mark.png" alt="" aria-hidden="true" className="h-6 w-auto object-contain select-none" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-gray-900">Ask NikAI</div>
                  <div className="text-[11px] text-gray-500">
                    {chosen ? chosen.label : `${text.trim().split(/\s+/).filter(Boolean).length} words selected`}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* Action list */}
              {showActionList && (
                <div className="p-3">
                  {ACTIONS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => trigger(a)}
                      className="w-full min-h-[52px] flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                        <a.Icon className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium text-gray-900">{a.label}</div>
                        <div className="text-[11px] text-gray-500">{a.hint}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Input form for custom / translate */}
              {showInputForm && chosen && (
                <div className="p-5 space-y-4">
                  {chosen.needsInstruction && (
                    <div>
                      <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                        What should the AI do?
                      </label>
                      <textarea
                        autoFocus
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        placeholder="e.g. Turn this into bullet points"
                        rows={3}
                        style={{ fontSize: "16px" }}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
                      />
                    </div>
                  )}
                  {chosen.needsLanguage && (
                    <div>
                      <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                        Translate to
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {["English", "Hindi", "Hinglish", "Spanish", "French", "German", "Japanese", "Arabic", "Marathi"].map((l) => (
                          <button
                            key={l}
                            onClick={() => setLanguage(l)}
                            className={cn(
                              "min-h-11 px-3 py-2 rounded-xl text-[13px] font-medium border transition-colors",
                              language === l
                                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={submitInputAction}
                    disabled={chosen.needsInstruction && !instruction.trim()}
                    className="w-full min-h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" /> Generate
                  </button>
                </div>
              )}

              {/* Streaming preview / result */}
              {hasPreview && (
                <div className="p-5 space-y-3">
                  {status === "error" ? (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-[13px] text-red-800">
                      {error || "Something went wrong."}
                    </div>
                  ) : (
                    <>
                      {chosen && DIFF_ACTIONS.includes(chosen.id) && status === "done" && (
                        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-0.5 w-fit">
                          <button
                            onClick={() => setShowDiff(true)}
                            className={cn(
                              "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                              showDiff ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                            )}
                          >
                            <GitCompare className="w-3 h-3" /> Diff
                          </button>
                          <button
                            onClick={() => setShowDiff(false)}
                            className={cn(
                              "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                              !showDiff ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                            )}
                          >
                            <Eye className="w-3 h-3" /> Result
                          </button>
                        </div>
                      )}
                      <div className="rounded-2xl bg-gradient-to-br from-indigo-50/60 to-purple-50/60 border border-indigo-100 p-4 min-h-[120px]">
                        <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
                          {status === "streaming" ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Writing…</>
                          ) : (
                            <><Sparkles className="w-3 h-3" /> Suggested</>
                          )}
                        </div>
                        {chosen && DIFF_ACTIONS.includes(chosen.id) && status === "done" && showDiff ? (
                          <AIDiffView original={text} next={output} />
                        ) : (
                          <div className="whitespace-pre-wrap text-[14px] leading-relaxed text-gray-900">
                            {output || (status === "streaming" ? "…" : "")}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer actions */}
            {hasPreview && (
              <div className="px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] border-t border-gray-100 grid grid-cols-3 gap-2">
                <button
                  onClick={() => { reset(); setChosen(null); }}
                  className="min-h-12 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-700 hover:bg-gray-50"
                >
                  Discard
                </button>
                <button
                  onClick={retry}
                  disabled={status === "streaming"}
                  className="min-h-12 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCw className="w-3.5 h-3.5" /> Retry
                </button>
                <button
                  onClick={() => { if (canAccept) { onAccept(output.trim()); onClose(); } }}
                  disabled={!canAccept}
                  className="min-h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> Accept
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
