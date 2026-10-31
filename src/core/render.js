// Renderer, scen, kamera och efterbehandling (bloom/glöd).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const canvas = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const dpr = Math.min(window.devicePixelRatio, 1.5);
renderer.setPixelRatio(dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020308);

export const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 4000);
scene.add(camera);

const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(dpr);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.45, 0.5, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// Kameraskak: base = konstant skak, kick = tillfällig stöt som klingar av.
export const shake = { base: 0, kick: 0 };
const off = new THREE.Vector3();
export function render(dt) {
  shake.kick = Math.max(0, shake.kick - dt * 1.6);
  const a = shake.base + shake.kick * 0.25;
  off.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a * 0.5);
  camera.position.add(off);
  composer.render();
  camera.position.sub(off);
}
