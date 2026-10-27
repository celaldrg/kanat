/**
 * Canvas renderer. Draws a getState() snapshot in world units (360 x 640) and
 * keeps only visual effects of its own: the plane's trail, the score pop and
 * the crash shake. Nothing touches the DOM at import time.
 */
import { paletteAt, css } from './palette.js';
import { obstacleRects } from './collision.js';
import { createRng } from './rng.js';
import { backingStore } from './viewport.js';

const TAU = Math.PI * 2;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const BLEED = 10;
const CAP_HEIGHT = 16;
const CAP_OVERHANG = 4;
const BLOCK_HEIGHT = 26;
const TRAIL_LENGTH = 18;
const SHAKE_MS = 320;
const FLASH_MS = 160;
const POP_MS = 220;
const HILLS = Object.freeze([
  Object.freeze({ color: 'hillFar', parallax: 0.18, base: 74, amp: 30, f1: 0.011, f2: 0.027, seed: 1.7 }),
  Object.freeze({ color: 'hillNear', parallax: 0.42, base: 30, amp: 20, f1: 0.016, f2: 0.041, seed: 4.2 }),
]);
const PLANE = Object.freeze({
  nose: [19, 1],
  wingTip: [-15, -11],
  fold: [-6, 2],
  keel: [-13, 10],
  crease: [-9, 6],
});

const mod = (value, n) => ((value % n) + n) % n;

function makeStars(world) {
  const rng = createRng(77);
  return Array.from({ length: 48 }, () => ({
    x: rng() * world.width,
    y: rng() * world.height * 0.6,
    r: 0.6 + rng() * 1.2,
    phase: rng() * TAU,
    speed: 1 + rng() * 2.5,
  }));
}

function makeClouds(world) {
  const rng = createRng(31);
  return Array.from({ length: 5 }, (_, i) => ({
    x: (i / 5) * (world.width + 180) + rng() * 40,
    y: 70 + rng() * 230,
    scale: 0.7 + rng() * 0.6,
    depth: 0.06 + rng() * 0.08,
  }));
}

function fillPolygon(ctx, points, color) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function drawSky(ctx, state, pal) {
  const sky = ctx.createLinearGradient(0, 0, 0, state.groundY);
  sky.addColorStop(0, css(pal.skyTop));
  sky.addColorStop(0.55, css(pal.skyMid));
  sky.addColorStop(1, css(pal.skyBottom));
  ctx.fillStyle = sky;
  ctx.fillRect(-BLEED, -BLEED, state.width + BLEED * 2, state.groundY + BLEED);
}

function drawStars(ctx, stars, state, pal, t) {
  const visible = Math.min(Math.max((state.sky - 0.35) / 0.5, 0), 1);
  if (visible <= 0) return;
  ctx.fillStyle = css(pal.star);
  for (const star of stars) {
    ctx.globalAlpha = visible * (0.55 + 0.45 * Math.sin(t * star.speed + star.phase));
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSun(ctx, state, pal) {
  const x = 272;
  const y = 172 + state.sky * 290;
  const glow = ctx.createRadialGradient(x, y, 10, x, y, 110);
  glow.addColorStop(0, css(pal.sun, 0.55));
  glow.addColorStop(1, css(pal.sun, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - 110, y - 110, 220, 220);
  ctx.fillStyle = css(pal.sun);
  ctx.beginPath();
  ctx.arc(x, y, 28, 0, TAU);
  ctx.fill();
}

function drawClouds(ctx, clouds, state, pal) {
  const span = state.width + 180;
  ctx.fillStyle = css(pal.cloud, 0.8 - state.sky * 0.25);
  for (const cloud of clouds) {
    const x = mod(cloud.x - state.distance * cloud.depth, span) - 90;
    const s = cloud.scale;
    ctx.beginPath();
    ctx.ellipse(x, cloud.y, 36 * s, 12 * s, 0, 0, TAU);
    for (const [dx, dy, r] of [[-16, -6, 14], [6, -13, 19], [26, -4, 12]]) {
      ctx.moveTo(x + (dx + r) * s, cloud.y + dy * s);
      ctx.arc(x + dx * s, cloud.y + dy * s, r * s, 0, TAU);
    }
    ctx.fill();
  }
}

function drawHills(ctx, state, pal, hill) {
  const offset = state.distance * hill.parallax;
  ctx.beginPath();
  ctx.moveTo(-BLEED, state.groundY);
  for (let x = -BLEED; x <= state.width + BLEED; x += 8) {
    const u = x + offset;
    const wave = 0.6 * Math.sin(u * hill.f1 + hill.seed) + 0.4 * Math.sin(u * hill.f2 + hill.seed * 2.3);
    ctx.lineTo(x, state.groundY - hill.base - hill.amp * wave);
  }
  ctx.lineTo(state.width + BLEED, state.groundY);
  ctx.closePath();
  ctx.fillStyle = css(pal[hill.color]);
  ctx.fill();
}

function drawMortar(ctx, rect, pal, capAtBottom, variant) {
  const edge = capAtBottom ? rect.y + rect.h - CAP_HEIGHT : rect.y + CAP_HEIGHT;
  const dir = capAtBottom ? -1 : 1;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.strokeStyle = css(pal.mortar, 0.45);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let row = 0; row * BLOCK_HEIGHT < rect.h; row++) {
    const y = edge + dir * row * BLOCK_HEIGHT;
    const seam = rect.x + rect.w * (row % 2 === 0 ? 0.3 + variant * 0.2 : 0.72 - variant * 0.2);
    ctx.moveTo(rect.x, y);
    ctx.lineTo(rect.x + rect.w, y);
    ctx.moveTo(seam, y);
    ctx.lineTo(seam, y + dir * BLOCK_HEIGHT);
  }
  ctx.stroke();
  ctx.restore();
}

function drawVine(ctx, rect, pal, variant, capAtBottom) {
  const length = capAtBottom ? rect.h - CAP_HEIGHT : Math.min(rect.h - CAP_HEIGHT, 50 + variant * 140);
  if (length < 24) return;
  const x0 = rect.x + rect.w * (0.24 + variant * 0.5);
  const start = capAtBottom ? rect.y : rect.y + rect.h;
  const dir = capAtBottom ? 1 : -1;
  const xAt = (d) => x0 + Math.sin(d * 0.06 + variant * 9) * 6;
  ctx.strokeStyle = css(pal.vine);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(xAt(0), start);
  for (let d = 4; d <= length; d += 4) ctx.lineTo(xAt(d), start + dir * d);
  ctx.stroke();
  ctx.fillStyle = css(pal.leaf);
  for (let d = 10, side = 1; d < length; d += 15, side = -side) {
    ctx.beginPath();
    ctx.ellipse(xAt(d) + side * 5, start + dir * d, 5, 2.6, side * 0.6, 0, TAU);
    ctx.fill();
  }
}

function drawCap(ctx, rect, pal, capAtBottom, glow) {
  const y = capAtBottom ? rect.y + rect.h - CAP_HEIGHT : rect.y;
  const x = rect.x - CAP_OVERHANG;
  const w = rect.w + CAP_OVERHANG * 2;
  const face = ctx.createLinearGradient(x, 0, x + w, 0);
  face.addColorStop(0, css(pal.stoneLight));
  face.addColorStop(1, css(pal.stoneMid));
  roundedRect(ctx, x, y, w, CAP_HEIGHT, 4);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.fillStyle = css(pal.stoneDark, 0.65);
  ctx.fillRect(x + 2, capAtBottom ? y + CAP_HEIGHT - 3 : y, w - 4, 3);
  const cx = rect.x + rect.w / 2;
  const cy = y + CAP_HEIGHT / 2;
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, 18);
  halo.addColorStop(0, css(pal.gem, glow));
  halo.addColorStop(1, css(pal.gem, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - 18, cy - 18, 36, 36);
  fillPolygon(ctx, [[cx, cy - 5], [cx + 4, cy], [cx, cy + 5], [cx - 4, cy]], css(pal.gem));
}

function drawColumn(ctx, rect, pal, variant, capAtBottom, glow) {
  if (rect.h <= 0) return;
  const body = ctx.createLinearGradient(rect.x, 0, rect.x + rect.w, 0);
  body.addColorStop(0, css(pal.stoneLight));
  body.addColorStop(0.45, css(pal.stoneMid));
  body.addColorStop(1, css(pal.stoneDark));
  ctx.fillStyle = body;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  drawMortar(ctx, rect, pal, capAtBottom, variant);
  drawVine(ctx, rect, pal, variant, capAtBottom);
  drawCap(ctx, rect, pal, capAtBottom, glow);
}

function drawGates(ctx, state, pal) {
  const glow = 0.25 + state.sky * 0.6;
  for (const gate of state.obstacles) {
    if (gate.x > state.width + CAP_OVERHANG || gate.x + gate.width < -CAP_OVERHANG) continue;
    const [upper, lower] = obstacleRects(gate, state.groundY);
    drawColumn(ctx, upper, pal, gate.variant, true, glow);
    drawColumn(ctx, lower, pal, gate.variant, false, glow);
  }
}

function drawGround(ctx, state, pal) {
  const top = state.groundY;
  const left = -BLEED;
  const width = state.width + BLEED * 2;
  ctx.fillStyle = css(pal.ground);
  ctx.fillRect(left, top, width, state.height - top + BLEED);
  const stripe = mod(state.distance, 28);
  ctx.beginPath();
  for (let x = left - stripe; x < state.width + 28; x += 28) {
    ctx.moveTo(x, top + 14);
    ctx.lineTo(x + 14, top + 14);
    ctx.lineTo(x + 2, state.height + BLEED);
    ctx.lineTo(x - 12, state.height + BLEED);
    ctx.closePath();
  }
  ctx.fillStyle = css(pal.groundDark);
  ctx.fill();
  ctx.fillStyle = css(pal.moss);
  ctx.fillRect(left, top, width, 12);
  ctx.fillStyle = css(pal.groundDark, 0.6);
  ctx.fillRect(left, top + 12, width, 3);
  const tuft = mod(state.distance, 36);
  ctx.beginPath();
  for (let x = left - tuft; x < state.width + 36; x += 36) {
    ctx.moveTo(x, top + 1);
    ctx.lineTo(x + 4, top - 6);
    ctx.lineTo(x + 8, top + 1);
    ctx.moveTo(x + 7, top + 1);
    ctx.lineTo(x + 11, top - 4);
    ctx.lineTo(x + 14, top + 1);
  }
  ctx.fillStyle = css(pal.moss);
  ctx.fill();
  ctx.fillStyle = css(pal.mossLight);
  ctx.fillRect(left, top, width, 3);
}

function drawTrail(ctx, trail) {
  trail.forEach((point, i) => {
    const k = (i + 1) / trail.length;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * k})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 1 + 1.8 * k, 0, TAU);
    ctx.fill();
  });
}

function drawPlane(ctx, player, flutter) {
  const { nose, fold, keel, crease } = PLANE;
  const wingTip = [PLANE.wingTip[0], PLANE.wingTip[1] - flutter];
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.rotation);
  ctx.shadowColor = 'rgba(15, 23, 42, 0.3)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  fillPolygon(ctx, [nose, keel, fold, wingTip], '#ffffff');
  ctx.shadowColor = 'transparent';
  fillPolygon(ctx, [nose, fold, keel], '#ddd4fd');
  fillPolygon(ctx, [nose, fold, crease], '#b9a7f5');
  ctx.strokeStyle = '#3b2a73';
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(...nose);
  ctx.lineTo(...wingTip);
  ctx.lineTo(...fold);
  ctx.lineTo(...keel);
  ctx.closePath();
  ctx.moveTo(...nose);
  ctx.lineTo(...fold);
  ctx.stroke();
  ctx.restore();
}

function drawScore(ctx, state, scale) {
  const text = String(state.score);
  ctx.save();
  ctx.translate(state.width / 2, 80);
  ctx.scale(scale, scale);
  ctx.font = `800 52px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(30, 27, 75, 0.55)';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function updateTrail(fx, state) {
  const moved = state.distance - fx.lastDistance;
  fx.lastDistance = state.distance;
  if (moved < 0 || moved > 120) fx.trail.length = 0;
  if (moved <= 0 || state.phase === 'over') return;
  for (const point of fx.trail) point.x -= moved;
  const { x, y, rotation } = state.player;
  fx.trail.push({ x: x - 13 * Math.cos(rotation), y: y - 13 * Math.sin(rotation) + 3 });
  if (fx.trail.length > TRAIL_LENGTH) fx.trail.shift();
}

function updateScorePop(fx, state, now) {
  if (fx.lastScore !== null && state.score > fx.lastScore) fx.popAt = now;
  fx.lastScore = state.score;
}

/**
 * Create a renderer bound to a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{ world: { width: number, height: number }, reducedMotion?: () => boolean }} options
 * @returns {{ resize(cssWidth: number, cssHeight: number, pixelRatio: number): void, crash(now: number): void, draw(state: object, now: number): void }}
 */
export function createRenderer(canvas, { world, reducedMotion = () => false }) {
  const ctx = canvas.getContext('2d');
  const stars = makeStars(world);
  const clouds = makeClouds(world);
  const fx = { trail: [], lastDistance: 0, lastScore: null, popAt: -Infinity, crashAt: -Infinity };
  let scale = { scaleX: 1, scaleY: 1 };

  function shakeOffset(now) {
    const k = 1 - (now - fx.crashAt) / SHAKE_MS;
    if (k <= 0 || reducedMotion()) return [0, 0];
    return [Math.sin(now * 0.09) * 6 * k, Math.cos(now * 0.11) * 4 * k];
  }

  function drawFlash(state, now) {
    const k = 1 - (now - fx.crashAt) / FLASH_MS;
    if (k <= 0 || reducedMotion()) return;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 * k})`;
    ctx.fillRect(-BLEED, -BLEED, state.width + BLEED * 2, state.height + BLEED * 2);
  }

  return {
    /** Match the backing store to the displayed size and pixel ratio. */
    resize(cssWidth, cssHeight, pixelRatio) {
      const store = backingStore(cssWidth, cssHeight, pixelRatio, world);
      canvas.width = store.width;
      canvas.height = store.height;
      scale = store;
    },

    /** Start the crash shake and flash (skipped with reduced motion). */
    crash(now) {
      fx.crashAt = now;
    },

    /** Draw one frame. `now` is a timestamp in milliseconds. */
    draw(state, now) {
      const still = reducedMotion();
      const t = still ? 0 : now / 1000;
      const pal = paletteAt(state.sky);
      updateTrail(fx, state);
      updateScorePop(fx, state, now);
      const [dx, dy] = shakeOffset(now);
      ctx.setTransform(scale.scaleX, 0, 0, scale.scaleY, dx * scale.scaleX, dy * scale.scaleY);
      drawSky(ctx, state, pal);
      drawStars(ctx, stars, state, pal, t);
      drawSun(ctx, state, pal);
      drawClouds(ctx, clouds, state, pal);
      for (const hill of HILLS) drawHills(ctx, state, pal, hill);
      drawGates(ctx, state, pal);
      drawGround(ctx, state, pal);
      drawTrail(ctx, fx.trail);
      drawPlane(ctx, state.player, still || state.phase === 'over' ? 0 : Math.sin(t * 18) * 0.9);
      if (state.phase === 'playing' || state.phase === 'paused') {
        const pop = still ? 0 : Math.max(0, 1 - (now - fx.popAt) / POP_MS);
        drawScore(ctx, state, 1 + 0.22 * pop);
      }
      drawFlash(state, now);
    },
  };
}
