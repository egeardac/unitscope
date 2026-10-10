import { describe, expect, it } from 'vitest';
import { lookupUnit, parseNumber, parseQuantityInput, resolveUnit, splitValueAndUnit } from '../../src/engine/parse';
import { getUnit } from '../../src/engine/units';

const num = (s: string) => {
  const r = parseNumber(s);
  return r.ok ? r.value.value : r.error.code;
};

describe('parseNumber', () => {
  it('accepts decimal points, decimal commas and scientific notation', () => {
    expect(num('4.7')).toBe(4.7);
    expect(num('4,7')).toBe(4.7);
    expect(num('0,001')).toBe(0.001);
    expect(num('.5')).toBe(0.5);
    expect(num(',5')).toBe(0.5);
    expect(num('5.')).toBe(5);
    expect(num('4.7e3')).toBe(4700);
    expect(num('4.7E-3')).toBe(0.0047);
    expect(num('4,7e3')).toBe(4700);
    expect(num('4.7 × 10^3')).toBe(4700);
    expect(num('4.7x10^-3')).toBe(0.0047);
    expect(num('1.5 × 10⁻³')).toBe(0.0015);
  });

  it('accepts signs including the typographic minus', () => {
    expect(num('-1.2')).toBe(-1.2);
    expect(num('−1.2')).toBe(-1.2);
    expect(num('+3')).toBe(3);
    expect(num('-0')).toBe(0);
  });

  it('accepts digit groups of three separated by spaces', () => {
    expect(num('1 000 000')).toBe(1_000_000);
    expect(num('1 000')).toBe(1000);
    expect(num('0.000 001')).toBe(0.000001);
    expect(num('10 00')).toBe('BAD_GROUPING');
  });

  it('rejects ambiguous and malformed separators instead of guessing', () => {
    expect(num('1,000')).toBe('AMBIGUOUS_SEPARATOR');
    expect(num('-12,500')).toBe('AMBIGUOUS_SEPARATOR');
    expect(num('1.234,5')).toBe('MIXED_SEPARATORS');
    expect(num('1,234.5')).toBe('MIXED_SEPARATORS');
    expect(num('1.000.000')).toBe('MULTIPLE_SEPARATORS');
    const r = parseNumber('1,000');
    expect(!r.ok && r.error.fixes?.map((f) => (f.kind === 'replace-text' ? f.text : ''))).toEqual(['1000', '1.000']);
  });

  it('rejects non-numbers, empty input and non-finite values', () => {
    expect(num('')).toBe('EMPTY');
    expect(num('   ')).toBe('EMPTY');
    expect(num('abc')).toBe('INVALID_NUMBER');
    expect(num('NaN')).toBe('INVALID_NUMBER');
    expect(num('Infinity')).toBe('INVALID_NUMBER');
    expect(num('0x10')).toBe('INVALID_NUMBER');
    expect(num('1e400')).toBe('OVERFLOW');
    expect(num('1e-400')).toBe('UNDERFLOW');
  });
});

describe('splitValueAndUnit', () => {
  it('separates a number from a trailing unit', () => {
    expect(splitValueAndUnit('100 uF')).toEqual({ numberText: '100', unitText: 'uF' });
    expect(splitValueAndUnit('4.7kΩ')).toEqual({ numberText: '4.7', unitText: 'kΩ' });
    expect(splitValueAndUnit('1e3mV')).toEqual({ numberText: '1e3', unitText: 'mV' });
    expect(splitValueAndUnit('1 000 mV')).toEqual({ numberText: '1 000', unitText: 'mV' });
    expect(splitValueAndUnit('-5')).toEqual({ numberText: '-5', unitText: '' });
  });
});

describe('unit aliases and case sensitivity', () => {
  it('accepts convenient aliases but resolves to the correct symbol', () => {
    expect(lookupUnit('uF')?.symbol).toBe('µF');
    expect(lookupUnit('μF')?.symbol).toBe('µF'); // Greek mu
    expect(lookupUnit('µF')?.symbol).toBe('µF'); // micro sign
    expect(lookupUnit('kohm')?.symbol).toBe('kΩ');
    expect(lookupUnit('k ohm')?.symbol).toBe('kΩ');
    expect(lookupUnit('kΩ')?.symbol).toBe('kΩ'); // ohm sign U+2126
    expect(lookupUnit('meg')?.symbol).toBe('MΩ');
    expect(lookupUnit('100nf'.slice(3))?.symbol).toBe('nF');
    expect(lookupUnit('khz')?.symbol).toBe('kHz');
    expect(lookupUnit('mah')?.symbol).toBe('mAh');
    expect(lookupUnit('millivolts')?.symbol).toBe('mV');
    expect(lookupUnit('thou')?.symbol).toBe('mil');
    expect(lookupUnit('inches')?.symbol).toBe('in');
  });

  it('keeps m (milli) and M (mega) distinct', () => {
    expect(lookupUnit('mohm')?.symbol).toBe('mΩ');
    expect(lookupUnit('Mohm')?.symbol).toBe('MΩ');
    expect(lookupUnit('MHz')?.symbol).toBe('MHz');
    expect(lookupUnit('mhz')).toBeUndefined();
  });

  it('suggests the right case for near misses', () => {
    const r = resolveUnit('mhz', 'frequency');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.message).toMatch(/case-sensitive/);
    expect(!r.ok && r.error.fixes?.[0]).toMatchObject({ kind: 'replace-text', text: 'MHz' });
    const k = resolveUnit('KHz', 'frequency');
    expect(!k.ok && k.error.fixes?.[0]).toMatchObject({ text: 'kHz' });
    const v = resolveUnit('MV', 'voltage');
    expect(!v.ok && v.error.fixes?.[0]).toMatchObject({ text: 'mV' });
  });

  it('flags units of another quantity and offers to switch', () => {
    const r = parseQuantityInput('5 mA', 'voltage', getUnit('V')!);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('WRONG_QUANTITY_UNIT');
    expect(!r.ok && r.error.fixes?.[0]).toMatchObject({ kind: 'switch-quantity', quantity: 'current', unit: 'mA' });
  });
});

describe('parseQuantityInput', () => {
  it('uses the typed unit when present and the selected unit otherwise', () => {
    const a = parseQuantityInput('100 uF', 'capacitance', getUnit('nF')!);
    expect(a.ok && a.value.unit.id).toBe('uF');
    expect(a.ok && a.value.unitFromText).toBe(true);
    const b = parseQuantityInput('100', 'capacitance', getUnit('nF')!);
    expect(b.ok && b.value.unit.id).toBe('nF');
  });

  it('allows negative voltage but rejects negative capacitance', () => {
    expect(parseQuantityInput('-5', 'voltage', getUnit('V')!).ok).toBe(true);
    const c = parseQuantityInput('-5', 'capacitance', getUnit('nF')!);
    expect(!c.ok && c.error.code).toBe('NEGATIVE_NOT_ALLOWED');
  });

  it('rebuilds fixes with the unit preserved', () => {
    const r = parseQuantityInput('1,000 mV', 'voltage', getUnit('V')!);
    expect(!r.ok && r.error.fixes?.map((f) => (f.kind === 'replace-text' ? f.text : ''))).toEqual(['1000 mV', '1.000 mV']);
  });

  it('rejects parameter-only units in the converter', () => {
    const r = parseQuantityInput('5 min', 'time', getUnit('s')!);
    expect(r.ok).toBe(false);
    const p = parseQuantityInput('5 min', 'time', getUnit('s')!, { allowParamOnly: true });
    expect(p.ok && p.value.unit.id).toBe('min');
  });
});
