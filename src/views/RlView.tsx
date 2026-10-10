import { useId } from 'react';
import { RlCircuit } from '../components/CircuitDiagram';
import { MainValueControl, ParamControl, PlaybackControls, ScaleControls, SWEEP_SECONDS, WindowControls, playbackRateText } from '../components/Controls';
import { Plot, type Guide, type Series } from '../components/Plot';
import { sampleFunction } from '../engine/models/sample';
import { useAppState, useDerived, useDispatch } from '../state/store';
import { Assumptions, ClockText, Figure, ModelError, Readouts, RefBar, fmt, ratio, sweepPosition, usePlayback } from './common';

/** Inductance view: current build-up in an ideal series RL circuit. */
export function RlView() {
  const d = useDerived();
  const m = d.model;
  const win = useAppState((s) => s.windows['rl.t']);
  const iSpan = useAppState((s) => s.scales['rl.I']?.span ?? 1);
  const dispatch = useDispatch();
  const pb = usePlayback();
  const id = useId();
  if (m.kind !== 'rl') return null;
  const main = m.main.ok ? m.main.value : null;
  const ref = m.ref;
  const bipolar = d.axes['rl.I']?.bipolar ?? false;

  const series: Series[] = [];
  const guides: Guide[] = [];
  const summary: string[] = [];
  if (main && win) {
    series.push({ id: 'i', label: 'i(t)', tone: 'primary', points: sampleFunction(main.iAt, 0, win, 480), at: main.iAt });
    if (ref) series.push({ id: 'ref', label: ref.tau !== null ? `Reference τ = ${fmt(ref.tau, 's')}` : 'Reference (ramp)', tone: 'reference', dash: '7 5', points: sampleFunction(ref.iAt, 0, win, 480), at: ref.iAt });
    if (main.iFinal !== null) guides.push({ axis: 'y', value: main.iFinal, label: `Final I = Vs/R = ${fmt(main.iFinal, 'A')}`, tone: 'accent', dash: '6 4' });
    if (main.tau !== null) {
      for (let n = 1; n <= 5; n++) {
        if (n * main.tau <= win) guides.push({ axis: 'x', value: n * main.tau, label: n === 1 ? `τ = ${fmt(main.tau, 's')}` : `${n}τ`, tone: 'muted', dash: '2 5' });
      }
      summary.push(`τ = L / R = ${fmt(main.L, 'H')} / ${fmt(main.R, 'Ω')} = ${fmt(main.tau, 's')}.`);
      summary.push(`i(t) = (Vs / R) × (1 − e^(−t/τ)) with zero initial current, rising toward Vs / R = ${fmt(main.iFinal ?? 0, 'A')}.`);
      summary.push(`At t = 0 the inductor opposes the change: di/dt = Vs / L = ${fmt(main.slope0, 'A/s')}, and the full Vs appears across L.`);
      summary.push(`After 1τ: i = ${fmt(main.iAt(main.tau), 'A')} (63.2 %). After 5τ: ${fmt(main.iAt(5 * main.tau), 'A')} (99.3 %).`);
      if (5 * main.tau > win) summary.push(`The curve continues beyond the ${fmt(win, 's')} window (5τ = ${fmt(5 * main.tau, 's')}). Press “Fit 5τ”.`);
    } else {
      summary.push(`R = 0 Ω: an ideal inductor alone has no steady state. The current ramps linearly at di/dt = Vs / L = ${fmt(main.slope0, 'A/s')} without limit.`);
      summary.push(`After the ${fmt(win, 's')} window: i = ${fmt(main.iAt(win), 'A')}. Real circuits always include resistance that limits the current.`);
    }
    if (ref && ref.tau !== null && main.tau !== null) summary.push(`Compared with the reference (τ = ${fmt(ref.tau, 's')}): τ ${ratio(main.tau, ref.tau)}.`);
  }
  const playhead = win && !pb.reduced ? { clock: pb.clock, x: (s: number) => sweepPosition(s, win, SWEEP_SECONDS) } : null;

  return (
    <div className="view">
      <div className="view-main">
        {main && win ? (
          <Figure id={id} model="ideal DC step into a series resistor and ideal inductor, zero initial current" summary={summary}>
            <div className="viz-split">
              <Plot
                ariaLabel={`RL current build-up: ${main.tau !== null ? `τ = ${fmt(main.tau, 's')}` : 'linear ramp'}, over a ${fmt(win, 's')} window`}
                x={{ min: 0, max: win, label: 'Time', unit: 's' }}
                y={{ min: bipolar ? -iSpan : 0, max: iSpan, label: 'Current', unit: 'A' }}
                series={series}
                guides={guides}
                playhead={playhead}
                inspectExtra={(t) => [{ label: 'Inductor voltage vL', value: fmt(main.vLAt(t), 'V') }]}
              />
              <div className="circuit-wrap">
                <RlCircuit
                  title={`RL circuit: Vs ${fmt(main.Vs, 'V')}, R ${fmt(main.R, 'Ω')}, L ${fmt(main.L, 'H')}`}
                  direction={main.Vs > 0 ? 1 : main.Vs < 0 ? -1 : 0}
                  animate={pb.playing}
                  positiveTop={main.Vs >= 0}
                  vsLabel={`Vs = ${fmt(main.Vs, 'V')}`}
                  rLabel={`R = ${fmt(main.R, 'Ω')}`}
                  lLabel={`L = ${fmt(main.L, 'H')}`}
                  iLabel={
                    playhead ? (
                      <ClockText clock={pb.clock} render={(s) => `i at playhead = ${fmt(main.iAt(sweepPosition(s, win, SWEEP_SECONDS)), 'A')}`} />
                    ) : main.iFinal !== null ? (
                      `i → ${fmt(main.iFinal, 'A')}`
                    ) : (
                      'i ramps without limit'
                    )
                  }
                />
              </div>
            </div>
            {main.ramp && <p className="note">R = 0 Ω gives an unbounded linear ramp in the ideal model. Enter a resistance to see exponential settling.</p>}
            <Readouts
              items={[
                { label: <>Time constant <var>τ</var> = L/R</>, value: main.tau !== null ? fmt(main.tau, 's', 6) : 'undefined (R = 0)' },
                { label: <>Final current <var>V</var><sub>s</sub>/R</>, value: main.iFinal !== null ? fmt(main.iFinal, 'A', 6) : 'no limit' },
                { label: <>Initial di/dt = Vs/L</>, value: fmt(main.slope0, 'A/s', 4) },
              ]}
            />
          </Figure>
        ) : (
          !m.main.ok && <ModelError error={m.main.error} />
        )}
        <Assumptions items={['ideal inductor (no core saturation, no winding capacitance)', 'all series resistance lumped into R', 'zero initial current', 'ideal switch and source']} />
      </div>
      <section className="view-params" aria-label="Model parameters">
        <h3 className="section-title">Model parameters</h3>
        <MainValueControl label="Inductance L" />
        <ParamControl k="rl.R" />
        <ParamControl k="rl.Vs" />
        <WindowControls wkey="rl.t" fitLabel="Fit 5τ" />
        <RefBar
          pinned={!!ref}
          refText={ref ? (ref.tau !== null ? `τ = ${fmt(ref.tau, 's')}` : 'ramp (R = 0)') : null}
          canPin={!!main}
          onPin={() => dispatch({ type: 'pinRef' })}
          onClear={() => dispatch({ type: 'clearRef' })}
        />
        <ScaleControls axes={[{ axis: 'rl.I', label: 'Current' }]} />
        <PlaybackControls playing={pb.playing} onToggle={pb.toggle} onRestart={pb.restart} reduced={pb.reduced} rateText={win ? playbackRateText(win) : null} />
      </section>
    </div>
  );
}
