import type { ReactNode } from 'react';

/**
 * Schematic diagrams of the ideal models. Labels carry the calculated values;
 * the conventional-current arrow follows the sign of the current. Moving
 * dashes are a SYMBOLIC direction cue only: their speed does not represent
 * electron drift velocity, and they stop under reduced motion or when paused.
 */
interface CommonProps {
  /** +1 clockwise, −1 counter-clockwise, 0 no current. */
  direction: 1 | -1 | 0;
  animate: boolean;
  title: string;
}

const LOOP = 'M60,40 L300,40 L300,160 L60,160 Z';

function Arrow({ x, y, dir }: { x: number; y: number; dir: 1 | -1 }) {
  const p = dir === 1 ? `${x - 7},${y - 6} ${x + 7},${y} ${x - 7},${y + 6}` : `${x + 7},${y - 6} ${x - 7},${y} ${x + 7},${y + 6}`;
  return <polygon className="cd-arrow" points={p} />;
}

function Flow({ direction, animate }: { direction: 1 | -1 | 0; animate: boolean }) {
  if (direction === 0) return null;
  return <path className={`cd-flow ${animate ? 'is-animated' : ''} ${direction === -1 ? 'is-reverse' : ''}`} d={LOOP} data-testid="current-flow" />;
}

function Source({ positiveTop, label }: { positiveTop: boolean; label: ReactNode }) {
  return (
    <g className="cd-source">
      <circle cx={60} cy={100} r={22} />
      <text className="cd-pol" x={60} y={92} textAnchor="middle">
        {positiveTop ? '+' : '−'}
      </text>
      <text className="cd-pol" x={60} y={118} textAnchor="middle">
        {positiveTop ? '−' : '+'}
      </text>
      <text className="cd-label" x={90} y={96}>
        {label}
      </text>
    </g>
  );
}

export function DcCircuit({
  direction,
  animate,
  title,
  vLabel,
  rLabel,
  iLabel,
  pLabel,
  positiveTop,
}: CommonProps & { vLabel: ReactNode; rLabel: ReactNode; iLabel: ReactNode; pLabel: ReactNode; positiveTop: boolean }) {
  return (
    <svg className="circuit" viewBox="0 0 460 200" role="img" aria-label={title} data-testid="circuit">
      <path className="cd-wire" d="M60,78 L60,40 L300,40 L300,70 M300,130 L300,160 L60,160 L60,122" />
      <Flow direction={direction} animate={animate} />
      <Source positiveTop={positiveTop} label={vLabel} />
      <polyline className="cd-part" points="300,70 290,76 310,84 290,92 310,100 290,108 310,116 290,124 300,130" />
      <text className="cd-label" x={322} y={94}>
        {rLabel}
      </text>
      <text className="cd-label cd-small" x={322} y={116}>
        {pLabel}
      </text>
      {direction !== 0 && <Arrow x={180} y={40} dir={direction} />}
      <text className="cd-label" x={180} y={28} textAnchor="middle">
        {iLabel}
      </text>
    </svg>
  );
}

export function RcCircuit({
  direction,
  animate,
  title,
  vsLabel,
  rLabel,
  cLabel,
  vcLabel,
  positiveTop,
}: CommonProps & { vsLabel: ReactNode; rLabel: ReactNode; cLabel: ReactNode; vcLabel: ReactNode; positiveTop: boolean }) {
  return (
    <svg className="circuit" viewBox="0 0 460 200" role="img" aria-label={title} data-testid="circuit">
      <path className="cd-wire" d="M60,78 L60,40 L96,40 M128,40 L170,40 M240,40 L300,40 L300,92 M300,108 L300,160 L60,160 L60,122" />
      <Flow direction={direction} animate={animate} />
      <Source positiveTop={positiveTop} label={vsLabel} />
      <g className="cd-switch">
        <circle cx={98} cy={40} r={3} />
        <circle cx={126} cy={40} r={3} />
        <line x1={98} y1={40} x2={126} y2={40} />
        <text className="cd-label cd-small" x={60} y={22}>
          S closes at t = 0
        </text>
      </g>
      <polyline className="cd-part" points="170,40 176,30 184,50 192,30 200,50 208,30 216,50 224,30 232,50 240,40" />
      <text className="cd-label" x={205} y={68} textAnchor="middle">
        {rLabel}
      </text>
      <line className="cd-part" x1={282} y1={92} x2={318} y2={92} />
      <line className="cd-part" x1={282} y1={108} x2={318} y2={108} />
      <text className="cd-label" x={328} y={104}>
        {cLabel}
      </text>
      <text className="cd-label cd-small" x={180} y={188} textAnchor="middle">
        {vcLabel}
      </text>
    </svg>
  );
}

export function RlCircuit({
  direction,
  animate,
  title,
  vsLabel,
  rLabel,
  lLabel,
  iLabel,
  positiveTop,
}: CommonProps & { vsLabel: ReactNode; rLabel: ReactNode; lLabel: ReactNode; iLabel: ReactNode; positiveTop: boolean }) {
  return (
    <svg className="circuit" viewBox="0 0 460 200" role="img" aria-label={title} data-testid="circuit">
      <path className="cd-wire" d="M60,78 L60,40 L96,40 M128,40 L170,40 M240,40 L300,40 L300,68 M300,132 L300,160 L60,160 L60,122" />
      <Flow direction={direction} animate={animate} />
      <Source positiveTop={positiveTop} label={vsLabel} />
      <g className="cd-switch">
        <circle cx={98} cy={40} r={3} />
        <circle cx={126} cy={40} r={3} />
        <line x1={98} y1={40} x2={126} y2={40} />
        <text className="cd-label cd-small" x={60} y={22}>
          S closes at t = 0
        </text>
      </g>
      <polyline className="cd-part" points="170,40 176,30 184,50 192,30 200,50 208,30 216,50 224,30 232,50 240,40" />
      <text className="cd-label" x={205} y={68} textAnchor="middle">
        {rLabel}
      </text>
      <path className="cd-part" d="M300,68 a8,8 0 0 1 0,16 a8,8 0 0 1 0,16 a8,8 0 0 1 0,16 a8,8 0 0 1 0,16" />
      <text className="cd-label" x={322} y={104}>
        {lLabel}
      </text>
      <text className="cd-label cd-small" x={180} y={188} textAnchor="middle">
        {iLabel}
      </text>
    </svg>
  );
}
