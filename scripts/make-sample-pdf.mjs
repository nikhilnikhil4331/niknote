// Generates public/sample.pdf — a small multi-size document used by the
// PDF Editor empty state ("Try the sample") and manual QA.
// Run: node scripts/make-sample-pdf.mjs
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { writeFileSync } from 'node:fs';

const doc = await PDFDocument.create();
const sans = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const ink = rgb(0.13, 0.12, 0.2);
const muted = rgb(0.45, 0.44, 0.55);
const accent = rgb(0.486, 0.227, 0.929);

function lines(page, items, x, y, gap = 22) {
  let cursor = y;
  for (const [text, size, font, color] of items) {
    page.drawText(text, { x, y: cursor, size, font: font || sans, color: color || ink });
    cursor -= gap;
  }
  return cursor;
}

// Page 1 — portrait A4, text-heavy (search target: "photosynthesis")
{
  const page = doc.addPage([595.28, 841.89]);
  page.drawRectangle({ x: 0, y: 841.89 - 84, width: 595.28, height: 84, color: accent });
  page.drawText('NikNote Sample Document', { x: 48, y: 841.89 - 52, size: 22, font: bold, color: rgb(1, 1, 1) });
  let y = lines(page, [
    ['Chapter 1 - Life Processes', 16, bold],
    ['Photosynthesis is the process by which green plants make food.', 12],
    ['It needs sunlight, carbon dioxide, water and chlorophyll.', 12],
    ['The overall equation releases oxygen as a by-product.', 12],
    ['', 12],
    ['Try these in the NikNote PDF Editor:', 13, bold],
    ['1. Highlight the word photosynthesis above.', 12],
    ['2. Underline a sentence with the pen tool.', 12],
    ['3. Add a text note anywhere on this page.', 12],
    ['4. Sign on the dotted line at the bottom.', 12],
    ['5. Search for the word quadratic - it lives on page 4.', 12],
  ], 48, 700);
  page.drawText('Signature:', { x: 48, y: y - 40, size: 12, font: bold, color: ink });
  page.drawLine({ start: { x: 130, y: y - 40 }, end: { x: 360, y: y - 40 }, thickness: 1, color: muted, dashArray: [4, 4] });
  page.drawText('Page 1 of 5 - A4 portrait', { x: 48, y: 36, size: 9, font: sans, color: muted });
}

// Page 2 — shapes to annotate around
{
  const page = doc.addPage([595.28, 841.89]);
  let y = lines(page, [
    ['Chapter 2 - Diagrams', 16, bold],
    ['Draw arrows between the boxes, circle the ellipse, tick the star box.', 12],
  ], 48, 760);
  page.drawRectangle({ x: 48, y: y - 160, width: 150, height: 90, borderColor: accent, borderWidth: 2 });
  page.drawText('Input', { x: 95, y: y - 122, size: 13, font: bold, color: ink });
  page.drawRectangle({ x: 340, y: y - 160, width: 150, height: 90, borderColor: accent, borderWidth: 2 });
  page.drawText('Output', { x: 382, y: y - 122, size: 13, font: bold, color: ink });
  page.drawEllipse({ x: 270, y: y - 280, xScale: 110, yScale: 52, borderColor: muted, borderWidth: 1.5 });
  page.drawText('process', { x: 238, y: y - 285, size: 12, font: sans, color: ink });
  page.drawRectangle({ x: 48, y: 220, width: 26, height: 26, borderColor: ink, borderWidth: 1.5 });
  page.drawText('Put a tick in the box', { x: 86, y: 228, size: 12, font: sans, color: ink });
  page.drawText('Page 2 of 5 - A4 portrait', { x: 48, y: 36, size: 9, font: sans, color: muted });
}

// Page 3 — landscape Letter (rotation/size handling)
{
  const page = doc.addPage([792, 612]);
  lines(page, [
    ['Wide timetable page (Letter, landscape)', 16, bold],
    ['Mon        Tue         Wed        Thu         Fri', 12, bold],
    ['Maths      English     Science    Maths       Hindi', 12],
    ['English    Maths       Hindi      Science     Maths', 12],
    ['Science    Hindi       Maths      English     Games', 12],
  ], 48, 540);
  for (let r = 0; r < 4; r++) {
    page.drawLine({ start: { x: 48, y: 505 - r * 22 }, end: { x: 560, y: 505 - r * 22 }, thickness: 0.6, color: muted });
  }
  page.drawText('Page 3 of 5 - Letter landscape. Rotate me from the Pages panel!', { x: 48, y: 36, size: 9, font: sans, color: muted });
}

// Page 4 — maths text (search target: "quadratic")
{
  const page = doc.addPage([595.28, 841.89]);
  page.setRotation(degrees(0));
  lines(page, [
    ['Chapter 4 - Quadratic Equations', 16, bold],
    ['A quadratic equation has the form ax2 + bx + c = 0.', 12],
    ['The quadratic formula gives both roots directly.', 12],
    ['Discriminant D = b2 - 4ac decides the nature of roots.', 12],
    ['If D > 0, the quadratic has two distinct real roots.', 12],
    ['If D = 0, both roots are equal. If D < 0, no real roots.', 12],
    ['', 12],
    ['Practice: solve 2x2 - 7x + 3 = 0 in the space below.', 12],
  ], 48, 760);
  page.drawText('Page 4 of 5 - A4 portrait', { x: 48, y: 36, size: 9, font: sans, color: muted });
}

// Page 5 — blank-ish practice page
{
  const page = doc.addPage([595.28, 841.89]);
  page.drawText('Practice page - this space is yours', { x: 48, y: 780, size: 14, font: bold, color: muted });
  page.drawText('Write, draw, stamp a star when you finish.', { x: 48, y: 756, size: 11, font: sans, color: muted });
  page.drawText('Page 5 of 5 - A4 portrait', { x: 48, y: 36, size: 9, font: sans, color: muted });
}

doc.setTitle('NikNote Sample Document');
doc.setProducer('NikNote');
writeFileSync(new URL('../public/sample.pdf', import.meta.url), await doc.save());
console.log('public/sample.pdf written');
