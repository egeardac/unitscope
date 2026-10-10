import { fail, ok, type Result } from './result';
import { siUnitOf, type QuantityId, type UnitDef } from './units';

/**
 * Multiply by 10^k using a single correctly rounded operation. Dividing by an
 * exact power of ten (rather than multiplying by an inexact 10^-k) keeps
 * results such as 100 nF → 0.1 µF exact to the last bit.
 */
export function shiftPow10(value: number, k: number): number {
  if (k === 0) return value;
  return k > 0 ? value * 10 ** k : value / 10 ** -k;
}

/**
 * Convert a value between two units of the same quantity. Order of operations:
 * multiply by the source mantissa, shift by the exponent difference, then
 * divide by the target mantissa. No rounding happens here.
 */
export function convert(value: number, from: UnitDef, to: UnitDef): Result<number> {
  if (from.quantity !== to.quantity) {
    return fail(
      'WRONG_QUANTITY_UNIT',
      `Cannot convert ${from.name} (${from.symbol}) to ${to.name} (${to.symbol}): they measure different quantities. That needs a circuit calculation, not a unit conversion.`,
    );
  }
  if (!Number.isFinite(value)) {
    return fail('OVERFLOW', 'The value is too large to represent (beyond ±1.8 × 10³⁰⁸).');
  }
  let r = value * from.mantissa;
  r = shiftPow10(r, from.exp - to.exp);
  if (to.mantissa !== 1) r = r / to.mantissa;
  if (!Number.isFinite(r)) {
    return fail(
      'RESULT_OVERFLOW',
      `The result in ${to.symbol} is too large to represent (beyond ±1.8 × 10³⁰⁸).`,
    );
  }
  if (r === 0 && value !== 0) {
    return fail('UNDERFLOW', `The result in ${to.symbol} is too small to represent (below about 5 × 10⁻³²⁴).`);
  }
  return ok(r);
}

/** Value in the coherent SI unit of the quantity (V, A, Ω, F, H, W, Hz, s, J, C, m). */
export function toSI(value: number, unit: UnitDef): Result<number> {
  return convert(value, unit, siUnitOf(unit.quantity));
}

export function fromSI(si: number, unit: UnitDef): Result<number> {
  return convert(si, siUnitOf(unit.quantity), unit);
}

/** Convenience for internal use where inputs are already validated. */
export function toSIUnchecked(value: number, unit: UnitDef): number {
  const r = toSI(value, unit);
  return r.ok ? r.value : Number.NaN;
}

export function fromSIUnchecked(si: number, unit: UnitDef): number {
  const r = fromSI(si, unit);
  return r.ok ? r.value : Number.NaN;
}

export function quantityOf(unit: UnitDef): QuantityId {
  return unit.quantity;
}
