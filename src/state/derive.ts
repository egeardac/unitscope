/**
 * Derived calculation state. Every number shown anywhere in the UI (converter
 * result, readouts, sliders, graphs, circuit diagrams) comes from here, and
 * everything here comes from the engine. Nothing is rounded.
 */
import { convert, toSI } from '../engine/convert';
import { parseQuantityInput, type ParsedInput } from '../engine/parse';
import { PARAMS, PARAM_KEYS, type ParamKey } from '../engine/params';
import { fail, ok, type Result } from '../engine/result';
import { niceCeil } from '../engine/scale';
import { getQuantity, getUnit, type UnitDef } from '../engine/units';
import { dcFromCurrent, dcFromVoltage, type DcResult } from '../engine/models/dcResistor';
import { checkFrequency, sineAmplitudes, type SineAmplitudes } from '../engine/models/acSine';
import { frequencyFromPeriod, periodFromFrequency } from '../engine/models/periodic';
import { rcModel, type RcModel } from '../engine/models/rc';
import { rlModel, type RlModel } from '../engine/models/rl';
import { accumulate, timeToReach } from '../engine/models/accumulate';
import { PCB_FEATURE_BY_ID, PCB_FEATURES, type PcbFeature } from '../engine/models/pcb';
import { viewOf } from './defaults';
import type { AppState, ViewKey } from './types';

export interface Conversion {
  input: ParsedInput;
  from: UnitDef;
  to: UnitDef;
  /** Value in the coherent SI unit; identical for 1 V, 1000 mV and 1 000 000 µV. */
  si: number;
  result: number;
}

export interface AxisInfo {
  magnitudes: number[];
  /** Bench range used on first view; null means "fit to the values". */
  defaultSpan: number | null;
  bipolar: boolean;
}

export type ViewModel =
  | { kind: 'dc'; main: Result<DcResult>; ref: DcResult | null }
  | { kind: 'current'; main: Result<DcResult>; ref: DcResult | null }
  | { kind: 'resistance'; main: Result<DcResult>; ref: DcResult | null }
  | { kind: 'ac'; main: Result<{ amps: SineAmplitudes; f: number; T: number }>; ref: { amps: SineAmplitudes; f: number } | null }
  | { kind: 'rc'; main: Result<RcModel>; ref: RcModel | null }
  | { kind: 'rl'; main: Result<RlModel>; ref: RlModel | null }
  | { kind: 'frequency'; main: Result<{ f: number; T: number }>; ref: { f: number; T: number } | null }
  | { kind: 'time'; main: Result<{ f: number; T: number }>; ref: { f: number; T: number } | null }
  | { kind: 'power'; main: Result<{ P: number; duration: number; E: number }>; ref: { P: number } | null }
  | {
      kind: 'energy';
      main: Result<{ E: number; P: number; window: number; reach: Result<number> }>;
      ref: { E: number } | null;
    }
  | {
      kind: 'charge';
      main: Result<{ Q: number; I: number; window: number; reach: Result<number> }>;
      ref: { Q: number } | null;
    }
  | { kind: 'pcb'; main: Result<{ d: number; feature: PcbFeature }>; ref: { d: number } | null };

export interface Derived {
  view: ViewKey;
  conversion: Result<Conversion>;
  si: Result<number>;
  params: Record<ParamKey, Result<number>>;
  model: ViewModel;
  axes: Record<string, AxisInfo>;
  /** Natural window per time axis (3 periods, 5τ), used for first view and "Fit". */
  naturalWindows: Record<string, number | null>;
}

export function computeConversion(state: AppState): Result<Conversion> {
  const c = state.conv[state.quantity];
  const from = getUnit(c.from) ?? getUnit(getQuantity(state.quantity).defaultFrom)!;
  const to = getUnit(c.to) ?? getUnit(getQuantity(state.quantity).defaultTo)!;
  const parsed = parseQuantityInput(c.text, state.quantity, from);
  if (!parsed.ok) return parsed;
  const unit = parsed.value.unit;
  const si = toSI(parsed.value.value, unit);
  if (!si.ok) return si;
  const result = convert(parsed.value.value, unit, to);
  if (!result.ok) return result;
  return ok({ input: parsed.value, from: unit, to, si: si.value, result: result.value });
}

export function computeParam(state: AppState, key: ParamKey): Result<number> {
  const def = PARAMS[key];
  const p = state.params[key];
  const unit = getUnit(p.unit) ?? getUnit(def.defaultUnit)!;
  const parsed = parseQuantityInput(p.text, def.quantity, unit, {
    allowParamOnly: true,
    allowedIds: def.unitIds,
    allowNegative: def.allowNegative,
  });
  if (!parsed.ok) return parsed;
  return toSI(parsed.value.value, parsed.value.unit);
}

function need<T>(r: Result<number>, label: string, then: (v: number) => Result<T>): Result<T> {
  if (!r.ok) {
    if (r.error.code === 'EMPTY') return fail('MISSING_PARAMETER', `Enter ${label} to see the model.`);
    return { ok: false, error: { ...r.error, message: `${label[0]!.toUpperCase()}${label.slice(1)}: ${r.error.message}` } };
  }
  return then(r.value);
}

function mainNeed<T>(r: Result<number>, then: (v: number) => Result<T>): Result<T> {
  if (!r.ok) {
    if (r.error.code === 'EMPTY') return fail('EMPTY', 'Enter a value in the converter to see the model.');
    return r;
  }
  return then(r.value);
}

const okOrNull = <T>(r: Result<T>): T | null => (r.ok ? r.value : null);

function buildModel(view: ViewKey, state: AppState, si: Result<number>, P: Record<ParamKey, Result<number>>): ViewModel {
  const ref = state.refs[view];
  switch (view) {
    case 'dc':
      return {
        kind: 'dc',
        main: mainNeed(si, (V) => need(P['circuit.R'], 'the resistance', (R) => dcFromVoltage(V, R))),
        ref: ref ? okOrNull(dcFromVoltage(ref.V ?? NaN, ref.R ?? NaN)) : null,
      };
    case 'current':
      return {
        kind: 'current',
        main: mainNeed(si, (I) => need(P['circuit.R'], 'the resistance', (R) => dcFromCurrent(I, R))),
        ref: ref ? okOrNull(dcFromCurrent(ref.I ?? NaN, ref.R ?? NaN)) : null,
      };
    case 'resistance':
      return {
        kind: 'resistance',
        main: mainNeed(si, (R) => need(P['circuit.V'], 'the applied voltage', (V) => dcFromVoltage(V, R))),
        ref: ref ? okOrNull(dcFromVoltage(ref.V ?? NaN, ref.R ?? NaN)) : null,
      };
    case 'ac': {
      const main = mainNeed(si, (v) =>
        need(P['ac.f'], 'the frequency', (fRaw) => {
          const amps = sineAmplitudes(v, state.ampKind);
          if (!amps.ok) return amps;
          const f = checkFrequency(fRaw);
          if (!f.ok) return f;
          const T = periodFromFrequency(f.value);
          if (!T.ok) return T;
          return ok({ amps: amps.value, f: f.value, T: T.value });
        }),
      );
      let refModel: { amps: SineAmplitudes; f: number } | null = null;
      if (ref) {
        const a = sineAmplitudes(ref.peak ?? NaN, 'peak');
        if (a.ok && Number.isFinite(ref.f) && (ref.f ?? 0) > 0) refModel = { amps: a.value, f: ref.f! };
      }
      return { kind: 'ac', main, ref: refModel };
    }
    case 'rc':
      return {
        kind: 'rc',
        main: mainNeed(si, (C) =>
          need(P['rc.R'], 'the resistance', (R) =>
            need(P['rc.Vs'], 'the source voltage', (Vs) => need(P['rc.V0'], 'the initial voltage', (V0) => rcModel(R, C, Vs, V0))),
          ),
        ),
        ref: ref ? okOrNull(rcModel(ref.R ?? NaN, ref.C ?? NaN, ref.Vs ?? NaN, ref.V0 ?? NaN)) : null,
      };
    case 'rl':
      return {
        kind: 'rl',
        main: mainNeed(si, (L) =>
          need(P['rl.R'], 'the resistance', (R) => need(P['rl.Vs'], 'the source voltage', (Vs) => rlModel(L, R, Vs))),
        ),
        ref: ref ? okOrNull(rlModel(ref.L ?? NaN, ref.R ?? NaN, ref.Vs ?? NaN)) : null,
      };
    case 'frequency': {
      const main = mainNeed(si, (f) => {
        const T = periodFromFrequency(f);
        return T.ok ? ok({ f, T: T.value }) : T;
      });
      const r = ref ? periodFromFrequency(ref.f ?? NaN) : null;
      return { kind: 'frequency', main, ref: ref && r?.ok ? { f: ref.f!, T: r.value } : null };
    }
    case 'time': {
      const main = mainNeed(si, (T) => {
        const f = frequencyFromPeriod(T);
        return f.ok ? ok({ f: f.value, T }) : f;
      });
      const r = ref ? frequencyFromPeriod(ref.T ?? NaN) : null;
      return { kind: 'time', main, ref: ref && r?.ok ? { f: r.value, T: ref.T! } : null };
    }
    case 'power':
      return {
        kind: 'power',
        main: mainNeed(si, (Pw) =>
          need(P['power.t'], 'the duration', (t) => {
            if (t === 0) return fail('INVALID_PARAMETER', 'Duration: enter a duration greater than 0 s to see energy accumulate.');
            const E = accumulate(Pw, t);
            return E.ok ? ok({ P: Pw, duration: t, E: E.value }) : E;
          }),
        ),
        ref: ref && Number.isFinite(ref.P) ? { P: ref.P! } : null,
      };
    case 'energy':
      return {
        kind: 'energy',
        main: mainNeed(si, (E) =>
          need(P['energy.P'], 'the power', (Pw) =>
            need(P['energy.t'], 'the window', (w) => {
              if (w === 0) return fail('INVALID_PARAMETER', 'Window: enter a time window greater than 0 s.');
              return ok({ E, P: Pw, window: w, reach: timeToReach(E, Pw, 'power') });
            }),
          ),
        ),
        ref: ref && Number.isFinite(ref.E) ? { E: ref.E! } : null,
      };
    case 'charge':
      return {
        kind: 'charge',
        main: mainNeed(si, (Q) =>
          need(P['charge.I'], 'the current', (I) =>
            need(P['charge.t'], 'the window', (w) => {
              if (w === 0) return fail('INVALID_PARAMETER', 'Window: enter a time window greater than 0 s.');
              return ok({ Q, I, window: w, reach: timeToReach(Q, I, 'current') });
            }),
          ),
        ),
        ref: ref && Number.isFinite(ref.Q) ? { Q: ref.Q! } : null,
      };
    case 'pcb': {
      const feature = PCB_FEATURE_BY_ID[state.pcbFeature] ?? PCB_FEATURES[0]!;
      return {
        kind: 'pcb',
        main: mainNeed(si, (d) => ok({ d, feature })),
        ref: ref && Number.isFinite(ref.d) ? { d: ref.d! } : null,
      };
    }
  }
}

function buildAxes(model: ViewModel, state: AppState): { axes: Record<string, AxisInfo>; naturalWindows: Record<string, number | null> } {
  const axes: Record<string, AxisInfo> = {};
  const naturalWindows: Record<string, number | null> = {};
  const fin = (xs: Array<number | null | undefined>) => xs.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));

  switch (model.kind) {
    case 'dc':
    case 'current': {
      const m = model.main.ok ? model.main.value : null;
      const r = model.ref;
      const neg = (m?.V ?? 0) < 0 || (m?.I ?? 0) < 0 || (r?.V ?? 0) < 0;
      const R = m?.R ?? r?.R ?? 1000;
      const key = model.kind === 'dc' ? 'dc' : 'cur';
      const vDefault = model.kind === 'dc' ? 20 : niceCeil(0.05 * R);
      const iDefault = model.kind === 'dc' ? niceCeil(20 / R) : 0.05;
      const pDefault = model.kind === 'dc' ? niceCeil(400 / R) : niceCeil(0.0025 * R);
      axes[`${key}.V`] = { magnitudes: fin([m?.V, r?.V]), defaultSpan: R > 0 ? vDefault : null, bipolar: neg };
      axes[`${key}.I`] = { magnitudes: fin([m?.I, r?.I]), defaultSpan: R > 0 ? iDefault : null, bipolar: neg };
      axes[`${key}.P`] = { magnitudes: fin([m?.P, r?.P]), defaultSpan: R > 0 ? pDefault : null, bipolar: false };
      break;
    }
    case 'resistance': {
      const m = model.main.ok ? model.main.value : null;
      const r = model.ref;
      axes['res.V'] = { magnitudes: fin([m?.V, r?.V]), defaultSpan: 20, bipolar: true };
      const R = m?.R ?? 1000;
      axes['res.I'] = { magnitudes: fin([m?.I, r?.I]), defaultSpan: R > 0 ? niceCeil(20 / R) : null, bipolar: true };
      break;
    }
    case 'ac': {
      const m = model.main.ok ? model.main.value : null;
      axes['ac.V'] = { magnitudes: fin([m?.amps.peak, model.ref?.amps.peak]), defaultSpan: 20, bipolar: true };
      naturalWindows['ac.t'] = m ? 3 * m.T : null;
      break;
    }
    case 'rc': {
      const m = model.main.ok ? model.main.value : null;
      const r = model.ref;
      const neg = (m?.Vs ?? 0) < 0 || (m?.V0 ?? 0) < 0 || (r?.Vs ?? 0) < 0 || (r?.V0 ?? 0) < 0;
      axes['rc.V'] = { magnitudes: fin([m?.Vs, m?.V0, r?.Vs, r?.V0]), defaultSpan: 10, bipolar: neg };
      naturalWindows['rc.t'] = m ? 5 * m.tau : null;
      break;
    }
    case 'rl': {
      const m = model.main.ok ? model.main.value : null;
      const r = model.ref;
      const win = state.windows['rl.t'];
      const rampEnd = m && m.ramp && win ? m.iAt(win) : null;
      const neg = (m?.Vs ?? 0) < 0 || (r?.Vs ?? 0) < 0;
      axes['rl.I'] = { magnitudes: fin([m?.iFinal, rampEnd, r?.iFinal]), defaultSpan: null, bipolar: neg };
      naturalWindows['rl.t'] = m ? (m.tau !== null ? 5 * m.tau : (win ?? 1e-3)) : null;
      break;
    }
    case 'frequency':
    case 'time': {
      const m = model.main.ok ? model.main.value : null;
      naturalWindows[`${model.kind}.t`] = m ? 3 * m.T : null;
      break;
    }
    case 'power': {
      const m = model.main.ok ? model.main.value : null;
      const refE = model.ref && m ? model.ref.P * m.duration : null;
      const neg = (m?.P ?? 0) < 0 || (model.ref?.P ?? 0) < 0;
      axes['pow.E'] = { magnitudes: fin([m?.E, refE]), defaultSpan: null, bipolar: neg };
      break;
    }
    case 'energy': {
      const m = model.main.ok ? model.main.value : null;
      const neg = (m?.E ?? 0) < 0 || (m?.P ?? 0) < 0 || (model.ref?.E ?? 0) < 0;
      axes['en.E'] = { magnitudes: fin([m?.E, m ? m.P * m.window : null, model.ref?.E]), defaultSpan: null, bipolar: neg };
      break;
    }
    case 'charge': {
      const m = model.main.ok ? model.main.value : null;
      const neg = (m?.Q ?? 0) < 0 || (m?.I ?? 0) < 0 || (model.ref?.Q ?? 0) < 0;
      axes['ch.Q'] = { magnitudes: fin([m?.Q, m ? m.I * m.window : null, model.ref?.Q]), defaultSpan: null, bipolar: neg };
      break;
    }
    case 'pcb': {
      const m = model.main.ok ? model.main.value : null;
      axes['pcb.d'] = { magnitudes: fin([m?.d, m?.feature.value, model.ref?.d]), defaultSpan: null, bipolar: false };
      break;
    }
  }
  return { axes, naturalWindows };
}

const cache = new WeakMap<AppState, Derived>();

export function derive(state: AppState): Derived {
  const hit = cache.get(state);
  if (hit) return hit;
  const view = viewOf(state);
  const conversion = computeConversion(state);
  const si: Result<number> = conversion.ok ? ok(conversion.value.si) : conversion;
  const params = Object.fromEntries(PARAM_KEYS.map((k) => [k, computeParam(state, k)])) as Record<ParamKey, Result<number>>;
  const model = buildModel(view, state, si, params);
  const { axes, naturalWindows } = buildAxes(model, state);
  const d: Derived = { view, conversion, si, params, model, axes, naturalWindows };
  cache.set(state, d);
  return d;
}

/** Snapshot of the current view's model for the pinned reference. */
export function referenceSnapshot(d: Derived): Record<string, number> | null {
  const m = d.model;
  if (!m.main.ok) return null;
  switch (m.kind) {
    case 'dc':
    case 'resistance':
      return { V: m.main.value.V, R: m.main.value.R };
    case 'current':
      return { I: m.main.value.I, R: m.main.value.R };
    case 'ac':
      return { peak: m.main.value.amps.peak, f: m.main.value.f };
    case 'rc':
      return { R: m.main.value.R, C: m.main.value.C, Vs: m.main.value.Vs, V0: m.main.value.V0 };
    case 'rl':
      return { L: m.main.value.L, R: m.main.value.R, Vs: m.main.value.Vs };
    case 'frequency':
      return { f: m.main.value.f };
    case 'time':
      return { T: m.main.value.T };
    case 'power':
      return { P: m.main.value.P };
    case 'energy':
      return { E: m.main.value.E };
    case 'charge':
      return { Q: m.main.value.Q };
    case 'pcb':
      return { d: m.main.value.d };
  }
}
