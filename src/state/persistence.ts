/**
 * Local, per-browser storage for history and preferences. Storage may be
 * unavailable (private mode, blocked site data); every access is guarded and
 * the app works without it.
 */
import { clampSigFigs, type Notation } from '../engine/format';
import { getUnit, isQuantityId, type QuantityId } from '../engine/units';
import type { DisplaySettings } from './types';

const KEY_THEME = 'unitscope.theme';
const KEY_SETTINGS = 'unitscope.settings';
const KEY_HISTORY = 'unitscope.history';
const KEY_ONBOARDED = 'unitscope.onboarded';
// Also read by the inline boot script in index.html.
const KEY_SKIP_INTRO = 'unitscope.skipIntro';

export type ThemePref = 'light' | 'dark' | 'system';

export interface StoredSettings extends DisplaySettings {
  solidPanels: boolean;
}

export interface HistoryEntry {
  q: QuantityId;
  text: string;
  from: string;
  to: string;
  mode?: 'dc' | 'ac';
  /** Display summary such as "1 V → 1000 mV". */
  summary: string;
  at: number;
}

export const HISTORY_LIMIT = 20;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: preferences simply are not remembered */
  }
}

export function loadTheme(): ThemePref {
  const t = read(KEY_THEME);
  return t === 'light' || t === 'dark' || t === 'system' ? t : 'system';
}

export function saveTheme(t: ThemePref): void {
  write(KEY_THEME, t);
}

export function loadSettings(): Partial<StoredSettings> {
  const raw = read(KEY_SETTINGS);
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<StoredSettings> = {};
    if (typeof o.sigFigs === 'number') out.sigFigs = clampSigFigs(o.sigFigs);
    if (o.notation === 'auto' || o.notation === 'scientific' || o.notation === 'engineering') out.notation = o.notation as Notation;
    if (typeof o.trimZeros === 'boolean') out.trimZeros = o.trimZeros;
    if (typeof o.solidPanels === 'boolean') out.solidPanels = o.solidPanels;
    return out;
  } catch {
    return {};
  }
}

export function saveSettings(s: StoredSettings): void {
  write(KEY_SETTINGS, JSON.stringify(s));
}

export function loadHistory(): HistoryEntry[] {
  const raw = read(KEY_HISTORY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (e): e is HistoryEntry =>
          typeof e === 'object' &&
          e !== null &&
          isQuantityId((e as HistoryEntry).q) &&
          typeof (e as HistoryEntry).text === 'string' &&
          typeof (e as HistoryEntry).summary === 'string' &&
          getUnit((e as HistoryEntry).from)?.quantity === (e as HistoryEntry).q &&
          getUnit((e as HistoryEntry).to)?.quantity === (e as HistoryEntry).q,
      )
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function saveHistory(h: HistoryEntry[]): void {
  write(KEY_HISTORY, JSON.stringify(h.slice(0, HISTORY_LIMIT)));
}

/** Add an entry at the top, removing an identical earlier one. */
export function pushHistory(h: HistoryEntry[], e: HistoryEntry): HistoryEntry[] {
  const same = (a: HistoryEntry) => a.q === e.q && a.text === e.text && a.from === e.from && a.to === e.to && a.mode === e.mode;
  return [e, ...h.filter((x) => !same(x))].slice(0, HISTORY_LIMIT);
}

export function loadOnboarded(): boolean {
  return read(KEY_ONBOARDED) === '1';
}

export function saveOnboarded(): void {
  write(KEY_ONBOARDED, '1');
}

export function loadSkipIntro(): boolean {
  return read(KEY_SKIP_INTRO) === '1';
}

export function saveSkipIntro(skip: boolean): void {
  write(KEY_SKIP_INTRO, skip ? '1' : null);
}
