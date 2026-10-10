import { fail, finiteOr, ok, type Result } from '../result';

/**
 * Constant-rate accumulation:
 *   E = P · t   (energy delivered at constant power)
 *   Q = I · t   (charge moved at constant current)
 */
export function accumulate(rate: number, duration: number): Result<number> {
  if (!Number.isFinite(rate) || !Number.isFinite(duration)) return fail('INVALID_PARAMETER', 'Enter finite values.');
  if (duration < 0) return fail('NEGATIVE_NOT_ALLOWED', 'The duration cannot be negative.');
  return finiteOr(rate * duration, (v) => v, 'accumulated total');
}

/** Time needed to accumulate `target` at a constant `rate` (t = target / rate). */
export function timeToReach(target: number, rate: number, rateName: string): Result<number> {
  if (!Number.isFinite(target) || !Number.isFinite(rate)) return fail('INVALID_PARAMETER', 'Enter finite values.');
  if (target === 0) return ok(0);
  if (rate === 0) {
    return fail('DIVISION_BY_ZERO', `With zero ${rateName} nothing accumulates, so the target is never reached (t = target / 0).`);
  }
  if (Math.sign(target) !== Math.sign(rate)) {
    return fail(
      'INVALID_PARAMETER',
      `The ${rateName} and the target have opposite signs, so the total moves away from the target and never reaches it.`,
    );
  }
  return finiteOr(target / rate, (v) => v, 'time');
}
