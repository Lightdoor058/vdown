// Filmscener: meny, öppning, asteroiden + kraschen + uppvaknandet, Mikko-ögonblicket i labbet och slutet.
import * as THREE from 'three';
import { V3, lerp, clamp, rand, pick, ease, wait, anim, cine, hooks, chk } from '../core/utils.js';
import { scene, camera, shake } from '../core/render.js';
import { SFX, loop, alarm, setHeartbeat, holdTone } from '../core/audio.js';
import { ship, SR, setShipLights } from '../world/ship.js';
import { asteroid } from '../world/space.js';
import { setEnv } from '../world/env.js';
import { groundH } from '../systems/physics.js';
import { shipY, LOC, rescue } from '../world/planet.js';
import { M } from '../world/materials.js';
import { burst, FX } from '../systems/particles.js';
import { creatures } from '../entities/creatures.js';
import { dropHeld } from '../entities/items.js';
import * as UI from '../ui/ui.js';
import { P, S, F, EV } from './state.js';
import { cast, mikkoInjured, mikkoDead } from './cast.js';
import { setupCrashSite, freezeShipItems } from './crash.js';
import { spawnTracer } from './player.js';

// ---------- kamerahjälp ----------
const _t = new V3();
function camIn(parent) { parent.add(camera); camera.rotation.set(0, 0, 0); }
function camSet(px, py, pz, lx, ly, lz, roll = 0) {
  camera.position.set(px, py, pz);
  _t.set(lx, ly, lz);
  if (camera.parent !== scene) camera.parent.localToWorld(_t);
  camera.lookAt(_t);
  if (roll) camera.rotateZ(roll);
}
function camSetW(pos, look, roll = 0) { camera.position.copy(pos); camera.lookAt(look); if (roll) camera.rotateZ(roll); }
const W = (x, y, z) => ship.localToWorld(new V3(x, y, z));
const sayS = (who, t, o = {}) => UI.say(who, t, { sub: true, ...o });

let spinRate = 0;
const spinHook = (dt) => { ship.rotation.y += spinRate * dt; };
let menuHook = null;

function seatChars() {
  const { mikko, you } = cast;
  mikko.path = null; you.path = null;
  mikko.root.position.set(1.8, -0.24, -3.4); mikko.root.rotation.set(0, 0, 0); mikko.targetYaw = 0; mikko.setPose('sit', true); mikko.root.visible = true;
  you.root.position.set(1.8, -0.24, -1.4); you.root.rotation.set(0, Math.PI, 0); you.targetYaw = Math.PI; you.setPose('sit', true); you.root.visible = true;
}

export function menuScene() {
  setEnv('space');
  ship.position.set(0, 0, 0); ship.rotation.set(0, 0, 0);
  seatChars();
  camIn(scene);
  menuHook = () => {
    const a = S.time * 0.05;
    camera.position.set(Math.cos(a) * 23, 4 + Math.sin(S.time * 0.1) * 1.5, Math.sin(a) * 23);
    camera.lookAt(0, 1, 0);
    ship.rotation.z = Math.sin(S.time * 0.3) * 0.03;
  };
  hooks.add(menuHook);
  UI.fade(0, 2);
}

// ================= ÖPPNING =================
export async function runOpening() {
  S.mode = 'cine'; S.skippable = true; cine.skipping = false;
  UI.letterbox(true); UI.skipHint(true); UI.fade(1, 0.8);
  try {
    await wait(0.9);
    hooks.delete(menuHook);
    ship.position.set(0, 0, 0); ship.rotation.set(0, 0, 0);
    setShipLights('normal');
    loop('hum', 0.05);
    camIn(scene);
    UI.fade(0, 3);
    UI.caption('SEKTOR 7G  ·  OPHION-SYSTEMET  ·  ÅR 2187');
    await anim(4.5, (k) => camSet(lerp(-34, -18, k), lerp(8, 4, k), lerp(-18, 2, k), 0, 1, 0), ease.lin);
    UI.caption('FRAKTSKEPPET SPARVEN  —  DAG 63 AV 84');
    await anim(4, (k) => camSet(lerp(-18, -9, k), lerp(4, 2.4, k), lerp(2, 12, k), 0, 1.2, -1), ease.out);
    UI.caption('');
    camIn(ship);
    const m = cast.mikko;
    m.root.position.set(0.6, 0, -2.6); m.root.rotation.set(0, Math.PI, 0); m.targetYaw = Math.PI; m.setPose('idle', true);
    cast.you.root.visible = false;
    camSet(0.4, 1.65, -0.6, 0.6, 1.4, -2.6);
    UI.fade(0, 1);
    await anim(2.5, (k) => camSet(0.4, 1.65, lerp(-0.6, -0.9, k), 0.6, 1.4, -2.6), ease.inOut);
  } catch (e) { if (!e || !e.skip) throw e; }
  finishOpening();
}
function finishOpening() {
  cine.skipping = true;
  hooks.delete(menuHook);
  UI.clearLines(); UI.letterbox(false); UI.skipHint(false); UI.caption('');
  ship.position.set(0, 0, 0); ship.rotation.set(0, 0, 0);
  setShipLights('normal');
  loop('hum', 0.05);
  S.skippable = false;
  UI.fade(0, 1);
  EV.startAct1();
}

// ================= ASTEROIDEN + KRASCHEN =================
const junk = [];
const shards = [];
export async function runAsteroid() {
  S.mode = 'cine'; S.skippable = true; cine.skipping = false;
  if (document.pointerLockElement) document.exitPointerLock();
  UI.letterbox(true); UI.skipHint(true); UI.showHUD(false); UI.setMarkers([]); UI.setPrompt('');
  dropHeld();
  freezeShipItems();
  const { mikko, you } = cast;
  try {
    UI.fade(1, 0.5); await wait(0.6);
    seatChars();
    camIn(ship);
    const wide = () => camSet(-0.9, 1.55, -2.4, 1.8, 1.15, -2.4);
    const onMikko = () => camSet(0.75, 1.55, -0.55, 1.85, 1.25, -3.4);
    const onYou = () => camSet(0.75, 1.55, -4.25, 1.85, 1.25, -1.4);
    wide(); UI.fade(0, 1);
    await wait(0.8);
    await UI.say('mikko', 'Kolla där ute. Veyra. Ingen har satt sin fot där sen Ödla-expeditionen försvann.');
    onYou(); await UI.say('you', 'Mysigt. Tack för den, Mikko.');
    onMikko(); await UI.say('mikko', 'Fast seriöst... varför skickar Helion oss så nära? Genom ett asteroidbälte?');
    onYou(); await UI.say('you', 'Bränsleoptimering, sa de ju.');
    wide(); await UI.say('mikko', 'Ingen optimerar bränsle genom ett asteroidbälte, Ciro. Nåt är skumt.');
    // Mikko går till fönstret
    mikko.root.position.y = 0; mikko.setPose('idle');
    mikko.walkTo([[2.65, -3.3]], null, 'idle', Math.PI / 2);
    await wait(1.4);
    await UI.say('mikko', '...Vänta.', { hold: 0.7 });
    await UI.say('mikko', 'Vad är det där?', { hold: 0.5 });

    // --- asteroiden ---
    camSet(1.2, 1.75, -0.4, 8.2, 1.75, -7.6);
    asteroid.visible = true;
    const A0 = new V3(263.7, 29.75, -217.4), A1 = new V3(73.2, -4.25, -90.4), A2 = new V3(3.9, 1.7, -2.4);
    loop('tension', 0.06, 1);
    mikko.setPose('point');
    const flight = anim(5.5, (k) => {
      const u = 1 - k;
      asteroid.position.set(u * u * A0.x + 2 * u * k * A1.x + k * k * A2.x, u * u * A0.y + 2 * u * k * A1.y + k * k * A2.y, u * u * A0.z + 2 * u * k * A1.z + k * k * A2.z);
      FX.trail(asteroid.position);
      shake.base = k * 0.04;
    }, ease.in);
    const talk = (async () => {
      await wait(0.5);
      await UI.say('you', 'Är det... rör den sig MOT oss?!', { hold: 0.4 });
      await UI.say('mikko', 'Den SVÄNGDE! Den svängde rakt mot oss!', { hold: 0.3 });
      await UI.say('mikko', 'HÅLL I DIG!!', { hold: 0.2 });
    })();
    await Promise.all([flight, talk]);

    // --- KRASCH ---
    asteroid.visible = false;
    UI.flash('#fff', 1.4); SFX.explosion(1.5); shake.kick = 3.5;
    SR.brokenGlass.visible = false;
    const wp = W(3.1, 1.7, -2.4);
    burst(wp, 'spark', 50); burst(wp, 'fire', 30); burst(wp, 'smoke', 12);
    alarm(true); setShipLights('alarm'); loop('rumble', 0.25);
    spinRate = 0; hooks.add(spinHook);
    spawnJunk();
    camSet(-2.5, 2.4, 1.6, 1.0, 1.0, -3.5);
    shake.base = 0.05;
    you.root.position.y = 0; you.setPose('idle', true); you.root.position.set(1.0, 0, -1.0);
    const m0 = mikko.root.position.clone(), m1 = new V3(-1.1, 0.35, -4.4);
    mikko.path = null;
    await anim(0.7, (k) => {
      mikko.root.position.lerpVectors(m0, m1, k);
      mikko.root.position.y = Math.sin(k * Math.PI) * 1.1 + lerp(0, 0.35, k);
      mikko.root.rotation.z = k * 1.4;
      spinRate = k * 3.2;
    }, ease.out);
    mikko.setPose('lie', true); mikko.root.position.copy(m1); mikko.root.rotation.set(-Math.PI / 2, 0, 0.6);
    SFX.thud(0.8);
    await UI.say('you', 'MIKKO!', { hold: 0.4 });
    await sayS('ai', 'VARNING. SKROVBROTT I SEKTION 2. STABILISATORER UR FUNKTION.', { hold: 0.5 });
    await UI.say('mikko', 'Jag lever! TA SPAKARNA, CIRO! TA SPAKARNA!', { hold: 0.4 });

    // --- utifrån: skeppet snurrar som en helikopter ---
    camIn(scene);
    const smoke = () => {
      if (Math.random() < 0.8) FX.smoke(W(3.2, 1.7, -2.4), 1.8);
      if (Math.random() < 0.7) FX.fire(W(3.3, 1.7, -2.4), 1.5);
      if (Math.random() < 0.45) FX.spark(W(rand(-3, 3), 1, rand(-6, 8)));
      if (Math.random() < 0.35) FX.smoke(W(rand(-2.5, 2.5), rand(0.4, 2.2), rand(-7, 8)), 1.1);
    };
    hooks.add(smoke);
    spinRate = 5.0;
    const ext = anim(4.4, (k) => camSet(lerp(34, 18, k), lerp(10, 3.5, k), lerp(38, 22, k), 0, 0.4, 0), ease.lin);
    const ai = sayS('ai', 'KOLLISIONSKURS MED VEYRA. ATMOSFÄRISKT INTRÄDE OM 5 SEKUNDER.', { hold: 1.5 });
    await Promise.all([ext, ai]);
    hooks.delete(smoke);

    // --- Ciro springer till cockpit (saker flyger runt) ---
    camIn(ship);
    camSet(-1.8, 2.3, -2.5, -1.0, 1.2, -7.5);
    you.setPose('walk');
    await anim(1.6, (k) => {
      you.root.position.set(lerp(1.0, -1.0, k), 0, lerp(-1.0, -6.1, k));
      you.root.rotation.y = Math.PI; you.targetYaw = Math.PI;
      you.phase += 0.25;
    });

    // --- inträde + QTE ---
    UI.flash('#ff8a3a', 1.6); SFX.explosion(0.6);
    setEnv('planet');
    you.root.visible = false;
    const GY = shipY();
    const p0 = new V3(0, 240, 520), p1 = new V3(0, GY + 9, 70);
    ship.position.copy(p0);
    camIn(ship);
    camera.position.set(-1.0, 1.85, -6.3); camera.rotation.set(-0.2, 0, 0);
    UI.heat(1); loop('rumble', 0.5);
    let pull = 0, cracked = 0;
    const q = UI.qte('DRA UPP! &nbsp;SPAMMA <b>[MELLANSLAG]</b>', 'Space', 9);
    const descent = anim(9.2, (k) => {
      pull += (UI.qteValue() - pull) * 0.08;
      ship.position.lerpVectors(p0, p1, Math.pow(k, 1.3));
      spinRate = 5.5 * Math.max(0, 1 - pull * 2.2);
      if (spinRate < 0.8) { const tgt = Math.round(ship.rotation.y / (Math.PI * 2)) * Math.PI * 2; ship.rotation.y += (tgt - ship.rotation.y) * 0.05; }
      ship.rotation.x = lerp(-0.5, -0.05, Math.min(1, pull * 1.4));
      ship.rotation.z = Math.sin(S.time * 3) * 0.12 * (1 - pull);
      UI.heat(Math.max(0, 1 - k * 1.6));
      shake.base = 0.05 + 0.1 * k;
      if (k < 0.55) FX.fire(W(rand(-3, 3), rand(1, 2.5), -9.8), 2);
      if (Math.random() < 0.08) { burst(W(rand(-2, 2), 1.2, -7.9), 'spark', 6); SFX.spark(0.15); }
      if (k > 0.45 && cracked < 1) { cracked = 1; UI.crack(1); SFX.crack(); }
      if (k > 0.75 && cracked < 2) { cracked = 2; UI.crack(2); SFX.crack(); SR.screens[0].broken = true; burst(W(-1.15, 1.42, -8.3), 'spark', 25); }
    }, ease.lin);
    const talk2 = (async () => {
      await sayS('you', 'Kom igen... kom igen!', { hold: 0.6 });
      await sayS('mikko', 'DRA UPP! DRA UPP!', { hold: 0.6 });
      await wait(1.2);
      await sayS('ai', 'MARKKONTAKT OM 3... 2...', { hold: 0.4 });
      await sayS('you', 'KOM IGEEEN!', { hold: 0.3 });
    })();
    await Promise.all([q, descent, talk2]);

    // --- nedslaget: smäll, studs, sladd, stopp ---
    UI.crack(0); UI.heat(0);
    spinRate = 0;
    camIn(scene);
    const s0 = ship.position.clone();
    const slam = new V3(4, GY + 1.4, 46);
    const air = new V3(-5, GY + 6.2, 30);
    const skid = new V3(-2.2, GY + 0.7, 16);
    const rest = new V3(0, GY + 0.2, 0);
    hooks.add(smoke);
    spawnShards(s0);
    await anim(0.55, (k) => {
      ship.position.lerpVectors(s0, slam, ease.in(k));
      ship.rotation.set(lerp(-0.5, -0.28, k), lerp(0.2, 0.55, k), lerp(0.15, 0.7, k));
      camSetW(new V3(24, GY + 4.5, slam.z + 10), ship.position.clone().add(new V3(0, 1, 0)));
      shake.base = 0.1;
    }, ease.lin);
    burst(slam.clone().add(new V3(0, 0.4, 0)), 'dust', 50);
    burst(slam.clone().add(new V3(0, 0.6, 0)), 'fire', 28);
    UI.flash('#fff', 0.18); SFX.crunch(); SFX.explosion(0.7); shake.kick = 4.2;
    await anim(0.75, (k) => {
      const up = k < 0.42 ? ease.out(k / 0.42) : 1 - ease.in((k - 0.42) / 0.58);
      ship.position.lerpVectors(slam, air, up);
      ship.position.lerp(skid, Math.max(0, (k - 0.35) / 0.65));
      ship.rotation.set(lerp(-0.28, -0.12, k), lerp(0.55, 0.35, k), lerp(0.7, 0.25, k));
      camSetW(new V3(20, GY + 3.2, ship.position.z + 8), ship.position.clone().add(new V3(0, 1.2, 0)));
    }, ease.lin);
    SFX.scrape(0.45);
    await anim(2.0, (k) => {
      ship.position.lerpVectors(skid, rest, ease.out(k));
      ship.rotation.set(lerp(-0.12, 0, k), lerp(0.35, 0, k), lerp(0.25, 0, k));
      camSetW(new V3(lerp(18, 14, k), GY + lerp(2.6, 2.1, k), lerp(8, -10, k)), ship.position.clone().add(new V3(0, 1, 2)));
      if (k < 0.92) {
        burst(ship.position.clone().add(new V3(rand(-3, 3), 0.1, rand(2, 8))), 'dust', 3);
        if (Math.random() < 0.25) FX.spark(ship.position.clone().add(new V3(rand(-2, 2), 0.2, rand(0, 4))));
      }
      shake.base = 0.08 * (1 - k);
    }, ease.lin);
    hooks.delete(smoke);
    burst(rest.clone().add(new V3(0, 1, 3)), 'dust', 55);
    burst(rest.clone().add(new V3(0, 0.8, 2)), 'fire', 36);
    UI.flash('#fff', 0.12); SFX.crunch(); SFX.scrape(0.3); shake.kick = 3.2;
    await wait(0.18);

    // --- svart ---
    UI.fade(1, 0);
    hooks.delete(spinHook); shake.base = 0; shake.kick = 0;
    loop('rumble', 0, 0.05); loop('hum', 0, 0.05); loop('tension', 0, 0.05); alarm(false);
    UI.clearLines(); clearJunk();
    await wait(2.6);
    SFX.ring(); setHeartbeat(48);
    await wait(3.2);

    // --- uppvaknandet ---
    setupCrashSite();
    mikkoInjured();
    camIn(scene);
    UI.blur(10, 0);
    camSetW(W(0.3, 0.32, -3.8), W(0.6, 2.8, -3.2), 1.2);
    UI.fade(0.35, 1.5); await wait(1.6);
    UI.fade(1, 0.5); await wait(0.7);
    UI.fade(0, 2.5);
    SFX.creakBig();
    await sayS('you', 'Ugh... vad... vad hände...');
    UI.blur(3, 3);
    const a0 = W(0.3, 0.32, -3.8), a1 = W(0.7, 1.0, -4.2), l0 = W(0.6, 2.8, -3.2), l1 = W(2.5, 0.75, -4.6);
    await anim(3.2, (k) => camSetW(a0.clone().lerp(a1, k), l0.clone().lerp(l1, k), lerp(1.2, 0, k)));
    UI.blur(0, 2);
    await UI.say('mikko', 'H-hej... du lever...');
    await sayS('you', 'MIKKO! Din arm... åh nej, nej, nej, nej...');
    await UI.say('mikko', 'Den gör inte ens ont. Det... är dåligt, va?');
    await sayS('you', 'Håll dig vaken. Titta på mig. Jag fixar det här.');
    const b0 = W(1.5, 0.95, -4.5), lk = W(2.5, 0.8, -4.6);
    await anim(1.2, (k) => camSetW(a1.clone().lerp(b0, k), l1.clone().lerp(lk, k)));
    setHeartbeat(72);
    const q2 = UI.qte('TRYCK PÅ SÅRET! &nbsp;<b>[E] [E] [E]</b>', 'KeyE', 6.5);
    const bleed = anim(6.5, (k) => { cast.blood.scale.setScalar(lerp(0.35, 0.8, k)); }, ease.lin);
    const talk3 = (async () => {
      await UI.say('mikko', 'Ah... Lyssna på mig...');
      setHeartbeat(58);
      await UI.say('mikko', 'Asteroiden. Den SVÄNGDE. Asteroider svänger inte.');
    })();
    await Promise.all([q2, bleed, talk3]);
    setHeartbeat(44);
    await UI.say('mikko', 'Någon ville att vi skulle hamna här, Ciro.');
    await UI.say('mikko', 'Ödla-expeditionens fyr... nordost härifrån. Skicka en nödsignal...');
    await sayS('you', 'Vi skickar den tillsammans. Okej? TILLSAMMANS.');
    setHeartbeat(34);
    await UI.say('mikko', 'Fotot... hänger det kvar?', { hold: 1.2 });
    await sayS('you', 'Det hänger kvar. Lite snett. Men det hänger kvar.', { hold: 1 });
    await UI.say('mikko', 'Bra... Tummen upp...', { hold: 1.6 });
    setHeartbeat(0); holdTone(1000, 3.2, 0.07);
    mikkoDead();
    await wait(2.2);
    await sayS('you', 'Mikko?', { hold: 0.8 });
    await sayS('you', '...MIKKO!', { hold: 1.5 });
    await wait(1);
    await sayS('you', 'Jag lovar. Jag tar hem oss båda.', { hold: 1.5 });
    UI.fade(1, 2.5); await wait(2.8);
    UI.bigTitle('VDOWN', 'ÖVERLEV VEYRA'); SFX.titleHit();
    await wait(4.5);
  } catch (e) { if (!e || !e.skip) throw e; }
  finishAsteroid();
}

function spawnJunk() {
  const mats = [M.white, M.orange, M.crate, M.dark, M.hull];
  for (let i = 0; i < 28; i++) {
    const m = new THREE.Mesh(i % 3 ? new THREE.BoxGeometry(rand(0.1, 0.4), rand(0.05, 0.28), rand(0.1, 0.35)) : new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), pick(mats));
    m.position.set(rand(-2.2, 2.2), rand(0.4, 2.6), rand(-7, 7));
    m.userData.v = new V3(rand(-5, 5), rand(-1, 4), rand(-5, 5));
    m.userData.a = new V3(rand(-8, 8), rand(-8, 8), rand(-8, 8));
    ship.add(m); junk.push(m);
  }
  hooks.add(junkHook);
}
const junkHook = (dt) => {
  for (const m of junk) {
    const v = m.userData.v; v.x += spinRate * 0.7 * dt * Math.sign(m.position.x || 1);
    v.y -= 4 * dt;
    m.position.addScaledVector(v, dt);
    for (const [ax, lo, hi] of [['x', -2.8, 2.8], ['y', 0.1, 2.8], ['z', -8, 8.5]]) { if (m.position[ax] < lo) { m.position[ax] = lo; v[ax] = Math.abs(v[ax]) * 0.7; } if (m.position[ax] > hi) { m.position[ax] = hi; v[ax] = -Math.abs(v[ax]) * 0.7; } }
    m.rotation.x += m.userData.a.x * dt; m.rotation.y += m.userData.a.y * dt; m.rotation.z += m.userData.a.z * dt;
  }
};
function spawnShards(origin) {
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(rand(0.35, 1.3), rand(0.06, 0.22), rand(0.25, 0.9)), Math.random() < 0.65 ? M.hull : M.dark);
    m.position.copy(origin).add(new V3(rand(-3, 3), rand(0.4, 2.4), rand(-2, 3)));
    m.userData.v = new V3(rand(-10, 10), rand(3, 9), rand(-6, 8));
    m.userData.a = new V3(rand(-5, 5), rand(-5, 5), rand(-5, 5));
    scene.add(m); shards.push(m);
  }
  hooks.add(shardHook);
}
const shardHook = (dt) => {
  for (const m of shards) {
    m.userData.v.y -= 14 * dt;
    m.position.addScaledVector(m.userData.v, dt);
    const gy = groundH(m.position.x, m.position.z);
    if (m.position.y < gy + 0.08) { m.position.y = gy + 0.08; m.userData.v.multiplyScalar(0.35); m.userData.v.y = 0; }
    m.rotation.x += m.userData.a.x * dt; m.rotation.y += m.userData.a.y * dt;
  }
};
function clearJunk() {
  hooks.delete(junkHook); junk.forEach((m) => ship.remove(m)); junk.length = 0;
  hooks.delete(shardHook); shards.forEach((m) => scene.remove(m)); shards.length = 0;
}

function finishAsteroid() {
  cine.skipping = true;
  hooks.delete(spinHook);
  clearJunk();
  UI.clearLines(); UI.letterbox(false); UI.skipHint(false); UI.heat(0); UI.blur(0, 0); UI.bigTitle(null); UI.caption(''); UI.crack(0);
  alarm(false); loop('rumble', 0, 0.1); loop('hum', 0, 0.1); loop('tension', 0, 0.1); setHeartbeat(0);
  shake.base = 0; shake.kick = 0;
  asteroid.visible = false;
  setupCrashSite(); mikkoInjured(); mikkoDead();
  cast.you.root.visible = false;
  S.skippable = false;
  UI.fade(0, 1.5);
  EV.startGameplay();
}

// ================= MIKKO-ÖGONBLICKET (i labbet) =================
export async function runMikkoMoment() {
  if (F.bury !== null) return;
  await new Promise((r) => setTimeout(r, 1500));
  S.mode = 'cine'; cine.skipping = false;
  dropHeld();
  UI.letterbox(true); UI.setPrompt('');
  const head = cast.mikko.helmet.getWorldPosition(new V3());
  const cp = camera.getWorldPosition(new V3());
  const d = head.clone().sub(cp);
  const ty = Math.atan2(-d.x, -d.z), tp = Math.atan2(d.y, Math.hypot(d.x, d.z));
  const y0 = P.yaw, p0 = P.pitch;
  let dy = ty - y0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  await anim(2.4, (k) => { P.yaw = y0 + dy * k; P.pitch = lerp(p0, tp, k); camera.rotation.set(P.pitch, P.yaw, 0, 'YXZ'); });
  await UI.say('you', '...', { sub: true, hold: 1 });
  await UI.say('you', 'Du skulle ha älskat det här, Mikko. Ett riktigt labb. Du hade kallat det "vintage".', { sub: true });
  await UI.say('you', 'Jag kan inte bara låta dig ligga där.', { sub: true });
  UI.letterbox(false);
  const choice = await UI.choice('Vad gör du med Mikko?', ['BEGRAV MIKKO', 'LÅT HONOM VILA I SPARVEN']);
  F.bury = choice === 0;
  if (F.bury) UI.speak('you', 'Du förtjänar bättre än ett skrovgolv. Jag hämtar spaden.', 3);
  else UI.speak('you', 'Du får stanna här. I Sparven. Där du hör hemma. Vid fotot.', 3);
  S.mode = 'play';
  EV.relock && EV.relock();
}

// ================= SLUTET =================
export async function runEnding() {
  S.mode = 'ending'; cine.skipping = false;
  dropHeld();
  if (P.rover) { P.rover = null; }
  if (document.pointerLockElement) document.exitPointerLock();
  UI.show('clickPlay', false);
  UI.showHUD(false); UI.letterbox(true); UI.setTimer(null); UI.setMarkers([]); UI.setPrompt('');
  scene.attach(camera);
  const B = LOC.BEACON;
  const start = new V3(B.x - 60, 170, B.z - 120), end = new V3(B.x - 14, groundH(B.x - 14, B.z + 14) + 14, B.z + 14);
  rescue.visible = true; rescue.position.copy(start);
  loop('engine', 0.25, 1);
  const camPos = camera.position.clone();
  await anim(6, (k) => {
    rescue.position.lerpVectors(start, end, ease.out(k));
    rescue.lookAt(rescue.position.clone().add(new V3(end.x - start.x, 0, end.z - start.z)));
    rescue.rotateY(Math.PI);
    camera.position.copy(camPos);
    camera.lookAt(rescue.position);
  }, ease.lin);
  for (const c of creatures.filter((c) => !c.dead && c.state !== 'captured')) {
    spawnTracer(rescue.position.clone().add(new V3(0, -1.5, 0)), c.pos.clone().add(new V3(0, 0.5, 0)), 0xff5040);
    SFX.laser(); c.die();
    await wait(0.22);
  }
  await wait(0.8);
  SFX.radio();
  await UI.say('vale', 'Sparven-överlevande. Här är kommendör Vale, Helion Säkerhet. Sänk vapnet.', { sub: true });
  await UI.say('you', P.readTerminal ? 'Vale. Projekt Magnet. Det var NI. Ni dödade Mikko.' : 'Ni kom... Min pilot är död. Asteroiden, den styrdes hit.', { sub: true });
  await UI.say('vale', 'Vi dödade ingen. Planeten gjorde det. Vi... observerade.', { sub: true });
  await UI.say('vale', 'Test sju: lyckat. Du är den första som överlevt, Ciro. Och du har till och med studerat våra små vakter. Imponerande.', { sub: true });
  await UI.say('you', 'Jag tänker berätta för hela systemet vad ni har gjort.', { sub: true });
  await UI.say('vale', 'Självklart. Kliv ombord. Vi har så mycket att prata om.', { sub: true, hold: 2 });
  UI.fade(1, 3);
  loop('engine', 0, 1); loop('tension', 0, 1); loop('wind', 0, 1);
  await wait(3.2);
  UI.letterbox(false);
  UI.showEnding({ time: S.playTime, kills: P.kills, buried: F.buried });
}
