// ============================================================
// Handbook — NikNote's 10 Volumes rendered as in-app docs
// ============================================================
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Search, BookOpen } from "lucide-react";
import { HANDBOOK } from "@/content/handbook";

export default function Handbook() {
  const [activeVol, setActiveVol] = useState(HANDBOOK[0].id);
  const [query, setQuery] = useState("");

  const volume = useMemo(
    () => HANDBOOK.find((v) => v.id === activeVol) ?? HANDBOOK[0],
    [activeVol],
  );

  const filteredSections = useMemo(() => {
    if (!query.trim()) return volume.sections;
    const q = query.toLowerCase();
    return volume.sections.filter(
      (s) => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q),
    );
  }, [volume, query]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/" className="p-2 -ml-2 rounded-lg hover:bg-muted transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <BookOpen className="w-5 h-5 text-accent-rose" />
          <h1 className="font-semibold">NikNote Handbook</h1>
          <div className="ml-auto relative w-full max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this volume…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted/60 text-sm border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 px-4 py-6">
        {/* Sidebar */}
        <aside className="md:sticky md:top-20 md:self-start space-y-1">
          {HANDBOOK.map((v) => (
            <button
              key={v.id}
              onClick={() => { setActiveVol(v.id); setQuery(""); }}
              className={`w-full text-left px-3 py-2.5 rounded-xl transition flex items-start gap-3 ${
                v.id === activeVol
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "hover:bg-muted"
              }`}
            >
              <span className="text-xl leading-none">{v.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[10px] uppercase tracking-wider opacity-70">
                  Volume {v.number}
                </span>
                <span className="block text-sm font-medium truncate">{v.title}</span>
              </span>
            </button>
          ))}
        </aside>

        {/* Content */}
        <main>
          <motion.header
            key={volume.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Volume {volume.number}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
              <span>{volume.icon}</span> {volume.title}
            </h2>
            <p className="text-muted-foreground mt-2">{volume.subtitle}</p>
          </motion.header>

          <div className="space-y-6">
            {filteredSections.map((s, i) => (
              <motion.section
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="rounded-2xl border border-border/60 bg-card p-5 md:p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <div className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
                  {s.body}
                </div>
              </motion.section>
            ))}
            {filteredSections.length === 0 && (
              <div className="text-center text-muted-foreground py-16">
                No sections match "{query}".
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
