/**
 * Display formatting. Rounding happens ONLY here; the engine and the
 * visualizations always work with unrounded values.
 */

export type Notation = 'auto' | 'scientific' | 'engineering';

export interface FormatOptions {
  sigFigs: number;
  notation: Notation;
  /** Drop trailing zeros after the decimal point (1000.00 → 1000). */
  trimZeros: boolean;
}

export interface Formatted {
  /** Typographic display text: U+2212 minus, narrow-space digit groups, × 10ⁿ. */
  text: string;
  /** ASCII text suitable for copying into other tools, e.g. "4.7e3". */
  plain: string;
  mantissa: string;
  exponent: number | null;
}

const NNBSP = ' ';
const MINUS = '−';
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
};

export const SIG_FIGS_MIN = 1;
export const SIG_FIGS_MAX = 15;

export function clampSigFigs(n: number): number {
  if (!Number.isFinite(n)) return 6;
  return Math.min(SIG_FIGS_MAX, Math.max(SIG_FIGS_MIN, Math.round(n)));
}

export function superscript(n: number): string {
  return String(n).replace(/[0-9-]/g, (c) => SUP[c] ?? c);
}

/** Round to significant figures and return the digit string and decimal exponent. */
export function roundSig(value: number, sigFigs: number): { negative: boolean; digits: string; exp: number } {
  const sf = clampSigFigs(sigFigs);
  if (value === 0) return { negative: false, digits: '0'.repeat(sf), exp: 0 };
  const [m = '0', e = '0'] = Math.abs(value).toExponential(sf - 1).split('e');
  return { negative: value < 0, digits: m.replace('.', ''), exp: Number(e) };
}

/** Place a decimal point into a digit string: digits "4700", pointAfter 1 → "4.700". */
function placePoint(digits: string, pointAfter: number): { int: string; frac: string } {
  if (pointAfter <= 0) return { int: '0', frac: '0'.repeat(-pointAfter) + digits };
  if (pointAfter >= digits.length) return { int: digits + '0'.repeat(pointAfter - digits.length), frac: '' };
  return { int: digits.slice(0, pointAfter), frac: digits.slice(pointAfter) };
}

/** SI-style grouping of the integer part in threes (only for 5+ digits); decimals stay ungrouped for readability. */
function group(int: string, frac: string): { int: string; frac: string } {
  if (int.length < 5) return { int, frac };
  const parts: string[] = [];
  for (let i = int.length; i > 0; i -= 3) parts.unshift(int.slice(Math.max(0, i - 3), i));
  return { int: parts.join(NNBSP), frac };
}

function assemble(negative: boolean, int: string, frac: string, trim: boolean, grouped: boolean): { text: string; plain: string } {
  let f = frac;
  if (trim) f = f.replace(/0+$/, '');
  const plain = `${negative ? '-' : ''}${int}${f ? `.${f}` : ''}`;
  const g = grouped ? group(int, f) : { int, frac: f };
  const text = `${negative ? MINUS : ''}${g.int}${g.frac ? `.${g.frac}` : ''}`;
  return { text, plain };
}

/**
 * Format a number for display.
 * - auto: plain decimal for exponents −5 … 11, otherwise scientific
 * - scientific: d.ddd × 10ⁿ
 * - engineering: exponent is a multiple of 3, mantissa in [1, 1000)
 */
export function formatNumber(value: number, opts: FormatOptions, grouped = true): Formatted {
  if (!Number.isFinite(value)) {
    const t = Number.isNaN(value) ? '—' : value > 0 ? '∞' : `${MINUS}∞`;
    return { text: t, plain: t, mantissa: t, exponent: null };
  }
  const { negative, digits, exp } = roundSig(value, opts.sigFigs);
  if (value === 0) {
    const zeros = opts.trimZeros ? '' : '0'.repeat(Math.max(0, clampSigFigs(opts.sigFigs) - 1));
    const t = zeros ? `0.${zeros}` : '0';
    return { text: t, plain: t, mantissa: t, exponent: null };
  }

  const useFixed = opts.notation === 'auto' && exp >= -5 && exp <= 11;
  if (useFixed) {
    const { int, frac } = placePoint(digits, exp + 1);
    const a = assemble(negative, int, frac, opts.trimZeros, grouped);
    return { text: a.text, plain: a.plain, mantissa: a.text, exponent: null };
  }

  let e = exp;
  if (opts.notation === 'engineering') e = Math.floor(exp / 3) * 3;
  const { int, frac } = placePoint(digits, exp - e + 1);
  const a = assemble(negative, int, frac, opts.trimZeros, false);
  if (e === 0) return { text: a.text, plain: a.plain, mantissa: a.text, exponent: null };
  return {
    text: `${a.text} × 10${superscript(e)}`,
    plain: `${a.plain}e${e}`,
    mantissa: a.text,
    exponent: e,
  };
}

/* ------------------------------------------------------------------------ */
/* Automatic SI prefixes for readouts (I = 1 mA, P = 100 mW)                */
/* ------------------------------------------------------------------------ */

const SI_PREFIX: Record<number, string> = {
  [-15]: 'f', [-12]: 'p', [-9]: 'n', [-6]: 'µ', [-3]: 'm', 0: '', 3: 'k', 6: 'M', 9: 'G', 12: 'T',
};

export function prefixFor(exp3: number): string {
  return SI_PREFIX[exp3] ?? '';
}

/** Choose a prefix exponent (multiple of 3, clamped to f…T) so that |value| / 10^e falls in [1, 1000). */
export function chooseExp3(value: number): number {
  if (value === 0 || !Number.isFinite(value)) return 0;
  const e = Math.floor(Math.log10(Math.abs(value)) / 3) * 3;
  return Math.min(12, Math.max(-15, e));
}

export interface SIFormatted {
  text: string;
  plain: string;
  number: string;
  unit: string;
}

/**
 * Format an SI value with an automatic prefix, e.g. 0.001 A → "1 mA".
 * Rounding is applied first so that 999.96 mA becomes "1 A", not "1000 mA".
 */
export function formatSI(valueSI: number, baseSymbol: string, sigFigs = 4, trimZeros = true): SIFormatted {
  if (!Number.isFinite(valueSI)) {
    const n = Number.isNaN(valueSI) ? '—' : valueSI > 0 ? '∞' : `${MINUS}∞`;
    return { text: `${n} ${baseSymbol}`, plain: `${n} ${baseSymbol}`, number: n, unit: baseSymbol };
  }
  if (valueSI === 0) return { text: `0 ${baseSymbol}`, plain: `0 ${baseSymbol}`, number: '0', unit: baseSymbol };
  const { exp } = roundSig(valueSI, sigFigs);
  let e3 = Math.min(12, Math.max(-15, Math.floor(exp / 3) * 3));
  // Units that do not take prefixes in practice.
  if (baseSymbol === 'Wh' || baseSymbol === 'mAh') e3 = 0;
  const scaled = valueSI / 10 ** e3;
  const f = formatNumber(scaled, { sigFigs, notation: e3 === 0 && (exp > 11 || exp < -5) ? 'scientific' : 'auto', trimZeros });
  const unit = `${prefixFor(e3)}${baseSymbol}`;
  return { text: `${f.text} ${unit}`, plain: `${f.plain} ${unit}`, number: f.text, unit };
}

/** Text placed on the clipboard: ASCII number, a space, and the correct unit symbol. */
export function copyText(value: number, unitSymbol: string, opts: FormatOptions): string {
  return `${formatNumber(value, opts, false).plain} ${unitSymbol}`;
}

/** Ratio such as "×10", "×0.1", "×100" for comparisons. */
export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return '—';
  return `×${formatNumber(ratio, { sigFigs: 3, notation: 'auto', trimZeros: true }).text}`;
}

/** Shortest exact decimal representation, used when a value must round-trip unchanged. */
export function exactText(value: number): string {
  return String(value);
}

/** Round to n significant figures and return a plain decimal string (used for slider positions only). */
export function sliderText(value: number, sigFigs = 3): string {
  if (value === 0) return '0';
  return formatNumber(value, { sigFigs, notation: 'auto', trimZeros: true }, false).plain;
}
