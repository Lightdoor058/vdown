// Planeten Veyra: stor terräng, himmel, stenar, kristaller och övergivna platser med döda kroppar.
import * as THREE from 'three';
import { scene, camera } from '../core/render.js';
import { V3, rand, clamp, smooth, vnoise, canvasTex, textTex, pick } from '../core/utils.js';
import { setGround, addBoxCol, registerColliders, staticRay } from '../systems/physics.js';
import { M, bmm, emis } from './materials.js';
import { makeCrate, makeSlideDoor, makeO2Station } from './props.js';
import { makeCorpse } from '../entities/astronaut.js';
import { Item, HEAT } from '../entities/items.js';
import { makeSpiderModel } from '../entities/creatures.js';
import { addEmitter, FX } from '../systems/particles.js';
import { S } from '../game/state.js';

export const planetEnv = new THREE.Group();
planetEnv.visible = false;
scene.add(planetEnv);
export const planetFog = new THREE.Fog(0xc9784f, 25, 360);
export const SUN_DIR = new V3(0.55, 0.3, -0.78).normalize();

export const LOC = {
  OP: new V3(70, 0, -115),        // Ödla relästation 2 + Fyren
  BEACON: new V3(82, 0, -112),
  CAMP: new V3(-95, 0, -45),      // Ödla-lägret
  NEST: new V3(40, 0, 95),        // spindelbo
  LANDER: new V3(-185, 0, 125),   // kraschad landare "Ikaros"
  MINE: new V3(195, 0, 70),       // gruvstation K-4
  HELION: new V3(300, 0, -255),   // Helion Station Theta
  RADIO: new V3(-250, 0, -195),   // trasig radiomast
  GRAVE: new V3(-9, 0, -16),      // gravplats nära skeppet
  CAMPFIRE: new V3(5, 0, 14),     // lägereld bakom skeppet
};
export const PLACE_NAMES = { LANDER: 'den kraschade landaren', MINE: 'gruvstationen', RADIO: 'radiomasten', CAMP: 'Ödla-lägret' };

// ---------- terräng ----------
const SIZE = 900, N = 300, SEG = SIZE / N, HALF = SIZE / 2;
const SITES = [];
function rawH(x, z) {
  let h = Math.sin(x * 0.018) * Math.cos(z * 0.015) * 7
    + Math.sin(x * 0.047 + 1.3) * Math.sin(z * 0.041 + 0.7) * 3
    + vnoise(x * 0.06, z * 0.06) * 2.2 + vnoise(x * 0.2, z * 0.2) * 0.4
    + vnoise(x * 0.008, z * 0.008) * 10;
  const d = Math.hypot(x, z);
  h += Math.pow(Math.max(0, d - 360), 1.35) * 0.35;
  return h;
}
function addSite(x, z, r, off = 0) { SITES.push({ x, z, r, h: rawH(x, z) + off }); }
function siteH(x, z) {
  let h = rawH(x, z);
  for (const s of SITES) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r + 16) h += (s.h - h) * (1 - smooth(s.r, s.r + 16, d));
  }
  return h;
}
const TH = new Float32Array((N + 1) * (N + 1));
export function groundH(x, z) {
  const gx = (x + HALF) / SEG, gz = (z + HALF) / SEG;
  if (gx < 0 || gz < 0 || gx >= N || gz >= N) return siteH(x, z);
  const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz, W = N + 1;
  const ha = TH[iz * W + ix], hd = TH[iz * W + ix + 1], hb = TH[(iz + 1) * W + ix], hc = TH[(iz + 1) * W + ix + 1];
  if (fx + fz < 1) return ha + (hd - ha) * fx + (hb - ha) * fz;
  return hc + (hb - hc) * (1 - fx) + (hd - hc) * (1 - fz);
}
export function groundNormal(x, z) {
  const e = 0.6;
  return new V3(groundH(x - e, z) - groundH(x + e, z), 2 * e, groundH(x, z - e) - groundH(x, z + e)).normalize();
}
export const shipY = () => groundH(0, 0) + 0.3;
export let terrain = null;

function buildTerrain() {
  addSite(0, 0, 22, 0);
  addSite(76, -113, 18, 0);
  addSite(LOC.CAMP.x, LOC.CAMP.z, 13, 0);
  addSite(LOC.NEST.x, LOC.NEST.z, 15, -1.5);
  addSite(LOC.LANDER.x, LOC.LANDER.z, 14, -0.8);
  addSite(LOC.MINE.x, LOC.MINE.z, 18, 0);
  addSite(LOC.HELION.x, LOC.HELION.z, 24, 0);
  addSite(LOC.RADIO.x, LOC.RADIO.z, 12, 0);
  const W = N + 1;
  for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) TH[iz * W + ix] = siteH(-HALF + ix * SEG, -HALF + iz * SEG);
  setGround(groundH);

  const geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const low = new THREE.Color(0x6e2e1a), mid = new THREE.Color(0xb35f36), high = new THREE.Color(0xd8a070), rock = new THREE.Color(0x4a2a22), tint = new THREE.Color(0x6a3a6a), ash = new THREE.Color(0x3a2a24);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    p.setY(i, TH[i]);
    const x = p.getX(i), z = p.getZ(i), h = TH[i];
    const t = clamp((h + 10) / 26, 0, 1);
    c.copy(low).lerp(mid, smooth(0, 0.5, t)).lerp(high, smooth(0.5, 1, t));
    c.lerp(rock, clamp(vnoise(x * 0.09, z * 0.09) * 0.8, 0, 0.6));
    const dn = Math.hypot(x - LOC.NEST.x, z - LOC.NEST.z);
    if (dn < 35) c.lerp(tint, (1 - dn / 35) * 0.5);
    if (Math.abs(x) < 7 && z > 8 && z < 62) c.lerp(ash, 0.55);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const grain = canvasTex(256, 256, (x, w, h) => {
    const img = x.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 200 + Math.random() * 55; img.data.set([v, v, v, 255], i * 4); }
    x.putImageData(img, 0, 0);
  }, [150, 150]);
  terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: 0.95, flatShading: true }));
  terrain.receiveShadow = true;
  planetEnv.add(terrain);
}

// ---------- himmel och ljus ----------
let sky, sun, dust;
const flickers = [];
function buildSky() {
  sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x24102e) }, hor: { value: planetFog.color.clone() }, gnd: { value: new THREE.Color(0x5a2a1c) }, sunDir: { value: SUN_DIR } },
    vertexShader: `varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 gnd; uniform vec3 sunDir; varying vec3 vW;
      void main(){
        vec3 d = normalize(vW); float h = d.y;
        vec3 c = mix(hor, top, smoothstep(0.0, 0.55, h));
        c = mix(c, gnd, smoothstep(0.0, -0.25, h));
        float s = max(dot(d, sunDir), 0.0);
        c += vec3(1.0,0.75,0.5) * pow(s, 900.0) * 40.0 + vec3(1.0,0.5,0.25) * pow(s, 10.0) * 0.35;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -1; sky.frustumCulled = false;
  planetEnv.add(sky);
  const gTex = canvasTex(512, 256, (x, w, h) => {
    for (let y = 0; y < h; y++) { const v = Math.sin(y * 0.09) * 0.5 + Math.sin(y * 0.031) * 0.5; x.fillStyle = `rgb(${120 + v * 30 | 0},${110 + v * 25 | 0},${170 + v * 30 | 0})`; x.fillRect(0, y, w, 1); }
  });
  const giantPos = new V3(-0.5, 0.42, -0.75).normalize().multiplyScalar(1500);
  const giant = new THREE.Mesh(new THREE.SphereGeometry(230, 48, 32), new THREE.MeshStandardMaterial({ map: gTex, fog: false, roughness: 1, emissive: 0x201830, emissiveIntensity: 0.4 }));
  giant.position.copy(giantPos); giant.rotation.z = 0.35; planetEnv.add(giant);
  const rTex = canvasTex(512, 512, (x, w) => {
    for (let r = 0; r < w / 2; r++) { const k = r / (w / 2); if (k < 0.62) continue; x.strokeStyle = `rgba(220,200,240,${(Math.sin(r * 0.7) * 0.5 + 0.5) * 0.5 * (k > 0.97 ? 0 : 1)})`; x.beginPath(); x.arc(w / 2, w / 2, r, 0, 7); x.stroke(); }
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(260, 420, 96), new THREE.MeshBasicMaterial({ map: rTex, transparent: true, side: THREE.DoubleSide, fog: false, depthWrite: false }));
  ring.position.copy(giantPos); ring.rotation.set(1.2, 0.3, 0.35); planetEnv.add(ring);
  for (const [d, r] of [[[0.3, 0.6, -0.6], 26], [[-0.9, 0.25, 0.1], 14]]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshStandardMaterial({ color: 0xc8c0b8, fog: false, roughness: 1 }));
    m.position.copy(new V3(...d).normalize().multiplyScalar(1400)); planetEnv.add(m);
  }
  planetEnv.add(new THREE.HemisphereLight(0xffc0a0, 0x4a2418, 1.25));
  sun = new THREE.DirectionalLight(0xffd2a8, 2.8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -45; sc.right = sc.top = 45; sc.near = 1; sc.far = 320;
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  planetEnv.add(sun, sun.target);
  const n = 400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = rand(-30, 30);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dust = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, color: 0xffd0a8, transparent: true, opacity: 0.55, depthWrite: false }));
  dust.frustumCulled = false;
  planetEnv.add(dust);
}

// ---------- stenar och kristaller ----------
function nearSite(x, z, pad) {
  if (Math.abs(x) < 11 && z > -22 && z < 62) return true;
  if (Math.hypot(x, z) < 26 + pad) return true;
  for (const k in LOC) { const L = LOC[k]; if (Math.hypot(x - L.x, z - L.z) < 22 + pad) return true; }
  return false;
}
function buildRocks() {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = new V3().fromBufferAttribute(p, i); v.multiplyScalar(1 + vnoise(v.x * 2, v.y * 2 + v.z) * 0.25); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  const count = 650;
  const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x7a5040, roughness: 0.95, flatShading: true }), count);
  im.castShadow = true; im.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new V3(), e = new THREE.Euler();
  let k = 0;
  while (k < count) {
    const x = rand(-400, 400), z = rand(-400, 400);
    if (nearSite(x, z, 2) || Math.hypot(x, z) > 420) continue;
    const big = Math.random() < 0.18;
    const s = big ? rand(1.6, 5) : rand(0.3, 1.1);
    const y = groundH(x, z) + s * 0.2;
    e.set(rand(0, 3), rand(0, 6), rand(0, 3)); q.setFromEuler(e);
    sv.set(s * rand(0.8, 1.3), s * rand(0.6, 1), s * rand(0.8, 1.3));
    m4.compose(new V3(x, y, z), q, sv); im.setMatrixAt(k++, m4);
    if (s > 1.1) addBoxCol(new V3(x - s * 0.75, y - s, z - s * 0.75), new V3(x + s * 0.75, y + s * 0.8, z + s * 0.75));
  }
  planetEnv.add(im);
}
const crystalMat = new THREE.MeshStandardMaterial({ color: 0x1a8f80, emissive: 0x2fffd0, emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
const crystalGroups = [];
function crystalCluster(cx, cz, n, spread, big = 1) {
  const g = new THREE.Group(); planetEnv.add(g);
  const geo = new THREE.OctahedronGeometry(1, 0);
  for (let i = 0; i < n; i++) {
    const a = rand(0, 6.28), d = Math.random() * spread;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    const s = rand(0.3, 1) * big;
    const m = new THREE.Mesh(geo, crystalMat);
    m.scale.set(s * 0.28, s * 1.6, s * 0.28);
    m.position.set(x, groundH(x, z) + s * 0.9, z);
    m.rotation.set(rand(-0.5, 0.5), rand(0, 6), rand(-0.5, 0.5));
    m.castShadow = true;
    m.userData.int = { kind: 'crystal', ref: m };
    g.add(m);
    staticRay.push(m);
    if (s > 1.2) addBoxCol(new V3(x - 0.35 * s, groundH(x, z) - 1, z - 0.35 * s), new V3(x + 0.35 * s, groundH(x, z) + s * 2, z + 0.35 * s));
  }
  crystalGroups.push(g);
}

// ---------- byggnadshjälp ----------
// Enkel byggnad: golv, väggar, tak och en skjutdörr på framsidan (+Z i lokala koordinater).
function building(g, w, d, h, opts = {}) {
  const wm = opts.mat || M.wall, hw = w / 2, hd = d / 2, t = 0.3;
  bmm(g, -hw, -0.6, -hd, hw, 0.2, hd, M.floor);
  bmm(g, -hw - t, 0.2, -hd - t, hw + t, h, -hd, wm);
  bmm(g, -hw - t, 0.2, -hd, -hw, h, hd, wm);
  bmm(g, hw, 0.2, -hd, hw + t, h, hd, wm);
  bmm(g, -hw - t, 0.2, hd, -0.8, h, hd + t, wm);
  bmm(g, 0.8, 0.2, hd, hw + t, h, hd + t, wm);
  bmm(g, -0.8, 2.6, hd, 0.8, h, hd + t, wm);
  if (!opts.noRoof) bmm(g, -hw - 0.5, h, -hd - 0.5, hw + 0.5, h + 0.35, hd + 0.5, M.dark);
  const door = bmm(g, -0.8, 0.2, hd - 0.05, 0.8, 2.6, hd + 0.05, M.dark);
  const dr = makeSlideDoor(door, new V3(1.62, 0, 0), opts.doorName || 'Dörr');
  if (opts.sign) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.5), new THREE.MeshBasicMaterial({ map: textTex([opts.sign], { w: 512, h: 80, size: 38, bg: '#1a1210', fg: opts.signColor || '#ff8a3d', align: 'center' }) }));
    sign.position.set(0, Math.min(h - 0.4, 3.05), hd + t + 0.02); g.add(sign);
  }
  if (opts.light !== false) {
    const lamp = new THREE.PointLight(opts.lightColor || 0x9ad8ff, 5, Math.max(w, d) + 4, 1.6); lamp.position.set(0, h - 0.4, 0); g.add(lamp);
    flickers.push({ light: lamp, base: 5 });
  }
  return dr;
}
function place(L, rotY = 0) {
  const g = new THREE.Group(); g.position.set(L.x, groundH(L.x, L.z), L.z); g.rotation.y = rotY; planetEnv.add(g);
  return g;
}
function corpse(parent, x, y, z, suit, pose, rot = 0, lie = false) {
  const c = makeCorpse(suit, pose);
  c.root.position.set(x, y + (lie ? 0.25 : pose === 'dead' ? -0.62 : 0), z);
  c.root.rotation.set(lie ? -Math.PI / 2 : 0, rot, 0);
  parent.add(c.root);
  return c;
}

// ---------- FYREN + UTPOSTEN ----------
export const beacon = { slots: [], active: false };
function buildOutpost() {
  const g = place(LOC.OP);
  building(g, 10, 8, 3.6, { sign: 'ÖDLA RELÄSTATION 2', doorName: 'Utpostens dörr' });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshBasicMaterial({ map: textTex(['HELION // KONFIDENTIELLT', '', '> PROJEKT MAGNET', '> 1 OLÄST RAPPORT', '', '[TRYCK E]'], { size: 26 }) }));
  bmm(g, -2.2, 0.2, -3.95, 0.2, 1.0, -3.2, M.dark);
  scr.position.set(-1, 1.55, -3.95); scr.userData.int = { kind: 'terminal', id: 'terminal' }; g.add(scr);
  makeO2Station(g, -4.94, 1.4, 0.5, Math.PI / 2);
  makeCrate(g, 3, 0.2, -2.4, 0, ['cell', 'med']);
  bmm(g, 4.3, 0.2, 0.0, 4.95, 2.2, 2.6, M.dark);
  corpse(g, 3.8, 0.2, 2.2, 'odla', 'dead', -Math.PI / 2);
  for (const [x, z] of [[-6.5, 3], [-6.2, 4.4], [6.4, -2]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 14), M.rust); b.position.set(x, 0.55, z); b.castShadow = true; b.userData.col = true; g.add(b);
  }
  registerColliders(g);

  // Fyren – TRASIG: masten har knäckts och ligger på marken
  const B = LOC.BEACON, bg = place(B);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 1.2, 10), M.dark); base.position.y = 0.6; base.castShadow = true;
  base.userData.col = true; base.userData.int = { kind: 'beacon' }; bg.add(base);
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 4.5, 8), M.hull); stub.position.y = 3.4; stub.castShadow = true; bg.add(stub);
  const jag = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.6, 5), M.hull); jag.position.y = 5.9; jag.rotation.z = 0.3; bg.add(jag);
  const fallen = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 9.5, 8), M.hull); fallen.rotation.z = Math.PI / 2 - 0.08; fallen.position.set(6.2, 0.35, 1.5); fallen.rotation.y = 0.4; fallen.castShadow = true; fallen.userData.col = true; bg.add(fallen);
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 6, 16), M.dark); r.rotation.x = Math.PI / 2; r.position.y = 2.2 + i * 1.1; bg.add(r); }
  beacon.lampMat = new THREE.MeshStandardMaterial({ color: 0x552222, emissive: 0xff3020, emissiveIntensity: 0 });
  beacon.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), beacon.lampMat); beacon.lamp.position.set(10.5, 0.45, 3.4); bg.add(beacon.lamp);
  // ny sändare (syns när den monterats)
  beacon.dish = new THREE.Group(); beacon.dish.position.y = 5.7; beacon.dish.visible = false; bg.add(beacon.dish);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, 0.9), new THREE.MeshStandardMaterial({ color: 0x3a3e46, metalness: 0.6, side: THREE.DoubleSide })); dish.rotation.x = Math.PI; dish.position.y = 0.6; beacon.dish.add(dish);
  beacon.dishLamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0x552222, emissive: 0xff3020, emissiveIntensity: 0 })); beacon.dishLamp.position.y = 0.2; beacon.dish.add(beacon.dishLamp);
  beacon.slotOff = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x401010, emissiveIntensity: 1 });
  beacon.slotOn = emis(0x5dff8a, 4);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * 1.25 + (i - 1) * 0.45;
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.45, 0.12), beacon.slotOff);
    s.position.set(Math.sin(a) * 1.55, 0.75, Math.cos(a) * 1.55); s.rotation.y = a;
    s.userData.int = { kind: 'beacon' }; bg.add(s); beacon.slots.push(s);
  }
  beacon.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 600, 16, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.35, 0.25), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beacon.beam.position.y = 306; beacon.beam.visible = false; bg.add(beacon.beam);
  beacon.light = new THREE.PointLight(0xff5030, 0, 60, 1.2); beacon.light.position.y = 6.5; bg.add(beacon.light);
  addEmitter(1.5, () => FX.smoke(new V3(B.x, groundH(B.x, B.z) + 6, B.z), 0.6), () => S.act === 'planet' && !beacon.active);
  registerColliders(bg);
}
export function fillSlot(i) { if (beacon.slots[i]) beacon.slots[i].material = beacon.slotOn; }
export function installTransmitter() { beacon.dish.visible = true; }
export function activateBeacon() {
  beacon.active = true; beacon.beam.visible = true;
  beacon.dishLamp.material.emissiveIntensity = 8; beacon.light.intensity = 60;
}

// ---------- ÖDLA-LÄGRET ----------
function buildCamp() {
  const g = place(LOC.CAMP);
  for (const [x, z, r] of [[-4, -3, 0.4], [-3, 4, -0.3]]) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(2, 2.4, 4, 1, true), M.cloth); t.position.set(x, 1.2, z); t.rotation.y = Math.PI / 4 + r; t.castShadow = true; t.userData.col = true; g.add(t);
  }
  const rover = new THREE.Group(); rover.position.set(5, 0.7, -3); rover.rotation.set(0.1, 0.6, 0.18); g.add(rover);
  const rb = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 2), M.rust); rb.castShadow = true; rb.userData.col = true; rover.add(rb);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 1.8), M.hull); cab.position.set(-0.8, 0.9, 0); cab.castShadow = true; rover.add(cab);
  for (const [x, z] of [[-1.2, -1.1], [1.2, -1.1], [-1.2, 1.1], [1.2, 1.1]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.35, 14), M.dark2); w.rotation.x = Math.PI / 2; w.position.set(x, -0.45, z); rover.add(w);
  }
  makeCrate(g, 2, 0, 3, Math.PI / 2, ['cell', 'ammo', 'analyzer']);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * 6.28;
    const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), M.rust); st.position.set(-1 + Math.cos(a) * 0.7, 0.1, Math.sin(a) * 0.7); g.add(st);
  }
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.6, 16), new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1 })); ash.rotation.x = -Math.PI / 2; ash.position.set(-1, 0.03, 0); g.add(ash);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), M.dark); pole.position.set(0.5, 1.5, -5.5); g.add(pole);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), emis(0xffaa55, 4)); bulb.position.set(0.5, 3.05, -5.5); g.add(bulb);
  const l = new THREE.PointLight(0xffaa55, 5, 16, 1.5); l.position.set(0.5, 2.9, -5.5); g.add(l);
  flickers.push({ light: l, base: 5, mesh: bulb });
  corpse(g, -4.5, 0, 0.5, 'odla', 'dead', 0.8);
  corpse(g, 3, 0, 6, 'odla', 'lie', 2.2, true);
  registerColliders(g);
}

// ---------- SPINDELBOET ----------
function buildNest() {
  const Nn = LOC.NEST, ny = groundH(Nn.x, Nn.z);
  crystalCluster(Nn.x, Nn.z, 42, 11, 1.6);
  const l = new THREE.PointLight(0x40ffd8, 25, 38, 1.4); l.position.set(Nn.x, ny + 3, Nn.z); planetEnv.add(l);
  flickers.push({ light: l, base: 25, slow: true });
  const eggM = new THREE.MeshStandardMaterial({ color: 0x3a1440, roughness: 0.2, metalness: 0.2, emissive: 0x501060, emissiveIntensity: 0.6 });
  for (let i = 0; i < 18; i++) {
    const a = rand(0, 6.28), d = rand(2, 6);
    const x = Nn.x + Math.cos(a) * d, z = Nn.z + Math.sin(a) * d;
    const e = new THREE.Mesh(new THREE.SphereGeometry(rand(0.25, 0.45), 14, 10), eggM); e.scale.y = 1.3; e.position.set(x, groundH(x, z) + 0.25, z); e.castShadow = true; planetEnv.add(e);
  }
  const g = place(Nn);
  corpse(g, 4, 0, 2.5, 'odla', 'lie', 0.9, true);
}

// ---------- KRASCHAD LANDARE "IKAROS" ----------
function buildLander() {
  const g = place(LOC.LANDER, 0.7);
  const hull = new THREE.Group(); hull.rotation.set(0.12, 0, 0.32); hull.position.y = 0.4; g.add(hull);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 4.5, 8), M.hull); body.position.y = 2; body.castShadow = true; hull.add(body);
  const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2, 8), M.hull); top.position.y = 5.2; top.castShadow = true; hull.add(top);
  for (let i = 0; i < 4; i++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 6), M.dark); const a = i * Math.PI / 2 + 0.4; leg.position.set(Math.cos(a) * 2.6, 0.4, Math.sin(a) * 2.6); leg.rotation.z = Math.cos(a) * 0.5; leg.rotation.x = -Math.sin(a) * 0.5; hull.add(leg); }
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.55, 0.4, 8), M.orange); stripe.position.y = 2.6; hull.add(stripe);
  const name = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshBasicMaterial({ map: textTex(['IKAROS'], { w: 256, h: 64, size: 40, bg: '#b7bcc4', fg: '#202428', align: 'center' }) }));
  name.position.set(0, 3.4, 2.62); hull.add(name);
  const col = bmm(g, -2.6, 0, -2.6, 2.6, 4, 2.6, M.dark); col.visible = false;
  // vrakdelar
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(rand(0.4, 1.5), rand(0.1, 0.4), rand(0.4, 1.2)), M.hull); m.position.set(rand(-7, 7), 0.15, rand(3, 9)); m.rotation.set(rand(-0.4, 0.4), rand(0, 6), rand(-0.4, 0.4)); m.castShadow = true; g.add(m); }
  makeCrate(g, 4, 0, 4.5, 0.3, ['cell', 'food', 'o2']);
  corpse(g, -1.5, 0, 4.2, 'helion', 'dead', 0.2);
  addEmitter(1.5, () => FX.smoke(new V3(LOC.LANDER.x, groundH(LOC.LANDER.x, LOC.LANDER.z) + 4, LOC.LANDER.z), 0.8), () => S.act === 'planet');
  registerColliders(g);
}

// ---------- GRUVSTATION K-4 ----------
function buildMine() {
  const g = place(LOC.MINE, -0.4);
  building(g, 7, 6, 3.2, { sign: 'GRUVSTATION K-4', doorName: 'Gruvbodens dörr', mat: M.rust, lightColor: 0xffb070 });
  makeCrate(g, -1.8, 0.2, -1.5, 0, ['toolkit', 'ammo', 'o2']);
  corpse(g, 1.6, 0.2, -1.2, 'miner', 'dead', -0.8);
  makeO2Station(g, 3.44, 1.4, 0, -Math.PI / 2);
  // borrtorn
  const tw = new THREE.Group(); tw.position.set(-9, 0, -2); g.add(tw);
  for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 12, 6), M.rust); p.position.set(x * (1 - 0.0), 6, z); p.rotation.z = -x * 0.05; p.rotation.x = z * 0.05; p.castShadow = true; tw.add(p); }
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.1), M.rust); b.position.set(0, 2 + i * 2.2, -1.5); tw.add(b); const b2 = b.clone(); b2.position.z = 1.5; tw.add(b2); }
  const drill = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.5, 8), M.dark); drill.position.y = 0.5; drill.rotation.x = Math.PI; tw.add(drill);
  const tl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), emis(0xff2a10, 4)); tl.position.y = 12.2; tw.add(tl); flickers.push({ mesh: tl, blink: true });
  const col = bmm(tw, -1.8, 0, -1.8, 1.8, 3, 1.8, M.dark); col.visible = false;
  // transportband + tunnor
  for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.8), M.dark2); r.position.set(-5 + i * 0.1, 0.8 + i * 0.35, 4 + i * 1.2); r.rotation.x = -0.28; g.add(r); }
  for (const [x, z] of [[5, 5], [6, 4], [5.5, 6.2], [-6, 6]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 12), pick([M.rust, M.orange])); b.position.set(x, 0.55, z); b.castShadow = true; b.userData.col = true; g.add(b); }
  corpse(g, 7, 0, -3, 'miner', 'lie', 1.3, true);
  crystalCluster(LOC.MINE.x + 12, LOC.MINE.z + 10, 14, 4, 1.2);
  registerColliders(g);
}

// ---------- HELION STATION THETA ----------
function buildHelion() {
  const g = place(LOC.HELION, Math.PI * 0.75);
  building(g, 14, 10, 4.2, { sign: 'HELION STATION THETA', signColor: '#ffcf3a', doorName: 'Stationens port', mat: new THREE.MeshStandardMaterial({ color: 0x3a3e46, roughness: 0.5, metalness: 0.5 }), lightColor: 0xffe0a0 });
  bmm(g, -7, 0.2, -1, -1.5, 4.2, -0.7, M.dark);
  bmm(g, 1.5, 0.2, -1, 7, 4.2, -0.7, M.dark);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshBasicMaterial({ map: textTex(['THETA // LOGG', '', '> EVAKUERING: NEKAD', '> MAGNET-DATA', '', '[TRYCK E]'], { size: 26, fg: '#ffcf3a', bg: '#141008' }) }));
  bmm(g, -5.5, 0.2, -4.9, -3.5, 1.0, -4.2, M.dark);
  scr.position.set(-4.5, 1.55, -4.95); scr.userData.int = { kind: 'terminal', id: 'theta' }; g.add(scr);
  makeCrate(g, 4.5, 0.2, -3.5, 0, ['transmitter', 'cell', 'med']);
  makeCrate(g, 4.5, 0.2, 2.5, Math.PI, ['ammo', 'ammo', 'food']);
  makeO2Station(g, -6.94, 1.4, 2.5, Math.PI / 2);
  corpse(g, -3, 0.2, 2.5, 'helion', 'dead', 1.2);
  corpse(g, 2, 0.2, -3.2, 'helion', 'lie', -0.4, true);
  corpse(g, 6, 0.2, 0.8, 'helion', 'dead', -1.6);
  // parabolantenn
  const ant = new THREE.Group(); ant.position.set(-11, 0, -4); g.add(ant);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 8, 8), M.hull); pole.position.y = 4; ant.add(pole);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(3, 20, 10, 0, Math.PI * 2, 0, 0.8), new THREE.MeshStandardMaterial({ color: 0xb7bcc4, side: THREE.DoubleSide, metalness: 0.4 })); dish.position.y = 8.5; dish.rotation.x = Math.PI * 0.7; ant.add(dish);
  const col = bmm(ant, -0.5, 0, -0.5, 0.5, 8, 0.5, M.dark); col.visible = false;
  // generatorhus
  const gen = bmm(g, 9, 0.2, 3, 12, 2.5, 6, M.rust);
  addEmitter(1, () => FX.smoke(g.localToWorld(new V3(10.5, 2.8, 4.5)), 0.6), () => S.act === 'planet');
  registerColliders(g);
  crystalCluster(LOC.HELION.x - 20, LOC.HELION.z + 15, 18, 6, 1.3);
}

// ---------- RADIOMASTEN ----------
function buildRadio() {
  const g = place(LOC.RADIO, 0.3);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 14, 6), M.rust); mast.position.set(0, 6, 0); mast.rotation.z = 0.35; mast.castShadow = true; g.add(mast);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 8, 0, Math.PI * 2, 0, 0.8), new THREE.MeshStandardMaterial({ color: 0x8a8378, side: THREE.DoubleSide })); dish.position.set(4, 0.6, 3); dish.rotation.x = 2.2; g.add(dish);
  bmm(g, -2, 0, -4, 1, 1.4, -2, M.rust);
  makeCrate(g, 2.5, 0, -3, 0.5, ['o2', 'ammo']);
  corpse(g, -1, 0, 2.5, 'odla', 'dead', 2.5);
  registerColliders(g);
}

// ---------- KRASCHPLATSEN ----------
function buildCrashSite() {
  const scorch = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  for (let z = 6; z < 78; z += 3.2) {
    const x = Math.sin(z * 0.18) * (1.2 + z * 0.02) + (z > 40 ? Math.sin(z * 0.07) * 3 : 0);
    const s = new THREE.Mesh(new THREE.CircleGeometry(rand(2.2, 4.4), 16), scorch);
    s.rotation.x = -Math.PI / 2; s.position.set(x, groundH(x, z) + 0.05, z); planetEnv.add(s);
  }
  const crater = new THREE.Mesh(new THREE.CircleGeometry(9.5, 28), new THREE.MeshBasicMaterial({ color: 0x140c08, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  crater.rotation.x = -Math.PI / 2; crater.position.set(0, groundH(0, 0) + 0.04, 2); planetEnv.add(crater);
  const debris = new THREE.Group(); planetEnv.add(debris);
  for (let i = 0; i < 32; i++) {
    const z = rand(8, 72), x = rand(-11, 11);
    const big = i < 7;
    const w = big ? rand(1.4, 2.8) : rand(0.25, 1.1), h = big ? rand(0.25, 1.1) : rand(0.08, 0.4), d = big ? rand(0.9, 2.2) : rand(0.25, 1);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), Math.random() < 0.6 ? M.hull : M.dark);
    m.position.set(x, groundH(x, z) + h * 0.3, z); m.rotation.set(rand(-0.5, 0.5), rand(0, 6), rand(-0.5, 0.5));
    m.castShadow = true; m.receiveShadow = true;
    if (big) m.userData.col = true;
    debris.add(m);
  }
  registerColliders(debris);
  for (const [x, z] of [[2, 18], [-3, 30], [1.5, 44], [4, 56], [-2, 68]]) {
    const y = groundH(x, z);
    const l = new THREE.PointLight(0xff7a30, 8, 14, 1.5); l.position.set(x, y + 1, z); planetEnv.add(l);
    flickers.push({ light: l, base: 8, fire: true });
    const fp = new V3(x, y + 0.1, z);
    HEAT.push({ pos: fp, r: 1.6 });
    addEmitter(14, () => FX.fire(fp, 1.2), () => S.crashDone);
    addEmitter(2.5, () => FX.smoke(fp.clone().add(new V3(0, 1, 0)), 1.2), () => S.crashDone);
    addEmitter(3, () => FX.ember(fp), () => S.crashDone);
  }
  // gravplats (gräv här)
  const gy = groundH(LOC.GRAVE.x, LOC.GRAVE.z);
  const patch = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20), new THREE.MeshStandardMaterial({ color: 0x5a3020, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  patch.rotation.x = -Math.PI / 2; patch.position.set(LOC.GRAVE.x, gy + 0.03, LOC.GRAVE.z);
  patch.userData.int = { kind: 'grave' };
  planetEnv.add(patch);
  graveRefs.patch = patch;
  staticRay.push(patch);
  // lägereldsplats
  const cy = groundH(LOC.CAMPFIRE.x, LOC.CAMPFIRE.z);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }));
  spot.rotation.x = -Math.PI / 2; spot.position.set(LOC.CAMPFIRE.x, cy + 0.05, LOC.CAMPFIRE.z);
  spot.userData.int = { kind: 'campfire' };
  planetEnv.add(spot); campRefs.spot = spot;
  staticRay.push(spot);
}
export const graveRefs = {};
export const campRefs = {};

export function lightCampfire() {
  const p = LOC.CAMPFIRE, y = groundH(p.x, p.z);
  campRefs.spot.visible = false;
  const g = new THREE.Group(); g.position.set(p.x, y, p.z); planetEnv.add(g);
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.17, 0), M.rust); st.position.set(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55); g.add(st); }
  for (let i = 0; i < 3; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x2a1a10 })); lg.rotation.z = Math.PI / 2; lg.rotation.y = i * 1.05; lg.position.y = 0.1; g.add(lg); }
  const rack = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), M.dark2); rack.rotation.z = Math.PI / 2; rack.position.y = 0.7; g.add(rack);
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 6), M.dark2); st.position.set(s * 0.65, 0.37, 0); g.add(st); }
  const l = new THREE.PointLight(0xff8030, 10, 12, 1.5); l.position.y = 0.8; g.add(l);
  flickers.push({ light: l, base: 10, fire: true });
  const fp = new V3(p.x, y + 0.1, p.z);
  HEAT.push({ pos: fp.clone().add(new V3(0, 0.4, 0)), r: 1.3 });
  addEmitter(16, () => FX.fire(fp, 0.8));
  addEmitter(1.5, () => FX.smoke(fp.clone().add(new V3(0, 1, 0)), 0.7));
  addEmitter(3, () => FX.ember(fp));
  const col = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 1.1), M.dark); col.position.y = 0.12; col.visible = false; col.userData.col = true; col.userData.noRay = true; g.add(col);
  registerColliders(g);
}

// ---------- räddningsskeppet (slutet) ----------
export const rescue = new THREE.Group();
function buildRescue() {
  const hullM = new THREE.MeshStandardMaterial({ color: 0x30343c, roughness: 0.4, metalness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 2.5, 18), hullM); rescue.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 6), hullM); nose.rotation.x = -Math.PI / 2; nose.position.z = -12; rescue.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(20, 0.4, 6), hullM); wing.position.set(0, 0, 3); rescue.add(wing);
  for (const x of [-3, 0, 3]) { const e = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), emis(0x60c0ff, 6)); e.position.set(x, 0, 9.05); rescue.add(e); }
  for (const x of [-9.8, 9.8]) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), emis(x < 0 ? 0xff2020 : 0x20ff40, 6)); t.position.set(x, 0, 3); rescue.add(t); }
  const strip = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.1, 14), emis(0xffcf6a, 2)); strip.position.y = -1.0; rescue.add(strip);
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: textTex(['HELION'], { w: 256, h: 64, size: 40, bg: '#30343c', fg: '#ffcf6a', align: 'center' }) }));
  logo.position.set(3.01, 0.4, 0); logo.rotation.y = Math.PI / 2; rescue.add(logo);
  const l = new THREE.PointLight(0xfff0d0, 40, 60, 1.2); l.position.y = -3; rescue.add(l);
  rescue.visible = false;
  planetEnv.add(rescue);
}

// ---------- föremål ute i världen ----------
let worldItemsDone = false;
export function spawnWorldItems() {
  if (worldItemsDone) return; worldItemsDone = true;
  const H = (x, z, o = 0.4) => new V3(x, groundH(x, z) + o, z);
  [[22, -38], [-42, -78], [58, 28], [-28, 52], [LOC.OP.x - 7, LOC.OP.z + 7], [30, -95], [120, -40], [-120, 60], [150, -150], [-60, -140], [230, -180], [-200, 40]].forEach(([x, z]) => new Item('o2', H(x, z)));
  [[-58, 8], [92, -62], [30, 60], [-150, -90], [160, 120]].forEach(([x, z]) => new Item('food', H(x, z)));
  [[12, -72], [-80, -30], [LOC.NEST.x - 10, LOC.NEST.z - 8], [200, -100]].forEach(([x, z]) => new Item('med', H(x, z)));
  [[48, -30], [-72, -22], [55, 80], [LOC.OP.x + 2, LOC.OP.z + 8], [140, 10], [-170, 110]].forEach(([x, z]) => new Item('ammo', H(x, z)));
  new Item('cell', H(LOC.NEST.x, LOC.NEST.z, 0.5));
  new Item('microscope', H(LOC.OP.x - 2, LOC.OP.z - 1, 0.7));
  new Item('pad', H(LOC.CAMP.x - 1, LOC.CAMP.z + 1.5), { lore: 'camp1' });
  new Item('pad', H(LOC.CAMP.x + 3, LOC.CAMP.z - 1.2), { lore: 'camp2' });
  new Item('pad', H(LOC.NEST.x + 3.2, LOC.NEST.z + 1.2), { lore: 'nest' });
  new Item('pad', H(LOC.LANDER.x - 2, LOC.LANDER.z + 3.5), { lore: 'lander' });
  new Item('pad', H(LOC.MINE.x + 1, LOC.MINE.z + 1.5, 0.7), { lore: 'mine' });
  new Item('pad', H(LOC.RADIO.x - 0.5, LOC.RADIO.z + 1.5), { lore: 'radio' });
  for (let i = 0; i < 50; i++) { const a = rand(0, 6.28), d = rand(12, 300); new Item('rock', H(Math.cos(a) * d, Math.sin(a) * d, 0.3)); }
  for (const [x, z] of [[8, 20], [-6, 24], [10, 9], [-8, 12]]) new Item('rock', H(x, z, 0.3));
}

// döda spindlar som dekoration
function deadSpiders() {
  for (const [x, z] of [[LOC.OP.x + 8, LOC.OP.z + 12], [LOC.HELION.x + 10, LOC.HELION.z + 10], [LOC.CAMP.x + 6, LOC.CAMP.z + 8]]) {
    const { g, rig } = makeSpiderModel(1.1);
    g.position.set(x, groundH(x, z) + 0.3, z); g.rotation.set(0, rand(0, 6), Math.PI * 0.95);
    planetEnv.add(g);
  }
}

export function buildPlanet() {
  buildTerrain();
  buildSky();
  buildRocks();
  for (let i = 0; i < 30; i++) {
    const x = rand(-330, 330), z = rand(-330, 330);
    if (!nearSite(x, z, 4)) crystalCluster(x, z, Math.floor(rand(4, 9)), 2.5, rand(0.6, 1.2));
  }
  crystalCluster(-22, 36, 8, 3, 1);
  buildOutpost();
  buildCamp();
  buildNest();
  buildLander();
  buildMine();
  buildHelion();
  buildRadio();
  buildCrashSite();
  buildRescue();
  deadSpiders();
}

const _cp = new V3();
export function updatePlanet(dt) {
  if (!planetEnv.visible) return;
  camera.getWorldPosition(_cp);
  sky.position.copy(_cp);
  sun.position.copy(_cp).addScaledVector(SUN_DIR, 150);
  sun.target.position.copy(_cp);
  const a = dust.geometry.attributes.position;
  const wrap = (v, c) => ((v - c + 30) % 60 + 60) % 60 - 30 + c;
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i) + dt * 0.8, y = a.getY(i) + Math.sin(S.time + i) * dt * 0.1, z = a.getZ(i) + dt * 0.3;
    a.setXYZ(i, wrap(x, _cp.x), wrap(y, _cp.y), wrap(z, _cp.z));
  }
  a.needsUpdate = true;
  for (const f of flickers) {
    if (f.light) {
      if (f.fire) f.light.intensity = f.base * (0.75 + Math.random() * 0.5);
      else if (f.slow) f.light.intensity = f.base * (0.8 + Math.sin(S.time * 1.5) * 0.2);
      else f.light.intensity = Math.random() < 0.03 ? 0.2 : f.base;
    }
    if (f.blink && f.mesh) f.mesh.visible = Math.sin(S.time * 4) > 0;
  }
  if (beacon.active) {
    beacon.beam.material.opacity = 0.28 + Math.sin(S.time * 6) * 0.1;
    beacon.dishLamp.material.emissiveIntensity = 6 + Math.sin(S.time * 8) * 3;
    beacon.light.intensity = 45 + Math.sin(S.time * 8) * 20;
    beacon.dish.rotation.y += dt * 0.6;
  }
}
