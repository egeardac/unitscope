import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { derive, type Derived } from './derive';
import { reconcile, reduce } from './reducer';
import type { Action, AppState } from './types';

/**
 * A single application store. Numeric inputs, sliders, results, graphs and
 * circuit diagrams all read from this one state and its derived values.
 */
export interface Store {
  getState: () => AppState;
  dispatch: (action: Action) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore(initial: AppState): Store {
  let state = reconcile(initial);
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch: (action) => {
      const next = reduce(state, action);
      if (next === state) return;
      state = next;
      for (const l of listeners) l();
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ store, children }: { store: Store; children: ReactNode }) {
  return createElement(StoreContext.Provider, { value: store }, children);
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreProvider is missing');
  return s;
}

/** Subscribe to a slice of state. Selectors must return stable values (state fields or primitives). */
export function useAppState<T>(selector: (s: AppState) => T): T {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()), () => selector(store.getState()));
}

export function useDerived(): Derived {
  const store = useStore();
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return derive(state);
}

export function useDispatch(): (a: Action) => void {
  return useStore().dispatch;
}
