import { useId } from 'react';
import { DcCircuit } from '../components/CircuitDiagram';
import { MainValueControl, ParamControl, ScaleControls } from '../components/Controls';
import { Plot, type Series } from '../components/Plot';
import { useAppState, useDerived, useDispatch } from '../state/store';
import { Assumptions, Figure, ModelError, Readouts, RefBar, fmt, ratio } from './common';

/** Resistance view: the I–V line of an ideal resistor with an operating point. */
export function ResistanceView() {
  const d = useDerived();
  const m = d.model;
  const vSpan = useAppState((s) => s.scales['res.V']?.span ?? 20);
  const iSpan = useAppState((s) => s.scales['res.I']?.span ?? 0.01);
  const dispatch = useDispatch();
  const id = useId();
  if (m.kind !== 'resistance') return null;
  const main = m.main.ok ? m.main.value : null;
  const ref = m.ref;

  const series: Series[] = [];
  const summary: string[] = [];
  if (main) {
    const R = main.R;
    series.push({ id: 'iv', label: `I = V / ${fmt(R, 'Ω')}`, tone: 'primary', points: [[-vSpan, -vSpan / R], [vSpan, vSpan / R]], at: (v) => v / R });
    if (ref) series.push({ id: 'ref', label: `Reference ${fmt(ref.R, 'Ω')}`, tone: 'reference', dash: '7 5', points: [[-vSpan, -vSpan / ref.R], [vSpan, vSpan / ref.R]], at: (v) => v / ref.R });
    summary.push(`R = ${fmt(R, 'Ω')}: the I–V line has slope 1/R = ${fmt(1 / R, 'S')} (siemens).`);
    summary.push(`At V = ${fmt(main.V, 'V')}: I = V / R = ${fmt(main.I, 'A')}, P = V² / R = ${fmt(main.P, 'W')}.`);
    summary.push('A larger resistance gives a flatter line: less current for the same voltage.');
    if (ref) summary.push(`Compared with ${fmt(ref.R, 'Ω')}: R ${ratio(R, ref.R)}, so current at the same voltage is ${ratio(ref.R, R)}.`);
  }

  return (
    <div className="view">
      <div className="view-main">
        {main ? (
          <Figure id={id} model="ideal linear resistor, I = V / R" summary={summary}>
            <div className="viz-split">
              <Plot
                ariaLabel={`I–V characteristic of ${fmt(main.R, 'Ω')}; operating point ${fmt(main.V, 'V')}, ${fmt(main.I, 'A')}`}
                x={{ min: -vSpan, max: vSpan, label: 'Voltage', unit: 'V' }}
                y={{ min: -iSpan, max: iSpan, label: 'Current', unit: 'A' }}
                series={series}
                marks={[{ x: main.V, y: main.I, label: `${fmt(main.V, 'V')}, ${fmt(main.I, 'A')}`, tone: 'accent' }]}
              />
              <div className="circuit-wrap">
                <DcCircuit
                  title={`Circuit: ${fmt(main.V, 'V')} across ${fmt(main.R, 'Ω')}`}
                  direction={main.I > 0 ? 1 : main.I < 0 ? -1 : 0}
                  animate={false}
                  positiveTop={main.V >= 0}
                  vLabel={`V = ${fmt(main.V, 'V')}`}
                  rLabel={`R = ${fmt(main.R, 'Ω')}`}
                  iLabel={`I = ${fmt(main.I, 'A')}`}
                  pLabel={`P = ${fmt(main.P, 'W')}`}
                />
              </div>
            </div>
            <Readouts
              items={[
                { label: <>Resistance <var>R</var></>, value: fmt(main.R, 'Ω', 6) },
                { label: <>Conductance <var>G</var> = 1/R</>, value: fmt(1 / main.R, 'S', 6) },
                { label: <>Current <var>I</var></>, value: fmt(main.I, 'A', 6) },
                { label: <>Power <var>P</var></>, value: fmt(main.P, 'W', 6) },
              ]}
            />
          </Figure>
        ) : (
          !m.main.ok && <ModelError error={m.main.error} />
        )}
        <Assumptions items={['linear resistor: R independent of voltage, current and temperature', 'ideal source and wires']} />
      </div>
      <section className="view-params" aria-label="Model parameters">
        <h3 className="section-title">Model parameters</h3>
        <MainValueControl label="Resistance R" />
        <ParamControl k="circuit.V" note="Sets the operating point on the line." />
        <RefBar
          pinned={!!ref}
          refText={ref ? fmt(ref.R, 'Ω') : null}
          canPin={!!main}
          onPin={() => dispatch({ type: 'pinRef' })}
          onClear={() => dispatch({ type: 'clearRef' })}
        />
        <ScaleControls
          axes={[
            { axis: 'res.I', label: 'Current (vertical)' },
            { axis: 'res.V', label: 'Voltage (horizontal)' },
          ]}
        />
      </section>
    </div>
  );
}
