import { useId, useState, type ReactNode } from 'react';
import { toSI } from '../engine/convert';
import { formatNumber, formatSI } from '../engine/format';
import { parseQuantityInput } from '../engine/parse';
import { fail, type Result } from '../engine/result';
import { converterUnits, getUnit, type QuantityId } from '../engine/units';
import { sineAmplitudes, AMPLITUDE_LABEL, type AmplitudeKind } from '../engine/models/acSine';
import { angularFrequency, frequencyFromPeriod, periodFromFrequency } from '../engine/models/periodic';
import { rcTimeConstant } from '../engine/models/rc';
import { rlModel } from '../engine/models/rl';
import { dbmToWatts, dbwToWatts, powerRatioDb, voltageRatioDb, vrmsToDbm, wattsToDbm, wattsToDbw } from '../engine/models/decibel';
import { chargeToEnergy, energyToCharge } from '../engine/models/battery';
import { OHM_PAIRS, solveOhm, type OhmPair } from '../engine/models/ohm';
import { ErrorNote } from '../components/Controls';
import { useDerived } from '../state/store';
import type { Derived } from '../state/derive';

/* ---------------------------------------------------------------------- */
/* Shared field                                                           */
/* ---------------------------------------------------------------------- */

interface FieldState {
  text: string;
  unit: string;
}

function parseField(f: FieldState, q: QuantityId, allowNegative: boolean): Result<number> {
  const unit = getUnit(f.unit);
  if (!unit) return fail('UNKNOWN_UNIT', 'Choose a unit.');
  const p = parseQuantityInput(f.text, q, unit, { allowNegative });
  if (!p.ok) return p;
  return toSI(p.value.value, p.value.unit);
}

function ValueField({
  label,
  q,
  value,
  onChange,
  allowNegative = false,
  units,
}: {
  label: ReactNode;
  q: QuantityId;
  value: FieldState;
  onChange: (v: FieldState) => void;
  allowNegative?: boolean;
  units?: string[];
}) {
  const id = useId();
  const r = value.text.trim() === '' ? null : parseField(value, q, allowNegative);
  const list = units ? units.map((u) => getUnit(u)!).filter(Boolean) : converterUnits(q);
  return (
    <div className="calc-field">
      <label htmlFor={id}>{label}</label>
      <div className="param-row">
        <input
          id={id}
          className="field num"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value.text}
          aria-invalid={r !== null && !r.ok}
          onChange={(e) => {
            const text = e.target.value;
            const p = parseQuantityInput(text, q, getUnit(value.unit)!, { allowNegative: true });
            onChange({ text, unit: p.ok && p.value.unitFromText && list.some((u) => u.id === p.value.unit.id) ? p.value.unit.id : value.unit });
          }}
        />
        <select className="field unit-select" aria-label={`${typeof label === 'string' ? label : 'Value'} unit`} value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value })}>
          {list.map((u) => (
            <option key={u.id} value={u.id}>
              {u.symbol}
            </option>
          ))}
        </select>
      </div>
      {r && !r.ok && <ErrorNote error={r.error} />}
    </div>
  );
}

const s = (v: number, unit: string, sf = 6) => formatSI(v, unit, sf).text;
const n = (v: number, sf = 6) => formatNumber(v, { sigFigs: sf, notation: 'auto', trimZeros: true }).text;

function Outputs({ rows }: { rows: Array<[ReactNode, string]> }) {
  return (
    <dl className="calc-out" aria-live="polite">
      {rows.map(([k, v], i) => (
        <div key={i}>
          <dt>{k}</dt>
          <dd className="num">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Need({ children }: { children: ReactNode }) {
  return <p className="note">{children}</p>;
}

/** Collect results of required fields; returns null while any is empty, or the first error. */
function all(...rs: Array<Result<number> | null>): { values: number[] } | { error: Result<never> } | null {
  if (rs.some((r) => r === null)) return null;
  for (const r of rs) if (r && !r.ok) return { error: r as Result<never> };
  return { values: rs.map((r) => (r as { ok: true; value: number }).value) };
}

function fieldFrom(si: number | null, unitId: string): FieldState {
  return { text: si === null ? '' : String(Number(si.toPrecision(12))), unit: unitId };
}

function workspaceDc(d: Derived): { V: number | null; I: number | null; R: number | null } {
  const m = d.model;
  if ((m.kind === 'dc' || m.kind === 'current' || m.kind === 'resistance') && m.main.ok) return { V: m.main.value.V, I: m.main.value.I, R: m.main.value.R };
  const R = d.params['circuit.R'];
  return { V: null, I: null, R: R.ok ? R.value : null };
}

/* ---------------------------------------------------------------------- */
/* Panels                                                                 */
/* ---------------------------------------------------------------------- */

function OhmPanel() {
  const d = useDerived();
  const [pair, setPair] = useState<OhmPair>('VR');
  const [V, setV] = useState<FieldState>({ text: '', unit: 'V' });
  const [I, setI] = useState<FieldState>({ text: '', unit: 'mA' });
  const [R, setR] = useState<FieldState>({ text: '', unit: 'kohm' });
  const [P, setP] = useState<FieldState>({ text: '', unit: 'mW' });
  const known = pair.split('') as Array<'V' | 'I' | 'R' | 'P'>;
  const fields = {
    V: <ValueField key="V" label="Voltage V" q="voltage" value={V} onChange={setV} allowNegative />,
    I: <ValueField key="I" label="Current I" q="current" value={I} onChange={setI} allowNegative />,
    R: <ValueField key="R" label="Resistance R" q="resistance" value={R} onChange={setR} />,
    P: <ValueField key="P" label="Power P" q="power" value={P} onChange={setP} />,
  };
  const parsed = {
    V: V.text.trim() ? parseField(V, 'voltage', true) : null,
    I: I.text.trim() ? parseField(I, 'current', true) : null,
    R: R.text.trim() ? parseField(R, 'resistance', false) : null,
    P: P.text.trim() ? parseField(P, 'power', false) : null,
  };
  const inputs = all(parsed[known[0]!], parsed[known[1]!]);
  const res = inputs && 'values' in inputs ? solveOhm(pair, inputs.values[0]!, inputs.values[1]!) : null;
  const useWorkspace = () => {
    const w = workspaceDc(d);
    if (w.V !== null) setV(fieldFrom(w.V, 'V'));
    if (w.I !== null) setI(fieldFrom(w.I, 'A'));
    if (w.R !== null) setR(fieldFrom(w.R, 'ohm'));
    setPair('VR');
  };
  return (
    <div className="calc">
      <p className="formula">
        <var>V</var> = <var>I</var> × <var>R</var>, <var>P</var> = <var>V</var> × <var>I</var> = <var>V</var>²/<var>R</var> = <var>I</var>²<var>R</var>
      </p>
      <label className="calc-field">
        <span>Known values</span>
        <select className="field" value={pair} onChange={(e) => setPair(e.target.value as OhmPair)}>
          {OHM_PAIRS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      {known.map((k) => fields[k])}
      <button type="button" className="btn ghost" onClick={useWorkspace}>
        Use workspace values
      </button>
      {inputs === null && <Need>Enter both known values to calculate. Nothing is assumed.</Need>}
      {inputs && 'error' in inputs && !inputs.error.ok && <ErrorNote error={inputs.error.error} />}
      {res && !res.ok && <ErrorNote error={res.error} />}
      {res && res.ok && (
        <Outputs
          rows={(['V', 'I', 'R', 'P'] as const)
            .filter((k) => !known.includes(k))
            .map((k) => [
              <>
                {k === 'V' ? 'Voltage' : k === 'I' ? 'Current' : k === 'R' ? 'Resistance' : 'Power'} <var>{k}</var>
                {res.value.magnitudeOnly && (k === 'V' || k === 'I') ? ' (magnitude)' : ''}
              </>,
              s(res.value[k], k === 'V' ? 'V' : k === 'I' ? 'A' : k === 'R' ? 'Ω' : 'W'),
            ])}
        />
      )}
    </div>
  );
}

function FreqPeriodPanel() {
  const d = useDerived();
  const [mode, setMode] = useState<'f' | 'T'>('f');
  const [f, setF] = useState<FieldState>({ text: '', unit: 'kHz' });
  const [T, setT] = useState<FieldState>({ text: '', unit: 'ms' });
  const r = mode === 'f' ? (f.text.trim() ? parseField(f, 'frequency', false) : null) : T.text.trim() ? parseField(T, 'time', false) : null;
  const out = r && r.ok ? (mode === 'f' ? periodFromFrequency(r.value) : frequencyFromPeriod(r.value)) : null;
  const useWorkspace = () => {
    if (d.model.kind === 'frequency' || d.model.kind === 'time' || d.model.kind === 'ac') {
      if (d.model.main.ok) {
        setMode('f');
        setF(fieldFrom(d.model.main.value.f, 'Hz'));
      }
    }
  };
  return (
    <div className="calc">
      <p className="formula">
        <var>T</var> = 1 / <var>f</var>, <var>ω</var> = 2π<var>f</var>
      </p>
      <Seg name="fp" value={mode} onChange={(v) => setMode(v as 'f' | 'T')} options={[['f', 'From frequency'], ['T', 'From period']]} />
      {mode === 'f' ? <ValueField label="Frequency f" q="frequency" value={f} onChange={setF} /> : <ValueField label="Period T" q="time" value={T} onChange={setT} />}
      <button type="button" className="btn ghost" onClick={useWorkspace}>
        Use workspace values
      </button>
      {r === null && <Need>Enter a {mode === 'f' ? 'frequency' : 'period'} to calculate.</Need>}
      {r && !r.ok && <ErrorNote error={r.error} />}
      {out && !out.ok && <ErrorNote error={out.error} />}
      {out && out.ok && r && r.ok && (
        <Outputs
          rows={
            mode === 'f'
              ? [
                  [<>Period <var>T</var></>, s(out.value, 's')],
                  [<>Angular frequency <var>ω</var></>, s(angularFrequency(r.value), 'rad/s')],
                ]
              : [
                  [<>Frequency <var>f</var></>, s(out.value, 'Hz')],
                  [<>Angular frequency <var>ω</var></>, s(angularFrequency(out.value), 'rad/s')],
                ]
          }
        />
      )}
    </div>
  );
}

function RmsPanel() {
  const d = useDerived();
  const [kind, setKind] = useState<AmplitudeKind>('rms');
  const [v, setV] = useState<FieldState>({ text: '', unit: 'V' });
  const r = v.text.trim() ? parseField(v, 'voltage', true) : null;
  const out = r && r.ok ? sineAmplitudes(r.value, kind) : null;
  return (
    <div className="calc">
      <p className="formula">
        Sine only: <var>V</var>
        <sub>pk</sub> = √2 × <var>V</var>
        <sub>rms</sub>, <var>V</var>
        <sub>pp</sub> = 2 × <var>V</var>
        <sub>pk</sub>
      </p>
      <Seg name="rms" value={kind} onChange={(x) => setKind(x as AmplitudeKind)} options={(['rms', 'peak', 'pp'] as const).map((k) => [k, AMPLITUDE_LABEL[k]])} />
      <ValueField label={`${AMPLITUDE_LABEL[kind]} voltage`} q="voltage" value={v} onChange={setV} allowNegative />
      <button
        type="button"
        className="btn ghost"
        onClick={() => {
          if (d.model.kind === 'ac' && d.model.main.ok) {
            setKind('rms');
            setV(fieldFrom(d.model.main.value.amps.rms, 'V'));
          } else if (d.si.ok && d.view === 'dc') {
            setV(fieldFrom(d.si.value, 'V'));
          }
        }}
      >
        Use workspace values
      </button>
      {r === null && <Need>Enter a voltage to calculate. Valid for sine waves with zero DC offset only.</Need>}
      {r && !r.ok && <ErrorNote error={r.error} />}
      {out && !out.ok && <ErrorNote error={out.error} />}
      {out && out.ok && (
        <Outputs
          rows={[
            ['RMS', s(out.value.rms, 'V', 10)],
            ['Peak', s(out.value.peak, 'V', 10)],
            ['Peak-to-peak', s(out.value.pp, 'V', 10)],
          ]}
        />
      )}
      <p className="hint">Square, triangle and other waveforms have different RMS-to-peak ratios; these formulas do not apply to them.</p>
    </div>
  );
}

function TimeConstantPanel() {
  const d = useDerived();
  const [R, setR] = useState<FieldState>({ text: '', unit: 'kohm' });
  const [C, setC] = useState<FieldState>({ text: '', unit: 'nF' });
  const [L, setL] = useState<FieldState>({ text: '', unit: 'mH' });
  const rR = R.text.trim() ? parseField(R, 'resistance', false) : null;
  const rC = C.text.trim() ? parseField(C, 'capacitance', false) : null;
  const rL = L.text.trim() ? parseField(L, 'inductance', false) : null;
  const rc = all(rR, rC);
  const rl = all(rR, rL);
  const tauRc = rc && 'values' in rc ? rcTimeConstant(rc.values[0]!, rc.values[1]!) : null;
  const tauRl = rl && 'values' in rl ? rlModel(rl.values[1]!, rl.values[0]!, 1) : null;
  const useWorkspace = () => {
    const m = d.model;
    if (m.kind === 'rc' && m.main.ok) {
      setR(fieldFrom(m.main.value.R, 'ohm'));
      setC(fieldFrom(m.main.value.C, 'F'));
    } else if (m.kind === 'rl' && m.main.ok) {
      setR(fieldFrom(m.main.value.R, 'ohm'));
      setL(fieldFrom(m.main.value.L, 'H'));
    } else if (m.kind === 'resistance' && m.main.ok) setR(fieldFrom(m.main.value.R, 'ohm'));
    else if (d.view === 'rc' || d.view === 'rl') return;
  };
  return (
    <div className="calc">
      <p className="formula">
        <var>τ</var> = <var>RC</var>, <var>f</var>
        <sub>c</sub> = 1 / (2π<var>RC</var>) · <var>τ</var> = <var>L</var>/<var>R</var>, <var>f</var>
        <sub>c</sub> = <var>R</var> / (2π<var>L</var>)
      </p>
      <ValueField label="Resistance R" q="resistance" value={R} onChange={setR} />
      <ValueField label="Capacitance C" q="capacitance" value={C} onChange={setC} />
      <ValueField label="Inductance L (optional)" q="inductance" value={L} onChange={setL} />
      <button type="button" className="btn ghost" onClick={useWorkspace}>
        Use workspace values
      </button>
      {rc === null && rl === null && <Need>Enter R and C (and/or L) to calculate.</Need>}
      {rc && 'error' in rc && !rc.error.ok && <ErrorNote error={rc.error.error} />}
      {tauRc && !tauRc.ok && <ErrorNote error={tauRc.error} />}
      {tauRc && tauRc.ok && (
        <Outputs
          rows={[
            [<>RC time constant <var>τ</var></>, s(tauRc.value, 's')],
            [<>RC low-pass cutoff <var>f</var><sub>c</sub></>, s(1 / (2 * Math.PI * tauRc.value), 'Hz')],
            ['Time to 63.2 % / 99.3 %', `${s(tauRc.value, 's', 4)} / ${s(5 * tauRc.value, 's', 4)}`],
          ]}
        />
      )}
      {tauRl && !tauRl.ok && <ErrorNote error={tauRl.error} />}
      {tauRl && tauRl.ok && tauRl.value.tau !== null && (
        <Outputs
          rows={[
            [<>RL time constant <var>τ</var></>, s(tauRl.value.tau, 's')],
            [<>RL low-pass cutoff <var>f</var><sub>c</sub></>, s(1 / (2 * Math.PI * tauRl.value.tau), 'Hz')],
          ]}
        />
      )}
    </div>
  );
}

function DecibelPanel() {
  const d = useDerived();
  const [mode, setMode] = useState<'W' | 'dBm' | 'dBW'>('W');
  const [p, setP] = useState<FieldState>({ text: '', unit: 'mW' });
  const [level, setLevel] = useState('');
  const [p1, setP1] = useState<FieldState>({ text: '', unit: 'mW' });
  const [p2, setP2] = useState<FieldState>({ text: '', unit: 'mW' });
  const [v1, setV1] = useState<FieldState>({ text: '', unit: 'V' });
  const [v2, setV2] = useState<FieldState>({ text: '', unit: 'V' });
  const [vr, setVr] = useState<FieldState>({ text: '', unit: 'V' });
  const [load, setLoad] = useState<FieldState>({ text: '', unit: 'ohm' });

  let levelOut: ReactNode = <Need>Enter a {mode === 'W' ? 'power' : `level in ${mode}`} to calculate.</Need>;
  if (mode === 'W' && p.text.trim()) {
    const r = parseField(p, 'power', true);
    if (!r.ok) levelOut = <ErrorNote error={r.error} />;
    else {
      const a = wattsToDbm(r.value);
      const b = wattsToDbw(r.value);
      if (!a.ok) levelOut = <ErrorNote error={a.error} />;
      else if (!b.ok) levelOut = <ErrorNote error={b.error} />;
      else levelOut = <Outputs rows={[['Level in dBm (ref. 1 mW)', `${n(a.value)} dBm`], ['Level in dBW (ref. 1 W)', `${n(b.value)} dBW`]]} />;
    }
  } else if (mode !== 'W' && level.trim()) {
    const parsed = parseQuantityInput(level, 'power', getUnit('W')!, { allowNegative: true });
    if (!parsed.ok || parsed.value.unitFromText) levelOut = <ErrorNote error={parsed.ok ? { code: 'INVALID_NUMBER', message: 'Enter only the number of decibels.' } : parsed.error} />;
    else {
      const w = mode === 'dBm' ? dbmToWatts(parsed.value.value) : dbwToWatts(parsed.value.value);
      levelOut = !w.ok ? (
        <ErrorNote error={w.error} />
      ) : (
        <Outputs
          rows={[
            ['Power', s(w.value, 'W')],
            [mode === 'dBm' ? 'Level in dBW' : 'Level in dBm', mode === 'dBm' ? `${n(parsed.value.value - 30)} dBW` : `${n(parsed.value.value + 30)} dBm`],
          ]}
        />
      );
    }
  }

  const pr = all(p1.text.trim() ? parseField(p1, 'power', true) : null, p2.text.trim() ? parseField(p2, 'power', true) : null);
  const prOut = pr && 'values' in pr ? powerRatioDb(pr.values[0]!, pr.values[1]!) : null;
  const vrr = all(v1.text.trim() ? parseField(v1, 'voltage', true) : null, v2.text.trim() ? parseField(v2, 'voltage', true) : null);
  const vrOut = vrr && 'values' in vrr ? voltageRatioDb(vrr.values[0]!, vrr.values[1]!) : null;
  const vIn = vr.text.trim() ? parseField(vr, 'voltage', true) : null;
  const rIn = load.text.trim() ? parseField(load, 'resistance', false) : null;
  const vdbm = vIn && vIn.ok && (rIn === null || rIn.ok) ? vrmsToDbm(vIn.value, rIn && rIn.ok ? rIn.value : null) : null;

  return (
    <div className="calc">
      <p className="formula">
        dBm = 10 log<sub>10</sub>(<var>P</var> / 1 mW), dBW = 10 log<sub>10</sub>(<var>P</var> / 1 W), gain = 10 log<sub>10</sub>(<var>P</var>
        <sub>2</sub>/<var>P</var>
        <sub>1</sub>) dB
      </p>
      <h4 className="calc-sub">Power level</h4>
      <Seg name="dbmode" value={mode} onChange={(x) => setMode(x as 'W' | 'dBm' | 'dBW')} options={[['W', 'From power'], ['dBm', 'From dBm'], ['dBW', 'From dBW']]} />
      {mode === 'W' ? (
        <ValueField label="Power P" q="power" value={p} onChange={setP} allowNegative />
      ) : (
        <div className="calc-field">
          <label htmlFor="db-level">Level ({mode})</label>
          <input id="db-level" className="field num" inputMode="decimal" value={level} onChange={(e) => setLevel(e.target.value)} />
        </div>
      )}
      <button
        type="button"
        className="btn ghost"
        onClick={() => {
          if (d.view === 'power' && d.si.ok) {
            setMode('W');
            setP(fieldFrom(d.si.value, 'W'));
          }
        }}
      >
        Use workspace power
      </button>
      {levelOut}

      <h4 className="calc-sub">Ratios</h4>
      <div className="calc-pair">
        <ValueField label="P1 (reference)" q="power" value={p1} onChange={setP1} allowNegative />
        <ValueField label="P2" q="power" value={p2} onChange={setP2} allowNegative />
      </div>
      {pr && 'error' in pr && !pr.error.ok && <ErrorNote error={pr.error.error} />}
      {prOut && (prOut.ok ? <Outputs rows={[['Power ratio', `${n(prOut.value)} dB`]]} /> : <ErrorNote error={prOut.error} />)}
      <div className="calc-pair">
        <ValueField label="V1 (reference)" q="voltage" value={v1} onChange={setV1} allowNegative />
        <ValueField label="V2" q="voltage" value={v2} onChange={setV2} allowNegative />
      </div>
      {vrr && 'error' in vrr && !vrr.error.ok && <ErrorNote error={vrr.error.error} />}
      {vrOut && (vrOut.ok ? <Outputs rows={[['Voltage ratio, 20 log10(V2/V1)', `${n(vrOut.value)} dB`]]} /> : <ErrorNote error={vrOut.error} />)}
      <p className="hint">
        A voltage ratio in dB equals the power gain only when both voltages are measured across equal resistances, because P = V²/R. Across different resistances,
        compare powers instead.
      </p>

      <h4 className="calc-sub">Voltage across a load → dBm</h4>
      <ValueField label="RMS voltage Vrms" q="voltage" value={vr} onChange={setVr} allowNegative />
      <ValueField label="Load resistance R (required)" q="resistance" value={load} onChange={setLoad} />
      <div className="fixes" aria-label="Common load resistances">
        {['50', '75', '600'].map((x) => (
          <button key={x} type="button" className="chip" onClick={() => setLoad({ text: x, unit: 'ohm' })}>
            Use {x} Ω
          </button>
        ))}
      </div>
      {vIn === null && <Need>Enter the RMS voltage and the load resistance. No load is assumed; a voltage maps to dBm only across a known resistance.</Need>}
      {vIn && !vIn.ok && <ErrorNote error={vIn.error} />}
      {rIn && !rIn.ok && <ErrorNote error={rIn.error} />}
      {vdbm && !vdbm.ok && <ErrorNote error={vdbm.error} />}
      {vdbm && vdbm.ok && <Outputs rows={[['Power P = Vrms² / R', s(vdbm.value.P, 'W')], ['Level', `${n(vdbm.value.dBm)} dBm`]]} />}
    </div>
  );
}

function BatteryPanel() {
  const d = useDerived();
  const [mode, setMode] = useState<'Q' | 'E'>('Q');
  const [q, setQ] = useState<FieldState>({ text: '', unit: 'mAh' });
  const [e, setE] = useState<FieldState>({ text: '', unit: 'Wh' });
  const [v, setV] = useState<FieldState>({ text: '', unit: 'V' });
  const a = mode === 'Q' ? (q.text.trim() ? parseField(q, 'charge', false) : null) : e.text.trim() ? parseField(e, 'energy', false) : null;
  const vn = v.text.trim() ? parseField(v, 'voltage', false) : null;
  const inputs = all(a, vn);
  let out: Result<number> | null = null;
  if (a && a.ok) out = mode === 'Q' ? chargeToEnergy(a.value, vn && vn.ok ? vn.value : null) : energyToCharge(a.value, vn && vn.ok ? vn.value : null);
  return (
    <div className="calc">
      <p className="formula">
        <var>E</var> ≈ <var>Q</var> × <var>V</var>
        <sub>nom</sub> (Wh ≈ Ah × V)
      </p>
      <Seg name="bat" value={mode} onChange={(x) => setMode(x as 'Q' | 'E')} options={[['Q', 'Ah → Wh'], ['E', 'Wh → Ah']]} />
      {mode === 'Q' ? <ValueField label="Charge Q" q="charge" value={q} onChange={setQ} /> : <ValueField label="Energy E" q="energy" value={e} onChange={setE} />}
      <ValueField label="Nominal voltage Vnom (required)" q="voltage" value={v} onChange={setV} />
      <button
        type="button"
        className="btn ghost"
        onClick={() => {
          if (d.view === 'charge' && d.si.ok) {
            setMode('Q');
            setQ(fieldFrom(d.si.value / 3.6, 'mAh'));
          } else if (d.view === 'energy' && d.si.ok) {
            setMode('E');
            setE(fieldFrom(d.si.value / 3600, 'Wh'));
          }
        }}
      >
        Use workspace values
      </button>
      {inputs === null && <Need>Enter the {mode === 'Q' ? 'charge' : 'energy'} and the nominal voltage. No voltage is assumed.</Need>}
      {inputs && 'error' in inputs && !inputs.error.ok && <ErrorNote error={inputs.error.error} />}
      {inputs && 'values' in inputs && out && !out.ok && <ErrorNote error={out.error} />}
      {inputs && 'values' in inputs && out && out.ok && (
        <>
          <Outputs
            rows={
              mode === 'Q'
                ? [
                    ['Energy (approx.)', `${n(out.value / 3600)} Wh`],
                    ['In joules (approx.)', s(out.value, 'J')],
                  ]
                : [
                    ['Charge (approx.)', `${n(out.value / 3.6)} mAh`],
                    ['In ampere-hours (approx.)', `${n(out.value / 3600)} Ah`],
                  ]
            }
          />
          <p className="hint">Approximation based on the nominal voltage. Real cell voltage changes during discharge, with load, temperature and age.</p>
        </>
      )}
    </div>
  );
}

function Seg({ name, value, onChange, options }: { name: string; value: string; onChange: (v: string) => void; options: Array<readonly [string, string]> }) {
  const id = useId();
  return (
    <div className="seg" role="radiogroup">
      {options.map(([v, label]) => (
        <label key={v} className={value === v ? 'is-on' : ''}>
          <input type="radio" name={`${id}-${name}`} checked={value === v} onChange={() => onChange(v)} />
          {label}
        </label>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Contextual container                                                   */
/* ---------------------------------------------------------------------- */

type CalcId = 'ohm' | 'fp' | 'rms' | 'tau' | 'db' | 'bat';

const CALC_LABEL: Record<CalcId, string> = {
  ohm: 'Ohm’s law & power',
  fp: 'Frequency ↔ period',
  rms: 'RMS / peak / peak-to-peak',
  tau: 'Time constants & cutoff',
  db: 'W ↔ dBm ↔ dBW',
  bat: 'Ah ↔ Wh (battery)',
};

const CALCS_FOR: Record<QuantityId, CalcId[]> = {
  voltage: ['ohm', 'rms', 'db'],
  current: ['ohm'],
  resistance: ['ohm', 'tau'],
  capacitance: ['tau'],
  inductance: ['tau'],
  power: ['db', 'ohm'],
  frequency: ['fp', 'tau'],
  time: ['fp'],
  energy: ['bat'],
  charge: ['bat'],
  pcb: [],
};

export function CalcPanel({ quantity }: { quantity: QuantityId }) {
  const list = CALCS_FOR[quantity];
  const [sel, setSel] = useState<CalcId | null>(null);
  const active = sel && list.includes(sel) ? sel : list[0];
  return (
    <section className="calcs glass" aria-labelledby="calcs-title">
      <header className="panel-head">
        <h2 id="calcs-title">Related calculations</h2>
        <span className="badge alt">Circuit calculation</span>
      </header>
      <p className="hint">
        These relate <em>different</em> physical quantities through a circuit law, so they need every parameter. Unit conversion above only re-expresses one quantity.
      </p>
      {list.length === 0 || !active ? (
        <p className="note">No circuit calculations apply to dimensions. Use the comparison diagram and table.</p>
      ) : (
        <>
          {list.length > 1 && <Seg name="calc" value={active} onChange={(v) => setSel(v as CalcId)} options={list.map((c) => [c, CALC_LABEL[c]] as const)} />}
          <h3 className="calc-title">{CALC_LABEL[active]}</h3>
          {active === 'ohm' && <OhmPanel />}
          {active === 'fp' && <FreqPeriodPanel />}
          {active === 'rms' && <RmsPanel />}
          {active === 'tau' && <TimeConstantPanel />}
          {active === 'db' && <DecibelPanel />}
          {active === 'bat' && <BatteryPanel />}
        </>
      )}
    </section>
  );
}
