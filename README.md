# Unitscope

**Convert an electrical unit, then see what that value does in a clearly defined circuit or signal model.**

Live: **https://egeardac.github.io/unitscope/**

Unitscope is a browser workspace for electronics students, circuit designers and bench engineers. It converts units exactly. It also draws the converted quantity inside an ideal model: a DC source and resistor, an AC sine on a scope, RC and RL step responses, energy and charge accumulation, and a PCB dimension ruler. All of this runs on one shared calculation state. 1 V, 1000 mV and 1 000 000 µV produce the identical drawing, while 10 V visibly differs from 1 V.

No account and no server. Everything runs in the browser; history and preferences stay in local storage.

---

## Features

### Unit conversion

Every conversion factor is exact, verified against NIST SP 811.

| Quantity | Units |
|---|---|
| Voltage | µV, mV, V, kV |
| Current | nA, µA, mA, A |
| Resistance | mΩ, Ω, kΩ, MΩ |
| Capacitance | pF, nF, µF, mF, F |
| Inductance | nH, µH, mH, H |
| Power | µW, mW, W, kW |
| Frequency | Hz, kHz, MHz, GHz |
| Time | ns, µs, ms, s |
| Energy | mJ, J, Wh, kWh |
| Electric charge | mC, C, mAh, Ah |
| PCB dimensions | µm, mil, mm, in |

- **Converter controls:** source and target units, swap (keeps the physical value bit for bit), instant result, copy with unit, 1–15 significant figures, and automatic, scientific or engineering notation.
- **Input formats:** decimal point or decimal comma, `e` notation, `× 10^n`, the typographic minus, digit groups separated by spaces, and typed unit suffixes (`100 uF`, `4.7 kohm`).
- **Unit symbols:** prefixes are case-sensitive, so `m` (milli) and `M` (mega) are different. Display always uses the correct symbol (µF, kΩ).
- **Rejected inputs:** ambiguous `1,000`, mixed separators, `NaN` and `Infinity`, overflow, and units of the wrong quantity (with a one-click fix such as "Switch to Current").
- **No fabricated results:** empty input produces none.

### Visualizations

Each visualization comes from the engine's exact model functions.

- **Voltage DC:**
  - Schematic with ± polarity and a conventional-current arrow, plus V / I / P bars against a pinned reference on shared axes.
  - Negative voltage flips polarity and current direction.
  - Moving dashes are labelled *symbolic*: their speed is not electron drift speed.
- **Voltage AC:** a scope trace of a zero-offset sine with Vpk, Vrms and Vpp. The amplitude can be read as RMS, peak or peak-to-peak.
- **Current:** the same circuit; R is a parameter.
- **Resistance:** I–V line with an operating point and a reference slope.
- **Capacitance:**
  - RC step response with initial voltage V0 and final voltage Vs, and marks at τ…5τ.
  - Readouts: τ = RC, fc = 1/(2πRC), and the current.
- **Inductance:** RL current build-up with τ = L/R. With R = 0 the plot shows a labelled linear ramp.
- **Frequency and time:** waveform in a locked window, T = 1/f, ω = 2πf.
- **Power, energy and charge:** accumulation E = P·t or Q = I·t, with target lines and time-to-target (s / min / h axes, J/Wh and C/mAh units).
- **PCB:** dual mm / mil ruler compared with common board features. It is explicitly *not* physical screen size.

### Graph rules

- Every graph shows its model, axes, units with SI prefixes, and ticks.
- Values can be inspected by mouse hover, touch, or arrow keys on a focused graph.
- **Auto scale only expands; it never shrinks by itself**, so 1 V → 10 V stays visibly different. "Fit to values" re-frames on request.
- Manual scale stays fixed; values outside the range are clipped and marked ▲/▼.
- Time windows stay locked and have "Fit 3 cycles" / "Fit 5τ" buttons.
- Too many cycles in the window → a labelled envelope instead of an aliased trace.
- Playback is labelled as slow motion or time-lapse, with Pause and Restart controls. The screen never flashes at the signal frequency.
- Every graph has a written "In numbers" explanation that doubles as its text summary.

### Related circuit calculations

Each is labelled *Circuit calculation*, kept separate from unit conversion, and requires all of its inputs.

- Ohm's law and resistor power (choose which pair is known).
- Frequency ↔ period.
- RMS / peak / peak-to-peak, for sine waves only.
- RC and RL time constants, and cutoff frequency.
- W ↔ dBm ↔ dBW (1 mW and 1 W references), power ratio 10·log10(P2/P1), and voltage ratio 20·log10(V2/V1) with the equal-resistance caveat.
- Vrms + load R → dBm. The load is required; 50 Ω is never assumed.
- Ah ↔ Wh. Nominal voltage is required, and the result is labelled an approximation.

### Workspace

- Category search by name, unit, alias or keyword (`uF`, `dBm`, `battery`, `trace`). Typing `100 uF` and pressing Enter carries the value over.
- Meaningful presets and reference comparisons.
- Recent conversions, stored locally.
- Shareable links: the address bar always restores quantity, units, value, display settings, model parameters, pinned reference and scales.
- Light and dark glass themes, plus a "Solid panels" option for slower devices.
- A built-in guide and first-visit onboarding.

---

## Getting started

Requirements: Node.js 22.12 or newer (developed on Node 24; Vitest needs 22.12+) and npm.

```bash
npm ci
```

```bash
npm run dev
```

Open http://localhost:5173/.

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Vitest: engine, state and component tests |
| `npm run test:e2e` | Build, then Playwright end-to-end tests against `dist/` served under `/unitscope/` |
| `npm run check` | Typecheck + unit tests + end-to-end tests |

The first end-to-end run needs Playwright's Chromium:

```bash
npx playwright install chromium
```

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` runs on every push to `main`:

1. `npm ci`
2. typecheck
3. unit tests
4. `vite build`
5. publish `dist/` with `actions/deploy-pages`

In the repository settings, Pages must use **GitHub Actions** as its source.

`vite.config.ts` uses `base: './'`, so the same build works at `https://egeardac.github.io/unitscope/`, at a domain root, or from a local folder. App state lives in the query string, so no SPA 404 workaround is needed.

## Architecture

```
src/engine/      Pure TypeScript calculation engine (no React). The only place math lives.
  units.ts       Quantities and units as exact (integer mantissa × 10^exp) factors, aliases
  parse.ts       Number parsing (point/comma, scientific, grouping, ambiguity) and unit resolution
  convert.ts     Exact conversion via power-of-ten shifts; overflow/underflow errors
  format.ts      Display-only rounding: significant figures, notations, SI prefixes, copy text
  scale.ts       Nice ticks, expand-only auto scale, manual scale, off-range detection
  models/        dcResistor, acSine, periodic, rc, rl, accumulate, decibel, battery, ohm, pcb
src/state/       One store (useSyncExternalStore), reducer, derive() selectors, URL and localStorage
src/components/  Converter, quantity rail, SVG Plot / BarCompare / CircuitDiagram, controls, guide
src/views/       One view per model (DC/AC voltage, current, resistance, RC, RL, waveform, accumulation, PCB)
src/calcs/       Contextual circuit-calculation panels
tests/engine/    Engine and state tests (Vitest)
tests/components Visualization invariance tests (Vitest + jsdom)
tests/e2e/       Playwright journeys, mobile layout, accessibility and contrast checks
```

Design decisions:

- **One calculation state.** Converter, sliders, readouts, graphs and schematics all read `derive(state)`, which calls the engine. Visualizations receive SI values only.
- **No intermediate rounding.** Factors use integer mantissas, and conversion multiplies, shifts by an exact power of ten, then divides. 100 nF → 0.1 µF and 1 in → 25.4 mm are exact. Rounding happens only in `format.ts`.
- **Slider range ≠ engine range.** Sliders state their range ("Slider: −30 V … 30 V"). Typed values outside that range are used unchanged, and the slider shows that it is pinned.
- **Typed values are never reformatted.** Inputs are stored as text plus unit; the parsed value is derived from them.

## Models and assumptions

| Model | Equations | Assumptions |
|---|---|---|
| DC resistor | I = V/R, P = V²/R = I²R | Ideal source and wires; linear R (no heating, no tolerance) |
| AC sine | v = Vpk·sin(2πft), Vpk = √2·Vrms, Vpp = 2·Vpk | Pure sine, zero DC offset only |
| RC step | τ = RC, Vc = Vs + (V0 − Vs)·e^(−t/τ), fc = 1/(2πRC) | Ideal capacitor and switch |
| RL step | τ = L/R, i = (Vs/R)(1 − e^(−t/τ)) | Zero initial current; R = 0 gives an unbounded ramp |
| Accumulation | E = P·t, Q = I·t | Constant rate; no battery capacity model |
| Decibels | dBm = 10·log10(P/1 mW), dBW = 10·log10(P/1 W) | Voltage → dBm needs the load; voltage dB = power dB only for equal R |
| Battery | Wh ≈ Ah × Vnom | Approximation at nominal voltage |

## Sources

- [NIST SP 811, Chapter 4: SI units and prefixes](https://www.nist.gov/pml/special-publication-811/nist-guide-si-chapter-4-two-classes-si-units-and-si-prefixes). Inch = 2.54 cm exactly (Appendix B).
- [Analog Devices, Real Analog: Circuits 1, Chapter 1](https://download.analog.com/159850/RealAnalog/RealAnalog-Circuits1-Chapter1.pdf)
- [Tektronix: RMS explanation](https://download.tek.com/manual/197_901_01A.pdf)
- [Texas Instruments: passive components and RC circuits](https://www.ti.com/content/dam/videos/external-videos/en-us/4/3816841626001/6119035031001.mp4/subassets/passive_components_and_circuits_2.pdf)
- [Keysight: decibels](https://helpfiles.keysight.com/csg/89600B/Webhelp/Subsystems/gettingstarted/content/concepts_decibels.htm)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## Verification

### Checks performed

**Automated: Vitest, 81 tests** (`npm test`)

- Every acceptance case in the specification:
  - 1 V = 1000 mV
  - 4.7 kΩ = 4700 Ω
  - 100 nF = 0.1 µF exactly
  - 2.5 mH = 2500 µH
  - 1 MHz → 1 µs
  - 1 mW = 0 dBm, 1 W = 30 dBm
  - 1 Vrms → 1.414213562 Vpk
  - 1 kΩ × 100 µF → τ = 0.1 s
  - 1 V / 1 kΩ → 1 mA, 1 mW; 10 V → 10 mA, 100 mW
- Exact prefix factors, m vs M, inch/mil/Wh/mAh factors, and round trips across every unit pair.
- Parsing: comma, scientific, grouping, ambiguous and mixed separators, overflow and underflow, aliases, case-sensitive suggestions, and wrong-quantity detection.
- Formatting: significant figures, notations, SI-prefix choice after rounding, and ASCII copy text.
- Model errors: R = 0, C = 0, f = 0, negative power and 0 W in dBm, missing load, missing nominal voltage.
- Scales: expand-only, manual, fit, off-range detection.
- Store: a typing transient does not inflate the scale; swap preserves the value exactly.
- Share-link round trip, and rejection of invalid parameters.
- **Component test:** the rendered figure (schematic, bars, readouts, summary) is byte-identical for 1 V, 1000 mV and 1 000 000 µV. At 10 V, the V and I bars are exactly 10× taller on the unchanged 0–20 V scale, and negative voltage reverses the current arrow.

**Automated: Playwright, 37 tests** (`npm run test:e2e`). These run in Chromium against the production build served under `/unitscope/`.

- **Acceptance and conversion journeys**
  - All acceptance cases through the real UI, including identical figure HTML for the three representations and the 1 V → 10 V shared-scale journey.
  - Clipboard copy reads back `1000 mV`.
  - A share link restores quantity, units, value, R, V0, reference and results in a fresh browser context; invalid link parameters are reported.
- **Interaction**
  - Keyboard only: `/` to search, Enter to open, Tab to the value, swap, R slider with arrow keys, graph inspection with arrow keys.
  - Ambiguous-number and wrong-quantity fixes; negative and 0 W dBm errors; required load and nominal voltage.
  - Manual scale clipping (▲) and Fit.
  - Theme and history persist across reloads.
  - Playback moves the playhead and Pause stops it; MHz playback is labelled as slowed; too many cycles produce an envelope.
- **Reduced motion:** `document.getAnimations()` is empty, Play is disabled, and no playhead is drawn.
- **Hosting and dialogs:** guide dialog opens and closes with Escape; search carries a value over; assets load with relative URLs under the project path.
- **Mobile, 375 × 812**
  - Section order: quantity → value → result → visualization → parameters.
  - No horizontal overflow on any of the 11 quantities, or in the AC view.
  - Touch inspection works.
  - Touch targets are at least 24 px (most controls are 44 px).
- **Accessibility and contrast**
  - axe-core reports no WCAG 2.0/2.1/2.2 A and AA violations on 5 views, in light and dark.
  - Plot strokes, axes, guides and playhead reach at least 3:1 against the plot background, in light and dark.
  - axe cannot judge text over the gradient and glass (it reports those as "incomplete"), so a custom test composites each text element's translucent backgrounds over the worst-case page color. It requires 4.5:1 (3:1 for large text) on about 1,750 text elements across 10 views, in both themes; a planted low-contrast probe was correctly flagged.
  - Input and segmented-control borders reach at least 3:1.

**Manual**

- Screenshots reviewed at 1440 × 1000, 1600 × 1000, 1920 × 1080, 820 × 1100 and 375 × 812, in light and dark.
- A frame-rate measurement led to the stage panel being drawn without backdrop blur: animation inside a blurred panel dropped headless Chromium from 61 fps to 18 fps.

### Not verified

- Browsers other than Chromium (Firefox, Safari / iOS Safari) and real touch devices. Mobile was emulated in Chromium.
- Real screen readers (NVDA, VoiceOver, JAWS). Only the DOM semantics, labels, live regions and axe checks were verified.
- Behaviour with Windows High Contrast / forced colors.
- Performance on low-end hardware beyond the headless frame-rate measurements.
