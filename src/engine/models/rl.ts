import { fail, ok, type Result } from '../result';

/**
 * Ideal series RL step response with zero initial current. At t = 0 an ideal
 * DC source Vs is switched onto R in series with L.
 *   τ = L/R,   i(t) = (Vs/R)·(1 − e^(−t/τ)),   vL(t) = Vs·e^(−t/τ)
 * With R = 0 the ideal inductor's current ramps without limit: i(t) = (Vs/L)·t.
 */
export interface RlModel {
  L: number;
  R: number;
  Vs: number;
  /** null when R = 0 (no exponential settling). */
  tau: number | null;
  iFinal: number | null;
  /** di/dt at t = 0, equal to Vs/L. */
  slope0: number;
  ramp: boolean;
  iAt: (t: number) => number;
  vLAt: (t: number) => number;
}

export function rlModel(L: number, R: number, Vs: number): Result<RlModel> {
  if (!Number.isFinite(L) || !Number.isFinite(R) || !Number.isFinite(Vs)) {
    return fail('INVALID_PARAMETER', 'Enter finite values for L, R and Vs.');
  }
  if (L < 0) return fail('NEGATIVE_NOT_ALLOWED', 'Inductance cannot be negative.');
  if (L === 0) {
    return fail('DIVISION_BY_ZERO', 'With L = 0 H there is no inductor: the current would jump to Vs/R instantly (τ = 0). Enter L > 0.');
  }
  if (R < 0) return fail('INVALID_PARAMETER', 'Resistance must be positive.');
  const slope0 = Vs / L;
  if (!Number.isFinite(slope0)) return fail('RESULT_OVERFLOW', 'di/dt = Vs/L is too large to represent.');
  if (R === 0) {
    return ok({ L, R, Vs, tau: null, iFinal: null, slope0, ramp: true, iAt: (t) => slope0 * t, vLAt: () => Vs });
  }
  const tau = L / R;
  if (!Number.isFinite(tau) || tau === 0) return fail('RESULT_OVERFLOW', 'τ = L/R is outside the representable range.');
  const iFinal = Vs / R;
  return ok({
    L,
    R,
    Vs,
    tau,
    iFinal,
    slope0,
    ramp: false,
    iAt: (t) => iFinal * (1 - Math.exp(-t / tau)),
    vLAt: (t) => Vs * Math.exp(-t / tau),
  });
}
