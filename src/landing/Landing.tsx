import { useEffect, useRef, useState } from 'react';
import { Logo } from '../components/TopBar';
import { finishBoot, onBootReveal } from './boot';
import { ScopeHero } from './ScopeHero';

export function Landing({ onOpen }: { onOpen: () => void }) {
  const logoRef = useRef<HTMLSpanElement>(null);
  const [enter, setEnter] = useState(false);

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
            </div>
          </div>
          <ScopeHero />
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-wrap">
          <p>Unitscope uses ideal circuit and signal models for learning and bench estimates. Real components have tolerances, ratings and parasitics.</p>
        </div>
      </footer>
    </div>
  );
}
