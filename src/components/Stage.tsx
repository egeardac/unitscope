import { useId } from 'react';
import { useAppState, useDerived, useDispatch } from '../state/store';
import type { ViewKey } from '../state/types';
import { AcView } from '../views/AcView';
import { AccumulationView } from '../views/AccumulationView';
import { PcbView } from '../views/PcbView';
import { RcView } from '../views/RcView';
import { ResistanceView } from '../views/ResistanceView';
import { ResistiveView } from '../views/ResistiveView';
import { RlView } from '../views/RlView';
import { WaveView } from '../views/WaveView';

const TITLES: Record<ViewKey, [string, string]> = {
  dc: ['Voltage in a DC circuit', 'An ideal source across a resistor: current and power follow from Ohm’s law.'],
  ac: ['AC voltage: sine wave', 'RMS, peak and peak-to-peak on a calibrated time axis.'],
  current: ['Current through a resistor', 'The voltage and power needed to push this current through R.'],
  resistance: ['Resistance: I–V line', 'How much current flows for each voltage.'],
  rc: ['Capacitance: RC charging', 'How fast the capacitor voltage follows a step, τ = RC.'],
  rl: ['Inductance: RL current build-up', 'How fast current rises through the inductor, τ = L/R.'],
  frequency: ['Frequency and period', 'One waveform, T = 1/f, in a locked time window.'],
  time: ['Time as a period', 'The duration read as the period of a periodic signal, f = 1/T.'],
  power: ['Power over time', 'Energy accumulated at constant power, E = P × t.'],
  energy: ['Energy at constant power', 'When an energy target is reached, t = E / P.'],
  charge: ['Charge at constant current', 'When a charge target is reached, t = Q / I.'],
  pcb: ['PCB dimension diagram', 'Your dimension against common board features.'],
};

export function Stage() {
  const view = useDerived().view;
  const q = useAppState((s) => s.quantity);
  const mode = useAppState((s) => s.voltageMode);
  const dispatch = useDispatch();
  const id = useId();
  const [title, blurb] = TITLES[view];
  return (
    <section className="stage glass" aria-labelledby={`${id}-title`} data-view={view}>
      <header className="stage-head">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p className="hint">{blurb}</p>
        </div>
        {q === 'voltage' && (
          <div className="seg mode-switch" role="radiogroup" aria-label="Signal type">
            {(['dc', 'ac'] as const).map((m) => (
              <label key={m} className={mode === m ? 'is-on' : ''}>
                <input type="radio" name={`${id}-mode`} checked={mode === m} onChange={() => dispatch({ type: 'setVoltageMode', mode: m })} />
                {m === 'dc' ? 'DC' : 'AC (sine)'}
              </label>
            ))}
          </div>
        )}
      </header>
      <div className="stage-body" key={view}>
        {(view === 'dc' || view === 'current') && <ResistiveView />}
        {view === 'ac' && <AcView />}
        {view === 'resistance' && <ResistanceView />}
        {view === 'rc' && <RcView />}
        {view === 'rl' && <RlView />}
        {(view === 'frequency' || view === 'time') && <WaveView />}
        {(view === 'power' || view === 'energy' || view === 'charge') && <AccumulationView />}
        {view === 'pcb' && <PcbView />}
      </div>
    </section>
  );
}
