import { fail, ok, type Result } from '../result';

/**
 * Ohm's law and resistor power for an ideal resistor: V = I·R, P = V·I.
 * Exactly two quantities must be known; the other two are calculated.
 */
export type OhmPair = 'VR' | 'VI' | 'IR' | 'PR' | 'PV' | 'PI';

export const OHM_PAIRS: Array<{ id: OhmPair; label: string }> = [
  { id: 'VR', label: 'Voltage and resistance' },
  { id: 'VI', label: 'Voltage and current' },
  { id: 'IR', label: 'Current and resistance' },
  { id: 'PR', label: 'Power and resistance' },
  { id: 'PV', label: 'Power and voltage' },
  { id: 'PI', label: 'Power and current' },
];

export interface OhmResult {
  V: number;
  I: number;
  R: number;
  P: number;
  /** Set when only magnitudes can be derived (from P and R). */
  magnitudeOnly?: boolean;
}

function finite(r: OhmResult): Result<OhmResult> {
  if (![r.V, r.I, r.R, r.P].every(Number.isFinite)) return fail('RESULT_OVERFLOW', 'A result is too large to represent.');
  if (r.R < 0) return fail('INVALID_PARAMETER', 'These values imply a negative resistance, which an ideal resistor cannot have. Check the signs of V and I.');
  if (r.P < 0) return fail('INVALID_PARAMETER', 'These values imply negative power in a resistor, which cannot happen: a resistor always absorbs power.');
  return ok(r);
}

export function solveOhm(pair: OhmPair, a: number, b: number): Result<OhmResult> {
  switch (pair) {
    case 'VR': {
      const [V, R] = [a, b];
      if (R <= 0) return fail(R === 0 ? 'DIVISION_BY_ZERO' : 'INVALID_PARAMETER', R === 0 ? 'R = 0 Ω is a short circuit: I = V/R is unbounded.' : 'Resistance must be positive.');
      return finite({ V, R, I: V / R, P: (V * V) / R });
    }
    case 'VI': {
      const [V, I] = [a, b];
      if (I === 0) return fail('DIVISION_BY_ZERO', 'With I = 0 A the resistance R = V/I is undefined (open circuit if V ≠ 0).');
      return finite({ V, I, R: V / I, P: V * I });
    }
    case 'IR': {
      const [I, R] = [a, b];
      if (R < 0) return fail('INVALID_PARAMETER', 'Resistance must be positive.');
      return finite({ I, R, V: I * R, P: I * I * R });
    }
    case 'PR': {
      const [P, R] = [a, b];
      if (P < 0) return fail('INVALID_PARAMETER', 'A resistor cannot have negative power.');
      if (R <= 0) return fail(R === 0 ? 'DIVISION_BY_ZERO' : 'INVALID_PARAMETER', R === 0 ? 'R = 0 Ω cannot dissipate power at a finite current.' : 'Resistance must be positive.');
      return finite({ P, R, V: Math.sqrt(P * R), I: Math.sqrt(P / R), magnitudeOnly: true });
    }
    case 'PV': {
      const [P, V] = [a, b];
      if (V === 0) return fail('DIVISION_BY_ZERO', 'With V = 0 V the current I = P/V is undefined.');
      if (P === 0) return fail('DIVISION_BY_ZERO', 'With P = 0 W the resistance R = V²/P is unbounded (open circuit).');
      return finite({ P, V, I: P / V, R: (V * V) / P });
    }
    case 'PI': {
      const [P, I] = [a, b];
      if (I === 0) return fail('DIVISION_BY_ZERO', 'With I = 0 A the voltage V = P/I is undefined.');
      return finite({ P, I, V: P / I, R: P / (I * I) });
    }
  }
}
