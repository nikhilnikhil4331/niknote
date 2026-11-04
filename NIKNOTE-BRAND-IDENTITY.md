# NikNote visual identity

NikNote's primary identity is the supplied pink/coral-and-blue notebook mark: the coral circle, blue writing symbol, blue-and-yellow compass star, paper edge, and expressive black NikNote wordmark. The mark is not replaced by a generic AI symbol.

## Asset map

- `public/images/brand/niknote-primary-mark.png` — transparent mark for compact headers and animation.
- `public/images/brand/niknote-primary-wordmark.png` — transparent black wordmark for light surfaces.
- `public/images/brand/niknote-primary-wordmark-white.png` — white wordmark for dark surfaces.
- `public/images/brand/niknote-primary-lockup-dark.png` — complete mark and white wordmark for dark-surface magnification.
- `public/niknote-logo.png` — complete mark + black wordmark for light surfaces, metadata, and splash screens.
- `public/niknote-logo-square.png` and `public/icons/*` — mark-first square app icons; the small-size favicon intentionally omits the wordmark.
- `public/images/brand/niknote-write-it-down.png` — supplied writing/pencil illustration for the workspace home.
- `public/images/brand/niknote-task-list.png` — supplied checklist illustration for Tasks.
- `public/images/brand/niknote-calendar-wordmark-source.png` — supplied calendar illustration for Calendar.
- `public/images/brand/niknote-spark-note.png` — supplied star-over-note illustration for note creation and empty states.
- `public/images/brand/niknote-creative-notes.png` — original supplied primary-logo reference.

`bash scripts/generate-brand-icons.sh` regenerates browser/PWA/favicon and Android launcher/splash artwork from the primary icon and light-surface lockup.

## Color and surface tokens

- **Blue leads:** logo blue `#347FF0`; accessible UI/action blue `#2869D5`.
- **Coral supports:** logo coral `#FF858F`; accessible coral/rose UI accent `#C83F58`; pale coral `#FFA6AD`.
- **Yellow is a small accent:** compass yellow `#FFE45C` for sparks, streaks, and selected highlights—not a third equal-weight primary.
- **Paper and ink:** warm paper `#FFFDF5`, clean white surfaces `#FFFFFF`, ink `#171313`.
- Light/dark CSS custom properties are centralized in `src/index.css`; desktop and mobile each have scoped responsive tokens.

## Typography and motion

- `Fredoka` is for expressive brand/display headings; `Inter`/`Plus Jakarta Sans` remain the readable interface and body faces.
- Handwriting fonts are reserved for the writing canvas and handwriting previews.
- The loader reveals the mark first (spring pop), then writes on the wordmark. Note/paper artwork responds only to interaction, task completion gets a quick check pop, and earned achievements lift/pop without continuous ambient motion.
- `MotionConfig reducedMotion="user"` and the global reduced-motion stylesheet suppress nonessential movement; editor input and navigation remain direct and stable.

## Responsive and accessibility rules

The phone experience remains its own layout, with touch-sized controls, safe-area spacing, and the same identity tokens rather than a shrunken desktop shell. Use the dark wordmark on dark surfaces, preserve the full mark/wordmark aspect ratio, keep yellow details sparse, and retain keyboard focus visibility and readable body/editor typography.
