import type { AmplitudeKind } from '../engine/models/acSine';
import type { Notation } from '../engine/format';
import type { ParamKey } from '../engine/params';
import type { ScaleState } from '../engine/scale';
import type { QuantityId } from '../engine/units';
import type { Fix } from '../engine/result';
import type { Preset } from '../engine/presets';

export interface ConvState {
  /** Exactly what the person typed; never reformatted by the app. */
  text: string;
  from: string;
  to: string;
}

export interface ParamState {
  text: string;
  unit: string;
}

export interface DisplaySettings {
  sigFigs: number;
  notation: Notation;
  trimZeros: boolean;
}

export type ViewKey =
  | 'dc'
  | 'ac'
  | 'current'
  | 'resistance'
  | 'rc'
  | 'rl'
  | 'frequency'
  | 'time'
  | 'power'
  | 'energy'
  | 'charge'
  | 'pcb';

export type EnergyAxisUnit = 'J' | 'Wh';
export type ChargeAxisUnit = 'C' | 'mAh';

export interface AppState {
  quantity: QuantityId;
  conv: Record<QuantityId, ConvState>;
  display: DisplaySettings;
  params: Record<ParamKey, ParamState>;
  voltageMode: 'dc' | 'ac';
  ampKind: AmplitudeKind;
  /** Pinned reference snapshots per view, in SI units. */
  refs: Partial<Record<ViewKey, Record<string, number>>>;
  /** Vertical/value axes, keyed like "dc.V". */
  scales: Record<string, ScaleState>;
  /** Locked time windows in seconds, keyed like "rc.t". */
  windows: Record<string, number>;
  axisUnits: { energy: EnergyAxisUnit; charge: ChargeAxisUnit };
  pcbFeature: string;
}

export type Action =
  | { type: 'setQuantity'; quantity: QuantityId }
  | { type: 'setText'; text: string }
  | { type: 'setFrom'; unit: string }
  | { type: 'setTo'; unit: string }
  | { type: 'swap' }
  | { type: 'setMainSI'; value: number }
  | { type: 'useRepresentation'; text: string; unit: string }
  | { type: 'setDisplay'; patch: Partial<DisplaySettings> }
  | { type: 'setParamText'; key: ParamKey; text: string }
  | { type: 'setParamUnit'; key: ParamKey; unit: string }
  | { type: 'setParamSI'; key: ParamKey; value: number }
  | { type: 'setVoltageMode'; mode: 'dc' | 'ac' }
  | { type: 'setAmpKind'; kind: AmplitudeKind }
  | { type: 'pinRef' }
  | { type: 'clearRef' }
  | { type: 'setScale'; axis: string; scale: ScaleState }
  | { type: 'fitScales' }
  | { type: 'setWindow'; key: string; value: number }
  | { type: 'fitWindow'; key: string }
  | { type: 'setAxisUnit'; which: 'energy'; unit: EnergyAxisUnit }
  | { type: 'setAxisUnit'; which: 'charge'; unit: ChargeAxisUnit }
  | { type: 'setPcbFeature'; id: string }
  | { type: 'applyFix'; fix: Fix }
  | { type: 'applyPreset'; preset: Preset }
  | { type: 'restore'; quantity: QuantityId; conv: ConvState; voltageMode?: 'dc' | 'ac' }
  | { type: 'replace'; state: AppState };
