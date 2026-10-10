import { describe, expect, it } from 'vitest';
import { dcFromCurrent, dcFromVoltage } from '../../src/engine/models/dcResistor';
import { sineAmplitudes, checkFrequency } from '../../src/engine/models/acSine';
import { frequencyFromPeriod, periodFromFrequency } from '../../src/engine/models/periodic';
import { rcCutoff, rcModel, fractionAfterTau } from '../../src/engine/models/rc';
import { rlModel } from '../../src/engine/models/rl';
import { accumulate, timeToReach } from '../../src/engine/models/accumulate';
import {
  dbmToVrms, dbmToWatts, dbwToWatts, powerRatioDb, voltageRatioDb, vrmsToDbm, wattsToDbm, wattsToDbw,
} from '../../src/engine/models/decibel';
import { chargeToEnergy, energyToCharge } from '../../src/engine/models/battery';

const val = <T>(r: { ok: true; value: T } | { ok: false; error: { code: string } }): T | string => (r.ok ? r.value : r.error.code);

describe('ideal DC resistor', () => {
  it('negative voltage reverses current direction and keeps power positive', () => {
    const r = dcFromVoltage(-10, 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.I).toBeCloseTo(-0.01, 15);
    expect(r.value.P).toBeCloseTo(0.1, 15);
    expect(r.value.polarity).toBe('negative');
  });

  it('rejects a short circuit and negative resistance with explanations', () => {
    expect(val(dcFromVoltage(5, 0))).toBe('DIVISION_BY_ZERO');
    expect(val(dcFromVoltage(5, -1))).toBe('INVALID_PARAMETER');
  });

  it('computes V and P from current', () => {
    const r = dcFromCurrent(0.02, 330);
    expect(r.ok && r.value.V).toBeCloseTo(6.6, 12);
    expect(r.ok && r.value.P).toBeCloseTo(0.132, 12);
    expect(r.ok && dcFromCurrent(0.02, 0).ok).toBe(true);
  });

  it('reports overflow', () => {
    expect(val(dcFromVoltage(1e200, 1e-200))).toBe('RESULT_OVERFLOW');
  });
});

describe('sine amplitudes', () => {
  it('converts between RMS, peak and peak-to-peak', () => {
    const p = sineAmplitudes(10, 'peak');
    expect(p.ok && p.value.rms).toBeCloseTo(7.0710678118654755, 14);
    const pp = sineAmplitudes(2, 'pp');
    expect(pp.ok && pp.value.peak).toBe(1);
    expect(val(sineAmplitudes(-1, 'rms'))).toBe('NEGATIVE_NOT_ALLOWED');
    expect(val(checkFrequency(0))).toBe('DIVISION_BY_ZERO');
  });
});

describe('frequency and period', () => {
  it('T = 1/f and its inverse', () => {
    expect(val(periodFromFrequency(50))).toBeCloseTo(0.02, 15);
    expect(val(frequencyFromPeriod(0.02))).toBeCloseTo(50, 12);
    expect(val(periodFromFrequency(0))).toBe('DIVISION_BY_ZERO');
    expect(val(frequencyFromPeriod(0))).toBe('DIVISION_BY_ZERO');
  });
});

describe('RC model', () => {
  it('charges from zero to the source voltage', () => {
    const r = rcModel(1000, 100e-6, 5, 0);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.vAt(0)).toBe(0);
    expect(r.value.vAt(r.value.tau)).toBeCloseTo(5 * (1 - Math.exp(-1)), 12);
    expect(r.value.vAt(50 * r.value.tau)).toBeCloseTo(5, 9);
    expect(r.value.iInitial).toBeCloseTo(0.005, 15);
  });

  it('respects a non-zero initial voltage', () => {
    const r = rcModel(1000, 1e-6, 5, 2);
    expect(r.ok && r.value.vAt(0)).toBe(2);
  });

  it('low-pass cutoff fc = 1/(2πRC)', () => {
    const fc = rcCutoff(1000, 100e-9);
    expect(val(fc)).toBeCloseTo(1591.5494309189535, 9);
    expect(fractionAfterTau(1)).toBeCloseTo(0.6321205588, 9);
  });

  it('rejects zero R or C', () => {
    expect(val(rcModel(0, 1e-6, 5, 0))).toBe('DIVISION_BY_ZERO');
    expect(val(rcModel(1000, 0, 5, 0))).toBe('DIVISION_BY_ZERO');
  });
});

describe('RL model', () => {
  it('τ = L/R and final current Vs/R', () => {
    const r = rlModel(2.5e-3, 10, 5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.tau).toBeCloseTo(2.5e-4, 18);
    expect(r.value.iFinal).toBe(0.5);
    expect(r.value.iAt(0)).toBe(0);
  });

  it('R = 0 gives a linear ramp, flagged as such', () => {
    const r = rlModel(1e-3, 0, 5);
    expect(r.ok && r.value.ramp).toBe(true);
    expect(r.ok && r.value.iAt(1e-3)).toBeCloseTo(5, 12);
  });
});

describe('accumulation', () => {
  it('E = P·t and Q = I·t', () => {
    expect(val(accumulate(0.25, 3600))).toBe(900);
    expect(val(accumulate(0.5, 4 * 3600))).toBe(7200);
    expect(val(timeToReach(7200, 0.5, 'current'))).toBe(14400);
    expect(val(timeToReach(10, 0, 'power'))).toBe('DIVISION_BY_ZERO');
    expect(val(timeToReach(10, -1, 'power'))).toBe('INVALID_PARAMETER');
    expect(val(accumulate(1, -1))).toBe('NEGATIVE_NOT_ALLOWED');
  });
});

describe('decibels', () => {
  it('W ↔ dBm ↔ dBW with the correct references', () => {
    expect(val(wattsToDbm(1e-3))).toBeCloseTo(0, 12);
    expect(val(wattsToDbm(1))).toBeCloseTo(30, 12);
    expect(val(wattsToDbw(1))).toBeCloseTo(0, 12);
    expect(val(wattsToDbw(1e-3))).toBeCloseTo(-30, 12);
    expect(val(dbmToWatts(30))).toBeCloseTo(1, 12);
    expect(val(dbwToWatts(-30))).toBeCloseTo(1e-3, 15);
  });

  it('rejects negative power and explains −∞ for 0 W', () => {
    expect(val(wattsToDbm(-1))).toBe('LOG_DOMAIN');
    const z = wattsToDbm(0);
    expect(!z.ok && z.error.code).toBe('LOG_ZERO');
    expect(!z.ok && z.error.message).toMatch(/−∞ dBm/);
  });

  it('power and voltage ratios', () => {
    expect(val(powerRatioDb(1, 2))).toBeCloseTo(3.0103, 4);
    expect(val(voltageRatioDb(1, 2))).toBeCloseTo(6.0206, 4);
    expect(val(powerRatioDb(0, 1))).toBe('DIVISION_BY_ZERO');
  });

  it('voltage → dBm requires a load resistance', () => {
    expect(val(vrmsToDbm(1, null))).toBe('MISSING_PARAMETER');
    const r = vrmsToDbm(0.2236068, 50);
    expect(r.ok && r.value.dBm).toBeCloseTo(0, 4);
    const back = dbmToVrms(0, 50);
    expect(back.ok && back.value.Vrms).toBeCloseTo(0.2236068, 6);
  });
});

describe('battery approximation', () => {
  it('needs a nominal voltage', () => {
    expect(val(chargeToEnergy(3600, null))).toBe('MISSING_PARAMETER');
    expect(val(chargeToEnergy(2 * 3600, 3.7))).toBeCloseTo(7.4 * 3600, 9);
    expect(val(energyToCharge(7.4 * 3600, 3.7))).toBeCloseTo(7200, 9);
    expect(val(chargeToEnergy(1, 0))).toBe('INVALID_PARAMETER');
  });
});
