/**
 * Quantity and unit definitions.
 *
 * Every unit is stored as an exact factor relative to the coherent SI unit of
 * its quantity: factor = mantissa × 10^exp, with an INTEGER mantissa. SI
 * prefixes therefore become exact power-of-ten shifts, and non-decimal units
 * (inch, mil, Wh, Ah) keep exact integer mantissas.
 *
 * Sources (verified):
 *  - SI prefixes p, n, µ, m, k, M, G = 10^-12 … 10^9:
 *    NIST SP 811, Chapter 4, Table 5 (SI prefixes).
 *    https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-4-two-classes-si-units-and-si-prefixes
 *  - 1 in = 2.54 cm exactly (international inch, NIST SP 811 Appendix B.8);
 *    1 mil = 0.001 in = 25.4 µm exactly.
 *  - 1 W·h = 3600 J and 1 A·h = 3600 C follow from 1 h = 3600 s
 *    (hour is accepted for use with the SI, NIST SP 811 Table 6).
 *
 * Prefix case matters: m (milli, 10^-3) and M (mega, 10^6) are different units.
 */

export type QuantityId =
  | 'voltage'
  | 'current'
  | 'resistance'
  | 'capacitance'
  | 'inductance'
  | 'power'
  | 'frequency'
  | 'time'
  | 'energy'
  | 'charge'
  | 'pcb';

export interface UnitDef {
  /** ASCII identifier, unique across all quantities; used in URLs. */
  id: string;
  /** Correct display symbol (µ is U+00B5 MICRO SIGN, Ω is U+03A9). */
  symbol: string;
  name: string;
  quantity: QuantityId;
  mantissa: number;
  exp: number;
  /** Extra exact-match spellings accepted on input. */
  aliases: string[];
  /** Units accepted only for model parameters (e.g. minutes, hours), not in the converter. */
  paramOnly?: boolean;
}

export interface QuantityDef {
  id: QuantityId;
  name: string;
  /** Conventional variable symbol used in formulas. */
  symbol: string;
  /** Coherent SI unit symbol the engine works in. */
  siSymbol: string;
  allowNegative: boolean;
  negativeReason?: string;
  units: UnitDef[];
  defaultFrom: string;
  defaultTo: string;
  defaultText: string;
  keywords: string[];
  blurb: string;
}

function u(
  id: string,
  symbol: string,
  name: string,
  quantity: QuantityId,
  mantissa: number,
  exp: number,
  aliases: string[] = [],
  paramOnly = false,
): UnitDef {
  return paramOnly
    ? { id, symbol, name, quantity, mantissa, exp, aliases, paramOnly }
    : { id, symbol, name, quantity, mantissa, exp, aliases };
}

const voltageUnits = [
  u('uV', 'µV', 'microvolt', 'voltage', 1, -6, ['uV', 'μV']),
  u('mV', 'mV', 'millivolt', 'voltage', 1, -3),
  u('V', 'V', 'volt', 'voltage', 1, 0),
  u('kV', 'kV', 'kilovolt', 'voltage', 1, 3),
];

const currentUnits = [
  u('nA', 'nA', 'nanoampere', 'current', 1, -9),
  u('uA', 'µA', 'microampere', 'current', 1, -6, ['uA', 'μA']),
  u('mA', 'mA', 'milliampere', 'current', 1, -3),
  u('A', 'A', 'ampere', 'current', 1, 0, ['amp', 'amps']),
];

const resistanceUnits = [
  u('mohm', 'mΩ', 'milliohm', 'resistance', 1, -3, ['mohm', 'mohms', 'mΩ']),
  u('ohm', 'Ω', 'ohm', 'resistance', 1, 0, ['ohm', 'ohms', 'Ω']),
  u('kohm', 'kΩ', 'kilohm', 'resistance', 1, 3, ['kohm', 'kohms', 'kΩ', 'kiloohm']),
  u('Mohm', 'MΩ', 'megohm', 'resistance', 1, 6, ['Mohm', 'Mohms', 'MΩ', 'meg', 'megaohm']),
];

const capacitanceUnits = [
  u('pF', 'pF', 'picofarad', 'capacitance', 1, -12),
  u('nF', 'nF', 'nanofarad', 'capacitance', 1, -9),
  u('uF', 'µF', 'microfarad', 'capacitance', 1, -6, ['uF', 'μF']),
  u('mF', 'mF', 'millifarad', 'capacitance', 1, -3),
  u('F', 'F', 'farad', 'capacitance', 1, 0),
];

const inductanceUnits = [
  u('nH', 'nH', 'nanohenry', 'inductance', 1, -9),
  u('uH', 'µH', 'microhenry', 'inductance', 1, -6, ['uH', 'μH']),
  u('mH', 'mH', 'millihenry', 'inductance', 1, -3),
  u('H', 'H', 'henry', 'inductance', 1, 0),
];

const powerUnits = [
  u('uW', 'µW', 'microwatt', 'power', 1, -6, ['uW', 'μW']),
  u('mW', 'mW', 'milliwatt', 'power', 1, -3),
  u('W', 'W', 'watt', 'power', 1, 0),
  u('kW', 'kW', 'kilowatt', 'power', 1, 3),
];

const frequencyUnits = [
  u('Hz', 'Hz', 'hertz', 'frequency', 1, 0),
  u('kHz', 'kHz', 'kilohertz', 'frequency', 1, 3),
  u('MHz', 'MHz', 'megahertz', 'frequency', 1, 6),
  u('GHz', 'GHz', 'gigahertz', 'frequency', 1, 9),
];

const timeUnits = [
  u('ns', 'ns', 'nanosecond', 'time', 1, -9),
  u('us', 'µs', 'microsecond', 'time', 1, -6, ['us', 'μs']),
  u('ms', 'ms', 'millisecond', 'time', 1, -3),
  u('s', 's', 'second', 'time', 1, 0, ['sec', 'secs']),
  // Accepted with the SI (NIST SP 811 Table 6); used only for model durations.
  u('min', 'min', 'minute', 'time', 6, 1, ['mins'], true),
  u('h', 'h', 'hour', 'time', 36, 2, ['hr', 'hrs'], true),
];

const energyUnits = [
  u('mJ', 'mJ', 'millijoule', 'energy', 1, -3),
  u('J', 'J', 'joule', 'energy', 1, 0),
  u('Wh', 'Wh', 'watt-hour', 'energy', 36, 2, ['W·h', 'W h']),
  u('kWh', 'kWh', 'kilowatt-hour', 'energy', 36, 5, ['kW·h', 'kW h']),
];

const chargeUnits = [
  u('mC', 'mC', 'millicoulomb', 'charge', 1, -3),
  u('C', 'C', 'coulomb', 'charge', 1, 0),
  u('mAh', 'mAh', 'milliampere-hour', 'charge', 36, -1, ['mA·h', 'mA h']),
  u('Ah', 'Ah', 'ampere-hour', 'charge', 36, 2, ['A·h', 'A h']),
];

const pcbUnits = [
  u('um', 'µm', 'micrometre', 'pcb', 1, -6, ['um', 'μm', 'micron', 'microns']),
  u('mil', 'mil', 'mil (thou)', 'pcb', 254, -7, ['mils', 'thou']),
  u('mm', 'mm', 'millimetre', 'pcb', 1, -3),
  u('in', 'in', 'inch', 'pcb', 254, -4, ['inch', 'inches', '"']),
];

export const QUANTITIES: QuantityDef[] = [
  {
    id: 'voltage',
    name: 'Voltage',
    symbol: 'V',
    siSymbol: 'V',
    allowNegative: true,
    units: voltageUnits,
    defaultFrom: 'V',
    defaultTo: 'mV',
    defaultText: '1',
    keywords: ['volt', 'potential', 'emf', 'rms', 'peak', 'pk-pk', 'ac', 'dc', 'sine', 'supply', 'battery'],
    blurb: 'DC source + resistor, or an AC sine on a scope',
  },
  {
    id: 'current',
    name: 'Current',
    symbol: 'I',
    siSymbol: 'A',
    allowNegative: true,
    units: currentUnits,
    defaultFrom: 'mA',
    defaultTo: 'A',
    defaultText: '20',
    keywords: ['amp', 'ampere', 'amperage', 'flow', 'led', 'loop', '4-20'],
    blurb: 'Current through an ideal resistor',
  },
  {
    id: 'resistance',
    name: 'Resistance',
    symbol: 'R',
    siSymbol: 'Ω',
    allowNegative: false,
    negativeReason: 'An ideal resistor has a non-negative resistance.',
    units: resistanceUnits,
    defaultFrom: 'kohm',
    defaultTo: 'ohm',
    defaultText: '4.7',
    keywords: ['ohm', 'resistor', 'load', 'pull-up', 'pullup', 'i-v', 'ohms law'],
    blurb: 'I–V line of an ideal resistor',
  },
  {
    id: 'capacitance',
    name: 'Capacitance',
    symbol: 'C',
    siSymbol: 'F',
    allowNegative: false,
    negativeReason: 'Capacitance cannot be negative.',
    units: capacitanceUnits,
    defaultFrom: 'nF',
    defaultTo: 'uF',
    defaultText: '100',
    keywords: ['farad', 'capacitor', 'cap', 'rc', 'decoupling', 'time constant', 'tau', 'filter', 'cutoff'],
    blurb: 'RC charging curve, τ = RC',
  },
  {
    id: 'inductance',
    name: 'Inductance',
    symbol: 'L',
    siSymbol: 'H',
    allowNegative: false,
    negativeReason: 'Inductance cannot be negative.',
    units: inductanceUnits,
    defaultFrom: 'mH',
    defaultTo: 'uH',
    defaultText: '2.5',
    keywords: ['henry', 'inductor', 'coil', 'choke', 'rl', 'tau'],
    blurb: 'RL current build-up, τ = L/R',
  },
  {
    id: 'power',
    name: 'Power',
    symbol: 'P',
    siSymbol: 'W',
    allowNegative: true,
    units: powerUnits,
    defaultFrom: 'mW',
    defaultTo: 'W',
    defaultText: '250',
    keywords: ['watt', 'dbm', 'dbw', 'decibel', 'db', 'rf', 'dissipation', 'rating'],
    blurb: 'Energy accumulated over time, E = P·t',
  },
  {
    id: 'frequency',
    name: 'Frequency',
    symbol: 'f',
    siSymbol: 'Hz',
    allowNegative: false,
    negativeReason: 'Frequency of a periodic signal cannot be negative.',
    units: frequencyUnits,
    defaultFrom: 'MHz',
    defaultTo: 'kHz',
    defaultText: '1',
    keywords: ['hertz', 'clock', 'oscillator', 'crystal', 'period', 'cycles', 'rf', 'omega'],
    blurb: 'Waveform and period, T = 1/f',
  },
  {
    id: 'time',
    name: 'Time',
    symbol: 't',
    siSymbol: 's',
    allowNegative: false,
    negativeReason: 'A duration cannot be negative.',
    units: timeUnits,
    defaultFrom: 'us',
    defaultTo: 'ns',
    defaultText: '1',
    keywords: ['second', 'period', 'duration', 'delay', 'pulse', 'timing'],
    blurb: 'Duration as a period, f = 1/T',
  },
  {
    id: 'energy',
    name: 'Energy',
    symbol: 'E',
    siSymbol: 'J',
    allowNegative: true,
    units: energyUnits,
    defaultFrom: 'Wh',
    defaultTo: 'J',
    defaultText: '1',
    keywords: ['joule', 'watt-hour', 'kwh', 'battery', 'work', 'consumption'],
    blurb: 'Energy target reached at constant power',
  },
  {
    id: 'charge',
    name: 'Electric charge',
    symbol: 'Q',
    siSymbol: 'C',
    allowNegative: true,
    units: chargeUnits,
    defaultFrom: 'mAh',
    defaultTo: 'C',
    defaultText: '2000',
    keywords: ['coulomb', 'mah', 'ah', 'battery', 'capacity', 'cell'],
    blurb: 'Charge accumulated at constant current, Q = I·t',
  },
  {
    id: 'pcb',
    name: 'PCB dimensions',
    symbol: 'd',
    siSymbol: 'm',
    allowNegative: false,
    negativeReason: 'A physical dimension cannot be negative.',
    units: pcbUnits,
    defaultFrom: 'mil',
    defaultTo: 'mm',
    defaultText: '6',
    keywords: ['length', 'mil', 'thou', 'trace', 'width', 'clearance', 'pitch', 'board', 'thickness', 'copper', 'inch'],
    blurb: 'Calibrated dimension diagram vs common features',
  },
];

export const QUANTITY_BY_ID: Record<QuantityId, QuantityDef> = Object.fromEntries(
  QUANTITIES.map((q) => [q.id, q]),
) as Record<QuantityId, QuantityDef>;

export const ALL_UNITS: UnitDef[] = QUANTITIES.flatMap((q) => q.units);

export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(ALL_UNITS.map((x) => [x.id, x]));

export function isQuantityId(x: unknown): x is QuantityId {
  return typeof x === 'string' && x in QUANTITY_BY_ID;
}

export function getQuantity(id: QuantityId): QuantityDef {
  return QUANTITY_BY_ID[id];
}

export function getUnit(id: string): UnitDef | undefined {
  return UNIT_BY_ID[id];
}

/** Quantity name for use inside a sentence ("convert voltage", "convert PCB dimensions"). */
export function inlineName(q: QuantityId): string {
  const n = QUANTITY_BY_ID[q].name;
  return n.startsWith('PCB') ? n : n.toLowerCase();
}

/** Units shown in the converter's From/To selectors (excludes parameter-only units). */
export function converterUnits(q: QuantityId): UnitDef[] {
  return QUANTITY_BY_ID[q].units.filter((x) => !x.paramOnly);
}

/** The coherent SI unit of a quantity, as a pseudo-unit with factor 1. */
export function siUnitOf(q: QuantityId): UnitDef {
  const def = QUANTITY_BY_ID[q];
  return { id: `${q}-si`, symbol: def.siSymbol, name: 'SI unit', quantity: q, mantissa: 1, exp: 0, aliases: [] };
}
