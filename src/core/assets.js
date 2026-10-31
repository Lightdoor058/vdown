// Laddar dina 3D-modeller (FBX) innan spelet startar och gör om materialen så de ser bra ut i spelet.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export const A = {};
const FILES = {
  mikko: '/models/mikko.fbx',
  ciro: '/models/ciro.fbx',
  spider: '/models/spider.fbx',
  plasma: '/models/plasma.fbx',
  medkit: '/models/medkit.fbx',
};
export const TEX = {};

// Phong → Standard (snyggare ljus), och vit dräkt där paletten saknas.
function upgradeMaterials(obj, opts = {}) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const conv = (m) => {
      const isPalette = m.name === 'paleta';
      const nm = new THREE.MeshStandardMaterial({
        name: m.name,
        map: isPalette && opts.palette ? opts.palette : null,
        color: isPalette ? new THREE.Color(opts.palette ? 0xffffff : (opts.suit ?? 0xe8ebee)) : m.color.clone(),
        roughness: isPalette ? 0.62 : 0.45,
        metalness: isPalette ? 0.05 : 0.2,
      });
      if (opts.glow && opts.glow.includes(m.name)) { nm.emissive = nm.color.clone(); nm.emissiveIntensity = 1.6; }
      return nm;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
}

export async function loadAssets(onProgress) {
  const L = new FBXLoader();
  const names = Object.keys(FILES);
  let done = 0;
  await Promise.all(names.map(async (n) => {
    const obj = await L.loadAsync(FILES[n]);
    A[n] = obj;
    done++; if (onProgress) onProgress(done / (names.length + 1));
  }));
  TEX.photo = await new THREE.TextureLoader().loadAsync('/textures/photo.webp');
  TEX.photo.colorSpace = THREE.SRGBColorSpace;
  // färgpaletten för astronautdräkterna (Mikko och Ciro)
  TEX.paleta = await new THREE.TextureLoader().loadAsync('/textures/paleta.png');
  TEX.paleta.colorSpace = THREE.SRGBColorSpace;
  TEX.paleta.magFilter = THREE.NearestFilter;
  TEX.paleta.minFilter = THREE.NearestFilter;
  TEX.paleta.generateMipmaps = false;
  if (onProgress) onProgress(1);

  upgradeMaterials(A.mikko, { glow: ['Material.007'], palette: TEX.paleta });
  upgradeMaterials(A.ciro, { glow: ['Material.007'], palette: TEX.paleta });
  upgradeMaterials(A.spider, { glow: ['White', 'Material.001', 'Material.002', 'Material.003'] });
  upgradeMaterials(A.plasma, { glow: ['Material.002'] });
  upgradeMaterials(A.medkit);
  A.spider.traverse((o) => { if (o.isMesh && o.name === 'Icosphere') o.visible = false; });
  A.spider.traverse((o) => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    ms.forEach((m) => { if (m.name === 'Material.004') { m.color.set(0x1a1424); m.roughness = 0.35; m.metalness = 0.3; } });
  });
}

// Kopia av en modell (med eget skelett om den har ett)
export function cloneAsset(name) { return SkeletonUtils.clone(A[name]); }

// Färga om material på en kopia (t.ex. döda astronauter i andra dräkter)
export function tintClone(obj, map) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const tint = (m) => { const c = m.clone(); if (map[m.name] != null) c.color.set(map[m.name]); if (map.all && m.name === 'paleta') c.color.set(map.all); return c; };
    o.material = Array.isArray(o.material) ? o.material.map(tint) : tint(o.material);
  });
}

// Skala en modell så att dess största mått blir "size" meter, och lägg den i en grupp.
export function fitModel(obj, size, axis = 'max') {
  const box = new THREE.Box3().setFromObject(obj);
  const s = new THREE.Vector3(); box.getSize(s);
  const k = size / (axis === 'max' ? Math.max(s.x, s.y, s.z) : s[axis]);
  obj.scale.multiplyScalar(k);
  const g = new THREE.Group();
  g.add(obj);
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = new THREE.Vector3(); b2.getCenter(c);
  obj.position.sub(c);
  return g;
}
