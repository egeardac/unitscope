import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatNumber } from './engine/format';
import { CalcPanel } from './calcs/Calcs';
import { ConverterPanel } from './components/ConverterPanel';
import { HelpDialog } from './components/HelpDialog';
import { AllUnitsTable, PresetsPanel, RecentList, ReferenceComparisons } from './components/MorePanels';
import { QuantityRail } from './components/QuantityRail';
import { Stage } from './components/Stage';
import { TopBar } from './components/TopBar';
import { copyToClipboard } from './hooks';
import { defaultState } from './state/defaults';
import { derive } from './state/derive';
import {
  loadHistory,
  loadOnboarded,
  loadSettings,
  loadTheme,
  pushHistory,
  saveHistory,
  saveOnboarded,
  saveSettings,
  saveTheme,
  type HistoryEntry,
  type ThemePref,
} from './state/persistence';
import { createStore, StoreProvider, useAppState, type Store } from './state/store';
import type { AppState } from './state/types';
import { decodeState, encodeState, shareUrl } from './state/urlState';
import { ToastProvider, useToast } from './ui';

export function buildInitialState(search: string): { state: AppState; rejected: string[]; restored: boolean } {
  const base = defaultState();
  const settings = loadSettings();
  if (settings.sigFigs !== undefined) base.display.sigFigs = settings.sigFigs;
  if (settings.notation !== undefined) base.display.notation = settings.notation;
  if (settings.trimZeros !== undefined) base.display.trimZeros = settings.trimZeros;
  const decoded = decodeState(search, base);
  return { state: decoded.state, rejected: decoded.rejected, restored: decoded.present };
}

function historyEntry(s: AppState): HistoryEntry | null {
  const d = derive(s);
  if (!d.conversion.ok) return null;
  const c = d.conversion.value;
  const f = (v: number) => formatNumber(v, s.display).text;
  const e: HistoryEntry = {
    q: s.quantity,
    text: s.conv[s.quantity].text,
    from: c.from.id,
    to: c.to.id,
    summary: `${f(c.input.value)} ${c.from.symbol} → ${f(c.result)} ${c.to.symbol}`,
    at: Date.now(),
  };
  if (s.quantity === 'voltage') e.mode = s.voltageMode;
  return e;
}

function Onboarding({ onDismiss }: { onDismiss: () => void }) {
  return (
    <aside className="onboarding" aria-label="Getting started">
      <ol>
        <li>
          <strong>Pick a quantity</strong>, or search for a unit such as “uF”.
        </li>
        <li>
          <strong>Type a value</strong>, e.g. 4.7 kΩ or 100 uF. The result updates as you type.
        </li>
        <li>
          <strong>Explore the model</strong>: pin a reference, change the value, compare on the same scale.
        </li>
      </ol>
      <button type="button" className="btn ghost small" onClick={onDismiss}>
        Got it
      </button>
    </aside>
  );
}

function Workspace({ store, rejected, restored }: { store: Store; rejected: string[]; restored: boolean }) {
  const toast = useToast();
  const quantity = useAppState((s) => s.quantity);
  const [theme, setTheme] = useState<ThemePref>(loadTheme);
  const [solid, setSolid] = useState<boolean>(() => loadSettings().solidPanels ?? false);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [helpOpen, setHelpOpen] = useState(false);
  const [onboarded, setOnboarded] = useState(loadOnboarded);
  const searchRef = useRef<HTMLInputElement>(null);

  // Theme preference (stored locally).
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  // Solid-panel fallback (no backdrop blur).
  useEffect(() => {
    document.documentElement.classList.toggle('solid-panels', solid);
  }, [solid]);

  // Persist display settings, keep the address bar shareable, record history.
  useEffect(() => {
    let urlTimer: ReturnType<typeof setTimeout> | undefined;
    let histTimer: ReturnType<typeof setTimeout> | undefined;
    let last = store.getState();
    const sync = () => {
      const s = store.getState();
      saveSettings({ ...s.display, solidPanels: document.documentElement.classList.contains('solid-panels') });
      clearTimeout(urlTimer);
      urlTimer = setTimeout(() => {
        try {
          window.history.replaceState(null, '', `${window.location.pathname}?${encodeState(store.getState())}`);
        } catch {
          /* some embedded contexts forbid history changes */
        }
      }, 250);
      if (s.conv !== last.conv || s.quantity !== last.quantity || s.voltageMode !== last.voltageMode) {
        clearTimeout(histTimer);
        histTimer = setTimeout(() => {
          const e = historyEntry(store.getState());
          if (e) setHistory((h) => pushHistory(h, e));
        }, 1500);
      }
      last = s;
    };
    const unsub = store.subscribe(sync);
    return () => {
      unsub();
      clearTimeout(urlTimer);
      clearTimeout(histTimer);
    };
  }, [store]);

  useEffect(() => saveHistory(history), [history]);
  useEffect(() => saveSettings({ ...store.getState().display, solidPanels: solid }), [solid, store]);

  useEffect(() => {
    if (rejected.length > 0) toast(`Some link values were invalid and were reset: ${rejected.join(', ')}.`);
    else if (restored) toast('Restored the shared values from the link.');
  }, [rejected, restored, toast]);

  // "/" focuses the quantity search from anywhere except text fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const share = useCallback(async () => {
    const url = shareUrl(store.getState(), window.location);
    const okCopy = await copyToClipboard(url);
    toast(okCopy ? 'Share link copied. It restores the units, values and model parameters.' : `Copy failed. Link: ${url}`);
  }, [store, toast]);

  const recordNow = useCallback(() => {
    const e = historyEntry(store.getState());
    if (e) setHistory((h) => pushHistory(h, e));
  }, [store]);

  const dismissOnboarding = () => {
    saveOnboarded();
    setOnboarded(true);
  };

  return (
    <div className="app">
      <a className="skip-link" href="#workspace">
        Skip to the converter
      </a>
      <TopBar theme={theme} onTheme={setTheme} solid={solid} onSolid={setSolid} onShare={share} onHelp={() => setHelpOpen(true)} />
      <main id="workspace" className="workspace">
        <div className="col-rail">
          <QuantityRail searchRef={searchRef} />
          <RecentList history={history} onClear={() => setHistory([])} className="recent-desktop" />
        </div>
        <div className="col-conv">
          <ConverterPanel onCopied={recordNow} onboarding={onboarded ? null : <Onboarding onDismiss={dismissOnboarding} />} />
        </div>
        <div className="col-stage">
          <Stage />
          <CalcPanel quantity={quantity} />
        </div>
        <div className="col-more">
          <PresetsPanel />
          <ReferenceComparisons />
          <AllUnitsTable />
        </div>
        <div className="col-recent">
          <RecentList history={history} onClear={() => setHistory([])} className="recent-mobile" />
        </div>
      </main>
      <footer className="footer">
        <p>
          Unitscope uses ideal circuit and signal models for learning and bench estimates. Real components have tolerances, ratings and parasitics. Your data stays in this
          browser. Sources and assumptions are listed in the{' '}
          <button type="button" className="linklike" onClick={() => setHelpOpen(true)}>
            guide
          </button>
          .
        </p>
      </footer>
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

export function App({ search = typeof window !== 'undefined' ? window.location.search : '' }: { search?: string }) {
  const init = useMemo(() => buildInitialState(search), [search]);
  const store = useMemo(() => createStore(init.state), [init]);
  return (
    <StoreProvider store={store}>
      <ToastProvider>
        <Workspace store={store} rejected={init.rejected} restored={init.restored} />
      </ToastProvider>
    </StoreProvider>
  );
}
