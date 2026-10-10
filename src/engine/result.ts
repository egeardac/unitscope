/**
 * Shared result type for every engine function. The UI never receives a bare
 * number that might be NaN or Infinity: it gets either a value or a coded,
 * human-readable English error.
 */

export type ErrorCode =
  | 'EMPTY'
  | 'INVALID_NUMBER'
  | 'AMBIGUOUS_SEPARATOR'
  | 'MIXED_SEPARATORS'
  | 'MULTIPLE_SEPARATORS'
  | 'BAD_GROUPING'
  | 'OVERFLOW'
  | 'UNDERFLOW'
  | 'UNKNOWN_UNIT'
  | 'WRONG_QUANTITY_UNIT'
  | 'NEGATIVE_NOT_ALLOWED'
  | 'DIVISION_BY_ZERO'
  | 'LOG_DOMAIN'
  | 'LOG_ZERO'
  | 'MISSING_PARAMETER'
  | 'INVALID_PARAMETER'
  | 'RESULT_OVERFLOW';

/** A one-click correction the UI may offer next to an error message. */
export type Fix =
  | { kind: 'replace-text'; text: string; label: string }
  | { kind: 'switch-quantity'; quantity: string; text: string; unit: string; label: string };

export interface CalcError {
  code: ErrorCode;
  message: string;
  fixes?: Fix[];
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: CalcError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = <T = never>(code: ErrorCode, message: string, fixes?: Fix[]): Result<T> => ({
  ok: false,
  error: fixes && fixes.length > 0 ? { code, message, fixes } : { code, message },
});

/** Guard used after every arithmetic step that could overflow. */
export function finiteOr<T>(value: number, wrap: (v: number) => T, what: string): Result<T> {
  if (Number.isNaN(value)) {
    return fail('INVALID_PARAMETER', `The ${what} is undefined for these inputs.`);
  }
  if (!Number.isFinite(value)) {
    return fail(
      'RESULT_OVERFLOW',
      `The ${what} is too large to represent (beyond ±1.8 × 10³⁰⁸). Use smaller inputs.`,
    );
  }
  return ok(wrap(value));
}
