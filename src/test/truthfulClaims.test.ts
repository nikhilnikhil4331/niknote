// Guards against selling things that do not exist.
//
// Every one of these phrases was live on niknote.online at some point and was
// false or unverified, including a Priority AI queue that was never built and
// institutional features or prices that were not backed by the checkout.
//
// Copy moves fast and nobody re-reads a pricing page before shipping, so this
// test reads the source files and fails when a banned claim creeps back in. It
// is deliberately blunt: if a phrase below becomes true, delete it from the
// list in the same commit that ships the feature.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

/** Files a visitor or a search engine can actually read. */
const CONSUMER_COPY = [
  'src/lib/seoConfig.ts',
  'src/pages/Upgrade.tsx',
  'src/pages/Payment.tsx',
  'src/components/premium/PricingPopup.tsx',
  'src/components/premium/PaywallModal.tsx',
  'src/components/premium/TrustBar.tsx',
  'src/components/landing/PricingTeaser.tsx',
  'src/components/landing/FAQSection.tsx',
  'src/components/landing/LandingPage.tsx',
  'src/components/landing/HeroSection.tsx',
  'src/components/landing/SocialProofSection.tsx',
  'src/pages/PremiumLanding.tsx',
  'src/components/urgency/ExitIntentPopup.tsx',
  'src/content/blogPosts.ts',
  'src/utils/promotion.ts',
  'src/components/promotion/ShareButtons.tsx',
];

/**
 * Phrases that must never appear in consumer copy again.
 * Each entry says what the truth is, so the next person knows why.
 */
const BANNED: { pattern: RegExp; why: string }[] = [
  {
    pattern: /priority\s*ai(?!\s*(?:responses)?"?\s*(?:and|neither|was))/i,
    why: 'No priority queue exists. All AI calls go through the same /api/ai path.',
  },
  {
    pattern: /\bunlimited\s+exports?\b/i,
    why: 'Exports were never capped for anyone. It is not a premium differentiator.',
  },
  {
    pattern: /2,?500\+\s*(students|users)/i,
    why: 'The claimed student count has not been verified.',
  },
  {
    pattern: /\b4\.8\s*(⭐|★|stars?)/i,
    why: 'No review collection exists. Every rating shown was fabricated.',
  },
  {
    pattern: /loved\s+by\s+[\d,]+\+?/i,
    why: 'Invented social proof. No testimonials have been collected.',
  },
  {
    pattern: /₹\s?25,?000\/?(year|yr)|₹\s?2,?00,?000|₹\s?75,?000/i,
    why: 'These B2B tiers are not purchasable through the existing checkout.',
  },
  {
    pattern: /white-?label/i,
    why: 'No white-labelling exists in the codebase.',
  },
  {
    pattern: /\bSSO\b(?!\s*(?:,|\s)and)/,
    why: 'No single-sign-on integration exists.',
  },
  {
    pattern: /teacher\s+(dashboard|admin)/i,
    why: 'No multi-user, dashboard or teacher view exists.',
  },
  {
    pattern: /\bwhiteboard/i,
    why: 'No whiteboard component or route exists.',
  },
  {
    pattern: /india'?s\s+#?1\s+ai\s+study\s+app/i,
    why: 'Unverifiable ranking claim with no source.',
  },
  {
    pattern: /100%\s*free!?\s*(?:no ads)?$/im,
    why: 'Four features are paid. "100% free" is false.',
  },
  {
    pattern: /\b4-?line\s+paper/i,
    why: 'Only plain/ruled/graph/dotted/legal/vintage/kraft/blueprint exist.',
  },
  {
    pattern: /thousands of students|join thousands/i,
    why: 'The claimed social proof has not been verified.',
  },
  {
    pattern: /clone your handwriting/i,
    why: 'The style matcher maps slant/size/spacing; it does not clone a hand.',
  },
  {
    pattern: /unlimited\s+ai\s+(notes|power|generated)/i,
    why: 'AI notes are free for everyone, so unlimited is not a thing you sell.',
  },
  {
    pattern: /unlimited\s+(transcription|conversions|voice)/i,
    why: 'No cap applies to these, so "unlimited" is not a premium benefit.',
  },
  {
    pattern: /50-page lectures/i,
    why: 'No bulk-PDF summarisation pipeline exists.',
  },
  {
    pattern: /no watermark/i,
    why: 'Exports have never carried a watermark, free or paid.',
  },
  {
    pattern: /\b9 ai (teachers|agents)\b/i,
    why: 'src/data/agents.ts holds engineering roles, not teachers.',
  },
];

describe('consumer copy does not sell things that do not exist', () => {
  for (const file of CONSUMER_COPY) {
    describe(file, () => {
      for (const { pattern, why } of BANNED) {
        it(`does not contain ${pattern}`, () => {
          const source = read(file);
          const match = source.match(pattern);
          // Comments explaining the removal are fine; they exist for the next
          // reader. Only fail when the phrase survives outside a comment line.
          // Wording that discloses a limitation ("not included", "never built",
          // "these are not part of what you are buying") is the opposite of the
          // problem, so it must not trip the guard.
          const DISCLOSURE = /not (?:included|built|available|part of)|never (?:built|existed|existed)|nahi (?:hai|gaye)|roadmap|coming later|was (?:wrong|false)/i;

          // Track block comments so a multi-line JSX/TS comment explaining a
          // past mistake does not count as advertising it.
          const lines = source.split('\n');
          const inBlockComment = (lineNumber: number) => {
            let open = false;
            for (let i = 0; i < lineNumber - 1; i += 1) {
              const text = lines[i];
              if (text.includes('{/*') || text.includes('/*')) open = true;
              if (text.includes('*/')) open = false;
            }
            return open || lines[lineNumber - 1].trim().startsWith('/*') || lines[lineNumber - 1].trim().startsWith('{/*');
          };

          const offendingLines = source
            .split('\n')
            .map((line, index) => ({ line, index: index + 1 }))
            .filter(({ line, index }) => {
              if (!pattern.test(line)) return false;
              const trimmed = line.trim();
              const lineNumber = index;
              if (trimmed.startsWith('//') || trimmed.startsWith('*')) return false;
              if (inBlockComment(lineNumber)) return false;
              if (DISCLOSURE.test(trimmed)) return false;
              // A disclosure may be a list under a heading ("Jo abhi nahi hai"),
              // so look at this line and the two above it.
              const window = lines.slice(Math.max(0, lineNumber - 8), lineNumber).join(' ');
              if (DISCLOSURE.test(window)) return false;
              return true;
            });

          if (offendingLines.length > 0) {
            throw new Error(
              `${file} still advertises a claim that is not true.\n` +
                `Why it is banned: ${why}\n` +
                offendingLines.map(({ line, index }) => `  ${index}: ${line.trim()}`).join('\n')
            );
          }
          expect(match === null || offendingLines.length === 0).toBe(true);
        });
      }
    });
  }
});

describe('the premium list matches what the editor actually locks', () => {
  it('names the four real gates and nothing else', () => {
    const popup = read('src/components/premium/PricingPopup.tsx');
    for (const gate of [
      'AI writing assistant',
      'Voice dictation',
      'AI style matcher',
      'Handwriting import',
    ]) {
      expect(popup).toContain(gate);
    }
  });

  it('the pricing page keeps free and premium visually separate', () => {
    const upgrade = read('src/pages/Upgrade.tsx');
    expect(upgrade).toContain('Premium only');
    expect(upgrade).toContain('Free for everyone');
  });
});


describe('checkout and active acquisition surfaces are consistent', () => {
  it('does not mount fabricated activity or advertise unverified annual institution tiers', () => {
    expect(read('src/components/landing/LandingPage.tsx')).not.toContain('LiveActivityFeed');
    for (const file of ['src/pages/B2BLanding.tsx', 'src/pages/Upgrade.tsx', 'src/pages/Blog.tsx', 'src/lib/seoConfig.ts', 'src/content/blogPosts.ts']) {
      expect(read(file)).not.toMatch(/₹999\s*\/(?:year|yr)|₹4,999\s*\/(?:year|yr)|50% discount|free 30-day pilot/i);
    }
  });

  it('makes the weekly offer open the weekly checkout and discloses one-time terms', () => {
    expect(read('src/components/urgency/ExitIntentPopup.tsx')).toContain('/payment?plan=weekly');
    const checkout = read('src/pages/Payment.tsx');
    expect(checkout).toContain('no automatic renewal');
    expect(checkout).toContain('If money was deducted, do not pay again');
  });
});
