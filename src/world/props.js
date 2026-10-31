// Interaktiva saker: lådor med lock (dras upp med musen), dörrar (E), spakar (dras), knappar och syrestationer.
import * as THREE from 'three';
import { V3, clamp, canvasTex } from '../core/utils.js';
import { SFX } from '../core/audio.js';
import { M, bmm, emis } from './materials.js';
import { Item, IDEF } from '../entities/items.js';

export const crates = [];
export const doors = [];
export const levers = [];

// ---------- LÅDOR (locket dras upp med musen) ----------
export function makeCrate(parent, x, y, z, rotY, contents = [], dims = {}) {
  const W = dims.w ?? 1.0, H = dims.h ?? 0.6, D = dims.d ?? 0.7, t = dims.t ?? 0.05;
  const mat = dims.mat ?? M.crate;
  const grp = new THREE.Group();
  grp.position.set(x, y, z); grp.rotation.y = rotY;
  parent.add(grp);
  bmm(grp, -W / 2, 0, -D / 2, W / 2, t, D / 2, mat);
  bmm(grp, -W / 2, t, D / 2 - t, W / 2, H, D / 2, mat);
  bmm(grp, -W / 2, t, -D / 2, W / 2, H, -D / 2 + t, mat);
  bmm(grp, -W / 2, t, -D / 2 + t, -W / 2 + t, H, D / 2 - t, mat);
  bmm(grp, W / 2 - t, t, -D / 2 + t, W / 2, H, D / 2 - t, mat);
  if (!dims.noStripe) bmm(grp, -W / 2 - 0.005, H * 0.37, D / 2, W / 2 + 0.005, H * 0.53, D / 2 + 0.01, M.hazard, false, false);

  const pivot = new THREE.Group(); pivot.position.set(0, H, -D / 2); grp.add(pivot);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.06, D + 0.04), mat);
  lid.position.set(0, 0.03, D / 2); lid.castShadow = true; pivot.add(lid);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.34, W * 0.5), 0.05, 0.07), M.dark);
  handle.position.set(0, 0.03, D + 0.05); pivot.add(handle);

  const lidCol = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, D), M.dark);
  lidCol.position.set(0, H + 0.03, 0); lidCol.visible = false;
  lidCol.userData.col = true; lidCol.userData.noRay = true;
  grp.add(lidCol);

  const crate = { grp, pivot, lid, angle: 0, angVel: 0, dragging: false, dragDelta: 0, contents, spawned: false, lidCol: null, opened: false, creakT: 0, name: dims.name || 'Låda', H, W, D, onOpen: null };
  lidCol.userData.onCol = (c) => { crate.lidCol = c; };
  if (dims.label) {
    const tex = canvasTex(256, 72, (x, w, h) => {
      x.fillStyle = '#0c0d10'; x.fillRect(0, 0, w, h);
      x.strokeStyle = '#f2c200'; x.lineWidth = 6; x.strokeRect(5, 5, w - 10, h - 10);
      x.font = 'bold 32px Orbitron, Arial'; x.fillStyle = '#f2c200';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(dims.label, w / 2, h / 2 + 2);
    });
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(W * 0.72, 0.82), 0.18), new THREE.MeshBasicMaterial({ map: tex }));
    tag.position.set(0, H * 0.56, D / 2 + 0.012);
    grp.add(tag);
  }

  lid.userData.int = { kind: 'lid', ref: crate };
  handle.userData.int = { kind: 'lid', ref: crate };
  crates.push(crate);
  return crate;
}

export function spawnCrateContents(c) {
  if (c.spawned) return;
  c.spawned = true;
  c.grp.updateMatrixWorld(true);
  const n = c.contents.length;
  c.contents.forEach((entry, i) => {
    let type, extra = {}, slot = null;
    if (typeof entry === 'string') type = entry;
    else if (Array.isArray(entry)) { type = entry[0]; extra = entry[1] || {}; slot = entry[2] || null; }
    else { type = entry.type; extra = entry.extra || {}; slot = entry.pos || null; }
    const r = IDEF[type]?.r || 0.12;
    const local = slot
      ? new V3(slot.x, slot.y, slot.z)
      : new V3((i - (n - 1) / 2) * Math.min(0.28, (c.W - 0.22) / Math.max(1, n)), r + 0.05, 0);
    new Item(type, c.grp.localToWorld(local), extra);
  });
}

// ---------- DÖRRAR ----------
export function makeSlideDoor(mesh, offset, name) {
  const d = { kind: 'slide', mesh, closed: mesh.position.clone(), offset, t: 0, open: false, name, col: null, speed: 1.6, locked: null };
  mesh.userData.int = { kind: 'door', ref: d };
  mesh.userData.col = true;
  mesh.userData.onCol = (c) => { d.col = c; };
  doors.push(d);
  return d;
}
export function makeHingeDoor(pivot, mesh, openAngle, name) {
  const d = { kind: 'hinge', pivot, mesh, openAngle, t: 0, open: false, name, col: null, speed: 2.2, locked: null };
  mesh.userData.int = { kind: 'door', ref: d };
  mesh.userData.col = true;
  mesh.userData.onCol = (c) => { d.col = c; };
  doors.push(d);
  return d;
}
export function toggleDoor(d) {
  if (d.locked) { SFX.empty(); return d.locked; }
  d.open = !d.open;
  if (d.kind === 'slide') SFX.door(); else SFX.fridge();
  return null;
}

// ---------- SPAKAR (håll vänster musknapp och dra nedåt) ----------
export function makeLever(parent, x, y, z, rotY, name, onFull) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; parent.add(g);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.1), M.dark2); g.add(base);
  const pivot = new THREE.Group(); pivot.position.set(0, 0.1, 0.06); g.add(pivot);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 8), M.dark); arm.position.y = 0.16; pivot.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshStandardMaterial({ color: 0xd02020, roughness: 0.4 }));
  knob.position.y = 0.33; pivot.add(knob);
  const lv = { g, pivot, angle: 0, target: 0, dragging: false, done: false, name, onFull, max: 2.2 };
  arm.userData.int = knob.userData.int = base.userData.int = { kind: 'lever', ref: lv };
  levers.push(lv);
  return lv;
}

// ---------- SYRESTATION ----------
export function makeO2Station(parent, x, y, z, rotY) {
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; parent.add(g);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.12), M.dark); g.add(panel);
  const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.02), emis(0x40ff90, 3)); lightStrip.position.set(0, 0.25, 0.07); g.add(lightStrip);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.45, 12), new THREE.MeshStandardMaterial({ color: 0x2f7fd6, metalness: 0.5, roughness: 0.3 }));
  tank.position.set(0, -0.08, 0.13); g.add(tank);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), M.dark2); nozzle.rotation.x = Math.PI / 2; nozzle.position.set(0.18, -0.2, 0.15); g.add(nozzle);
  g.userData.int = { kind: 'o2st' };
  return g;
}

// ---------- uppdatering varje bildruta ----------
export function updateProps(dt) {
  for (const d of doors) {
    const target = d.open ? 1 : 0;
    if (d.t !== target) {
      d.t += Math.sign(target - d.t) * Math.min(Math.abs(target - d.t), dt * d.speed);
      const e = d.t * d.t * (3 - 2 * d.t);
      if (d.kind === 'slide') d.mesh.position.copy(d.closed).addScaledVector(d.offset, e);
      else d.pivot.rotation.y = d.openAngle * e;
    }
    if (d.col) d.col.on = d.t < 0.5;
  }

  for (const c of crates) {
    if (c.dragging) {
      c.angVel = c.dragDelta / Math.max(dt, 0.001);
      c.dragDelta = 0;
    } else {
      c.angVel += -7 * Math.cos(c.angle) * dt;
      c.angVel *= Math.exp(-1.6 * dt);
      c.angle += c.angVel * dt;
      if (c.angle < 0) { if (c.angVel < -1) SFX.thud(Math.min(0.6, -c.angVel * 0.12)); c.angle = 0; c.angVel = 0; }
      if (c.angle > 1.95) { if (c.angVel > 1) SFX.thud(0.15); c.angle = 1.95; c.angVel = 0; }
    }
    c.creakT -= dt;
    if (Math.abs(c.angVel) > 0.6 && c.creakT <= 0) { SFX.creak(); c.creakT = 0.28; }
    c.pivot.rotation.x = -c.angle;
    if (c.lidCol) c.lidCol.on = c.angle < 0.15;
    if (c.angle > 1.6 && !c.opened) { c.opened = true; if (c.onOpen) c.onOpen(c); }
  }

  for (const lv of levers) {
    if (!lv.dragging) lv.angle += ((lv.done ? lv.max : 0) - lv.angle) * Math.min(1, dt * 6);
    lv.angle = clamp(lv.angle, 0, lv.max);
    if (!lv.done && lv.angle >= lv.max * 0.95) { lv.done = true; lv.dragging = false; SFX.thud(0.5); if (lv.onFull) lv.onFull(lv); }
    lv.pivot.rotation.x = lv.angle;
  }
}
