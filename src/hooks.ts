import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';

/** True when the user asks the system for reduced motion. Continuous animation is disabled then. */
export function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [reduced, setReduced] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(query);
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Width of an element, tracked with ResizeObserver; falls back to `fallback` where unavailable (tests). */
export function useElementWidth<T extends HTMLElement>(fallback = 640): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 0) setWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** A tiny external store holding playback time, so only the playhead re-renders on each frame. */
export interface Clock {
  subscribe: (listener: () => void) => () => void;
  get: () => number;
}

/**
 * A playback clock in real seconds, driven by requestAnimationFrame while
 * `playing`. `restart` resets it to zero. Nothing runs while paused.
 */
export function usePlaybackClock(playing: boolean): { clock: Clock; restart: () => void } {
  const state = useRef({ seconds: 0, base: 0, startedAt: null as number | null, listeners: new Set<() => void>() });
  const clock = useRef<Clock>({
    subscribe: (l) => {
      state.current.listeners.add(l);
      return () => state.current.listeners.delete(l);
    },
    get: () => state.current.seconds,
  }).current;
  const emit = () => {
    for (const l of state.current.listeners) l();
  };
  useEffect(() => {
    const s = state.current;
    if (!playing) {
      if (s.startedAt !== null) {
        s.base += (performance.now() - s.startedAt) / 1000;
        s.startedAt = null;
      }
      return;
    }
    if (typeof requestAnimationFrame !== 'function') return;
    s.startedAt = performance.now();
    let raf = 0;
    const tick = () => {
      if (s.startedAt !== null) {
        s.seconds = s.base + (performance.now() - s.startedAt) / 1000;
        emit();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const restart = useCallback(() => {
    const s = state.current;
    s.base = 0;
    s.seconds = 0;
    s.startedAt = s.startedAt !== null ? performance.now() : null;
    emit();
  }, []);
  return { clock, restart };
}

/** Read the clock inside a small component; it re-renders on every frame while playing. */
export function useClock(clock: Clock): number {
  return useSyncExternalStore(clock.subscribe, clock.get, clock.get);
}

/** Debounced copy of a value. */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Copy text to the clipboard, with a fallback for non-secure contexts. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const okCopy = document.execCommand('copy');
    document.body.removeChild(ta);
    return okCopy;
  } catch {
    return false;
  }
}
