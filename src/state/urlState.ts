/**
 * Shareable links. The query string restores the quantity, the typed value,
 * both units, display settings, the model parameters of the visible view, its
 * pinned reference and its scales. Invalid entries are dropped and reported.
 */
import type { AmplitudeKind } from '../engine/models/acSine';
import { PCB_FEATURE_BY_ID } from '../engine/models/pcb';
import { PARAMS, isParamKey, type ParamKey } from '../engine/params';
import { getUnit, isQuantityId } from '../engine/units';
import { clampSigFigs, type Notation } from '../engine/format';
import { VIEW_AXES, VIEW_PARAMS, VIEW_WINDOWS, viewOf } from './defaults';
import type { AppState } from './types';

const NOTATION_CODE: Record<Notation, string> = { auto: 'a', scientific: 's', engineering: 'e' };
const CODE_NOTATION: Record<string, Notation> = { a: 'auto', s: 'scientific', e: 'engineering' };

export function encodeState(state: AppState): string {
  const p = new URLSearchParams();
  const view = viewOf(state);
  const c = state.conv[state.quantity];
  p.set('q', state.quantity);
  p.set('v', c.text);
  p.set('from', c.from);
  p.set('to', c.to);
  p.set('sf', String(state.display.sigFigs));
  p.set('nt', NOTATION_CODE[state.display.notation]);
  if (!state.display.trimZeros) p.set('tz', '0');
  if (state.quantity === 'voltage') {
    p.set('mode', state.voltageMode);
    if (state.voltageMode === 'ac') p.set('amp', state.ampKind);
  }
  for (const key of VIEW_PARAMS[view]) {
    const ps = state.params[key];
    p.set(key, `${ps.text}~${ps.unit}`);
  }
  const ref = state.refs[view];
  if (ref) {
    p.set(`ref.${view}`, Object.entries(ref).map(([k, v]) => `${k}:${String(v)}`).join(','));
  }
  for (const axis of VIEW_AXES[view]) {
    const s = state.scales[axis];
    if (s) p.set(`s.${axis}`, `${s.mode === 'manual' ? 'm' : 'a'}:${String(s.span)}`);
  }
  for (const w of VIEW_WINDOWS[view]) {
    const v = state.windows[w];
    if (v !== undefined) p.set(`w.${w}`, String(v));
  }
  if (view === 'power' || view === 'energy') p.set('eu', state.axisUnits.energy);
  if (view === 'charge') p.set('cu', state.axisUnits.charge);
  if (view === 'pcb') p.set('pcb', state.pcbFeature);
  return p.toString();
}

export interface DecodeResult {
  state: AppState;
  /** Names of parameters that were present but invalid. */
  rejected: string[];
  /** True when the query contained app state at all. */
  present: boolean;
}

function posNum(s: string | null): number | null {
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function decodeState(search: string, base: AppState): DecodeResult {
  const p = new URLSearchParams(search);
  const rejected: string[] = [];
  if (!p.has('q')) return { state: base, rejected, present: false };

  const qRaw = p.get('q');
  if (!isQuantityId(qRaw)) return { state: base, rejected: ['q'], present: true };
  const s: AppState = structuredClone(base);
  s.quantity = qRaw;

  const conv = { ...s.conv[qRaw] };
  const v = p.get('v');
  if (v !== null) conv.text = v.slice(0, 200);
  for (const k of ['from', 'to'] as const) {
    const id = p.get(k);
    if (id === null) continue;
    const u = getUnit(id);
    if (u && u.quantity === qRaw && !u.paramOnly) conv[k] = id;
    else rejected.push(k);
  }
  s.conv[qRaw] = conv;

  const sf = p.get('sf');
  if (sf !== null) {
    const n = Number(sf);
    if (Number.isInteger(n) && n >= 1 && n <= 15) s.display.sigFigs = clampSigFigs(n);
    else rejected.push('sf');
  }
  const nt = p.get('nt');
  if (nt !== null) {
    const n = CODE_NOTATION[nt];
    if (n) s.display.notation = n;
    else rejected.push('nt');
  }
  if (p.get('tz') === '0') s.display.trimZeros = false;

  const mode = p.get('mode');
  if (mode !== null) {
    if (mode === 'dc' || mode === 'ac') s.voltageMode = mode;
    else rejected.push('mode');
  }
  const amp = p.get('amp');
  if (amp !== null) {
    if (amp === 'rms' || amp === 'peak' || amp === 'pp') s.ampKind = amp as AmplitudeKind;
    else rejected.push('amp');
  }

  for (const [key, value] of p.entries()) {
    if (isParamKey(key)) {
      const k = key as ParamKey;
      const i = value.lastIndexOf('~');
      const text = i >= 0 ? value.slice(0, i) : value;
      const unit = i >= 0 ? value.slice(i + 1) : s.params[k].unit;
      if (PARAMS[k].unitIds.includes(unit)) s.params[k] = { text: text.slice(0, 200), unit };
      else rejected.push(key);
    } else if (key.startsWith('ref.')) {
      const view = key.slice(4);
      const snap: Record<string, number> = {};
      let good = value.length > 0;
      for (const pair of value.split(',')) {
        const [k2, n] = pair.split(':');
        const num = Number(n);
        if (!k2 || !Number.isFinite(num)) good = false;
        else snap[k2] = num;
      }
      if (good && view in VIEW_PARAMS) s.refs[view as keyof typeof VIEW_PARAMS] = snap;
      else rejected.push(key);
    } else if (key.startsWith('s.')) {
      const axis = key.slice(2);
      const [m, n] = value.split(':');
      const span = posNum(n ?? null);
      if ((m === 'a' || m === 'm') && span !== null) s.scales[axis] = { mode: m === 'm' ? 'manual' : 'auto', span };
      else rejected.push(key);
    } else if (key.startsWith('w.')) {
      const span = posNum(value);
      if (span !== null) s.windows[key.slice(2)] = span;
      else rejected.push(key);
    }
  }

  const eu = p.get('eu');
  if (eu !== null) {
    if (eu === 'J' || eu === 'Wh') s.axisUnits.energy = eu;
    else rejected.push('eu');
  }
  const cu = p.get('cu');
  if (cu !== null) {
    if (cu === 'C' || cu === 'mAh') s.axisUnits.charge = cu;
    else rejected.push('cu');
  }
  const pcb = p.get('pcb');
  if (pcb !== null) {
    if (PCB_FEATURE_BY_ID[pcb]) s.pcbFeature = pcb;
    else rejected.push('pcb');
  }
  return { state: s, rejected, present: true };
}

/** Absolute share URL for the current page location (works under /unitscope/ or any base path). */
export function shareUrl(state: AppState, loc: { origin: string; pathname: string }): string {
  return `${loc.origin}${loc.pathname}?${encodeState(state)}`;
}
