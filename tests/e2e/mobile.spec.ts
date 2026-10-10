import { expect, test } from '@playwright/test';
import { open, setValue } from './helpers';

test.describe('mobile layout (375 × 812)', () => {
  test('order: quantity → value and units → result → visualization → model parameters', async ({ page }) => {
    await open(page);
    const y = async (sel: string) => (await page.locator(sel).first().boundingBox())!.y;
    const rail = await y('.rail');
    const value = await y('[data-testid="value-input"]');
    const result = await y('[data-testid="result"]');
    const viz = await y('figure');
    const params = await y('.view-params');
    expect(rail).toBeLessThan(value);
    expect(value).toBeLessThan(result);
    expect(result).toBeLessThan(viz);
    expect(viz).toBeLessThan(params);
  });

  test('no horizontal page overflow on any quantity', async ({ page }) => {
    await open(page);
    const chips = page.getByRole('navigation', { name: 'Quantities' }).getByRole('button');
    const n = await chips.count();
    expect(n).toBe(11);
    for (let i = 0; i < n; i++) {
      await chips.nth(i).click();
      const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      expect(sw, `quantity #${i}`).toBeLessThanOrEqual(iw);
    }
    await chips.first().click();
    await page.getByText('AC (sine)').click();
    const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
    expect(sw).toBeLessThanOrEqual(iw);
  });

  test('touch inspection shows exact values on the graph', async ({ page }) => {
    await open(page, '?q=capacitance&v=100&from=uF&to=nF');
    const plot = page.locator('.plot svg').first();
    await plot.scrollIntoViewIfNeeded();
    const box = (await plot.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width * 0.4, box.y + box.height * 0.5);
    await expect(page.locator('.plot-tip')).toContainText('Vc(t)');
  });

  test('controls are comfortably sized for touch', async ({ page }) => {
    await open(page);
    await setValue(page, '5');
    const sizes = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.converter button, .converter select, .converter input[type="text"], .view-params button, .view-params select')]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ h: el.getBoundingClientRect().height, w: el.getBoundingClientRect().width, t: el.textContent?.trim() || el.getAttribute('aria-label') || el.tagName })),
    );
    for (const s of sizes) {
      expect(s.h, `${s.t} height`).toBeGreaterThanOrEqual(24);
      expect(s.w, `${s.t} width`).toBeGreaterThanOrEqual(24);
    }
  });
});
