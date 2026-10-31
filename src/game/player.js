// Spelaren (Ciro): rörelse, överlevnad, interaktion, greppa/kasta/dra, plasmapistol, ficklampa och rovern.
import * as THREE from 'three';
import { V3, clamp, lerp, rand } from '../core/utils.js';
import { scene, camera, shake } from '../core/render.js';
import { SFX } from '../core/audio.js';
import { resolveChar, staticRay } from '../systems/physics.js';
import { items, hold, grabItem, dropHeld, throwHeld, pickUp, makePistolMesh, transformItem } from '../entities/items.js';
import { creatures, creatureMeshes, killAllNear } from '../entities/creatures.js';
import { critters, critterHold, grabCritter, releaseCritter, breakNeck, shootCritter } from '../entities/critters.js';
import { toggleDoor } from '../world/props.js';
import { ship, SR } from '../world/ship.js';
import { terrain, lightCampfire, LOC } from '../world/planet.js';
import { rover, interactRover, exitRover, updateRover, turnKey, roverMouse, tryMountDropped } from '../world/rover.js';
import { burst } from '../systems/particles.js';
import { P, S, F, EV } from './state.js';
import * as UI from '../ui/ui.js';
import { interactBeacon, interactTerminal, interactMikko, breakPistol } from './objectives.js';
import { act1Event } from './preflight.js';
import { interactLab, interactTank, tryCapture } from './lab.js';
import { digTick, tryLowerBody, fillGrave, updateDragBody, grave } from './burial.js';
import { invHas, invTake, invAdd } from './inventory.js';
import { cast } from './cast.js';

export const keys = {};
const ray = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

// ---------- vapen + ficklampa (skapas när de behövs) ----------
let vm = null, muzzle = null, flashlight = null, gun = null;
function ensureVisuals() {
  if (vm) return;
  vm = new THREE.Group();
  gun = makePistolMesh(); vm.add(gun);
  vm.position.set(0.2, -0.2, -0.45);
  vm.visible = false;
  camera.add(vm);
  muzzle = new THREE.PointLight(0x5ee6ff, 0, 6, 2);
  muzzle.position.set(0, 0.03, -0.25); vm.add(muzzle);
  flashlight = new THREE.SpotLight(0xfff4e0, 0, 35, 0.5, 0.45, 1.4);
  flashlight.position.set(0.2, -0.1, 0);
  camera.add(flashlight);
  const t = new THREE.Object3D(); t.position.set(0.1, -0.1, -5); camera.add(t);
  flashlight.target = t;
}
let flashOn = false;

export function setEquipped(on) {
  ensureVisuals();
  if (on && !P.hasPistol) return;
  P.equipped = on;
  if (on && hold.item) dropHeld();
  vm.visible = on;
}
function toggleWeapon() {
  if (!P.hasPistol) { UI.toast('Du har inget vapen.'); return; }
  setEquipped(!P.equipped); SFX.click();
}
function toggleFlash() { ensureVisuals(); flashOn = !flashOn; flashlight.intensity = flashOn ? 40 : 0; SFX.click(); }

// ---------- skada ----------
export function damagePlayer(n, cause) {
  if (S.mode !== 'play' && S.mode !== 'read' && S.mode !== 'ui') return;
  P.hp -= n; UI.hurt(); SFX.hurt(); shake.kick += 0.4;
  if (P.hp <= 0) { P.hp = 0; EV.onDeath(cause); }
}
function drain(n, cause) { P.hp -= n; if (P.hp <= 0) { P.hp = 0; EV.onDeath(cause); } }

// ---------- vad tittar jag på? ----------
function findOwner(o) {
  while (o) {
    if (o.userData.item) return { kind: 'item', ref: o.userData.item };
    if (o.userData.int) return o.userData.int;
    o = o.parent;
  }
  return null;
}
function rayList() {
  const l = staticRay.concat(items.filter((i) => i !== hold.item).map((i) => i.mesh), creatureMeshes);
  for (const c of critters) if (c !== critterHold.c) l.push(c.hit);
  return l;
}
function computeLook() {
  ray.setFromCamera(center, camera); ray.far = 3.2;
  const hits = ray.intersectObjects(rayList(), true);
  S.look = null;
  for (const h of hits) {
    const o = findOwner(h.object);
    if (o && o.kind === 'mikko' && P.drag && P.drag.kind === 'mikko') continue;
    if (o && o.kind === 'spider' && P.drag && P.drag.ref === o.ref) continue;
    S.look = o ? { ...o, dist: h.distance } : null;
    break;
  }
}
function promptFor(L) {
  if (S.lidDrag) return 'Dra musen UPPÅT ↑';
  if (S.leverDrag) return 'Dra musen NEDÅT ↓';
  if (S.dig) return 'Gräver...';
  if (P.drag) return P.drag.kind === 'mikko' ? 'Drar Mikko... släpp musknappen vid graven' : 'Drar spindeln... släpp den vid labbets tank';
  if (critterHold.c) return 'Critter  —  [E] Knäck nacken  ·  släpp musknappen = släpp';
  if (hold.item) return `${hold.item.def.name}  —  [HÖGERKLICK] Kasta  ·  [SLÄPP] Släpp  ·  [F] Ryggsäck`;
  if (!L) return '';
  switch (L.kind) {
    case 'item': return `${L.ref.def.icon || ''} ${L.ref.def.name}  —  [F] Ta${P.equipped ? '' : '  ·  [HÅLL VÄNSTER] Greppa'}`;
    case 'lid': if (L.ref === SR.roverBox && L.ref.angle > 1.2 && rover.state === 'boxed') return 'Rover (hopfälld)  —  [E] Lyft ut';
      return L.ref.angle > 1.2 ? `${L.ref.name} (öppen)` : `${L.ref.name}  —  [HÅLL VÄNSTER MUS + DRA UPPÅT] Öppna${P.equipped ? '  (hölstra vapnet: Q)' : ''}`;
    case 'door': return `${L.ref.name}  —  [E] ${L.ref.open ? 'Stäng' : 'Öppna'}`;
    case 'o2st': return 'Syrestation  —  [E] Fyll på syre';
    case 'terminal': return 'Terminal  —  [E] Läs';
    case 'beacon': return `Fyren  —  [E] ${F.transmitter ? `Sätt in energiceller (${P.inserted}/3)` : 'Undersök / montera'}`;
    case 'mikko': return S.act === 'ship' ? (S.act1 === 'slip' ? 'Mikko  —  [E] Ta lappen' : 'Mikko  —  [E] Prata') : (F.bury === true && !grave.bodyIn ? 'Mikko  —  [HÅLL VÄNSTER] Dra kroppen' : 'Mikko  —  [E]');
    case 'button': return `${{ red: 'Röd', blue: 'Blå', green: 'Grön' }[L.id] || 'Färg'} knapp  —  [E] Tryck`;
    case 'lever': return `${L.ref.name}  —  [HÅLL VÄNSTER MUS + DRA NEDÅT]`;
    case 'photo': return 'Fotot  —  [E] Titta';
    case 'stool': return S.act === 'ship' ? 'Pall  —  [E] Sätt dig' : '';
    case 'labbench': return 'Labbänk  —  [E] Använd';
    case 'tank': return F.captured ? 'Provtank (spindel)  —  [E] Ta blodprov' : 'Provtank (tom)';
    case 'campfire': return F.campfire ? '' : `Lägereldsplats  —  [E] Bygg lägereld (3 stenar, har ${invCount3()})`;
    case 'grave': return grave.bodyIn ? 'Graven  —  [E] Fyll igen' : (F.bury ? (invHas('shovel') ? 'Gravplats  —  [HÅLL VÄNSTER] Gräv' : 'Gravplats (behöver spade)') : 'Mjuk jord');
    case 'rover': return rover.state === 'boxed' ? 'Rover (hopfälld)  —  [E] Lyft ut' : rover.mounted < 4 ? `Rover (${rover.mounted}/4 hjul)  —  [E] Montera hjul` : 'Rover  —  [E] Kliv in';
    case 'roverkey': return '';
    case 'spider': return L.ref.state === 'stun' ? 'Bedövad spindel  —  [HÅLL VÄNSTER] Dra' : (invHas('tranq') ? 'Spindel  —  [E] Bedöva (nära!)' : 'Spindel');
    case 'critter': return 'Critter  —  [HÅLL VÄNSTER] Grip den i huvudet';
    case 'crystal': return L.ref.userData.taken ? 'Kristall (tom)' : 'Kristall  —  [E] Bryt loss ett prov';
  }
  return '';
}
const invCount3 = () => { let n = 0; for (let i = 1; i <= 3; i++) if (invHas('rock', i)) n = i; return n; };

// ---------- input ----------
function interact() {
  if (P.rover) { exitRover(); return; }
  if (critterHold.c) { breakNeck(); return; }
  const L = S.look; if (!L) return;
  switch (L.kind) {
    case 'door': { const msg = toggleDoor(L.ref); if (msg) UI.toast(msg); break; }
    case 'o2st':
      if (P.o2 >= 99) UI.toast('Syret är redan fullt.');
      else { P.o2 = 100; SFX.hiss(); UI.toast('Syretanken påfylld', 'good'); }
      break;
    case 'terminal': interactTerminal(L.id); break;
    case 'beacon': interactBeacon(); break;
    case 'mikko': if (S.act === 'ship') act1Event('mikko'); else interactMikko(); break;
    case 'button': if (S.act === 'ship') act1Event('button', L.id); else { SR.buttons[L.id].glow = 1; SFX.blip(0.1); } break;
    case 'photo':
      if (S.act === 'ship') act1Event('photo');
      else UI.speak('you', 'Tummen upp, Mikko. Alltid tummen upp.', 2.5);
      break;
    case 'stool': if (S.act === 'ship') act1Event('stool'); break;
    case 'labbench': interactLab(); break;
    case 'tank': interactTank(); break;
    case 'campfire':
      if (F.campfire) break;
      if (!invHas('rock', 3)) { UI.toast('Du behöver 3 stenar i ryggsäcken. Plocka upp stenar med [F].'); break; }
      invTake('rock', 3); lightCampfire(); F.campfire = true; SFX.whoosh(); SFX.ok();
      UI.toast('Lägereld tänd! Lägg döda critters över elden för att grilla dem.', 'good');
      break;
    case 'grave': if (!fillGrave() && F.bury && !invHas('shovel')) UI.toast('Du behöver spaden från verktygshyllan.'); break;
    case 'rover': interactRover(); break;
    case 'spider': {
      const sp = L.ref;
      if (sp.state === 'walk' && invHas('tranq')) {
        if (sp.pos.distanceTo(P.pos) > 2.6) { UI.toast('Du måste vara närmare!'); break; }
        invTake('tranq'); sp.stun(80); F.tranq = true;
        UI.toast('Spindeln är bedövad! Dra den till labbets tank (håll vänster mus).', 'good');
      }
      break;
    }
    case 'crystal': {
      const m = L.ref;
      if (m.userData.taken) break;
      m.userData.taken = true; m.scale.multiplyScalar(0.55);
      invAdd('crystal'); SFX.clink(0.4); burst(m.position.clone(), 'goo', 8);
      UI.toast('+ 💎 Kristallprov', 'good');
      break;
    }
    case 'lid':
      if (L.ref === SR.roverBox && L.ref.angle > 1.2 && rover.state === 'boxed') { interactRover(); break; }
      UI.toast('Håll VÄNSTER musknapp på locket och dra musen uppåt.'); break;
    case 'lever': UI.toast('Håll VÄNSTER musknapp på spaken och dra musen nedåt.'); break;
    case 'item': pickUp(L.ref); break;
  }
}
export function onKeyDown(e) {
  if (S.mode !== 'play') return;
  switch (e.code) {
    case 'KeyE': interact(); break;
    case 'KeyF':
      if (hold.item) { pickUp(hold.item); }
      else if (S.look && S.look.kind === 'item') pickUp(S.look.ref);
      break;
    case 'KeyG': if (hold.item) dropHeld(); if (critterHold.c) releaseCritter(); break;
    case 'Digit1': case 'KeyQ': if (!P.rover) toggleWeapon(); break;
    case 'KeyL': toggleFlash(); break;
  }
}
export function onMouseDown(e) {
  if (S.mode !== 'play' || !S.locked) return;
  if (P.rover) { if (e.button === 0 && S.look && S.look.kind === 'roverkey' && !rover.started) S.keyDrag = true; else if (e.button === 0 && !rover.started) { computeRoverKeyLook(); } return; }
  if (e.button === 0) {
    if (P.equipped) { shoot(); return; }
    const L = S.look; if (!L) return;
    if (L.kind === 'lid') { S.lidDrag = L.ref; L.ref.dragging = true; L.ref.dragDelta = 0; }
    else if (L.kind === 'lever') { S.leverDrag = L.ref; L.ref.dragging = true; }
    else if (L.kind === 'item') grabItem(L.ref);
    else if (L.kind === 'critter') grabCritter(L.ref);
    else if (L.kind === 'mikko' && S.act === 'planet' && F.bury === true && !grave.bodyIn) {
      P.drag = { kind: 'mikko' }; scene.attach(cast.mikko.root); cast.mikko.setPose('dragged'); cast.mikko.pose = 'dragged';
      if (cast.armProp) cast.armProp.visible = true;
    }
    else if (L.kind === 'spider' && L.ref.state === 'stun') { P.drag = { kind: 'spider', ref: L.ref }; }
    else if (L.kind === 'grave' && F.bury === true && invHas('shovel') && grave.dug < 1) S.dig = true;
  } else if (e.button === 2 && hold.item) {
    const d = new V3(); camera.getWorldDirection(d); throwHeld(d);
  }
}
// i rovern: tittar man på nyckeln? (enkelt: vänster musknapp startar nyckel-dragningen)
function computeRoverKeyLook() { if (rover.keyPiv.visible) S.keyDrag = true; else UI.toast('Ingen nyckel i tändningslåset.'); }

export function onMouseUp(e) {
  if (e.button !== 0) return;
  if (S.lidDrag) { S.lidDrag.dragging = false; S.lidDrag = null; }
  if (S.leverDrag) { S.leverDrag.dragging = false; S.leverDrag = null; }
  S.keyDrag = false; S.dig = false;
  if (hold.item) { const it = hold.item; dropHeld(); tryMountDropped(it); }
  if (critterHold.c) releaseCritter();
  if (P.drag) {
    const d = P.drag; P.drag = null;
    if (d.kind === 'spider') tryCapture(d.ref);
    if (d.kind === 'mikko') { if (!tryLowerBody()) { cast.mikko.setPose('dragged'); cast.mikko.pose = 'static'; } }
  }
}
export function onMouseMove(e) {
  if (S.mode !== 'play' || !S.locked) return;
  if (P.rover) { if (S.keyDrag) turnKey(e.movementX); else roverMouse(e); return; }
  if (S.lidDrag) {
    const c = S.lidDrag, before = c.angle;
    c.angle = clamp(c.angle - e.movementY * 0.006, 0, 1.95);
    c.dragDelta += c.angle - before;
    P.yaw -= e.movementX * 0.0008;
    return;
  }
  if (S.leverDrag) { S.leverDrag.angle = clamp(S.leverDrag.angle + e.movementY * 0.008, 0, S.leverDrag.max); return; }
  P.yaw -= e.movementX * 0.0022;
  P.pitch = clamp(P.pitch - e.movementY * 0.0022, -1.5, 1.5);
}

// ---------- skjuta ----------
const tracers = [];
const tracerGeo = new THREE.BoxGeometry(0.03, 0.03, 1);
export function spawnTracer(a, b, color = 0x5ee6ff) {
  const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(a).lerp(b, 0.5); m.scale.z = a.distanceTo(b); m.lookAt(b);
  scene.add(m); tracers.push({ m, t: 0.14 });
}
let shootCd = 0, recoil = 0;
function shoot() {
  if (shootCd > 0) return;
  shootCd = 0.2;
  if (P.pistolBroken) { SFX.empty(); burst(muzzle.getWorldPosition(new V3()), 'spark', 4); UI.toast('Pistolen är trasig! Laga den i labbet.', 'bad'); return; }
  if (P.ammo <= 0) { SFX.empty(); UI.toast('Slut på plasma! Kasta saker istället.', 'bad'); return; }
  P.ammo--; SFX.shoot(); recoil = 1; muzzle.intensity = 15; shake.kick += 0.15;
  ray.setFromCamera(center, camera); ray.far = 150;
  const targets = staticRay.concat(creatureMeshes, items.filter((i) => i !== hold.item).map((i) => i.mesh), critters.map((c) => c.hit));
  if (terrain) targets.push(terrain);
  const hits = ray.intersectObjects(targets, true);
  const h = hits.find((x) => !(x.object.userData.int && x.object.userData.int.kind === 'spider' && x.object.userData.creature && x.object.userData.creature.dead));
  const end = h ? h.point.clone() : ray.ray.at(150, new V3());
  if (h) {
    const cr = h.object.userData.creature;
    const owner = findOwner(h.object);
    if (cr) cr.damage(34, ray.ray.direction.clone());
    else if (owner && owner.kind === 'critter') shootCritter(owner.ref);
    else if (owner && owner.kind === 'item') {
      if (owner.ref.type === 'critter_dead') { transformItem(owner.ref, 'meatfine'); UI.toast('Bra skott. Fint kött!', 'good'); }
      else owner.ref.vel.addScaledVector(ray.ray.direction, 8 / owner.ref.mass);
    }
    burst(end, cr ? 'goo' : 'spark', 10);
  }
  spawnTracer(muzzle.getWorldPosition(new V3()), end);
  // pistolen kan gå sönder efter att antigiftet är klart
  if (P.antivenom && !P.brokeOnce) {
    P.shotsSinceAnti++;
    if (P.shotsSinceAnti > 2 && Math.random() < 0.3) { P.brokeOnce = true; breakPistol(); SFX.spark(0.5); burst(muzzle.getWorldPosition(new V3()), 'spark', 20); shake.kick += 0.5; }
  }
}

// ---------- uppdatering ----------
const fwd = new V3(), right = new V3(), want = new V3();
let bobT = 0, lastStep = 0, warnT = 0;

export function resetPlayer(local = [0.4, 0, -3.6], yaw = -Math.PI / 2) {
  const p = ship.localToWorld(new V3(...local));
  P.pos.copy(p); P.vel.set(0, 0, 0);
  P.yaw = yaw; P.pitch = -0.1;
}
export function respawn() {
  if (P.rover) exitRover();
  resetPlayer([0, 0, 2.5], Math.PI);
  P.hp = 100; P.o2 = 100; P.food = Math.max(P.food, 60); P.stamina = 100; P.venom = 0;
  killAllNear(ship.position, 35);
  S.lidDrag = null; S.leverDrag = null; dropHeld(); releaseCritter(); P.drag = null;
}

export function updatePlayer(dt) {
  ensureVisuals();
  if (P.rover) {
    updateRover(dt, keys);
    vm.visible = false;
  } else {
    vm.visible = P.equipped;
    fwd.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
    right.set(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
    let mx = 0, mz = 0;
    if (keys.KeyW) mz += 1; if (keys.KeyS) mz -= 1; if (keys.KeyD) mx += 1; if (keys.KeyA) mx -= 1;
    want.set(0, 0, 0).addScaledVector(fwd, mz).addScaledVector(right, mx);
    if (want.lengthSq() > 0) want.normalize();
    const sprint = (keys.ShiftLeft || keys.ShiftRight) && P.stamina > 1 && mz > 0 && !P.drag;
    if (sprint) P.stamina = Math.max(0, P.stamina - dt * 22); else P.stamina = Math.min(100, P.stamina + dt * 14);
    let spd = sprint ? 7.2 : 4.3;
    if (hold.item && hold.item.mass > 2.5) spd *= 0.8;
    if (P.drag) spd *= 0.5;
    if (S.dig) spd = 0;
    const k = 1 - Math.exp(-(P.onGround ? 12 : 2.5) * dt);
    P.vel.x += (want.x * spd - P.vel.x) * k;
    P.vel.z += (want.z * spd - P.vel.z) * k;
    P.vel.y -= 13 * dt;
    if (keys.Space && P.onGround && !P.drag) { P.vel.y = 5.6; P.onGround = false; }
    P.pos.addScaledVector(P.vel, dt);
    const r = Math.hypot(P.pos.x, P.pos.z);
    if (r > 410) { P.pos.x *= 410 / r; P.pos.z *= 410 / r; }
    const { sup, ceil } = resolveChar(P.pos, P.vel, 0.35, 1.75);
    if (P.pos.y + 1.8 > ceil && P.vel.y > 0) { P.vel.y = 0; P.pos.y = ceil - 1.8; }
    if (P.pos.y <= sup) {
      if (!P.onGround && P.vel.y < -7) { SFX.land(); if (P.vel.y < -13) damagePlayer((-P.vel.y - 13) * 6, 'Föll för långt'); }
      P.pos.y = sup; P.vel.y = Math.max(0, P.vel.y); P.onGround = true;
    } else if (P.onGround && P.vel.y <= 0 && P.pos.y - sup < 0.35) { P.pos.y = sup; P.vel.y = 0; }
    else P.onGround = false;
    const hs = Math.hypot(P.vel.x, P.vel.z);
    if (P.onGround && hs > 0.5) {
      bobT += dt * hs * 1.9;
      const st = Math.floor(bobT / Math.PI);
      if (st !== lastStep) { lastStep = st; SFX.step(); }
    }
    const bob = Math.sin(bobT) * 0.045 * Math.min(1, hs / 4) + (S.dig ? Math.sin(S.time * 9) * 0.08 : 0);
    camera.position.set(P.pos.x, P.pos.y + 1.62 + bob, P.pos.z);
    camera.rotation.set(P.pitch + (S.dig ? Math.sin(S.time * 9) * 0.06 : 0), P.yaw, 0, 'YXZ');
  }

  shootCd -= dt; recoil = Math.max(0, recoil - dt * 8);
  muzzle.intensity = Math.max(0, muzzle.intensity - dt * 120);
  vm.position.set(0.2 + Math.cos(bobT * 0.5) * 0.01, -0.2 + Math.abs(Math.sin(bobT)) * 0.012 - recoil * 0.02, -0.45 + recoil * 0.07);
  vm.rotation.x = recoil * 0.25;
  vm.rotation.z = P.pistolBroken ? Math.sin(S.time * 30) * 0.01 : 0;
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i]; t.t -= dt; t.m.material.opacity = Math.max(0, t.t / 0.14);
    if (t.t <= 0) { scene.remove(t.m); t.m.material.dispose(); tracers.splice(i, 1); }
  }
  if (S.mode !== 'play') return;

  if (S.dig) { if (S.look && S.look.kind === 'grave') digTick(dt); else S.dig = false; }
  updateDragBody(dt);

  // överlevnad (bara på planeten)
  if (S.act === 'planet') {
    S.playTime += dt;
    P.o2 = Math.max(0, P.o2 - dt * 0.38);
    P.food = Math.max(0, P.food - dt * 0.16);
    if (P.o2 <= 0) drain(7 * dt, 'Syret tog slut');
    if (P.food <= 0) drain(2 * dt, 'Svalt ihjäl');
    if (P.venom > 0) { drain(P.venom * 0.05 * dt, 'Spindelgift'); P.venom = Math.max(0, P.venom - dt * 1.2); }
    if (P.food > 50 && P.o2 > 25 && P.venom <= 0 && P.hp < 100) P.hp = Math.min(100, P.hp + dt * 0.6);
    warnT -= dt;
    if (P.o2 < 25 && warnT <= 0) { warnT = 1.6; SFX.warn(); UI.tip('o2', 'SYRET TAR SLUT! Syrestationer finns i Sparven och i byggnader. Syretuber ligger utspridda.'); }
    UI.lowO2(P.o2 < 25 ? (1 - P.o2 / 25) * 0.9 : 0);
    UI.venom(P.venom > 0 ? Math.min(0.8, P.venom / 60) : 0);
  }

  if (S.lidDrag && camera.position.distanceTo(S.lidDrag.grp.getWorldPosition(new V3())) > 4) { S.lidDrag.dragging = false; S.lidDrag = null; }
  if (P.rover) {
    S.look = null;
    UI.setPrompt(!rover.started ? (rover.keyPiv.visible ? '[HÅLL VÄNSTER MUS + DRA HÖGER] Vrid nyckeln  ·  [E] Kliv ur' : 'Ingen nyckel  ·  [E] Kliv ur') : `${Math.round(Math.abs(rover.speed) * 3.6)} km/h  ·  [E] Kliv ur`);
  } else {
    computeLook();
    UI.setPrompt(promptFor(S.look));
  }
  UI.updateHUD(P);
}
