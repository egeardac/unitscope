import { fail, finiteOr, type Result } from '../result';

/**
 * Ideal DC source driving an ideal linear resistor.
 * Assumptions: zero source resistance, zero wire resistance, constant R
 * (no temperature or voltage dependence). Ohm's law I = V/R and P = V·I.
 * Sign convention: positive V means the top terminal is +; conventional
 * current then leaves the + terminal and flows clockwise through R.
 * Reference: Analog Devices, Real Analog — Circuits 1, Chapter 1.
 */
export interface DcResult {
  V: number;
  I: number;
  R: number;
  /** Power absorbed by the resistor (always ≥ 0 for R > 0). */
  P: number;
  polarity: 'positive' | 'negative' | 'zero';
}

function polarityOf(x: number): DcResult['polarity'] {
  return x > 0 ? 'positive' : x < 0 ? 'negative' : 'zero';
}

export function checkResistance(R: number): Result<number> {
  if (!Number.isFinite(R)) return fail('INVALID_PARAMETER', 'Enter a finite resistance.');
  if (R < 0) return fail('INVALID_PARAMETER', 'Resistance must be positive for an ideal resistor.');
  return { ok: true, value: R };
}

/** V and R known → I = V/R, P = V²/R. */
export function dcFromVoltage(V: number, R: number): Result<DcResult> {
  const r = checkResistance(R);
  if (!r.ok) return r;
  if (R === 0) {
    return fail(
      'DIVISION_BY_ZERO',
      V === 0
        ? 'R = 0 Ω is an ideal short circuit; with 0 V the current is undefined (0/0). Enter R > 0.'
        : 'R = 0 Ω is an ideal short circuit: I = V/R would be unbounded. Real sources and wires always have some resistance. Enter R > 0.',
    );
  }
  const I = V / R;
  const P = (V * V) / R;
  return finiteOr(Math.max(Math.abs(I), P), () => ({ V, I, R, P, polarity: polarityOf(V) }), 'current or power');
}

/** I and R known → V = I·R, P = I²·R. R = 0 is valid here (V = 0, P = 0). */
export function dcFromCurrent(I: number, R: number): Result<DcResult> {
  const r = checkResistance(R);
  if (!r.ok) return r;
  const V = I * R;
  const P = I * I * R;
  return finiteOr(Math.max(Math.abs(V), P), () => ({ V, I, R, P, polarity: polarityOf(I) }), 'voltage or power');
}
