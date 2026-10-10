// Capture screenshots of the running app for visual review.
// Usage: node scripts/screenshots.mjs [baseUrl] [outDir]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'test-results/screens';
mkdirSync(out, { recursive: true });

const shots = [
  { name: 'desktop-light-voltage', w: 1440, h: 1000, scheme: 'light', q: '' },
  { name: 'desktop-dark-voltage', w: 1440, h: 1000, scheme: 'dark', q: '' },
  { name: 'desktop-light-ac', w: 1440, h: 1000, scheme: 'light', q: '?q=voltage&v=230&from=V&to=mV&mode=ac' },
  { name: 'desktop-light-rc', w: 1600, h: 1000, scheme: 'light', q: '?q=capacitance&v=100&from=uF&to=nF' },
  { name: 'wide-light-rc', w: 1920, h: 1080, scheme: 'light', q: '?q=capacitance&v=100&from=uF&to=nF' },
  { name: 'tablet-light-power', w: 820, h: 1100, scheme: 'light', q: '?q=power' },
  { name: 'mobile-light-voltage', w: 375, h: 812, scheme: 'light', q: '', full: true },
  { name: 'mobile-dark-pcb', w: 375, h: 812, scheme: 'dark', q: '?q=pcb', full: true },
];

const only = process.env.ONLY;
const browser = await chromium.launch();
for (const s of shots) {
  if (only && !s.name.includes(only)) continue;
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, colorScheme: s.scheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && console.log(`[${s.name}] console error:`, m.text()));
  page.on('pageerror', (e) => console.log(`[${s.name}] page error:`, e.message));
  await page.goto(base + s.q);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${s.name}.png`, fullPage: !!s.full });
  await ctx.close();
  console.log('saved', s.name);
}
await browser.close();
