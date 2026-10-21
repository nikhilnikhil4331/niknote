# Third-party notices — NikNote

NikNote is a proprietary product. This file records every external source we
have **looked at** for capability ideas, what licence it carries, and what we
are therefore allowed to do with it.

**Rule: no code is copied from a copyleft project.** Where a project's
engineering idea informed NikNote, the implementation is independently written
and the project is credited below.

Last reviewed: 2026-10-21 (licences verified against each repository's
`LICENSE` via the GitHub API).

---

## 1. Inspiration-only references (no code copied)

| Project | Repository | Licence (verified) | What we took |
|---|---|---|---|
| WeKnora | `Tencent/WeKnora` | MIT, **except** third-party components listed in its `LICENSE` (read those before any copy) | Retrieval contract: chunk → rank → passages with page citations → answer grounded in material only. Re-implemented in TypeScript (`src/lib/knowledgeIndex.ts`) |
| OpenWhispr | `OpenWhispr/openwhispr` | MIT | Product framing for dictation UX (recording indicator, cancel, permission states). NikNote keeps its existing Web Speech implementation |
| OpenProject | `opf/openproject` | **GPL-3.0** | Task vocabulary only (subject, deadline, priority, dependency). No Ruby/GPL code used |
| Cal.com | `calcom/cal.com` | MIT for the core app; the `packages/features/ee` tree carries a separate enterprise licence | Scheduling semantics + ICS interoperability. No code used |
| OpenSEO | `every-app/open-seo` | MIT | Audit checklist shape (titles, canonicals, sitemap, robots). No code used; no paid search-data provider added |
| OpenHiggsfield | `wide-trace/open-higgsfield` | **No licence file — all rights reserved** | Architecture reference only (provider adapters, job history, retry). **Nothing copied; nothing deployed** |
| Chatwoot | `chatwoot/chatwoot` | MIT for core; `enterprise/` under a separate licence | Support-inbox workflow shape, for a future *separate* deployment. Nothing embedded |
| VoiceStudio | `debpalash/VoiceStudio` | **AGPL-3.0-only** (model weights/assets have separate terms) | Not used in the app. Network-use copyleft makes in-product reuse a legal project; read-aloud uses the browser's own speech engine instead |

## 2. Runtime dependencies already in use

NikNote's runtime dependencies are declared in `package.json` and installed by
npm. All are permissively licensed (MIT / ISC / Apache-2.0 / BSD) at the time of
writing; the authoritative list for a given build is produced by:

```bash
npx license-checker --production --json > docs/license-inventory.json
```

Highlights of the notable ones:

| Package | Licence | Use |
|---|---|---|
| `pdfjs-dist` | Apache-2.0 | PDF text extraction in the browser |
| `jspdf` | MIT | PDF export of handwritten sheets |
| `html2canvas` | MIT | Rasterising offscreen A4 sheets |
| `fabric` | MIT | Drawing board canvas |
| `framer-motion` | MIT | Page animations |
| `@supabase/supabase-js` | MIT | Auth / cloud sync |
| `lucide-react` | ISC | Icons |

## 3. Fonts and assets

Handwriting typefaces are loaded from Google Fonts (OFL-1.1) through the
existing font system. OFL permits web embedding; the licence requires that the
fonts are not sold on their own and that reserved font names are not reused for
modified versions. No font binaries are bundled into the repository.

## 4. Models and external services

NikNote calls an AI provider only when a key/serverless route is configured,
and always falls back to the on-device "NikAI Device" path. No open-source model
weights are bundled or redistributed. Speech recognition and synthesis use the
browser/OS engine, so audio does not leave the device unless the user's browser
sends it to its own provider (documented in the privacy copy).

## 5. Obligations we accept

- Keep this file and the machine-readable inventory up to date when adding a
  dependency.
- Do not vendor GPL/AGPL code into this repository.
- Do not remove upstream copyright notices from any permissively licensed code
  we do adapt.
- Treat "available on GitHub" as *viewable*, not *reusable*: `open-higgsfield`
  has no licence, which means no permission beyond viewing.
