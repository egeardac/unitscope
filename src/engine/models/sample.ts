/** Sample a model function on [t0, t1]. Visualizations draw these exact model values. */
export function sampleFunction(fn: (t: number) => number, t0: number, t1: number, n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const count = Math.max(2, Math.floor(n));
  for (let i = 0; i < count; i++) {
    const t = t0 + ((t1 - t0) * i) / (count - 1);
    out.push([t, fn(t)]);
  }
  return out;
}
