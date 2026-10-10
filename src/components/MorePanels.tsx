import { toSI } from '../engine/convert';
import { exactText, formatNumber, formatRatio } from '../engine/format';
import { PRESETS } from '../engine/presets';
import { converterUnits, getQuantity, getUnit, inlineName } from '../engine/units';
import { convert } from '../engine/convert';
import type { HistoryEntry } from '../state/persistence';
import { useAppState, useDerived, useDispatch } from '../state/store';

/** The same physical value in every unit. Choosing a row re-expresses the input without changing the physics. */
export function AllUnitsTable() {
  const q = useAppState((s) => s.quantity);
  const display = useAppState((s) => s.display);
  const d = useDerived();
  const dispatch = useDispatch();
  const c = d.conversion;
  return (
    <section className="panel glass" aria-labelledby="allunits-title">
      <header className="panel-head">
        <h2 id="allunits-title">Same value, every unit</h2>
      </header>
      {!c.ok ? (
        <p className="note">Enter a valid value to list it in every unit.</p>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Unit</th>
                <th scope="col">Value</th>
                <th scope="col">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {converterUnits(q).map((u) => {
                const v = convert(c.value.input.value, c.value.from, u);
                return (
                  <tr key={u.id} className={u.id === c.value.from.id ? 'is-current' : ''}>
                    <th scope="row">
                      {u.symbol} <span className="hint">{u.name}</span>
                    </th>
                    <td className="num">{v.ok ? formatNumber(v.value, display).text : v.error.message}</td>
                    <td>
                      {v.ok && u.id !== c.value.from.id && (
                        <button type="button" className="btn ghost small" onClick={() => dispatch({ type: 'useRepresentation', text: exactText(v.value), unit: u.id })} aria-label={`Type the value as ${u.symbol}`}>
                          Use
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="hint">“Use” re-expresses the input in that unit. The physical value, the graph and the circuit stay exactly the same.</p>
        </>
      )}
    </section>
  );
}

export function PresetsPanel() {
  const q = useAppState((s) => s.quantity);
  const dispatch = useDispatch();
  return (
    <section className="panel glass" aria-labelledby="presets-title">
      <header className="panel-head">
        <h2 id="presets-title">Presets</h2>
      </header>
      <ul className="preset-list">
        {PRESETS[q].map((p) => (
          <li key={p.label}>
            <button type="button" className="preset" onClick={() => dispatch({ type: 'applyPreset', preset: p })}>
              <span className="preset-value num">{p.label}</span>
              <span className="preset-note">{p.note}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** How the current value compares with common reference values of the same quantity. */
export function ReferenceComparisons() {
  const q = useAppState((s) => s.quantity);
  const mode = useAppState((s) => s.voltageMode);
  const d = useDerived();
  if (!d.si.ok) return null;
  const si = d.si.value;
  const refs = PRESETS[q].filter((p) => (q === 'voltage' ? !!p.ac === (mode === 'ac') : true));
  return (
    <section className="panel glass" aria-labelledby="compare-title">
      <header className="panel-head">
        <h2 id="compare-title">Reference comparisons</h2>
      </header>
      <ul className="compare-list">
        {refs.map((p) => {
          const u = getUnit(p.unit)!;
          const r = toSI(Number(p.text), u);
          if (!r.ok || r.value === 0) return null;
          const k = si / r.value;
          return (
            <li key={p.label}>
              <span className="num compare-ratio">{formatRatio(k)}</span>
              <span>
                {p.label} <span className="hint">({p.note})</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="hint">Ratio of your {inlineName(q)} to each reference value.</p>
    </section>
  );
}

export function RecentList({ history, onClear, className }: { history: HistoryEntry[]; onClear: () => void; className?: string }) {
  const dispatch = useDispatch();
  return (
    <section className={`panel glass recent ${className ?? ''}`} aria-label="Recent conversions">
      <header className="panel-head">
        <h2>Recent</h2>
        {history.length > 0 && (
          <button type="button" className="btn ghost small" onClick={onClear}>
            Clear
          </button>
        )}
      </header>
      {history.length === 0 ? (
        <p className="hint">Your conversions appear here. They are stored only in this browser.</p>
      ) : (
        <ul className="recent-list">
          {history.map((h) => (
            <li key={`${h.at}-${h.summary}`}>
              <button
                type="button"
                className="recent-item"
                onClick={() => dispatch({ type: 'restore', quantity: h.q, conv: { text: h.text, from: h.from, to: h.to }, ...(h.mode ? { voltageMode: h.mode } : {}) })}
              >
                <span className="num">{h.summary}</span>
                <span className="hint">
                  {getQuantity(h.q).name}
                  {h.mode === 'ac' ? ' (AC)' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
