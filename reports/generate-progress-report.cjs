const fs = require('node:fs');
const path = require('node:path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'niknote-progress-report-2026-11-07.pdf');
const W = 595.28;
const H = 841.89;
const M = 42;
const PALETTE = {
  blueLogo: '#347FF0',
  blue: '#2869D5',
  coral: '#FF858F',
  rose: '#C83F58',
  yellow: '#FFE45C',
  paper: '#FFFDF5',
  ink: '#171313',
  text: '#393638',
  muted: '#6F7075',
  border: '#E5E1D9',
  bluePale: '#EAF1FF',
  coralPale: '#FFF0F0',
  yellowPale: '#FFF8D8',
  green: '#26764D',
  greenPale: '#E8F5EC',
  grayPale: '#F1F0EC',
  white: '#FFFFFF',
  navy: '#15233A',
};

function color(hex) {
  const n = hex.replace('#', '');
  return rgb(parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255);
}
const C = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, color(v)]));

function rect(page, x, top, width, height, fill, border = null, borderWidth = 0) {
  const opts = { x, y: H - top - height, width, height, color: fill };
  if (border) {
    opts.borderColor = border;
    opts.borderWidth = borderWidth || 0.8;
  }
  page.drawRectangle(opts);
}
function line(page, x1, top1, x2, top2, stroke = C.border, thickness = 1) {
  page.drawLine({ start: { x: x1, y: H - top1 }, end: { x: x2, y: H - top2 }, color: stroke, thickness });
}
function text(page, value, x, top, size, font, ink = C.ink) {
  page.drawText(String(value), { x, y: H - top - size, size, font, color: ink, lineHeight: size * 1.25 });
}
function wrapLines(value, width, font, size) {
  const paragraphs = String(value).split('\n');
  const lines = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !current) {
        current = next;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}
function paragraph(page, value, x, top, width, opts = {}) {
  const font = opts.font || F.reg;
  const size = opts.size || 10;
  const leading = opts.leading || size * 1.38;
  const ink = opts.color || C.text;
  const lines = wrapLines(value, width, font, size);
  lines.forEach((entry, index) => text(page, entry, x, top + index * leading, size, font, ink));
  return top + lines.length * leading;
}
function bulletList(page, items, x, top, width, opts = {}) {
  const size = opts.size || 9.2;
  const leading = opts.leading || size * 1.38;
  const gap = opts.gap === undefined ? 6 : opts.gap;
  const font = opts.font || F.reg;
  const ink = opts.color || C.text;
  const bulletColor = opts.bulletColor || C.blue;
  let cursor = top;
  for (const item of items) {
    rect(page, x + 1, cursor + 5, 4, 4, bulletColor);
    const end = paragraph(page, item, x + 13, cursor, width - 14, { font, size, leading, color: ink });
    cursor = end + gap;
  }
  return cursor;
}
function pill(page, label, x, top, fill, ink, opts = {}) {
  const size = opts.size || 7.4;
  const padX = opts.padX || 9;
  const h = opts.height || 19;
  const width = F.bold.widthOfTextAtSize(label, size) + padX * 2;
  rect(page, x, top, width, h, fill);
  text(page, label, x + padX, top + (h - size) / 2 - 0.2, size, F.bold, ink);
  return width;
}
function card(page, x, top, width, height, opts = {}) {
  rect(page, x + 2, top + 3, width, height, opts.shadow || C.grayPale);
  rect(page, x, top, width, height, opts.fill || C.white, opts.border || C.border, opts.borderWidth || 0.7);
  if (opts.accent) rect(page, x, top, 5, height, opts.accent);
}
function drawImageTop(page, image, x, top, width, height) {
  page.drawImage(image, { x, y: H - top - height, width, height });
}
function dot(page, x, top, size, fill) {
  rect(page, x, top, size, size, fill);
}
function sectionPage(doc, section, title, subtitle, number) {
  const page = doc.addPage([W, H]);
  rect(page, 0, 0, W, H, C.paper);
  rect(page, 0, 0, W, 6, C.blue);
  text(page, 'NIKNOTE  /  PROJECT PROGRESS REPORT', M, 18, 8, F.bold, C.blue);
  text(page, '07 NOV 2026', W - M - F.bold.widthOfTextAtSize('07 NOV 2026', 8), 18, 8, F.bold, C.muted);
  line(page, M, 42, W - M, 42, C.border, 0.8);
  text(page, section.toUpperCase(), M, 59, 8, F.bold, C.rose);
  text(page, title, M, 78, 24, F.bold, C.ink);
  paragraph(page, subtitle, M, 111, W - M * 2, { size: 9.5, leading: 13, color: C.muted });
  line(page, M, 139, W - M, 139, C.border, 0.8);
  footer(page, number);
  return page;
}
function footer(page, number) {
  line(page, M, 808, W - M, 808, C.border, 0.7);
  text(page, 'NIKNOTE  |  HINGLISH HANDOFF  |  07 NOV 2026', M, 817, 7, F.bold, C.muted);
  const label = `${String(number).padStart(2, '0')} / 06`;
  text(page, label, W - M - F.bold.widthOfTextAtSize(label, 7), 817, 7, F.bold, C.muted);
}
function smallSectionTitle(page, title, x, top, ink = C.ink) {
  text(page, title, x, top, 11, F.bold, ink);
}
function drawSpark(page, cx, cyTop, size, ink) {
  line(page, cx, cyTop - size, cx, cyTop + size, ink, 1.4);
  line(page, cx - size, cyTop, cx + size, cyTop, ink, 1.4);
  line(page, cx - size * 0.62, cyTop - size * 0.62, cx + size * 0.62, cyTop + size * 0.62, ink, 0.9);
  line(page, cx - size * 0.62, cyTop + size * 0.62, cx + size * 0.62, cyTop - size * 0.62, ink, 0.9);
}

let F;

async function main() {
const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
pdf.setTitle('NikNote Transformation - Progress Report - 07 Nov 2026');
pdf.setAuthor('NikNote project handoff');
pdf.setSubject('Completed work, verification, production deployment, and remaining actions');
pdf.setKeywords(['NikNote', 'progress report', 'Creative Playground', 'Vercel', 'production']);
const fontDir = path.join(ROOT, 'node_modules/pdfjs-dist/standard_fonts');
F = {
  reg: await pdf.embedFont(fs.readFileSync(path.join(fontDir, 'LiberationSans-Regular.ttf')), { subset: true }),
  bold: await pdf.embedFont(fs.readFileSync(path.join(fontDir, 'LiberationSans-Bold.ttf')), { subset: true }),
  oblique: await pdf.embedFont(fs.readFileSync(path.join(fontDir, 'LiberationSans-Italic.ttf')), { subset: true }),
};
const logo = await pdf.embedPng(fs.readFileSync(path.join(ROOT, 'public/niknote-logo.png')));
const nikai = await pdf.embedPng(fs.readFileSync(path.join(ROOT, 'public/nikai-mark.png')));

// PAGE 1 - cover and executive snapshot
{
  const page = pdf.addPage([W, H]);
  rect(page, 0, 0, W, H, C.paper);
  rect(page, 0, 0, W, 8, C.blue);
  rect(page, 0, 8, 12, H - 8, C.coral);
  drawImageTop(page, logo, 40, 28, 136, 71);
  text(page, 'PROJECT HANDOFF', 383, 42, 8, F.bold, C.blue);
  text(page, 'HINGLISH  /  07 NOV 2026', 383, 57, 7.5, F.bold, C.muted);
  line(page, 385, 75, W - 42, 75, C.border, 0.8);

  pill(page, 'PRODUCTION RELEASE', 42, 128, C.greenPale, C.green, { height: 21 });
  text(page, 'NikNote Transformation', 42, 169, 30, F.bold, C.ink);
  text(page, 'Progress Report', 42, 207, 29, F.bold, C.blue);
  paragraph(page, 'Ab tak kya deliver hua, production par kya live hai, aur abhi kya baaki hai - ek detailed handoff.', 44, 254, 438, { size: 12, leading: 17, color: C.text });

  card(page, 42, 310, 510, 76, { fill: C.navy, shadow: C.bluePale, border: C.navy, accent: C.yellow });
  text(page, 'CURRENT STATUS', 61, 326, 8, F.bold, C.yellow);
  text(page, 'LIVE IN PRODUCTION', 61, 345, 17, F.bold, C.white);
  text(page, 'Vercel reports READY / PROMOTED; production aliases assigned.', 61, 368, 9, F.reg, C.white);
  pill(page, 'READY', 454, 339, C.greenPale, C.green, { height: 22, size: 8 });

  const metrics = [
    ['696', 'tests passed', C.bluePale, C.blue],
    ['39', 'test files', C.coralPale, C.rose],
    ['35', 'public routes built', C.yellowPale, C.ink],
    ['17', 'focused tests', C.greenPale, C.green],
  ];
  const gap = 10;
  const cw = (510 - gap * 3) / 4;
  metrics.forEach(([value, label, fill, accent], index) => {
    const x = 42 + index * (cw + gap);
    card(page, x, 405, cw, 78, { fill, border: fill, shadow: C.grayPale });
    text(page, value, x + 12, 418, 23, F.bold, accent);
    paragraph(page, label, x + 12, 449, cw - 22, { size: 8, leading: 10, color: C.text });
  });

  smallSectionTitle(page, 'Delivery status by workstream', 43, 512);
  const tracks = [
    ['PLAYGROUND', 'DONE', C.blue, C.bluePale],
    ['BRAND + HUB', 'DONE', C.rose, C.coralPale],
    ['TESTS + BUILD', 'PASS', C.green, C.greenPale],
    ['PRODUCTION', 'LIVE', C.blue, C.bluePale],
    ['VISUAL QA', 'OPEN', C.muted, C.grayPale],
  ];
  const tw = 94;
  tracks.forEach(([label, status, accent, fill], index) => {
    const x = 42 + index * (tw + 10);
    card(page, x, 537, tw, 56, { fill, border: fill, shadow: C.grayPale });
    text(page, status, x + 10, 545, 10, F.bold, accent);
    paragraph(page, label, x + 10, 564, tw - 16, { size: 6.7, leading: 8, font: F.bold, color: C.text });
  });

  card(page, 42, 619, 510, 125, { fill: C.white, border: C.border, accent: C.coral });
  text(page, 'EXECUTIVE SUMMARY', 60, 635, 8, F.bold, C.rose);
  bulletList(page, [
    'Responsive /playground is shipped with local-only saving, editing, arrangement, keyboard movement and SVG export.',
    'Hub and shared NikAI artwork now follow the blue / coral / yellow brand direction; intentional purple choices remain.',
    'Code checks passed and production is live. The main open item is a human visual review across phone, tablet and desktop.',
  ], 60, 653, 468, { size: 8.6, leading: 11.5, gap: 3, bulletColor: C.blue });
  text(page, 'Full detail, evidence, warnings and next steps follow on pages 2-6.', 44, 771, 8.3, F.oblique, C.muted);
  footer(page, 1);
}

// PAGE 2 - playground features and local-first architecture
{
  const page = sectionPage(pdf, '01  /  PRODUCT DELIVERED', 'Creative Playground', 'A responsive, local-first canvas for arranging ideas - not a fake cloud feature.', 2);
  card(page, 42, 153, 510, 54, { fill: C.bluePale, border: C.bluePale, accent: C.blue });
  text(page, 'ROUTE', 58, 164, 7, F.bold, C.blue);
  text(page, '/playground', 58, 178, 13, F.bold, C.ink);
  text(page, 'Workspace / noindex page; saved board stays on this browser and device.', 193, 174, 8.5, F.reg, C.text);

  card(page, 42, 222, 316, 256, { fill: C.white });
  smallSectionTitle(page, 'What people can do', 59, 238);
  bulletList(page, [
    'Create sticky notes, checklists, thought bubbles and star / spark pieces.',
    'Drag pieces on the canvas; edit text directly; resize and rotate selected pieces.',
    'Move items with the keyboard and use focusable controls for canvas actions.',
    'Start from four distinct starter layouts; choose from four paper themes and six piece colors.',
    'Export the current board as SVG for a portable, editable visual snapshot.',
    'Respect the saved reduced-motion preference for Playground transitions.',
  ], 59, 262, 280, { size: 8.8, leading: 12.1, gap: 4, bulletColor: C.blue });

  card(page, 374, 222, 178, 256, { fill: C.yellowPale, border: C.yellowPale });
  text(page, 'CANVAS PREVIEW', 389, 238, 7.5, F.bold, C.ink);
  rect(page, 389, 258, 148, 192, C.paper, C.border, 0.8);
  // Miniature note board illustration
  rect(page, 399, 272, 62, 55, C.yellow, C.yellow, 0);
  text(page, 'Capture the', 405, 283, 6.6, F.bold, C.ink);
  text(page, 'big idea', 405, 294, 6.6, F.bold, C.ink);
  line(page, 405, 311, 451, 311, C.ink, 0.4);
  rect(page, 466, 276, 60, 65, C.coralPale, C.coral, 0.6);
  text(page, 'Next steps', 472, 286, 6.5, F.bold, C.rose);
  rect(page, 472, 302, 3, 3, C.rose);
  line(page, 480, 304, 518, 304, C.ink, 0.5);
  rect(page, 472, 314, 3, 3, C.rose);
  line(page, 480, 316, 518, 316, C.ink, 0.5);
  rect(page, 400, 339, 72, 48, C.bluePale, C.blue, 0.6);
  text(page, 'Think it', 408, 351, 6.5, F.bold, C.blue);
  text(page, 'through...', 408, 362, 6.5, F.reg, C.text);
  rect(page, 481, 352, 43, 36, C.white, C.border, 0.6);
  drawSpark(page, 502, 370, 9, C.blue);
  line(page, 399, 402, 525, 402, C.border, 0.7);
  text(page, 'Move  /  edit  /  export', 399, 414, 6.8, F.bold, C.muted);
  text(page, 'Local save is automatic', 399, 428, 6.5, F.reg, C.green);

  const colW = 159;
  const detailCards = [
    ['CONTENT', '4 piece types', 'Notes, checklists, thought bubbles, stars.', C.blue],
    ['SAFETY', '24-piece cap', 'Validated storage; duplicate IDs repaired.', C.rose],
    ['PORTABILITY', 'SVG export', 'Board stays editable and device-local.', C.green],
  ];
  detailCards.forEach((entry, index) => {
    const x = 42 + index * (colW + 16.5);
    card(page, x, 496, colW, 92, { fill: C.white, accent: entry[3] });
    text(page, entry[0], x + 14, 507, 6.8, F.bold, entry[3]);
    text(page, entry[1], x + 14, 522, 11, F.bold, C.ink);
    paragraph(page, entry[2], x + 14, 540, colW - 24, { size: 7.4, leading: 9.6, color: C.text });
  });

  text(page, 'LOCAL-FIRST DATA FLOW', 43, 610, 8, F.bold, C.blue);
  const flow = [
    ['USER EDIT', 'move / type'],
    ['TYPED MODEL', 'validate / repair'],
    ['LOCALSTORAGE', 'device only'],
    ['SVG EXPORT', 'download file'],
  ];
  const flowW = 110;
  flow.forEach((item, index) => {
    const x = 42 + index * 124;
    const fill = index === 1 ? C.coralPale : index === 2 ? C.yellowPale : C.bluePale;
    rect(page, x, 632, flowW, 52, fill, fill, 0);
    text(page, item[0], x + 9, 643, 7, F.bold, index === 2 ? C.ink : C.blue);
    text(page, item[1], x + 9, 659, 7.2, F.reg, C.text);
    if (index < flow.length - 1) {
      line(page, x + flowW + 3, 658, x + 120, 658, C.rose, 1.2);
      line(page, x + 116, 655, x + 120, 658, C.rose, 1.2);
      line(page, x + 116, 661, x + 120, 658, C.rose, 1.2);
    }
  });
  text(page, 'Storage key: niknote.playground.canvas.v1', 44, 699, 7.8, F.bold, C.text);
  text(page, 'No new database, cloud-sync promise or mock search results were added.', 44, 714, 7.8, F.reg, C.muted);

  line(page, 42, 745, 552, 745, C.border, 0.8);
  text(page, 'NAV ENTRY POINTS', 44, 758, 7, F.bold, C.rose);
  paragraph(page, 'Desktop shell  |  Workspace sidebar  |  Hub  |  Mobile quick actions / drawer  |  Command palette  |  Onboarding', 44, 773, 490, { size: 7.3, leading: 9, color: C.text });
}

// PAGE 3 - visual audit, brand tokens and navigation map
{
  const page = sectionPage(pdf, '02  /  VISUAL SYSTEM', 'Brand, Hub & app integration', 'Retuned generic UI accents to the established identity while preserving colors with product meaning.', 3);
  text(page, 'BRAND PALETTE', 43, 153, 8, F.bold, C.blue);
  const swatches = [
    ['LOGO BLUE', '#347FF0', C.blueLogo, C.white],
    ['UI BLUE', '#2869D5', C.blue, C.white],
    ['CORAL', '#FF858F', C.coral, C.ink],
    ['ACCESSIBLE ROSE', '#C83F58', C.rose, C.white],
    ['YELLOW', '#FFE45C', C.yellow, C.ink],
    ['PAPER', '#FFFDF5', C.paper, C.ink],
    ['INK', '#171313', C.ink, C.white],
  ];
  const sw = 68;
  swatches.forEach((entry, index) => {
    const x = 42 + index * 73;
    rect(page, x, 174, sw, 42, entry[2], C.border, 0.6);
    text(page, entry[0], x, 222, 5.8, F.bold, C.text);
    text(page, entry[1], x, 232, 6.4, F.reg, C.muted);
  });

  card(page, 42, 254, 230, 198, { fill: C.white });
  text(page, 'NIKAI MARK', 58, 268, 7.5, F.bold, C.rose);
  drawImageTop(page, nikai, 58, 284, 196, 103);
  paragraph(page, 'Shared N-and-spark artwork is retinted to brand blue, coral and yellow. Its recognizable silhouette is kept; the supplied primary NikNote mark is not replaced.', 58, 397, 195, { size: 7.6, leading: 10.2, color: C.text });

  card(page, 288, 254, 264, 198, { fill: C.white, accent: C.blue });
  text(page, 'WHAT THE AUDIT CHANGED', 305, 268, 7.5, F.bold, C.blue);
  bulletList(page, [
    'Refreshed Hub color hierarchy and its Playground entry point.',
    'Retuned generic mobile shadows, dark premium tints and neutral accents.',
    'Moved generic admin chart-title accents to accessible UI blue.',
    'Renamed stale auth accent alias --auth-violet to --auth-coral.',
    'Aligned the unused design-system token palette with the brand guide.',
  ], 305, 289, 230, { size: 7.5, leading: 9.7, gap: 3, bulletColor: C.blue });

  text(page, 'PLAYGROUND NAVIGATION MAP', 43, 474, 8, F.bold, C.blue);
  card(page, 194, 535, 207, 70, { fill: C.navy, border: C.navy, shadow: C.bluePale });
  text(page, 'CREATIVE PLAYGROUND', 211, 551, 10, F.bold, C.white);
  text(page, 'Route: /playground', 211, 570, 8, F.reg, C.yellow);
  const nodes = [
    { x: 43, y: 500, w: 126, label: 'DESKTOP SHELL', fill: C.bluePale, side: 'left' },
    { x: 43, y: 628, w: 126, label: 'WORKSPACE SIDEBAR', fill: C.coralPale, side: 'left' },
    { x: 427, y: 500, w: 126, label: 'HUB', fill: C.yellowPale, side: 'right' },
    { x: 427, y: 566, w: 126, label: 'MOBILE ACTIONS', fill: C.bluePale, side: 'right' },
    { x: 427, y: 632, w: 126, label: 'COMMAND PALETTE', fill: C.coralPale, side: 'right' },
  ];
  nodes.forEach((node) => {
    rect(page, node.x, node.y, node.w, 33, node.fill, node.fill, 0);
    text(page, node.label, node.x + 9, node.y + 11, 6.7, F.bold, C.ink);
    if (node.side === 'left') line(page, node.x + node.w, node.y + 17, 194, 570, C.border, 1.1);
    else line(page, 401, 570, node.x, node.y + 17, C.border, 1.1);
  });
  rect(page, 194, 617, 207, 33, C.greenPale, C.greenPale, 0);
  text(page, 'ONBOARDING LINK', 211, 628, 6.8, F.bold, C.green);
  line(page, 297, 605, 297, 617, C.green, 1.1);

  card(page, 42, 682, 510, 96, { fill: C.yellowPale, border: C.yellowPale, accent: C.rose });
  text(page, 'IMPORTANT COLOR / DATA GUARDRAILS', 59, 696, 7.2, F.bold, C.rose);
  paragraph(page, 'Purple remains available for user-selected ink and appearance choices, and meaningful category / analytics colors stay intact. QuickSearch.tsx mock results were not used as real data. The Playground intentionally has no cloud sync or database dependency.', 59, 714, 470, { size: 8, leading: 11.1, color: C.text });
}

// PAGE 4 - verification graphs and known warnings
{
  const page = sectionPage(pdf, '03  /  QUALITY EVIDENCE', 'Checks, tests & build output', 'The latest code state passed its main gates before the production build was promoted.', 4);
  card(page, 42, 153, 510, 215, { fill: C.white, border: C.border });
  text(page, 'FULL TEST SUITE', 60, 169, 8, F.bold, C.blue);
  text(page, '696 / 696', 60, 190, 26, F.bold, C.ink);
  text(page, 'passed', 61, 223, 10, F.bold, C.green);
  text(page, '39 test files', 432, 176, 8.5, F.bold, C.muted);
  text(page, '0 failed', 432, 193, 8.5, F.bold, C.green);
  text(page, 'Test outcomes', 60, 254, 8, F.bold, C.text);
  const barX = 60;
  const barTop = 273;
  const barW = 463;
  const barH = 25;
  rect(page, barX, barTop, barW, barH, C.grayPale);
  rect(page, barX, barTop, barW, barH, C.blue);
  text(page, '696 PASSED', barX + 11, barTop + 7, 8, F.bold, C.white);
  text(page, '0 FAILED', barX + barW - 54, barTop + 7, 7, F.bold, C.white);
  text(page, 'Scale: every recorded test in the completed full run passed.', 60, 309, 7.5, F.oblique, C.muted);
  line(page, 60, 333, 523, 333, C.border, 0.7);
  text(page, 'Focused Playground model / UI + SEO run', 60, 343, 8, F.bold, C.ink);
  text(page, '17 tests  |  3 files  |  duplicate-ID repair regression included', 60, 355, 7.5, F.reg, C.muted);

  text(page, 'VERIFICATION GATES', 43, 390, 8, F.bold, C.blue);
  const checks = [
    ['TYPECHECK', 'PASS', C.bluePale, C.blue],
    ['FOCUSED ESLINT', 'PASS', C.greenPale, C.green],
    ['PRODUCTION BUILD', 'PASS', C.coralPale, C.rose],
    ['DIFF / WHITESPACE', 'PASS', C.yellowPale, C.ink],
  ];
  checks.forEach((entry, index) => {
    const x = 42 + index * 128;
    card(page, x, 411, 116, 57, { fill: entry[2], border: entry[2], shadow: C.grayPale });
    text(page, entry[1], x + 11, 422, 8.5, F.bold, entry[3]);
    paragraph(page, entry[0], x + 11, 441, 98, { size: 6.1, leading: 8, font: F.bold, color: C.text });
  });

  card(page, 42, 489, 244, 100, { fill: C.white });
  text(page, 'PRODUCTION BUILD', 58, 503, 7, F.bold, C.rose);
  text(page, '35', 58, 520, 22, F.bold, C.ink);
  paragraph(page, 'public routes prerendered. Private /playground is excluded from sitemap / prerender list by design.', 101, 522, 167, { size: 7.5, leading: 10, color: C.text });

  card(page, 300, 489, 252, 100, { fill: C.white });
  text(page, 'LINT SCOPE', 316, 503, 7, F.bold, C.blue);
  text(page, '25', 316, 520, 22, F.bold, C.rose);
  paragraph(page, 'legacy diagnostics remain in a broader changed-file lint pass; focused lint on the new Playground and selected retuned surfaces passed.', 359, 522, 178, { size: 7.1, leading: 9.5, color: C.text });

  card(page, 42, 611, 510, 166, { fill: C.grayPale, border: C.grayPale });
  text(page, 'KNOWN WARNINGS - NOT BUILD BLOCKERS', 59, 627, 7.2, F.bold, C.muted);
  bulletList(page, [
    'Build: stale Browserslist data; mixed static / dynamic imports; some bundles exceed the 600 kB warning threshold.',
    'Full tests: chart container size and React state warnings; guest Supabase auth requests were blocked in the sandbox; mocked payment and PDF fixture warnings appeared. The suite still passed.',
    'Repository lint debt: earlier full-repo baseline was 395 errors and 68 warnings. The broad lint number is legacy debt, not a claim that the new surfaces failed targeted lint.',
  ], 59, 649, 472, { size: 7.45, leading: 9.6, gap: 3, bulletColor: C.rose });
}

// PAGE 5 - production and GitHub trail
{
  const page = sectionPage(pdf, '04  /  RELEASE RECORD', 'Production & repository status', 'The app deployment and the GitHub handoff are both traceable to exact commits.', 5);
  card(page, 42, 153, 510, 164, { fill: C.navy, border: C.navy, shadow: C.bluePale });
  pill(page, 'VERCEL  /  PRODUCTION', 60, 169, C.greenPale, C.green, { height: 21, size: 7.2 });
  text(page, 'READY  /  PROMOTED', 60, 202, 19, F.bold, C.white);
  text(page, 'Aliases assigned', 60, 231, 8, F.bold, C.yellow);
  text(page, 'www.niknote.online', 60, 248, 10, F.bold, C.white);
  text(page, 'niknote.online', 60, 265, 9, F.reg, C.white);
  text(page, 'App route: /playground', 60, 292, 8, F.reg, C.yellow);
  drawSpark(page, 499, 218, 21, C.coral);
  drawSpark(page, 462, 266, 9, C.yellow);

  text(page, 'DEPLOYMENT DETAILS', 43, 340, 8, F.bold, C.blue);
  const details = [
    ['Deployment ID', 'dpl_PmYxjj2MEAXWFcvNiQBnhW1peDNa'],
    ['Vercel URL', 'niknote-jj0o4ph9t-nikhil-s-projects-2fbdabcf.vercel.app'],
    ['Deployed app commit', 'e34ffa4 - feat: add creative playground and complete brand audit'],
    ['Source branch', 'arena/fa802f8f-niknote'],
    ['Progress record', 'd41cfdb - docs: record production deployment'],
  ];
  details.forEach((entry, index) => {
    const top = 365 + index * 34;
    if (index % 2 === 0) rect(page, 42, top - 4, 510, 30, C.white);
    text(page, entry[0].toUpperCase(), 54, top + 3, 6.4, F.bold, C.muted);
    paragraph(page, entry[1], 170, top + 2, 365, { size: 7.3, leading: 9, font: index === 0 ? F.bold : F.reg, color: C.ink });
  });

  text(page, 'CHANGE / RELEASE TIMELINE', 43, 558, 8, F.bold, C.blue);
  line(page, 79, 607, 516, 607, C.border, 2.2);
  const timeline = [
    { x: 83, title: 'BASELINE', id: '0bdcea0', note: 'Brand identity commit', fill: C.blue },
    { x: 224, title: 'APP CHANGE', id: 'e34ffa4', note: 'Playground + audit', fill: C.rose },
    { x: 365, title: 'PRODUCTION', id: 'dpl_PmYx...DNa', note: 'READY / PROMOTED', fill: C.green },
    { x: 506, title: 'DOC UPDATE', id: 'd41cfdb', note: 'Deploy record pushed', fill: C.blue },
  ];
  timeline.forEach((item, index) => {
    rect(page, item.x - 5, 602, 10, 10, item.fill);
    const lx = Math.max(45, Math.min(item.x - 50, W - 140));
    text(page, item.title, lx, 622, 6.2, F.bold, item.fill);
    text(page, item.id, lx, 635, 7.1, F.bold, C.ink);
    paragraph(page, item.note, lx, 649, 94, { size: 6.3, leading: 8, color: C.muted });
  });

  card(page, 42, 685, 510, 92, { fill: C.bluePale, border: C.bluePale, accent: C.blue });
  text(page, 'SCOPE BOUNDARY', 59, 699, 7.2, F.bold, C.blue);
  paragraph(page, 'No Supabase schema, database, secrets or Vercel environment settings were changed. Playground data is localStorage on the current browser / device. Production is already live; the later d41cfdb change only records the deployment in project documentation.', 59, 718, 470, { size: 7.9, leading: 10.6, color: C.text });
}

// PAGE 6 - what remains and recommendations
{
  const page = sectionPage(pdf, '05  /  NEXT ACTIONS', 'What is still left?', 'No known release-blocking code item is open. The main gap is a real human responsive visual pass.', 6);
  card(page, 42, 153, 510, 65, { fill: C.coralPale, border: C.coralPale, accent: C.rose });
  text(page, 'OPEN ITEM', 59, 167, 7, F.bold, C.rose);
  text(page, 'Human visual QA on the deployed pages', 59, 183, 13, F.bold, C.ink);
  text(page, 'Screenshot automation failed in this sandbox: missing libnspr4.so.', 59, 202, 7.7, F.reg, C.text);

  const actionRows = [
    {
      top: 235,
      tag: 'NOW',
      fill: C.coralPale,
      accent: C.rose,
      title: '1. Check the live experience on real viewport sizes',
      body: 'Open www.niknote.online/playground at desktop, tablet and phone widths. Confirm no clipped canvas, hidden controls, horizontal scroll, or overlap with mobile chrome.',
    },
    {
      top: 337,
      tag: 'NOW',
      fill: C.bluePale,
      accent: C.blue,
      title: '2. Walk through the main Playground flows',
      body: 'Create and edit each piece type; drag and keyboard-move items; change paper; reload to confirm local save; export SVG; verify the reduced-motion setting. Tests cover key paths, but a human pass checks the real browser feel.',
    },
    {
      top: 439,
      tag: 'OPTIONAL',
      fill: C.yellowPale,
      accent: C.ink,
      title: '3. Triage existing lint and build warnings',
      body: 'The wider changed-file lint pass shows 25 legacy diagnostics. Separately, update stale Browserslist data, review mixed imports and consider splitting oversized chunks. These warnings did not block the successful build or deployment.',
    },
  ];
  actionRows.forEach((row) => {
    card(page, 42, row.top, 510, 88, { fill: C.white, border: C.border, accent: row.accent });
    pill(page, row.tag, 59, row.top + 12, row.fill, row.accent, { height: 17, size: 6.5, padX: 7 });
    text(page, row.title, 146, row.top + 12, 8.5, F.bold, C.ink);
    paragraph(page, row.body, 59, row.top + 38, 470, { size: 7.5, leading: 10, color: C.text });
  });

  text(page, 'HUMAN QA CHECKLIST', 43, 550, 8, F.bold, C.blue);
  const qa = [
    'Mobile 390 px: safe areas, touch controls, scroll and bottom navigation',
    'Tablet / desktop: canvas sizing, toolbar placement and responsive side panels',
    'Keyboard: focus order, selection, arrow movement and escape behavior',
    'Persistence: saved board survives refresh; malformed local data fails safely',
    'Export: SVG opens and contains the expected notes / text',
    'Motion: reduced-motion preference suppresses nonessential transitions',
  ];
  qa.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = col === 0 ? 45 : 302;
    const top = 573 + row * 37;
    rect(page, x, top + 2, 11, 11, C.white, C.blue, 0.8);
    paragraph(page, item, x + 18, top, 232, { size: 7.1, leading: 9.2, color: C.text });
  });

  card(page, 42, 697, 510, 80, { fill: C.navy, border: C.navy });
  text(page, 'FINAL READOUT', 59, 710, 7.2, F.bold, C.yellow);
  paragraph(page, 'Implemented + verified + deployed. Remaining: visual sign-off and optional maintenance cleanup. One product boundary to remember: Playground boards are device-local and do not sync across devices.', 59, 729, 470, { size: 8, leading: 11.2, color: C.white });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, await pdf.save({ useObjectStreams: true }));
console.log(`Created ${OUT}`);
console.log(`Pages: ${pdf.getPageCount()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
