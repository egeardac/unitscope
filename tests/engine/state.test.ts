import { describe, expect, it } from 'vitest';
import { createStore } from '../../src/state/store';
import { defaultState } from '../../src/state/defaults';
import { derive } from '../../src/state/derive';
import { decodeState, encodeState } from '../../src/state/urlState';
import { pushHistory, type HistoryEntry } from '../../src/state/persistence';

function dcModel(store: ReturnType<typeof createStore>) {
  const d = derive(store.getState());
  if (d.model.kind !== 'dc' || !d.model.main.ok) throw new Error('dc model not ok');
  return d.model.main.value;
}

describe('single calculation state', () => {
  it('1 V, 1000 mV and 1 000 000 µV produce the same SI value and model', () => {
    const store = createStore(defaultState());
    store.dispatch({ type: 'setText', text: '1' });
    store.dispatch({ type: 'setFrom', unit: 'V' });
    const a = dcModel(store);
    store.dispatch({ type: 'setText', text: '1000 mV' });
    expect(store.getState().conv.voltage.from).toBe('mV');
    const b = dcModel(store);
    store.dispatch({ type: 'setText', text: '1000000' });
    store.dispatch({ type: 'setFrom', unit: 'uV' });
    const c = dcModel(store);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(store.getState().scales['dc.V']).toEqual({ mode: 'auto', span: 20 });
  });

  it('1 V → 10 V keeps the shared scale and updates I and P together', () => {
    const store = createStore(defaultState());
    store.dispatch({ type: 'setText', text: '1' });
    const span1 = store.getState().scales['dc.V'];
    const a = dcModel(store);
    store.dispatch({ type: 'setText', text: '10' });
    const b = dcModel(store);
    expect(store.getState().scales['dc.V']).toEqual(span1);
    expect(b.I / a.I).toBeCloseTo(10, 12);
    expect(b.P / a.P).toBeCloseTo(100, 12);
  });

  it('auto scale expands but does not shrink; fit shrinks on request', () => {
    const store = createStore(defaultState());
    store.dispatch({ type: 'setText', text: '45' });
    expect(store.getState().scales['dc.V']?.span).toBe(50);
    store.dispatch({ type: 'setText', text: '1' });
    expect(store.getState().scales['dc.V']?.span).toBe(50);
    store.dispatch({ type: 'fitScales' });
    expect(store.getState().scales['dc.V']?.span).toBe(2);
  });

  it('swap preserves the physical value exactly', () => {
    const store = createStore(defaultState());
    store.dispatch({ type: 'setText', text: '4.7' });
    store.dispatch({ type: 'setFrom', unit: 'V' });
    store.dispatch({ type: 'setTo', unit: 'mV' });
    const before = derive(store.getState()).si;
    store.dispatch({ type: 'swap' });
    const s = store.getState().conv.voltage;
    expect(s).toMatchObject({ text: '4700', from: 'mV', to: 'V' });
    expect(derive(store.getState()).si).toEqual(before);
  });

  it('typed values outside the slider range are not clamped', () => {
    const store = createStore(defaultState());
    store.dispatch({ type: 'setText', text: '250' });
    const d = derive(store.getState());
    expect(d.si.ok && d.si.value).toBe(250);
  });

  it('empty input yields no fabricated result', () => {
    const store = createStore(defaultState());
    store.dispatch({ type: 'setText', text: '' });
    const d = derive(store.getState());
    expect(d.conversion.ok).toBe(false);
    expect(d.model.main.ok).toBe(false);
  });

  it('a unit from another quantity offers a switch, which carries the value over', () => {
    const store = createStore(defaultState());
    store.dispatch({ type: 'setText', text: '5 mA' });
    const d = derive(store.getState());
    expect(!d.conversion.ok && d.conversion.error.fixes?.[0]?.kind).toBe('switch-quantity');
    if (!d.conversion.ok && d.conversion.error.fixes?.[0]) store.dispatch({ type: 'applyFix', fix: d.conversion.error.fixes[0] });
    const s = store.getState();
    expect(s.quantity).toBe('current');
    const d2 = derive(s);
    expect(d2.si.ok && d2.si.value).toBeCloseTo(0.005, 15);
  });

  it('pins a reference and compares on the same scale', () => {
    const store = createStore(defaultState());
    store.dispatch({ type: 'setText', text: '1' });
    store.dispatch({ type: 'pinRef' });
    store.dispatch({ type: 'setText', text: '10' });
    const d = derive(store.getState());
    expect(d.model.kind === 'dc' && d.model.ref?.V).toBe(1);
  });

  it('negative voltage makes the voltage axis bipolar', () => {
    const store = createStore(defaultState());
    store.dispatch({ type: 'setText', text: '-5' });
    const d = derive(store.getState());
    expect(d.axes['dc.V']?.bipolar).toBe(true);
    expect(d.model.kind === 'dc' && d.model.main.ok && d.model.main.value.I).toBeCloseTo(-0.005, 15);
  });

  it('RC acceptance: R = 1 kΩ, C = 100 µF gives τ = 0.1 s and a 5τ window', () => {
    const store = createStore(defaultState());
    store.dispatch({ type: 'setQuantity', quantity: 'capacitance' });
    store.dispatch({ type: 'setText', text: '100 uF' });
    store.dispatch({ type: 'fitWindow', key: 'rc.t' });
    const d = derive(store.getState());
    expect(d.model.kind === 'rc' && d.model.main.ok && d.model.main.value.tau).toBeCloseTo(0.1, 15);
    expect(store.getState().windows['rc.t']).toBeCloseTo(0.5, 15);
  });
});

describe('shareable links', () => {
  it('round-trips units, values, parameters, reference and scale', () => {
    const store = createStore(defaultState());
    store.dispatch({ type: 'setText', text: '4,7' });
    store.dispatch({ type: 'setTo', unit: 'uV' });
    store.dispatch({ type: 'setParamText', key: 'circuit.R', text: '330' });
    store.dispatch({ type: 'setParamUnit', key: 'circuit.R', unit: 'ohm' });
    store.dispatch({ type: 'pinRef' });
    store.dispatch({ type: 'setScale', axis: 'dc.V', scale: { mode: 'manual', span: 5 } });
    store.dispatch({ type: 'setDisplay', patch: { sigFigs: 4, notation: 'engineering' } });
    const qs = encodeState(store.getState());
    const { state, rejected } = decodeState(`?${qs}`, defaultState());
    expect(rejected).toEqual([]);
    expect(state.conv.voltage).toEqual(store.getState().conv.voltage);
    expect(state.params['circuit.R']).toEqual({ text: '330', unit: 'ohm' });
    expect(state.refs.dc).toEqual(store.getState().refs.dc);
    expect(state.scales['dc.V']).toEqual({ mode: 'manual', span: 5 });
    expect(state.display).toMatchObject({ sigFigs: 4, notation: 'engineering' });
  });

  it('rejects invalid parameters and reports them', () => {
    const { rejected, state } = decodeState('?q=voltage&v=1&from=mA&to=V&sf=99&circuit.R=1~kV', defaultState());
    expect(rejected).toEqual(expect.arrayContaining(['from', 'sf', 'circuit.R']));
    expect(state.conv.voltage.from).toBe('V');
  });
});

describe('history', () => {
  it('deduplicates and keeps newest first', () => {
    const e = (text: string, at: number): HistoryEntry => ({ q: 'voltage', text, from: 'V', to: 'mV', summary: text, at });
    let h: HistoryEntry[] = [];
    h = pushHistory(h, e('1', 1));
    h = pushHistory(h, e('2', 2));
    h = pushHistory(h, e('1', 3));
    expect(h.map((x) => x.text)).toEqual(['1', '2']);
  });
});
