import { expect, test } from '@playwright/test';
import { open, pickQuantity, resultText, setValue, summary } from './helpers';

test.describe('specification acceptance cases through the UI', () => {
  test('1 V = 1000 mV, and 1 V / 1000 mV / 1 000 000 µV draw the identical figure', async ({ page }) => {
    await open(page);
    await setValue(page, '1');
    await page.getByTestId('from-unit').selectOption('V');
    await page.getByTestId('to-unit').selectOption('mV');
    await expect(page.getByTestId('result-value')).toHaveText('1000');
    const figure = page.locator('figure').first();
    const a = await figure.innerHTML();

    await setValue(page, '1000 mV');
    await expect(page.getByTestId('from-unit')).toHaveValue('mV');
    const b = await figure.innerHTML();
    await setValue(page, '1000000');
    await page.getByTestId('from-unit').selectOption('uV');
    const c = await figure.innerHTML();
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  test('1 V → 10 V updates graph, current and power together on a shared scale', async ({ page }) => {
    await open(page);
    await setValue(page, '1');
    await page.getByTestId('from-unit').selectOption('V');
    await expect(page.locator('figure')).toContainText('I = V / R = 1 mA');
    await expect(page.locator('figure')).toContainText('P = V² / R = 1 mW');
    const vBar = page.locator('[data-group="V"] .bar-current rect');
    const iBar = page.locator('[data-group="I"] .bar-current rect');
    const v1 = Number(await vBar.getAttribute('height'));
    const i1 = Number(await iBar.getAttribute('height'));
    await expect(page.locator('.scale-controls').first()).toContainText('Visible range 0 … 20 V');

    await setValue(page, '10');
    await expect(page.locator('figure')).toContainText('I = V / R = 10 mA');
    await expect(page.locator('figure')).toContainText('P = V² / R = 100 mW');
    await expect(page.locator('.scale-controls').first()).toContainText('Visible range 0 … 20 V');
    expect(Number(await vBar.getAttribute('height')) / v1).toBeCloseTo(10, 3);
    expect(Number(await iBar.getAttribute('height')) / i1).toBeCloseTo(10, 3);
  });

  test('4.7 kΩ = 4700 Ω', async ({ page }) => {
    await open(page);
    await pickQuantity(page, /Resistance/);
    await setValue(page, '4.7');
    await page.getByTestId('from-unit').selectOption('kohm');
    await page.getByTestId('to-unit').selectOption('ohm');
    await expect(page.getByTestId('result-value')).toHaveText('4700');
  });

  test('100 nF = 0.1 µF (typed with the alias "nF")', async ({ page }) => {
    await open(page);
    await pickQuantity(page, /Capacitance/);
    await setValue(page, '100 nF');
    await page.getByTestId('to-unit').selectOption('uF');
    await expect(page.getByTestId('result-value')).toHaveText('0.1');
    await expect(page.locator('.result-unit')).toHaveText('µF');
  });

  test('2.5 mH = 2500 µH', async ({ page }) => {
    await open(page);
    await pickQuantity(page, /Inductance/);
    await setValue(page, '2.5');
    await page.getByTestId('from-unit').selectOption('mH');
    await page.getByTestId('to-unit').selectOption('uH');
    await expect(page.getByTestId('result-value')).toHaveText('2500');
  });

  test('1 MHz corresponds to a period of 1 µs', async ({ page }) => {
    await open(page);
    await pickQuantity(page, /Frequency/);
    await setValue(page, '1 MHz');
    expect(await summary(page)).toContain('T = 1 / f = 1 µs');
  });

  test('1 mW = 0 dBm and 1 W = 30 dBm', async ({ page }) => {
    await open(page);
    await pickQuantity(page, /Power/);
    const calcs = page.locator('.calcs');
    await calcs.getByLabel('Power P', { exact: true }).fill('1 mW');
    await expect(calcs.locator('.calc-out').first()).toContainText('0 dBm');
    await calcs.getByLabel('Power P', { exact: true }).fill('1 W');
    await expect(calcs.locator('.calc-out').first()).toContainText('30 dBm');
    await expect(calcs.locator('.calc-out').first()).toContainText('0 dBW');
  });

  test('a 1 Vrms sine has approximately 1.414213562 Vpk', async ({ page }) => {
    await open(page);
    await setValue(page, '1');
    await page.getByTestId('from-unit').selectOption('V');
    await page.getByText('AC (sine)').click();
    expect(await summary(page)).toContain('Vpk = √2 × Vrms = 1.414213562 V');
  });

  test('R = 1 kΩ and C = 100 µF give τ = 0.1 s', async ({ page }) => {
    await open(page);
    await pickQuantity(page, /Capacitance/);
    await setValue(page, '100 uF');
    expect(await summary(page)).toContain('τ = R × C = 1 kΩ × 100 µF = 100 ms');
    await expect(page.locator('.readouts')).toContainText('100 ms');
  });

  test('uF alias is displayed as µF, and mHz is rejected with an MHz suggestion', async ({ page }) => {
    await open(page);
    await pickQuantity(page, /Frequency/);
    await setValue(page, '10 mhz');
    await expect(page.locator('.result .error')).toContainText('case-sensitive');
    await page.getByRole('button', { name: 'Use MHz' }).click();
    await expect(page.getByTestId('value-input')).toHaveValue('10 MHz');
    expect(await resultText(page)).toBe('10 000');
  });
});
