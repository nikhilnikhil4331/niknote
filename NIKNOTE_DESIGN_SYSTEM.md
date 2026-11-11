# NikNote Design System Audit

**Audit date:** 2026-11-04 (UTC)  
**Branch:** `arena/fa802f8f-niknote`  
**Primary sources:** `src/index.css`, `src/design-system/tokens.ts`, `src/utils/uiThemes.ts`, `src/pages/Index.tsx`, `src/main.tsx`, `index.html`, and shared desktop/mobile components.

## Executive summary

NikNote has a recognizable creative-notes identity: warm paper and dark ink, a blue-led action palette with coral accents and a small yellow highlight, handwriting styles, responsive desktop/mobile shells, and glass-like mobile navigation. A new selectable Compass & Paper preset and NikNote Compass Journal template now carry that identity into the editor and mobile appearance, pairing Fredoka display headings with Caveat handwriting and signature cream/blue/coral paper. The active CSS theme variables are more authoritative than the exported design-system token object. The token file is not consumed by other `src` files in the audited search, several themes are only partially wired, and individual pages/components still define local styles. Treat this as an emerging design system rather than a fully enforced system.

A token-level contrast calculation against pure white found a mix of compliant and non-compliant foreground candidates. It is **not** a full WCAG assessment: opacity, gradients, component states, dark mode, focus indicators, font size/weight, and real page backgrounds were not measured.

## Brand and semantic color roles

The current brand guide in the master progress document and token/CSS sources sets warm paper `#FFFDF5`, ink `#171313`, bright logo blue `#347FF0`, darker action blue `#2869D5`, coral `#FF858F` / accessible rose `#C83F58`, and yellow `#FFE45C`. `src/index.css` maps active values as HSL variables for light and `.dark` modes; `src/design-system/tokens.ts` has a parallel hex-token scheme.

| Token / intended role | Value | Contrast against white | Guidance |
|---|---:|---:|---|
| Ink / primary text | `#171313` | 18.44:1 | Strong normal text on white/paper. Recheck on colored surfaces. |
| Secondary text | `#68636C` | 5.85:1 | Passes the 4.5:1 normal-text benchmark against white. |
| Tertiary text | `#89838C` | 3.69:1 | Fails normal-size AA on white; reserve for large text/non-text or darken. |
| Action blue | `#2869D5` | 5.16:1 | Preferred blue for normal-size text/icons with adequate background contrast. |
| Bright brand blue | `#347FF0` | 3.86:1 | Logo/large text/accent color against white; not for normal-size text on white. |
| Accessible rose | `#C83F58` | 4.87:1 | Passes normal-text benchmark against white. Alpha overlays still need checks. |
| Bright coral | `#FF858F` | 2.33:1 | Decorative/large accent only on white; pair with dark text for filled surfaces. |
| Yellow | `#FFE45C` | 1.27:1 | Accent/surface only against white; do not use as text or a sole status indicator. |

The CSS root includes separate semantic blue, coral, yellow, paper, ink, border, primary/accent, sidebar, and semantic state variables. Dark mode redefines most of the same roles. Meaningful user-selected pen colors, category/event hues, and note-paper styles should remain user-controlled rather than being globally recolored.

## Typography and font delivery

- Body stack: Inter with system fallbacks; `index.html` loads Inter, Caveat, Kalam, Fredoka, and Plus Jakarta Sans from Google Fonts.
- Display styling uses Fredoka/Plus Jakarta Sans in selected product surfaces. The design-system token object also names JetBrains Mono and handwriting stacks.
- The editor supports 16 handwriting font names/classes. Secondary handwriting families are requested after first paint by `src/main.tsx` using `requestIdleCallback` or a 1.2-second timeout, so appearance and first use depend on an external Google Fonts request unless the browser already has the font cached.
- **Font-loading mismatch:** `Cedarville Cursive` is offered by `src/types/notes.ts` and declared by `.font-handwriting-15` in `src/index.css`, but it is absent from both the core font stylesheet in `index.html` and the secondary stylesheet URL in `src/main.tsx`. The declared family can silently fall back to a generic cursive face.
- Consider self-hosting or explicitly documenting font fallbacks for reliable offline/PWA rendering and privacy/network policy control.

## Spacing, shape, elevation, and motion

`src/design-system/tokens.ts` proposes a 4/8/12/16/24/32/48 px spacing ladder; 6/10/14/20 px and pill radii; a five-size shadow ladder plus glow/glass; a compact type scale from 11 px to 36 px; and Framer Motion spring/transition presets. The active CSS also uses a root radius of `.95rem`, utility classes, and locally authored component styles, so the documented ladders are not yet a universal constraint.

The application wraps the root in `MotionConfig reducedMotion="user"`; Playground and several CSS components also provide reduced-motion alternatives. This does not prove that every CSS keyframe, animation, or page respects `prefers-reduced-motion`; verify by automated scanning and browser testing.

## Theme-system integration finding

`src/utils/uiThemes.ts` now defines eleven appearance labels, including the Compass & Paper NikNote preset. `src/pages/Index.tsx` applies the hook's CSS variables and theme identifier on the editor root; the Compass & Paper selectors style the main workspace surfaces, and equivalent mobile styling is selectable through `MobileAppearance`. The NikNote Compass Journal template pairs the `niknote-paper` page stock with Caveat and blue ink. The other ten UI theme variants still primarily change the wrapper and are not complete app-wide design languages. DesktopShell also has its own separate NikNote identity stylesheet and is not controlled by the editor's UI theme picker.

## Component and layout patterns observed

- Separate desktop workspace and mobile experience paths, plus route-specific desktop/mobile wrappers.
- Reusable Radix/shadcn-style controls, toast/tooltip infrastructure, and shared navigation shells.
- Glass/blur surfaces, cards, rounded action controls, colored status and feature modules.
- Handwriting paper/ink/editor controls are intentionally distinct from generic application chrome.
- CSS variables are available for theme-aware semantic UI, but local arbitrary utility colors/styles remain a source of drift.

## Accessibility findings and limits

1. Use the darker action-blue/rose tokens for normal-size text; do not assume the brighter logo tones or tertiary gray pass contrast.
2. Yellow and pale coral need dark text or additional shape/icon/label cues. Never signal success/error/selection by color alone.
3. Calculate contrast for actual composited backgrounds, alpha surfaces, gradients, hover/focus/disabled states, and the full dark palette.
4. Audit focus-visible outlines, target sizing, keyboard order, accessible naming, zoom/reflow, and mobile safe-area behavior in a browser. No axe/WCAG browser scan was run here.
5. Keep paper/ink customization and feature/data-category colors distinct from brand/action semantics.

## Recommendations

- Establish a single documented semantic token contract and use it from Tailwind/CSS and React rather than maintaining disconnected hex and HSL palettes.
- Either wire all ten theme variants through a shared theme root and component contract (with visual regression tests) or reduce the picker to the actual supported theme modes.
- Add contrast unit tests for semantic token pairs and a browser accessibility scan for rendered states; report the scope as token-level until then.
- Add or remove the Cedarville font consistently, then test actual offline/fallback rendering.
- Record typography, spacing, motion, shadow, focus, elevation, and interaction guidelines in one source of truth; avoid recreating local brand colors on each page.
