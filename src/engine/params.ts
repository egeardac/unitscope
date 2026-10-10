import type { QuantityId } from './units';

/**
 * Model parameters. Each is stored by the app as {text, unit} and parsed by
 * the same engine functions as the converter. Slider ranges describe the
 * SLIDER only; the engine accepts any valid typed value outside them.
 */

export type ParamKey =
  | 'circuit.R'
  | 'circuit.V'
  | 'ac.f'
  | 'rc.R'
  | 'rc.Vs'
  | 'rc.V0'
  | 'rl.R'
  | 'rl.Vs'
  | 'power.t'
  | 'energy.P'
  | 'energy.t'
  | 'charge.I'
  | 'charge.t';

export interface SliderSpec {
  kind: 'log' | 'linear';
  /** SI units. */
  min: number;
  max: number;
}

export interface ParamDef {
  key: ParamKey;
  label: string;
  symbol: string;
  quantity: QuantityId;
  unitIds: string[];
  defaultText: string;
  defaultUnit: string;
  allowNegative: boolean;
  slider: SliderSpec;
  help: string;
}

const R_UNITS = ['mohm', 'ohm', 'kohm', 'Mohm'];
const V_UNITS = ['uV', 'mV', 'V', 'kV'];
const T_UNITS = ['ms', 's', 'min', 'h'];

export const PARAMS: Record<ParamKey, ParamDef> = {
  'circuit.R': {
    key: 'circuit.R', label: 'Resistance', symbol: 'R', quantity: 'resistance', unitIds: R_UNITS,
    defaultText: '1', defaultUnit: 'kohm', allowNegative: false,
    slider: { kind: 'log', min: 1, max: 10e6 },
    help: 'Ideal resistor across the source.',
  },
  'circuit.V': {
    key: 'circuit.V', label: 'Applied voltage', symbol: 'V', quantity: 'voltage', unitIds: V_UNITS,
    defaultText: '5', defaultUnit: 'V', allowNegative: true,
    slider: { kind: 'linear', min: -30, max: 30 },
    help: 'Ideal DC source voltage across the resistor; sets the operating point.',
  },
  'ac.f': {
    key: 'ac.f', label: 'Frequency', symbol: 'f', quantity: 'frequency', unitIds: ['Hz', 'kHz', 'MHz', 'GHz'],
    defaultText: '50', defaultUnit: 'Hz', allowNegative: false,
    slider: { kind: 'log', min: 1, max: 10e9 },
    help: 'Sine frequency. The scope window is locked; use “Fit 3 cycles” to re-frame.',
  },
  'rc.R': {
    key: 'rc.R', label: 'Series resistance', symbol: 'R', quantity: 'resistance', unitIds: R_UNITS,
    defaultText: '1', defaultUnit: 'kohm', allowNegative: false,
    slider: { kind: 'log', min: 1, max: 10e6 },
    help: 'Resistor in series with the capacitor.',
  },
  'rc.Vs': {
    key: 'rc.Vs', label: 'Source step', symbol: 'Vs', quantity: 'voltage', unitIds: V_UNITS,
    defaultText: '5', defaultUnit: 'V', allowNegative: true,
    slider: { kind: 'linear', min: -30, max: 30 },
    help: 'Ideal DC source switched on at t = 0; the final capacitor voltage.',
  },
  'rc.V0': {
    key: 'rc.V0', label: 'Initial capacitor voltage', symbol: 'V0', quantity: 'voltage', unitIds: V_UNITS,
    defaultText: '0', defaultUnit: 'V', allowNegative: true,
    slider: { kind: 'linear', min: -30, max: 30 },
    help: 'Capacitor voltage just before the switch closes.',
  },
  'rl.R': {
    key: 'rl.R', label: 'Series resistance', symbol: 'R', quantity: 'resistance', unitIds: R_UNITS,
    defaultText: '10', defaultUnit: 'ohm', allowNegative: false,
    slider: { kind: 'log', min: 0.1, max: 100e3 },
    help: 'Total series resistance (including the coil’s own resistance).',
  },
  'rl.Vs': {
    key: 'rl.Vs', label: 'Source step', symbol: 'Vs', quantity: 'voltage', unitIds: V_UNITS,
    defaultText: '5', defaultUnit: 'V', allowNegative: true,
    slider: { kind: 'linear', min: -30, max: 30 },
    help: 'Ideal DC source switched on at t = 0 with zero initial current.',
  },
  'power.t': {
    key: 'power.t', label: 'Duration', symbol: 't', quantity: 'time', unitIds: T_UNITS,
    defaultText: '1', defaultUnit: 'h', allowNegative: false,
    slider: { kind: 'log', min: 1, max: 360000 },
    help: 'How long the constant power is applied. Also sets the graph window.',
  },
  'energy.P': {
    key: 'energy.P', label: 'Constant power', symbol: 'P', quantity: 'power', unitIds: ['uW', 'mW', 'W', 'kW'],
    defaultText: '10', defaultUnit: 'W', allowNegative: true,
    slider: { kind: 'log', min: 1e-3, max: 10e3 },
    help: 'Power delivered at a constant rate.',
  },
  'energy.t': {
    key: 'energy.t', label: 'Window', symbol: 't', quantity: 'time', unitIds: T_UNITS,
    defaultText: '10', defaultUnit: 'min', allowNegative: false,
    slider: { kind: 'log', min: 1, max: 360000 },
    help: 'Time span shown on the graph.',
  },
  'charge.I': {
    key: 'charge.I', label: 'Constant current', symbol: 'I', quantity: 'current', unitIds: ['nA', 'uA', 'mA', 'A'],
    defaultText: '500', defaultUnit: 'mA', allowNegative: true,
    slider: { kind: 'log', min: 1e-6, max: 100 },
    help: 'Current held constant while charge accumulates.',
  },
  'charge.t': {
    key: 'charge.t', label: 'Window', symbol: 't', quantity: 'time', unitIds: T_UNITS,
    defaultText: '5', defaultUnit: 'h', allowNegative: false,
    slider: { kind: 'log', min: 1, max: 360000 },
    help: 'Time span shown on the graph.',
  },
};

export const PARAM_KEYS = Object.keys(PARAMS) as ParamKey[];

export function isParamKey(x: string): x is ParamKey {
  return x in PARAMS;
}

/** Main-value slider per quantity (SI units). */
export const MAIN_SLIDER: Record<QuantityId, SliderSpec> = {
  voltage: { kind: 'linear', min: -30, max: 30 },
  current: { kind: 'linear', min: -0.1, max: 0.1 },
  resistance: { kind: 'log', min: 1, max: 10e6 },
  capacitance: { kind: 'log', min: 1e-12, max: 10e-3 },
  inductance: { kind: 'log', min: 1e-9, max: 10 },
  power: { kind: 'log', min: 1e-6, max: 10e3 },
  frequency: { kind: 'log', min: 1, max: 10e9 },
  time: { kind: 'log', min: 1e-9, max: 10 },
  energy: { kind: 'log', min: 1e-3, max: 36e6 },
  charge: { kind: 'log', min: 1e-3, max: 360000 },
  pcb: { kind: 'log', min: 1e-6, max: 0.1 },
};

export const SLIDER_STEPS = 1000;

/** Slider position (0…SLIDER_STEPS) → SI value. */
export function sliderToValue(spec: SliderSpec, pos: number): number {
  const p = Math.min(SLIDER_STEPS, Math.max(0, pos)) / SLIDER_STEPS;
  if (spec.kind === 'linear') return spec.min + (spec.max - spec.min) * p;
  return spec.min * (spec.max / spec.min) ** p;
}

/** SI value → slider position, plus whether the value lies outside the slider's range. */
export function valueToSlider(spec: SliderSpec, value: number): { pos: number; outside: 'below' | 'above' | null } {
  if (!Number.isFinite(value)) return { pos: 0, outside: null };
  if (value < spec.min) return { pos: 0, outside: 'below' };
  if (value > spec.max) return { pos: SLIDER_STEPS, outside: 'above' };
  if (spec.kind === 'linear') return { pos: ((value - spec.min) / (spec.max - spec.min)) * SLIDER_STEPS, outside: null };
  return { pos: (Math.log(value / spec.min) / Math.log(spec.max / spec.min)) * SLIDER_STEPS, outside: null };
}
