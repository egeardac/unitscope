import { useEffect, useRef } from 'react';

const SOURCES: Array<[string, string]> = [
  ['NIST SP 811, Chapter 4: SI units and prefixes', 'https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-4-two-classes-si-units-and-si-prefixes'],
  ['Analog Devices, Real Analog: Circuits 1, Chapter 1', 'https://download.analog.com/159850/RealAnalog/RealAnalog-Circuits1-Chapter1.pdf'],
  ['Tektronix: RMS measurement explanation', 'https://download.tek.com/manual/197_901_01A.pdf'],
  ['Texas Instruments: passive components and RC circuits', 'https://www.ti.com/content/dam/videos/external-videos/en-us/4/3816841626001/6119035031001.mp4/subassets/passive_components_and_circuits_2.pdf'],
  ['Keysight: decibels', 'https://helpfiles.keysight.com/csg/89600B/Webhelp/Subsystems/gettingstarted/content/concepts_decibels.htm'],
  ['W3C: WCAG 2.2', 'https://www.w3.org/TR/WCAG22/'],
];

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="help glass-solid" aria-labelledby="help-title" onClose={onClose}>
      <header className="panel-head">
        <h2 id="help-title">Unitscope guide</h2>
        <button type="button" className="btn" onClick={onClose} autoFocus>
          Close
        </button>
      </header>
      <div className="help-body">
        <section>
          <h3>Getting started</h3>
          <ol>
            <li>Pick a quantity on the left (or search: “uF”, “dBm”, “battery”, or “100 uF” to carry a value).</li>
            <li>Type a value. The result updates instantly; copy it with its unit.</li>
            <li>Explore the model on the right. Pin a reference, change the value and compare on the same scale.</li>
          </ol>
        </section>
        <section>
          <h3>Typing values</h3>
          <ul>
            <li>Decimal point or decimal comma: 4.7 or 4,7. Scientific notation: 4.7e3, 4.7 × 10^3.</li>
            <li>Group digits with spaces (1 000 000). Thousands separators are rejected: “1,000” is ambiguous, so you choose 1000 or 1.000.</li>
            <li>Negative values are accepted where they are physical (voltage, current, power, energy, charge).</li>
            <li>Units may follow the number: 100 uF, 4.7 kohm, 10 Mhz. Display always uses the correct symbol (µF, kΩ).</li>
            <li>Prefixes are case-sensitive: m = milli (10⁻³), M = mega (10⁶). “mhz” is not accepted; the app suggests MHz.</li>
            <li>Rounding to significant figures affects display only; calculations use full precision.</li>
          </ul>
        </section>
        <section>
          <h3>Conversion vs calculation</h3>
          <p>
            Converting 1 V to 1000 mV re-expresses one quantity: it never changes the physics, the graph or the circuit. Calculating a current from a voltage
            and a resistance is a <em>circuit calculation</em>: it needs every parameter and is marked as such.
          </p>
        </section>
        <section>
          <h3>Graphs</h3>
          <ul>
            <li>Every graph states its model, axes, units and scale. Hover, touch, or focus a graph and use the arrow keys to read exact values.</li>
            <li>Auto scale only expands; it never shrinks by itself, so 1 V and 10 V stay visibly different. “Fit to values” re-frames on request. Manual scale stays fixed; values outside are marked ▲/▼.</li>
            <li>Time windows stay locked while you change values; “Fit” re-frames them.</li>
            <li>Fast signals are never flashed at their real frequency. Playback is slowed down or time-lapsed and labelled. Pause and restart are always available, and animation is off when your system requests reduced motion.</li>
            <li>Moving dashes in circuit diagrams are symbolic: they show conventional current direction, not electron speed.</li>
          </ul>
        </section>
        <section>
          <h3>Models and assumptions</h3>
          <ul>
            <li>DC: ideal source and wires, linear resistor. I = V/R, P = V²/R.</li>
            <li>AC: pure sine with zero offset. Vpk = √2 × Vrms, Vpp = 2 × Vpk (sine only).</li>
            <li>RC: Vc(t) = Vs + (V0 − Vs)e^(−t/τ), τ = RC, low-pass fc = 1/(2πRC).</li>
            <li>RL: i(t) = (Vs/R)(1 − e^(−t/τ)), τ = L/R, zero initial current.</li>
            <li>dBm uses 1 mW, dBW uses 1 W. Voltage → dBm needs the load resistance; none is assumed. Ah ↔ Wh needs a nominal voltage and is an approximation.</li>
            <li>PCB diagrams are drawn to a stated diagram scale, not to physical size on your screen.</li>
          </ul>
        </section>
        <section>
          <h3>Keyboard</h3>
          <ul>
            <li>
              <kbd>/</kbd> focuses the quantity search; <kbd>Enter</kbd> opens the first match; arrow keys move through quantities.
            </li>
            <li>Every control is reachable with <kbd>Tab</kbd>. Sliders respond to arrow keys; each slider has a numeric field next to it.</li>
            <li>On a focused graph, <kbd>←</kbd>/<kbd>→</kbd> inspect values (<kbd>Shift</kbd> for larger steps), <kbd>Home</kbd>/<kbd>End</kbd> jump to the ends.</li>
          </ul>
        </section>
        <section>
          <h3>Privacy</h3>
          <p>No account and no server. Recent conversions, theme and display settings are stored only in this browser’s local storage. Share links contain the values in the URL.</p>
        </section>
        <section>
          <h3>Sources</h3>
          <ul>
            {SOURCES.map(([label, href]) => (
              <li key={href}>
                <a href={href} target="_blank" rel="noreferrer noopener">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </dialog>
  );
}
