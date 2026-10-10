import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Logo } from '../components/TopBar';
import { loadSkipIntro, saveSkipIntro } from '../state/persistence';
import { finishBoot, onBootReveal } from './boot';
import { ScopeHero } from './ScopeHero';

interface Feature {
  title: string;
  body: string;
  example: string;
  icon: ReactNode;
}

const ICON = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const FEATURES: Feature[] = [
  {
    title: 'Exact conversion',
    body: 'Every factor is exact and checked against NIST SP 811. Prefixes are case-sensitive, so m and M never mix.',
    example: '4.7 kohm → 4 700 Ω',
    icon: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  },
  {
    title: 'Live circuit models',
    body: 'DC circuits, AC on a scope, RC and RL step responses, energy over time and a PCB ruler. Hover any graph to read values.',
    example: '100 µF · 1 kΩ → τ = 100 ms',
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M6 14c2 0 2-5 4-5s2 5 4 5 2-5 4-5" />
      </>
    ),
  },
  {
    title: 'Circuit calculations',
    body: "Ohm's law, RMS and peak, dBm and dBW, RC and RL cut-off, Ah to Wh. Each one asks for every input it needs.",
    example: '1 mW → 0 dBm',
    icon: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2.5" />
        <path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" />
      </>
    ),
  },
  {
    title: 'Private and shareable',
    body: 'No account and no server. A copied link restores the quantity, units, value and scales exactly as you left them.',
    example: '?q=capacitance&v=100&from=uF',
    icon: (
      <>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
      </>
    ),
  },
];

export function Landing({ onOpen }: { onOpen: () => void }) {
  const logoRef = useRef<HTMLSpanElement>(null);
  const [enter, setEnter] = useState(false);
  const [skip, setSkip] = useState(loadSkipIntro);

  // Hand the boot screen its landing spot, and play the entrance as it reveals the page.
  useEffect(() => onBootReveal(() => setEnter(true)), []);
  useEffect(() => {
    void finishBoot(logoRef.current);
  }, []);

  return (
    <div className={enter ? 'landing enter' : 'landing'}>
      <header className="landing-top">
        <div className="landing-wrap">
          <a className="brand" href="./" aria-label="Unitscope home">
            <span className="landing-logo" ref={logoRef}>
              <Logo />
            </span>
            <span className="brand-name">Unitscope</span>
          </a>
          <nav className="top-actions" aria-label="Page">
            <a className="btn ghost landing-hide-narrow" href="#features">
              Features
            </a>
            <button type="button" className="btn primary" onClick={onOpen}>
              Open Unitscope
            </button>
          </nav>
        </div>
      </header>

      <main className="landing-wrap">
        <section className="landing-hero">
          <div>
            <p className="landing-eyebrow reveal">Electronics unit converter</p>
            <h1 className="reveal d1">
              Convert a unit. <span className="landing-hl">See what it does.</span>
            </h1>
            <p className="landing-lede reveal d2">
              Exact conversions for V, A, Ω, F, H, W, Hz and more, drawn live inside an ideal circuit or signal model. 1 V and 1000 mV give the same picture. 10 V does
              not.
            </p>
            <div className="landing-cta reveal d3">
              <button type="button" className="btn primary landing-lg" onClick={onOpen}>
                Open Unitscope <span aria-hidden="true">→</span>
              </button>
              <a className="btn landing-lg" href="#features">
                How it works
              </a>
            </div>
            <p className="landing-units reveal d3">
              <b>µV</b> mV V kV · <b>nA</b> mA A · <b>mΩ</b> kΩ MΩ · <b>pF</b> nF µF · <b>nH</b> mH · <b>mW</b> kW · <b>Hz</b> MHz · <b>mAh</b> Wh · <b>mil</b> mm
            </p>
          </div>
          <ScopeHero />
        </section>

        <section className="landing-features" id="features" aria-labelledby="features-title">
          <h2 id="features-title">One calculation state, four ways to use it</h2>
          <p>Type a value once. The converter, the model drawing and the circuit calculators all read the same number.</p>
          <div className="landing-cards">
            {FEATURES.map((f) => (
              <article className="landing-card glass" key={f.title}>
                <div className="landing-ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" {...ICON}>
                    {f.icon}
                  </svg>
                </div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
                <span className="landing-eg">{f.example}</span>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-wrap">
          <p>Unitscope uses ideal circuit and signal models for learning and bench estimates. Real components have tolerances, ratings and parasitics.</p>
          <label className="check">
            <input
              type="checkbox"
              checked={skip}
              onChange={(e) => {
                setSkip(e.target.checked);
                saveSkipIntro(e.target.checked);
              }}
            />
            Skip intro next time
          </label>
        </div>
      </footer>
    </div>
  );
}
