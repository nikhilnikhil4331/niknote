// Visual QA: screenshot key routes of the live dev server.
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';

const OUT = '/home/user/shots';
fs.mkdirSync(OUT, { recursive: true });

const routes = [
  { path: '/', name: 'home', w: 1600, h: 950 },
  { path: '/focus', name: 'focus', w: 1600, h: 950 },
  { path: '/notebooks', name: 'notebooks', w: 1600, h: 950 },
  { path: '/?editor=1', name: 'editor', w: 1600, h: 950 },
  { path: '/', name: 'home-tablet', w: 1180, h: 950 },
  { path: '/', name: 'home-narrow', w: 900, h: 900 },
];

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  args: [...chromium.args, '--no-sandbox', '--disable-dev-shm-usage'],
  headless: 'shell',
  defaultViewport: null,
});

for (const r of routes) {
  const page = await browser.newPage();
  await page.setViewport({ width: r.w, height: r.h });
  try {
    await page.goto(`http://localhost:5173${r.path}`, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((res) => setTimeout(res, 2600));
    await page.screenshot({ path: `${OUT}/${r.name}.png` });
    const errs = await page.evaluate(() => (window.__errs || []).join('\n'));
    console.log(`✅ ${r.name} ${errs ? ' — console errs: ' + errs : ''}`);
  } catch (e) {
    console.log(`❌ ${r.name}: ${e.message}`);
  }
  await page.close();
}
await browser.close();
console.log('done');
