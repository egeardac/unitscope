import { shiftPow10 } from './convert';
import { fail, ok, type Fix, type Result } from './result';
import { ALL_UNITS, QUANTITY_BY_ID, type QuantityId, type UnitDef } from './units';

/* ------------------------------------------------------------------------ */
/* Numbers                                                                  */
/* ------------------------------------------------------------------------ */

export interface ParsedNumber {
  value: number;
  /** Canonical ASCII form with a decimal point, e.g. "-4.7e3". */
  normalized: string;
}

const SUPERSCRIPT: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+',
};

const GROUP_SPACE = '[ \\u00A0\\u2009\\u202F]';
const INT_GROUPED = new RegExp(`^\\d{1,3}(?:${GROUP_SPACE}\\d{3})+$`);
const FRAC_GROUPED = new RegExp(`^(?:\\d{3}${GROUP_SPACE})+\\d{1,3}$`);
const HAS_SPACE = /[    ]/;

const EXAMPLES = 'Examples: 4.7 · 4,7 · −1.2 · 4.7e3 · 4.7 × 10^3 · 1 000 000.';

function superscriptToAscii(s: string): string {
  return s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/g, (c) => SUPERSCRIPT[c] ?? c);
}

/**
 * Parse a number typed by a person.
 *
 * Accepted: decimal point or decimal comma, e/E exponents, "× 10^n" and
 * superscript exponents, + / − / U+2212 signs, and spaces that group digits in
 * threes. Rejected rather than guessed: mixed separators, repeated separators,
 * and "1,000"-style input where a comma followed by exactly three digits could
 * be either a thousands separator or a decimal comma.
 */
export function parseNumber(raw: string): Result<ParsedNumber> {
  let s = raw.trim();
  if (s === '') return fail('EMPTY', 'Enter a value.');
  s = s.replace(/[−‒–]/g, '-');

  let mantissa = s;
  let exponent: string | null = null;
  const pow = s.match(/^(.*?)\s*[×xX*·⋅]\s*10\s*(?:\^|\*\*)?\s*([+-]?\d+|[⁺⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
  if (pow) {
    mantissa = pow[1] ?? '';
    exponent = superscriptToAscii(pow[2] ?? '');
  } else {
    const e = s.match(/^(.*?)[eE]\s*([+-]?\d+)$/);
    if (e) {
      mantissa = e[1] ?? '';
      exponent = e[2] ?? null;
    }
  }
  mantissa = mantissa.trim();

  let negative = false;
  if (mantissa.startsWith('-') || mantissa.startsWith('+')) {
    negative = mantissa.startsWith('-');
    mantissa = mantissa.slice(1).trimStart();
  }
  if (mantissa === '' || /[^0-9.,    ]/.test(mantissa)) {
    return fail('INVALID_NUMBER', `“${raw.trim()}” is not a valid number. ${EXAMPLES}`);
  }

  const dots = (mantissa.match(/\./g) ?? []).length;
  const commas = (mantissa.match(/,/g) ?? []).length;
  if (dots > 0 && commas > 0) {
    return fail(
      'MIXED_SEPARATORS',
      `“${raw.trim()}” mixes a point and a comma. Use one decimal separator only; thousands separators are not accepted (group digits with spaces, e.g. 1 000 000).`,
    );
  }
  if (dots + commas > 1) {
    return fail(
      'MULTIPLE_SEPARATORS',
      `“${raw.trim()}” has more than one separator. Thousands separators are not accepted: type 1000000 or group digits with spaces (1 000 000).`,
    );
  }
  const sep = dots ? '.' : commas ? ',' : null;
  const [intRaw = '', fracRaw = ''] = sep ? mantissa.split(sep) : [mantissa];

  if (HAS_SPACE.test(intRaw) && !INT_GROUPED.test(intRaw)) {
    return fail('BAD_GROUPING', `Digits separated by spaces must be grouped in threes (e.g. 1 000 000). ${EXAMPLES}`);
  }
  if (HAS_SPACE.test(fracRaw) && !FRAC_GROUPED.test(fracRaw)) {
    return fail('BAD_GROUPING', `Decimal digits separated by spaces must be grouped in threes (e.g. 0.000 001). ${EXAMPLES}`);
  }
  const intDigits = intRaw.replace(/\D/g, '');
  const fracDigits = fracRaw.replace(/\D/g, '');
  if (intDigits === '' && fracDigits === '') {
    return fail('INVALID_NUMBER', `“${raw.trim()}” is not a valid number. ${EXAMPLES}`);
  }

  if (sep === ',' && /^[1-9]\d{0,2}$/.test(intDigits) && fracDigits.length === 3 && !HAS_SPACE.test(intRaw)) {
    const signStr = negative ? '-' : '';
    const expStr = exponent ? `e${exponent}` : '';
    return fail(
      'AMBIGUOUS_SEPARATOR',
      `“${raw.trim()}” is ambiguous: a comma followed by three digits could be a thousands separator (${intDigits}${fracDigits}) or a decimal comma (${intDigits}.${fracDigits}). Choose one below.`,
      [
        { kind: 'replace-text', text: `${signStr}${intDigits}${fracDigits}${expStr}`, label: `Use ${signStr}${intDigits}${fracDigits}${expStr}` },
        { kind: 'replace-text', text: `${signStr}${intDigits}.${fracDigits}${expStr}`, label: `Use ${signStr}${intDigits}.${fracDigits}${expStr}` },
      ],
    );
  }

  const normalized =
    (negative ? '-' : '') + (intDigits || '0') + (fracDigits ? `.${fracDigits}` : '') + (exponent ? `e${exponent}` : '');
  let value = Number(normalized);
  if (Number.isNaN(value)) {
    return fail('INVALID_NUMBER', `“${raw.trim()}” is not a valid number. ${EXAMPLES}`);
  }
  if (!Number.isFinite(value)) {
    return fail('OVERFLOW', 'The value is too large to represent (beyond ±1.8 × 10³⁰⁸).');
  }
  if (value === 0 && /[1-9]/.test(intDigits + fracDigits)) {
    return fail('UNDERFLOW', 'The value is too small to represent (below about 5 × 10⁻³²⁴) and would become zero.');
  }
  if (Object.is(value, -0)) value = 0;
  return ok({ value, normalized: Object.is(Number(normalized), -0) ? '0' : normalized });
}

/* ------------------------------------------------------------------------ */
/* Splitting "4.7 kΩ" into number and unit text                              */
/* ------------------------------------------------------------------------ */

export function splitValueAndUnit(raw: string): { numberText: string; unitText: string } {
  const s = raw.trim();
  let i = 0;
  let seenDigit = false;
  while (i < s.length) {
    const c = s[i] as string;
    const rest = s.slice(i);
    if (/[0-9]/.test(c)) {
      seenDigit = true;
      i++;
      continue;
    }
    if (/[.,+\-−‒–    ^⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/.test(c)) {
      i++;
      continue;
    }
    if ((c === 'e' || c === 'E') && seenDigit && /^[eE]\s*[+\-−]?\d/.test(rest)) {
      i++;
      continue;
    }
    if (/[×xX*·⋅]/.test(c) && seenDigit && /^[×xX*·⋅]\s*10/.test(rest)) {
      i++;
      continue;
    }
    break;
  }
  return { numberText: s.slice(0, i).trim(), unitText: s.slice(i).trim() };
}

/* ------------------------------------------------------------------------ */
/* Units                                                                    */
/* ------------------------------------------------------------------------ */

const PREFIXES: Array<[string, string]> = [
  ['p', 'p'], ['n', 'n'], ['u', 'µ'], ['µ', 'µ'], ['m', 'm'], ['k', 'k'], ['M', 'M'], ['G', 'G'],
];

/** Base symbols; base names are matched case-insensitively where unambiguous. */
const BASES: Array<[RegExp, string]> = [
  [/^v$/i, 'V'],
  [/^(a|amps?)$/i, 'A'],
  [/^(ohms?|Ω)$/i, 'Ω'],
  [/^f$/i, 'F'],
  [/^h$/i, 'H'],
  [/^w$/i, 'W'],
  [/^hz$/i, 'Hz'],
  [/^s$/, 's'],
  [/^j$/i, 'J'],
  [/^wh$/i, 'Wh'],
  [/^c$/i, 'C'],
  [/^ah$/i, 'Ah'],
  [/^m$/, 'm'],
];

const SYMBOL_INDEX = new Map<string, UnitDef>(ALL_UNITS.map((x) => [x.symbol, x]));

const NAME_INDEX = new Map<string, UnitDef>();
for (const x of ALL_UNITS) {
  const names = [x.name, `${x.name}s`];
  if (x.name.endsWith('metre')) {
    const us = x.name.replace('metre', 'meter');
    names.push(`${x.name}s`, us, `${us}s`);
  }
  if (x.name === 'mil (thou)') names.push('mil', 'mils', 'thou');
  if (x.name === 'inch') names.push('inches');
  for (const n of names) NAME_INDEX.set(n.toLowerCase(), x);
}

function normalizeUnitText(raw: string): string {
  return raw
    .trim()
    .replace(/μ/g, 'µ') // Greek mu → micro sign
    .replace(/Ω/g, 'Ω') // ohm sign → Greek capital omega
    .replace(/[·⋅]/g, '')
    .replace(/\s+/g, '');
}

/** Find a unit anywhere in the catalog, without quantity restriction. */
export function lookupUnit(raw: string): UnitDef | undefined {
  const s = normalizeUnitText(raw);
  if (s === '') return undefined;
  const exact = ALL_UNITS.find((x) => x.symbol === s || x.id === s || x.aliases.includes(s));
  if (exact) return exact;
  const byName = NAME_INDEX.get(s.toLowerCase());
  if (byName) return byName;
  for (const [, baseSym] of BASES.filter(([re]) => re.test(s))) {
    const hit = SYMBOL_INDEX.get(baseSym);
    if (hit) return hit;
  }
  for (const [p, sym] of PREFIXES) {
    if (!s.startsWith(p) || s.length === p.length) continue;
    const rest = s.slice(p.length);
    for (const [re, baseSym] of BASES) {
      if (re.test(rest)) {
        const hit = SYMBOL_INDEX.get(sym + baseSym);
        if (hit) return hit;
      }
    }
  }
  return undefined;
}

function unitList(q: QuantityId, allowParamOnly: boolean): string {
  return QUANTITY_BY_ID[q].units
    .filter((x) => allowParamOnly || !x.paramOnly)
    .map((x) => x.symbol)
    .join(', ');
}

export interface ResolveOptions {
  /** Accept units such as min and h that exist only for model durations. */
  allowParamOnly?: boolean;
  /** Restrict to these unit ids (model parameters). */
  allowedIds?: string[];
}

/**
 * Resolve unit text for a given quantity. Errors explain case sensitivity
 * (m vs M) and offer replacements; units of another quantity produce a
 * switch-quantity suggestion instead of a silent conversion.
 */
export function resolveUnit(raw: string, quantity: QuantityId, opts: ResolveOptions = {}): Result<UnitDef> {
  const q = QUANTITY_BY_ID[quantity];
  const allowParamOnly = opts.allowParamOnly ?? false;
  const shown = raw.trim();
  const found = lookupUnit(raw);

  if (found && found.quantity === quantity) {
    const allowedById = !opts.allowedIds || opts.allowedIds.includes(found.id);
    if ((found.paramOnly && !allowParamOnly) || !allowedById) {
      return fail(
        'UNKNOWN_UNIT',
        `${found.symbol} (${found.name}) is not available here. Use one of: ${
          opts.allowedIds ? opts.allowedIds.map((id) => ALL_UNITS.find((x) => x.id === id)?.symbol ?? id).join(', ') : unitList(quantity, allowParamOnly)
        }.`,
      );
    }
    return ok(found);
  }
  if (found) {
    const other = QUANTITY_BY_ID[found.quantity];
    return fail(
      'WRONG_QUANTITY_UNIT',
      `${found.symbol} is a unit of ${other.name.toLowerCase()} (${found.name}), not ${q.name.toLowerCase()}. Converting between different quantities is a circuit calculation, not a unit conversion.`,
    );
  }

  // Case-insensitive near misses inside this quantity, e.g. "mhz" → MHz, "KHz" → kHz.
  const norm = normalizeUnitText(raw).toLowerCase().replace(/^u/, 'µ');
  const near = q.units.filter(
    (x) => (allowParamOnly || !x.paramOnly) && (x.symbol.toLowerCase() === norm || x.id.toLowerCase() === norm),
  );
  if (near.length > 0) {
    return fail(
      'UNKNOWN_UNIT',
      `“${shown}” is not a ${q.name.toLowerCase()} unit. Unit symbols are case-sensitive: m = milli (10⁻³), M = mega (10⁶), and kilo is a lowercase k. Did you mean ${near
        .map((x) => `${x.symbol} (${x.name})`)
        .join(' or ')}?`,
      near.map((x) => ({ kind: 'replace-text', text: x.symbol, label: `Use ${x.symbol}` })),
    );
  }
  return fail('UNKNOWN_UNIT', `Unknown unit “${shown}”. ${q.name} units: ${unitList(quantity, allowParamOnly)}.`);
}

const GENERIC_PREFIX: Record<string, number> = { f: -15, p: -12, n: -9, u: -6, µ: -6, m: -3, '': 0, k: 3, M: 6, G: 9, T: 12 };

/**
 * Parse an SI value for axis ranges and windows, e.g. "20 V", "5 kJ",
 * "500 µs", "2 min". Accepts any SI prefix on the quantity's base symbol plus
 * the quantity's own units. A bare number is read in the base unit.
 */
export function parseSIValue(text: string, quantity: QuantityId): Result<number> {
  const { numberText, unitText } = splitValueAndUnit(text);
  const num = parseNumber(numberText);
  if (!num.ok) return num;
  if (unitText === '') return ok(num.value.value);
  const known = lookupUnit(unitText);
  if (known && known.quantity === quantity) {
    const v = shiftPow10(num.value.value * known.mantissa, known.exp);
    return Number.isFinite(v) ? ok(v) : fail('OVERFLOW', 'The value is too large to represent.');
  }
  const base = QUANTITY_BY_ID[quantity].siSymbol;
  const u = normalizeUnitText(unitText);
  for (const [p, e] of Object.entries(GENERIC_PREFIX)) {
    if (u === `${p}${base}` || (base === 'Ω' && u.toLowerCase() === `${p}ohm`.toLowerCase() && u.startsWith(p))) {
      const v = shiftPow10(num.value.value, e);
      return Number.isFinite(v) ? ok(v) : fail('OVERFLOW', 'The value is too large to represent.');
    }
  }
  return fail('UNKNOWN_UNIT', `Unknown unit “${unitText}”. Use ${base} with an SI prefix, e.g. 5 k${base} or 20 m${base}.`);
}

/* ------------------------------------------------------------------------ */
/* Value + unit input                                                       */
/* ------------------------------------------------------------------------ */

export interface ParsedInput {
  value: number;
  normalized: string;
  unit: UnitDef;
  /** True when the unit came from text typed after the number. */
  unitFromText: boolean;
  numberText: string;
  unitText: string;
}

export interface ParseInputOptions extends ResolveOptions {
  /** Skip the sign check (used where the model validates the sign itself). */
  allowNegative?: boolean;
}

/**
 * Parse the converter field or a model parameter field: a number optionally
 * followed by a unit, e.g. "100 uF" or "4,7 kΩ".
 */
export function parseQuantityInput(
  text: string,
  quantity: QuantityId,
  fallbackUnit: UnitDef,
  opts: ParseInputOptions = {},
): Result<ParsedInput> {
  const { numberText, unitText } = splitValueAndUnit(text);
  const rebuild = (fix: Fix, part: 'number' | 'unit'): Fix => {
    if (fix.kind !== 'replace-text') return fix;
    const full = part === 'number' ? `${fix.text}${unitText ? ` ${unitText}` : ''}` : `${numberText} ${fix.text}`;
    return { ...fix, text: full };
  };

  if (numberText === '' && unitText !== '') {
    const empty = text.trim() === '';
    return fail(
      empty ? 'EMPTY' : 'INVALID_NUMBER',
      empty ? 'Enter a value.' : `Enter a number before the unit, e.g. “4.7 ${unitText}”.`,
    );
  }
  const num = parseNumber(numberText);
  if (!num.ok) {
    return { ok: false, error: { ...num.error, ...(num.error.fixes ? { fixes: num.error.fixes.map((f) => rebuild(f, 'number')) } : {}) } };
  }

  let unit = fallbackUnit;
  let unitFromText = false;
  if (unitText !== '') {
    const r = resolveUnit(unitText, quantity, opts);
    if (!r.ok) {
      if (r.error.code === 'WRONG_QUANTITY_UNIT') {
        const other = lookupUnit(unitText);
        if (other) {
          const name = QUANTITY_BY_ID[other.quantity].name;
          return fail(r.error.code, r.error.message, [
            { kind: 'switch-quantity', quantity: other.quantity, text: text.trim(), unit: other.id, label: `Switch to ${name}` },
          ]);
        }
      }
      return { ok: false, error: { ...r.error, ...(r.error.fixes ? { fixes: r.error.fixes.map((f) => rebuild(f, 'unit')) } : {}) } };
    }
    unit = r.value;
    unitFromText = true;
  }

  const q = QUANTITY_BY_ID[quantity];
  const allowNegative = opts.allowNegative ?? q.allowNegative;
  if (!allowNegative && num.value.value < 0) {
    return fail('NEGATIVE_NOT_ALLOWED', `${q.negativeReason ?? `${q.name} cannot be negative here.`} Enter a value ≥ 0.`);
  }
  return ok({ value: num.value.value, normalized: num.value.normalized, unit, unitFromText, numberText, unitText });
}
