import { describe, expect, it } from 'vitest';
import { copyText, formatNumber, formatSI } from '../../src/engine/format';

const f = (v: number, sigFigs = 6, notation: 'auto' | 'scientific' | 'engineering' = 'auto', trimZeros = true) =>
  formatNumber(v, { sigFigs, notation, trimZeros });

describe('formatNumber', () => {
  it('plain decimals with trimmed zeros and SI digit grouping', () => {
    expect(f(1000).text).toBe('1000');
    expect(f(4700).text).toBe('4700');
    expect(f(1_000_000).text).toBe('1 000 000');
    expect(f(0.1).text).toBe('0.1');
    expect(f(0.000123456).text).toBe('0.000123456');
    expect(f(1000, 6, 'auto', false).text).toBe('1000.00');
  });

  it('rounds only for display, honouring significant figures', () => {
    expect(f(Math.SQRT2, 4).text).toBe('1.414');
    expect(f(Math.SQRT2, 10).text).toBe('1.414213562');
    expect(f(2 / 3, 3).text).toBe('0.667');
    expect(f(999.96, 4).text).toBe('1000');
  });

  it('uses the typographic minus for display and ASCII for copying', () => {
    expect(f(-1.5).text).toBe('−1.5');
    expect(f(-1.5).plain).toBe('-1.5');
  });

  it('scientific and engineering notation', () => {
    expect(f(4700, 3, 'scientific').text).toBe('4.7 × 10³');
    expect(f(4700, 3, 'scientific').plain).toBe('4.7e3');
    expect(f(0.0047, 3, 'engineering').text).toBe('4.7 × 10⁻³');
    expect(f(47000, 3, 'engineering').text).toBe('47 × 10³');
    expect(f(470000, 3, 'engineering').plain).toBe('470e3');
    expect(f(1e-7, 3, 'engineering').text).toBe('100 × 10⁻⁹');
    expect(f(5, 3, 'engineering').text).toBe('5');
  });

  it('switches to scientific in auto mode for extreme magnitudes', () => {
    expect(f(1.5e15).text).toBe('1.5 × 10¹⁵');
    expect(f(2e-9).text).toBe('2 × 10⁻⁹');
  });
});

describe('formatSI', () => {
  it('chooses a prefix after rounding', () => {
    expect(formatSI(0.001, 'A').text).toBe('1 mA');
    expect(formatSI(0.1, 'W').text).toBe('100 mW');
    expect(formatSI(0.99996, 'A').text).toBe('1 A');
    expect(formatSI(4700, 'Ω').text).toBe('4.7 kΩ');
    expect(formatSI(1e-6, 's').text).toBe('1 µs');
    expect(formatSI(-0.01, 'A').text).toBe('−10 mA');
    expect(formatSI(0, 'V').text).toBe('0 V');
  });
});

describe('copyText', () => {
  it('copies an ASCII number with the correct unit symbol', () => {
    expect(copyText(1000, 'mV', { sigFigs: 6, notation: 'auto', trimZeros: true })).toBe('1000 mV');
    expect(copyText(0.1, 'µF', { sigFigs: 6, notation: 'auto', trimZeros: true })).toBe('0.1 µF');
    expect(copyText(4700, 'Ω', { sigFigs: 3, notation: 'engineering', trimZeros: true })).toBe('4.7e3 Ω');
    expect(copyText(1_000_000, 'µV', { sigFigs: 6, notation: 'auto', trimZeros: true })).toBe('1000000 µV');
  });
});
