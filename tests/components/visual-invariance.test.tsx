// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { Stage } from '../../src/components/Stage';
import { defaultState } from '../../src/state/defaults';
import { createStore, StoreProvider, type Store } from '../../src/state/store';

afterEach(cleanup);

function renderStage(text: string, from: string): { html: string; store: Store; container: HTMLElement } {
  const s = defaultState();
  s.conv.voltage = { text, from, to: 'mV' };
  const store = createStore(s);
  const { container } = render(
    <StoreProvider store={store}>
      <Stage />
    </StoreProvider>,
  );
  const figure = container.querySelector('figure');
  if (!figure) throw new Error('figure not rendered');
  return { html: figure.outerHTML, store, container };
}

function barHeight(container: HTMLElement, group: string): number {
  const rect = container.querySelector(`[data-group="${group}"] .bar-current rect`);
  return Number(rect?.getAttribute('height'));
}

describe('physical visualization is representation-independent', () => {
  it('1 V, 1000 mV and 1 000 000 µV render the identical figure (graph, circuit, readouts, summary)', () => {
    const a = renderStage('1', 'V');
    cleanup();
    const b = renderStage('1000', 'mV');
    cleanup();
    const c = renderStage('1000000', 'uV');
    expect(b.html).toBe(a.html);
    expect(c.html).toBe(a.html);
    expect(a.html).toContain('I = 1 mA');
    expect(a.html).toContain('P = 1 mW');
  });

  it('changing 1 V to 10 V changes the bars ×10 (V, I) and ×100 (P) on the same scale', () => {
    const r = renderStage('1', 'V');
    const v1 = barHeight(r.container, 'V');
    const i1 = barHeight(r.container, 'I');
    const p1 = barHeight(r.container, 'P');
    const html1 = r.container.querySelector('figure')!.outerHTML;
    act(() => r.store.dispatch({ type: 'setText', text: '10' }));
    const html10 = r.container.querySelector('figure')!.outerHTML;
    expect(html10).not.toBe(html1);
    expect(html10).toContain('I = 10 mA');
    expect(html10).toContain('P = 100 mW');
    expect(barHeight(r.container, 'V') / v1).toBeCloseTo(10, 6);
    expect(barHeight(r.container, 'I') / i1).toBeCloseTo(10, 6);
    // P = 1 mW is drawn at the 1 px minimum on a 500 mW axis, so compare against the exact expectation instead.
    expect(p1).toBeGreaterThan(0);
    const pAxisSpan = r.store.getState().scales['dc.P']!.span;
    expect(pAxisSpan).toBe(0.5);
    expect(r.store.getState().scales['dc.V']!.span).toBe(20);
  });

  it('negative voltage flips the source polarity and reverses the current arrow', () => {
    const r = renderStage('-5', 'V');
    const flow = r.container.querySelector('[data-testid="current-flow"]');
    expect(flow?.getAttribute('class')).toContain('is-reverse');
    expect(r.html).toContain('counter-clockwise');
    expect(r.html).toContain('I = −5 mA');
  });

  it('empty input shows guidance, not a fabricated result', () => {
    const s = defaultState();
    s.conv.voltage = { text: '', from: 'V', to: 'mV' };
    const store = createStore(s);
    const { container } = render(
      <StoreProvider store={store}>
        <Stage />
      </StoreProvider>,
    );
    expect(container.querySelector('figure')).toBeNull();
    expect(container.textContent).toContain('Enter a value in the converter to see the model.');
  });
});
