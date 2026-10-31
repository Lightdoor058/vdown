// Små critters: hoppar runt, flyr. Grip dem i huvudet (håll vänster mus), knäck nacken (E), grilla dem över värme eller skjut dem.
import * as THREE from 'three';
import { scene, camera } from '../core/render.js';
import { V3, rand, clamp } from '../core/utils.js';
import { groundH, resolveChar } from '../systems/physics.js';
import { SFX } from '../core/audio.js';
import { P, S } from '../game/state.js';
import { makeCritterMesh, Item } from './items.js';
import { burst } from '../systems/particles.js';
import * as UI from '../ui/ui.js';

export const critters = [];
export const critterHold = { c: null };
const hitGeo = new THREE.SphereGeometry(0.28, 8, 6);
const hitMat = new THREE.MeshBasicMaterial();

class Critter {
  constructor(x, z) {
    this.pos = new V3(x, groundH(x, z), z); this.vel = new V3();
    this.mesh = makeCritterMesh(false);
    this.hit = new THREE.Mesh(hitGeo, hitMat); this.hit.visible = false; this.hit.position.y = 0.12;
    this.hit.userData.int = { kind: 'critter', ref: this };
    this.mesh.add(this.hit);
    this.phase = rand(0, 6); this.wT = 0; this.target = this.pos.clone(); this.home = this.pos.clone(); this.facing = 0; this.squeak = 0;
    scene.add(this.mesh);
  }
  remove() {
    scene.remove(this.mesh);
    critters.splice(critters.indexOf(this), 1);
    if (critterHold.c === this) critterHold.c = null;
  }
  update(dt) {
    if (critterHold.c === this) {
      const cam = camera.getWorldPosition(new V3()), dir = new V3(); camera.getWorldDirection(dir);
      this.pos.copy(cam).addScaledVector(dir, 0.75).add(new V3(0, -0.15, 0));
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.set(Math.sin(S.time * 18) * 0.4, Math.atan2(-dir.x, -dir.z), Math.sin(S.time * 23) * 0.5);
      this.squeak -= dt;
      if (this.squeak <= 0) { this.squeak = rand(0.4, 1); SFX.squeak(); }
      return;
    }
    const dx = this.pos.x - P.pos.x, dz = this.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    let spd = 0, tx = 0, tz = 0;
    if (d < 5 && S.mode === 'play') { tx = dx / d; tz = dz / d; spd = 3.0; if (Math.random() < dt) SFX.squeak(); }
    else {
      this.wT -= dt;
      if (this.wT <= 0) { this.wT = rand(2, 5); this.target.set(this.home.x + rand(-8, 8), 0, this.home.z + rand(-8, 8)); }
      const wx = this.target.x - this.pos.x, wz = this.target.z - this.pos.z, wd = Math.hypot(wx, wz);
      if (wd > 0.5) { tx = wx / wd; tz = wz / wd; spd = 1.0; }
    }
    this.vel.x += (tx * spd - this.vel.x) * Math.min(1, dt * 5);
    this.vel.z += (tz * spd - this.vel.z) * Math.min(1, dt * 5);
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const { sup } = resolveChar(this.pos, this.vel, 0.15, 0.3);
    this.pos.y = sup;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.phase += dt * (sp * 5 + 1);
    if (sp > 0.1) this.facing = Math.atan2(this.vel.x, this.vel.z);
    this.mesh.position.set(this.pos.x, this.pos.y + 0.1 + Math.abs(Math.sin(this.phase)) * 0.15 * Math.min(1, sp), this.pos.z);
    this.mesh.rotation.set(0, this.facing, 0);
  }
}

export function spawnCritters(list) { for (const [x, z] of list) critters.push(new Critter(x, z)); }

export function grabCritter(c) {
  critterHold.c = c; SFX.squeak();
  UI.tip('critter', 'Du håller crittern i huvudet. [E] = knäck nacken · släpp musknappen = släpp den');
}
export function releaseCritter() {
  const c = critterHold.c; if (!c) return;
  critterHold.c = null;
  c.pos.y = groundH(c.pos.x, c.pos.z);
}
export function breakNeck() {
  const c = critterHold.c; if (!c) return false;
  SFX.crack();
  const it = new Item('critter_dead', c.pos.clone());
  c.remove();
  UI.toast('Knäck. Lägg den över eld eller något varmt för att grilla den.', 'tip');
  return it;
}
export function shootCritter(c) {
  burst(c.pos.clone().add(new V3(0, 0.15, 0)), 'goo', 12);
  new Item('meat', c.pos.clone().add(new V3(0, 0.3, 0)));
  c.remove();
}
export function updateCritters(dt) { for (let i = critters.length - 1; i >= 0; i--) critters[i].update(dt); }
