import { describe, expect, it } from 'vitest';
import { convert, toSI } from '../../src/engine/convert';
import { getUnit, type UnitDef } from '../../src/engine/units';
import { periodFromFrequency } from '../../src/engine/models/periodic';
import { wattsToDbm } from '../../src/engine/models/decibel';
import { sineAmplitudes } from '../../src/engine/models/acSine';
import { rcTimeConstant } from '../../src/engine/models/rc';
import { dcFromVoltage } from '../../src/engine/models/dcResistor';
import { formatNumber, formatSI } from '../../src/engine/format';

const U = (id: string): UnitDef => {
  const x = getUnit(id);
  if (!x) throw new Error(`missing unit ${id}`);
  return x;
};
const conv = (v: number, a: string, b: string): number => {
  const r = convert(v, U(a), U(b));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};
const si = (v: number, a: string): number => {
  const r = toSI(v, U(a));
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
};

describe('specification acceptance cases', () => {
  it('1 V = 1000 mV, and every representation has the identical SI value', () => {
    expect(conv(1, 'V', 'mV')).toBe(1000);
    expect(conv(1000, 'mV', 'V')).toBe(1);
    expect(si(1, 'V')).toBe(1);
    expect(si(1000, 'mV')).toBe(1);
    expect(si(1_000_000, 'uV')).toBe(1);
  });

  it('4.7 kΩ = 4700 Ω', () => {
    expect(conv(4.7, 'kohm', 'ohm')).toBe(4700);
  });

  it('100 nF = 0.1 µF exactly (no floating-point drift)', () => {
    expect(conv(100, 'nF', 'uF')).toBe(0.1);
  });

  it('2.5 mH = 2500 µH', () => {
    expect(conv(2.5, 'mH', 'uH')).toBe(2500);
  });

  it('1 MHz corresponds to a period of 1 µs', () => {
    const T = periodFromFrequency(si(1, 'MHz'));
    expect(T.ok && T.value).toBe(1e-6);
    expect(T.ok && conv(T.value, 's', 'us')).toBe(1);
  });

  it('1 mW = 0 dBm and 1 W = 30 dBm', () => {
    const a = wattsToDbm(si(1, 'mW'));
    const b = wattsToDbm(1);
    expect(a.ok && a.value).toBeCloseTo(0, 12);
    expect(b.ok && b.value).toBeCloseTo(30, 12);
  });

  it('a 1 Vrms sine has approximately 1.414213562 Vpk', () => {
    const r = sineAmplitudes(1, 'rms');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.peak).toBeCloseTo(1.414213562, 9);
    expect(formatNumber(r.value.peak, { sigFigs: 10, notation: 'auto', trimZeros: true }).text).toBe('1.414213562');
    expect(r.value.pp).toBeCloseTo(2.828427125, 9);
  });

  it('R = 1 kΩ and C = 100 µF give τ = 0.1 s', () => {
    const tau = rcTimeConstant(si(1, 'kohm'), si(100, 'uF'));
    expect(tau.ok && tau.value).toBeCloseTo(0.1, 15);
    expect(tau.ok && formatSI(tau.value, 's').text).toBe('100 ms');
  });

  it('R = 1 kΩ: 1 V → 1 mA, 1 mW; 10 V → 10 mA, 100 mW', () => {
    const a = dcFromVoltage(1, 1000);
    const b = dcFromVoltage(10, 1000);
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(formatSI(a.value.I, 'A').text).toBe('1 mA');
    expect(formatSI(a.value.P, 'W').text).toBe('1 mW');
    expect(formatSI(b.value.I, 'A').text).toBe('10 mA');
    expect(formatSI(b.value.P, 'W').text).toBe('100 mW');
    expect(b.value.I / a.value.I).toBeCloseTo(10, 12);
    expect(b.value.P / a.value.P).toBeCloseTo(100, 12);
  });
});

describe('NIST-verified unit factors', () => {
  it('SI prefixes are exact powers of ten', () => {
    expect(si(1, 'pF')).toBe(1e-12);
    expect(si(1, 'nA')).toBe(1e-9);
    expect(si(1, 'uV')).toBe(1e-6);
    expect(si(1, 'mW')).toBe(1e-3);
    expect(si(1, 'kohm')).toBe(1e3);
    expect(si(1, 'Mohm')).toBe(1e6);
    expect(si(1, 'GHz')).toBe(1e9);
  });

  it('distinguishes lowercase m (milli) from uppercase M (mega)', () => {
    expect(si(1, 'mohm')).toBe(1e-3);
    expect(si(1, 'Mohm')).toBe(1e6);
    expect(conv(1, 'Mohm', 'mohm')).toBe(1e9);
  });

  it('inch and mil are exact', () => {
    expect(conv(1, 'in', 'mm')).toBe(25.4);
    expect(conv(1, 'mil', 'um')).toBe(25.4);
    expect(conv(1000, 'mil', 'in')).toBe(1);
    expect(conv(25.4, 'mm', 'in')).toBe(1);
    expect(conv(6, 'mil', 'mm')).toBeCloseTo(0.1524, 15);
  });

  it('watt-hours and ampere-hours', () => {
    expect(conv(1, 'Wh', 'J')).toBe(3600);
    expect(conv(1, 'kWh', 'J')).toBe(3.6e6);
    expect(conv(1, 'kWh', 'Wh')).toBe(1000);
    expect(conv(1, 'Ah', 'C')).toBe(3600);
    expect(conv(1, 'mAh', 'C')).toBe(3.6);
    expect(conv(2000, 'mAh', 'Ah')).toBe(2);
  });

  it('round-trips every unit pair within each quantity', () => {
    const ids = ['uV', 'mV', 'V', 'kV', 'pF', 'nF', 'uF', 'mF', 'F', 'mil', 'mm', 'um', 'in', 'J', 'mJ', 'Wh', 'kWh'];
    for (const a of ids) {
      for (const b of ids) {
        if (U(a).quantity !== U(b).quantity) continue;
        const there = conv(1.234, a, b);
        const back = conv(there, b, a);
        expect(back).toBeCloseTo(1.234, 12);
      }
    }
  });

  it('refuses to convert between different quantities', () => {
    const r = convert(1, U('V'), U('mA'));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.message).toMatch(/circuit calculation/);
  });

  it('reports overflow instead of returning Infinity', () => {
    const r = convert(1e290, U('GHz'), U('Hz'));
    expect(r.ok).toBe(true);
    const r2 = convert(1e305, U('kV'), U('uV'));
    expect(r2.ok).toBe(false);
    expect(!r2.ok && r2.error.code).toBe('RESULT_OVERFLOW');
  });
});
