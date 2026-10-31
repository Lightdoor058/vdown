// Partiklar: rök, eld, gnistor, slem. En pool av sprites som återanvänds.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { V3, rand, pick, softTex } from '../core/utils.js';

const POOL = 500;
const pool = [];
let idx = 0, inited = false;
const ZERO = new V3();

function init() {
  inited = true;
  for (let i = 0; i < POOL; i++) {
    const m = new THREE.SpriteMaterial({ map: softTex(), transparent: true, depthWrite: false });
    const s = new THREE.Sprite(m);
    s.visible = false;
    scene.add(s);
    pool.push({ s, vel: new V3(), age: 0, life: 1, alive: false, size: 1, grow: 0, op: 1, grav: 0, drag: 0 });
  }
}

export function emit(o) {
  if (!inited) init();
  const p = pool[idx]; idx = (idx + 1) % POOL;
  p.alive = true; p.age = 0; p.life = o.life; p.size = o.size; p.grow = o.grow || 0;
  p.op = o.op ?? 1; p.grav = o.grav || 0; p.drag = o.drag || 0;
  p.vel.copy(o.vel || ZERO);
  p.s.position.copy(o.pos);
  const m = p.s.material;
  m.color.set(o.color);
  if (o.hdr) m.color.multiplyScalar(o.hdr);
  m.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
  m.rotation = rand(0, 6.28);
  m.opacity = 0;
  p.s.renderOrder = o.add ? 5 : 4;
  p.s.scale.setScalar(o.size);
  p.s.visible = true;
}

const rv = (a) => new V3(rand(-a, a), rand(-a, a), rand(-a, a));
export const FX = {
  smoke(pos, s = 1) { emit({ pos, vel: new V3(rand(-0.3, 0.3), rand(1, 2) * s, rand(-0.3, 0.3)), life: rand(3, 5), size: rand(0.6, 1) * s, grow: 0.9 * s, op: 0.45, color: 0x2a2420, drag: 0.2 }); },
  fire(pos, s = 1) {
    emit({ pos: pos.clone().add(new V3(rand(-0.3, 0.3) * s, 0, rand(-0.3, 0.3) * s)), vel: new V3(rand(-0.2, 0.2), rand(1.5, 2.8), rand(-0.2, 0.2)),
      life: rand(0.4, 0.8), size: rand(0.4, 0.8) * s, grow: -0.3, op: 0.9, color: pick([0xff7a20, 0xffa040, 0xff5010]), hdr: 3, add: true });
  },
  spark(pos) { emit({ pos: pos.clone(), vel: new V3(rand(-4, 4), rand(1, 5), rand(-4, 4)), life: rand(0.3, 0.7), size: 0.07, color: 0xffc070, hdr: 6, add: true, grav: -12 }); },
  goo(pos) { emit({ pos: pos.clone(), vel: rv(3), life: 0.7, size: 0.16, color: 0x40ffb0, hdr: 2, add: true, grav: -9 }); },
  dust(pos) { emit({ pos: pos.clone(), vel: new V3(rand(-1, 1), rand(0.2, 1), rand(-1, 1)), life: rand(1, 2), size: 0.5, grow: 1.2, op: 0.35, color: 0xb87a55, drag: 1 }); },
  ember(pos) { emit({ pos: pos.clone(), vel: new V3(rand(-0.4, 0.4), rand(0.6, 1.6), rand(-0.4, 0.4)), life: rand(1, 2), size: 0.05, color: 0xff8030, hdr: 5, add: true }); },
  trail(pos) { emit({ pos: pos.clone(), vel: rv(0.5), life: rand(0.5, 1.2), size: rand(1.5, 3), grow: 1, op: 0.8, color: pick([0xff7a20, 0xffb050]), hdr: 2.5, add: true }); },
};
export function burst(pos, kind, n) { for (let i = 0; i < n; i++) FX[kind](pos); }

// Emittrar = små funktioner som spottar ut partiklar i en viss takt.
export const emitters = new Set();
export function addEmitter(rate, fn, active = () => true) {
  let acc = 0;
  const e = (dt) => { if (!active()) return; acc += dt * rate; while (acc >= 1) { acc--; fn(); } };
  emitters.add(e);
  return e;
}

export function updateParticles(dt) {
  for (const p of pool) {
    if (!p.alive) continue;
    p.age += dt;
    if (p.age >= p.life) { p.alive = false; p.s.visible = false; continue; }
    p.vel.y += p.grav * dt;
    if (p.drag) p.vel.multiplyScalar(Math.exp(-p.drag * dt));
    p.s.position.addScaledVector(p.vel, dt);
    const t = p.age / p.life;
    p.s.material.opacity = p.op * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88);
    p.s.scale.setScalar(Math.max(0.01, p.size + p.grow * p.age));
  }
  for (const e of emitters) e(dt);
}
