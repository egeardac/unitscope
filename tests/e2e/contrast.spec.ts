import { expect, test } from '@playwright/test';

/**
 * axe cannot decide text contrast over the page's background gradient and
 * translucent glass panels (it reports them as "incomplete"). This test
 * composites every text element's translucent ancestor backgrounds over the
 * WORST-CASE page background (plain pearl gray, and each decorative blob at
 * full strength) and requires WCAG 2.2 AA: 4.5:1, or 3:1 for large text.
 */
const PAGES = [
  '?intro',
  '?q=voltage',
  '?q=voltage&mode=ac&v=230&from=V&to=mV',
  '?q=capacitance&v=100&from=uF&to=nF',
  '?q=inductance&v=2.5&from=mH&to=uH',
  '?q=frequency&v=1&from=MHz&to=kHz',
  '?q=energy',
  '?q=charge',
  '?q=pcb',
  '?q=resistance&v=4.7&from=kohm&to=ohm',
  '?q=voltage&v=1,000&from=V&to=mV',
];

for (const scheme of ['light', 'dark'] as const) {
  test(`text contrast meets WCAG AA over worst-case glass backgrounds (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    const failures: string[] = [];
    let checked = 0;
    for (const q of PAGES) {
      await page.goto(`./${q}`);
      await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10_000 });
      await page.waitForTimeout(250);
      const r = await page.evaluate(() => {
        type RGBA = [number, number, number, number];
        const parse = (c: string): RGBA | null => {
          const m = c.match(/rgba?\(([^)]+)\)/);
          if (!m) return null;
          const p = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
          return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
        };
        const over = (top: RGBA, bottom: RGBA): RGBA => {
          const a = top[3];
          return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
        };
        const lum = (c: RGBA) => {
          const f = (v: number) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
        };
        const ratio = (a: RGBA, b: RGBA) => {
          const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
          return (x + 0.05) / (y + 0.05);
        };
        const root = getComputedStyle(document.documentElement);
        const bg = parse(getComputedStyle(document.body).backgroundColor)!;
        const blob = (name: string) => {
          const c = root.getPropertyValue(name).trim();
          const d = document.createElement('div');
          d.style.color = c;
          document.body.appendChild(d);
          const v = parse(getComputedStyle(d).color)!;
          d.remove();
          return over(v, bg);
        };
        const bases: RGBA[] = [bg, blob('--bg-lav'), blob('--bg-mint')];
        const out: { checked: number; fails: string[] } = { checked: 0, fails: [] };
        const all = document.querySelectorAll<HTMLElement | SVGElement>('body *');
        for (const el of all) {
          const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);
          if (!hasText) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) continue;
          if (el.closest('.sr-only, [aria-hidden="true"]:not(.plot-tip), option, dialog:not([open]), details:not([open]) > :not(summary), :disabled')) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          // Skip disabled-looking controls (WCAG exempts inactive components).
          let op = 1;
          for (let n: Element | null = el; n; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
          if (op < 0.99) continue;
          const isSvg = el instanceof SVGElement;
          const fg = parse(isSvg ? cs.fill : cs.color);
          if (!fg) continue;
          const layers: RGBA[] = [];
          for (let n: Element | null = isSvg ? el.closest('div') : el; n && n !== document.body; n = n.parentElement) {
            const b = parse(getComputedStyle(n).backgroundColor);
            if (b && b[3] > 0) layers.push(b);
          }
          let worst = Infinity;
          for (const base of bases) {
            let c = base;
            for (let i = layers.length - 1; i >= 0; i--) c = over(layers[i]!, c);
            worst = Math.min(worst, ratio(over(fg, c), c));
          }
          const size = parseFloat(cs.fontSize);
          const bold = Number(cs.fontWeight) >= 700;
          const large = size >= 24 || (bold && size >= 18.66);
          const need = large ? 3 : 4.5;
          out.checked++;
          if (worst < need) {
            const name = `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').split(' ')[0]} “${(el.textContent ?? '').trim().slice(0, 40)}”`;
            out.fails.push(`${name}: ${worst.toFixed(2)} < ${need}`);
          }
        }
        return out;
      });
      checked += r.checked;
      failures.push(...r.fails.map((f) => `[${q || 'home'}] ${f}`));
    }
    console.log(`${scheme}: checked ${checked} text elements`);
    expect(checked).toBeGreaterThan(500);
    expect([...new Set(failures)]).toEqual([]);
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`input boundaries reach 3:1 against their surroundings (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('./?q=capacitance&v=100&from=uF&to=nF');
    const fails = await page.evaluate(() => {
      type RGBA = [number, number, number, number];
      const parse = (c: string): RGBA | null => {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const p = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
        return [p[0]!, p[1]!, p[2]!, p[3] ?? 1];
      };
      const over = (t: RGBA, b: RGBA): RGBA => [t[0] * t[3] + b[0] * (1 - t[3]), t[1] * t[3] + b[1] * (1 - t[3]), t[2] * t[3] + b[2] * (1 - t[3]), 1];
      const lum = (c: RGBA) => {
        const f = (v: number) => ((v / 255) <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
      };
      const ratio = (a: RGBA, b: RGBA) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
        return (x + 0.05) / (y + 0.05);
      };
      const bg = parse(getComputedStyle(document.body).backgroundColor)!;
      const root = getComputedStyle(document.documentElement);
      const tint = (name: string) => {
        const d = document.createElement('div');
        d.style.color = root.getPropertyValue(name).trim();
        document.body.appendChild(d);
        const v = parse(getComputedStyle(d).color)!;
        d.remove();
        return over(v, bg);
      };
      const bases = [bg, tint('--bg-lav'), tint('--bg-mint')];
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('.field, .seg')) {
        const border = parse(getComputedStyle(el).borderTopColor);
        if (!border) continue;
        const layers: RGBA[] = [];
        for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
          const b = parse(getComputedStyle(n).backgroundColor);
          if (b && b[3] > 0) layers.push(b);
        }
        for (const base of bases) {
          let c = base;
          for (let i = layers.length - 1; i >= 0; i--) c = over(layers[i]!, c);
          const r = ratio(over(border, c), c);
          if (r < 3) out.push(`${el.className} ${r.toFixed(2)}`);
        }
      }
      return [...new Set(out)];
    });
    expect(fails).toEqual([]);
  });
}
