// Fraktskeppet SPARVEN. Zoner (framåt = -Z):
//  cockpit z -8.6..-5 · vardagsrum z -5..1 (bord, kyl, fotot) · minilabb z 1..5 · maskinrum z 5..9 (generator, förråd)
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { V3, canvasTex, rand, pick, clamp } from '../core/utils.js';
import { M, bmm, emis } from './materials.js';
import { makeCrate, makeSlideDoor, makeHingeDoor, makeO2Station, makeLever } from './props.js';
import { TEX } from '../core/assets.js';
import { S } from '../game/state.js';

export const ship = new THREE.Group();
ship.rotation.order = 'YXZ';
scene.add(ship);

export const SR = { engGlow: [], glass: [], mainLights: [], screens: [], buttons: {}, blinkers: [], fans: [], mode: 'normal', genOn: false, labParts: {}, navCal: { round: 0, total: 2, seq: [], idx: 0, phase: 'idle', flashI: -1, mode: 'idle', startSeq: [] } };

const nameTex = canvasTex(512, 84, (x, w, h) => {
  x.clearRect(0, 0, w, h);
  x.font = '900 54px Orbitron, Arial'; x.fillStyle = '#20242b'; x.fillText('SPARVEN', 8, 60);
  x.font = 'bold 28px Arial'; x.fillStyle = '#ff7a2a'; x.fillText('SV-7', 350, 58);
});

// ---------- animerade skärmar ----------
function screen(parent, w, h, draw, x, y, z, rx = 0, ry = 0) {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  m.position.set(x, y, z); m.rotation.set(rx, ry, 0, 'YXZ'); parent.add(m);
  const sc = { c, ctx: c.getContext('2d'), tex, draw, mesh: m, broken: false, on: true };
  SR.screens.push(sc);
  return sc;
}
const D = {
  radar(x, w, h, t) {
    x.fillStyle = '#031014'; x.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.42;
    x.strokeStyle = '#0f5a50'; x.lineWidth = 1;
    for (let i = 1; i <= 3; i++) { x.beginPath(); x.arc(cx, cy, r * i / 3, 0, 7); x.stroke(); }
    x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx + r, cy); x.moveTo(cx, cy - r); x.lineTo(cx, cy + r); x.stroke();
    const a = t * 1.8;
    const g = x.createLinearGradient(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    x.strokeStyle = '#3dffcf'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.stroke();
    x.fillStyle = 'rgba(61,255,207,0.15)'; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, r, a - 0.6, a); x.fill();
    const blips = S.radarBlips || [[0.5, 0.3], [-0.4, 0.6]];
    x.fillStyle = '#ff5a3a';
    blips.forEach(([bx, by]) => { x.beginPath(); x.arc(cx + bx * r, cy + by * r, 3, 0, 7); x.fill(); });
    x.fillStyle = '#3dffcf'; x.font = 'bold 13px monospace'; x.fillText('RADAR', 8, 16);
  },
  nav(x, w, h, t) {
    x.fillStyle = '#060a18'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#ff9a5a'; x.beginPath(); x.arc(w * 0.7, h * 0.55, h * 0.3, 0, 7); x.fill();
    x.strokeStyle = '#5ee6ff'; x.setLineDash([4, 4]); x.beginPath(); x.moveTo(10, h - 10); x.quadraticCurveTo(w * 0.4, h * 0.2, w - 10, 12); x.stroke(); x.setLineDash([]);
    const k = (t * 0.05) % 1; x.fillStyle = '#ffffff';
    x.beginPath(); x.arc(10 + (w - 20) * k, (h - 10) - (h - 22) * k - Math.sin(k * Math.PI) * h * 0.25, 3, 0, 7); x.fill();
    x.fillStyle = '#5ee6ff'; x.font = 'bold 13px monospace'; x.fillText('NAV // CERES', 8, 16);
    const cal = SR.navCal;
    if (S.navOk) {
      x.fillStyle = '#5dff8a'; x.fillText('KALIBRERAD', 8, h - 8);
    } else if (cal && cal.mode === 'start') {
      x.fillStyle = '#ffcf3a'; x.fillText('STARTRUTIN (LAPP)', 8, h - 8);
      const n = (cal.seq || []).length;
      for (let i = 0; i < n; i++) {
        x.fillStyle = i < cal.idx ? '#5dff8a' : '#1a2230';
        x.beginPath(); x.arc(18 + i * 18, h - 26, 6, 0, 7); x.fill();
        x.strokeStyle = '#ffcf3a'; x.lineWidth = 1; x.stroke();
      }
    } else if (cal && cal.round > 0) {
      x.fillStyle = '#ffcf3a'; x.fillText(`KALIBRERING ${cal.round}/${cal.total}`, 8, h - 8);
      const seq = cal.seq || [];
      const cols = { red: '#ff3020', blue: '#2a8aff', green: '#30ff60' };
      seq.forEach((id, i) => {
        const lit = cal.phase === 'demo' ? i <= cal.flashI : i < cal.idx;
        x.fillStyle = lit ? cols[id] : '#1a2230';
        x.beginPath(); x.arc(18 + i * 18, h - 26, 6, 0, 7); x.fill();
        x.strokeStyle = cols[id]; x.lineWidth = 1; x.stroke();
      });
    } else {
      x.fillStyle = '#ff9a5a'; x.fillText('KALIBRERING KRÄVS', 8, h - 8);
    }
  },
  sys(x, w, h, t) {
    x.fillStyle = '#081008'; x.fillRect(0, 0, w, h);
    x.font = 'bold 12px monospace';
    ['O2', 'TRYCK', 'KRAFT', 'VÄRME', 'GEN'].forEach((n, i) => {
      let v = 0.6 + Math.sin(t * 0.7 + i) * 0.15;
      if (n === 'VÄRME') v = 0.12; if (n === 'GEN') v = SR.genOn ? 0.8 + Math.sin(t * 5) * 0.05 : 0.02;
      x.fillStyle = '#8f8'; x.fillText(n, 8, 22 + i * 20);
      x.fillStyle = v < 0.2 ? '#f44' : '#3c3'; x.fillRect(70, 12 + i * 20, (w - 80) * v, 12);
    });
  },
  log(x, w, h, t) {
    x.fillStyle = '#05080c'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#9fd8ff'; x.font = '11px monospace';
    const L = ['> PING CERES-STN ... OK', '> TELEMETRI SKICKAD', '> HELION: KURS ÄNDRAD', '> ASTEROIDBÄLTE 0.2AU', '> SKROV 98%', '> SKÖLD: AV (EKONOMI)', '> MIKKO: KÖTTBULLAR?', '> GRAVITATION: AVVIKELSE', '> SIGNAL OKÄND ... ?'];
    const o = Math.floor(t * 1.2);
    for (let i = 0; i < 8; i++) x.fillText(L[(o + i) % L.length], 6, 16 + i * 14);
  },
  wave(x, w, h, t) {
    x.fillStyle = '#100608'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#ff7a4a'; x.lineWidth = 2; x.beginPath();
    for (let i = 0; i < w; i += 3) { const y = h / 2 + Math.sin(i * 0.08 + t * 6) * Math.sin(i * 0.013 + t) * h * 0.3 + (Math.random() - 0.5) * 4; i ? x.lineTo(i, y) : x.moveTo(i, y); }
    x.stroke(); x.fillStyle = '#ff7a4a'; x.font = 'bold 13px monospace'; x.fillText('KOMM // BRUS', 8, 16);
  },
  lab(x, w, h, t) {
    x.fillStyle = '#04110f'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#5dffb0'; x.font = 'bold 14px monospace'; x.fillText('MINILABB // SV-7', 8, 18);
    x.font = '12px monospace';
    const lines = SR.labStatus || ['STRÖM: AV', 'Starta reservgeneratorn.'];
    lines.forEach((l, i) => x.fillText(l, 8, 40 + i * 16));
    if (SR.genOn) { x.strokeStyle = '#5dffb0'; x.beginPath(); for (let i = 0; i < w; i += 4) { const y = h - 20 + Math.sin(i * 0.2 + t * 4) * 6; i ? x.lineTo(i, y) : x.moveTo(i, y); } x.stroke(); }
  },
};

// ---------- KOMPONENTER ----------
function cockpit() {
  const dark = M.dark, dark2 = M.dark2;
  // instrumentbräda: mitt + två vinklade sidor
  bmm(ship, -1.7, 0, -8.6, 1.7, 0.9, -7.7, dark);
  const mid = new THREE.Group(); mid.position.set(0, 0.98, -8.05); mid.rotation.x = 0.5; ship.add(mid);
  const midTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.07, 0.95), dark2); mid.add(midTop);
  const sides = [];
  for (const s of [-1, 1]) {
    const seg = new THREE.Group(); seg.position.set(s * 2.35, 0, -7.9); seg.rotation.y = -s * 0.55; ship.add(seg);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.9), dark); body.position.y = 0.45; body.castShadow = true; body.userData.col = true; seg.add(body);
    const top = new THREE.Group(); top.position.set(0, 0.98, 0); top.rotation.x = 0.5; seg.add(top);
    top.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.95), dark2));
    sides.push(top);
  }
  // hundratals små knappar (blinkar)
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const panels = [mid, ...sides];
  const N = 150;
  const inst = new THREE.InstancedMesh(geo, mat, N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  const cols = [[2.2, 0.3, 0.2], [0.3, 2.0, 0.6], [0.3, 1.2, 2.4], [2.2, 1.6, 0.3], [1.8, 1.8, 1.8]];
  const tmp = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const p = pick(panels);
    const w = p === mid ? 3.2 : 1.25;
    tmp.position.set(rand(-w / 2, w / 2), 0.045, rand(-0.4, 0.4));
    if (p === mid && Math.abs(tmp.position.x) < 0.6 && tmp.position.z > -0.1) tmp.position.x += 0.8;
    tmp.scale.set(rand(0.04, 0.1), 0.025, rand(0.04, 0.07));
    if (p.parent !== ship) p.parent.updateMatrix();
    p.updateMatrix();
    tmp.updateMatrix();
    const wm = new THREE.Matrix4().multiplyMatrices(p.matrix, tmp.matrix);
    if (p !== mid) wm.premultiply(p.parent.matrix);
    inst.setMatrixAt(i, wm);
    const c = pick(cols); col.setRGB(c[0], c[1], c[2]); inst.setColorAt(i, col);
    SR.blinkers.push({ i, base: c.slice(), rate: rand(0.3, 3), ph: rand(0, 6), blink: Math.random() < 0.3 });
  }
  ship.add(inst); SR.btnInst = inst;
  // tre stora uppgiftsknappar (kalibrering)
  [['red', 0xff3020, -0.5, 'RÖD'], ['blue', 0x2a8aff, 0, 'BLÅ'], ['green', 0x30ff60, 0.5, 'GRÖN']].forEach(([id, c, x, lab]) => {
    const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.4, roughness: 0.3 });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.085, 0.06, 20), m);
    b.position.set(x, 0.06, 0.18); mid.add(b);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 6, 20), M.hull); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.04, 0.18); mid.add(ring);
    const tag = canvasTex(64, 28, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.font = 'bold 16px Orbitron, Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lab, w / 2, h / 2);
    });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.08), new THREE.MeshBasicMaterial({ map: tag, transparent: true }));
    plate.position.set(x, 0.038, 0.32); plate.rotation.x = -Math.PI / 2; mid.add(plate);
    b.userData.int = { kind: 'button', id };
    SR.buttons[id] = { mesh: b, mat: m, glow: 0, baseY: 0.06 };
  });
  // skärmar
  screen(ship, 0.9, 0.55, D.radar, -1.15, 1.42, -8.38, -0.25);
  screen(ship, 1.1, 0.55, D.nav, 0, 1.45, -8.4, -0.25);
  screen(ship, 0.9, 0.55, D.sys, 1.15, 1.42, -8.38, -0.25);
  bmm(ship, -1.7, 1.1, -8.5, 1.7, 1.78, -8.43, dark2, false);
  screen(ship, 0.8, 0.5, D.log, -2.55, 1.35, -7.9, -0.25, 0.55);
  screen(ship, 0.8, 0.5, D.wave, 2.55, 1.35, -7.9, -0.25, -0.55);
  // hologram-HUD
  const holoTex = canvasTex(256, 128, (x, w, h) => {
    x.strokeStyle = '#5ee6ff'; x.lineWidth = 2; x.strokeRect(4, 4, w - 8, h - 8);
    x.beginPath(); x.moveTo(w / 2 - 20, h / 2); x.lineTo(w / 2 + 20, h / 2); x.moveTo(w / 2, h / 2 - 20); x.lineTo(w / 2, h / 2 + 20); x.stroke();
    x.font = 'bold 14px monospace'; x.fillStyle = '#5ee6ff'; x.fillText('ALT 412km', 10, 22); x.fillText('VEL 7.8', w - 80, 22);
    for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(20, 40 + i * 16); x.lineTo(50, 40 + i * 16); x.stroke(); }
  });
  const holo = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(1.6, 1.6, 1.6) }));
  holo.position.set(-1.0, 2.05, -7.6); holo.rotation.x = -0.15; ship.add(holo); SR.holo = holo;
  // takpanel med brytare
  bmm(ship, -1.4, 2.78, -8.5, 1.4, 3.0, -7.1, dark2, false);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) {
    const sw = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 6), M.hull);
    sw.position.set(-1.2 + i * 0.22, 2.75, -8.3 + r * 0.45); sw.rotation.x = Math.random() < 0.5 ? 0.4 : -0.4; ship.add(sw);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.03), emis(pick([0x30ff60, 0xff3020, 0xffc020]), 3)); l.position.set(-1.2 + i * 0.22, 2.77, -8.18 + r * 0.45); ship.add(l);
  }
  // styrspakar + gasreglage
  for (const s of [-1, 1]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.08, 12), dark2); base.position.set(s * 1.0, 0.62, -7.0); ship.add(base);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.4, 10), dark2); stick.position.set(s * 1.0, 0.82, -7.0); stick.rotation.x = 0.2; ship.add(stick);
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.1, 4, 8), M.seat); grip.position.set(s * 1.0, 1.03, -7.04); grip.rotation.x = 0.2; ship.add(grip);
    const trig = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.03), emis(0xff3020, 2)); trig.position.set(s * 1.0, 1.08, -7.09); ship.add(trig);
    bmm(ship, s * 1.0 - 0.12, 0, -7.12, s * 1.0 + 0.12, 0.6, -6.88, dark);
    // stolar
    const sx = s * 1.0;
    bmm(ship, sx - 0.34, 0.3, -6.65, sx + 0.34, 0.5, -6.0, M.seat);
    bmm(ship, sx - 0.06, 0, -6.4, sx + 0.06, 0.3, -6.25, dark2);
    bmm(ship, sx - 0.34, 0.5, -6.05, sx + 0.34, 1.45, -5.85, M.seat);
    bmm(ship, sx - 0.2, 1.45, -6.02, sx + 0.2, 1.72, -5.88, M.seat, false);
    for (const a of [-1, 1]) bmm(ship, sx + a * 0.36, 0.5, -6.6, sx + a * 0.32, 0.72, -6.05, dark2, false);
    for (const a of [-1, 1]) bmm(ship, sx + a * 0.15 - 0.03, 0.55, -5.86, sx + a * 0.15 + 0.03, 1.4, -5.84, M.orange, false, false);
  }
  for (let i = 0; i < 3; i++) {
    const lev = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), dark2); lev.position.set(-0.1 + i * 0.1, 1.0, -7.45); lev.rotation.x = -0.4 + i * 0.25; ship.add(lev);
    const kn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.05), i === 1 ? M.orange : M.seat); kn.position.set(-0.1 + i * 0.1, 1.09, -7.48 + i * 0.02); ship.add(kn);
  }
  bmm(ship, -0.25, 0, -7.6, 0.25, 0.92, -7.2, dark);
  // nyckelboxen på högra sidan
  SR.keyBox = makeCrate(ship, 2.2, 0.98, -7.25, Math.PI * 0.8, [['key', {}]], { w: 0.4, h: 0.14, d: 0.3, t: 0.02, mat: M.dark2, noStripe: true, name: 'Nyckelbox' });
  // cockpitljus
  SR.consoleLight = new THREE.PointLight(0x4fc8ff, 3, 7, 1.5); SR.consoleLight.position.set(0, 1.6, -7.2); ship.add(SR.consoleLight);
  const red = new THREE.PointLight(0xff4020, 1.2, 3, 2); red.position.set(-2.4, 1.2, -7.6); ship.add(red);
  const green = new THREE.PointLight(0x40ff60, 1.2, 3, 2); green.position.set(2.4, 1.2, -7.6); ship.add(green);
}

function living() {
  // bord + pallar
  SR.tableTop = bmm(ship, 1.15, 0.72, -2.95, 2.45, 0.78, -1.85, M.table);
  SR.tablePed = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.15, 0.72, 10), M.dark); SR.tablePed.position.set(1.8, 0.36, -2.4); ship.add(SR.tablePed);
  SR.stools = [];
  for (const z of [-3.4, -1.4]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.5, 14), M.seat); st.position.set(1.8, 0.25, z); st.castShadow = true; st.userData.col = true; ship.add(st);
    SR.stools.push(st);
  }
  SR.stools[1].userData.int = { kind: 'stool' };
  SR.tableProps = new THREE.Group(); ship.add(SR.tableProps);
  for (const [x, z] of [[1.6, -2.7], [2.1, -2.05]]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.1, 12), M.white); cup.position.set(x, 0.83, z); SR.tableProps.add(cup); }
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.25), M.orange); tray.position.set(1.85, 0.8, -2.4); SR.tableProps.add(tray);
  // kyl
  bmm(ship, -3.0, 0, -1.3, -2.95, 1.05, -0.5, M.white);
  bmm(ship, -3.0, 1.0, -1.3, -2.3, 1.05, -0.5, M.white);
  bmm(ship, -3.0, 0, -1.3, -2.3, 0.06, -0.5, M.white);
  bmm(ship, -3.0, 0, -1.3, -2.3, 1.05, -1.25, M.white);
  bmm(ship, -3.0, 0, -0.55, -2.3, 1.05, -0.5, M.white);
  bmm(ship, -2.95, 0.5, -1.25, -2.35, 0.53, -0.55, M.white);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.5), emis(0xcfefff, 2)); fl.position.set(-2.65, 0.98, -0.9); ship.add(fl);
  const fpiv = new THREE.Group(); fpiv.position.set(-2.28, 0, -0.5); ship.add(fpiv);
  const fdoor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.05, 0.8), M.white); fdoor.position.set(0, 0.525, -0.4); fdoor.castShadow = true; fpiv.add(fdoor);
  const fh = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), M.dark); fh.position.set(0.04, 0.7, -0.7); fpiv.add(fh);
  SR.fridgeDoor = makeHingeDoor(fpiv, fdoor, -1.9, 'Minikyl');
  // fotot i ram
  const frame = new THREE.Group(); frame.position.set(-2.96, 1.7, -0.9); frame.rotation.y = Math.PI / 2; ship.add(frame);
  const fw = 0.86, fhh = fw * 629 / 1120;
  const border = new THREE.Mesh(new THREE.BoxGeometry(fw + 0.1, fhh + 0.1, 0.04), new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.6 }));
  frame.add(border);
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(fw, fhh), new THREE.MeshStandardMaterial({ map: TEX.photo, roughness: 0.35 }));
  photo.position.z = 0.022; frame.add(photo);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(fw, fhh), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02, metalness: 0.5 }));
  glass.position.z = 0.026; frame.add(glass);
  border.userData.int = photo.userData.int = { kind: 'photo' };
  SR.photo = frame;
  const pl = new THREE.SpotLight(0xffe8c8, 3, 3, 0.6, 0.6, 1.5); pl.position.set(-2.6, 2.6, -0.9); pl.target.position.set(-2.96, 1.7, -0.9); ship.add(pl, pl.target);
  makeO2Station(ship, -2.94, 1.4, -4.5, Math.PI / 2);
}

function lab() {
  // labbänk
  bmm(ship, -3.0, 0, 1.2, -2.15, 0.88, 4.4, M.dark);
  const top = bmm(ship, -3.02, 0.88, 1.15, -2.1, 0.94, 4.45, M.white);
  top.userData.int = { kind: 'labbench' };
  // centrifug (finns från start)
  const cen = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.22, 16), M.hull); cen.position.set(-2.55, 1.05, 3.9); ship.add(cen);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 16), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 })); lid.position.set(-2.55, 1.17, 3.9); ship.add(lid);
  cen.userData.int = { kind: 'labbench' };
  // provrör
  for (let i = 0; i < 6; i++) { const tt = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.15, 8), emis(pick([0x5dff8a, 0xff5a8a, 0x5ab8ff, 0xffd23d]), 1.2)); tt.position.set(-2.8, 1.02, 1.45 + i * 0.06); ship.add(tt); }
  const rack = bmm(ship, -2.85, 0.94, 1.38, -2.75, 0.98, 1.82, M.dark2, false);
  // platser för mikroskop och analysator (syns som spöken tills de monteras)
  const ghost = new THREE.MeshBasicMaterial({ color: 0x5dffb0, wireframe: true, transparent: true, opacity: 0.35 });
  SR.labParts.mic = makeMicroscope(); SR.labParts.mic.position.set(-2.55, 0.94, 2.3); ship.add(SR.labParts.mic); SR.labParts.mic.visible = false;
  SR.labParts.ana = makeAnalyzer(); SR.labParts.ana.position.set(-2.55, 0.94, 3.1); ship.add(SR.labParts.ana); SR.labParts.ana.visible = false;
  for (const [z, s] of [[2.3, [0.3, 0.45, 0.3]], [3.1, [0.5, 0.35, 0.4]]]) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(...s), ghost); g.position.set(-2.55, 0.94 + s[1] / 2, z); ship.add(g);
    (z < 3 ? (SR.labParts.micGhost = g) : (SR.labParts.anaGhost = g));
  }
  // labbskärm
  bmm(ship, -3.0, 1.25, 1.6, -2.95, 2.05, 3.4, M.dark2, false);
  SR.labScreen = screen(ship, 1.7, 0.72, D.lab, -2.94, 1.65, 2.5, 0, Math.PI / 2);
  SR.labScreen.mesh.userData.int = { kind: 'labbench' };
  const ll = new THREE.PointLight(0xd8fff0, 2.5, 6, 1.6); ll.position.set(-2.2, 2.6, 2.8); ship.add(ll); SR.labLight = ll;
  // provtank
  const tg = new THREE.Group(); tg.position.set(2.25, 0, 2.4); ship.add(tg);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.25, 24), M.dark2); base.position.y = 0.125; tg.add(base);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 24), M.dark2); cap.position.y = 2.2; tg.add(cap);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.9, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x9fe8d8, transparent: true, opacity: 0.18, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = 1.2; tg.add(glass);
  const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.02, 24), emis(0x40ffd0, 1.5)); tl.position.y = 2.09; tg.add(tl);
  const col = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.3, 1.4), M.dark); col.position.y = 1.15; col.visible = false; col.userData.col = true; col.userData.noRay = true; tg.add(col);
  glass.userData.int = base.userData.int = { kind: 'tank' };
  SR.tank = tg;
  // skåp (ryggsäcken ligger här)
  bmm(ship, 2.4, 0, 4.0, 3.0, 2.2, 4.05, M.dark);
  bmm(ship, 2.4, 0, 4.95, 3.0, 2.2, 5.0, M.dark);
  bmm(ship, 2.4, 2.15, 4.0, 3.0, 2.2, 5.0, M.dark);
  bmm(ship, 2.4, 0, 4.05, 3.0, 0.04, 4.95, M.dark);
  bmm(ship, 2.45, 1.1, 4.05, 2.98, 1.13, 4.95, M.dark2);
  const lp = new THREE.Group(); lp.position.set(2.38, 0, 4.0); ship.add(lp);
  const ld = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.2, 1.0), new THREE.MeshStandardMaterial({ color: 0x5a6a7a, roughness: 0.5, metalness: 0.5 })); ld.position.set(0, 1.1, 0.5); ld.castShadow = true; lp.add(ld);
  const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), M.dark2); vent.position.set(-0.025, 1.8, 0.5); vent.rotation.y = -Math.PI / 2; lp.add(vent);
  SR.locker = makeHingeDoor(lp, ld, -1.7, 'Skåp');
}
function makeMicroscope() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.3), M.dark2); b.position.y = 0.02; g.add(b);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), M.white); arm.position.set(0, 0.2, -0.1); g.add(arm);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.22, 12), M.white); tube.position.set(0, 0.32, -0.03); tube.rotation.x = 0.4; g.add(tube);
  const st = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.14), M.dark2); st.position.set(0, 0.16, 0.02); g.add(st);
  const l = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), emis(0xffffff, 3)); l.position.set(0, 0.13, 0.02); g.add(l);
  g.traverse((o) => { if (o.isMesh) o.userData.int = { kind: 'labbench' }; });
  return g;
}
function makeAnalyzer() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.4), M.hull); b.position.y = 0.15; g.add(b);
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), emis(0x40ffb0, 1.5)); sc.position.set(0, 0.2, 0.201); sc.rotation.y = 0; g.add(sc);
  sc.rotation.y = 0; g.rotation.y = Math.PI / 2;
  for (let i = 0; i < 3; i++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.1), M.dark2); sl.position.set(-0.15 + i * 0.15, 0.31, 0); g.add(sl); }
  g.traverse((o) => { if (o.isMesh) o.userData.int = { kind: 'labbench' }; });
  return g;
}

function engineering() {
  // reservgeneratorn
  const g = new THREE.Group(); g.position.set(-2.45, 0, 6.3); ship.add(g);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 1.8), M.hull); body.position.y = 0.75; body.castShadow = true; body.userData.col = true; g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.12, 1.82), M.hazard); stripe.position.y = 1.3; g.add(stripe);
  SR.genCoilMat = new THREE.MeshStandardMaterial({ color: 0x552200, emissive: 0xff7a20, emissiveIntensity: 0.1 });
  for (let i = 0; i < 4; i++) { const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 18), SR.genCoilMat); coil.position.set(0.56, 0.55, -0.6 + i * 0.4); coil.rotation.y = Math.PI / 2; g.add(coil); }
  for (const z of [-0.45, 0.45]) {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20), M.dark2); housing.rotation.z = Math.PI / 2; housing.position.set(0.56, 1.0, z); g.add(housing);
    const fan = new THREE.Group(); fan.position.set(0.6, 1.0, z); g.add(fan);
    for (let b = 0; b < 5; b++) { const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.07), M.hull); blade.position.y = 0.11; const bp = new THREE.Group(); bp.rotation.x = b / 5 * Math.PI * 2; bp.add(blade); fan.add(bp); }
    SR.fans.push(fan);
  }
  const dial = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), emis(0xffd23d, 0.6)); dial.position.set(0.555, 0.35, 0.6); dial.rotation.y = Math.PI / 2; g.add(dial);
  SR.genLight = new THREE.PointLight(0xff8a30, 0, 4, 1.6); SR.genLight.position.set(-1.6, 1.2, 6.3); ship.add(SR.genLight);
  SR.genLever = makeLever(ship, -1.86, 0.95, 5.55, Math.PI / 2, 'Generatorspak', () => { setGenerator(true); });
  // medicinskåp på väggen
  bmm(ship, -3.0, 1.0, 7.6, -2.65, 1.04, 8.6, M.white);
  bmm(ship, -3.0, 1.86, 7.6, -2.65, 1.9, 8.6, M.white);
  bmm(ship, -3.0, 1.0, 7.6, -2.65, 1.9, 7.64, M.white);
  bmm(ship, -3.0, 1.0, 8.56, -2.65, 1.9, 8.6, M.white);
  const mp = new THREE.Group(); mp.position.set(-2.62, 1.0, 8.6); ship.add(mp);
  const md = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.9, 1.0), M.white); md.position.set(0, 0.45, -0.5); mp.add(md);
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, (x) => { x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#d02020'; x.fillRect(24, 8, 16, 48); x.fillRect(8, 24, 48, 16); }) }));
  cross.position.set(0.02, 0.5, -0.5); cross.rotation.y = Math.PI / 2; mp.add(cross);
  bmm(ship, -3.0, 1.4, 7.62, -2.67, 1.43, 8.58, M.white);
  SR.medCab = makeHingeDoor(mp, md, -1.6, 'Medicinskåp');
  // verktygshylla
  bmm(ship, 2.5, 1.0, 5.4, 3.0, 1.04, 6.4, M.dark2);
  bmm(ship, 2.5, 0.0, 5.4, 3.0, 0.04, 6.4, M.dark2);
  bmm(ship, 2.96, 0, 5.4, 3.0, 2.0, 6.4, M.dark);
  // WEAPONS-lådan: plasmapistol, ammo och alla roverhjul
  SR.weapons = makeCrate(ship, 2.12, 0, 7.28, -Math.PI / 2, [], {
    w: 1.38, h: 0.82, d: 1.38, t: 0.05,
    name: 'WEAPONS', label: 'WEAPONS',
    mat: new THREE.MeshStandardMaterial({ color: 0x3a3228, roughness: 0.55, metalness: 0.35 }),
  });
  SR.storage = [
    SR.weapons,
    makeCrate(ship, 2.35, 0, 8.62, -Math.PI / 2, [], { name: 'Förrådslåda' }),
  ];
  // rör & ventiler
  for (const x of [-2.9, 2.9]) { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 17, 8), M.dark2); pipe.rotation.x = Math.PI / 2; pipe.position.set(x, 2.85, 0.3); ship.add(pipe); }
  const vent = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.5), M.dark2); vent.position.set(0, 2.98, 6.5); ship.add(vent);
}

export function setGenerator(on) {
  SR.genOn = on;
  SR.genCoilMat.emissiveIntensity = on ? 3 : 0.1;
  SR.genLight.intensity = on ? 3 : 0;
  if (!on) { SR.genLever.done = false; }
  else SR.genLever.done = true;
  if (SR.onGenerator) SR.onGenerator(on);
}

// ---------- BYGG SKEPPET ----------
export function buildShip() {
  bmm(ship, -3.2, -0.25, -10.2, 3.2, 0, 9.2, M.floor);
  bmm(ship, -3.2, 3, -8.6, 3.2, 3.3, 9.2, M.hull);
  const WIN = [[-7.6, -5.6], [-3.4, -1.4]];
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -3.2 : 3.0, x1 = x0 + 0.2;
    bmm(ship, x0, 0, -8.6, x1, 1.1, 9.0, M.hull);
    bmm(ship, x0, 2.3, -8.6, x1, 3, 9.0, M.hull);
    for (const [a, b] of [[-8.6, -7.6], [-5.6, -3.4], [-1.4, 9.0]]) bmm(ship, x0, 1.1, a, x1, 2.3, b, M.hull);
    for (const [a, b] of WIN) {
      const g = bmm(ship, x0 + 0.08, 1.1, a, x0 + 0.12, 2.3, b, M.glass, true, false);
      g.receiveShadow = false; g.userData.noRay = true; SR.glass.push(g);
      if (s > 0 && a === -3.4) SR.brokenGlass = g;
      bmm(ship, x0 - 0.02, 1.05, a, x1 + 0.02, 1.12, b, M.dark, false);
      bmm(ship, x0 - 0.02, 2.28, a, x1 + 0.02, 2.35, b, M.dark, false);
    }
    const sx = s < 0 ? -3.23 : 3.2;
    bmm(ship, sx, 0.45, -10.2, sx + 0.03, 0.6, 9.2, M.orange, false, false);
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.42), new THREE.MeshStandardMaterial({ map: nameTex, transparent: true, roughness: 0.6 }));
    nm.position.set(s * 3.215, 0.82, 3.4); nm.rotation.y = s * Math.PI / 2; ship.add(nm);
    // golv-LED
    bmm(ship, s * 2.95 - 0.02, 0.01, -5, s * 2.95 + 0.02, 0.03, 8.8, emis(0x3a8aff, 2.5), false, false);
  }
  // front: vindruta + lutande takruta
  bmm(ship, -3.2, 0, -8.8, 3.2, 0.95, -8.6, M.hull);
  const ws = bmm(ship, -3.0, 0.95, -8.73, 3.0, 2.6, -8.69, M.glass, true, false); ws.userData.noRay = true; SR.glass.push(ws);
  bmm(ship, -3.2, 2.6, -8.8, 3.2, 3.0, -8.6, M.hull);
  for (const x of [-1.6, 1.6]) bmm(ship, x - 0.06, 0.95, -8.82, x + 0.06, 2.6, -8.6, M.dark, false);
  const roofGlass = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.04, 1.2), M.glass); roofGlass.position.set(0, 3.0, -8.0); ship.add(roofGlass);
  bmm(ship, -3.0, -0.25, -10.2, 3.0, 0.9, -8.8, M.hull);
  const slope = new THREE.Mesh(new THREE.BoxGeometry(6, 0.12, 1.6), M.dark); slope.position.set(0, 0.95, -9.5); slope.rotation.x = -0.35; slope.castShadow = true; ship.add(slope);
  // bakvägg + luftsluss
  bmm(ship, -3.2, 0, 9.0, -0.8, 3, 9.2, M.hull);
  bmm(ship, 0.8, 0, 9.0, 3.2, 3, 9.2, M.hull);
  bmm(ship, -0.8, 2.3, 9.0, 0.8, 3, 9.2, M.hull);
  const door = bmm(ship, -0.8, 0, 8.88, 0.8, 2.3, 8.98, M.dark);
  const hz = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.22), M.hazard); hz.position.set(0, -0.95, -0.052); hz.rotation.y = Math.PI; door.add(hz);
  const dw = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), emis(0x5ee6ff, 0.6)); dw.position.set(0, 0.45, -0.052); dw.rotation.y = Math.PI; door.add(dw);
  SR.airlock = makeSlideDoor(door, new V3(1.62, 0, 0), 'Luftsluss');
  const dl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.05), emis(0xffb030, 3)); dl.position.set(0, 2.4, 8.95); ship.add(dl);

  // motorer, vingar, fena
  for (const s of [-1, 1]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.6, 2.4, 20), M.dark);
    eng.rotation.x = Math.PI / 2; eng.position.set(s * 2.0, 1.4, 10.4); eng.castShadow = true; eng.userData.col = true; ship.add(eng);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), emis(0x55bbff, 5)); glow.position.set(s * 2.0, 1.4, 11.62); ship.add(glow); SR.engGlow.push(glow);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 8, 24), M.hull); ring.position.set(s * 2, 1.4, 11.6); ship.add(ring);
    bmm(ship, s < 0 ? -7.4 : 3.2, 0.25, -1.5, s < 0 ? -3.2 : 7.4, 0.45, 4.6, M.hull);
    bmm(ship, s < 0 ? -7.4 : 7.1, 0.2, 2.6, s < 0 ? -7.1 : 7.4, 1.2, 4.6, M.hull);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), emis(s < 0 ? 0xff2020 : 0x20ff40, 5)); tip.position.set(s * 7.25, 1.3, 3.6); ship.add(tip);
  }
  bmm(ship, -0.08, 3.3, 3.8, 0.08, 4.4, 8.9, M.hull, false);
  bmm(ship, -1.2, 3.3, -3, 1.2, 3.65, 0.5, M.dark, false);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), M.dark2); ant.position.set(0.8, 4.3, -1.5); ship.add(ant);

  // roverlådan (svart låda på skeppets vänstra sida)
  SR.roverBox = makeCrate(ship, -5.1, 0, 6.6, -Math.PI / 2, [], { w: 3.0, h: 0.85, d: 1.9, t: 0.08, mat: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.5, metalness: 0.6 }), name: 'Roverlåda' });
  SR.roverBox.grp.position.y = 0.0;

  cockpit();
  living();
  lab();
  engineering();

  // takljus
  SR.stripMat = emis(0xfff4e0, 2);
  bmm(ship, -0.22, 2.94, -6.5, 0.22, 3.0, 8.4, SR.stripMat, false, false);
  for (const z of [-4.5, 0, 6]) { const l = new THREE.PointLight(0xfff0dc, 4.5, 12, 1.6); l.position.set(0, 2.6, z); ship.add(l); SR.mainLights.push(l); }
  SR.alarmLight = new THREE.PointLight(0xff2a10, 0, 18, 1.4); SR.alarmLight.position.set(0, 2.5, -1); ship.add(SR.alarmLight);

  // kraschskador (visas efter landningen)
  SR.crashProps = new THREE.Group(); SR.crashProps.visible = false; ship.add(SR.crashProps);
  SR.swayCables = [];
  for (let i = 0; i < 16; i++) {
    const len = rand(0.7, 1.8);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 5), M.dark2);
    c.position.set(rand(-2.4, 2.4), 3.0 - len / 2, rand(-7.5, 8));
    c.rotation.z = rand(-0.45, 0.45);
    SR.crashProps.add(c);
    SR.swayCables.push({ mesh: c, ph: rand(0, 6), amp: rand(0.08, 0.22) });
  }
  for (const [x, z, r] of [[-1.4, 3.2, 0.5], [0.9, -4.0, 2.1], [-0.5, 7.2, 1.0], [1.6, 0.8, -0.8], [-1.8, -6.2, 1.4]]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(rand(0.8, 1.3), 0.04, rand(0.55, 0.95)), M.hull);
    panel.position.set(x, 0.12, z); panel.rotation.set(0.25, r, 0.35); SR.crashProps.add(panel);
  }
  const hole = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 1.15), M.dark2); hole.position.set(0.55, 2.98, 1.5); SR.crashProps.add(hole);
  const scorchM = new THREE.MeshBasicMaterial({ color: 0x1a0c06, transparent: true, opacity: 0.55, depthWrite: false });
  for (const [x, z, s] of [[-2.1, -7.2, 1.4], [0.4, 1.6, 1.1], [1.8, 6.8, 0.9], [-0.8, -2.2, 1.2]]) {
    const sc = new THREE.Mesh(new THREE.CircleGeometry(s, 14), scorchM);
    sc.rotation.x = -Math.PI / 2; sc.position.set(x, 0.02, z); SR.crashProps.add(sc);
  }
  for (let i = 0; i < 7; i++) {
    const shard = new THREE.Mesh(new THREE.BoxGeometry(rand(0.15, 0.45), 0.03, rand(0.1, 0.3)), Math.random() < 0.5 ? M.hull : M.dark2);
    shard.position.set(rand(-2.6, 2.6), 0.06, rand(-7.6, 8.2));
    shard.rotation.set(0, rand(0, 6), rand(-0.4, 0.4));
    SR.crashProps.add(shard);
  }
}

// Röra efter kraschen (bord vält, pallar omkull, fotot snett, skärmar trasiga)
export function messUpShip() {
  SR.tableTop.rotation.set(0.15, 0.4, 1.25); SR.tableTop.position.set(2.3, 0.6, -2.0);
  SR.tablePed.rotation.set(0, 0, 1.4); SR.tablePed.position.set(1.9, 0.12, -2.6);
  SR.stools[0].rotation.set(Math.PI / 2, 0, 0.6); SR.stools[0].position.set(1.2, 0.2, -3.8);
  SR.stools[1].rotation.set(Math.PI / 2, 0.8, 0); SR.stools[1].position.set(0.6, 0.2, -1.0);
  SR.photo.rotation.z = 0.18; SR.photo.position.y = 1.62;
  SR.screens.forEach((s, i) => { s.broken = i === 0 || i === 1 || i === 3 || i === 4; });
  SR.fridgeDoor.open = true;
  SR.locker.open = true;
  SR.medCab.open = true;
  SR.airlock.open = true;
  SR.crashProps.visible = true;
  SR.engGlow.forEach((g) => (g.visible = false));
  SR.tableProps.visible = false;
  SR.brokenGlass.visible = false; SR.brokenGlass.userData.col = false;
  SR.holo.visible = false;
}

export function setShipLights(mode) {
  SR.mode = mode;
  if (mode === 'normal') { SR.stripMat.emissiveIntensity = 2; SR.mainLights.forEach((l) => (l.intensity = 4.5)); SR.alarmLight.intensity = 0; SR.consoleLight.intensity = 3; }
  if (mode === 'alarm') { SR.stripMat.emissiveIntensity = 0.3; SR.mainLights.forEach((l) => (l.intensity = 1)); }
  if (mode === 'emergency') { SR.stripMat.emissiveIntensity = 0.05; SR.consoleLight.intensity = 0.6; }
  if (mode === 'power') { SR.stripMat.emissiveIntensity = 1.2; SR.mainLights.forEach((l) => (l.intensity = 3)); SR.alarmLight.intensity = 0; SR.consoleLight.intensity = 1.5; }
}

let scrT = 0;
const _c = new THREE.Color();
export function updateShip(dt, t) {
  if (SR.mode === 'alarm') SR.alarmLight.intensity = Math.sin(t * 7) > 0 ? 14 : 1.5;
  else if (SR.mode === 'emergency') {
    SR.alarmLight.intensity = 4 + Math.sin(t * 2.2) * 3;
    SR.mainLights[0].intensity = Math.random() < 0.05 ? 0 : 0.8;
    SR.mainLights[1].intensity = 0.4; SR.mainLights[2].intensity = 0.5;
    SR.consoleLight.intensity = Math.random() < 0.1 ? 0.1 : 0.6;
  }
  for (const g of SR.engGlow) g.material.emissiveIntensity = 4.5 + Math.sin(t * 20) * 0.6;
  for (const f of SR.fans) f.rotation.x += dt * (SR.genOn ? 25 : 0);
  if (SR.genOn) SR.genCoilMat.emissiveIntensity = 2.6 + Math.sin(t * 9) * 0.5;
  for (const id in SR.buttons) {
    const b = SR.buttons[id];
    b.glow = Math.max(0, b.glow - dt * 1.5);
    b.mat.emissiveIntensity = 0.4 + b.glow * 4;
    if (b.baseY != null) b.mesh.position.y = b.baseY - (b.glow > 0.25 ? 0.02 : 0);
  }
  if (SR.crashProps?.visible && SR.swayCables) {
    for (const c of SR.swayCables) c.mesh.rotation.z = Math.sin(t * 1.5 + c.ph) * c.amp;
  }
  if (SR.holo && SR.holo.visible) SR.holo.material.opacity = 0.45 + Math.sin(t * 3) * 0.1;
  scrT -= dt;
  if (scrT <= 0) {
    scrT = 0.1;
    const dead = SR.mode === 'emergency' && !SR.genOn;
    for (const s of SR.screens) {
      const isLab = s === SR.labScreen;
      if (s.broken || (dead && !isLab)) {
        s.ctx.fillStyle = '#000'; s.ctx.fillRect(0, 0, s.c.width, s.c.height);
        if (s.broken && Math.random() < 0.3) { s.ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.3})`; for (let i = 0; i < 20; i++) s.ctx.fillRect(Math.random() * 256, Math.random() * 160, Math.random() * 60, 1); }
      } else s.draw(s.ctx, s.c.width, s.c.height, t);
      s.tex.needsUpdate = true;
    }
    if (SR.btnInst) {
      const on = !(SR.mode === 'emergency' && !SR.genOn);
      for (const b of SR.blinkers) {
        const k = !on ? 0.05 : (b.blink ? (Math.sin(t * b.rate * 3 + b.ph) > 0 ? 1 : 0.15) : 1);
        _c.setRGB(b.base[0] * k, b.base[1] * k, b.base[2] * k);
        SR.btnInst.setColorAt(b.i, _c);
      }
      SR.btnInst.instanceColor.needsUpdate = true;
    }
  }
}
