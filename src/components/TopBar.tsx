import type { ThemePref } from '../state/persistence';

export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <rect x="1.5" y="1.5" width="29" height="29" rx="9" className="logo-bg" />
      <path d="M6 20c3 0 3-8 6-8s3 8 6 8 3-8 6-8" className="logo-wave" fill="none" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7 25h18M10 23.5v3M16 23.5v3M22 23.5v3" className="logo-ticks" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function TopBar({
  theme,
  onTheme,
  solid,
  onSolid,
  onShare,
  onHelp,
}: {
  theme: ThemePref;
  onTheme: (t: ThemePref) => void;
  solid: boolean;
  onSolid: (v: boolean) => void;
  onShare: () => void;
  onHelp: () => void;
}) {
  return (
    <header className="topbar">
      <a className="brand" href="./" aria-label="Unitscope home">
        <Logo />
        <span className="brand-text">
          <span className="brand-name">Unitscope</span>
          <span className="brand-tag">Convert a unit, then see what it does in a circuit</span>
        </span>
      </a>
      <div className="top-actions">
        <button type="button" className="btn" onClick={onShare} data-testid="share">
          Copy share link
        </button>
        <button type="button" className="btn" onClick={onHelp}>
          Guide
        </button>
        <details className="menu">
          <summary className="btn" aria-label="Display settings">
            Display
          </summary>
          <div className="menu-panel glass">
            <fieldset>
              <legend>Theme</legend>
              {(['system', 'light', 'dark'] as const).map((t) => (
                <label key={t} className="check">
                  <input type="radio" name="theme" checked={theme === t} onChange={() => onTheme(t)} />
                  {t === 'system' ? 'Match system' : t === 'light' ? 'Light' : 'Dark'}
                </label>
              ))}
            </fieldset>
            <label className="check">
              <input type="checkbox" checked={solid} onChange={(e) => onSolid(e.target.checked)} />
              Solid panels (no blur, better on slow devices)
            </label>
          </div>
        </details>
      </div>
    </header>
  );
}
