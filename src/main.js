// VDown – startpunkt. Laddar modeller, bygger världen, kopplar ihop menyer/input och kör spel-loopen.
import './styles/main.css';
import * as THREE from 'three';
import { scene, camera, canvas, render } from './core/render.js';
import { $, V3, updateTweens, hooks, cine, rand } from './core/utils.js';
import { initAudio, loop, setMuted, isMuted, SFX } from './core/audio.js';
import { loadAssets } from './core/assets.js';
import { P, S, F, EV } from './game/state.js';
import * as UI from './ui/ui.js';
import { toggleInventory, closeInventory, invOpen } from './ui/invui.js';
import { buildShip, updateShip, ship, SR, setShipLights } from './world/ship.js';
import { buildSpace, updateSpace } from './world/space.js';
import { buildPlanet, updatePlanet, spawnWorldItems, groundH as planetGround, LOC } from './world/planet.js';
import { buildRover, updateRover, rover } from './world/rover.js';
import { crates, spawnCrateContents, updateProps } from './world/props.js';
import { registerColliders, setGround } from './systems/physics.js';
import { makeAstronaut } from './entities/astronaut.js';
import { updateItems, dropHeld, items, Item } from './entities/items.js';
import { updateCreatures, spawnInitialCreatures, creatures } from './entities/creatures.js';
import { updateCritters, spawnCritters, critters } from './entities/critters.js';
import { updateParticles } from './systems/particles.js';
import { updatePlayer, onMouseDown, onMouseUp, onMouseMove, onKeyDown, keys, respawn, resetPlayer } from './game/player.js';
import { updateObjectives, startPlanetObjectives } from './game/objectives.js';
import { startAct1, updateAct1, act1Event } from './game/preflight.js';
import { runOpening, runEnding, menuScene, runAsteroid } from './game/cutscenes.js';
import { labStatus } from './game/lab.js';
import { cast } from './game/cast.js';
import { INV, invAdd } from './game/inventory.js';
import * as PLANET from './world/planet.js';

let ready = false;

// ---------- ladda modeller, bygg sedan världen ----------
loadAssets((p) => { $('loadPct').textContent = Math.round(p * 100) + '%'; }).then(() => {
  setGround(() => -1000);           // i rymden finns ingen mark
  buildShip();
  buildSpace();
  buildPlanet();
  setGround(() => -1000);
  buildRover();
  cast.mikko = makeAstronaut('mikko');
  cast.you = makeAstronaut('ciro');
  cast.mikko.root.userData.int = { kind: 'mikko' };
  cast.mikko.hit.userData.int = { kind: 'mikko' };
  ship.add(cast.mikko.root, cast.you.root);
  UI.registerSpeaker('mikko', cast.mikko);
  UI.registerSpeaker('you', cast.you);
  SR.cols = registerColliders(ship);
  SR.onGenerator = onGenerator;
  labStatus();
  menuScene();
  ready = true;
  $('loading').classList.add('hidden');
  $('bStart').classList.remove('hidden');
}).catch((e) => { $('loading').textContent = 'Kunde inte ladda modellerna: ' + e.message; console.error(e); });

function onGenerator(on) {
  if (on) { SFX.engineStart(); }
  if (S.act === 'ship' && on) act1Event('generator');
  if (S.act === 'planet' && on) {
    F.generator = true;
    setShipLights('power');
    UI.toast('Reservgeneratorn går! Sparven har ström igen.', 'good');
    UI.speak('you', 'Ljus. Värme. Hemma, typ.', 2);
  }
  labStatus();
}

// ---------- AKT 1: ombord ----------
EV.startAct1 = () => {
  S.mode = 'play'; S.act = 'ship';
  scene.add(camera); camera.rotation.set(0, 0, 0);
  resetPlayer([0.3, 0, 0.6], 0);
  // föremål i skeppet
  const W = (x, y, z) => ship.localToWorld(new V3(x, y, z));
  new Item('backpack', W(2.7, 1.45, 4.5));
  new Item('meatballs', W(-2.6, 0.7, -0.95));
  new Item('juice', W(-2.65, 0.25, -1.0));
  new Item('food', W(-2.65, 0.25, -0.7));
  new Item('tranq', W(-2.82, 1.15, 7.9)); new Item('tranq', W(-2.82, 1.15, 8.2));
  new Item('syringe', W(-2.82, 1.55, 7.9)); new Item('syringe', W(-2.82, 1.55, 8.25));
  new Item('med', W(-2.82, 1.25, 8.4));
  new Item('shovel', W(2.75, 1.2, 5.9));
  new Item('cup', W(-2.6, 1.0, 3.4));
  new Item('o2', W(-2.55, 0.22, 7.15));
  new Item('o2', W(-2.55, 0.22, 7.45));
  SR.weapons.contents = [
    ['wheel', {}, { x: -0.36, y: 0.34, z: 0.30 }],
    ['wheel', {}, { x: 0.36, y: 0.34, z: 0.30 }],
    ['wheel', {}, { x: -0.36, y: 0.34, z: -0.08 }],
    ['wheel', {}, { x: 0.36, y: 0.34, z: -0.08 }],
    ['pistol', {}, { x: -0.22, y: 0.20, z: -0.48 }],
    ['ammo', {}, { x: 0.10, y: 0.12, z: -0.50 }],
    ['ammo', {}, { x: 0.32, y: 0.12, z: -0.50 }],
  ];
  SR.storage[1].contents = ['o2', 'food', 'food'];
  crates.filter((c) => c.grp.parent === ship || c === SR.keyBox).forEach(spawnCrateContents);
  UI.showHUD(true);
  startAct1();
  UI.show('clickPlay', !S.locked);
  setTimeout(() => UI.tip('move', 'WASD = gå · Shift = spring · E = interagera · F = ta upp · TAB = ryggsäck'), 1500);
};

// ---------- AKT 2: planeten ----------
EV.startGameplay = () => {
  S.mode = 'play'; S.act = 'planet';
  setGround(planetGround);
  scene.add(camera); camera.rotation.set(0, 0, 0);
  resetPlayer([0.4, 0, -3.6], -Math.PI / 2);
  crates.filter((c) => c.grp.parent !== ship && c !== SR.keyBox && c !== SR.roverBox).forEach(spawnCrateContents);
  spawnWorldItems();
  spawnInitialCreatures();
  const cl = [];
  for (let i = 0; i < 8; i++) { const a = rand(0, 6.28), d = rand(18, 60); cl.push([Math.cos(a) * d, Math.sin(a) * d]); }
  for (let i = 0; i < 16; i++) { const a = rand(0, 6.28), d = rand(60, 320); cl.push([Math.cos(a) * d, Math.sin(a) * d]); }
  spawnCritters(cl);
  loop('wind', 0.07, 2);
  UI.showHUD(true);
  startPlanetObjectives();
  UI.show('clickPlay', !S.locked);
  setTimeout(() => UI.tip('crate', 'Lådor öppnas för hand: HÅLL vänster musknapp på locket och DRA musen uppåt.'), 6000);
  setTimeout(() => UI.tip('critters', 'Små critters hoppar runt. Grip dem i huvudet (håll vänster mus), knäck nacken med E och grilla dem över eld.'), 40000);
};
EV.onDeath = (cause) => {
  S.mode = 'dead'; dropHeld(); S.lidDrag = null; P.drag = null;
  if (document.pointerLockElement) document.exitPointerLock();
  UI.show('clickPlay', false);
  UI.showDeath(cause);
};
EV.onWin = () => runEnding();

// ---------- pekarlås ----------
function lock() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignoreras */ } }
EV.relock = () => { if (S.softLock) { S.locked = true; return; } lock(); };
UI.UIHooks.relock = EV.relock;
canvas.addEventListener('click', () => { if (S.mode === 'play' && !S.locked) lock(); });
$('clickPlay').addEventListener('click', lock);
document.addEventListener('pointerlockchange', () => {
  S.locked = document.pointerLockElement === canvas;
  if (S.locked) {
    UI.show('clickPlay', false);
    if (S.mode === 'pause') { S.mode = 'play'; UI.show('pause', false); }
  } else if (S.mode === 'play' || S.mode === 'read') {
    UI.closeReader();
    S.mode = 'pause'; S.lidDrag = null; dropHeld(); P.drag = null;
    UI.show('pause', true);
  }
});
document.addEventListener('pointerlockerror', () => {
  if (S.mode !== 'play' && S.mode !== 'pause') return;
  S.softLock = true; S.locked = true;
  UI.show('clickPlay', false); UI.show('pause', false);
  if (S.mode === 'pause') S.mode = 'play';
});

// ---------- tangentbord & mus ----------
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();
  if (UI.qteActive() && e.code === UI.qteKey() && !e.repeat) UI.qtePress();
  if (e.code === 'Enter' && S.mode === 'cine' && S.skippable) { cine.skipping = true; return; }
  if (e.code === 'Tab' && !e.repeat) { if (invOpen()) closeInventory(); else if (S.mode === 'play') toggleInventory(); return; }
  if (e.code === 'Escape' && S.mode === 'ui') { closeInventory(); UI.closeModal(); return; }
  if (e.code === 'Escape' && S.softLock && (S.mode === 'play' || S.mode === 'read')) {
    UI.closeReader(); S.mode = 'pause'; S.locked = false; dropHeld(); UI.show('pause', true); return;
  }
  if (S.mode === 'read' && !e.repeat && (e.code === 'KeyF' || e.code === 'KeyE' || e.code === 'Enter')) { UI.closeReader(); return; }
  if (!e.repeat) onKeyDown(e);
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('mousedown', onMouseDown);
addEventListener('mouseup', onMouseUp);
addEventListener('mousemove', onMouseMove);
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
$('reader').addEventListener('click', () => UI.closeReader());
$('bInvClose').onclick = () => closeInventory();
$('bModalClose').onclick = () => UI.closeModal();

// ---------- menyknappar ----------
let musicOn = false;
addEventListener('pointerdown', () => {
  initAudio();
  if (!musicOn && S.mode === 'menu') { musicOn = true; loop('music', 0.035, 2); }
}, { once: true });
$('bStart').onclick = () => {
  if (!ready) return;
  initAudio(); loop('music', 0, 1);
  UI.show('menu', false);
  runOpening();
};
$('bLore').onclick = () => UI.show('lorePanel', true);
$('bCtrl').onclick = () => UI.show('ctrlPanel', true);
$('bPauseCtrl').onclick = () => UI.show('ctrlPanel', true);
$('bSound').onclick = () => { initAudio(); setMuted(!isMuted()); $('bSound').textContent = isMuted() ? 'LJUD: AV' : 'LJUD: PÅ'; };
document.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => UI.show(b.dataset.close, false); });
$('bResume').onclick = () => { if (S.softLock) { S.mode = 'play'; S.locked = true; UI.show('pause', false); } else lock(); };
$('bQuit').onclick = $('bQuit2').onclick = () => location.reload();
$('bRetry').onclick = () => {
  respawn();
  UI.show('death', false);
  S.mode = 'play';
  UI.toast('Du vaknar upp i Sparven igen...', 'tip');
  if (!S.locked) { UI.show('clickPlay', true); lock(); }
};

// ---------- ljudmiljö (ambiens) ----------
const _cp = new V3();
let blipT = 0, creakT = 5;
function ambience(dt) {
  if (S.mode === 'menu') return;
  camera.getWorldPosition(_cp);
  const dist = (x, y, z) => _cp.distanceTo(ship.localToWorld(new V3(x, y, z)));
  const cockD = dist(0, 1.4, -7.6), genD = dist(-2.4, 1, 6.3);
  const inShip = ship.worldToLocal(_cp.clone()); const inside = Math.abs(inShip.x) < 3.2 && inShip.z > -9 && inShip.z < 9.2 && inShip.y < 3.2;
  const powered = S.act === 'ship' || SR.genOn;
  loop('cockpit', powered ? Math.max(0.0001, 0.035 * (1 - cockD / 9)) : 0.0001, 0.3);
  loop('gen', SR.genOn ? Math.max(0.0001, 0.07 * (1 - genD / 14)) : 0.0001, 0.3);
  loop('vent', inside && powered ? 0.012 : 0.0001, 0.5);
  blipT -= dt;
  if (powered && cockD < 7 && blipT <= 0) { blipT = rand(0.3, 1.6); SFX.blip(0.025 * (1 - cockD / 7)); }
  if (S.act === 'planet' && inside) { creakT -= dt; if (creakT <= 0) { creakT = rand(6, 15); SFX.creakBig(); } }
  const fireD = Math.min(_cp.distanceTo(new V3(2, planetGround(2, 18), 18)), _cp.distanceTo(new V3(-3, planetGround(-3, 30), 30)), F.campfire ? _cp.distanceTo(new V3(LOC.CAMPFIRE.x, planetGround(LOC.CAMPFIRE.x, LOC.CAMPFIRE.z), LOC.CAMPFIRE.z)) : 99);
  loop('fire', S.act === 'planet' ? Math.max(0.0001, 0.08 * (1 - fireD / 14)) : 0.0001, 0.3);
}

// ---------- spel-loop ----------
const clock = new THREE.Clock();
let labT = 0;
function frame() {
  requestAnimationFrame(frame);
  tick(Math.min(clock.getDelta(), 0.05), true);
}
function tick(dt, draw) {
  S.time += dt;
  updateTweens(dt);
  hooks.forEach((h) => h(dt));
  if (!ready) { if (draw) render(dt); return; }
  if (S.mode === 'play' || S.mode === 'read' || S.mode === 'ui') {
    if (S.mode === 'play') updatePlayer(dt);
    updateCreatures(dt);
    updateObjectives(dt);
    updateAct1(dt);
  } else if (S.mode === 'ending' || S.mode === 'cine') updateCreatures(dt);
  if (S.mode !== 'pause' && S.mode !== 'dead' && S.mode !== 'menu' && S.mode !== 'cine') { updateItems(dt); updateCritters(dt); }
  if (!P.rover) updateRover(dt, keys);
  cast.mikko.update(dt);
  if (cast.you.root.visible) cast.you.update(dt);
  updateProps(dt);
  updateShip(dt, S.time);
  updateSpace(dt);
  updatePlanet(dt);
  updateParticles(dt);
  ambience(dt);
  labT -= dt; if (labT <= 0) { labT = 1; labStatus(); }
  UI.update(dt);
  if (draw) render(dt); else scene.updateMatrixWorld();
}
frame();

// felsökning i webbläsarens konsol: VDOWN.step(60) kör spelet 1 sekund framåt
window.VDOWN = { P, S, F, keys, items, creatures, critters, crates, ship, SR, INV, rover, cast, skip: () => { cine.skipping = true; }, runAsteroid, invAdd, PLANET, step: (n = 60) => { for (let i = 0; i < n; i++) tick(1 / 60, false); } };
