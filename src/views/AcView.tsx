import { useId } from 'react';
import { AMPLITUDE_LABEL, MAX_DRAWN_CYCLES, sineAt, type AmplitudeKind } from '../engine/models/acSine';
import { sampleFunction } from '../engine/models/sample';
import { formatNumber } from '../engine/format';
import { Plot, type Guide, type Series } from '../components/Plot';
import { MainValueControl, ParamControl, PlaybackControls, ScaleControls, SWEEP_SECONDS, WindowControls, playbackRateText } from '../components/Controls';
import { useAppState, useDerived, useDispatch } from '../state/store';
import { Assumptions, ClockText, Figure, ModelError, Readouts, RefBar, fmt, ratio, sweepPosition, usePlayback } from './common';

function sineSeries(id: string, label: string, tone: Series['tone'], peak: number, f: number, win: number, dash?: string): Series {
  const cycles = f * win;
  if (cycles > MAX_DRAWN_CYCLES) return { id, label, tone, points: [], band: { lo: -peak, hi: peak }, ...(dash ? { dash } : {}) };
  const n = Math.min(3000, Math.max(400, Math.ceil(cycles * 48)));
  return { id, label, tone, points: sampleFunction((t) => sineAt(peak, f, t), 0, win, n), at: (t) => sineAt(peak, f, t), ...(dash ? { dash } : {}) };
}

/** AC voltage view: a zero-offset sine on a calibrated oscilloscope-style plot. */
export function AcView() {
  const d = useDerived();
  const m = d.model;
  const win = useAppState((s) => s.windows['ac.t']);
  const scale = useAppState((s) => s.scales['ac.V']);
  const ampKind = useAppState((s) => s.ampKind);
  const dispatch = useDispatch();
  const pb = usePlayback();
  const id = useId();
  if (m.kind !== 'ac') return null;
  const main = m.main.ok ? m.main.value : null;
  const ref = m.ref;
  const span = scale?.span ?? 20;

  const series: Series[] = [];
  const guides: Guide[] = [];
  const summary: string[] = [];
  let cycles = 0;
  if (main && win) {
    const { rms, peak, pp } = main.amps;
    cycles = main.f * win;
    series.push(sineSeries('v', 'v(t)', 'primary', peak, main.f, win));
    if (ref) series.push(sineSeries('ref', 'Reference', 'reference', ref.amps.peak, ref.f, win, '7 5'));
    guides.push(
      { axis: 'y', value: peak, label: `+Vpk ${fmt(peak, 'V')}`, tone: 'accent', dash: '2 3' },
      { axis: 'y', value: -peak, label: `−Vpk`, tone: 'accent', dash: '2 3' },
      { axis: 'y', value: rms, label: `Vrms ${fmt(rms, 'V')}`, tone: 'muted', dash: '8 4' },
    );
    if (main.T <= win) guides.push({ axis: 'x', value: main.T, label: `T = ${fmt(main.T, 's')}`, tone: 'muted', dash: '2 4' });
    summary.push(
      ampKind === 'rms'
        ? `Vrms = ${fmt(rms, 'V')} → Vpk = √2 × Vrms = ${fmt(peak, 'V', 10)}, Vpp = 2 × Vpk = ${fmt(pp, 'V', 10)}.`
        : ampKind === 'peak'
          ? `Vpk = ${fmt(peak, 'V')} → Vrms = Vpk / √2 = ${fmt(rms, 'V', 10)}, Vpp = 2 × Vpk = ${fmt(pp, 'V', 10)}.`
          : `Vpp = ${fmt(pp, 'V')} → Vpk = Vpp / 2 = ${fmt(peak, 'V', 10)}, Vrms = Vpk / √2 = ${fmt(rms, 'V', 10)}.`,
    );
    summary.push(`f = ${fmt(main.f, 'Hz')} → T = 1 / f = ${fmt(main.T, 's')}. The ${fmt(win, 's')} window holds ${formatNumber(cycles, { sigFigs: 4, notation: 'auto', trimZeros: true }).text} cycles.`);
    summary.push('These RMS–peak relations hold for a pure sine with no DC offset only; other waveform shapes have different ratios.');
    if (ref) summary.push(`Compared with the reference (${fmt(ref.amps.rms, 'V')} rms, ${fmt(ref.f, 'Hz')}): amplitude ${ratio(peak, ref.amps.peak)}, frequency ${ratio(main.f, ref.f)}.`);
  }
  const playhead = win && !pb.reduced ? { clock: pb.clock, x: (s: number) => sweepPosition(s, win, SWEEP_SECONDS) } : null;
  const tooMany = cycles > MAX_DRAWN_CYCLES;

  return (
    <div className="view">
      <div className="view-main">
        {main && win ? (
          <Figure id={id} model="ideal sine-wave source, zero DC offset: v(t) = Vpk · sin(2πft)" summary={summary}>
            <Plot
              ariaLabel={`Oscilloscope plot of a ${fmt(main.amps.rms, 'V')} rms, ${fmt(main.f, 'Hz')} sine over a ${fmt(win, 's')} window`}
              x={{ min: 0, max: win, label: 'Time', unit: 's' }}
              y={{ min: -span, max: span, label: 'Voltage', unit: 'V' }}
              series={series}
              guides={guides}
              playhead={playhead}
              inspectExtra={(t) => [{ label: 'Phase', value: `${formatNumber(((main.f * t) % 1) * 360, { sigFigs: 4, notation: 'auto', trimZeros: true }).text}°` }]}
            />
            {tooMany && (
              <p className="note">
                This window holds {formatNumber(cycles, { sigFigs: 3, notation: 'auto', trimZeros: true }).text} cycles, too many to draw individually, so the
                envelope (±Vpk) is shown instead of an aliased trace. Shorten the window or press “Fit 3 cycles”.
              </p>
            )}
            {playhead && (
              <p className="hint num">
                <ClockText
                  clock={pb.clock}
                  render={(s) => {
                    const t = sweepPosition(s, win, SWEEP_SECONDS);
                    return `Playhead t = ${fmt(t, 's')}: v = ${fmt(sineAt(main.amps.peak, main.f, t), 'V')}`;
                  }}
                />
              </p>
            )}
            <Readouts
              items={[
                { label: <>RMS <var>V</var><sub>rms</sub></>, value: fmt(main.amps.rms, 'V', 6) },
                { label: <>Peak <var>V</var><sub>pk</sub></>, value: fmt(main.amps.peak, 'V', 6) },
                { label: <>Peak-to-peak <var>V</var><sub>pp</sub></>, value: fmt(main.amps.pp, 'V', 6) },
                { label: <>Period <var>T</var></>, value: fmt(main.T, 's', 6) },
              ]}
            />
          </Figure>
        ) : (
          !m.main.ok && <ModelError error={m.main.error} />
        )}
        <Assumptions items={['pure sine, zero DC offset', 'ideal source', 'RMS and peak relations apply to sine waves only']} />
      </div>
      <section className="view-params" aria-label="Model parameters">
        <h3 className="section-title">Model parameters</h3>
        <fieldset className="seg-field">
          <legend>The converter value is the</legend>
          <div className="seg" role="radiogroup" aria-label="Amplitude meaning">
            {(['rms', 'peak', 'pp'] as AmplitudeKind[]).map((k) => (
              <label key={k} className={ampKind === k ? 'is-on' : ''}>
                <input type="radio" name={`${id}-amp`} checked={ampKind === k} onChange={() => dispatch({ type: 'setAmpKind', kind: k })} />
                {AMPLITUDE_LABEL[k]}
              </label>
            ))}
          </div>
        </fieldset>
        <MainValueControl label={`Amplitude (${AMPLITUDE_LABEL[ampKind]})`} spec={{ kind: 'linear', min: 0, max: 400 }} />
        <ParamControl k="ac.f" />
        <WindowControls wkey="ac.t" fitLabel="Fit 3 cycles" />
        <RefBar
          pinned={!!ref}
          refText={ref ? `${fmt(ref.amps.rms, 'V')} rms at ${fmt(ref.f, 'Hz')}` : null}
          canPin={!!main}
          onPin={() => dispatch({ type: 'pinRef' })}
          onClear={() => dispatch({ type: 'clearRef' })}
        />
        <ScaleControls axes={[{ axis: 'ac.V', label: 'Voltage' }]} />
        <PlaybackControls playing={pb.playing} onToggle={pb.toggle} onRestart={pb.restart} reduced={pb.reduced} rateText={win ? playbackRateText(win) : null} />
      </section>
    </div>
  );
}
