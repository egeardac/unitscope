import { fail, finiteOr, ok, type Result } from '../result';

/**
 * Decibel relationships (Keysight, "Decibels" concept page):
 *   dBm = 10·log10(P / 1 mW)      dBW = 10·log10(P / 1 W)
 *   power ratio   = 10·log10(P2 / P1) dB
 *   voltage ratio = 20·log10(V2 / V1) dB — equals the power ratio ONLY when
 *   both voltages are measured across equal resistances.
 *   Voltage → dBm requires the load resistance: P = Vrms² / R.
 */

function checkPowerForLog(P: number): Result<number> {
  if (!Number.isFinite(P)) return fail('INVALID_PARAMETER', 'Enter a finite power.');
  if (P < 0) {
    return fail(
      'LOG_DOMAIN',
      'dBm and dBW are defined only for positive power. A negative power describes the direction of power flow, not a level, so its logarithm does not exist.',
    );
  }
  if (P === 0) {
    return fail(
      'LOG_ZERO',
      '0 W corresponds to −∞ dBm (and −∞ dBW): the logarithm of zero is unbounded, so no finite level exists. Enter a positive power.',
    );
  }
  return ok(P);
}

export function wattsToDbm(P: number): Result<number> {
  const c = checkPowerForLog(P);
  if (!c.ok) return c;
  return ok(10 * Math.log10(P) + 30);
}

export function wattsToDbw(P: number): Result<number> {
  const c = checkPowerForLog(P);
  if (!c.ok) return c;
  return ok(10 * Math.log10(P));
}

export function dbmToWatts(dBm: number): Result<number> {
  if (!Number.isFinite(dBm)) return fail('INVALID_PARAMETER', 'Enter a finite level in dBm.');
  return finiteOr(10 ** ((dBm - 30) / 10), (v) => v, 'power');
}

export function dbwToWatts(dBW: number): Result<number> {
  if (!Number.isFinite(dBW)) return fail('INVALID_PARAMETER', 'Enter a finite level in dBW.');
  return finiteOr(10 ** (dBW / 10), (v) => v, 'power');
}

export function powerRatioDb(P1: number, P2: number): Result<number> {
  if (!Number.isFinite(P1) || !Number.isFinite(P2)) return fail('INVALID_PARAMETER', 'Enter finite powers.');
  if (P1 < 0 || P2 < 0) return fail('LOG_DOMAIN', 'A power ratio in dB needs positive powers on both sides.');
  if (P1 === 0) return fail('DIVISION_BY_ZERO', 'The reference power P1 is 0 W, so the ratio P2/P1 is undefined.');
  if (P2 === 0) return fail('LOG_ZERO', 'P2 = 0 W gives a ratio of 0, which is −∞ dB. Enter a positive P2.');
  return ok(10 * Math.log10(P2 / P1));
}

export function voltageRatioDb(V1: number, V2: number): Result<number> {
  if (!Number.isFinite(V1) || !Number.isFinite(V2)) return fail('INVALID_PARAMETER', 'Enter finite voltages.');
  if (V1 < 0 || V2 < 0) return fail('LOG_DOMAIN', 'Use voltage magnitudes of the same kind (both RMS or both peak); they cannot be negative.');
  if (V1 === 0) return fail('DIVISION_BY_ZERO', 'The reference voltage V1 is 0 V, so the ratio V2/V1 is undefined.');
  if (V2 === 0) return fail('LOG_ZERO', 'V2 = 0 V gives a ratio of 0, which is −∞ dB. Enter a positive V2.');
  return ok(20 * Math.log10(V2 / V1));
}

/** Vrms across a known load resistance → dBm. The load is required; no default is assumed. */
export function vrmsToDbm(Vrms: number, R: number | null): Result<{ P: number; dBm: number }> {
  if (R === null || Number.isNaN(R)) {
    return fail(
      'MISSING_PARAMETER',
      'Enter the load resistance. A voltage only maps to dBm across a known load; no 50 Ω (or other) load is assumed.',
    );
  }
  if (!Number.isFinite(R) || R <= 0) return fail('INVALID_PARAMETER', 'The load resistance must be greater than 0 Ω.');
  if (!Number.isFinite(Vrms)) return fail('INVALID_PARAMETER', 'Enter a finite RMS voltage.');
  if (Vrms < 0) return fail('LOG_DOMAIN', 'An RMS voltage cannot be negative.');
  const P = (Vrms * Vrms) / R;
  const d = wattsToDbm(P);
  if (!d.ok) return d;
  return ok({ P, dBm: d.value });
}

/** dBm into a known load → Vrms. */
export function dbmToVrms(dBm: number, R: number | null): Result<{ P: number; Vrms: number }> {
  if (R === null || Number.isNaN(R)) {
    return fail('MISSING_PARAMETER', 'Enter the load resistance. No 50 Ω (or other) load is assumed.');
  }
  if (!Number.isFinite(R) || R <= 0) return fail('INVALID_PARAMETER', 'The load resistance must be greater than 0 Ω.');
  const p = dbmToWatts(dBm);
  if (!p.ok) return p;
  return finiteOr(Math.sqrt(p.value * R), (Vrms) => ({ P: p.value, Vrms }), 'voltage');
}
