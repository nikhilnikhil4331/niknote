// ============================================================
// NikNote Desktop — Templates gallery (mockup style)
// Clicking a template opens the real editor pre-filled with
// its structure. Desktop only.
// ============================================================

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUpRight, LayoutTemplate } from 'lucide-react';
import { DesktopShell } from '@/components/desktop/DesktopShell';
import { useDesktopNotes } from '@/components/desktop/notes';
import { noteTemplates, type NoteTemplate } from '@/lib/noteTemplates';
import type { PageStyle } from '@/types/notes';
import { cn } from '@/lib/utils';

type Cat = 'All' | 'Study' | 'Personal' | 'Work' | 'Planning' | 'Lifestyle';
const CATS: Cat[] = ['All', 'Study', 'Personal', 'Work', 'Planning', 'Lifestyle'];

interface Tpl {
  title: string;
  cat: Exclude<Cat, 'All'>;
  desc: string;
  text: string;
  style: PageStyle;
  accent: string;
  route?: string; // app templates open a real feature page instead of the editor
}

const ACCENTS = ['#7C5F9E', '#5C3A6E', '#C4762F', '#A34054', '#157F52', '#7C5F9E', '#A34054', '#7C5F9E'];

const fromLib = (t: NoteTemplate, cat: Tpl['cat'], title = t.title): Tpl => ({
  title, cat, desc: t.desc, text: t.text, style: t.style, accent: ACCENTS[Math.abs(title.length * 3) % ACCENTS.length],
});

const lib = Object.fromEntries(noteTemplates.map((t) => [t.title, t]));

const TEMPLATES: Tpl[] = [
  fromLib(lib['Lecture Notes'], 'Study', 'Class Notes'),
  fromLib(lib['Cornell Notes'], 'Study'),
  fromLib(lib['To Do List'], 'Planning', 'To-Do List'),
  { title: 'Habit Tracker', cat: 'Lifestyle', desc: 'Build good habits', text: '', style: 'ruled', accent: '#157F52', route: '/habit' },
  fromLib(lib['Project Plan'], 'Work', 'Project Planner'),
  fromLib(lib['Daily Journal'], 'Personal'),
  { title: 'Study Planner', cat: 'Study', desc: 'Organize study', style: 'ruled', accent: '#5C3A6E', text: '# Study Planner\n## This week\n[] Mon — Biology: Photosynthesis\n[] Tue — Maths: Algebra\n[] Wed — Chemistry: Bonds\n## Goals\n• Finish 2 chapters\n• 50 practice questions\n## Notes\n' },
  { title: 'Vision Board', cat: 'Personal', desc: 'Your dreams', style: 'dotted', accent: '#A34054', text: '# Vision Board\n## This year I will\n• \n• \n• \n## Places I want to see\n• \n## Skills to learn\n• \n## My mantra\n"A small step everyday leads to big results."' },
  { title: 'Travel Planner', cat: 'Lifestyle', desc: 'Plan your trips', style: 'ruled', accent: '#7C5F9E', text: '# Travel Planner\n## Destination\n\n## Dates & budget\n\n## Places to visit\n• \n• \n## Packing list\n[] Documents\n[] Clothes\n[] Camera\n## Bookings\n[] Stay\n[] Transport' },
  { title: 'Meeting Notes', cat: 'Work', desc: 'For professionals', style: 'ruled', accent: '#C4762F', text: '# Meeting Notes\n## Date & attendees\n\n## Agenda\n• \n• \n## Discussion points\n\n## Decisions\n• \n## Action items\n[] ' },
  { title: 'Recipe Book', cat: 'Lifestyle', desc: 'Save recipes', style: 'plain', accent: '#A34054', text: '# Recipe\n## Time & serves\nPrep: __ min · Cook: __ min · Serves: __\n## Ingredients\n• \n• \n## Steps\n1. \n2. \n3. \n## Tips\n' },
  { title: 'Reading List', cat: 'Personal', desc: 'Track your books', style: 'ruled', accent: '#7C5F9E', text: '# Reading List\n## Currently reading\n• \n## Want to read\n[] \n[] \n[] \n## Finished\n• \n## Favourite lines\n""' },
  fromLib(lib['Exam Prep'], 'Study'),
  fromLib(lib['Revision Sheet'], 'Study'),
  fromLib(lib['Daily Planner'], 'Planning'),
  fromLib(lib['Idea Board'], 'Personal'),
  { title: 'Money Tracker', cat: 'Lifestyle', desc: 'Track every rupee', text: '', style: 'ruled', accent: '#157F52', route: '/money' },
  { title: 'Weekly Review', cat: 'Planning', desc: 'Reflect & reset', style: 'ruled', accent: '#7C5F9E', text: '# Weekly Review\n## Wins this week\n• \n## What I learned\n• \n## Next week focus\n[] \n[] \n## Gratitude\n• ' },
  fromLib(lib['Blank Note'], 'Personal'),
];

const DesktopTemplates: React.FC = () => {
  const navigate = useNavigate();
  const { active, trashed, openNew } = useDesktopNotes();
  const [cat, setCat] = useState<Cat>('All');
  const [query, setQuery] = useState('');

  const folders = useMemo(
    () => Array.from(new Set(active.map((n) => n.folder).filter(Boolean) as string[])),
    [active],
  );

  const list = TEMPLATES.filter(
    (t) =>
      (cat === 'All' || t.cat === cat) &&
      (t.title.toLowerCase().includes(query.toLowerCase()) || t.desc.toLowerCase().includes(query.toLowerCase())),
  );

  const useTpl = (t: Tpl) => {
    if (t.route) navigate(t.route);
    else openNew({ title: t.title, text: t.text, style: t.style });
  };

  return (
    <DesktopShell counts={{ notes: active.length, trash: trashed.length }} folders={folders}>
      <div className="mx-auto w-full max-w-[1160px] px-8 py-7">
        <div className="flex items-center gap-3 nd-anim">
          <div>
            <h1 className="text-[24px] font-extrabold tracking-[-0.02em]" style={{ color: 'var(--nd-text)' }}>Templates</h1>
            <p className="text-[12.5px]" style={{ color: 'var(--nd-text-3)' }}>
              Start from a ready-made structure — opens straight in the editor.
            </p>
          </div>
          <div className="ml-auto relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--nd-text-3)' }} />
            <input
              className="nd-input !pl-8 !w-[230px]"
              placeholder="Search templates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5 nd-anim nd-anim-1">
          {CATS.map((c) => (
            <button key={c} className={cn('nd-chip-btn', cat === c && 'nd-on')} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-4 mt-5 pb-10 nd-anim nd-anim-2">
          {list.map((t) => (
            <button key={t.title} className="nd-note-card !rounded-2xl" onClick={() => useTpl(t)}>
              <div className="p-3 pb-0">
                <div className="nd-tpl-paper" style={{ height: 118 }}>
                  <div className="nd-skel nd-acc" style={{ width: '55%', background: `${t.accent}55` }} />
                  <div className="nd-skel" style={{ width: '88%' }} />
                  <div className="nd-skel" style={{ width: '72%' }} />
                  <div className="nd-skel" style={{ width: '80%' }} />
                  <div className="nd-skel nd-acc" style={{ width: '40%', background: `${t.accent}40` }} />
                  <div className="nd-skel" style={{ width: '64%' }} />
                </div>
              </div>
              <div className="px-3.5 py-3 flex items-start gap-2">
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-bold truncate" style={{ color: 'var(--nd-text)' }}>{t.title}</span>
                  <span className="block text-[11.5px] truncate" style={{ color: 'var(--nd-text-3)' }}>{t.desc}</span>
                </span>
                {t.route ? (
                  <span className="nd-chip" style={{ background: 'hsl(var(--success) / 0.16)', color: 'hsl(var(--success))' }}>
                    App <ArrowUpRight size={10} />
                  </span>
                ) : (
                  <span className="nd-chip" style={{ background: 'hsl(var(--primary) / 0.14)', color: 'hsl(var(--accent-cool-hsl))' }}>{t.cat}</span>
                )}
              </div>
            </button>
          ))}
          {list.length === 0 && (
            <div className="col-span-4 nd-card p-10 text-center">
              <LayoutTemplate size={26} className="mx-auto" style={{ color: 'var(--nd-text-3)' }} />
              <p className="mt-2 text-[13.5px] font-semibold" style={{ color: 'var(--nd-text)' }}>No templates found</p>
              <p className="text-[12.5px]" style={{ color: 'var(--nd-text-3)' }}>Try another search or category.</p>
            </div>
          )}
        </div>
      </div>
    </DesktopShell>
  );
};

export default DesktopTemplates;
