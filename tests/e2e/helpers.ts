import { expect, type Page } from '@playwright/test';

export const NNBSP = / /g;

/** Opens the workspace. A bare visit would show the landing page, so these tests skip the intro. */
export async function open(page: Page, query = ''): Promise<void> {
  if (!query) await page.addInitScript(() => window.localStorage.setItem('unitscope.skipIntro', '1'));
  await page.goto(query ? `./${query}` : './');
  await expect(page.getByTestId('value-input')).toBeVisible();
  await bootDone(page);
}

/** Waits until the boot screen has left the page. */
export async function bootDone(page: Page): Promise<void> {
  await expect(page.locator('#boot')).toHaveCount(0, { timeout: 10_000 });
}

export async function pickQuantity(page: Page, name: string | RegExp): Promise<void> {
  await page.getByRole('navigation', { name: 'Quantities' }).getByRole('button', { name }).click();
}

export async function setValue(page: Page, text: string): Promise<void> {
  await page.getByTestId('value-input').fill(text);
}

export async function resultText(page: Page): Promise<string> {
  return ((await page.getByTestId('result-value').textContent()) ?? '').replace(NNBSP, ' ');
}

export async function summary(page: Page): Promise<string> {
  return ((await page.locator('figure figcaption').first().textContent()) ?? '').replace(NNBSP, ' ');
}

/** WCAG relative-luminance contrast between two CSS rgb() colors. */
export function contrast(a: string, b: string): number {
  const lum = (c: string) => {
    const m = c.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const [r, g, bl] = m.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
