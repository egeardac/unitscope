import { fail, finiteOr, type Result } from '../result';

/**
 * Charge ↔ energy for a battery using its NOMINAL voltage:
 *   E ≈ Q · Vnom   (Wh ≈ Ah × V)
 * This is an approximation: real cell voltage varies along the discharge
 * curve, with load, temperature and age.
 */
function checkVnom(Vnom: number | null): Result<number> {
  if (Vnom === null || Number.isNaN(Vnom)) {
    return fail(
      'MISSING_PARAMETER',
      'Enter the nominal voltage. Converting between charge (Ah) and energy (Wh) needs a voltage; none is assumed.',
    );
  }
  if (!Number.isFinite(Vnom) || Vnom <= 0) return fail('INVALID_PARAMETER', 'The nominal voltage must be greater than 0 V.');
  return { ok: true, value: Vnom };
}

/** Charge in coulombs → energy in joules (approximation at nominal voltage). */
export function chargeToEnergy(Qcoulomb: number, Vnom: number | null): Result<number> {
  const v = checkVnom(Vnom);
  if (!v.ok) return v;
  return finiteOr(Qcoulomb * v.value, (x) => x, 'energy');
}

/** Energy in joules → charge in coulombs (approximation at nominal voltage). */
export function energyToCharge(Ejoule: number, Vnom: number | null): Result<number> {
  const v = checkVnom(Vnom);
  if (!v.ok) return v;
  return finiteOr(Ejoule / v.value, (x) => x, 'charge');
}
