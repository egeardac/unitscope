import { BarCompare, type BarGroup } from '../components/BarCompare';
import { DcCircuit } from '../components/CircuitDiagram';
import { MainValueControl, ParamControl, PlaybackControls, ScaleControls } from '../components/Controls';
import { useAppState, useDerived, useDispatch } from '../state/store';
import { Assumptions, Figure, ModelError, RefBar, fmt, ratio, usePlayback, Readouts } from './common';

const ASSUMPTIONS = [
  'ideal source with no internal resistance',
  'ideal wires (0 Ω)',
  'linear resistor: R stays constant (no self-heating, no tolerance)',
  'steady DC state',
];

/** Voltage (DC) and Current views: an ideal source driving an ideal resistor. */
export function ResistiveView() {
  const d = useDerived();
  const m = d.model;
  const scales = useAppState((s) => s.scales);
  const dispatch = useDispatch();
  const pb = usePlayback();
  if (m.kind !== 'dc' && m.kind !== 'current') return null;
  const byVoltage = m.kind === 'dc';
  const key = byVoltage ? 'dc' : 'cur';
  const main = m.main.ok ? m.main.value : null;
  const ref = m.ref;

  const span = (axis: string) => scales[`${key}.${axis}`]?.span ?? 1;
  const note = (axis: string) => (scales[`${key}.${axis}`]?.mode === 'manual' ? 'manual scale' : 'auto scale (expand only)');
  const bip = (axis: string) => d.axes[`${key}.${axis}`]?.bipolar ?? false;
  const groups: BarGroup[] = [
    { key: 'V', label: 'Voltage', symbol: 'V', unit: 'V', span: span('V'), bipolar: bip('V'), current: main?.V ?? null, reference: ref?.V ?? null, scaleNote: note('V') },
    { key: 'I', label: 'Current', symbol: 'I', unit: 'A', span: span('I'), bipolar: bip('I'), current: main?.I ?? null, reference: ref?.I ?? null, scaleNote: note('I') },
    { key: 'P', label: 'Power', symbol: 'P', unit: 'W', span: span('P'), bipolar: false, current: main?.P ?? null, reference: ref?.P ?? null, scaleNote: note('P') },
  ];
  if (!byVoltage) groups.unshift(groups.splice(1, 1)[0]!);

  const summary: string[] = [];
  if (main) {
    if (byVoltage) {
      summary.push(`V = ${fmt(main.V, 'V')} across R = ${fmt(main.R, 'Ω')}.`);
      summary.push(`I = V / R = ${fmt(main.I, 'A')}.`);
      summary.push(`P = V² / R = ${fmt(main.P, 'W')}, absorbed by the resistor.`);
    } else {
      summary.push(`I = ${fmt(main.I, 'A')} through R = ${fmt(main.R, 'Ω')}.`);
      summary.push(`V = I × R = ${fmt(main.V, 'V')}.`);
      summary.push(`P = I² × R = ${fmt(main.P, 'W')}, absorbed by the resistor.`);
    }
    if (main.polarity === 'negative') {
      summary.push('The sign is negative: the source polarity is reversed, so conventional current flows counter-clockwise. A resistor still absorbs power (P > 0).');
    } else if (main.polarity === 'positive') {
      summary.push('Conventional current leaves the + terminal and flows clockwise through R.');
    } else {
      summary.push('No voltage, so no current flows and no power is dissipated.');
    }
    if (ref) {
      summary.push(
        `Compared with the reference (${fmt(byVoltage ? ref.V : ref.I, byVoltage ? 'V' : 'A')}, ${fmt(ref.R, 'Ω')}): V ${ratio(main.V, ref.V)}, I ${ratio(main.I, ref.I)}, P ${ratio(main.P, ref.P)}${
          ref.R === main.R ? `. With the same R, power scales with the square of ${byVoltage ? 'voltage' : 'current'}.` : '.'
        }`,
      );
    }
  }

  const direction: 1 | -1 | 0 = main ? (main.I > 0 ? 1 : main.I < 0 ? -1 : 0) : 0;
  const refText = ref ? `${fmt(byVoltage ? ref.V : ref.I, byVoltage ? 'V' : 'A')} with R = ${fmt(ref.R, 'Ω')}` : null;

  return (
    <div className="view">
      <div className="view-main">
        {main ? (
          <Figure id={`${key}-fig`} model={`ideal ${byVoltage ? 'DC voltage' : 'current'} source driving an ideal resistor (Ohm’s law)`} summary={summary}>
            <div className="viz-split">
              <div className="circuit-wrap">
                <DcCircuit
                  title={`Circuit: source ${fmt(main.V, 'V')} across resistor ${fmt(main.R, 'Ω')}, current ${fmt(main.I, 'A')}`}
                  direction={direction}
                  animate={pb.playing}
                  positiveTop={main.V >= 0}
                  vLabel={`V = ${fmt(main.V, 'V')}`}
                  rLabel={`R = ${fmt(main.R, 'Ω')}`}
                  iLabel={`I = ${fmt(main.I, 'A')}`}
                  pLabel={`P = ${fmt(main.P, 'W')}`}
                />
                <p className="hint">Arrow: conventional current direction. Moving dashes are symbolic; their speed is not electron drift speed.</p>
              </div>
              <BarCompare
                groups={groups}
                ariaLabel={`Bar chart comparing now and reference on shared scales. Now: V ${fmt(main.V, 'V')}, I ${fmt(main.I, 'A')}, P ${fmt(main.P, 'W')}.${
                  ref ? ` Reference: V ${fmt(ref.V, 'V')}, I ${fmt(ref.I, 'A')}, P ${fmt(ref.P, 'W')}.` : ' No reference pinned.'
                }`}
              />
            </div>
            <Readouts
              items={[
                { label: <>Voltage <var>V</var></>, value: fmt(main.V, 'V', 6) },
                { label: <>Current <var>I</var></>, value: fmt(main.I, 'A', 6) },
                { label: <>Power <var>P</var></>, value: fmt(main.P, 'W', 6) },
              ]}
            />
          </Figure>
        ) : (
          !m.main.ok && <ModelError error={m.main.error} />
        )}
        <Assumptions items={ASSUMPTIONS} />
      </div>
      <section className="view-params" aria-label="Model parameters">
        <h3 className="section-title">Model parameters</h3>
        <MainValueControl label={byVoltage ? 'Source voltage V' : 'Current I'} />
        <ParamControl k="circuit.R" />
        <RefBar pinned={!!ref} refText={refText} canPin={!!main} onPin={() => dispatch({ type: 'pinRef' })} onClear={() => dispatch({ type: 'clearRef' })} />
        <ScaleControls
          axes={
            byVoltage
              ? [
                  { axis: 'dc.V', label: 'Voltage' },
                  { axis: 'dc.I', label: 'Current' },
                  { axis: 'dc.P', label: 'Power' },
                ]
              : [
                  { axis: 'cur.I', label: 'Current' },
                  { axis: 'cur.V', label: 'Voltage' },
                  { axis: 'cur.P', label: 'Power' },
                ]
          }
        />
        <PlaybackControls playing={pb.playing} onToggle={pb.toggle} onRestart={pb.restart} reduced={pb.reduced} rateText="Pause or resume the symbolic current-direction animation." />
      </section>
    </div>
  );
}
