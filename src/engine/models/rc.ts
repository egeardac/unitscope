import { fail, ok, type Result } from '../result';

/**
 * Ideal series RC step response. At t = 0 an ideal DC source Vs is switched
 * onto R in series with C, whose initial voltage is V0.
 *   τ = R·C
 *   Vc(t) = Vs + (V0 − Vs)·e^(−t/τ)      (with V0 = 0: Vc = Vs·(1 − e^(−t/τ)))
 *   i(t)  = (Vs − V0)/R · e^(−t/τ)
 * The same R and C form a first-order low-pass filter with fc = 1/(2πRC).
 * Reference: Texas Instruments, passive components and circuits tutorial.
 */
export interface RcModel {
  R: number;
  C: number;
  Vs: number;
  V0: number;
  tau: number;
  fc: number;
  iInitial: number;
  vAt: (t: number) => number;
  iAt: (t: number) => number;
}

export function rcTimeConstant(R: number, C: number): Result<number> {
  if (!Number.isFinite(R) || !Number.isFinite(C)) return fail('INVALID_PARAMETER', 'Enter finite values for R and C.');
  if (R < 0) return fail('INVALID_PARAMETER', 'Resistance must be positive.');
  if (C < 0) return fail('NEGATIVE_NOT_ALLOWED', 'Capacitance cannot be negative.');
  if (R === 0) {
    return fail(
      'DIVISION_BY_ZERO',
      'With R = 0 Ω the time constant τ = RC is zero: the ideal capacitor would charge instantly through an unbounded current. Enter R > 0.',
    );
  }
  if (C === 0) return fail('DIVISION_BY_ZERO', 'With C = 0 F there is no capacitor to charge (τ = 0). Enter C > 0.');
  const tau = R * C;
  if (!Number.isFinite(tau)) return fail('RESULT_OVERFLOW', 'τ = RC is too large to represent.');
  if (tau === 0) return fail('UNDERFLOW', 'τ = RC is too small to represent.');
  return ok(tau);
}

export function rcCutoff(R: number, C: number): Result<number> {
  const t = rcTimeConstant(R, C);
  if (!t.ok) return t;
  return ok(1 / (2 * Math.PI * t.value));
}

export function rcModel(R: number, C: number, Vs: number, V0: number): Result<RcModel> {
  const t = rcTimeConstant(R, C);
  if (!t.ok) return t;
  if (!Number.isFinite(Vs) || !Number.isFinite(V0)) return fail('INVALID_PARAMETER', 'Enter finite source and initial voltages.');
  const tau = t.value;
  const iInitial = (Vs - V0) / R;
  return ok({
    R,
    C,
    Vs,
    V0,
    tau,
    fc: 1 / (2 * Math.PI * tau),
    iInitial,
    vAt: (time: number) => Vs + (V0 - Vs) * Math.exp(-time / tau),
    iAt: (time: number) => iInitial * Math.exp(-time / tau),
  });
}

/** Fraction of the step completed after n time constants: 1 − e^(−n). */
export function fractionAfterTau(n: number): number {
  return 1 - Math.exp(-n);
}
