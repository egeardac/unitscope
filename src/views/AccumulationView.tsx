import { useId } from 'react';
import { MainValueControl, ParamControl, PlaybackControls, ScaleControls, SWEEP_SECONDS, playbackRateText } from '../components/Controls';
import { Plot, type Guide, type MarkPoint, type Series } from '../components/Plot';
import { formatNumber } from '../engine/format';
import { useAppState, useDerived, useDispatch } from '../state/store';
import { Assumptions, ClockText, Figure, ModelError, Readouts, RefBar, fmt, fmtDuration, ratio, sweepPosition, timeAxis, usePlayback } from './common';

const num = (v: number, sf = 4) => formatNumber(v, { sigFigs: sf, notation: 'auto', trimZeros: true }).text;

/** Power, Energy and Charge views: constant-rate accumulation E = P·t or Q = I·t. */
export function AccumulationView() {
  const d = useDerived();
  const m = d.model;
  const scales = useAppState((s) => s.scales);
  const axisUnits = useAppState((s) => s.axisUnits);
  const dispatch = useDispatch();
  const pb = usePlayback();
  const id = useId();
  if (m.kind !== 'power' && m.kind !== 'energy' && m.kind !== 'charge') return null;
  const isCharge = m.kind === 'charge';
  const axisKey = m.kind === 'power' ? 'pow.E' : m.kind === 'energy' ? 'en.E' : 'ch.Q';
  const span = scales[axisKey]?.span ?? 1;
  const bipolar = d.axes[axisKey]?.bipolar ?? false;

  // Display unit for the vertical axis: J (SI-prefixed) or Wh; C (SI-prefixed) or mAh.
  const yu = isCharge
    ? axisUnits.charge === 'mAh'
      ? { factor: 3.6, unit: 'mAh', noPrefix: true }
      : { factor: 1, unit: 'C', noPrefix: false }
    : axisUnits.energy === 'Wh'
      ? { factor: 3600, unit: 'Wh', noPrefix: true }
      : { factor: 1, unit: 'J', noPrefix: false };
  const fy = (v: number) => (yu.noPrefix ? `${num(v / yu.factor)} ${yu.unit}` : fmt(v, yu.unit));
  const both = (v: number) => (isCharge ? `${fmt(v, 'C')} = ${num(v / 3.6)} mAh = ${num(v / 3600)} Ah` : `${fmt(v, 'J')} = ${num(v / 3600)} Wh = ${num(v / 3.6e6)} kWh`);

  let window = 0;
  let rate = 0;
  let target: number | null = null;
  let reach: { ok: true; value: number } | { ok: false; error: { message: string } } | null = null;
  const summary: string[] = [];
  const main = m.main.ok ? m.main.value : null;
  let refRate: number | null = null;
  let refTarget: number | null = null;

  if (m.kind === 'power' && m.main.ok) {
    window = m.main.value.duration;
    rate = m.main.value.P;
    summary.push(`P = ${fmt(rate, 'W')} held for t = ${fmtDuration(window)} → E = P × t = ${both(m.main.value.E)}.`);
    if (rate < 0) summary.push('Negative power means energy flows out of the element, so the accumulated energy decreases.');
    refRate = m.ref?.P ?? null;
    if (refRate !== null) summary.push(`Compared with the reference ${fmt(refRate, 'W')}: energy after the same time ${ratio(rate, refRate)}.`);
  } else if (m.kind === 'energy' && m.main.ok) {
    window = m.main.value.window;
    rate = m.main.value.P;
    target = m.main.value.E;
    reach = m.main.value.reach;
    summary.push(`Target E = ${both(target)}.`);
    summary.push(reach.ok ? `At a constant P = ${fmt(rate, 'W')}, it is delivered after t = E / P = ${fmtDuration(reach.value)}.` : reach.error.message);
    refTarget = m.ref?.E ?? null;
    if (refTarget !== null) summary.push(`Reference target ${both(refTarget)}: ${ratio(target, refTarget)}.`);
  } else if (m.kind === 'charge' && m.main.ok) {
    window = m.main.value.window;
    rate = m.main.value.I;
    target = m.main.value.Q;
    reach = m.main.value.reach;
    summary.push(`Target Q = ${both(target)}.`);
    summary.push(reach.ok ? `At a constant I = ${fmt(rate, 'A')}, it is accumulated after t = Q / I = ${fmtDuration(reach.value)}.` : reach.error.message);
    summary.push('A battery’s usable capacity depends on discharge rate, temperature and age; this ideal model only applies Q = I × t.');
    refTarget = m.ref?.Q ?? null;
    if (refTarget !== null) summary.push(`Reference ${both(refTarget)}: ${ratio(target, refTarget)}.`);
  }

  const ta = timeAxis(window || 1);
  const series: Series[] = [];
  const guides: Guide[] = [];
  const marks: MarkPoint[] = [];
  if (main) {
    const toY = (si: number) => si / yu.factor;
    series.push({
      id: 'acc',
      label: isCharge ? 'Q(t) = I × t' : 'E(t) = P × t',
      tone: 'primary',
      points: [
        [0, 0],
        [window / ta.factor, toY(rate * window)],
      ],
      at: (x) => toY(rate * x * ta.factor),
    });
    if (refRate !== null) {
      const rr = refRate;
      series.push({ id: 'ref', label: `Reference ${fmt(rr, 'W')}`, tone: 'reference', dash: '7 5', points: [[0, 0], [window / ta.factor, toY(rr * window)]], at: (x) => toY(rr * x * ta.factor) });
    }
    if (target !== null) guides.push({ axis: 'y', value: toY(target), label: `Target ${fy(target)}`, tone: 'accent', dash: '6 4' });
    if (refTarget !== null) guides.push({ axis: 'y', value: toY(refTarget), label: `Reference ${fy(refTarget)}`, tone: 'reference', dash: '7 5' });
    if (reach?.ok && reach.value <= window) {
      guides.push({ axis: 'x', value: reach.value / ta.factor, label: `reached at ${fmtDuration(reach.value)}`, tone: 'muted', dash: '2 4' });
      if (target !== null) marks.push({ x: reach.value / ta.factor, y: toY(target), label: fy(target), tone: 'accent' });
    } else if (reach?.ok && target !== null) {
      summary.push(`That is beyond the ${fmtDuration(window)} window; lengthen the window to see the crossing.`);
    }
    if (m.kind === 'power') marks.push({ x: window / ta.factor, y: toY(rate * window), label: fy(rate * window), tone: 'accent' });
  }
  const playhead = window && !pb.reduced ? { clock: pb.clock, x: (s: number) => sweepPosition(s, window, SWEEP_SECONDS) / ta.factor } : null;
  const rateKey = m.kind === 'charge' ? 'charge.I' : 'energy.P';
  const windowKey = m.kind === 'power' ? 'power.t' : m.kind === 'energy' ? 'energy.t' : 'charge.t';

  return (
    <div className="view">
      <div className="view-main">
        {main ? (
          <Figure id={id} model={isCharge ? 'charge moved at a constant current, Q = I × t' : 'energy delivered at a constant power, E = P × t'} summary={summary}>
            <Plot
              ariaLabel={`${isCharge ? 'Charge' : 'Energy'} accumulated over ${fmtDuration(window)}`}
              x={{ min: 0, max: window / ta.factor, label: 'Time', unit: ta.unit, noPrefix: ta.noPrefix }}
              y={{ min: bipolar ? -span / yu.factor : 0, max: span / yu.factor, label: isCharge ? 'Charge' : 'Energy', unit: yu.unit, noPrefix: yu.noPrefix }}
              series={series}
              guides={guides}
              marks={marks}
              playhead={playhead}
            />
            {playhead && (
              <p className="hint num">
                <ClockText
                  clock={pb.clock}
                  render={(s) => {
                    const t = sweepPosition(s, window, SWEEP_SECONDS);
                    return `Playhead t = ${fmtDuration(t)}: ${isCharge ? 'Q' : 'E'} = ${fy(rate * t)}`;
                  }}
                />
              </p>
            )}
            <Readouts
              items={
                m.kind === 'power'
                  ? [
                      { label: <>Energy <var>E</var> = P × t</>, value: fmt(rate * window, 'J', 6) },
                      { label: 'In watt-hours', value: `${num(rate * window / 3600, 6)} Wh` },
                      { label: 'In kilowatt-hours', value: `${num(rate * window / 3.6e6, 6)} kWh` },
                    ]
                  : [
                      { label: isCharge ? 'Charge Q' : 'Energy E', value: target !== null ? fy(target) : '—' },
                      { label: 'Time to reach', value: reach?.ok ? fmtDuration(reach.value) : 'not reached' },
                      { label: isCharge ? 'After the window' : 'After the window', value: fy(rate * window) },
                    ]
              }
            />
          </Figure>
        ) : (
          !m.main.ok && <ModelError error={m.main.error} />
        )}
        <Assumptions items={isCharge ? ['current held exactly constant', 'no losses', 'battery capacity is not modelled'] : ['power held exactly constant', 'no losses or conversion efficiency']} />
      </div>
      <section className="view-params" aria-label="Model parameters">
        <h3 className="section-title">Model parameters</h3>
        <MainValueControl label={m.kind === 'power' ? 'Power P' : m.kind === 'energy' ? 'Energy target E' : 'Charge target Q'} />
        {m.kind !== 'power' && <ParamControl k={rateKey} />}
        <ParamControl k={windowKey} />
        <fieldset className="seg-field">
          <legend>Vertical axis unit</legend>
          <div className="seg" role="radiogroup" aria-label="Vertical axis unit">
            {(isCharge ? (['C', 'mAh'] as const) : (['J', 'Wh'] as const)).map((u) => (
              <label key={u} className={(isCharge ? axisUnits.charge : axisUnits.energy) === u ? 'is-on' : ''}>
                <input
                  type="radio"
                  name={`${id}-yu`}
                  checked={(isCharge ? axisUnits.charge : axisUnits.energy) === u}
                  onChange={() =>
                    isCharge ? dispatch({ type: 'setAxisUnit', which: 'charge', unit: u as 'C' | 'mAh' }) : dispatch({ type: 'setAxisUnit', which: 'energy', unit: u as 'J' | 'Wh' })
                  }
                />
                {u}
              </label>
            ))}
          </div>
        </fieldset>
        <RefBar
          pinned={!!m.ref}
          refText={refRate !== null ? fmt(refRate, 'W') : refTarget !== null ? fy(refTarget) : null}
          canPin={!!main}
          onPin={() => dispatch({ type: 'pinRef' })}
          onClear={() => dispatch({ type: 'clearRef' })}
        />
        <ScaleControls axes={[{ axis: axisKey, label: isCharge ? 'Charge' : 'Energy' }]} />
        <PlaybackControls playing={pb.playing} onToggle={pb.toggle} onRestart={pb.restart} reduced={pb.reduced} rateText={window ? playbackRateText(window) : null} />
      </section>
    </div>
  );
}
