import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

interface ToastApi {
  toast: (message: string) => void;
}

const ToastContext = createContext<ToastApi>({ toast: () => {} });

/** Small polite status messages ("Copied 1000 mV"). Announced to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((m: string) => {
    setMessage(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3200);
  }, []);
  const api = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {message && <div className="toast glass">{message}</div>}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi['toast'] {
  return useContext(ToastContext).toast;
}
