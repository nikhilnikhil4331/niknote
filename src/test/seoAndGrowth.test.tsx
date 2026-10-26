import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import fs from 'node:fs';
import path from 'node:path';
import {
  CANONICAL_ORIGIN,
  PUBLIC_INDEXABLE_ROUTES,
  getAllSitemapEntries,
  resolveRouteSeo,
} from '@/lib/seoConfig';
import { SeoHead } from '@/components/seo/SeoHead';
import {
  COOKIE_CONSENT_KEY,
  LEGACY_ANALYTICS_CONSENT_KEY,
  getSavedConsent,
  hasAnalyticsConsent,
  hasMarketingConsent,
  saveConsentPreferences,
} from '@/lib/consent';
import {
  __resetTrackingForTests,
  initTracking,
  sanitizeTrackingParams,
  trackBeginCheckout,
  trackGenerateLead,
  trackRouteView,
  trackSignUpCompleted,
  trackVerifiedPurchase,
} from '@/lib/tracking';
import BlogPage from '@/pages/Blog';

const ROOT = path.resolve(__dirname, '../..');

describe('NikNote SEO, Sitemap, Consent & Tracking Verification', () => {
  beforeEach(() => {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    localStorage.removeItem(LEGACY_ANALYTICS_CONSENT_KEY);
    __resetTrackingForTests();
  });

  it('generates a valid canonical sitemap.xml excluding auth, admin, private, and alias routes', () => {
    const sitemapXml = fs.readFileSync(path.join(ROOT, 'public/sitemap.xml'), 'utf8');
    expect(sitemapXml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(sitemapXml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

    const locs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const expectedEntries = getAllSitemapEntries();
    expect(locs.length).toBe(expectedEntries.length);
    expect(new Set(locs).size).toBe(locs.length);

    for (const loc of locs) {
      expect(loc.startsWith(CANONICAL_ORIGIN)).toBe(true);
      expect(loc).not.toContain('undefined');
    }

    // Must exclude non-indexable, redirected alias, auth, payment, and admin paths
    const forbidden = [
      '/login',
      '/signup',
      '/auth',
      '/payment',
      '/account',
      '/notebooks',
      '/history',
      '/admin',
      '/adminpanelnikhil',
      '/qa',
      '/institutions',
      '/pdf</loc>',
      '/agents',
      '/ai-classic',
    ];
    for (const bad of forbidden) {
      expect(sitemapXml).not.toContain(`https://www.niknote.online${bad}`);
    }
  });

  it('ships a valid robots.txt allowing assets & search/AI bots while blocking private/admin routes', () => {
    const robots = fs.readFileSync(path.join(ROOT, 'public/robots.txt'), 'utf8');
    expect(robots).toContain('Sitemap: https://www.niknote.online/sitemap.xml');
    expect(robots).toContain('Allow: /assets/');
    expect(robots).toContain('User-agent: Googlebot');
    expect(robots).toContain('User-agent: OAI-SearchBot');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain('Disallow: /payment');
    expect(robots).toContain('Disallow: /qa');
  });

  it('ensures unique titles and meta descriptions across all indexable public routes', () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const route of PUBLIC_INDEXABLE_ROUTES) {
      expect(titles.has(route.title), `Duplicate title: ${route.title}`).toBe(false);
      expect(descriptions.has(route.description), `Duplicate description on ${route.path}`).toBe(false);
      titles.add(route.title);
      descriptions.add(route.description);
    }
  });

  it('keeps index.html accessible and free of fabricated structured-data ratings or fake GSC tokens', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).not.toContain('user-scalable=no');
    expect(html).not.toContain('maximum-scale=1.0');
    expect(html).not.toContain('REPLACE_WITH_YOUR_VERIFICATION_CODE');
    expect(html).not.toContain('AggregateRating');
    expect(html).not.toContain('ratingValue');

    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(jsonLdMatch).not.toBeNull();
    const parsed = JSON.parse(jsonLdMatch![1]);
    const types = parsed['@graph'].map((node: { '@type': string }) => node['@type']);
    expect(types).toEqual(['Organization', 'WebSite', 'SoftwareApplication']);
  });

  it('updates canonical, robots, and JSON-LD accurately across public, alias, blog, and private routes', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/institutions']}>
        <SeoHead />
      </MemoryRouter>,
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://www.niknote.online/schools',
    );
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, follow',
    );
    unmount();

    const blogRender = render(
      <MemoryRouter initialEntries={['/blog/how-to-convert-text-to-handwriting']}>
        <SeoHead />
      </MemoryRouter>,
    );
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://www.niknote.online/blog/how-to-convert-text-to-handwriting',
    );
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'index, follow',
    );
    const ldJson = Array.from(
      document.head.querySelectorAll('script[data-niknote-route-schema="true"]'),
    )
      .map((el) => el.textContent || '')
      .join('\n');
    expect(ldJson).toContain('"@type":"Article"');
    expect(ldJson).toContain('"@type":"BreadcrumbList"');
    blogRender.unmount();

    expect(resolveRouteSeo('/adminpanelnikhil').robots).toBe('noindex, nofollow');
    expect(resolveRouteSeo('/payment').robots).toBe('noindex, nofollow');
    expect(resolveRouteSeo('/non-existent-route-xyz').robots).toBe('noindex, nofollow');
  });

  it('renders individual /blog/:slug articles directly with semantic headings and internal tool links', () => {
    render(
      <MemoryRouter initialEntries={['/blog/how-to-convert-text-to-handwriting']}>
        <Routes>
          <Route path="/blog/:slug" element={<BlogPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toContain('Text ko Handwriting mein Convert kaise karein');
    expect(screen.getByText('Try These NikNote Tools')).toBeTruthy();
  });

  it('enforces user consent strictly before loading GA4 or Meta Pixel and deduplicates SPA & purchase events', () => {
    __resetTrackingForTests({ gaMeasurementId: 'G-TEST123456', metaPixelId: '123456789012345' });
    initTracking();

    // 1. Before consent: neither script nor queues may fire
    expect(getSavedConsent()).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
    expect(hasMarketingConsent()).toBe(false);
    trackRouteView('/upgrade');
    trackBeginCheckout({ planCode: 'monthly', planName: 'Premium', value: 99 });
    expect(document.head.querySelector('script[data-niknote-ga="true"]')).toBeNull();
    expect(document.head.querySelector('script[data-niknote-fbq="true"]')).toBeNull();

    // 2. Grant Analytics ONLY: GA4 activates, Meta Pixel remains blocked
    saveConsentPreferences({ analytics: true, marketing: false });
    expect(document.head.querySelector('script[data-niknote-ga="true"]')).not.toBeNull();
    expect(document.head.querySelector('script[data-niknote-fbq="true"]')).toBeNull();

    const gaEvents = () =>
      (window.dataLayer || []).filter(
        (entry: unknown) => Array.isArray(entry) && entry[0] === 'event',
      );
    trackRouteView('/upgrade');
    const countAfterFirst = gaEvents().filter((e: any) => e[1] === 'page_view').length;
    // Duplicate navigation to identical URL must NOT double-fire page_view
    trackRouteView('/upgrade');
    const countAfterDuplicate = gaEvents().filter((e: any) => e[1] === 'page_view').length;
    expect(countAfterDuplicate).toBe(countAfterFirst);

    // 3. Grant Marketing consent too: Meta Pixel activates & deduplicates Purchase by transactionId
    saveConsentPreferences({ analytics: true, marketing: true });
    expect(document.head.querySelector('script[data-niknote-fbq="true"]')).not.toBeNull();

    const fbQueue = () => ((window.fbq as any)?.queue || []) as any[][];
    trackSignUpCompleted('email', 'auth_page');
    trackGenerateLead({ planName: 'school_pro', conversionSource: 'schools_form' });
    trackVerifiedPurchase({
      transactionId: 'pay_test_999',
      planCode: 'monthly',
      planName: 'Premium',
      value: 99,
      currency: 'INR',
    });
    // Calling a second time with the same transactionId must be ignored
    trackVerifiedPurchase({
      transactionId: 'pay_test_999',
      planCode: 'monthly',
      planName: 'Premium',
      value: 99,
      currency: 'INR',
    });

    const gaPurchases = gaEvents().filter((e: any) => e[1] === 'purchase');
    expect(gaPurchases).toHaveLength(1);

    const fbPurchases = fbQueue().filter((args) => args[0] === 'track' && args[1] === 'Purchase');
    expect(fbPurchases).toHaveLength(1);
    expect(fbPurchases[0][3]).toEqual({ eventID: 'purchase_pay_test_999' });
  });

  it('scrubs PII, emails, tokens, and private note content from analytics parameters', () => {
    const cleaned = sanitizeTrackingParams({
      feature_name: 'handwriting_editor',
      email: 'student@example.com',
      note_content: 'My private diary entry',
      token: 'secret_jwt',
      leaked_field: 'contact me at test@school.edu',
      page_count: 3,
    });
    expect(cleaned).toEqual({
      feature_name: 'handwriting_editor',
      page_count: 3,
    });
  });
});
