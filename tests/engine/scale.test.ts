import { describe, expect, it } from 'vitest';
import { expandScale, fitSpan, initialScale, niceCeil, rangeStatus, stepSpan, ticks } from '../../src/engine/scale';
import { sliderToValue, valueToSlider } from '../../src/engine/params';

describe('nice numbers and ticks', () => {
  it('niceCeil follows the 1-2-5 sequence', () => {
    expect(niceCeil(0.9)).toBe(1);
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(1.05)).toBe(2);
    expect(niceCeil(3)).toBe(5);
    expect(niceCeil(12)).toBe(20);
    expect(niceCeil(0.0042)).toBe(0.005);
  });

  it('stepSpan moves along the 1-2-5 grid', () => {
    expect(stepSpan(10, 1)).toBe(20);
    expect(stepSpan(20, 1)).toBe(50);
    expect(stepSpan(10, -1)).toBe(5);
    expect(stepSpan(12, -1)).toBe(10);
    expect(stepSpan(1, -1)).toBe(0.5);
  });

  it('ticks are evenly spaced nice values', () => {
    expect(ticks(0, 20, 5)).toEqual([0, 5, 10, 15, 20]);
    expect(ticks(0, 12, 6)).toEqual([0, 2, 4, 6, 8, 10, 12]);
    expect(ticks(-1, 1, 4)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });
});

describe('expand-only automatic scaling', () => {
  it('keeps 1 V and 10 V visibly different on the default range', () => {
    const s0 = initialScale(20, [1]);
    expect(s0.span).toBe(20);
    const s1 = expandScale(s0, [10]);
    expect(s1.span).toBe(20); // 10 V fits: no rescale, bar is 10× taller than at 1 V
  });

  it('expands when a value no longer fits, and never shrinks automatically', () => {
    const s = expandScale({ mode: 'auto', span: 20 }, [30]);
    expect(s.span).toBe(50);
    expect(expandScale(s, [1]).span).toBe(50);
  });

  it('manual scales never change', () => {
    expect(expandScale({ mode: 'manual', span: 5 }, [30]).span).toBe(5);
  });

  it('fit may shrink, with headroom', () => {
    expect(fitSpan([1], 20)).toBe(2);
    expect(fitSpan([0], 20)).toBe(20);
    expect(initialScale(20, [100]).span).toBe(200);
  });

  it('detects values outside the visible range', () => {
    expect(rangeStatus(25, 0, 20)).toBe('above');
    expect(rangeStatus(-1, 0, 20)).toBe('below');
    expect(rangeStatus(20, 0, 20)).toBe('in');
  });
});

describe('sliders are separate from the engine range', () => {
  it('maps log sliders and reports values outside the slider range', () => {
    const spec = { kind: 'log' as const, min: 1, max: 1e6 };
    expect(sliderToValue(spec, 0)).toBe(1);
    expect(sliderToValue(spec, 1000)).toBeCloseTo(1e6, 6);
    expect(valueToSlider(spec, 1e9)).toEqual({ pos: 1000, outside: 'above' });
    expect(valueToSlider(spec, 1e3).pos).toBeCloseTo(500, 9);
  });
});
