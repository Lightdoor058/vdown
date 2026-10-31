// Växlar mellan rymden och planeten.
import * as THREE from 'three';
import { scene } from '../core/render.js';
import { spaceEnv } from './space.js';
import { planetEnv, planetFog } from './planet.js';

const spaceBg = new THREE.Color(0x020308);
export let envName = 'space';

export function setEnv(name) {
  envName = name;
  spaceEnv.visible = name === 'space';
  planetEnv.visible = name === 'planet';
  scene.fog = name === 'planet' ? planetFog : null;
  scene.background = name === 'planet' ? planetFog.color : spaceBg;
}
