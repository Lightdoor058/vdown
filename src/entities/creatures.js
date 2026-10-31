// Spindlarna (din modell). Jagar, biter (med gift), kan bedövas, dras och fångas i labbets tank.
import * as THREE from 'three';
import { scene, camera } from '../core/render.js';
import { V3, rand, clamp } from '../core/utils.js';
import { resolveChar, groundH } from '../systems/physics.js';
import { SFX } from '../core/audio.js';
import { cloneAsset } from '../core/assets.js';
import { Rig, SPIDER_BONES, spiderPose } from './rig.js';
import { P, S } from '../game/state.js';
import { damagePlayer } from '../game/player.js';
import { burst } from '../systems/particles.js';
import { LOC } from '../world/planet.js';
import * as UI from '../ui/ui.js';

export const creatures = [];
export const creatureMeshes = [];
const hitGeo = new THREE.BoxGeometry(1.1, 0.7, 1.4);
const hitMat = new THREE.MeshBasicMaterial();
const volAt = (p) => clamp(1 - camera.getWorldPosition(new V3()).distanceTo(p) / 45, 0, 1);

export function makeSpiderModel(size = 1) {
  const model = cloneAsset('spider');
  model.scale.setScalar(0.0022 * size);
  model.rotation.y = -Math.PI / 2;
  model.position.y = 0.1 * size;
  const g = new THREE.Group(); g.add(model);
  const rig = new Rig(model, SPIDER_BONES);
  return { g, model, rig };
}

export class Creature {
  constructor(pos, aggro = false, size = rand(0.85, 1.15)) {
    this.pos = pos.clone(); this.vel = new V3();
    this.size = size;
    this.hp = 100; this.dead = false; this.deadT = 0;
    this.atk = rand(0.5, 1); this.aggro = aggro; this.alert = false;
    this.home = pos.clone(); this.wander = pos.clone(); this.wT = 0;
    this.phase = rand(0, 10); this.flash = 0; this.lunge = 0; this.growlT = rand(3, 8);
    this.facing = rand(0, 6); this.state = 'walk'; this.stunT = 0; this.t = rand(0, 10);
    const { g, model, rig } = makeSpiderModel(size);
    this.g = g; this.model = model; this.rig = rig;
    this.mats = [];
    model.traverse((o) => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => this.mats.push(m)); } });
    const hit = new THREE.Mesh(hitGeo, hitMat); hit.position.y = 0.4 * size; hit.scale.setScalar(size); hit.visible = false;
    hit.userData.creature = this; hit.userData.int = { kind: 'spider', ref: this };
    g.add(hit); this.hit = hit;
    creatureMeshes.push(hit);
    g.position.copy(this.pos);
    scene.add(g);
  }

  damage(n, dir) {
    if (this.dead || this.state === 'captured') return;
    this.hp -= n; this.flash = 1; this.aggro = true;
    if (this.state === 'stun' && this.hp > 0) { this.stunT = Math.min(this.stunT, 4); }
    if (dir) { this.vel.x += dir.x * 5; this.vel.z += dir.z * 5; }
    SFX.hitc();
    burst(this.pos.clone().add(new V3(0, 0.5, 0)), 'goo', 10);
    if (this.hp <= 0) this.die(); else SFX.screech(0.25 * volAt(this.pos));
  }

  die() {
    if (this.dead) return;
    this.dead = true; this.state = 'dead'; P.kills++;
    if (P.drag === this) P.drag = null;
    SFX.cdie(0.4 * volAt(this.pos));
    burst(this.pos.clone().add(new V3(0, 0.5, 0)), 'goo', 25);
    const i = creatureMeshes.indexOf(this.hit); if (i >= 0) creatureMeshes.splice(i, 1);
  }

  stun(time = 80) {
    this.state = 'stun'; this.stunT = time; this.vel.set(0, 0, 0);
    SFX.screech(0.4); burst(this.pos.clone().add(new V3(0, 0.5, 0)), 'goo', 6);
  }

  update(dt) {
    this.t += dt;
    if (this.state === 'captured') {
      this.rig.blend(spiderPose(this.t * 2, 0.3, 'walk', this.t), 0.2);
      this.g.rotation.y += dt * 0.3;
      return;
    }
    if (this.dead) {
      this.deadT += dt;
      this.rig.blend(spiderPose(0, 1, 'dead', this.t), 0.15);
      this.g.rotation.z = Math.min(this.deadT * 4, Math.PI);
      this.g.position.y = this.pos.y + Math.min(this.deadT * 1.2, 0.4) - Math.max(0, this.deadT - 4) * 0.25;
      return;
    }
    if (this.state === 'stun') {
      this.stunT -= dt;
      this.rig.blend(spiderPose(0, 1, 'stun', this.t), 0.2);
      if (P.drag !== this) {
        const { sup } = resolveChar(this.pos, this.vel, 0.5, 0.8);
        this.pos.y += (sup - this.pos.y) * Math.min(1, dt * 10);
      }
      this.g.position.copy(this.pos);
      this.g.rotation.z = Math.PI * 0.85;
      this.g.position.y += 0.35 * this.size;
      if (this.stunT <= 0) {
        if (P.drag === this) P.drag = null;
        this.state = 'walk'; this.g.rotation.z = 0; this.aggro = true; SFX.screech(0.5);
        UI.toast('Spindeln vaknade!', 'bad');
      } else if (this.stunT < 10 && Math.random() < dt * 2) SFX.growl(0.15);
      return;
    }

    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const canHunt = S.mode === 'play' && !P.inShipSafe;
    const sense = this.aggro ? 400 : 24;
    let tx = 0, tz = 0, spd = 0;
    if (canHunt && dist < sense) {
      if (!this.alert) { this.alert = true; SFX.screech(0.35 * volAt(this.pos)); }
      tx = dx / dist; tz = dz / dist;
      spd = dist < 2.0 ? 1.2 : 5.0;
    } else {
      this.alert = false;
      this.wT -= dt;
      if (this.wT <= 0) { this.wT = rand(3, 7); this.wander.set(this.home.x + rand(-12, 12), 0, this.home.z + rand(-12, 12)); }
      const wx = this.wander.x - this.pos.x, wz = this.wander.z - this.pos.z, wd = Math.hypot(wx, wz);
      if (wd > 1) { tx = wx / wd; tz = wz / wd; spd = 1.5; }
    }
    for (const o of creatures) {
      if (o === this || o.dead || o.state !== 'walk') continue;
      const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z, od = Math.hypot(ox, oz);
      if (od < 1.8 && od > 0.01) { tx += ox / od * 0.8; tz += oz / od * 0.8; }
    }
    const k = 1 - Math.exp(-6 * dt);
    this.vel.x += (tx * spd - this.vel.x) * k;
    this.vel.z += (tz * spd - this.vel.z) * k;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    const { sup } = resolveChar(this.pos, this.vel, 0.6, 0.9);
    this.pos.y += (sup - this.pos.y) * Math.min(1, dt * 12);

    this.atk -= dt;
    let biting = false;
    if (canHunt && dist < 1.9 && Math.abs(P.pos.y - this.pos.y) < 1.6) {
      biting = true;
      if (this.atk <= 0) {
        this.atk = 1.1; this.lunge = 1;
        SFX.growl(0.4);
        if (P.antivenom) damagePlayer(rand(3, 5), 'Biten av en spindel');
        else { damagePlayer(rand(8, 12), 'Förgiftad av en spindel'); P.venom = Math.min(100, P.venom + 22); UI.tip('venom', 'Du är FÖRGIFTAD! Medkit tar bort giftet. Ett antigift skulle skydda dig...'); }
      }
    }
    this.growlT -= dt;
    if (this.growlT <= 0) { this.growlT = rand(4, 9); if (dist < 40) SFX.growl(0.25 * volAt(this.pos)); }

    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 0.2) this.facing = Math.atan2(this.vel.x, this.vel.z);
    let df = this.facing - this.g.rotation.y;
    df = Math.atan2(Math.sin(df), Math.cos(df));
    this.g.rotation.y += df * Math.min(1, dt * 8);
    this.phase += dt * (2 + speed * 2.6);
    this.rig.blend(spiderPose(this.phase, clamp(speed / 3, 0.15, 1), biting ? 'bite' : 'walk', this.t), 1 - Math.exp(-14 * dt));
    this.lunge = Math.max(0, this.lunge - dt * 3);
    const fwd = this.lunge * 0.5;
    this.g.position.set(this.pos.x + Math.sin(this.g.rotation.y) * fwd, this.pos.y + Math.abs(Math.sin(this.phase * 2)) * 0.03, this.pos.z + Math.cos(this.g.rotation.y) * fwd);
    this.g.rotation.z = 0;
    this.flash = Math.max(0, this.flash - dt * 6);
    for (const m of this.mats) if (m.emissive && m.name === 'Material.004') { m.emissive.setRGB(this.flash, this.flash, this.flash); }
  }
}

export function spawnCreature(x, z, aggro = false) {
  const c = new Creature(new V3(x, groundH(x, z), z), aggro);
  creatures.push(c);
  return c;
}

let initialDone = false;
export function spawnInitialCreatures() {
  if (initialDone) return; initialDone = true;
  const around = (L, n, r) => { for (let i = 0; i < n; i++) { const a = rand(0, 6.28); spawnCreature(L.x + Math.cos(a) * rand(3, r), L.z + Math.sin(a) * rand(3, r)); } };
  around(LOC.NEST, 3, 9);
  around(LOC.CAMP, 2, 12);
  around(LOC.OP, 1, 18);
  around(LOC.HELION, 4, 16);
  around(LOC.MINE, 2, 14);
  around(LOC.LANDER, 1, 12);
  spawnCreature(-30, 34);   // nära skeppet, bra att fånga
  spawnCreature(40, -40);
}

let spawnT = 30;
function updateSpawner(dt) {
  if (S.mode !== 'play' || S.act !== 'planet') return;
  const alive = creatures.filter((c) => !c.dead && c.state !== 'captured').length;
  spawnT -= dt;
  if (S.defense) {
    if (spawnT <= 0 && alive < 12) {
      spawnT = rand(2.2, 3.4);
      const a = rand(0, 6.28), d = rand(30, 40);
      spawnCreature(LOC.BEACON.x + Math.cos(a) * d, LOC.BEACON.z + Math.sin(a) * d, true);
    }
  } else if (spawnT <= 0) {
    spawnT = rand(28, 42);
    if (alive < 9) {
      const a = rand(0, 6.28), d = rand(50, 75);
      const x = P.pos.x + Math.cos(a) * d, z = P.pos.z + Math.sin(a) * d;
      if (Math.hypot(x, z) < 380 && Math.hypot(x, z) > 25) spawnCreature(x, z);
    }
  }
}

export function updateCreatures(dt) {
  for (let i = creatures.length - 1; i >= 0; i--) {
    const c = creatures[i];
    c.update(dt);
    if (c.dead && c.deadT > 7) { scene.remove(c.g); creatures.splice(i, 1); }
  }
  updateSpawner(dt);
}

export function killAllNear(pos, r) {
  for (const c of creatures) if (!c.dead && c.state !== 'captured' && c.pos.distanceTo(pos) < r) { c.die(); c.deadT = 99; scene.remove(c.g); }
}
