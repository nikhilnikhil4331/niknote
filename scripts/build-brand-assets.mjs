// Regenerates every NikNote brand asset from the two master SVGs (mark + wordmark).
// Run: node scripts/build-brand-assets.mjs   (needs @resvg/resvg-js)
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';

const B = 'public/brand/';
const mark = fs.readFileSync(B + 'mark.svg', 'utf8');
const word = fs.readFileSync(B + 'wordmark.svg', 'utf8');
const wordInner = word.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const WM_W = 331.4;

const monoMark = (color) => `
  <circle cx="64" cy="64" r="58" fill="none" stroke="${color}" stroke-width="7"/>
  <path d="M38 46 L84 40 L90 92 L44 98 Z" fill="none" stroke="${color}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M48 74 C52 62 56 62 58 70 C60 78 64 78 66 68 C68 58 72 58 74 66" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>
  <circle cx="52" cy="86" r="4.5" fill="${color}"/>
  <rect x="60" y="83" width="15" height="5" rx="2.5" fill="${color}"/>
  <path d="M92 10 Q96 32 118 36 Q96 40 92 62 Q88 40 66 36 Q88 32 92 10 Z" fill="none" stroke="${color}" stroke-width="6" stroke-linejoin="round"/>`;

const lockup = (markInner, wordFill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${148 + WM_W} 128">
  ${markInner}
  <g transform="translate(148,98)" fill="${wordFill}">${wordInner}</g>
</svg>`;

const stacked = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WM_W} 244">
  <g transform="translate(${(WM_W - 128) / 2},0)">${mark.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</g>
  <g transform="translate(0,234)" fill="#171313">${wordInner}</g>
</svg>`;

fs.writeFileSync(B + 'logo-primary.svg', lockup(mark.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''), '#171313'));
fs.writeFileSync(B + 'logo-stacked.svg', stacked);
fs.writeFileSync(B + 'logo-mono-black.svg', lockup(monoMark('#171313'), '#171313'));
fs.writeFileSync(B + 'logo-mono-white.svg', lockup(monoMark('#FFFDF5'), '#FFFDF5'));
fs.writeFileSync(B + 'favicon.svg', mark);

const render = (svg, width, out) => {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
  fs.writeFileSync(out, r.render().asPng());
};

render(fs.readFileSync(B + 'logo-primary.svg', 'utf8'), 1200, 'public/niknote-logo.png');
for (const s of [72, 96, 128, 144, 152, 192, 384, 512]) render(mark, s, `public/icons/icon-${s}x${s}.png`);
render(mark, 180, 'public/icons/apple-touch-icon.png');
render(mark, 16, 'public/icons/favicon-16x16.png');
render(mark, 32, 'public/icons/favicon-32x32.png');

const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FFFDF5"/>
  <circle cx="150" cy="520" r="90" fill="#FF858F" opacity="0.5"/>
  <path d="M1050 90 Q1060 150 1120 160 Q1060 170 1050 230 Q1040 170 980 160 Q1040 150 1050 90 Z" fill="#FFE45C"/>
  <g transform="translate(${(1200 - (148 + WM_W) * 1.5) / 2},${(630 - 128 * 1.5) / 2}) scale(1.5)">${lockup(mark.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''), '#171313').replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</g>
</svg>`;
render(og, 1200, '.og.png');
console.log('brand assets built');
