import { useId, type ReactNode } from 'react';
import { copyText, formatNumber, SIG_FIGS_MAX, SIG_FIGS_MIN, type Notation } from '../engine/format';
import { converterUnits, inlineName } from '../engine/units';
import { copyToClipboard, useDebounced } from '../hooks';
import { useAppState, useDerived, useDispatch } from '../state/store';
import { useToast } from '../ui';
import { ErrorNote } from './Controls';

/** Unit conversion: value, From/To units, swap, instant result, copy, significant figures, notation. */
export function ConverterPanel({ onCopied, onboarding }: { onCopied: () => void; onboarding?: ReactNode }) {
  const q = useAppState((s) => s.quantity);
  const conv = useAppState((s) => s.conv[s.quantity]);
  const display = useAppState((s) => s.display);
  const d = useDerived();
  const dispatch = useDispatch();
  const toast = useToast();
  const id = useId();
  const units = converterUnits(q);
  const c = d.conversion;

  const result = c.ok ? formatNumber(c.value.result, display) : null;
  const inputEcho = c.ok ? formatNumber(c.value.input.value, { sigFigs: 15, notation: 'auto', trimZeros: true }) : null;
  const liveText = useDebounced(c.ok && result ? `${result.text} ${c.value.to.symbol}` : '', 600);
  const rounded = c.ok && result ? Number(result.plain) !== c.value.result : false;

  const copy = async () => {
    if (!c.ok) return;
    const text = copyText(c.value.result, c.value.to.symbol, display);
    const okCopy = await copyToClipboard(text);
    toast(okCopy ? `Copied “${text}”` : 'Copy failed: your browser blocked clipboard access.');
    if (okCopy) onCopied();
  };

  return (
    <section className="converter glass" aria-labelledby={`${id}-title`}>
      {onboarding}
      <header className="panel-head">
        <h2 id={`${id}-title`}>Convert {inlineName(q)}</h2>
        <span className="badge">Unit conversion</span>
      </header>

      <div className="conv-grid">
        <div className="conv-value">
          <label htmlFor={`${id}-value`}>Value</label>
          <input
            id={`${id}-value`}
            className="field big num"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. 4.7 or 100 uF"
            value={conv.text}
            aria-invalid={!c.ok && c.error.code !== 'EMPTY'}
            aria-describedby={`${id}-echo`}
            onChange={(e) => dispatch({ type: 'setText', text: e.target.value })}
            data-testid="value-input"
          />
        </div>
        <div className="conv-units">
          <label className="unit-field">
            <span>From</span>
            <select className="field" value={conv.from} onChange={(e) => dispatch({ type: 'setFrom', unit: e.target.value })} data-testid="from-unit">
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.symbol} · {u.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn icon swap" onClick={() => dispatch({ type: 'swap' })} aria-label="Swap units (keeps the same physical value)" title="Swap units" data-testid="swap">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M7 4v13m0 0-3.5-3.5M7 17l3.5-3.5M17 20V7m0 0-3.5 3.5M17 7l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <label className="unit-field">
            <span>To</span>
            <select className="field" value={conv.to} onChange={(e) => dispatch({ type: 'setTo', unit: e.target.value })} data-testid="to-unit">
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.symbol} · {u.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="echo" id={`${id}-echo`}>
        {c.ok && inputEcho
          ? `Interpreted as ${inputEcho.text} ${c.value.from.symbol}${c.value.input.unitFromText ? ` (unit typed as “${c.value.input.unitText}”)` : ''}.`
          : 'Decimal point or comma, e.g. 4.7 or 4,7 · scientific 4.7e3 · unit suffix such as 100 uF.'}
      </p>

      <div className="result" data-testid="result">
        {c.ok && result ? (
          <>
            <output className="result-value num" htmlFor={`${id}-value`} data-testid="result-value">
              {result.text}
            </output>
            <span className="result-unit">{c.value.to.symbol}</span>
          </>
        ) : (
          <ErrorNote error={c.ok ? { code: 'EMPTY', message: '' } : c.error} onFix={(f) => dispatch({ type: 'applyFix', fix: f })} />
        )}
      </div>
      <div className="sr-only" aria-live="polite">
        {liveText}
      </div>
      {c.ok && result && (
        <p className="equation num">
          {inputEcho?.text} {c.value.from.symbol} = {result.text} {c.value.to.symbol}
          {rounded ? ` · rounded for display to ${display.sigFigs} significant figures` : ''}
        </p>
      )}

      <div className="conv-actions">
        <button type="button" className="btn primary" onClick={copy} disabled={!c.ok} data-testid="copy">
          Copy result
        </button>
        <div className="sf">
          <span id={`${id}-sf`}>Significant figures</span>
          <button type="button" className="btn icon" aria-label="Fewer significant figures" onClick={() => dispatch({ type: 'setDisplay', patch: { sigFigs: display.sigFigs - 1 } })} disabled={display.sigFigs <= SIG_FIGS_MIN}>
            −
          </button>
          <input
            className="field num sf-input"
            type="number"
            min={SIG_FIGS_MIN}
            max={SIG_FIGS_MAX}
            aria-labelledby={`${id}-sf`}
            value={display.sigFigs}
            onChange={(e) => e.target.value !== '' && dispatch({ type: 'setDisplay', patch: { sigFigs: Number(e.target.value) } })}
          />
          <button type="button" className="btn icon" aria-label="More significant figures" onClick={() => dispatch({ type: 'setDisplay', patch: { sigFigs: display.sigFigs + 1 } })} disabled={display.sigFigs >= SIG_FIGS_MAX}>
            +
          </button>
        </div>
        <label className="inline">
          <span>Notation</span>
          <select className="field" value={display.notation} onChange={(e) => dispatch({ type: 'setDisplay', patch: { notation: e.target.value as Notation } })}>
            <option value="auto">Automatic</option>
            <option value="engineering">Engineering (10³ⁿ)</option>
            <option value="scientific">Scientific</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={display.trimZeros} onChange={(e) => dispatch({ type: 'setDisplay', patch: { trimZeros: e.target.checked } })} />
          Hide trailing zeros
        </label>
      </div>
    </section>
  );
}
