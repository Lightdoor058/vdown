// Rymden: stjärnor, nebulosor, planeten Veyra och asteroiden.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { V3, rand, canvasTex, softTex, vnoise } from '../core/utils.js';

export const spaceEnv = new THREE.Group();
scene.add(spaceEnv);
export let asteroid = null;
export let planetMesh = null;
export const PLANET_POS = new V3(300, -200, -700);

export function buildSpace() {
  // stjärnor
  const n = 5000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const v = new V3().randomDirection().multiplyScalar(1700);
    pos.set([v.x, v.y, v.z], i * 3);
    c.setHSL(rand(0.55, 0.7), 0.5, rand(0.5, 1)).multiplyScalar(Math.random() < 0.05 ? 3 : 1);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  spaceEnv.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true })));

  // nebulosor
  for (const [hex, dir, sc] of [[0x6a2aa0, [-1, 0.3, -0.4], 1300], [0x1a6a90, [0.4, 0.6, 1], 1100], [0xa03a50, [-0.2, -0.5, 1], 900]]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: hex, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.position.copy(new V3(...dir).normalize().multiplyScalar(1500)); s.scale.setScalar(sc); spaceEnv.add(s);
  }

  // planeten Veyra
  const tex = canvasTex(1024, 512, (x, w, h) => {
    for (let y = 0; y < h; y++) {
      const v = Math.sin(y * 0.05) * 0.5 + Math.sin(y * 0.013 + 1) * 0.5 + vnoise(0, y * 0.08) * 0.3;
      x.fillStyle = `rgb(${190 + v * 30 | 0},${95 + v * 22 | 0},${55 + v * 14 | 0})`; x.fillRect(0, y, w, 1);
    }
    for (let i = 0; i < 500; i++) {
      const cx = Math.random() * w, cy = Math.random() * h, r = Math.random() ** 3 * 40 + 2;
      x.fillStyle = `rgba(${Math.random() < 0.5 ? 70 : 130},35,22,${0.12 + Math.random() * 0.25})`;
      x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    }
    for (let i = 0; i < 60; i++) {
      x.fillStyle = 'rgba(255,230,200,0.06)';
      x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, rand(30, 120), rand(5, 15), 0, 0, 7); x.fill();
    }
  });
  planetMesh = new THREE.Mesh(new THREE.SphereGeometry(300, 64, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  planetMesh.position.copy(PLANET_POS);
  planetMesh.rotation.z = 0.3;
  spaceEnv.add(planetMesh);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(318, 48, 32), new THREE.MeshBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: 0.22, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  atmo.position.copy(PLANET_POS); spaceEnv.add(atmo);

  // sol
  const sunDir = new V3(-0.6, 0.35, 0.25).normalize();
  const sun = new THREE.DirectionalLight(0xfff0dd, 3.2); sun.position.copy(sunDir.clone().multiplyScalar(100)); spaceEnv.add(sun);
  spaceEnv.add(new THREE.HemisphereLight(0x8899cc, 0x221111, 0.45));
  const sunSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: new THREE.Color(6, 5, 4), depthWrite: false, blending: THREE.AdditiveBlending }));
  sunSpr.position.copy(sunDir.clone().multiplyScalar(1500)); sunSpr.scale.setScalar(160); spaceEnv.add(sunSpr);

  // asteroiden
  const ag = new THREE.IcosahedronGeometry(4, 3);
  const p = ag.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = new V3().fromBufferAttribute(p, i);
    const k = 1 + vnoise(v.x * 0.6, v.y * 0.6 + v.z * 0.4) * 0.28;
    v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z);
  }
  ag.computeVertexNormals();
  asteroid = new THREE.Mesh(ag, new THREE.MeshStandardMaterial({ color: 0x4a3f38, roughness: 0.95, flatShading: true, emissive: 0x401000, emissiveIntensity: 0.6 }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: new THREE.Color(3, 1.2, 0.4), blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(16); asteroid.add(glow);
  asteroid.visible = false;
  spaceEnv.add(asteroid);
}

export function updateSpace(dt) {
  if (planetMesh) planetMesh.rotation.y += dt * 0.004;
  if (asteroid && asteroid.visible) { asteroid.rotation.x += dt * 1.3; asteroid.rotation.y += dt * 0.7; }
}
