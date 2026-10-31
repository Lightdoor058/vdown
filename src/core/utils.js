// Små hjälpfunktioner: matte, texturer, brus och ett tween-system för mellansekvenser.
import * as THREE from 'three';

export const V3 = THREE.Vector3;
export const $ = (id) => document.getElementById(id);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const ease = {
  lin: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

// ---------- texturer ritade med canvas ----------
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

let _soft = null;
export function softTex() {
  if (!_soft) {
    _soft = canvasTex(64, 64, (x) => {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    });
  }
  return _soft;
}

export function textTex(lines, { w = 512, h = 256, bg = '#06121c', fg = '#5ee6ff', size = 28, font = 'monospace', align = 'left' } = {}) {
  return canvasTex(w, h, (x) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = fg; x.font = `bold ${size}px ${font}`; x.textAlign = align;
    const px = align === 'center' ? w / 2 : 18;
    lines.forEach((l, i) => x.fillText(l, px, size + 14 + i * (size + 8)));
  });
}

// ---------- brus ----------
export function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

// ---------- tween-system (används av mellansekvenserna) ----------
export const cine = { skipping: false };
export const SKIP = { skip: true };
const tweens = [];
export const hooks = new Set(); // funktioner (dt) som körs varje bildruta

export function tween(dur, fn, e = ease.inOut) {
  return new Promise((res) => tweens.push({ t: 0, dur: Math.max(dur, 0.0001), fn, e, res }));
}
export function updateTweens(dt) {
  if (cine.skipping) { while (tweens.length) tweens.pop().res(); return; }
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.e(k), k);
    if (k >= 1) { tweens.splice(tweens.indexOf(tw), 1); tw.res(); }
  }
}
export function chk() { if (cine.skipping) throw SKIP; }
export async function wait(s) { await tween(s, () => {}, ease.lin); chk(); }
export async function anim(s, fn, e = ease.inOut) { await tween(s, fn, e); chk(); }
