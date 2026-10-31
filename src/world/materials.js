// Delade material och en hjälpfunktion för att bygga lådor med min/max-hörn.
import * as THREE from 'three';
import { canvasTex } from '../core/utils.js';

const floorTex = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#3b4048'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < h; i += 16) for (let j = 0; j < w; j += 16) {
    x.fillStyle = ((i + j) / 16) % 2 ? '#4a5059' : '#30353c';
    x.fillRect(j + 3, i + 6, 10, 3);
  }
  x.strokeStyle = '#1d2126'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4);
}, [3, 7]);

const panelTex = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = '#c4c8ce'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 50; i++) {
    x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
    x.fillRect(Math.random() * w, Math.random() * h, Math.random() * 70, Math.random() * 30);
  }
  x.strokeStyle = 'rgba(55,60,70,0.6)'; x.lineWidth = 2;
  x.strokeRect(1, 1, w - 2, h - 2);
  x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
  x.fillStyle = 'rgba(60,65,75,0.7)';
  for (let i = 0; i < 8; i++) {
    x.beginPath(); x.arc(10 + i * 33, 8, 2.2, 0, 7); x.fill();
    x.beginPath(); x.arc(10 + i * 33, h - 8, 2.2, 0, 7); x.fill();
  }
}, [2, 1]);

const crateTex = canvasTex(128, 128, (x, w, h) => {
  x.fillStyle = '#8a8f7a'; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
  for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`; x.fillRect(Math.random() * w, Math.random() * h, 20, 6); }
});

export const hazardTex = canvasTex(256, 32, (x, w, h) => {
  x.fillStyle = '#f2c200'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#111';
  for (let i = -2; i < 20; i++) { x.beginPath(); x.moveTo(i * 24, h); x.lineTo(i * 24 + 12, h); x.lineTo(i * 24 + 24, 0); x.lineTo(i * 24 + 12, 0); x.fill(); }
});

export const M = {
  hull: new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.5, metalness: 0.4 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.55, metalness: 0.5 }),
  dark2: new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.4, metalness: 0.6 }),
  floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75, metalness: 0.35 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.1, depthWrite: false }),
  orange: new THREE.MeshStandardMaterial({ color: 0xff7a2a, roughness: 0.5 }),
  table: new THREE.MeshStandardMaterial({ color: 0x5b6470, roughness: 0.35, metalness: 0.6 }),
  white: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.35 }),
  seat: new THREE.MeshStandardMaterial({ color: 0x3b4250, roughness: 0.9 }),
  wall: new THREE.MeshStandardMaterial({ map: panelTex, color: 0x8a8378, roughness: 0.7, metalness: 0.3 }),
  cloth: new THREE.MeshStandardMaterial({ color: 0x5f6e5a, roughness: 1, flatShading: true, side: THREE.DoubleSide }),
  crate: new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.8, metalness: 0.2 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x6e4a36, roughness: 0.9, metalness: 0.3 }),
  hazard: new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.6 }),
};

export const emis = (c, i = 2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4 });

// Box från hörn (x0,y0,z0) till (x1,y1,z1). col = blir en vägg man krockar med.
export function bmm(parent, x0, y0, z0, x1, y1, z1, mat, col = true, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = shadow; m.receiveShadow = true;
  if (col) m.userData.col = true;
  parent.add(m);
  return m;
}
