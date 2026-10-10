import { useEffect, useId, useState } from 'react';
import { formatNumber, formatSI } from '../engine/format';
import { parseSIValue } from '../engine/parse';
import { MAIN_SLIDER, PARAMS, SLIDER_STEPS, sliderToValue, valueToSlider, type ParamKey, type SliderSpec } from '../engine/params';
import type { CalcError, Fix } from '../engine/result';
import { stepSpan } from '../engine/scale';
import { converterUnits, getQuantity, getUnit, type QuantityId } from '../engine/units';
import { useAppState, useDerived, useDispatch } from '../state/store';

export function ErrorNote({ error, onFix, id }: { error: CalcError; onFix?: (f: Fix) => void; id?: string }) {
  const neutral = error.code === 'EMPTY' || error.code === 'MISSING_PARAMETER';
  return (
    <div className={neutral ? 'note' : 'error'} id={id}>
      <p>{error.message}</p>
      {error.fixes && onFix && (
        <div className="fixes">
          {error.fixes.map((f) => (
            <button key={f.label} type="button" className="chip" onClick={() => onFix(f)}>
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function sliderHint(spec: SliderSpec, unit: string, outside: 'below' | 'above' | null): string {
  const range = `Slider: ${formatSI(spec.min, unit, 3).text} … ${formatSI(spec.max, unit, 3).text}${spec.kind === 'log' ? ' (logarithmic)' : ''}. Type any value in the field.`;
  if (!outside) return range;
  return `${range} The typed value is ${outside} the slider range; calculations use the typed value, not the slider position.`;
}

/** Numeric field + unit selector + slider for one model parameter. All three share the store. */
export function ParamControl({ k, note }: { k: ParamKey; note?: string }) {
  const def = PARAMS[k];
  const p = useAppState((s) => s.params[k]);
  const r = useDerived().params[k];
  const dispatch = useDispatch();
  const id = useId();
  const si = getQuantity(def.quantity).siSymbol;
  const pos = valueToSlider(def.slider, r.ok ? r.value : Number.NaN);
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  return (
    <div className="param">
      <label className="param-label" htmlFor={`${id}-v`}>
        {def.label} <var>{def.symbol}</var>
      </label>
      <div className="param-row">
        <input
          id={`${id}-v`}
          className="field num"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={p.text}
          aria-invalid={!r.ok}
          aria-describedby={`${hintId}${r.ok ? '' : ` ${errId}`}`}
          onChange={(e) => dispatch({ type: 'setParamText', key: k, text: e.target.value })}
        />
        <select
          className="field unit-select"
          aria-label={`${def.label} unit`}
          value={p.unit}
          onChange={(e) => dispatch({ type: 'setParamUnit', key: k, unit: e.target.value })}
        >
          {def.unitIds.map((uid) => (
            <option key={uid} value={uid}>
              {getUnit(uid)?.symbol ?? uid}
            </option>
          ))}
        </select>
      </div>
      <input
        className="slider"
        type="range"
        min={0}
        max={SLIDER_STEPS}
        step={1}
        value={Math.round(pos.pos)}
        aria-label={`${def.label} slider`}
        aria-valuetext={r.ok ? formatSI(r.value, si, 4).text : 'invalid value'}
        onChange={(e) => dispatch({ type: 'setParamSI', key: k, value: sliderToValue(def.slider, Number(e.target.value)) })}
      />
      <p className="hint" id={hintId}>
        {note ? `${note} ` : ''}
        {sliderHint(def.slider, si, pos.outside)}
      </p>
      {!r.ok && <ErrorNote error={r.error} id={errId} />}
    </div>
  );
}

/** Slider for the main converter value, writing into the same converter field. */
export function MainValueControl({ label, spec }: { label: string; spec?: SliderSpec }) {
  const q = useAppState((s) => s.quantity);
  const conv = useAppState((s) => s.conv[s.quantity]);
  const d = useDerived();
  const dispatch = useDispatch();
  const id = useId();
  const sp = spec ?? MAIN_SLIDER[q];
  const si = getQuantity(q).siSymbol;
  const value = d.si.ok ? d.si.value : Number.NaN;
  const pos = valueToSlider(sp, value);
  return (
    <div className="param">
      <label className="param-label" htmlFor={`${id}-v`}>
        {label}
      </label>
      <div className="param-row">
        <input
          id={`${id}-v`}
          className="field num"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={conv.text}
          aria-invalid={!d.si.ok}
          aria-describedby={`${id}-hint`}
          onChange={(e) => dispatch({ type: 'setText', text: e.target.value })}
        />
        <select className="field unit-select" aria-label={`${label} unit`} value={conv.from} onChange={(e) => dispatch({ type: 'setFrom', unit: e.target.value })}>
          {converterUnits(q).map((u) => (
            <option key={u.id} value={u.id}>
              {u.symbol}
            </option>
          ))}
        </select>
      </div>
      <input
        className="slider"
        type="range"
        min={0}
        max={SLIDER_STEPS}
        step={1}
        value={Math.round(pos.pos)}
        aria-label={`${label} slider`}
        aria-valuetext={d.si.ok ? formatSI(value, si, 4).text : 'no valid value'}
        onChange={(e) => dispatch({ type: 'setMainSI', value: sliderToValue(sp, Number(e.target.value)) })}
      />
      <p className="hint" id={`${id}-hint`}>
        Same value as the converter field. {sliderHint(sp, si, pos.outside)}
      </p>
    </div>
  );
}

const AXIS_QUANTITY: Record<string, QuantityId> = {
  'dc.V': 'voltage', 'dc.I': 'current', 'dc.P': 'power',
  'cur.I': 'current', 'cur.V': 'voltage', 'cur.P': 'power',
  'res.V': 'voltage', 'res.I': 'current',
  'ac.V': 'voltage', 'rc.V': 'voltage', 'rl.I': 'current',
  'pow.E': 'energy', 'en.E': 'energy', 'ch.Q': 'charge', 'pcb.d': 'pcb',
};

export function axisQuantity(axis: string): QuantityId {
  return AXIS_QUANTITY[axis] ?? 'voltage';
}

/**
 * Scale controls: automatic (expand-only) or manual full scale, plus an
 * explicit "Fit" action. Manual values are never altered by the app.
 */
export function ScaleControls({ axes }: { axes: Array<{ axis: string; label: string }> }) {
  const [sel, setSel] = useState(axes[0]?.axis ?? '');
  const axis = axes.find((a) => a.axis === sel) ? sel : (axes[0]?.axis ?? '');
  const scale = useAppState((s) => s.scales[axis]);
  const bipolar = useDerived().axes[axis]?.bipolar ?? false;
  const dispatch = useDispatch();
  const id = useId();
  const q = axisQuantity(axis);
  const unit = getQuantity(q).siSymbol;
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (scale) setText(formatSI(scale.span, unit, 6).text);
    setErr(null);
  }, [scale, unit]);
  if (!scale) return null;

  const commit = () => {
    const v = parseSIValue(text, q);
    if (!v.ok) return setErr(v.error.message);
    if (v.value <= 0) return setErr('Enter a full-scale value greater than zero.');
    setErr(null);
    if (Math.abs(v.value - scale.span) <= scale.span * 1e-12) return;
    dispatch({ type: 'setScale', axis, scale: { mode: 'manual', span: v.value } });
  };

  const range = `${bipolar ? `${formatSI(-scale.span, unit, 4).text} … ` : '0 … '}${formatSI(scale.span, unit, 4).text}`;
  return (
    <fieldset className="scale-controls">
      <legend>Scale</legend>
      {axes.length > 1 && (
        <label className="inline">
          <span>Axis</span>
          <select className="field" value={axis} onChange={(e) => setSel(e.target.value)}>
            {axes.map((a) => (
              <option key={a.axis} value={a.axis}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="seg" role="radiogroup" aria-label="Scale mode">
        <label className={scale.mode === 'auto' ? 'is-on' : ''}>
          <input
            type="radio"
            name={`${id}-mode`}
            checked={scale.mode === 'auto'}
            onChange={() => dispatch({ type: 'setScale', axis, scale: { mode: 'auto', span: scale.span } })}
          />
          Auto (expand only)
        </label>
        <label className={scale.mode === 'manual' ? 'is-on' : ''}>
          <input
            type="radio"
            name={`${id}-mode`}
            checked={scale.mode === 'manual'}
            onChange={() => dispatch({ type: 'setScale', axis, scale: { mode: 'manual', span: scale.span } })}
          />
          Manual
        </label>
      </div>
      <div className="scale-row">
        <button
          type="button"
          className="btn icon"
          aria-label="Smaller full scale"
          onClick={() => dispatch({ type: 'setScale', axis, scale: { mode: 'manual', span: stepSpan(scale.span, -1) } })}
        >
          −
        </button>
        <input
          className="field num"
          aria-label="Full-scale value"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <button
          type="button"
          className="btn icon"
          aria-label="Larger full scale"
          onClick={() => dispatch({ type: 'setScale', axis, scale: { mode: 'manual', span: stepSpan(scale.span, 1) } })}
        >
          +
        </button>
        <button type="button" className="btn" onClick={() => dispatch({ type: 'fitScales' })}>
          Fit to values
        </button>
      </div>
      {err && <p className="error small">{err}</p>}
      <p className="hint">
        Visible range {range}.{' '}
        {scale.mode === 'auto'
          ? 'Auto expands when a value no longer fits and never shrinks by itself, so changes stay visible.'
          : 'Manual: the range stays fixed; values outside it are clipped and marked ▲/▼.'}
      </p>
    </fieldset>
  );
}

/** Locked time window with an explicit fit action. */
export function WindowControls({ wkey, fitLabel }: { wkey: string; fitLabel: string }) {
  const win = useAppState((s) => s.windows[wkey]);
  const dispatch = useDispatch();
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (win !== undefined) setText(formatSI(win, 's', 6).text);
    setErr(null);
  }, [win]);
  if (win === undefined) return null;
  const commit = () => {
    const v = parseSIValue(text, 'time');
    if (!v.ok) return setErr(v.error.message);
    if (v.value <= 0) return setErr('Enter a window longer than zero.');
    setErr(null);
    if (Math.abs(v.value - win) <= win * 1e-12) return;
    dispatch({ type: 'setWindow', key: wkey, value: v.value });
  };
  return (
    <fieldset className="scale-controls">
      <legend>Time window</legend>
      <div className="scale-row">
        <input
          className="field num"
          aria-label="Time window length"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <button type="button" className="btn" onClick={() => dispatch({ type: 'fitWindow', key: wkey })}>
          {fitLabel}
        </button>
      </div>
      {err && <p className="error small">{err}</p>}
      <p className="hint">The window stays locked while you change values, so a faster or slower signal looks different. Use “{fitLabel}” to re-frame.</p>
    </fieldset>
  );
}

/** Seconds of real time one full sweep of the window takes. */
export const SWEEP_SECONDS = 4;

export function playbackRateText(windowSeconds: number): string {
  const perSecond = windowSeconds / SWEEP_SECONDS;
  const factor = SWEEP_SECONDS / windowSeconds;
  const fmt = (v: number) => formatNumber(v, { sigFigs: 3, notation: 'auto', trimZeros: true }).text;
  if (factor > 1.05) return `Slow motion: shown ${fmt(factor)}× slower than real time (1 s on screen = ${formatSI(perSecond, 's', 3).text} of signal time).`;
  if (factor < 0.95) return `Time-lapse: shown ${fmt(1 / factor)}× faster than real time (1 s on screen = ${formatSI(perSecond, 's', 3).text}).`;
  return 'Real time (1 s on screen = 1 s).';
}

export function PlaybackControls({
  playing,
  onToggle,
  onRestart,
  reduced,
  rateText,
}: {
  playing: boolean;
  onToggle: () => void;
  onRestart: () => void;
  reduced: boolean;
  rateText: string | null;
}) {
  return (
    <div className="playback">
      <button type="button" className="btn" onClick={onToggle} disabled={reduced} aria-pressed={playing}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <button type="button" className="btn" onClick={onRestart} disabled={reduced}>
        Restart
      </button>
      <p className="hint">
        {reduced
          ? 'Animation is off because your system asks for reduced motion. Inspect values by hovering, touching or using the arrow keys on the graph.'
          : rateText ?? 'Symbolic animation only.'}
      </p>
    </div>
  );
}
