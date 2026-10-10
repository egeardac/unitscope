import { useId } from 'react';
import { MainValueControl, ScaleControls } from '../components/Controls';
import { formatNumber } from '../engine/format';
import { PCB_FEATURES } from '../engine/models/pcb';
import { linear, rangeStatus, ticks } from '../engine/scale';
import { useElementWidth } from '../hooks';
import { useAppState, useDerived, useDispatch } from '../state/store';
import { Assumptions, Figure, ModelError, RefBar, fmt, ratio } from './common';

const MIL = 25.4e-6;
const num = (v: number, sf = 4) => formatNumber(v, { sigFigs: sf, notation: 'auto', trimZeros: true }).text;

function dims(d: number): string {
  return `${num(d / 1e-3, 6)} mm = ${num(d / 1e-6, 6)} µm = ${num(d / MIL, 6)} mil = ${num(d / 0.0254, 6)} in`;
}

/** Calibrated dimension diagram with a dual mm / mil ruler. Diagram scale only, never physical screen size. */
function Ruler({ span, bars }: { span: number; bars: Array<{ id: string; label: string; value: number; tone: string }> }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(640);
  const W = Math.max(280, width);
  const L = 16;
  const R = W - 16;
  const sx = linear(0, span, L, R);
  const mmT = ticks(0, span / 1e-3, Math.max(3, Math.floor(W / 90)));
  const milT = ticks(0, span / MIL, Math.max(3, Math.floor(W / 90)));
  const H = 96 + bars.length * 34;
  const barTop = 62;
  return (
    <div className="ruler" ref={ref}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Dimension diagram, full width ${fmt(span, 'm')}: ${bars.map((b) => `${b.label} ${fmt(b.value, 'm')}`).join('; ')}`} data-testid="ruler-svg">
        <rect className="plot-area" x={L} y={8} width={R - L} height={H - 16} />
        <text className="axis-title" x={L + 4} y={22}>
          Millimetres (mm)
        </text>
        {mmT.map((t) => (
          <g key={`mm${t}`}>
            <line className="axis" x1={sx(t * 1e-3)} x2={sx(t * 1e-3)} y1={28} y2={40} />
            <text className="tick" x={sx(t * 1e-3)} y={52} textAnchor="middle">
              {num(t)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const st = rangeStatus(b.value, 0, span);
          const w = Math.max(1, sx(Math.min(span, b.value)) - L);
          const y = barTop + i * 34;
          return (
            <g key={b.id} className={`ruler-bar tone-${b.tone}`}>
              <rect x={L} y={y} width={w} height={18} />
              <text className="bar-value" x={Math.min(L + w + 6, R - 4)} y={y + 13} textAnchor={L + w + 6 > R - 140 ? 'end' : 'start'}>
                {st === 'above' ? '▶ ' : ''}
                {b.label}: {fmt(b.value, 'm')}
              </text>
            </g>
          );
        })}
        {milT.map((t) => (
          <g key={`mil${t}`}>
            <line className="axis" x1={sx(t * MIL)} x2={sx(t * MIL)} y1={H - 40} y2={H - 28} />
            <text className="tick" x={sx(t * MIL)} y={H - 16} textAnchor="middle">
              {num(t)}
            </text>
          </g>
        ))}
        <text className="axis-title" x={R - 4} y={H - 44} textAnchor="end">
          Mils (mil)
        </text>
      </svg>
    </div>
  );
}

export function PcbView() {
  const d = useDerived();
  const m = d.model;
  const span = useAppState((s) => s.scales['pcb.d']?.span ?? 1e-3);
  const featureId = useAppState((s) => s.pcbFeature);
  const dispatch = useDispatch();
  const id = useId();
  if (m.kind !== 'pcb') return null;
  const main = m.main.ok ? m.main.value : null;
  const summary: string[] = [];
  const bars: Array<{ id: string; label: string; value: number; tone: string }> = [];
  if (main) {
    bars.push({ id: 'v', label: 'Your value', value: main.d, tone: 'primary' });
    bars.push({ id: 'f', label: main.feature.label, value: main.feature.value, tone: 'reference' });
    if (m.ref) bars.push({ id: 'r', label: 'Pinned', value: m.ref.d, tone: 'accent' });
    summary.push(`${dims(main.d)}.`);
    summary.push(`Compared with ${main.feature.label} (${num(main.feature.value / 1e-3, 4)} mm, ${main.feature.note}): ${ratio(main.d, main.feature.value)}.`);
    if (m.ref) summary.push(`Compared with the pinned value (${fmt(m.ref.d, 'm')}): ${ratio(main.d, m.ref.d)}.`);
    summary.push(`Diagram full width = ${fmt(span, 'm')}. This is a diagram scale; on-screen lengths do not match physical millimetres on an uncalibrated display.`);
  }
  return (
    <div className="view">
      <div className="view-main">
        {main ? (
          <Figure id={id} model="dimension diagram with a shared mm / mil ruler (diagram scale, not physical size)" summary={summary}>
            <Ruler span={span} bars={bars} />
            <table className="data-table">
              <caption>Common PCB features compared with your value</caption>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col">Size</th>
                  <th scope="col">Your value is</th>
                </tr>
              </thead>
              <tbody>
                {PCB_FEATURES.map((f) => (
                  <tr key={f.id}>
                    <th scope="row">
                      {f.label}
                      <span className="hint block">{f.note}</span>
                    </th>
                    <td className="num">
                      {num(f.value / 1e-3, 4)} mm · {num(f.value / MIL, 4)} mil
                    </td>
                    <td className="num">{ratio(main.d, f.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Figure>
        ) : (
          !m.main.ok && <ModelError error={m.main.error} />
        )}
        <Assumptions items={['1 mil = 0.001 in = 25.4 µm exactly', 'feature sizes are typical references, not manufacturer design rules', 'diagram scale is not screen-calibrated']} />
      </div>
      <section className="view-params" aria-label="Model parameters">
        <h3 className="section-title">Diagram settings</h3>
        <MainValueControl label="Dimension d" />
        <label className="param">
          <span className="param-label">Compare with</span>
          <select className="field" value={featureId} onChange={(e) => dispatch({ type: 'setPcbFeature', id: e.target.value })}>
            {PCB_FEATURES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <RefBar pinned={!!m.ref} refText={m.ref ? fmt(m.ref.d, 'm') : null} canPin={!!main} onPin={() => dispatch({ type: 'pinRef' })} onClear={() => dispatch({ type: 'clearRef' })} />
        <ScaleControls axes={[{ axis: 'pcb.d', label: 'Diagram width' }]} />
      </section>
    </div>
  );
}
