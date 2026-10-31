// Föremål med fysik: kan greppas, kastas, släppas, läggas i ryggsäcken och användas.
import * as THREE from 'three';
import { scene, camera } from '../core/render.js';
import { V3, clamp, rand, canvasTex } from '../core/utils.js';
import { colliders, groundH } from '../systems/physics.js';
import { SFX } from '../core/audio.js';
import { cloneAsset, fitModel } from '../core/assets.js';
import { P, S, F } from '../game/state.js';
import { creatures } from './creatures.js';
import * as UI from '../ui/ui.js';
import { LORE, noteDoc } from '../game/story.js';
import { onCellCollected, onPickup } from '../game/objectives.js';
import { setEquipped } from '../game/player.js';
import { INV, invAdd } from '../game/inventory.js';
import { burst } from '../systems/particles.js';

export const items = [];
export const hold = { item: null };
export const HEAT = [];   // värmekällor { pos: Vector3, r }

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.2, ...o });
const glow = (c, i = 2.5) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i });
const cyl = (rt, rb, h, m, seg = 12) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const grp = (...ch) => { const g = new THREE.Group(); ch.forEach((c) => g.add(c)); return g; };
const at = (m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; };

// Plasmapistolen (din modell). Mynningen pekar mot -Z.
export function makePistolMesh() {
  const obj = cloneAsset('plasma');
  obj.rotation.y = -Math.PI / 2;
  const inner = new THREE.Group(); inner.add(obj);
  return fitModel(inner, 0.36);
}
function medkitMesh() { return fitModel(cloneAsset('medkit'), 0.34); }

export function makeNoteMesh() {
  const paper = canvasTex(256, 360, (x, w, h) => {
    x.fillStyle = '#e8d6b0'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(120,80,30,0.08)';
    for (let i = 0; i < 18; i++) x.fillRect(rand(0, w), rand(0, h), rand(20, 80), rand(4, 14));
    x.strokeStyle = '#6a4a28'; x.lineWidth = 6; x.strokeRect(10, 10, w - 20, h - 20);
    x.fillStyle = '#3a2a14'; x.font = 'bold 22px Arial'; x.fillText('NAV START', 28, 52);
    x.font = '16px Arial'; x.fillStyle = '#5a4030';
    x.fillText('SV-7  ·  7-C', 28, 80);
    x.strokeStyle = '#8a6a40'; x.beginPath(); x.moveTo(28, 94); x.lineTo(w - 28, 94); x.stroke();
    x.font = 'bold 20px Arial';
    ['1.  ____', '2.  ____', '3.  ____', '4.  ____'].forEach((t, i) => x.fillText(t, 36, 140 + i * 36));
    x.font = '14px Arial'; x.fillText('— Mikko', 28, h - 36);
  });
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.004, 0.2), new THREE.MeshStandardMaterial({ map: paper, roughness: 0.85, metalness: 0 }));
  const fold = at(box(0.14, 0.003, 0.04, mat(0xd4c094, { roughness: 0.9 })), 0, 0.003, -0.08, 0.15, 0, 0);
  return grp(sheet, fold);
}

const food = (n, msg) => () => { P.food = Math.min(100, P.food + n); UI.toast(msg || `+${n} MAT`, 'good'); return true; };

// Alla föremål. icon = symbol i ryggsäcken. use() returnerar true om föremålet förbrukas.
export const IDEF = {
  o2: { name: 'Syretub', icon: '🫧', r: 0.16, mass: 1.4, metal: true, desc: '+45 syre',
    build() { return grp(cyl(0.09, 0.09, 0.42, mat(0x2f7fd6, { metalness: 0.5, roughness: 0.3 })), at(cyl(0.05, 0.05, 0.08, mat(0x888888, { metalness: 0.8 })), 0, 0.25, 0), at(cyl(0.095, 0.095, 0.05, mat(0xffffff)), 0, 0.08, 0)); },
    use() { if (P.o2 > 98) { UI.toast('Syret är redan fullt.'); return false; } P.o2 = Math.min(100, P.o2 + 45); UI.toast('+45 SYRE', 'good'); SFX.hiss(); return true; } },
  food: { name: 'Matranson', icon: '🥫', r: 0.13, mass: 0.6, desc: '+40 mat',
    build() { return grp(box(0.28, 0.08, 0.2, mat(0xe08a2a)), box(0.2, 0.082, 0.08, mat(0xffffff))); }, use: food(40) },
  meatballs: { name: 'Frystorkade köttbullar', icon: '🍖', r: 0.12, mass: 0.5, desc: 'Mikkos favorit. +30 mat',
    build() { return grp(cyl(0.09, 0.09, 0.14, mat(0xb03a2a)), cyl(0.092, 0.092, 0.06, mat(0xf0e0b0))); }, use: food(30, '+30 MAT  (Mikkos köttbullar...)') },
  juice: { name: 'Juicepåse', icon: '🧃', r: 0.09, mass: 0.3, desc: '+15 mat, +8 hälsa',
    build() { return grp(box(0.12, 0.18, 0.05, mat(0x4fbf4f))); },
    use() { P.food = Math.min(100, P.food + 15); P.hp = Math.min(100, P.hp + 8); UI.toast('+15 MAT  +8 HÄLSA', 'good'); return true; } },
  med: { name: 'Medkit', icon: '⛑️', r: 0.17, mass: 0.9, desc: '+45 hälsa, tar bort gift',
    build: medkitMesh,
    use() { if (P.hp > 98 && P.venom <= 0) { UI.toast('Du är inte skadad.'); return false; } P.hp = Math.min(100, P.hp + 45); P.venom = 0; UI.toast('+45 HÄLSA', 'good'); return true; } },
  ammo: { name: 'Plasmacell', icon: '🔋', r: 0.1, mass: 0.5, metal: true, instant: true,
    build() { return grp(box(0.16, 0.12, 0.12, mat(0x333840, { metalness: 0.6 })), box(0.1, 0.13, 0.05, glow(0xffd23d, 2.5))); },
    use() { P.ammo += 12; UI.toast('+12 PLASMA', 'good'); return true; } },
  cell: { name: 'Energicell', icon: '⚡', r: 0.17, mass: 3, metal: true, instant: true,
    build() { const g = grp(cyl(0.12, 0.12, 0.42, mat(0x22262c, { metalness: 0.7, roughness: 0.3 })), cyl(0.09, 0.09, 0.3, glow(0x5dff8a, 3.5))); for (const y of [-0.2, 0.2]) g.add(at(cyl(0.13, 0.13, 0.04, mat(0x888888, { metalness: 0.9 })), 0, y, 0)); return g; },
    use() { P.cells++; onCellCollected(); return true; } },
  pistol: { name: 'Plasmapistol', icon: '🔫', r: 0.18, mass: 1.2, metal: true, instant: true,
    build: makePistolMesh,
    use() { P.hasPistol = true; P.ammo += 18; setEquipped(true); UI.toast('PLASMAPISTOL! [Q] = dra/hölstra · vänsterklick = skjut', 'good'); return true; } },
  rock: { name: 'Sten', icon: '🪨', r: 0.17, mass: 2.2, desc: 'Bra att kasta. Behövs till lägereld.',
    build() { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), mat(0x6b4a3a, { roughness: 0.95, flatShading: true })); m.scale.set(1, 0.8, 1.1); return grp(m); } },
  cup: { name: 'Kaffemugg', icon: '☕', r: 0.07, mass: 0.3, metal: true, junk: true, build() { return grp(cyl(0.05, 0.045, 0.1, mat(0xdddddd))); } },
  junk: { name: 'Skrot', icon: '🔩', r: 0.12, mass: 0.8, metal: true, junk: true, build() { return grp(at(box(0.22, 0.03, 0.15, mat(0x8a9099, { metalness: 0.7 })), 0, 0, 0, 0.3, 0.5, 0.2)); } },
  pad: { name: 'Datapad', icon: '📟', r: 0.13, mass: 0.4, read: true,
    build() { return grp(box(0.24, 0.02, 0.17, mat(0x1a1d22)), box(0.2, 0.022, 0.13, glow(0x40c8ff, 1.6))); },
    use(it) { UI.openReader(LORE[it.extra.lore]); return false; } },
  note: { name: 'Startrutin', icon: '📝', r: 0.1, mass: 0.08, desc: 'Mikkos lapp med nav-kalibreringen. [TAB] läs.',
    build: makeNoteMesh,
    use(it) { UI.openReader(noteDoc(it?.extra || {})); return false; } },
  backpack: { name: 'Ryggsäck', icon: '🎒', r: 0.25, mass: 1.5, special: true,
    build() { return grp(box(0.4, 0.5, 0.22, mat(0xc0541e, { roughness: 0.8 })), at(box(0.3, 0.2, 0.06, mat(0x7a3412)), 0, -0.05, 0.13)); } },
  key: { name: 'Rovernyckel', icon: '🔑', r: 0.06, mass: 0.1, metal: true, desc: 'Startar rovern.',
    build() { return grp(at(box(0.03, 0.01, 0.12, mat(0xd0b040, { metalness: 0.9 })), 0, 0, 0.04), box(0.07, 0.015, 0.05, mat(0x202020))); } },
  wheel: { name: 'Roverhjul', icon: '🛞', r: 0.32, mass: 4, desc: 'Monteras på rovern.',
    build() { const t = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.1, 10, 20), mat(0x1b1b1b, { roughness: 0.9 })); const h = cyl(0.13, 0.13, 0.16, mat(0xaaaaaa, { metalness: 0.8 })); h.rotation.x = Math.PI / 2; return grp(t, h); } },
  shovel: { name: 'Spade', icon: '⛏️', r: 0.2, mass: 1.8, metal: true, desc: 'Gräv med spaden.',
    build() { return grp(at(cyl(0.02, 0.02, 0.9, mat(0x6a4a2a)), 0, 0, 0, 0, 0, Math.PI / 2), at(box(0.22, 0.02, 0.28, mat(0x8a9099, { metalness: 0.8 })), 0.55, 0, 0)); } },
  toolkit: { name: 'Verktygslåda', icon: '🧰', r: 0.2, mass: 2, metal: true, desc: 'Behövs för att laga saker.',
    build() { return grp(box(0.4, 0.18, 0.18, mat(0xd02020)), at(box(0.2, 0.04, 0.04, mat(0x222222)), 0, 0.12, 0)); } },
  tranq: { name: 'Bedövningsspruta', icon: '💉', r: 0.08, mass: 0.2, desc: 'Gå nära en spindel och tryck E.',
    build() { return grp(at(cyl(0.02, 0.02, 0.16, glow(0x5ab8ff, 1.2)), 0, 0, 0, 0, 0, Math.PI / 2), at(cyl(0.004, 0.004, 0.06, mat(0xcccccc)), 0.11, 0, 0, 0, 0, Math.PI / 2)); } },
  syringe: { name: 'Tom spruta', icon: '🧪', r: 0.08, mass: 0.2, desc: 'För blodprov.',
    build() { return grp(at(cyl(0.02, 0.02, 0.16, mat(0xddeeff, { transparent: true, opacity: 0.6 })), 0, 0, 0, 0, 0, Math.PI / 2)); } },
  blood: { name: 'Blodprov (spindel)', icon: '🩸', r: 0.08, mass: 0.2, desc: 'Analysera i labbet.',
    build() { return grp(at(cyl(0.02, 0.02, 0.16, glow(0x40ff90, 1.5)), 0, 0, 0, 0, 0, Math.PI / 2)); } },
  sample: { name: 'Analyserat prov', icon: '🧬', r: 0.08, mass: 0.2, desc: 'Ingrediens till antigift.', build() { return grp(cyl(0.03, 0.03, 0.1, glow(0x40ff90, 2))); } },
  crystal: { name: 'Kristallprov', icon: '💎', r: 0.1, mass: 0.4, desc: 'Ingrediens till antigift.',
    build() { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), glow(0x2fffd0, 1.8)); m.scale.y = 1.8; return grp(m); } },
  antivenom: { name: 'Antigift', icon: '💚', r: 0.08, mass: 0.2, desc: 'Skyddar mot spindelbett.',
    build() { return grp(cyl(0.03, 0.03, 0.12, glow(0x5dff5d, 2.5))); },
    use() { P.antivenom = true; P.venom = 0; F.antivenom = true; UI.toast('ANTIGIFT INJICERAT — spindelbett gör nu mycket mindre skada', 'good'); SFX.hiss(); return true; } },
  microscope: { name: 'Mikroskop', icon: '🔬', r: 0.2, mass: 2, desc: 'Monteras i labbet.',
    build() { return grp(box(0.2, 0.04, 0.24, mat(0x222222)), at(box(0.05, 0.3, 0.05, mat(0xeeeeee)), 0, 0.16, -0.08), at(cyl(0.03, 0.035, 0.2, mat(0xeeeeee)), 0, 0.28, -0.02, 0.4)); } },
  analyzer: { name: 'Analysator', icon: '📠', r: 0.25, mass: 3, desc: 'Monteras i labbet.',
    build() { return grp(box(0.45, 0.28, 0.35, mat(0xb7bcc4, { metalness: 0.4 })), at(box(0.28, 0.12, 0.01, glow(0x40ffb0, 1.5)), 0, 0.03, 0.18)); } },
  part_circuit: { name: 'Plasmakrets', icon: '🟦', r: 0.1, mass: 0.3, desc: 'Reservdel till plasmapistolen.', build() { return grp(box(0.16, 0.02, 0.1, glow(0x2a8aff, 1.2)), at(box(0.04, 0.03, 0.04, mat(0xd0b040)), 0.04, 0.02, 0)); } },
  part_lens: { name: 'Fokuslins', icon: '🔵', r: 0.08, mass: 0.2, desc: 'Reservdel till plasmapistolen.', build() { return grp(at(cyl(0.06, 0.06, 0.02, mat(0x88ddff, { transparent: true, opacity: 0.7, metalness: 0.1, roughness: 0.05 })), 0, 0, 0, Math.PI / 2)); } },
  part_cooler: { name: 'Kylcell', icon: '❄️', r: 0.1, mass: 0.4, desc: 'Reservdel till plasmapistolen.', build() { return grp(cyl(0.05, 0.05, 0.14, glow(0x9fe8ff, 1.2))); } },
  transmitter: { name: 'Sändarmodul', icon: '📡', r: 0.22, mass: 2.5, desc: 'Monteras i Fyren.',
    build() { return grp(box(0.36, 0.2, 0.26, mat(0x3a3e46, { metalness: 0.6 })), at(cyl(0.01, 0.01, 0.3, mat(0xcccccc)), 0.12, 0.25, 0), at(box(0.2, 0.05, 0.01, glow(0xffcf3a, 2)), 0, 0.03, 0.14)); } },
  critter_dead: { name: 'Död critter', icon: '🐾', r: 0.14, mass: 0.6, desc: 'Lägg den över något varmt för att grilla den. Eller skjut den.',
    build() { return makeCritterMesh(true); } },
  critter_cooked: { name: 'Grillad critter', icon: '🍗', r: 0.14, mass: 0.5, desc: '+45 mat',
    build() { const g = makeCritterMesh(true); g.traverse((o) => { if (o.isMesh && o.material.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.35).add(new THREE.Color(0x3a1a08)); } }); return g; }, use: food(45, '+45 MAT  (smakar... kyckling?)') },
  meat: { name: 'Rått kött', icon: '🥩', r: 0.1, mass: 0.3, desc: '+15 mat', build() { return grp(box(0.14, 0.05, 0.1, mat(0xa02a3a))); }, use: food(15) },
  meatfine: { name: 'Kött', icon: '🥩', r: 0.11, mass: 0.4, desc: '+30 mat', build() { return grp(box(0.18, 0.06, 0.12, mat(0xb84a3a))); }, use: food(30) },
};

// Små critters (används även av critters.js)
const furMat = new THREE.MeshStandardMaterial({ color: 0x8a6ab0, roughness: 0.9 });
export function makeCritterMesh(dead = false) {
  const g = new THREE.Group();
  const fur = dead ? furMat.clone() : furMat;
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), fur); body.scale.set(1, 0.8, 1.3); g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), fur); head.position.set(0, 0.06, 0.15); g.add(head);
  const eyeM = new THREE.MeshStandardMaterial({ color: dead ? 0x222222 : 0x111111, emissive: dead ? 0x000000 : 0xffd23d, emissiveIntensity: dead ? 0 : 1.5 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), eyeM); e.position.set(s * 0.045, 0.1, 0.21); g.add(e);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 6), fur); ear.position.set(s * 0.05, 0.16, 0.12); ear.rotation.z = -s * 0.4; g.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.18, 6), fur); tail.position.set(0, 0.03, -0.2); tail.rotation.x = -1.2; g.add(tail);
  g.userData.head = head;
  if (dead) g.rotation.z = Math.PI / 2;
  return g;
}

const hitGeo = new THREE.SphereGeometry(1, 8, 6);
const hitMat = new THREE.MeshBasicMaterial();
export class Item {
  constructor(type, pos, extra = {}) {
    this.type = type; this.def = IDEF[type]; this.extra = extra;
    this.mesh = this.def.build(extra);
    const hit = new THREE.Mesh(hitGeo, hitMat); hit.scale.setScalar(Math.max(0.12, this.def.r)); hit.visible = false;
    this.mesh.add(hit);
    this.mesh.position.copy(pos);
    this.mesh.rotation.y = Math.random() * 6;
    this.pos = this.mesh.position;
    this.vel = new V3(); this.av = new V3();
    this.r = this.def.r; this.mass = this.def.mass;
    this.lastSnd = 0; this.heat = 0;
    this.mesh.traverse((o) => { o.userData.item = this; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(this.mesh);
    items.push(this);
  }
  remove() {
    scene.remove(this.mesh);
    const i = items.indexOf(this); if (i >= 0) items.splice(i, 1);
    if (hold.item === this) hold.item = null;
  }
}

// Byt ett föremål mot ett annat på samma plats (t.ex. grillad critter)
export function transformItem(it, type) {
  const n = new Item(type, it.pos.clone());
  n.vel.copy(it.vel);
  it.remove();
  return n;
}

export function grabItem(it) {
  hold.item = it; SFX.grab();
  UI.tip('throw', 'Du håller föremålet. HÖGERKLICKA = kasta · släpp musknappen = släpp · F = lägg i ryggsäcken');
}
export function dropHeld() { hold.item = null; }
export function throwHeld(dir) {
  const it = hold.item; if (!it) return;
  hold.item = null;
  it.vel.copy(dir).multiplyScalar(16 / Math.sqrt(it.mass)).addScaledVector(P.vel, 0.5);
  it.vel.y += 1.5;
  it.av.set(rand(-10, 10), rand(-10, 10), rand(-10, 10));
  SFX.whoosh();
}

// F: ta upp föremålet (i ryggsäcken om man har den)
export function pickUp(it) {
  const d = it.def;
  if (d.read) { d.use(it); return; }
  if (it.type === 'note') {
    if (F.backpack && !invAdd('note', it.extra)) { UI.toast('Ryggsäcken är full!', 'bad'); return; }
    SFX.pickup(); UI.openReader(noteDoc(it.extra)); it.remove(); onPickup('note'); return;
  }
  if (d.special && it.type === 'backpack') {
    F.backpack = true; SFX.pickup(); it.remove();
    UI.toast('RYGGSÄCK! Tryck [TAB] för att öppna den.', 'good');
    onPickup('backpack');
    return;
  }
  if (d.instant) { if (d.use(it)) { SFX.pickup(); it.remove(); onPickup(it.type); } return; }
  if (!F.backpack) {
    if (d.use) { if (d.use(it)) { SFX.pickup(); it.remove(); } return; }
    UI.toast('Du har ingen ryggsäck att lägga den i.'); return;
  }
  if (d.junk) { UI.toast(`${d.name}: skräp. Men den går att kasta!`); return; }
  if (!invAdd(it.type, it.extra)) { UI.toast('Ryggsäcken är full!', 'bad'); return; }
  SFX.pickup(); it.remove();
  UI.toast(`+ ${d.icon} ${d.name}`, 'good');
  onPickup(it.type);
}

export function useItem(it) { pickUp(it); }

// ---------- fysik ----------
const GRAV = -11;
const _q = new V3(), _n = new V3(), _d = new V3(), _tgt = new V3(), _cam = new V3(), _cp = new V3();

export function updateItems(dt) {
  camera.getWorldDirection(_cam);
  const camPos = camera.getWorldPosition(new V3());
  for (let ii = items.length - 1; ii >= 0; ii--) {
    const it = items[ii];
    const p = it.pos, v = it.vel;
    if (it === hold.item) {
      _tgt.copy(camPos).addScaledVector(_cam, 1.5);
      _d.subVectors(_tgt, p);
      if (_d.length() > 2.8) hold.item = null;
      else { v.copy(_d).multiplyScalar(14); if (v.length() > 20) v.setLength(20); }
      it.av.multiplyScalar(0.9);
    } else v.y += GRAV * dt;

    p.addScaledVector(v, dt);
    let impact = 0, grounded = false;

    const th = groundH(p.x, p.z);
    if (p.y - it.r < th) {
      p.y = th + it.r;
      if (v.y < 0) { impact = Math.max(impact, -v.y); v.y = -v.y > 1.5 ? -v.y * 0.35 : 0; }
      grounded = true;
    }
    for (const c of colliders) {
      if (!c.on) continue;
      const b = c.box;
      if (p.x + it.r < b.min.x || p.x - it.r > b.max.x || p.y + it.r < b.min.y || p.y - it.r > b.max.y || p.z + it.r < b.min.z || p.z - it.r > b.max.z) continue;
      _q.set(clamp(p.x, b.min.x, b.max.x), clamp(p.y, b.min.y, b.max.y), clamp(p.z, b.min.z, b.max.z));
      _n.subVectors(p, _q);
      const dist = _n.length();
      if (dist >= it.r) continue;
      if (dist < 1e-5) { _n.set(0, 1, 0); p.y = b.max.y + it.r; }
      else { _n.divideScalar(dist); p.addScaledVector(_n, it.r - dist); }
      const vn = v.dot(_n);
      if (vn < 0) { impact = Math.max(impact, -vn); v.addScaledVector(_n, -vn * (-vn > 1.5 ? 1.35 : 1)); }
      if (_n.y > 0.6) grounded = true;
    }
    if (grounded) {
      const f = Math.exp(-5 * dt);
      v.x *= f; v.z *= f;
      it.av.multiplyScalar(Math.exp(-4 * dt));
      if (v.lengthSq() < 0.01 && it !== hold.item) v.set(0, 0, 0);
    }
    if (impact > 2.2 && S.time - it.lastSnd > 0.15) {
      it.lastSnd = S.time;
      const dv = clamp(1 - camPos.distanceTo(p) / 30, 0, 1);
      const vol = clamp(impact * 0.06, 0.05, 0.5) * dv;
      if (vol > 0.01) (it.def.metal ? SFX.clink : SFX.thud)(vol);
    }
    it.mesh.rotation.x += it.av.x * dt; it.mesh.rotation.y += it.av.y * dt; it.mesh.rotation.z += it.av.z * dt;

    // grilla döda critters över värme
    if (it.type === 'critter_dead') {
      let hot = false;
      for (const h of HEAT) if (h.pos.distanceTo(p) < (h.r || 1.4)) hot = true;
      if (hot) {
        it.heat += dt;
        if (Math.random() < dt * 8) burst(p.clone().add(new V3(0, 0.15, 0)), 'smoke', 1);
        if (Math.random() < dt * 3) SFX.sizzle();
        if (it.heat > 5) { transformItem(it, 'critter_cooked'); UI.toast('Crittern är grillad! 🍗', 'good'); SFX.pickup(); continue; }
      }
    }

    if (it !== hold.item) {
      const sp = v.length();
      if (sp > 5) for (const cr of creatures) {
        if (cr.dead) continue;
        _cp.copy(cr.pos); _cp.y += 0.5;
        if (_cp.distanceTo(p) < it.r + 0.9) {
          cr.damage(sp * it.mass * 3.5, v.clone().normalize());
          v.multiplyScalar(-0.3);
          break;
        }
      }
    }
    if (it !== hold.item && !P.rover && p.y > P.pos.y - 0.1 && p.y < P.pos.y + 1.8) {
      const dx = p.x - P.pos.x, dz = p.z - P.pos.z, d = Math.hypot(dx, dz), min = 0.35 + it.r;
      if (d < min && d > 1e-4) {
        p.x += dx / d * (min - d); p.z += dz / d * (min - d);
        v.x += dx / d * 1.5 + P.vel.x * 0.4; v.z += dz / d * 1.5 + P.vel.z * 0.4;
      }
    }
    if (p.y < th - 5) { p.y = th + 1; v.set(0, 0, 0); }
  }
  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j];
      _d.subVectors(b.pos, a.pos);
      const d = _d.length(), min = a.r + b.r;
      if (d >= min || d < 1e-5) continue;
      _d.divideScalar(d);
      const pen = (min - d) / 2;
      a.pos.addScaledVector(_d, -pen); b.pos.addScaledVector(_d, pen);
      const rel = _d.dot(_q.subVectors(b.vel, a.vel));
      if (rel < 0) {
        const tm = a.mass + b.mass;
        a.vel.addScaledVector(_d, rel * (b.mass / tm) * 1.3);
        b.vel.addScaledVector(_d, -rel * (a.mass / tm) * 1.3);
      }
    }
  }
}
