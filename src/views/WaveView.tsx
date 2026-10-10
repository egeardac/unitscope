import { useId } from 'react';
import { MainValueControl, PlaybackControls, SWEEP_SECONDS, WindowControls, playbackRateText } from '../components/Controls';
import { Plot, type Guide, type Series } from '../components/Plot';
import { formatNumber } from '../engine/format';
import { MAX_DRAWN_CYCLES, sineAt } from '../engine/models/acSine';
import { angularFrequency } from '../engine/models/periodic';
import { sampleFunction } from '../engine/models/sample';
import { useAppState, useDerived, useDispatch } from '../state/store';
import { Assumptions, Figure, ModelError, Readouts, RefBar, fmt, ratio, sweepPosition, usePlayback } from './common';

const num = (v: number, sf = 4) => formatNumber(v, { sigFigs: sf, notation: 'auto', trimZeros: true }).text;

function wave(id: string, label: string, tone: Series['tone'], f: number, win: number, dash?: string): Series {
  const cycles = f * win;
  if (cycles > MAX_DRAWN_CYCLES) return { id, label, tone, points: [], band: { lo: -1, hi: 1 } };
  const n = Math.min(3000, Math.max(400, Math.ceil(cycles * 48)));
  return { id, label, tone, points: sampleFunction((t) => sineAt(1, f, t), 0, win, n), at: (t) => sineAt(1, f, t), ...(dash ? { dash } : {}) };
}

/** Frequency and Time views: one periodic signal, T = 1/f, in a locked time window. */
export function WaveView() {
  const d = useDerived();
  const m = d.model;
  const isTime = m.kind === 'time';
  const wkey = isTime ? 'time.t' : 'frequency.t';
  const win = useAppState((s) => s.windows[wkey]);
  const dispatch = useDispatch();
  const pb = usePlayback();
  const id = useId();
  if (m.kind !== 'frequency' && m.kind !== 'time') return null;
  const main = m.main.ok ? m.main.value : null;
  const ref = m.ref;

  const series: Series[] = [];
  const guides: Guide[] = [];
  const summary: string[] = [];
  let cycles = 0;
  if (main && win) {
    cycles = main.f * win;
    series.push(wave('s', isTime ? `Signal with T = ${fmt(main.T, 's')}` : `Signal at ${fmt(main.f, 'Hz')}`, 'primary', main.f, win));
    if (ref) series.push(wave('ref', isTime ? `Reference T = ${fmt(ref.T, 's')}` : `Reference ${fmt(ref.f, 'Hz')}`, 'reference', ref.f, win, '7 5'));
    if (main.T <= win) guides.push({ axis: 'x', value: main.T, label: `T = ${fmt(main.T, 's')}`, tone: 'accent', dash: '5 4' });
    if (isTime) summary.push(`The duration ${fmt(main.T, 's')} is interpreted as the period T of a periodic sine signal.`);
    summary.push(isTime ? `f = 1 / T = ${fmt(main.f, 'Hz', 6)}.` : `T = 1 / f = ${fmt(main.T, 's', 6)}.`);
    summary.push(`Angular frequency ω = 2πf = ${fmt(angularFrequency(main.f), 'rad/s')}.`);
    summary.push(`The ${fmt(win, 's')} window holds ${num(cycles)} cycles.`);
    if (ref) summary.push(`Compared with the reference: frequency ${ratio(main.f, ref.f)}, period ${ratio(main.T, ref.T)}.`);
  }
  const playhead = win && !pb.reduced ? { clock: pb.clock, x: (s: number) => sweepPosition(s, win, SWEEP_SECONDS) } : null;

  return (
    <div className="view">
      <div className="view-main">
        {main && win ? (
          <Figure id={id} model={`periodic sine of unit amplitude, period T = 1/f${isTime ? ' (duration read as the period)' : ''}`} summary={summary}>
            <Plot
              ariaLabel={`Waveform with f = ${fmt(main.f, 'Hz')} and T = ${fmt(main.T, 's')} over a ${fmt(win, 's')} window`}
              x={{ min: 0, max: win, label: 'Time', unit: 's' }}
              y={{ min: -1.2, max: 1.2, label: 'Amplitude', unit: 'normalized', noPrefix: true }}
              series={series}
              guides={guides}
              playhead={playhead}
              inspectExtra={(t) => [
                { label: 'Cycles from t = 0', value: num(main.f * t) },
                { label: 'Phase', value: `${num(((main.f * t) % 1) * 360)}°` },
              ]}
            />
            {cycles > MAX_DRAWN_CYCLES && (
              <p className="note">
                {num(cycles, 3)} cycles fit in this window, too many to draw individually, so only the envelope is shown. Press “Fit 3 cycles” to zoom in.
              </p>
            )}
            <Readouts
              items={[
                { label: <>Frequency <var>f</var></>, value: fmt(main.f, 'Hz', 6) },
                { label: <>Period <var>T</var> = 1/f</>, value: fmt(main.T, 's', 6) },
                { label: <>Angular frequency <var>ω</var></>, value: fmt(angularFrequency(main.f), 'rad/s', 6) },
              ]}
            />
          </Figure>
        ) : (
          !m.main.ok && <ModelError error={m.main.error} />
        )}
        <Assumptions items={['ideal periodic sine', 'amplitude is normalized (shape and timing only)', 'the screen never flashes at the signal frequency; playback is slowed or time-lapsed and labelled']} />
      </div>
      <section className="view-params" aria-label="Model parameters">
        <h3 className="section-title">Model parameters</h3>
        <MainValueControl label={isTime ? 'Period T' : 'Frequency f'} />
        <WindowControls wkey={wkey} fitLabel="Fit 3 cycles" />
        <RefBar
          pinned={!!ref}
          refText={ref ? `${fmt(ref.f, 'Hz')} (T = ${fmt(ref.T, 's')})` : null}
          canPin={!!main}
          onPin={() => dispatch({ type: 'pinRef' })}
          onClear={() => dispatch({ type: 'clearRef' })}
        />
        <PlaybackControls playing={pb.playing} onToggle={pb.toggle} onRestart={pb.restart} reduced={pb.reduced} rateText={win ? playbackRateText(win) : null} />
      </section>
    </div>
  );
}
