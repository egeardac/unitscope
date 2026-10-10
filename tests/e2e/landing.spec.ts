import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { bootDone } from './helpers';

test.describe('intro and landing page', () => {
  test('a bare visit plays the intro, lands on the landing page, and the call to action opens the workspace', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#boot')).toBeVisible();
    await bootDone(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Convert a unit.');
    await expect(page.locator('.landing-logo')).toBeVisible();
    await expect(page.getByRole('button', { name: /Open Unitscope/ })).toHaveCount(1);
    await page.getByRole('button', { name: /Open Unitscope/ }).click();
    await expect(page.getByTestId('value-input')).toBeFocused();
  });

  test('shared links skip the landing page', async ({ page }) => {
    await page.goto('./?q=capacitance&v=100&from=uF&to=nF');
    await expect(page.getByTestId('value-input')).toHaveValue('100');
    await bootDone(page);
    await expect(page.locator('.landing')).toHaveCount(0);
  });

  test('a reload after opening the workspace stays in the workspace', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    await bootDone(page);
    await page.getByRole('button', { name: /Open Unitscope/ }).click();
    await page.getByTestId('value-input').fill('4.7');
    await expect(page).toHaveURL(/[?&]q=/);
    await page.reload();
    await expect(page.getByTestId('value-input')).toHaveValue('4.7');
  });

  test('reduced motion: no intro animation and a still scope', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    await bootDone(page);
    await expect(page.locator('.landing-badge')).toHaveText('Paused');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`axe finds no WCAG A/AA violations on the landing page (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto('./');
      await bootDone(page);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`)).toEqual([]);
    });
  }
});
