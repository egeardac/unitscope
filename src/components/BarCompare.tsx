import { chooseExp3, formatNumber, formatSI, prefixFor } from '../engine/format';
import { linear, rangeStatus, ticks } from '../engine/scale';
import { useElementWidth } from '../hooks';

export interface BarGroup {
  key: string;
  label: string;
  symbol: string;
  unit: string;
  /** Full-scale magnitude shared by both bars of the group. */
  span: number;
  bipolar: boolean;
  current: number | null;
  reference: number | null;
  /** Shown above the group, e.g. "manual". */
  scaleNote?: string;
}

const M = { top: 44, bottom: 44, left: 52, right: 10 };

/**
 * Side-by-side comparison of the current value and the pinned reference on a
 * SHARED, calibrated axis per quantity (V, I, P). Bars beyond the axis are
 * clipped and labelled with their actual value.
 */
export function BarCompare({ groups, ariaLabel, height = 280 }: { groups: BarGroup[]; ariaLabel: string; height?: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(640);
  const W = Math.max(280, width);
  const gw = W / groups.length;
  const ph = height - M.top - M.bottom;

  return (
    <div className="bars" ref={ref}>
      <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel} data-testid="bars-svg">
        <defs>
          <pattern id="hatch-ref" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="6" className="hatch-line" />
          </pattern>
        </defs>
        {groups.map((g, gi) => {
          const x0 = gi * gw;
          const min = g.bipolar ? -g.span : 0;
          const max = g.span;
          const sy = linear(min, max, M.top + ph, M.top);
          const e3 = chooseExp3(g.span);
          const unitText = `${prefixFor(e3)}${g.unit}`;
          const tks = ticks(min, max, g.bipolar ? 4 : 4);
          const plotL = x0 + M.left;
          const plotR = x0 + gw - M.right;
          const barW = Math.max(14, Math.min(46, (plotR - plotL) / 3.2));
          const gap = Math.max(6, (plotR - plotL - 2 * barW) / 3);
          const bars: Array<{ id: 'reference' | 'current'; v: number | null; x: number }> = [
            { id: 'reference', v: g.reference, x: plotL + gap },
            { id: 'current', v: g.current, x: plotL + 2 * gap + barW },
          ];
          const narrow = gw < 190;
          return (
            <g key={g.key} data-group={g.key}>
              <text className="bars-title" x={x0 + 8} y={16}>
                {narrow ? `${g.symbol} (${unitText})` : `${g.label} ${g.symbol} (${unitText})`}
              </text>
              {g.scaleNote && !narrow && (
                <text className="bars-note" x={x0 + 8} y={31}>
                  {g.scaleNote}
                </text>
              )}
              <rect className="plot-area" x={plotL} y={M.top} width={plotR - plotL} height={ph} />
              {tks.map((t) => (
                <g key={t}>
                  <line className={t === 0 ? 'grid zero' : 'grid'} x1={plotL} x2={plotR} y1={Math.round(sy(t)) + 0.5} y2={Math.round(sy(t)) + 0.5} />
                  <text className="tick" x={plotL - 6} y={sy(t)} textAnchor="end" dominantBaseline="middle">
                    {formatNumber(t / 10 ** e3, { sigFigs: 4, notation: 'auto', trimZeros: true }).text}
                  </text>
                </g>
              ))}
              <line className="axis" x1={plotL} x2={plotL} y1={M.top} y2={M.top + ph} />
              {bars.map((b) => {
                if (b.v === null || !Number.isFinite(b.v)) return null;
                const st = rangeStatus(b.v, min, max);
                const vc = Math.max(min, Math.min(max, b.v));
                const y0 = sy(0);
                const y1 = sy(vc);
                const top = Math.min(y0, y1);
                const h = Math.max(b.v === 0 ? 0 : 1, Math.abs(y1 - y0));
                const label = formatSI(b.v, g.unit, 3).text;
                const labelY = b.v >= 0 ? top - 6 : top + h + 14;
                return (
                  <g key={b.id} className={`bar bar-${b.id}`} data-value={b.v}>
                    <rect x={b.x} y={top} width={barW} height={h} />
                    {st !== 'in' && (
                      <text className="offscale" x={b.x + barW / 2} y={st === 'above' ? M.top - 4 : M.top + ph + 14} textAnchor="middle">
                        {st === 'above' ? '▲' : '▼'}
                      </text>
                    )}
                    <text className="bar-value" x={Math.min(x0 + gw - 22, b.x + barW / 2)} y={st === 'in' ? labelY : st === 'above' ? M.top + 14 : M.top + ph - 6} textAnchor="middle">
                      {label}
                    </text>
                    <text className="bar-label" x={b.x + barW / 2} y={M.top + ph + 30} textAnchor="middle">
                      {b.id === 'reference' ? 'Ref' : 'Now'}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {groups.every((g) => g.reference === null) && <p className="bars-legend hint">Hatched “Ref” bars appear after you pin a reference.</p>}
    </div>
  );
}
