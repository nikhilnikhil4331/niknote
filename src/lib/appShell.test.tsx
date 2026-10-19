/**
 * App shell guard — router boundaries.
 *
 * Regression: commit ee58de4 added useLocation() to <InstallBanner /> while
 * App.tsx still rendered it AFTER </BrowserRouter>. React Router then threw
 * "useLocation() may be used only in the context of a <Router> component" on
 * every route, so the whole app fell through to the global ErrorBoundary
 * ("Kuch gadbad ho gayi") in production.
 *
 * Unit tests for InstallBanner passed because they wrapped it in MemoryRouter,
 * which is exactly how this escaped. This test checks the real mount point in
 * App.tsx, so a future move outside the router fails here instead of in prod.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs with the repo root as cwd (see vitest.config.ts).
const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
  // Strip JSX block comments so prose mentioning a tag cannot fool the scan.
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

/** Index of the first closing tag that matches `tag`, accounting for nesting. */
function closingTagIndex(source: string, tag: string): number {
  const re = new RegExp(`<(/?)${tag}(\\s[^>]*)?>`, 'g');
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const isClosing = match[1] === '/';
    const isSelfClosing = match[0].endsWith('/>');
    if (isClosing) {
      depth -= 1;
      if (depth === 0) return match.index;
    } else if (!isSelfClosing) {
      depth += 1;
      if (depth === 0) return match.index;
    }
  }
  return -1;
}

describe('App shell router boundaries', () => {
  it('renders components that call useLocation inside BrowserRouter', () => {
    for (const component of ['<InstallBanner', '<CookieConsent', '<GlobalDock']) {
      const mount = appSource.indexOf(component);
      expect(mount, `${component} is not rendered in App.tsx`).toBeGreaterThan(-1);
      expect(
        mount,
        `${component} must be rendered inside <BrowserRouter>`,
      ).toBeLessThan(closingTagIndex(appSource, 'BrowserRouter'));
    }
  });

  it('keeps <InstallBanner /> under the router after a refactor', () => {
    const bannerMount = appSource.indexOf('<InstallBanner');
    const routerClose = closingTagIndex(appSource, 'BrowserRouter');
    // The original outage: banner was mounted after this index.
    expect(bannerMount).toBeLessThan(routerClose);
  });
});
