// Delat speltillstånd. P = spelaren (Ciro), S = spelet, F = storyflaggor, EV = händelser som main.js kopplar in.
import * as THREE from 'three';

export const P = {
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  onGround: false,
  hp: 100,
  o2: 100,
  food: 85,
  stamina: 100,
  ammo: 0,
  hasPistol: false,
  equipped: false,
  pistolBroken: false,
  brokenPart: null,
  shotsSinceAnti: 0,
  venom: 0,          // gift i blodet (från spindelbett)
  antivenom: false,  // skyddad mot bett
  cells: 0,
  inserted: 0,
  kills: 0,
  rover: null,       // rovern spelaren sitter i
  drag: null,        // kropp som dras (Mikko / bedövad spindel)
  readTerminal: false,
};

export const S = {
  mode: 'menu',     // menu | cine | play | read | ui | pause | dead | ending
  act: 'ship',      // ship (före kraschen) | planet
  time: 0,
  playTime: 0,
  look: null,
  lidDrag: null,
  leverDrag: null,
  keyDrag: null,
  dig: 0,
  locked: false,
  softLock: false,
  skippable: false,
  crashDone: false,
  defenseT: 0,
  navOk: false,
  act1: 'start',
};

// Storyflaggor
export const F = {
  backpack: false,
  navDone: false,
  genTest: false,
  meatballs: false,
  photo: false,
  campfire: false,
  generator: false,
  mic: false,
  ana: false,
  tranq: false,
  captured: false,
  blood: false,
  analyzed: false,
  antivenom: false,
  bury: null,       // null = inte valt, true = begrav, false = låt vara
  buried: false,
  roverOut: false,
  wheels: 0,
  roverStarted: false,
  transmitter: false,
  towerSeen: false,
};

export const EV = {
  startGameplay: null,
  startAct1: null,
  onDeath: null,
  onWin: null,
};
