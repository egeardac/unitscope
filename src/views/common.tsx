import { useState, type ReactNode } from 'react';
import { formatNumber, formatRatio, formatSI } from '../engine/format';
import type { CalcError } from '../engine/result';
import { useClock, usePlaybackClock, useReducedMotion, type Clock } from '../hooks';
import { ErrorNote } from '../components/Controls';

export const fmt = (v: number, unit: string, sf = 4): string => formatSI(v, unit, sf).text;

/** Human time axis: hours or minutes for long windows, SI-prefixed seconds otherwise. */
export function timeAxis(window: number): { factor: number; unit: string; noPrefix: boolean } {
  if (window >= 2 * 3600) return { factor: 3600, unit: 'h', noPrefix: true };
  if (window >= 120) return { factor: 60, unit: 'min', noPrefix: true };
  return { factor: 1, unit: 's', noPrefix: false };
}

/** Duration text with minutes/hours where natural, e.g. "6 min", "4 h", "100 ms". */
export function fmtDuration(t: number): string {
  const n = (v: number) => formatNumber(v, { sigFigs: 4, notation: 'auto', trimZeros: true }).text;
  if (Math.abs(t) >= 3600) return `${n(t / 3600)} h`;
  if (Math.abs(t) >= 60) return `${n(t / 60)} min`;
  return formatSI(t, 's', 4).text;
}

export function ratio(now: number, ref: number): string {
  if (ref === 0) return now === 0 ? '×1' : 'n/a (reference is zero)';
  return formatRatio(now / ref);
}

/** Playback state for a view. Under reduced motion nothing plays. */
export function usePlayback() {
  const reduced = useReducedMotion();
  const [wantPlay, setWantPlay] = useState(true);
  const playing = wantPlay && !reduced;
  const { clock, restart } = usePlaybackClock(playing);
  return {
    reduced,
    playing,
    clock,
    toggle: () => setWantPlay((p) => !p),
    restart,
  };
}

/** Text that follows the playback clock (re-renders alone, not the whole view). */
export function ClockText({ clock, render }: { clock: Clock; render: (seconds: number) => ReactNode }) {
  const s = useClock(clock);
  return <>{render(s)}</>;
}

/** Position of the playhead within a window for a given playback time. */
export function sweepPosition(seconds: number, window: number, sweepSeconds: number): number {
  return ((seconds % sweepSeconds) / sweepSeconds) * window;
}

/** Model error in the stage. One-click fixes are offered once, next to the converter field, not repeated here. */
export function ModelError({ error }: { error: CalcError }) {
  return (
    <div className="model-error">
      <ErrorNote error={{ code: error.code, message: error.message }} />
    </div>
  );
}

/** Graph figure with model caption and a visible numerical explanation that doubles as the text summary. */
export function Figure({
  model,
  children,
  summary,
  id,
}: {
  model: string;
  children: ReactNode;
  summary: string[];
  id: string;
}) {
  return (
    <figure className="figure" aria-labelledby={`${id}-cap`}>
      <p className="model-caption">
        <span className="badge">Model</span> {model}
      </p>
      {children}
      <figcaption id={`${id}-cap`} className="numbers">
        <span className="numbers-title">In numbers</span>
        <ul>
          {summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

export function Assumptions({ items }: { items: string[] }) {
  return (
    <p className="assumptions">
      <span className="badge subtle">Assumptions</span> {items.join(' · ')}
    </p>
  );
}

export function Readouts({ items }: { items: Array<{ label: ReactNode; value: string; note?: string }> }) {
  return (
    <dl className="readouts">
      {items.map((it, i) => (
        <div key={i} className="readout">
          <dt>{it.label}</dt>
          <dd className="num">{it.value}</dd>
          {it.note && <dd className="readout-note">{it.note}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function RefBar({ pinned, refText, canPin, onPin, onClear }: { pinned: boolean; refText: string | null; canPin: boolean; onPin: () => void; onClear: () => void }) {
  return (
    <div className="refbar">
      <button type="button" className="btn" onClick={onPin} disabled={!canPin}>
        {pinned ? 'Re-pin current as reference' : 'Pin current as reference'}
      </button>
      {pinned && (
        <button type="button" className="btn ghost" onClick={onClear}>
          Clear reference
        </button>
      )}
      <span className="hint">{pinned && refText ? `Reference: ${refText}` : 'Pin a value, then change it to compare on the same scale.'}</span>
    </div>
  );
}
