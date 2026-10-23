const reduceMotion = (): boolean => matchMedia("(prefers-reduced-motion: reduce)").matches;

function makeCanvas(className: string): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.className = `fx ${className}`;
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");
  return { canvas, ctx };
}

function fit(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1); // cap to keep the canvas small on 3x phones
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ---------- Snow: soft flakes drifting behind the doors ---------- */
interface Flake { x: number; y: number; r: number; speed: number; sway: number; phase: number }

export function startSnow(): void {
  // With reduced motion (e.g. iOS Reduce Motion) keep the snow but make it calm: fewer, slower flakes with little sway
  const calm = reduceMotion() ? 0.35 : 1;
  const { canvas, ctx } = makeCanvas("fx-snow");
  let flakes: Flake[] = [];

  const populate = (): void => {
    fit(canvas, ctx);
    const count = Math.min(120, Math.round((innerWidth * innerHeight) / 12000 * (calm < 1 ? 0.6 : 1)));
    flakes = Array.from({ length: count }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: 1 + Math.random() * 2.6,
      speed: (18 + Math.random() * 32) * calm, // px per second
      sway: (8 + Math.random() * 18) * calm,
      phase: Math.random() * Math.PI * 2,
    }));
  };
  populate();
  // iOS fires resize whenever the address bar shows/hides while scrolling; only rebuild when the width changes
  let lastWidth = innerWidth;
  addEventListener("resize", () => {
    if (innerWidth !== lastWidth) { lastWidth = innerWidth; populate(); }
    else fit(canvas, ctx);
  });

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const f of flakes) {
      f.y += f.speed * dt;
      f.phase += dt * 0.8;
      const x = f.x + Math.sin(f.phase) * f.sway;
      if (f.y > innerHeight + 5) { f.y = -5; f.x = Math.random() * innerWidth; }
      ctx.beginPath();
      ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${0.35 + f.r * 0.15})`;
      ctx.fill();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* ---------- Sparkle: a burst of gold stars when a door opens ---------- */
interface Spark { x: number; y: number; vx: number; vy: number; size: number; life: number; age: number; color: string }

const COLORS = ["#ffe9a8", "#e0b552", "#ffffff", "#f6c7cf"];
let sparkCanvas: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
let sparks: Spark[] = [];
let running = false;

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? r : r * 0.35;
    const a = (i * Math.PI) / 4;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

export function sparkle(x: number, y: number): void {
  if (reduceMotion()) return;
  if (!sparkCanvas) {
    sparkCanvas = makeCanvas("fx-sparkle");
    addEventListener("resize", () => sparkCanvas && fit(sparkCanvas.canvas, sparkCanvas.ctx));
  }
  fit(sparkCanvas.canvas, sparkCanvas.ctx);
  for (let i = 0; i < 28; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 170;
    sparks.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      size: 3 + Math.random() * 5,
      life: 0.7 + Math.random() * 0.6,
      age: 0,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
  }
  if (!running) { running = true; runSparks(performance.now()); }
}

function runSparks(last: number): void {
  const { ctx } = sparkCanvas!;
  requestAnimationFrame((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    sparks = sparks.filter((s) => s.age < s.life);
    for (const s of sparks) {
      s.age += dt;
      s.vy += 220 * dt; // gentle gravity
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      ctx.globalAlpha = Math.max(0, 1 - s.age / s.life);
      ctx.fillStyle = s.color;
      star(ctx, s.x, s.y, s.size);
    }
    ctx.globalAlpha = 1;
    if (sparks.length) runSparks(now);
    else { running = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  });
}
