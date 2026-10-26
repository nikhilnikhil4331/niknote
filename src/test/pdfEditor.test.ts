import { describe, it, expect } from 'vitest';
import {
  MAX_BACKING_EDGE,
  MAX_BACKING_PIXELS,
  classifyHorizontalSwipe,
  classifyLoadError,
  clampPageIndex,
  clampZoom,
  displayDims,
  displayZoomPercent,
  isSwipeDown,
  loadErrorMessage,
  nextPageIndex,
  pageAfterDelete,
  pageLabel,
  parsePageInput,
  pinchZoom,
  planPageRender,
  prevPageIndex,
  renderWindow,
  thumbnailBackingWidth,
  zoomForActualSize,
  zoomForFitPage,
} from '@/lib/pdfEditor';

// A4 portrait in points
const A4 = { pageW: 595.28, pageH: 841.89 };

describe('planPageRender — sharp rendering (B1/B2 regression guards)', () => {
  it('sizes the backing store independently of CSS, scaled by devicePixelRatio', () => {
    const dpr1 = planPageRender({ ...A4, containerW: 800, zoom: 1, devicePixelRatio: 1 });
    expect(dpr1.cssW).toBe(800);
    expect(dpr1.backingW).toBe(800);
    expect(dpr1.outputScale).toBeCloseTo(1);

    const dpr2 = planPageRender({ ...A4, containerW: 800, zoom: 1, devicePixelRatio: 2 });
    expect(dpr2.cssW).toBe(800);
    expect(dpr2.backingW).toBe(1600);
    expect(dpr2.outputScale).toBeCloseTo(2);

    const dpr3 = planPageRender({ ...A4, containerW: 390, zoom: 1, devicePixelRatio: 3 });
    expect(dpr3.cssW).toBe(390);
    expect(dpr3.backingW).toBe(1170);
  });

  it('hands pdf.js a viewport scale that matches the backing store exactly', () => {
    const plan = planPageRender({ ...A4, containerW: 700, zoom: 1.5, devicePixelRatio: 2 });
    expect(plan.viewportScale).toBeCloseTo(plan.backingW / A4.pageW, 5);
    expect(plan.backingH / plan.backingW).toBeCloseTo(A4.pageH / A4.pageW, 2);
  });

  it('re-renders bigger when zooming instead of stretching the fit-width raster', () => {
    const fit = planPageRender({ ...A4, containerW: 800, zoom: 1, devicePixelRatio: 2 });
    const zoomed = planPageRender({ ...A4, containerW: 800, zoom: 3, devicePixelRatio: 2 });
    expect(zoomed.cssW).toBe(2400);
    // The raster must grow substantially vs fit-width (no indefinite stretching)…
    expect(zoomed.backingW).toBeGreaterThan(fit.backingW * 1.3);
    // …and the 12 MP budget may only soften extreme zooms slightly, never grossly.
    expect(zoomed.outputScale).toBeGreaterThanOrEqual(0.9);
    expect(zoomed.capped).toBe(true);
  });

  it('caps runaway backing stores for memory while preserving aspect ratio', () => {
    const plan = planPageRender({ pageW: 2000, pageH: 2000, containerW: 1024, zoom: 4, devicePixelRatio: 3 });
    expect(plan.capped).toBe(true);
    expect(plan.backingW).toBeLessThanOrEqual(MAX_BACKING_EDGE);
    expect(plan.backingW * plan.backingH).toBeLessThanOrEqual(MAX_BACKING_PIXELS + 4096);
    expect(plan.backingH).toBe(plan.backingW); // square stays square
  });

  it('never lays a page out wider than the stage cap at fit width', () => {
    const plan = planPageRender({ ...A4, containerW: 2560, zoom: 1, devicePixelRatio: 1 });
    expect(plan.cssW).toBe(1024);
  });

  it('keeps landscape pages landscape', () => {
    const plan = planPageRender({ pageW: 792, pageH: 612, containerW: 800, zoom: 1, devicePixelRatio: 2 });
    expect(plan.cssW).toBe(800);
    expect(plan.cssH).toBeLessThan(plan.cssW);
  });

  it('survives degenerate inputs', () => {
    const plan = planPageRender({ pageW: 0, pageH: 0, containerW: 0, zoom: NaN, devicePixelRatio: 0 });
    expect(plan.cssW).toBeGreaterThan(0);
    expect(plan.backingW).toBeGreaterThan(0);
  });
});

describe('displayDims — rotation-aware layout', () => {
  it('swaps width/height only for quarter turns', () => {
    const page = { width: 595, height: 842 };
    expect(displayDims({ ...page, rotation: 0 })).toEqual({ w: 595, h: 842 });
    expect(displayDims({ ...page, rotation: 90 })).toEqual({ w: 842, h: 595 });
    expect(displayDims({ ...page, rotation: 180 })).toEqual({ w: 595, h: 842 });
    expect(displayDims({ ...page, rotation: 270 })).toEqual({ w: 842, h: 595 });
    expect(displayDims({ ...page, rotation: -90 })).toEqual({ w: 842, h: 595 });
    expect(displayDims({ ...page, rotation: 450 })).toEqual({ w: 842, h: 595 });
  });
});

describe('page navigation controller math (B5 regression guards)', () => {
  it('clamps indexes to the document', () => {
    expect(clampPageIndex(-3, 10)).toBe(0);
    expect(clampPageIndex(99, 10)).toBe(9);
    expect(clampPageIndex(3, 0)).toBe(0);
    expect(clampPageIndex(NaN, 5)).toBe(0);
  });

  it('respects boundaries on prev/next', () => {
    expect(prevPageIndex(0, 8)).toBe(0);
    expect(nextPageIndex(7, 8)).toBe(7);
    expect(nextPageIndex(2, 8)).toBe(3);
    expect(prevPageIndex(2, 8)).toBe(1);
  });

  it('lands on the right page after deletions', () => {
    expect(pageAfterDelete(4, 1, 6)).toBe(3); // deleted before current → shift back
    expect(pageAfterDelete(5, 5, 6)).toBe(4); // deleted current last page → previous
    expect(pageAfterDelete(2, 2, 6)).toBe(2); // deleted current → whatever slides in
    expect(pageAfterDelete(0, 0, 1)).toBe(0); // was the only page
  });

  it('only commits complete page-number entries (no per-keystroke jumps)', () => {
    expect(parsePageInput('12', 30)).toBe(11);
    expect(parsePageInput('1', 30)).toBe(0);
    expect(parsePageInput('31', 30)).toBeNull();
    expect(parsePageInput('0', 30)).toBeNull();
    expect(parsePageInput('', 30)).toBeNull();
    expect(parsePageInput('abc', 30)).toBeNull();
  });

  it('labels pages 1-based for humans', () => {
    expect(pageLabel(0, 5)).toBe('1 / 5');
    expect(pageLabel(4, 5)).toBe('5 / 5');
    expect(pageLabel(0, 0)).toBe('0 / 0');
  });
});

describe('gestures (deliberate, axis-locked)', () => {
  it('turns pages on fast horizontal swipes only', () => {
    expect(classifyHorizontalSwipe({ dx: -120, dy: 8, dtMs: 180 })).toBe('next');
    expect(classifyHorizontalSwipe({ dx: 120, dy: -6, dtMs: 180 })).toBe('prev');
  });

  it('rejects tiny, slow or mostly-vertical movements (reading scrolls)', () => {
    expect(classifyHorizontalSwipe({ dx: -30, dy: 2, dtMs: 150 })).toBeNull();
    expect(classifyHorizontalSwipe({ dx: -140, dy: 4, dtMs: 1500 })).toBeNull();
    expect(classifyHorizontalSwipe({ dx: -90, dy: 200, dtMs: 200 })).toBeNull();
    expect(classifyHorizontalSwipe({ dx: 0, dy: 0, dtMs: 0 })).toBeNull();
  });

  it('reserves swipe-down for thumbnails', () => {
    expect(isSwipeDown({ dx: 4, dy: 70, dtMs: 200 })).toBe(true);
    expect(isSwipeDown({ dx: 90, dy: 70, dtMs: 200 })).toBe(false);
    expect(isSwipeDown({ dx: 2, dy: 20, dtMs: 200 })).toBe(false);
    expect(isSwipeDown({ dx: 2, dy: -80, dtMs: 200 })).toBe(false);
  });

  it('clamps pinch zoom multiplicatively', () => {
    expect(pinchZoom(1, 100, 200)).toBeCloseTo(2);
    expect(pinchZoom(3, 100, 400)).toBe(4);
    expect(pinchZoom(1, 200, 20)).toBe(0.4);
    expect(pinchZoom(1.5, 0, 100)).toBe(1.5);
  });
});

describe('zoom presets', () => {
  it('fit-page shrinks a tall page to the stage height', () => {
    const z = zoomForFitPage({ ...A4, containerW: 800, containerH: 600 });
    expect(z).toBeLessThan(1);
    const plan = planPageRender({ ...A4, containerW: 800, zoom: z, devicePixelRatio: 1 });
    expect(plan.cssH).toBeLessThanOrEqual(601);
  });

  it('actual size maps 1 point to 1 CSS pixel', () => {
    const z = zoomForActualSize({ pageW: A4.pageW, containerW: 800 });
    const plan = planPageRender({ ...A4, containerW: 800, zoom: z, devicePixelRatio: 1 });
    expect(plan.cssW).toBe(Math.round(A4.pageW));
    expect(displayZoomPercent(plan, A4.pageW)).toBe(100);
  });

  it('clamps zoom into the supported range', () => {
    expect(clampZoom(99)).toBe(4);
    expect(clampZoom(0.01)).toBe(0.4);
    expect(clampZoom(NaN)).toBe(1);
  });
});

describe('render window & thumbnails (memory guards)', () => {
  it('keeps only a small window of pages rendered', () => {
    expect([...renderWindow(0, 100)]).toEqual([0, 1, 2]);
    expect([...renderWindow(50, 100)]).toEqual([48, 49, 50, 51, 52]);
    expect([...renderWindow(99, 100)]).toEqual([97, 98, 99]);
    expect(renderWindow(0, 0).size).toBe(0);
  });

  it('renders thumbnails at retina width with a hard cap', () => {
    expect(thumbnailBackingWidth(112, 2)).toBe(224);
    expect(thumbnailBackingWidth(112, 3)).toBe(224); // DPR capped at 2 for thumbs
    expect(thumbnailBackingWidth(400, 2)).toBe(340);
  });
});

describe('load-error classification (honest error states)', () => {
  it('distinguishes password, damaged and unknown failures', () => {
    expect(classifyLoadError({ name: 'PasswordException' })).toBe('password');
    expect(classifyLoadError(new Error('No password given'))).toBe('password');
    expect(classifyLoadError({ name: 'InvalidPDFException' })).toBe('invalid');
    expect(classifyLoadError(new Error('boom'))).toBe('unknown');
    expect(classifyLoadError(null)).toBe('unknown');
  });

  it('has a message for every kind', () => {
    for (const kind of ['password', 'invalid', 'too-large', 'unknown'] as const) {
      expect(loadErrorMessage(kind).length).toBeGreaterThan(10);
    }
  });
});
