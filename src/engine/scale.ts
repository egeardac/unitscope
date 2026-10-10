/**
 * Axis scaling. The guiding rule: automatic scaling must never make 1 V and
 * 10 V look equally tall. "Auto" therefore means EXPAND-ONLY: the full-scale
 * span grows when a value no longer fits and never shrinks by itself. Fitting
 * (which may shrink) only happens on an explicit action, on first load and
 * when a quantity is opened.
 */

export type ScaleMode = 'auto' | 'manual';

export interface ScaleState {
  mode: ScaleMode;
  /** Full-scale magnitude in SI units (> 0). Bipolar axes run from −span to +span. */
  span: number;
}

const STEPS = [1, 2, 5];

/** Smallest 1-2-5 value ≥ x (x > 0). */
export function niceCeil(x: number): number {
  if (!(x > 0) || !Number.isFinite(x)) return 1;
  const e = Math.floor(Math.log10(x));
  for (let k = e - 1; k <= e + 1; k++) {
    for (const s of STEPS) {
      const v = s * 10 ** k;
      // Tolerate binary noise (e.g. 2.0000000000000004 should map to 2).
      if (v >= x * (1 - 1e-12)) return Number(v.toPrecision(12));
    }
  }
  return Number((10 ** (e + 1)).toPrecision(12));
}

/** Next 1-2-5 value strictly above (dir = 1) or below (dir = −1) a span, for the manual stepper. */
export function stepSpan(span: number, dir: 1 | -1): number {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  if (dir === 1) return niceCeil(span * (1 + 1e-9));
  const e = Math.floor(Math.log10(span));
  let best = 0;
  for (let k = e - 1; k <= e; k++) {
    for (const s of STEPS) {
      const v = Number((s * 10 ** k).toPrecision(12));
      if (v < span * (1 - 1e-9) && v > best) best = v;
    }
  }
  return best > 0 ? best : span / 2;
}

/** Headroom so a value equal to the span does not touch the frame. */
export const HEADROOM = 1.05;

/** Span that comfortably fits the given magnitudes; falls back when all are zero. */
export function fitSpan(magnitudes: number[], fallback: number): number {
  const m = Math.max(0, ...magnitudes.filter((x) => Number.isFinite(x)).map(Math.abs));
  return m > 0 ? niceCeil(m * HEADROOM) : fallback;
}

/** Expand-only update for auto scales; manual scales are left untouched. */
export function expandScale(state: ScaleState, magnitudes: number[]): ScaleState {
  if (state.mode === 'manual') return state;
  const m = Math.max(0, ...magnitudes.filter((x) => Number.isFinite(x)).map(Math.abs));
  if (m <= state.span) return state;
  return { mode: 'auto', span: niceCeil(m * HEADROOM) };
}

/** Initial scale: the quantity's default bench range if the values fit, otherwise a fit. */
export function initialScale(defaultSpan: number, magnitudes: number[]): ScaleState {
  const m = Math.max(0, ...magnitudes.filter((x) => Number.isFinite(x)).map(Math.abs));
  return { mode: 'auto', span: m <= defaultSpan ? defaultSpan : niceCeil(m * HEADROOM) };
}

export type RangeStatus = 'in' | 'above' | 'below';

export function rangeStatus(value: number, min: number, max: number): RangeStatus {
  const tol = (max - min) * 1e-9;
  if (value > max + tol) return 'above';
  if (value < min - tol) return 'below';
  return 'in';
}

/** Nice tick positions covering [min, max]; prefers steps that land exactly on both ends. */
export function ticks(min: number, max: number, approx = 5): number[] {
  if (!(max > min) || !Number.isFinite(min) || !Number.isFinite(max)) return [min];
  const raw = (max - min) / approx;
  const e = Math.floor(Math.log10(raw));
  const f = raw / 10 ** e;
  let step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * 10 ** e;
  const onGrid = (v: number, st: number) => Math.abs(v / st - Math.round(v / st)) < 1e-9;
  if (!onGrid(max, step) || !onGrid(min, step)) {
    let best: number | null = null;
    for (let k = e - 1; k <= e + 1; k++) {
      for (const m of [1, 2, 2.5, 5]) {
        const st = m * 10 ** k;
        const count = (max - min) / st;
        if (count < 2 || count > approx * 2 || !onGrid(max, st) || !onGrid(min, st)) continue;
        if (best === null || Math.abs(count - approx) < Math.abs((max - min) / best - approx)) best = st;
      }
    }
    if (best !== null) step = best;
  }
  const out: number[] = [];
  const start = Math.ceil(min / step - 1e-9) * step;
  for (let v = start; v <= max + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
    if (out.length > 50) break;
  }
  return out;
}

/** Linear map from a domain to a pixel range. */
export function linear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0);
  return (v: number) => r0 + (v - d0) * k;
}

/** Axis extent for a span: bipolar when any value is negative (or forced). */
export function axisExtent(span: number, bipolar: boolean): [number, number] {
  return bipolar ? [-span, span] : [0, span];
}
