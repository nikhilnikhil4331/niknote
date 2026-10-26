# NikNote — SEO Keyword & Content Strategy (Phase 8)

> **Data Honesty Note:** External keyword volume APIs (Ahrefs, Semrush, Google Keyword Planner) and Google Search Console performance data are not connected in this environment. No monthly search volumes or keyword difficulty scores are fabricated below; prioritization is based on **product-feature fit**, **commercial/study intent**, and **funnel stage**. Once GSC is verified (`GOOGLE-SEARCH-CONSOLE-GUIDE.md`), replace qualitative priority tiers with measured impressions, clicks, and average position from Search Console.

Canonical domain: `https://www.niknote.online`

---

## 1. Keyword Clusters

### Cluster A — Core Handwriting Product Keywords (High Transactional Intent)
- `handwriting notes maker online`
- `text to handwriting converter online`
- `realistic handwritten notes generator`
- `online notebook handwriting tool`
- `convert typed text to handwriting pdf`
- `custom handwriting style generator`

### Cluster B — Student & Academic Study Keywords (High Adoption Intent)
- `ai study assistant hindi english`
- `ai doubt solver physics chemistry maths`
- `cbse handwritten notes maker`
- `jee neet revision flashcards online`
- `ncert chapter summary and quiz generator`
- `student habit tracker and pomodoro timer`

### Cluster C — Creator, Assignment & Aesthetic Note Keywords (Mid/High Intent)
- `aesthetic study notes online`
- `neat cursive handwritten notes generator`
- `ruled graph dotted paper notes online`
- `handwriting dna clone my handwriting`

### Cluster D — Document, OCR & PDF Utility Keywords (High Tool Intent)
- `online pdf editor free in browser`
- `merge split compress pdf online`
- `handwritten notes ocr to text`
- `hindi handwriting ocr online`
- `export a4 300 dpi handwritten pdf`

### Cluster E — Regional / Hinglish & Institutional Keywords (Local Differentiator)
- `ai teacher in hindi for students`
- `handwriting notes banane wala app`
- `coaching institute study software india`
- `ai platform for schools india`

---

## 2. Page-to-Keyword Mapping (Anti-Cannibalization Architecture)

Each indexable URL owns a distinct primary keyword cluster and search intent so pages reinforce rather than compete with one another:

| Canonical URL | Page Type | Primary Target Keyword | Secondary / Supporting Terms | Search Intent | Primary CTA |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | Core Workspace | `handwriting notes maker online` | `text to handwriting converter`, `300 dpi handwritten pdf`, `custom handwriting dna` | Transactional (Use Tool) | Start typing / Export PDF |
| `/welcome` | Product Overview & FAQ | `ai handwriting & study app for students` | `how niknote works`, `handwritten notes faq`, `hindi english study app` | Commercial / Informational | Start Free (`/`) |
| `/landing` | Feature Showcase | `realistic handwriting & ai study platform` | `handwriting studio`, `pdf studio`, `asta ai workspace` | Commercial Investigation | Launch Workspace (`/`) |
| `/ai` | Feature Tool | `ai study assistant hindi english` | `nikai tutor`, `ai quiz generator`, `study notes generator` | Transactional (Use AI) | Ask NikAI |
| `/ai-solver` | Feature Tool | `ai doubt solver for students` | `step by step maths physics chemistry solver`, `homework doubt solver` | Transactional (Solve Problem) | Solve a Doubt |
| `/pdf-editor` | Feature Tool | `online pdf editor free` | `annotate pdf in browser`, `edit pdf text online`, `sign pdf` | Transactional (Edit PDF) | Open PDF File |
| `/pdf-tools` | Feature Tool | `free online pdf tools merge split compress` | `pdf to jpg`, `ocr pdf online`, `watermark pdf` | Transactional (Convert PDF) | Choose PDF Tool |
| `/scan-notes` | Feature Tool | `handwritten notes ocr scanner` | `photo to editable notes`, `english hindi ocr online` | Transactional (Scan Image) | Upload / Scan Note Photo |
| `/documents` | Feature Tool | `ai pdf summarizer for students` | `turn pdf into flashcards`, `document study notes` | Transactional | Upload Study PDF |
| `/flashcards` | Feature Tool | `online study flashcards` | `active recall cards`, `exam revision flashcards` | Transactional | Practice Flashcards |
| `/habit` | Feature Tool | `student habit tracker & pomodoro timer` | `daily study streak tracker`, `exam focus timer` | Transactional | Start Study Timer |
| `/upgrade` | Pricing | `niknote pricing & student pro plans` | `student pro 49 per week`, `niknote premium 99 per month` | Transactional (Purchase) | Continue to Checkout |
| `/schools` | B2B Landing | `ai study platform for schools & coaching` | `institutional edtech india`, `coaching center test & notes software` | Commercial / Lead Gen | Submit School Inquiry |
| `/handbook` | Documentation | `niknote user guide & feature handbook` | `how to use handwriting dna`, `niknote shortcuts` | Informational | Open Workspace |
| `/blog` | Content Hub | `handwritten notes tutorials & exam study guides` | `cbse jee neet upsc study tips`, `handwriting conversion guides` | Informational | Read Guide / Try Tool |

---

## 3. Blog-to-Product Internal Linking Matrix

Every `/blog/:slug` article links directly to 3 contextually matched NikNote product tools (`src/pages/Blog.tsx`):

- `/blog/how-to-convert-text-to-handwriting` → `/`, `/pdf-tools`, `/upgrade`
- `/blog/online-handwriting-to-text-converter-india` → `/scan-notes`, `/`, `/pdf-tools`
- `/blog/ai-flashcard-generator-free-hindi` & `/blog/ai-flashcards-study-app-hindi` → `/flashcards`, `/ai`, `/`
- `/blog/school-management-software-india` → `/schools`, `/`, `/pdf-tools`
- `/blog/cbse-notes-generator-free`, `/blog/jee-neet-preparation-ai-tool`, `/blog/upsc-preparation-ai-notes` → `/`, `/ai`, `/pdf-tools`
