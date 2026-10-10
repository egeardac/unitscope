import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { contrast, open, pickQuantity, resultText, setValue } from './helpers';

test.describe('core journeys', () => {
  test('copy puts the result with its unit on the clipboard', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page);
    await setValue(page, '1');
    await page.getByTestId('from-unit').selectOption('V');
    await page.getByTestId('to-unit').selectOption('mV');
    await page.getByTestId('copy').click();
    await expect(page.locator('.toast-region')).toContainText('Copied “1000 mV”');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('1000 mV');
  });

  test('a shared link restores quantity, units, value, model parameters, reference and scale', async ({ page, context, browser }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page);
    await pickQuantity(page, /Capacitance/);
    await setValue(page, '4,7');
    await page.getByTestId('from-unit').selectOption('uF');
    await page.getByTestId('to-unit').selectOption('nF');
    const params = page.locator('.view-params');
    await params.getByLabel('Series resistance R', { exact: true }).fill('2.2');
    await params.getByLabel('Series resistance unit').selectOption('kohm');
    await page.getByRole('button', { name: 'Pin current as reference' }).click();
    await params.getByLabel('Initial capacitor voltage V0', { exact: true }).fill('-1');
    await page.getByTestId('share').click();
    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(url).toMatch(/^http:\/\/localhost:4173\/unitscope\/\?/);

    const fresh = await browser.newContext();
    const p2 = await fresh.newPage();
    await p2.goto(url);
    await expect(p2.getByTestId('value-input')).toHaveValue('4,7');
    await expect(p2.getByTestId('from-unit')).toHaveValue('uF');
    await expect(p2.getByTestId('to-unit')).toHaveValue('nF');
    expect(await resultText(p2)).toBe('4700');
    const params2 = p2.locator('.view-params');
    await expect(params2.getByLabel('Series resistance R', { exact: true })).toHaveValue('2.2');
    await expect(params2.getByLabel('Series resistance unit')).toHaveValue('kohm');
    await expect(params2.getByLabel('Initial capacitor voltage V0', { exact: true })).toHaveValue('-1');
    await expect(p2.getByRole('button', { name: 'Clear reference' })).toBeVisible();
    await expect(p2.locator('figure')).toContainText('τ = R × C = 2.2 kΩ × 4.7 µF = 10.34 ms');
    await expect(p2.locator('.toast-region')).toContainText('Restored the shared values');
    await fresh.close();
  });

  test('invalid link parameters are reported, not silently used', async ({ page }) => {
    await page.goto('./?q=voltage&v=1&from=mA&to=mV&sf=99');
    await expect(page.locator('.toast-region')).toContainText('invalid and were reset: from, sf');
    await expect(page.getByTestId('from-unit')).toHaveValue('V');
  });

  test('keyboard only: search, select, type, swap, slider and graph inspection', async ({ page }) => {
    await open(page);
    await page.locator('body').press('/');
    await expect(page.locator('#q-search')).toBeFocused();
    await page.keyboard.type('uF');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Convert capacitance' })).toBeVisible();

    const tabTo = async (predicate: string, max = 80) => {
      for (let i = 0; i < max; i++) {
        await page.keyboard.press('Tab');
        if (await page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, predicate)) return;
      }
      throw new Error(`could not reach ${predicate} with Tab`);
    };
    await tabTo('[data-testid="value-input"]');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('47');
    await tabTo('[data-testid="swap"]');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('from-unit')).toHaveValue('uF');
    await expect(page.getByTestId('value-input')).toHaveValue('0.047');

    await tabTo('input[aria-label="Series resistance slider"]');
    const before = await page.locator('.view-params').getByLabel('Series resistance R', { exact: true }).inputValue();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const after = await page.locator('.view-params').getByLabel('Series resistance R', { exact: true }).inputValue();
    expect(after).not.toBe(before);

    await page.locator('.plot').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.plot-tip')).toBeVisible();
    await expect(page.locator('.plot-tip')).toContainText('Time =');
  });

  test('ambiguous numbers and wrong-quantity units are explained with one-click fixes', async ({ page }) => {
    await open(page);
    await page.getByTestId('from-unit').selectOption('V');
    await setValue(page, '1,000');
    await expect(page.locator('.result .error')).toContainText('ambiguous');
    await page.getByRole('button', { name: 'Use 1.000' }).click();
    await expect(page.getByTestId('result-value')).toHaveText('1000');

    await setValue(page, '5 mA');
    await expect(page.locator('.result .error')).toContainText('unit of current');
    await page.getByRole('button', { name: 'Switch to Current' }).click();
    await expect(page.getByRole('heading', { name: 'Convert current' })).toBeVisible();
    await expect(page.locator('figure')).toContainText('I = 5 mA');

    await setValue(page, '');
    await expect(page.locator('.result')).toContainText('Enter a value.');
    await expect(page.locator('figure')).toHaveCount(0);
  });

  test('dBm rejects negative power and explains −∞ for 0 W; voltage → dBm needs a load', async ({ page }) => {
    await open(page);
    await pickQuantity(page, /Power/);
    const calcs = page.locator('.calcs');
    await calcs.getByLabel('Power P', { exact: true }).fill('-1 W');
    await expect(calcs).toContainText('defined only for positive power');
    await calcs.getByLabel('Power P', { exact: true }).fill('0');
    await expect(calcs).toContainText('−∞ dBm');
    await calcs.getByLabel('RMS voltage Vrms', { exact: true }).fill('1');
    await expect(calcs).toContainText('no 50 Ω (or other) load is assumed');
    await calcs.getByRole('button', { name: 'Use 50 Ω' }).click();
    await expect(calcs.locator('.calc-out').last()).toContainText('13.0103 dBm');
  });

  test('Ah → Wh requires a nominal voltage and is labelled an approximation', async ({ page }) => {
    await open(page);
    await pickQuantity(page, /Electric charge/);
    const calcs = page.locator('.calcs');
    await calcs.getByLabel('Charge Q', { exact: true }).fill('2000 mAh');
    await expect(calcs).toContainText('No voltage is assumed');
    await calcs.getByLabel('Nominal voltage Vnom (required)', { exact: true }).fill('3.7');
    await expect(calcs.locator('.calc-out')).toContainText('7.4 Wh');
    await expect(calcs).toContainText('Approximation based on the nominal voltage');
  });

  test('manual scale keeps its range and flags values outside it', async ({ page }) => {
    await open(page);
    await page.getByTestId('from-unit').selectOption('V');
    await setValue(page, '1');
    await page.getByText('Manual', { exact: true }).click();
    await setValue(page, '45');
    await expect(page.locator('.scale-controls').first()).toContainText('Visible range 0 … 20 V');
    await expect(page.locator('[data-group="V"] text.offscale')).toHaveText('▲');
    await page.getByRole('button', { name: 'Fit to values' }).click();
    await expect(page.locator('.scale-controls').first()).toContainText('Visible range 0 … 50 V');
  });

  test('theme and recent conversions persist across reloads', async ({ page }) => {
    await open(page);
    await page.getByText('Display', { exact: true }).click();
    await page.getByLabel('Dark').check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByTestId('from-unit').selectOption('V');
    await setValue(page, '3.3');
    await page.waitForTimeout(1900);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.recent-desktop')).toContainText('3.3 V → 3300 mV');
  });

  test('playback runs, pauses and restarts; the playhead moves only while playing', async ({ page }) => {
    await open(page, '?q=capacitance&v=100&from=uF&to=nF');
    const head = page.getByTestId('playhead');
    await expect(head).toHaveCount(1);
    const x1 = await head.getAttribute('x1');
    await page.waitForTimeout(400);
    expect(await head.getAttribute('x1')).not.toBe(x1);
    await page.getByRole('button', { name: 'Pause' }).click();
    const p1 = await head.getAttribute('x1');
    await page.waitForTimeout(400);
    expect(await head.getAttribute('x1')).toBe(p1);
    await expect(page.locator('.playback').first()).toContainText('Slow motion');
  });

  test('MHz signals are slowed and labelled, and too many cycles show an envelope', async ({ page }) => {
    await open(page, '?q=frequency&v=1&from=MHz&to=kHz');
    await expect(page.locator('.playback')).toContainText('slower than real time');
    await page.getByLabel('Time window length').fill('1 ms');
    await page.getByLabel('Time window length').press('Enter');
    await expect(page.locator('figure')).toContainText('too many to draw individually');
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('continuous animation is disabled and explained', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('button', { name: 'Play' })).toBeDisabled();
    await expect(page.locator('.playback').first()).toContainText('reduced motion');
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await open(page, '?q=capacitance&v=100&from=uF&to=nF');
    await expect(page.getByTestId('playhead')).toHaveCount(0);
  });
});

test.describe('accessibility and contrast', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`axe finds no WCAG A/AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      for (const q of ['', '?q=capacitance&v=100&from=uF&to=nF', '?q=voltage&mode=ac&v=230&from=V&to=mV', '?q=pcb', '?q=power']) {
        await open(page, q);
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`);
        expect(summary, `violations on "${q || 'home'}"`).toEqual([]);
      }
    });

    test(`graph lines and markings reach 3:1 against the plot (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, '?q=capacitance&v=100&from=uF&to=nF');
      await page.getByRole('button', { name: 'Pin current as reference' }).click();
      const colors = await page.evaluate(() => {
        const bg = getComputedStyle(document.querySelector('.plot-area')!).fill;
        const get = (sel: string) => getComputedStyle(document.querySelector(sel)!).stroke;
        return {
          bg,
          primary: get('.trace.tone-primary'),
          reference: get('.trace.tone-reference'),
          axis: get('.axis'),
          accent: get('.guide.tone-accent line'),
          playhead: get('.playhead'),
        };
      });
      for (const [name, c] of Object.entries(colors)) {
        if (name === 'bg') continue;
        expect(contrast(c, colors.bg), `${name} ${c} on ${colors.bg}`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

test.describe('search, guide and hosting', () => {
  test('search finds quantities by unit alias and carries "100 uF" into the converter', async ({ page }) => {
    await open(page);
    await page.locator('#q-search').fill('dbm');
    await expect(page.locator('#q-list')).toContainText('Power');
    await page.locator('#q-search').fill('100 uF');
    await page.locator('#q-search').press('Enter');
    await expect(page.getByRole('heading', { name: 'Convert capacitance' })).toBeVisible();
    await expect(page.getByTestId('value-input')).toHaveValue('100 uF');
    await expect(page.getByTestId('from-unit')).toHaveValue('uF');
  });

  test('the guide opens as a dialog and closes with Escape', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Guide', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Unitscope guide' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('m = milli (10⁻³), M = mega (10⁶)');
    await expect(dialog.getByRole('link', { name: /NIST SP 811/ })).toHaveAttribute('href', /nist\.gov/);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('assets load with relative URLs under the /unitscope/ project path', async ({ page }) => {
    const failed: string[] = [];
    page.on('requestfailed', (r) => failed.push(r.url()));
    page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
    await open(page);
    const html = await (await page.request.get('./')).text();
    expect(html).toContain('src="./assets/');
    expect(failed).toEqual([]);
  });
});
