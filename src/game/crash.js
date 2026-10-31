// Kraschplatsen: skeppet på marken, nödljus, allt huller om buller, gnistor, rök och små bränder inne i skeppet.
import { V3, rand, pick, clamp } from '../core/utils.js';
import { SFX } from '../core/audio.js';
import { ship, SR, setShipLights, messUpShip, setGenerator } from '../world/ship.js';
import { shipY } from '../world/planet.js';
import { setEnv } from '../world/env.js';
import { refreshColliders, setGround } from '../systems/physics.js';
import { groundH } from '../world/planet.js';
import { Item, items, HEAT } from '../entities/items.js';
import { crates } from '../world/props.js';
import { addEmitter, burst, FX } from '../systems/particles.js';
import { S, P } from './state.js';

const _cl = new V3();
function localInCrate(l) {
  for (const c of crates) {
    if (!c.spawned || c.grp.parent !== ship) continue;
    _cl.copy(l).sub(c.grp.position);
    const a = -c.grp.rotation.y, cs = Math.cos(a), sn = Math.sin(a);
    const x = _cl.x * cs - _cl.z * sn;
    const z = _cl.x * sn + _cl.z * cs;
    if (Math.abs(x) <= c.W * 0.52 && Math.abs(z) <= c.D * 0.52 && l.y >= c.grp.position.y - 0.05 && l.y <= c.grp.position.y + c.H + 0.5) return true;
  }
  return false;
}

let frozenInside = null;
export function freezeShipItems() {
  ship.updateMatrixWorld(true);
  frozenInside = items.filter((it) => {
    const l = ship.worldToLocal(it.pos.clone());
    return Math.abs(l.x) < 3.3 && l.z > -9 && l.z < 9.2 && l.y > -1 && l.y < 3.5;
  }).map((it) => {
    it.vel.set(0, 0, 0); it.av.set(0, 0, 0);
    return { it, l: ship.worldToLocal(it.pos.clone()) };
  });
}

export function setupCrashSite() {
  if (S.crashDone) return;
  S.crashDone = true;
  setEnv('planet');
  setGround(groundH);
  ship.updateMatrixWorld(true);
  const inside = frozenInside || items.filter((it) => {
    const l = ship.worldToLocal(it.pos.clone());
    return Math.abs(l.x) < 3.3 && l.z > -9 && l.z < 9.2 && l.y > -1 && l.y < 3.5;
  }).map((it) => ({ it, l: ship.worldToLocal(it.pos.clone()) }));
  frozenInside = null;

  ship.position.set(0, shipY(), 0);
  ship.rotation.set(0, 0, 0);
  ship.updateMatrixWorld(true);
  messUpShip();
  setGenerator(false);
  SR.genLever.done = false;
  setShipLights('emergency');
  refreshColliders(SR.cols || []);
  for (const c of crates) if (c.lidCol && c.lidCol.mesh) { c.lidCol.mesh.updateMatrixWorld(true); c.lidCol.box.setFromObject(c.lidCol.mesh); }

  const W = (x, y, z) => ship.localToWorld(new V3(x, y, z));
  for (const { it, l } of inside) {
    if (localInCrate(l) || l.y > 0.85) {
      it.pos.copy(W(l.x, l.y, l.z));
      it.vel.set(0, 0, 0);
      continue;
    }
    const x = clamp(l.x + rand(-0.35, 0.35), -2.45, 2.45);
    const z = clamp(l.z + rand(-0.5, 0.5), -8.0, 8.4);
    const y = clamp(l.y + rand(0, 0.12), 0.16, 0.65);
    it.pos.copy(W(x, y, z));
    it.av.set(rand(-2.2, 2.2), rand(-2.2, 2.2), rand(-2.2, 2.2));
  }
  for (let i = 0; i < 18; i++) new Item(pick(['junk', 'junk', 'cup', 'junk']), W(rand(-2.3, 2.3), 0.28, rand(-7.4, 8.1)));
  new Item('pad', W(0.6, 0.3, -2.4), { lore: 'mikko' });

  const spark = W(1.6, 1.15, -7.8);
  addEmitter(0.7, () => { burst(spark, 'spark', 16); if (P.pos.distanceTo(spark) < 12) SFX.spark(0.2); });
  const spark2 = W(0.6, 2.95, 1.5);
  addEmitter(0.4, () => { burst(spark2, 'spark', 12); if (P.pos.distanceTo(spark2) < 10) SFX.spark(0.15); });
  const spark3 = W(-2.3, 1.3, 6.2);
  addEmitter(0.25, () => { burst(spark3, 'spark', 8); if (P.pos.distanceTo(spark3) < 9) SFX.spark(0.1); });
  const fire = W(-2.2, 0.05, -7.3);
  HEAT.push({ pos: fire.clone().add(new V3(0, 0.3, 0)), r: 1.2 });
  addEmitter(12, () => FX.fire(fire, 0.55));
  addEmitter(1.4, () => FX.smoke(fire.clone().add(new V3(0, 0.6, 0)), 0.55));
  const fire2 = W(1.8, 0.04, 5.8);
  HEAT.push({ pos: fire2.clone().add(new V3(0, 0.25, 0)), r: 0.9 });
  addEmitter(8, () => FX.fire(fire2, 0.4));
  addEmitter(1.0, () => FX.smoke(fire2.clone().add(new V3(0, 0.5, 0)), 0.4));
  for (const s of [-1, 1]) { const p = W(s * 2, 1.4, 11.7); addEmitter(5, () => FX.smoke(p.clone(), 1.4)); }
  const hole = W(3.3, 1.7, -2.4);
  addEmitter(1.8, () => FX.smoke(hole.clone().add(new V3(rand(-0.3, 0.3), 0, rand(-0.5, 0.5))), 0.8));
  const roof = W(0.55, 2.9, 1.5);
  addEmitter(1.1, () => FX.smoke(roof.clone().add(new V3(rand(-0.2, 0.2), 0, rand(-0.2, 0.2))), 0.55));
}
