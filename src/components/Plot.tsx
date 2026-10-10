import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { chooseExp3, formatNumber, formatSI, prefixFor } from '../engine/format';
import { linear, rangeStatus, ticks } from '../engine/scale';
import { useClock, useElementWidth, type Clock } from '../hooks';

export type Tone = 'primary' | 'reference' | 'accent' | 'muted';

export interface AxisSpec {
  min: number;
  max: number;
  /** Quantity name, e.g. "Voltage". */
  label: string;
  /** Base unit symbol, e.g. "V"; the axis picks an SI prefix automatically. */
  unit: string;
  /** Override for non-SI axis units such as "Wh" (no prefix) or "×" (normalized). */
  noPrefix?: boolean;
}

export interface Series {
  id: string;
  label: string;
  tone: Tone;
  dash?: string;
  /** Model samples [x, y] in axis units. */
  points: Array<[number, number]>;
  /** Exact model value at x for inspection (preferred over samples). */
  at?: (x: number) => number | null;
  /** Constant envelope band instead of a line (too many cycles to draw). */
  band?: { lo: number; hi: number };
}

export interface Guide {
  axis: 'x' | 'y';
  value: number;
  label: string;
  tone: Tone;
  dash?: string;
}

export interface MarkPoint {
  x: number;
  y: number;
  label: string;
  tone: Tone;
}

export interface PlotProps {
  ariaLabel: string;
  height?: number;
  x: AxisSpec;
  y: AxisSpec;
  series: Series[];
  guides?: Guide[];
  marks?: MarkPoint[];
  /** Playback cursor: the clock and a map from playback seconds to an x value. */
  playhead?: { clock: Clock; x: (seconds: number) => number } | null;
  /** Extra rows for the inspection tooltip at x. */
  inspectExtra?: (x: number) => Array<{ label: string; value: string }>;
}

const M = { left: 58, right: 18, top: 26, bottom: 40 };

function axisFormatter(axis: AxisSpec): { unitText: string; fmt: (v: number) => string; scale: number } {
  if (axis.noPrefix) {
    return { unitText: axis.unit, fmt: (v) => formatNumber(v, { sigFigs: 4, notation: 'auto', trimZeros: true }).text, scale: 1 };
  }
  const e3 = chooseExp3(Math.max(Math.abs(axis.min), Math.abs(axis.max)));
  const scale = 10 ** e3;
  return {
    unitText: `${prefixFor(e3)}${axis.unit}`,
    fmt: (v) => formatNumber(v / scale, { sigFigs: 4, notation: 'auto', trimZeros: true }).text,
    scale,
  };
}

function fmtValue(v: number, axis: AxisSpec): string {
  if (axis.noPrefix) return `${formatNumber(v, { sigFigs: 4, notation: 'auto', trimZeros: true }).text} ${axis.unit}`.trim();
  return formatSI(v, axis.unit, 4).text;
}

const CLAMP = 1e5;

function Playhead({ clock, toX, sx, top, bottom }: { clock: Clock; toX: (s: number) => number; sx: (v: number) => number; top: number; bottom: number }) {
  const s = useClock(clock);
  const x = toX(s);
  if (!Number.isFinite(x)) return null;
  const px = sx(x);
  return <line className="playhead" x1={px} x2={px} y1={top} y2={bottom} data-testid="playhead" />;
}
const clampPx = (v: number) => Math.max(-CLAMP, Math.min(CLAMP, v));

/**
 * Calibrated SVG line plot. Axes always show quantity, unit (with SI prefix)
 * and ticks; values beyond the visible range are clipped and flagged at the
 * edge. Pointer, touch and arrow keys inspect exact model values.
 */
export function Plot({ ariaLabel, height = 300, x, y, series, guides = [], marks = [], playhead = null, inspectExtra }: PlotProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>(640);
  const clipId = useId().replace(/:/g, '');
  const [inspectX, setInspectX] = useState<number | null>(null);
  const [announce, setAnnounce] = useState('');

  const W = Math.max(240, width);
  const H = height;
  const pw = W - M.left - M.right;
  const ph = H - M.top - M.bottom;
  const sx = useMemo(() => linear(x.min, x.max, M.left, M.left + pw), [x.min, x.max, pw]);
  const sy = useMemo(() => linear(y.min, y.max, M.top + ph, M.top), [y.min, y.max, ph]);
  const xf = axisFormatter(x);
  const yf = axisFormatter(y);
  const xt = ticks(x.min, x.max, Math.max(3, Math.min(8, Math.floor(pw / 80))));
  const yt = ticks(y.min, y.max, Math.max(3, Math.min(6, Math.floor(ph / 45))));

  const offScale = useMemo(() => {
    const out: Array<{ dir: 'above' | 'below'; text: string }> = [];
    for (const s of series) {
      if (s.band) continue;
      let max = -Infinity;
      let min = Infinity;
      for (const [, v] of s.points) {
        if (Number.isFinite(v)) {
          if (v > max) max = v;
          if (v < min) min = v;
        }
      }
      if (rangeStatus(max, y.min, y.max) === 'above') out.push({ dir: 'above', text: `${s.label} exceeds the range (max ${fmtValue(max, y)})` });
      if (rangeStatus(min, y.min, y.max) === 'below') out.push({ dir: 'below', text: `${s.label} goes below the range (min ${fmtValue(min, y)})` });
    }
    for (const g of guides) {
      const st = rangeStatus(g.value, g.axis === 'y' ? y.min : x.min, g.axis === 'y' ? y.max : x.max);
      if (st !== 'in') {
        const dir = g.axis === 'y' ? st : st === 'above' ? 'above' : 'below';
        out.push({ dir, text: `${g.label} is outside the visible ${g.axis === 'y' ? 'range' : 'window'}` });
      }
    }
    return out;
  }, [series, guides, x, y]);

  const paths = series.map((s) => {
    if (s.band) return null;
    let d = '';
    s.points.forEach(([px, py], i) => {
      if (!Number.isFinite(px) || !Number.isFinite(py)) return;
      d += `${i === 0 || d === '' ? 'M' : 'L'}${clampPx(sx(px)).toFixed(2)},${clampPx(sy(py)).toFixed(2)}`;
    });
    return d;
  });

  const inspectRows = (vx: number) => {
    const rows: Array<{ label: string; value: string; tone?: Tone }> = [];
    for (const s of series) {
      if (s.band) {
        rows.push({ label: `${s.label} (envelope)`, value: `±${fmtValue(s.band.hi, y)}`, tone: s.tone });
        continue;
      }
      let v: number | null = null;
      if (s.at) v = s.at(vx);
      else if (s.points.length > 0) {
        let best = s.points[0]!;
        for (const p of s.points) if (Math.abs(p[0] - vx) < Math.abs(best[0] - vx)) best = p;
        v = best[1];
      }
      if (v !== null && Number.isFinite(v)) rows.push({ label: s.label, value: fmtValue(v, y), tone: s.tone });
    }
    if (inspectExtra) rows.push(...inspectExtra(vx));
    return rows;
  };

  const setFromClientX = (clientX: number, target: Element) => {
    const rect = target.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const vx = x.min + ((px - M.left) / pw) * (x.max - x.min);
    setInspectX(Math.min(x.max, Math.max(x.min, vx)));
  };

  const onPointer = (e: PointerEvent<SVGSVGElement>) => setFromClientX(e.clientX, e.currentTarget);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const span = x.max - x.min;
    const step = (e.shiftKey ? 0.1 : 0.01) * span;
    const cur = inspectX ?? x.min + span / 2;
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = Math.min(x.max, cur + step);
    else if (e.key === 'ArrowLeft') next = Math.max(x.min, cur - step);
    else if (e.key === 'Home') next = x.min;
    else if (e.key === 'End') next = x.max;
    else if (e.key === 'Escape') {
      setInspectX(null);
      return;
    }
    if (next !== null) {
      e.preventDefault();
      setInspectX(next);
      const rows = inspectRows(next);
      setAnnounce(`${x.label} ${fmtValue(next, x)}: ${rows.map((r) => `${r.label} ${r.value}`).join(', ')}`);
    }
  };

  const ix = inspectX !== null ? sx(inspectX) : null;
  const rows = inspectX !== null ? inspectRows(inspectX) : [];
  const tipLeft = ix !== null ? (ix > W * 0.6 ? undefined : ix + 12) : undefined;
  const tipRight = ix !== null && ix > W * 0.6 ? W - ix + 12 : undefined;

  return (
    <div
      className="plot"
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={`${ariaLabel}. Use the left and right arrow keys to inspect values; hold Shift for larger steps.`}
      onKeyDown={onKey}
      onFocus={() => inspectX === null && setInspectX(x.min + (x.max - x.min) / 2)}
      onBlur={() => setInspectX(null)}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={ariaLabel}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={(e) => e.pointerType === 'mouse' && setInspectX(null)}
        data-testid="plot-svg"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={M.left} y={M.top} width={pw} height={ph} />
          </clipPath>
        </defs>
        <rect className="plot-area" x={M.left} y={M.top} width={pw} height={ph} />
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line className={t === 0 ? 'grid zero' : 'grid'} x1={M.left} x2={M.left + pw} y1={Math.round(sy(t)) + 0.5} y2={Math.round(sy(t)) + 0.5} />
            <text className="tick" x={M.left - 8} y={sy(t)} textAnchor="end" dominantBaseline="middle">
              {yf.fmt(t)}
            </text>
          </g>
        ))}
        {xt.map((t) => (
          <g key={`x${t}`}>
            <line className={t === 0 ? 'grid zero' : 'grid'} y1={M.top} y2={M.top + ph} x1={Math.round(sx(t)) + 0.5} x2={Math.round(sx(t)) + 0.5} />
            <text className="tick" x={sx(t)} y={M.top + ph + 16} textAnchor="middle">
              {xf.fmt(t)}
            </text>
          </g>
        ))}
        <line className="axis" x1={M.left} x2={M.left} y1={M.top} y2={M.top + ph} />
        <line className="axis" x1={M.left} x2={M.left + pw} y1={M.top + ph} y2={M.top + ph} />
        <text className="axis-title" x={M.left - 50} y={14}>
          {y.label} ({yf.unitText})
        </text>
        <text className="axis-title" x={M.left + pw} y={H - 6} textAnchor="end">
          {x.label} ({xf.unitText})
        </text>

        <g clipPath={`url(#${clipId})`}>
          {series.map((s, i) =>
            s.band ? (
              <g key={s.id} className={`band tone-${s.tone}`}>
                <rect x={M.left} width={pw} y={sy(Math.min(y.max, s.band.hi))} height={Math.max(0, sy(Math.max(y.min, s.band.lo)) - sy(Math.min(y.max, s.band.hi)))} />
                <line x1={M.left} x2={M.left + pw} y1={sy(s.band.hi)} y2={sy(s.band.hi)} />
                <line x1={M.left} x2={M.left + pw} y1={sy(s.band.lo)} y2={sy(s.band.lo)} />
              </g>
            ) : (
              <path key={s.id} className={`trace tone-${s.tone}`} d={paths[i] ?? ''} strokeDasharray={s.dash} data-series={s.id} />
            ),
          )}
          {guides.map((g, i) =>
            g.axis === 'y' ? (
              <g key={`g${i}`} className={`guide tone-${g.tone}`}>
                <line x1={M.left} x2={M.left + pw} y1={sy(g.value)} y2={sy(g.value)} strokeDasharray={g.dash ?? '4 4'} />
                <text x={M.left + pw - 4} y={sy(g.value) - 5} textAnchor="end">
                  {g.label}
                </text>
              </g>
            ) : (
              <g key={`g${i}`} className={`guide tone-${g.tone}`}>
                <line y1={M.top} y2={M.top + ph} x1={sx(g.value)} x2={sx(g.value)} strokeDasharray={g.dash ?? '4 4'} />
                <text x={sx(g.value) + 4} y={M.top + 12}>
                  {g.label}
                </text>
              </g>
            ),
          )}
          {marks.map((m, i) => {
            const right = sx(m.x) > M.left + pw * 0.65;
            const low = sy(m.y) < M.top + 22;
            return (
              <g key={`m${i}`} className={`mark tone-${m.tone}`}>
                <circle cx={sx(m.x)} cy={sy(m.y)} r={5} />
                <text x={sx(m.x) + (right ? -9 : 9)} y={sy(m.y) + (low ? 18 : -9)} textAnchor={right ? 'end' : 'start'}>
                  {m.label}
                </text>
              </g>
            );
          })}
          {playhead && <Playhead clock={playhead.clock} toX={playhead.x} sx={sx} top={M.top} bottom={M.top + ph} />}
          {ix !== null && <line className="inspect-line" x1={ix} x2={ix} y1={M.top} y2={M.top + ph} />}
          {inspectX !== null &&
            series.map((s) => {
              if (s.band || !s.at) return null;
              const v = s.at(inspectX);
              if (v === null || !Number.isFinite(v)) return null;
              return <circle key={`i${s.id}`} className={`inspect-dot tone-${s.tone}`} cx={ix ?? 0} cy={clampPx(sy(v))} r={4} />;
            })}
        </g>
        {offScale.map((o, i) => (
          <g key={`o${i}`} className="offscale">
            <text x={M.left + 6} y={o.dir === 'above' ? M.top + 14 + i * 15 : M.top + ph - 6 - i * 15}>
              {o.dir === 'above' ? '▲ ' : '▼ '}
              {o.text}
            </text>
          </g>
        ))}
      </svg>
      {inspectX !== null && rows.length > 0 && (
        <div className="plot-tip" style={{ left: tipLeft, right: tipRight, top: M.top + 4 }} aria-hidden="true">
          <div className="plot-tip-x">
            {x.label} = {fmtValue(inspectX, x)}
          </div>
          {rows.map((r) => (
            <div key={r.label} className="plot-tip-row">
              <span className={`swatch tone-${r.tone ?? 'muted'}`} />
              <span>{r.label}</span>
              <span className="num">{r.value}</span>
            </div>
          ))}
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
    </div>
  );
}
