import { fromSI } from '../engine/convert';
import { clampSigFigs, exactText, sliderText } from '../engine/format';
import { parseQuantityInput, splitValueAndUnit } from '../engine/parse';
import { PARAMS, type ParamKey } from '../engine/params';
import { expandScale, fitSpan, initialScale, type ScaleState } from '../engine/scale';
import { getQuantity, getUnit, isQuantityId, type QuantityId } from '../engine/units';
import { VIEW_AXES, VIEW_WINDOWS, viewOf } from './defaults';
import { derive, referenceSnapshot } from './derive';
import type { Action, AppState, ConvState } from './types';

function setConv(state: AppState, q: QuantityId, patch: Partial<ConvState>): AppState {
  return { ...state, conv: { ...state.conv, [q]: { ...state.conv[q], ...patch } } };
}

function numberPart(text: string): string {
  const { numberText, unitText } = splitValueAndUnit(text);
  return unitText ? numberText : text;
}

/** When the visible view changes, drop its scales and windows so they re-initialise for the new context. */
function enterView(prev: AppState, next: AppState): AppState {
  const before = viewOf(prev);
  const after = viewOf(next);
  if (before === after && prev.quantity === next.quantity) return next;
  const scales = { ...next.scales };
  const windows = { ...next.windows };
  for (const a of VIEW_AXES[after]) delete scales[a];
  for (const w of VIEW_WINDOWS[after]) delete windows[w];
  return { ...next, scales, windows };
}

/**
 * Changing the unit a typed number is read in changes the physical value by
 * factors of 1000 (the intermediate "1000000 V" before picking µV). Automatic
 * axes of the visible view are re-initialised so such a transient does not
 * leave an inflated scale behind. Manual axes are kept.
 */
function resetAutoAxes(state: AppState): AppState {
  const view = viewOf(state);
  const scales = { ...state.scales };
  for (const a of VIEW_AXES[view]) if (scales[a]?.mode === 'auto') delete scales[a];
  return { ...state, scales };
}

function validScale(s: ScaleState): boolean {
  return (s.mode === 'auto' || s.mode === 'manual') && Number.isFinite(s.span) && s.span > 0;
}

function apply(state: AppState, action: Action): AppState {
  const q = state.quantity;
  switch (action.type) {
    case 'setQuantity': {
      if (action.quantity === q || !isQuantityId(action.quantity)) return state;
      return enterView(state, { ...state, quantity: action.quantity });
    }
    case 'setText': {
      const conv = state.conv[q];
      const from = getUnit(conv.from)!;
      const parsed = parseQuantityInput(action.text, q, from);
      const patch: Partial<ConvState> = { text: action.text };
      if (parsed.ok && parsed.value.unitFromText) patch.from = parsed.value.unit.id;
      return setConv(state, q, patch);
    }
    case 'setFrom': {
      const u = getUnit(action.unit);
      if (!u || u.quantity !== q) return state;
      if (u.id === state.conv[q].from && numberPart(state.conv[q].text) === state.conv[q].text) return state;
      return resetAutoAxes(setConv(state, q, { from: u.id, text: numberPart(state.conv[q].text) }));
    }
    case 'setTo': {
      const u = getUnit(action.unit);
      if (!u || u.quantity !== q) return state;
      return setConv(state, q, { to: u.id });
    }
    case 'swap': {
      const d = derive(state);
      const c = state.conv[q];
      if (d.conversion.ok) {
        // Exact shortest round-trip text: the physical value is preserved bit for bit.
        return setConv(state, q, { text: exactText(d.conversion.value.result), from: c.to, to: d.conversion.value.from.id });
      }
      return setConv(state, q, { text: numberPart(c.text), from: c.to, to: c.from });
    }
    case 'useRepresentation': {
      const u = getUnit(action.unit);
      if (!u || u.quantity !== q) return state;
      return setConv(state, q, { text: action.text, from: u.id });
    }
    case 'setMainSI': {
      const from = getUnit(state.conv[q].from)!;
      const v = fromSI(action.value, from);
      if (!v.ok) return state;
      return setConv(state, q, { text: sliderText(v.value) });
    }
    case 'setDisplay': {
      const patch = { ...action.patch };
      if (patch.sigFigs !== undefined) patch.sigFigs = clampSigFigs(patch.sigFigs);
      return { ...state, display: { ...state.display, ...patch } };
    }
    case 'setParamText': {
      const def = PARAMS[action.key];
      const cur = state.params[action.key];
      const parsed = parseQuantityInput(action.text, def.quantity, getUnit(cur.unit)!, {
        allowParamOnly: true,
        allowedIds: def.unitIds,
        allowNegative: true,
      });
      const unit = parsed.ok && parsed.value.unitFromText ? parsed.value.unit.id : cur.unit;
      return { ...state, params: { ...state.params, [action.key]: { text: action.text, unit } } };
    }
    case 'setParamUnit': {
      const def = PARAMS[action.key];
      if (!def.unitIds.includes(action.unit)) return state;
      const cur = state.params[action.key];
      return resetAutoAxes({ ...state, params: { ...state.params, [action.key]: { text: numberPart(cur.text), unit: action.unit } } });
    }
    case 'setParamSI': {
      const cur = state.params[action.key];
      const v = fromSI(action.value, getUnit(cur.unit)!);
      if (!v.ok) return state;
      return { ...state, params: { ...state.params, [action.key]: { text: sliderText(v.value), unit: cur.unit } } };
    }
    case 'setVoltageMode':
      if (state.voltageMode === action.mode) return state;
      return { ...state, voltageMode: action.mode };
    case 'setAmpKind':
      return { ...state, ampKind: action.kind };
    case 'pinRef': {
      const d = derive(state);
      const snap = referenceSnapshot(d);
      if (!snap) return state;
      return { ...state, refs: { ...state.refs, [d.view]: snap } };
    }
    case 'clearRef': {
      const view = viewOf(state);
      if (!state.refs[view]) return state;
      const refs = { ...state.refs };
      delete refs[view];
      return { ...state, refs };
    }
    case 'setScale':
      if (!validScale(action.scale)) return state;
      return { ...state, scales: { ...state.scales, [action.axis]: action.scale } };
    case 'fitScales': {
      const d = derive(state);
      const scales = { ...state.scales };
      for (const axis of VIEW_AXES[d.view]) {
        const info = d.axes[axis];
        if (!info || info.magnitudes.length === 0) continue;
        scales[axis] = { mode: 'auto', span: fitSpan(info.magnitudes, info.defaultSpan ?? 1) };
      }
      return { ...state, scales };
    }
    case 'setWindow':
      if (!Number.isFinite(action.value) || action.value <= 0) return state;
      return { ...state, windows: { ...state.windows, [action.key]: action.value } };
    case 'fitWindow': {
      const nat = derive(state).naturalWindows[action.key];
      if (!nat || !Number.isFinite(nat) || nat <= 0) return state;
      return { ...state, windows: { ...state.windows, [action.key]: nat } };
    }
    case 'setAxisUnit':
      return { ...state, axisUnits: { ...state.axisUnits, [action.which]: action.unit } };
    case 'setPcbFeature':
      return { ...state, pcbFeature: action.id };
    case 'applyFix': {
      const fix = action.fix;
      if (fix.kind === 'replace-text') return apply(state, { type: 'setText', text: fix.text });
      if (!isQuantityId(fix.quantity)) return state;
      const target = fix.quantity;
      const cur = state.conv[target];
      const def = getQuantity(target);
      let to = cur.to;
      if (to === fix.unit) to = def.defaultTo !== fix.unit ? def.defaultTo : def.defaultFrom;
      const next = setConv({ ...state, quantity: target }, target, { text: fix.text, from: fix.unit, to });
      return enterView(state, next);
    }
    case 'applyPreset': {
      const p = action.preset;
      let next = setConv(state, q, { text: p.text, from: p.unit });
      if (q === 'voltage') next = { ...next, voltageMode: p.ac ? 'ac' : 'dc', ampKind: p.ac ? 'rms' : next.ampKind };
      return enterView(state, next);
    }
    case 'restore': {
      if (!isQuantityId(action.quantity)) return state;
      let next = setConv({ ...state, quantity: action.quantity }, action.quantity, action.conv);
      if (action.voltageMode) next = { ...next, voltageMode: action.voltageMode };
      return enterView(state, next);
    }
    case 'replace':
      return action.state;
  }
}

/**
 * After every change: initialise missing axes/windows of the visible view and
 * apply the expand-only rule to automatic axes.
 */
export function reconcile(state: AppState): AppState {
  let s = state;
  for (let pass = 0; pass < 2; pass++) {
    const d = derive(s);
    let scales = s.scales;
    let windows = s.windows;
    let changed = false;
    for (const w of VIEW_WINDOWS[d.view]) {
      if (windows[w] !== undefined) continue;
      const nat = d.naturalWindows[w];
      if (nat && Number.isFinite(nat) && nat > 0) {
        windows = { ...windows, [w]: nat };
        changed = true;
      }
    }
    for (const axis of VIEW_AXES[d.view]) {
      const info = d.axes[axis];
      if (!info) continue;
      const cur = scales[axis];
      let next: ScaleState | undefined;
      if (!cur) {
        if (info.magnitudes.length === 0 && info.defaultSpan === null) continue;
        next = info.defaultSpan !== null ? initialScale(info.defaultSpan, info.magnitudes) : { mode: 'auto', span: fitSpan(info.magnitudes, 1) };
      } else {
        next = expandScale(cur, info.magnitudes);
      }
      if (next !== cur) {
        scales = { ...scales, [axis]: next };
        changed = true;
      }
    }
    if (!changed) break;
    s = { ...s, scales, windows };
  }
  return s;
}

export function reduce(state: AppState, action: Action): AppState {
  const next = apply(state, action);
  return next === state ? state : reconcile(next);
}

export type { ParamKey };
