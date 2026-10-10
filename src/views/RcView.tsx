import { useId } from 'react';
import { RcCircuit } from '../components/CircuitDiagram';
import { MainValueControl, ParamControl, PlaybackControls, ScaleControls, SWEEP_SECONDS, WindowControls, playbackRateText } from '../components/Controls';
import { Plot, type Guide, type Series } from '../components/Plot';
import { fractionAfterTau } from '../engine/models/rc';
import { sampleFunction } from '../engine/models/sample';
import { useAppState, useDerived, useDispatch } from '../state/store';
import { Assumptions, ClockText, Figure, ModelError, Readouts, RefBar, fmt, ratio, sweepPosition, usePlayback } from './common';

/** Capacitance view: step response of an ideal series RC circuit. */
export function RcView() {
  const d = useDerived();
  const m = d.model;
  const win = useAppState((s) => s.windows['rc.t']);
  const vSpan = useAppState((s) => s.scales['rc.V']?.span ?? 10);
  const dispatch = useDispatch();
  const pb = usePlayback();
  const id = useId();
  if (m.kind !== 'rc') return null;
  const main = m.main.ok ? m.main.value : null;
  const ref = m.ref;
  const bipolar = d.axes['rc.V']?.bipolar ?? false;

  const series: Series[] = [];
  const guides: Guide[] = [];
  const marks = [];
  const summary: string[] = [];
  if (main && win) {
    series.push({ id: 'vc', label: 'Vc(t)', tone: 'primary', points: sampleFunction(main.vAt, 0, win, 480), at: main.vAt });
    if (ref) series.push({ id: 'ref', label: `Reference τ = ${fmt(ref.tau, 's')}`, tone: 'reference', dash: '7 5', points: sampleFunction(ref.vAt, 0, win, 480), at: ref.vAt });
    guides.push({ axis: 'y', value: main.Vs, label: `Final Vs = ${fmt(main.Vs, 'V')}`, tone: 'accent', dash: '6 4' });
    if (main.V0 !== 0) guides.push({ axis: 'y', value: main.V0, label: `Initial V0 = ${fmt(main.V0, 'V')}`, tone: 'muted', dash: '2 4' });
    for (let n = 1; n <= 5; n++) {
      if (n * main.tau <= win) guides.push({ axis: 'x', value: n * main.tau, label: n === 1 ? `τ = ${fmt(main.tau, 's')}` : `${n}τ`, tone: 'muted', dash: '2 5' });
    }
    if (main.tau <= win) marks.push({ x: main.tau, y: main.vAt(main.tau), label: `${fmt(main.vAt(main.tau), 'V')} (63.2 % of step)`, tone: 'accent' as const });

    summary.push(`τ = R × C = ${fmt(main.R, 'Ω')} × ${fmt(main.C, 'F')} = ${fmt(main.tau, 's')}.`);
    summary.push(
      main.V0 === 0
        ? `Starting from Vc(0) = 0 V: Vc(t) = Vs × (1 − e^(−t/τ)), rising toward Vs = ${fmt(main.Vs, 'V')}.`
        : `Starting from Vc(0) = ${fmt(main.V0, 'V')}: Vc(t) = Vs + (V0 − Vs) × e^(−t/τ), moving toward Vs = ${fmt(main.Vs, 'V')}.`,
    );
    summary.push(
      `After 1τ (${fmt(main.tau, 's')}): Vc = ${fmt(main.vAt(main.tau), 'V')} (${(fractionAfterTau(1) * 100).toFixed(1)} % of the step). After 5τ (${fmt(5 * main.tau, 's')}): ${fmt(main.vAt(5 * main.tau), 'V')} (${(fractionAfterTau(5) * 100).toFixed(1)} %).`,
    );
    summary.push(`Initial current (Vs − V0) / R = ${fmt(main.iInitial, 'A')}, decaying with the same τ.`);
    summary.push(`As a first-order low-pass filter, the same R and C give fc = 1 / (2πRC) = ${fmt(main.fc, 'Hz')}.`);
    if (5 * main.tau > win) summary.push(`The curve continues beyond the ${fmt(win, 's')} window (5τ = ${fmt(5 * main.tau, 's')}). Press “Fit 5τ” to see it settle.`);
    if (ref) summary.push(`Compared with the reference (τ = ${fmt(ref.tau, 's')}): τ ${ratio(main.tau, ref.tau)}.`);
  }
  const playhead = win && !pb.reduced ? { clock: pb.clock, x: (s: number) => sweepPosition(s, win, SWEEP_SECONDS) } : null;
  const span = vSpan;

  return (
    <div className="view">
      <div className="view-main">
        {main && win ? (
          <Figure id={id} model="ideal DC step through a series resistor into an ideal capacitor" summary={summary}>
            <div className="viz-split">
              <Plot
                ariaLabel={`RC charging curve: τ = ${fmt(main.tau, 's')}, from ${fmt(main.V0, 'V')} to ${fmt(main.Vs, 'V')} over a ${fmt(win, 's')} window`}
                x={{ min: 0, max: win, label: 'Time', unit: 's' }}
                y={{ min: bipolar ? -span : 0, max: span, label: 'Capacitor voltage', unit: 'V' }}
                series={series}
                guides={guides}
                marks={marks}
                playhead={playhead}
                inspectExtra={(t) => [
                  { label: 'Current i(t)', value: fmt(main.iAt(t), 'A') },
                  { label: 't / τ', value: (t / main.tau).toFixed(2) },
                ]}
              />
              <div className="circuit-wrap">
                <RcCircuit
                  title={`RC circuit: Vs ${fmt(main.Vs, 'V')}, R ${fmt(main.R, 'Ω')}, C ${fmt(main.C, 'F')}`}
                  direction={main.Vs > main.V0 ? 1 : main.Vs < main.V0 ? -1 : 0}
                  animate={pb.playing}
                  positiveTop={main.Vs >= 0}
                  vsLabel={`Vs = ${fmt(main.Vs, 'V')}`}
                  rLabel={`R = ${fmt(main.R, 'Ω')}`}
                  cLabel={`C = ${fmt(main.C, 'F')}`}
                  vcLabel={
                    playhead ? <ClockText clock={pb.clock} render={(s) => `Vc at playhead = ${fmt(main.vAt(sweepPosition(s, win, SWEEP_SECONDS)), 'V')}`} /> : `Vc → ${fmt(main.Vs, 'V')}`
                  }
                />
                {playhead && (
                  <p className="hint num">
                    <ClockText
                      clock={pb.clock}
                      render={(s) => {
                        const t = sweepPosition(s, win, SWEEP_SECONDS);
                        return `Playhead t = ${fmt(t, 's')} (${(t / main.tau).toFixed(2)} τ)`;
                      }}
                    />
                  </p>
                )}
              </div>
            </div>
            <Readouts
              items={[
                { label: <>Time constant <var>τ</var> = RC</>, value: fmt(main.tau, 's', 6) },
                { label: <>Cutoff <var>f</var><sub>c</sub> = 1/(2πRC)</>, value: fmt(main.fc, 'Hz', 6) },
                { label: <>Initial current</>, value: fmt(main.iInitial, 'A', 4) },
                { label: <>Time to 99 % (≈ 4.6τ)</>, value: fmt(Math.log(100) * main.tau, 's', 4) },
              ]}
            />
          </Figure>
        ) : (
          !m.main.ok && <ModelError error={m.main.error} />
        )}
        <Assumptions items={['ideal capacitor (no leakage, no ESR)', 'ideal switch closes at t = 0', 'ideal DC source', 'R and C constant']} />
      </div>
      <section className="view-params" aria-label="Model parameters">
        <h3 className="section-title">Model parameters</h3>
        <MainValueControl label="Capacitance C" />
        <ParamControl k="rc.R" />
        <ParamControl k="rc.Vs" />
        <ParamControl k="rc.V0" />
        <WindowControls wkey="rc.t" fitLabel="Fit 5τ" />
        <RefBar
          pinned={!!ref}
          refText={ref ? `τ = ${fmt(ref.tau, 's')} (R ${fmt(ref.R, 'Ω')}, C ${fmt(ref.C, 'F')})` : null}
          canPin={!!main}
          onPin={() => dispatch({ type: 'pinRef' })}
          onClear={() => dispatch({ type: 'clearRef' })}
        />
        <ScaleControls axes={[{ axis: 'rc.V', label: 'Voltage' }]} />
        <PlaybackControls playing={pb.playing} onToggle={pb.toggle} onRestart={pb.restart} reduced={pb.reduced} rateText={win ? playbackRateText(win) : null} />
      </section>
    </div>
  );
}
