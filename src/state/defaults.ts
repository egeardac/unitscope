import { PARAMS, PARAM_KEYS, type ParamKey } from '../engine/params';
import { QUANTITIES, type QuantityId } from '../engine/units';
import type { AppState, ConvState, ParamState, ViewKey } from './types';

export function defaultConv(): Record<QuantityId, ConvState> {
  return Object.fromEntries(QUANTITIES.map((q) => [q.id, { text: q.defaultText, from: q.defaultFrom, to: q.defaultTo }])) as Record<
    QuantityId,
    ConvState
  >;
}

export function defaultParams(): Record<ParamKey, ParamState> {
  return Object.fromEntries(PARAM_KEYS.map((k) => [k, { text: PARAMS[k].defaultText, unit: PARAMS[k].defaultUnit }])) as Record<
    ParamKey,
    ParamState
  >;
}

export function defaultState(): AppState {
  return {
    quantity: 'voltage',
    conv: defaultConv(),
    display: { sigFigs: 6, notation: 'auto', trimZeros: true },
    params: defaultParams(),
    voltageMode: 'dc',
    ampKind: 'rms',
    refs: {},
    scales: {},
    windows: {},
    axisUnits: { energy: 'Wh', charge: 'mAh' },
    pcbFeature: 'trace10',
  };
}

export const VIEW_PARAMS: Record<ViewKey, ParamKey[]> = {
  dc: ['circuit.R'],
  ac: ['ac.f'],
  current: ['circuit.R'],
  resistance: ['circuit.V'],
  rc: ['rc.R', 'rc.Vs', 'rc.V0'],
  rl: ['rl.R', 'rl.Vs'],
  frequency: [],
  time: [],
  power: ['power.t'],
  energy: ['energy.P', 'energy.t'],
  charge: ['charge.I', 'charge.t'],
  pcb: [],
};

export const VIEW_AXES: Record<ViewKey, string[]> = {
  dc: ['dc.V', 'dc.I', 'dc.P'],
  ac: ['ac.V'],
  current: ['cur.I', 'cur.V', 'cur.P'],
  resistance: ['res.V', 'res.I'],
  rc: ['rc.V'],
  rl: ['rl.I'],
  frequency: [],
  time: [],
  power: ['pow.E'],
  energy: ['en.E'],
  charge: ['ch.Q'],
  pcb: ['pcb.d'],
};

export const VIEW_WINDOWS: Record<ViewKey, string[]> = {
  dc: [],
  ac: ['ac.t'],
  current: [],
  resistance: [],
  rc: ['rc.t'],
  rl: ['rl.t'],
  frequency: ['frequency.t'],
  time: ['time.t'],
  power: [],
  energy: [],
  charge: [],
  pcb: [],
};

export function viewOf(state: Pick<AppState, 'quantity' | 'voltageMode'>): ViewKey {
  switch (state.quantity) {
    case 'voltage':
      return state.voltageMode === 'ac' ? 'ac' : 'dc';
    case 'current':
      return 'current';
    case 'resistance':
      return 'resistance';
    case 'capacitance':
      return 'rc';
    case 'inductance':
      return 'rl';
    case 'frequency':
      return 'frequency';
    case 'time':
      return 'time';
    case 'power':
      return 'power';
    case 'energy':
      return 'energy';
    case 'charge':
      return 'charge';
    case 'pcb':
      return 'pcb';
  }
}
