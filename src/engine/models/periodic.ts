import { fail, finiteOr, type Result } from '../result';

/** T = 1/f for a periodic signal. */
export function periodFromFrequency(f: number): Result<number> {
  if (!Number.isFinite(f)) return fail('INVALID_PARAMETER', 'Enter a finite frequency.');
  if (f < 0) return fail('NEGATIVE_NOT_ALLOWED', 'Frequency cannot be negative.');
  if (f === 0) return fail('DIVISION_BY_ZERO', 'T = 1/f is undefined for f = 0 Hz: a constant (DC) signal has no period.');
  return finiteOr(1 / f, (v) => v, 'period');
}

/** f = 1/T for a periodic signal. */
export function frequencyFromPeriod(T: number): Result<number> {
  if (!Number.isFinite(T)) return fail('INVALID_PARAMETER', 'Enter a finite period.');
  if (T < 0) return fail('NEGATIVE_NOT_ALLOWED', 'A period cannot be negative.');
  if (T === 0) return fail('DIVISION_BY_ZERO', 'f = 1/T is undefined for T = 0 s: a zero-length period would mean infinite frequency.');
  return finiteOr(1 / T, (v) => v, 'frequency');
}

/** ω = 2πf in rad/s. */
export function angularFrequency(f: number): number {
  return 2 * Math.PI * f;
}
