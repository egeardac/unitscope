import { fail, finiteOr, ok, type Result } from '../result';

/**
 * Sine wave with zero DC offset: v(t) = Vpk · sin(2π f t).
 * Vpk = √2 · Vrms and Vpp = 2 · Vpk hold ONLY for this waveform shape
 * (Tektronix RMS explanation). They are never applied to other shapes.
 */
export type AmplitudeKind = 'rms' | 'peak' | 'pp';

export interface SineAmplitudes {
  rms: number;
  peak: number;
  pp: number;
}

export const AMPLITUDE_LABEL: Record<AmplitudeKind, string> = {
  rms: 'RMS',
  peak: 'Peak',
  pp: 'Peak-to-peak',
};

export function sineAmplitudes(value: number, kind: AmplitudeKind): Result<SineAmplitudes> {
  if (!Number.isFinite(value)) return fail('INVALID_PARAMETER', 'Enter a finite amplitude.');
  if (value < 0) {
    return fail(
      'NEGATIVE_NOT_ALLOWED',
      'An AC amplitude is a magnitude and cannot be negative (a sign would only shift the phase by 180°). Enter a value ≥ 0.',
    );
  }
  let peak: number;
  if (kind === 'rms') peak = Math.SQRT2 * value;
  else if (kind === 'peak') peak = value;
  else peak = value / 2;
  const rms = kind === 'rms' ? value : peak / Math.SQRT2;
  const pp = kind === 'pp' ? value : 2 * peak;
  return finiteOr(pp, () => ({ rms, peak, pp }), 'amplitude');
}

export function sineAt(peak: number, f: number, t: number, phase = 0): number {
  return peak * Math.sin(2 * Math.PI * f * t + phase);
}

/** Above this many cycles per window a trace cannot be drawn faithfully; an envelope is shown instead. */
export const MAX_DRAWN_CYCLES = 60;

export function checkFrequency(f: number): Result<number> {
  if (!Number.isFinite(f)) return fail('INVALID_PARAMETER', 'Enter a finite frequency.');
  if (f < 0) return fail('NEGATIVE_NOT_ALLOWED', 'Frequency cannot be negative.');
  if (f === 0) {
    return fail('DIVISION_BY_ZERO', 'f = 0 Hz is DC: a sine needs a frequency above zero (its period T = 1/f would be infinite).');
  }
  return ok(f);
}
