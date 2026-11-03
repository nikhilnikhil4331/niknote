// NikNote illustration library — one stroke language: ink outlines (5/96),
// brand fills (coral/blue/yellow/cream), slightly imperfect geometry.
// Usage: <Illustration.Notebook className="h-24 w-24" />
type P = { className?: string };

const S = ({ children, className = '', vb = '0 0 96 96' }: P & { children: React.ReactNode; vb?: string }) => (
  <svg viewBox={vb} className={className} fill="none" aria-hidden="true" stroke="#171313" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
    {children}
  </svg>
);

export const BrandStar = ({ className }: P) => (
  <S className={className}>
    <path d="M48 6 Q52 40 90 48 Q52 56 48 90 Q44 56 6 48 Q44 40 48 6 Z" fill="#FFE45C" />
  </S>
);

export const Notebook = ({ className }: P) => (
  <S className={className}>
    <rect x="20" y="14" width="58" height="70" rx="6" fill="#FFFDF5" />
    <path d="M20 26 h-8 M20 42 h-8 M20 58 h-8 M20 74 h-8" />
    <path d="M34 34 h30 M34 48 h30 M34 62 h20" stroke="#347FF0" />
    <path d="M78 14 Q82 30 92 34 Q82 38 78 54 Q74 38 64 34 Q74 30 78 14 Z" fill="#FFE45C" strokeWidth="4" />
  </S>
);

export const Calendar = ({ className }: P) => (
  <S className={className}>
    <rect x="14" y="20" width="68" height="62" rx="6" fill="#FFFDF5" />
    <path d="M14 36 h68" />
    <path d="M32 12 v14 M64 12 v14" />
    <circle cx="34" cy="52" r="5" fill="#FF858F" strokeWidth="4" />
    <circle cx="52" cy="52" r="5" fill="#347FF0" strokeWidth="4" />
    <circle cx="70" cy="68" r="5" fill="#FFE45C" strokeWidth="4" />
  </S>
);

export const Pencil = ({ className }: P) => (
  <S className={className}>
    <path d="M28 68 L58 20 L74 30 L44 78 L26 82 Z" fill="#FFE45C" />
    <path d="M58 20 L64 10 L80 20 L74 30 Z" fill="#FF858F" />
    <path d="M28 68 L26 82 L40 76 Z" fill="#171313" strokeWidth="4" />
    <path d="M12 88 q10 -6 20 0" stroke="#347FF0" />
  </S>
);

export const WritingSheet = ({ className }: P) => (
  <S className={className}>
    <path d="M22 12 h44 l10 12 v60 h-54 Z" fill="#FFFDF5" />
    <path d="M66 12 v12 h10" />
    <path d="M32 40 q6 -10 12 0 q6 10 12 0" stroke="#347FF0" />
    <circle cx="34" cy="58" r="4" fill="#171313" strokeWidth="0" />
    <path d="M44 58 h18" strokeWidth="4" />
  </S>
);

export const Checklist = ({ className }: P) => (
  <S className={className}>
    <rect x="18" y="12" width="60" height="72" rx="6" fill="#FFFDF5" />
    <rect x="28" y="26" width="12" height="12" fill="#347FF0" strokeWidth="4" />
    <path d="M48 32 h22" />
    <rect x="28" y="46" width="12" height="12" fill="#FFFDF5" strokeWidth="4" />
    <path d="M48 52 h22" />
    <rect x="28" y="66" width="12" height="12" fill="#FFE45C" strokeWidth="4" />
    <path d="M48 72 h14" />
  </S>
);

export const SpeechBubble = ({ className }: P) => (
  <S className={className}>
    <path d="M14 18 h68 v44 h-38 l-14 14 v-14 h-16 Z" fill="#FFE45C" />
    <path d="M28 34 h40 M28 46 h28" strokeWidth="4" />
  </S>
);

export const AchievementStar = ({ className }: P) => (
  <S className={className}>
    <circle cx="48" cy="42" r="26" fill="#FF858F" />
    <path d="M48 28 Q50 40 62 42 Q50 44 48 56 Q46 44 34 42 Q46 40 48 28 Z" fill="#FFE45C" strokeWidth="4" />
    <path d="M36 66 l-6 20 l12 -6 l6 8 M60 66 l6 20 l-12 -6 l-6 8" fill="#347FF0" strokeWidth="4" />
  </S>
);

export const Lightbulb = ({ className }: P) => (
  <S className={className}>
    <path d="M48 12 a24 24 0 0 1 14 43 v9 h-28 v-9 a24 24 0 0 1 14 -43 Z" fill="#FFE45C" />
    <path d="M40 72 h16 M42 80 h12" />
    <path d="M48 34 q-8 8 0 16 q8 8 0 14" stroke="#347FF0" strokeWidth="4" />
  </S>
);

export const Money = ({ className }: P) => (
  <S className={className}>
    <rect x="14" y="34" width="68" height="40" rx="6" fill="#347FF0" />
    <circle cx="48" cy="54" r="10" fill="#FFE45C" strokeWidth="4" />
    <path d="M26 34 v-8 h44 v8" fill="#FFFDF5" />
    <circle cx="70" cy="20" r="8" fill="#FF858F" strokeWidth="4" />
  </S>
);

export const Habit = ({ className }: P) => (
  <S className={className}>
    <path d="M30 52 h36 l-5 32 h-26 Z" fill="#FF858F" />
    <path d="M48 52 V30" />
    <path d="M48 34 q-16 -2 -18 -18 q16 2 18 18 Z" fill="#347FF0" strokeWidth="4" />
    <path d="M48 28 q16 -2 18 -18 q-16 2 -18 18 Z" fill="#FFE45C" strokeWidth="4" />
  </S>
);

export const EmptyNotes = ({ className }: P) => (
  <S className={className}>
    <path d="M24 20 h40 l10 12 v48 h-50 Z" fill="#FFFDF5" />
    <path d="M64 20 v12 h10" />
    <path d="M36 48 h24 M36 60 h16" stroke="#88847F" strokeWidth="4" />
    <path d="M74 66 Q76 78 88 80 Q76 82 74 94 Q72 82 60 80 Q72 78 74 66 Z" fill="#FFE45C" strokeWidth="4" />
  </S>
);

export const EmptySearch = ({ className }: P) => (
  <S className={className}>
    <circle cx="42" cy="42" r="24" fill="#FFFDF5" />
    <path d="M60 60 L80 80" strokeWidth="7" />
    <path d="M34 42 q4 -8 8 0 q4 8 8 0" stroke="#347FF0" strokeWidth="4" />
    <path d="M78 18 Q80 28 90 30 Q80 32 78 42 Q76 32 66 30 Q76 28 78 18 Z" fill="#FFE45C" strokeWidth="4" />
  </S>
);

export const EmptyDashboard = ({ className }: P) => (
  <S className={className}>
    <rect x="12" y="18" width="72" height="56" rx="6" fill="#FFFDF5" />
    <path d="M12 32 h72" />
    <circle cx="22" cy="25" r="3" fill="#FF858F" strokeWidth="0" />
    <circle cx="32" cy="25" r="3" fill="#FFE45C" strokeWidth="0" />
    <path d="M26 62 v-12 M42 62 v-20 M58 62 v-8 M74 62 v-16" stroke="#347FF0" strokeWidth="6" />
  </S>
);

export const AiAssistant = ({ className }: P) => (
  <S className={className}>
    <rect x="20" y="24" width="56" height="44" rx="10" fill="#347FF0" />
    <circle cx="38" cy="44" r="5" fill="#FFFDF5" strokeWidth="0" />
    <circle cx="58" cy="44" r="5" fill="#FFFDF5" strokeWidth="0" />
    <path d="M38 56 q10 8 20 0" stroke="#FFFDF5" strokeWidth="4" />
    <path d="M48 24 V12" />
    <path d="M48 12 Q50 4 58 2 Q50 0 48 -8 Q46 0 38 2 Q46 4 48 12 Z" fill="#FFE45C" strokeWidth="4" transform="translate(0,10)" />
  </S>
);

export const DoodleSquiggle = ({ className }: P) => (
  <S className={className} vb="0 0 96 32">
    <path d="M4 16 q8 -12 16 0 q8 12 16 0 q8 -12 16 0 q8 12 16 0 q8 -12 16 0" stroke="#347FF0" />
  </S>
);

export const DoodleCircle = ({ className }: P) => (
  <S className={className} vb="0 0 32 32">
    <circle cx="16" cy="16" r="11" fill="#FF858F" strokeWidth="4" />
  </S>
);

export const Illustration = {
  BrandStar, Notebook, Calendar, Pencil, WritingSheet, Checklist, SpeechBubble,
  AchievementStar, Lightbulb, Money, Habit, EmptyNotes, EmptySearch, EmptyDashboard,
  AiAssistant, DoodleSquiggle, DoodleCircle,
};
