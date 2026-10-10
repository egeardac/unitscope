/**
 * Bridge to the inline boot screen in index.html. It plays the intro on its
 * own; the app only tells it where to land (the landing logo) or to fade out.
 */
declare global {
  interface Window {
    unitscopeBoot?: { finish(target: Element | null): Promise<void> };
  }
}

export function finishBoot(target: Element | null): Promise<void> {
  if (typeof window === 'undefined' || !window.unitscopeBoot) return Promise.resolve();
  return window.unitscopeBoot.finish(target);
}

/** Calls `cb` when the boot screen starts to reveal the page. Never fires if no boot screen is showing. */
export function onBootReveal(cb: () => void): () => void {
  if (typeof window === 'undefined' || !document.documentElement.classList.contains('booting')) return () => {};
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    cb();
  };
  window.addEventListener('unitscope:boot-reveal', fire);
  window.addEventListener('unitscope:boot-done', fire);
  return () => {
    window.removeEventListener('unitscope:boot-reveal', fire);
    window.removeEventListener('unitscope:boot-done', fire);
  };
}

/** Shared links (?q=) open the workspace directly; every other visit lands on the intro page. */
export function wantsLanding(search: string): boolean {
  return !new URLSearchParams(search).has('q');
}
