// Begrav Mikko: dra ut kroppen, gräv en grav med spaden, lägg ner honom och fyll igen.
import * as THREE from 'three';
import { V3, clamp } from '../core/utils.js';
import { SFX } from '../core/audio.js';
import { scene } from '../core/render.js';
import { groundH } from '../systems/physics.js';
import { LOC, graveRefs, planetEnv } from '../world/planet.js';
import { M, emis } from '../world/materials.js';
import { P, S, F } from './state.js';
import { cast } from './cast.js';
import { burst } from '../systems/particles.js';
import * as UI from '../ui/ui.js';
import { onBurialEvent } from './objectives.js';

export const grave = { dug: 0, bodyIn: false, filled: false, hole: null, mound: null };

function gpos() { return new V3(LOC.GRAVE.x, groundH(LOC.GRAVE.x, LOC.GRAVE.z), LOC.GRAVE.z); }

// hålla spaden mot graven (anropas varje bildruta medan vänster musknapp hålls)
export function digTick(dt) {
  if (grave.dug >= 1) return;
  grave.dug = clamp(grave.dug + dt / 7, 0, 1);
  const p = gpos();
  if (!grave.hole) {
    grave.hole = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.8, 1, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a160e, roughness: 1, side: THREE.BackSide }));
    grave.dark = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), new THREE.MeshStandardMaterial({ color: 0x1a0d08, roughness: 1 }));
    grave.dark.rotation.x = -Math.PI / 2;
    grave.pile = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6a3a22, roughness: 1, flatShading: true }));
    planetEnv.add(grave.hole, grave.dark, grave.pile);
  }
  const depth = grave.dug * 1.1;
  grave.hole.scale.set(1.1, depth + 0.01, 0.7); grave.hole.position.set(p.x, p.y - depth / 2 + 0.02, p.z);
  grave.dark.scale.set(1.25, 0.8, 1); grave.dark.position.set(p.x, p.y - depth + 0.03, p.z);
  grave.pile.scale.set(0.9 * grave.dug + 0.05, 0.5 * grave.dug + 0.02, 0.7 * grave.dug + 0.05); grave.pile.position.set(p.x + 1.9, p.y, p.z);
  if (Math.random() < dt * 4) { SFX.dig(); burst(p.clone().add(new V3(0, 0.2, 0)), 'dust', 3); }
  if (grave.dug >= 1) { UI.toast('Graven är färdig. Dra Mikko hit.', 'good'); onBurialEvent(); }
}

// släpp Mikko nära graven
export function tryLowerBody() {
  if (grave.dug < 1 || grave.bodyIn) return false;
  const m = cast.mikko.root;
  const p = gpos();
  if (Math.min(m.position.distanceTo(p), P.pos.distanceTo(p)) > 3.0) return false;
  grave.bodyIn = true;
  m.position.set(p.x, p.y - 0.85, p.z);
  m.rotation.set(-Math.PI / 2, 0.3, 0, 'YXZ');
  cast.mikko.setPose('lie', true); cast.mikko.pose = 'static';
  SFX.thud(0.6);
  UI.speak('you', 'Så där. Nu vilar du.', 2.5);
  onBurialEvent();
  return true;
}

// E: fyll igen graven
export function fillGrave() {
  if (!grave.bodyIn || grave.filled) return false;
  grave.filled = true; F.buried = true;
  const p = gpos();
  scene.remove(cast.mikko.root); cast.mikko.root.parent && cast.mikko.root.parent.remove(cast.mikko.root);
  [grave.hole, grave.dark, grave.pile].forEach((o) => o && planetEnv.remove(o));
  graveRefs.patch.visible = false;
  const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5a3020, roughness: 1, flatShading: true }));
  mound.scale.set(1.2, 0.35, 0.75); mound.position.copy(p); planetEnv.add(mound);
  // gravsten med namnplatta
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = '#2a2e35'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#e8ebee'; x.font = 'bold 30px Arial'; x.textAlign = 'center';
  x.fillText('MIKKO LIND', 128, 48); x.font = '20px Arial'; x.fillText('2153 – 2187', 128, 80); x.fillStyle = '#5ab8ff'; x.fillText('pilot · bästa vän', 128, 108);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const stone = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.06), M.dark2); stone.position.set(p.x - 1.25, p.y + 0.5, p.z); stone.rotation.y = Math.PI / 2; planetEnv.add(stone);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.38), new THREE.MeshBasicMaterial({ map: tex })); plate.position.set(p.x - 1.215, p.y + 0.5, p.z); plate.rotation.y = Math.PI / 2; planetEnv.add(plate);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), M.dark2); post.position.set(p.x - 1.25, p.y + 0.12, p.z); planetEnv.add(post);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), emis(0x5ab8ff, 4)); light.position.set(p.x - 1.25, p.y + 0.8, p.z); planetEnv.add(light);
  SFX.dig(); SFX.dig();
  setTimeout(() => SFX.choice(), 600);
  UI.speak('you', 'Vila i frid, Mikko. Tummen upp. Alltid tummen upp.', 4);
  onBurialEvent();
  return true;
}

// Mikkos kropp följer efter när den dras
const _t = new V3();
export function updateDragBody(dt) {
  const d = P.drag; if (!d) return;
  const f = new V3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  _t.copy(P.pos).addScaledVector(f, -1.4);
  if (d.kind === 'mikko') {
    const r = cast.mikko.root;
    r.position.x += (_t.x - r.position.x) * Math.min(1, dt * 6);
    r.position.z += (_t.z - r.position.z) * Math.min(1, dt * 6);
    let gy = groundH(r.position.x, r.position.z);
    if (P.pos.y > gy + 0.1 && Math.abs(r.position.y - P.pos.y) < 1) gy = Math.max(gy, P.pos.y);
    r.position.y += (gy + 0.25 - r.position.y) * Math.min(1, dt * 8);
    r.rotation.set(-Math.PI / 2, P.yaw, 0, 'YXZ');
    if (Math.random() < dt * 3 && Math.hypot(P.vel.x, P.vel.z) > 0.5) SFX.dig();
  } else if (d.kind === 'spider') {
    const s = d.ref;
    s.pos.x += (_t.x - s.pos.x) * Math.min(1, dt * 6);
    s.pos.z += (_t.z - s.pos.z) * Math.min(1, dt * 6);
    let gy = groundH(s.pos.x, s.pos.z);
    if (P.pos.y > gy + 0.1) gy = Math.max(gy, P.pos.y);
    s.pos.y += (gy - s.pos.y) * Math.min(1, dt * 8);
  }
}
