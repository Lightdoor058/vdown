// Enkel fysik: lådformade kolliderare (AABB), marken och karaktärsrörelse.
import * as THREE from 'three';
import { clamp } from '../core/utils.js';

export const colliders = [];  // { box: Box3, on: bool }
export const staticRay = [];  // meshar som strålar (titta/skjuta) kan träffa

let groundFn = () => -1000;
export function setGround(fn) { groundFn = fn; }
export const groundH = (x, z) => groundFn(x, z);

export function addCol(mesh) {
  const c = { box: new THREE.Box3().setFromObject(mesh), on: true };
  colliders.push(c);
  return c;
}
export function addBoxCol(min, max) {
  const c = { box: new THREE.Box3(min.clone(), max.clone()), on: true };
  colliders.push(c);
  return c;
}

// Går igenom en grupp och registrerar allt markerat med userData.col (väggar)
// och userData.int (saker man kan interagera med).
export function registerColliders(root) {
  root.updateMatrixWorld(true);
  const list = [];
  root.traverse((o) => {
    if (o.isMesh && o.userData.col) {
      if (o.userData.colRef) return;
      const c = addCol(o);
      o.userData.colRef = c; c.mesh = o;
      list.push(c);
      if (o.userData.onCol) o.userData.onCol(c);
      if (!o.userData.noRay) staticRay.push(o);
    } else if (o.userData.int && !staticRay.includes(o)) {
      staticRay.push(o);
    }
  });
  return list;
}
// Räkna om kolliderarna (t.ex. när skeppet flyttats till kraschplatsen)
export function refreshColliders(list) {
  for (const c of list) if (c.mesh) { c.mesh.updateMatrixWorld(true); c.box.setFromObject(c.mesh); }
}

// Flyttar en karaktär (spelare/monster) ut ur väggar. Returnerar golvhöjd (sup) och tak (ceil).
export function resolveChar(pos, vel, r, h, stepH = 0.45) {
  for (const c of colliders) {
    if (!c.on) continue;
    const b = c.box;
    if (b.max.y <= pos.y + stepH || b.min.y >= pos.y + h) continue;
    const cx = clamp(pos.x, b.min.x, b.max.x), cz = clamp(pos.z, b.min.z, b.max.z);
    const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), push = (r - d) / d;
      pos.x += dx * push; pos.z += dz * push;
      const nx = dx / d, nz = dz / d, vn = vel.x * nx + vel.z * nz;
      if (vn < 0) { vel.x -= vn * nx; vel.z -= vn * nz; }
    } else {
      const l = pos.x - b.min.x, rr = b.max.x - pos.x, f = pos.z - b.min.z, k = b.max.z - pos.z;
      const m = Math.min(l, rr, f, k);
      if (m === l) pos.x = b.min.x - r; else if (m === rr) pos.x = b.max.x + r;
      else if (m === f) pos.z = b.min.z - r; else pos.z = b.max.z + r;
    }
  }
  let sup = groundFn(pos.x, pos.z), ceil = Infinity;
  const r2 = r * 0.7;
  for (const c of colliders) {
    if (!c.on) continue;
    const b = c.box;
    if (pos.x + r2 < b.min.x || pos.x - r2 > b.max.x || pos.z + r2 < b.min.z || pos.z - r2 > b.max.z) continue;
    if (b.max.y <= pos.y + stepH + 0.001) sup = Math.max(sup, b.max.y);
    else if (b.min.y >= pos.y + 0.5) ceil = Math.min(ceil, b.min.y);
  }
  return { sup, ceil };
}
