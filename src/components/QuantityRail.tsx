import { useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { searchQuantities } from '../engine/search';
import { converterUnits } from '../engine/units';
import { useAppState, useDispatch } from '../state/store';

/** Quantity selection with working search ("uF", "dBm", "battery", or "100 uF" to carry a value). */
export function QuantityRail({ searchRef }: { searchRef: RefObject<HTMLInputElement | null> }) {
  const current = useAppState((s) => s.quantity);
  const dispatch = useDispatch();
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const hits = searchQuantities(query);

  const choose = (i: number) => {
    const h = hits[i];
    if (!h) return;
    if (h.carry) dispatch({ type: 'applyFix', fix: { kind: 'switch-quantity', quantity: h.quantity.id, text: h.carry.text, unit: h.carry.unit, label: '' } });
    else dispatch({ type: 'setQuantity', quantity: h.quantity.id });
    setQuery('');
  };

  const focusItem = (i: number) => {
    const items = listRef.current?.querySelectorAll<HTMLButtonElement>('button');
    if (!items || items.length === 0) return;
    items[Math.max(0, Math.min(items.length - 1, i))]?.focus();
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(0);
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      focusItem(i + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      if (i === 0) searchRef.current?.focus();
      else focusItem(i - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusItem(items.length - 1);
    }
  };

  return (
    <nav className="rail glass" aria-label="Quantities">
      <div className="rail-search">
        <label htmlFor="q-search" className="sr-only">
          Search quantities and units
        </label>
        <input
          id="q-search"
          ref={searchRef}
          className="field"
          type="search"
          placeholder="Search, e.g. uF or dBm"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
          aria-describedby="q-search-hint"
          aria-controls="q-list"
        />
        <p id="q-search-hint" className="sr-only">
          Press Enter to open the first match, or the down arrow to move into the list. Typing a value with a unit, such as 100 uF, carries it into the converter.
        </p>
      </div>
      <ul id="q-list" className="q-list" ref={listRef} onKeyDown={onListKey}>
        {hits.map((h, i) => (
          <li key={h.quantity.id}>
            <button
              type="button"
              className={`q-item ${h.quantity.id === current ? 'is-active' : ''}`}
              aria-current={h.quantity.id === current ? 'true' : undefined}
              onClick={() => choose(i)}
            >
              <span className="q-sym" aria-hidden="true">
                {h.quantity.symbol}
              </span>
              <span className="q-text">
                <span className="q-name">{h.quantity.name}</span>
                <span className="q-units">{h.reason || converterUnits(h.quantity.id).map((u) => u.symbol).join(' · ')}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {hits.length === 0 && (
        <p className="note" role="status">
          No quantity matches “{query}”. Try a unit symbol such as mV or nF.
        </p>
      )}
    </nav>
  );
}
