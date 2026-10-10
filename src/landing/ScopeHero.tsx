import { useEffect, useRef, useState } from 'react';

/** Fixed vertical scale: 3 V/div over 8 divisions, so a larger amplitude visibly draws a larger wave. */
const FULL_SCALE = 12;
const AMPLITUDES = [1, 5, 10] as const;
const AUTO_CYCLE = [1, 10, 5] as const;

type Amp = (typeof AMPLITUDES)[number];

function fmtV(v: number): string {
  return v < 1 ? `${(v * 1000).toFixed(1)} mV` : `${v.toFixed(3)} V`;
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Palette {
  grid: string;
  zero: string;
  trace: string;
  ref: string;
  tick: string;
  mono: string;
}

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return { grid: v('--grid'), zero: v('--grid-zero'), trace: v('--series-1'), ref: v('--series-2'), tick: v('--tick'), mono: v('--mono') };
}

/** Landing hero: a 1 kHz sine on a fixed ±12 V scale, with a pinned 1 V reference. */
export function ScopeHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [target, setTarget] = useState<Amp>(1);
  const [picked, setPicked] = useState(false);
  const targetRef = useRef<number>(target);
  const repaintRef = useRef<() => void>(() => {});
  targetRef.current = target;

  // Cycle through the amplitudes until the visitor picks one.
  useEffect(() => {
    if (picked || reducedMotion()) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % AUTO_CYCLE.length;
      setTarget(AUTO_CYCLE[i]!);
    }, 2800);
    return () => clearInterval(id);
  }, [picked]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const still = reducedMotion();
    let palette = readPalette();
    let amp = targetRef.current;
    let phase = 0;
    let last = performance.now();
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const plot = (w: number, h: number, a: number, color: string, width: number, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        // 2 ms window → two cycles of 1 kHz.
        const y = h / 2 - (a / FULL_SCALE) * (h / 2) * Math.sin(2 * Math.PI * (x / w) * 2 - phase);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = palette.grid;
      for (let i = 1; i < 10; i++) {
        const x = Math.round((i / 10) * w) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let j = 1; j < 8; j++) {
        const y = Math.round((j / 8) * h) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.strokeStyle = palette.zero;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, Math.round(h / 2) + 0.5);
      ctx.lineTo(w, Math.round(h / 2) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      plot(w, h, 1, palette.ref, 1.5, 0.55);
      plot(w, h, amp, palette.trace, 2.4, 1);
      ctx.font = `500 11px ${palette.mono}`;
      ctx.fillStyle = palette.tick;
      ctx.fillText(`+${amp.toFixed(1)} V`, 8, Math.max(14, h / 2 - (amp / FULL_SCALE) * (h / 2) - 6));
      ctx.fillStyle = palette.ref;
      ctx.textAlign = 'right';
      ctx.fillText('ref 1 V', w - 10, h - 10);
      ctx.textAlign = 'left';
    };

    const loop = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      amp += (targetRef.current - amp) * Math.min(1, dt / 160);
      phase += dt * 0.0018;
      draw();
      raf = requestAnimationFrame(loop);
    };

    const repaint = () => {
      palette = readPalette();
      if (still) {
        amp = targetRef.current;
        draw();
      }
    };

    resize();
    draw();
    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(canvas);
    // Theme changes: the OS setting or the stored data-theme attribute.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', repaint);
    const mo = new MutationObserver(repaint);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (!still) raf = requestAnimationFrame(loop);
    repaintRef.current = repaint;

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener('change', repaint);
    };
  }, []);

  // Under reduced motion there is no animation loop, so redraw when the value changes.
  useEffect(() => {
    if (reducedMotion()) repaintRef.current();
  }, [target]);

  return (
    <figure className="landing-scope glass reveal d2" aria-labelledby="landing-scope-note">
      <div className="landing-scope-head">
        <span className="landing-ch">
          <i aria-hidden="true" />
          CH1 · AC sine · 1 kHz
        </span>
        <div className="landing-seg" role="group" aria-label="Peak voltage">
          {AMPLITUDES.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={target === a}
              onClick={() => {
                setPicked(true);
                setTarget(a);
              }}
            >
              {a} V
            </button>
          ))}
        </div>
      </div>
      <div className="landing-screen">
        <canvas ref={canvasRef} aria-hidden="true" />
        <span className="landing-badge">{reducedMotion() ? 'Paused' : 'Slow motion'}</span>
        <span className="landing-scale">3 V/div · 0.2 ms/div</span>
      </div>
      <div className="landing-readouts">
        <div>
          <span>Vpk</span>
          <b>{fmtV(target)}</b>
        </div>
        <div>
          <span>Vrms</span>
          <b>{fmtV(target / Math.SQRT2)}</b>
        </div>
        <div>
          <span>Vpp</span>
          <b>{fmtV(target * 2)}</b>
        </div>
        <div>
          <span>T</span>
          <b>1.000 ms</b>
        </div>
      </div>
      <figcaption className="landing-scope-note" id="landing-scope-note">
        Fixed ±12 V scale, so a bigger value draws a bigger wave. Unitscope never rescales silently.
      </figcaption>
    </figure>
  );
}
