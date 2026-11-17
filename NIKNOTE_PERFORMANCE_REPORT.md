# NikNote Performance Report

**Audit date:** 2026-11-04 (UTC)  
**Branch:** `arena/fa802f8f-niknote`  
**Measurement type:** Local production build and source-level review. No browser, Lighthouse, field RUM, device lab, or production timing measurement was available.

## Executive summary

The production build succeeds and prerenders **35 route HTML files** after transforming **4,868 modules**. Vite still warns about oversized JavaScript chunks and mixed static/dynamic imports. The largest emitted application chunk is **970.57 kB raw / 292.12 kB gzip**. PDF/OCR assets are intentionally heavy: the PDF worker is **1,375.84 kB raw**, PDF OCR is **629.32 kB / 346.10 kB gzip**, and the PDF vendor chunk is **620.94 kB / 186.06 kB gzip**. Build completion was about **52.70 seconds** during the final parallel verification run (machine contention makes build-time comparison unreliable).

No LCP, INP, CLS, TTFB, interaction latency, memory, or real-device load result was captured. Chunk sizes describe build artifacts, not user-perceived page performance.

## Current build measurements

| Artifact / build signal | Measurement | Notes |
|---|---:|---|
| Modules transformed | 4,868 | Vite production build. |
| Prerendered route HTML | 35 files | Prerender list is not identical to the 62 client route declarations. |
| Largest app JS chunk | 970.57 kB raw / 292.12 kB gzip | Largest measured app chunk; route loading behavior not measured in a browser. |
| PDF OCR chunk | 629.32 kB / 346.10 kB gzip | Heavy OCR/PDF capability. |
| PDF vendor chunk | 620.94 kB / 186.06 kB gzip | Exceeds Vite's 600 kB raw chunk warning threshold. |
| PDF button chunk | 522.36 kB / 208.56 kB gzip | PDF UI/tool path. |
| Another app chunk | 549.62 kB / 235.34 kB gzip | Separate emitted application chunk. |
| PDF worker | 1,375.84 kB raw | Large worker payload; no gzip transfer measurement recorded here. |
| Build time | 52.70 s in final parallel run | Do not use as a stable performance KPI; machine contention affects build-time readings. |
| Build result | PASS | 35 route HTML files emitted. |

## Findings

1. **Heavy PDF/OCR payloads.** PDF.js, pdf-lib, and Tesseract-related features produce the largest assets. Keep these modules behind route/feature boundaries, verify that the worker is loaded only when needed, and measure cold-cache transfer and worker startup on low-end Android devices.
2. **Mixed import warnings weaken code splitting.** The build warns that `src/lib/pdfSecurity.ts`, the Supabase client, Capacitor core, and `src/lib/aiEngine.ts` are imported both statically and dynamically. A dynamic import does not guarantee a separate chunk when another route already imports the same module statically.
3. **Large shared application chunk.** The largest application chunk is close to 1 MB raw. Validate route-level entry transfer; split non-critical workspace/admin/AI features and avoid pulling them into the initial shell through shared imports.
4. **External fonts affect rendering and availability.** Core Inter/Caveat/Kalam/Fredoka/Plus Jakarta Sans load from Google Fonts in `index.html`; secondary handwriting families load after paint/idle from `src/main.tsx`. This defers some secondary requests but can create font swap/fallback behavior and depends on network access. Cedarville is declared but is not included in either font request.
5. **Browserslist data is stale.** The build warns that `caniuse-lite` is about 17 months old. Refresh the locked browser data in a dependency-maintenance change and compare generated CSS/JS size and supported targets.
6. **The app has no observed field-performance budget.** There is no sampled RUM or documented bundle/LCP/interaction budget in the files reviewed. Do not describe build success as proof of fast performance.

## Recommended performance plan

### Immediate

- Inspect Vite's visualizer output and import graph for the largest app/PDF chunks; confirm initial route downloads with a browser network trace.
- Separate PDF editor, PDF tools, OCR, admin, and AI provider modules so opening the core notes workspace does not fetch them unnecessarily.
- Resolve mixed static/dynamic imports where practical; keep a shared module statically imported only when it is truly part of the common initial path.
- Verify PDF worker initialization is on demand, uses a stable version, avoids duplicate copies, and reports progress/cancellation for large files.
- Refresh Browserslist data and pin reproducible build outputs.

### Measurement targets to adopt (proposed, not current results)

- Initial route JS transfer: target **≤ 250 KiB gzip** for the basic workspace shell; heavy feature routes should be separately loaded and have explicit budgets.
- Largest non-worker route chunk: target **≤ 300 KiB gzip** or document an exception with measured demand and device impact.
- Core Web Vitals at the 75th percentile: **LCP ≤ 2.5 s**, **INP ≤ 200 ms**, and **CLS ≤ 0.1** on agreed device/network cohorts.
- Track PDF startup and completion separately: first page render, OCR initialization, peak memory, export duration, and cancellation success on a low-end Android device.

### Required validation

Run Lighthouse/Web Vitals and a scripted browser trace on at least a desktop broadband profile and a representative low-end Android/mobile profile, with both cold and warm caches. Record route, device/browser, network throttle, build commit, request bytes, long tasks, memory where available, font behavior, and whether PDF/OCR code loaded. Compare against the proposed budgets before claiming improvement.
