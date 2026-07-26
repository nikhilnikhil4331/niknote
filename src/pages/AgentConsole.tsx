// ============================================================
// Agent Console — pick a specialist agent, chat with it via editor-ai
// Uses action:"custom" with instruction = agent.systemPrompt + user prompt.
// ============================================================
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Send, Search, Sparkles, StopCircle, RotateCw, Users } from "lucide-react";
import { AGENTS, CATEGORIES, getAgent, type AgentSpec } from "@/data/agents";
import { useAIStream } from "@/hooks/useAIStream";

interface Msg { role: "user" | "assistant"; content: string; agentId?: string; }

export default function AgentConsole() {
  const [selectedId, setSelectedId] = useState<string>("teacher");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const ai = useAIStream();

  const agent = getAgent(selectedId) ?? AGENTS[0];

  const visibleAgents = useMemo(() => {
    const q = search.toLowerCase();
    return AGENTS.filter((a) => {
      if (category !== "all" && a.category !== category) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
      );
    });
  }, [category, search]);

  // Append streaming output to last assistant message
  useEffect(() => {
    if (ai.status === "streaming" || ai.status === "done") {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          copy[copy.length - 1] = { ...last, content: ai.output };
        }
        return copy;
      });
    }
    if (ai.status === "error" && ai.error) {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && !last.content) {
          copy[copy.length - 1] = { ...last, content: `⚠️ ${ai.error}` };
        }
        return copy;
      });
    }
  }, [ai.output, ai.status, ai.error]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, ai.output]);

  const send = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || ai.status === "streaming") return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: msg },
      { role: "assistant", content: "", agentId: agent.id },
    ]);
    ai.run({
      action: "custom",
      text: msg,
      instruction: agent.systemPrompt,
    });
  };

  const switchAgent = (a: AgentSpec) => {
    if (ai.status === "streaming") ai.cancel();
    setSelectedId(a.id);
  };

  const clearChat = () => {
    ai.cancel();
    ai.reset();
    setMessages([]);
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="px-4 h-14 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-muted"><ArrowLeft className="w-5 h-5" /></Link>
          <Users className="w-5 h-5 text-primary" />
          <h1 className="font-semibold">Agent Console</h1>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {AGENTS.length} specialists
          </span>
          <button
            onClick={clearChat}
            className="ml-auto text-xs px-2.5 py-1.5 rounded-lg hover:bg-muted flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[320px_1fr] overflow-hidden">
        {/* Agent picker */}
        <aside className="border-r border-border/60 flex flex-col overflow-hidden bg-muted/20">
          <div className="p-3 space-y-2 border-b border-border/40">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                onClick={() => setCategory("all")}
                className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${
                  category === "all" ? "bg-primary text-primary-foreground" : "bg-background border border-border/60"
                }`}
              >
                All
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap ${
                    category === c.id ? "bg-primary text-primary-foreground" : "bg-background border border-border/60"
                  }`}
                >
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {visibleAgents.map((a) => (
              <button
                key={a.id}
                onClick={() => switchAgent(a)}
                className={`w-full text-left p-2.5 rounded-xl transition flex items-start gap-2.5 ${
                  a.id === selectedId
                    ? "bg-primary/10 border border-primary/40"
                    : "hover:bg-background border border-transparent"
                }`}
              >
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${a.color} flex items-center justify-center text-lg shrink-0`}>
                  {a.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{a.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{a.description}</div>
                </div>
              </button>
            ))}
            {visibleAgents.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-8">No agents match.</div>
            )}
          </div>
        </aside>

        {/* Chat pane */}
        <section className="flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border/40 flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-xl`}>
              {agent.icon}
            </div>
            <div className="min-w-0">
              <div className="font-semibold flex items-center gap-2">{agent.name}
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{agent.role}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">{agent.description}</div>
            </div>
          </div>

          <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="max-w-lg mx-auto text-center pt-8">
                <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-3xl mb-4`}>
                  {agent.icon}
                </div>
                <h3 className="text-lg font-semibold mb-1">Talk to {agent.name}</h3>
                <p className="text-sm text-muted-foreground mb-6">Try one of these:</p>
                <div className="space-y-2">
                  {agent.suggestedPrompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="w-full text-left text-sm px-4 py-3 rounded-xl bg-muted/60 hover:bg-muted border border-border/50 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 inline mr-2 text-primary" />
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {m.content || (ai.status === "streaming" ? "…" : "")}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Composer */}
          <div className="border-t border-border/40 p-3 bg-background/80 backdrop-blur">
            <div className="flex items-end gap-2 max-w-3xl mx-auto">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                }}
                rows={1}
                placeholder={`Ask ${agent.name}…`}
                className="flex-1 resize-none max-h-40 px-4 py-3 rounded-2xl bg-muted/60 border border-border/60 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {ai.status === "streaming" ? (
                <button
                  onClick={() => ai.cancel()}
                  className="h-11 w-11 rounded-2xl bg-destructive text-destructive-foreground flex items-center justify-center"
                >
                  <StopCircle className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={() => send()}
                  disabled={!input.trim()}
                  className="h-11 w-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
                >
                  <Send className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
