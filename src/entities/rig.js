// Animationer med kod: vrider benen i skelettet mot poser och blandar mjukt mellan dem.
// Poserna anges i modellens rum (modellen tittar mot +Z, vänster = +X) som Euler-vinklar [x, y, z].
import * as THREE from 'three';

const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _d = new THREE.Quaternion();

export class Rig {
  constructor(model, map) {
    this.b = {};
    model.updateMatrixWorld(true);
    const inv = model.getWorldQuaternion(new THREE.Quaternion()).invert();
    model.traverse((o) => {
      if (!o.isBone) return;
      for (const k in map) {
        if (map[k] === o.name && !this.b[k]) {
          const M = inv.clone().multiply(o.getWorldQuaternion(new THREE.Quaternion()));
          this.b[k] = { bone: o, rest: o.quaternion.clone(), M, Mi: M.clone().invert(), cur: [0, 0, 0] };
        }
      }
    });
  }
  // sätt en pose direkt
  snap(pose) { for (const k in this.b) { const t = pose[k] || ZERO; this.b[k].cur = [t[0], t[1], t[2]]; } this.apply(); }
  // blanda mot pose
  blend(pose, k) {
    for (const key in this.b) {
      const t = pose[key] || ZERO, c = this.b[key].cur;
      c[0] += (t[0] - c[0]) * k; c[1] += (t[1] - c[1]) * k; c[2] += (t[2] - c[2]) * k;
    }
    this.apply();
  }
  apply() {
    for (const key in this.b) {
      const B = this.b[key], c = B.cur;
      _e.set(c[0], c[1], c[2], 'XYZ');
      _q.setFromEuler(_e);
      _d.copy(B.Mi).multiply(_q).multiply(B.M);
      B.bone.quaternion.copy(B.rest).multiply(_d);
    }
  }
}
const ZERO = [0, 0, 0];

// ---------- poser för astronauterna ----------
export const HUMAN_BONES = {
  hips: 'base', spine: 'espinha', neck: 'pescoco', head: 'cabeca',
  armL: 'bicepL', foreL: 'antbracoL', handL: 'maoL',
  armR: 'bicepR', foreR: 'antbracoR', handR: 'maoR',
  thighL: 'coxaL', shinL: 'canelaL', footL: 'peL',
  thighR: 'coxaR', shinR: 'canelaR', footR: 'peR',
};

const down = { armL: [0, 0, -1.08], armR: [0, 0, 1.08], foreL: [0, -0.15, 0], foreR: [0, 0.15, 0] };
export const POSES = {
  idle: { ...down },
  sit: {
    thighL: [-1.5, 0, 0.05], thighR: [-1.5, 0, -0.05], shinL: [1.45, 0, 0], shinR: [1.45, 0, 0],
    armL: [-0.55, 0, -1.0], armR: [-0.55, 0, 1.0], foreL: [0, -0.9, 0], foreR: [0, 0.9, 0],
  },
  pilot: {
    thighL: [-1.45, 0, 0.08], thighR: [-1.45, 0, -0.08], shinL: [1.3, 0, 0], shinR: [1.3, 0, 0],
    armL: [-1.0, 0, -0.95], armR: [-1.0, 0, 0.95], foreL: [0, -0.45, 0], foreR: [0, 0.45, 0], head: [0.05, 0, 0],
  },
  work: {
    spine: [0.22, 0, 0], head: [0.3, 0, 0],
    armL: [-0.95, 0, -1.0], armR: [-0.95, 0, 1.0], foreL: [0, -0.95, 0], foreR: [0, 0.95, 0],
  },
  crouch: {
    thighL: [-1.2, 0, 0.1], thighR: [-0.5, 0, -0.1], shinL: [1.9, 0, 0], shinR: [1.6, 0, 0], spine: [0.35, 0, 0],
    armL: [-0.9, 0, -1.0], armR: [-0.9, 0, 1.0], foreL: [0, -0.6, 0], foreR: [0, 0.6, 0],
  },
  lie: { armL: [0, 0, -0.55], armR: [0, 0, 0.55], thighL: [0, 0, 0.1], thighR: [0, 0, -0.1], head: [0, 0.4, 0] },
  slump: {
    thighL: [-1.35, 0, 0.18], thighR: [-1.35, 0, -0.18], shinL: [0.25, 0, 0], shinR: [0.35, 0, 0],
    spine: [-0.3, 0, 0], head: [0.25, 0, 0],
    armL: [0.1, 0, -1.0], armR: [0.1, 0, 1.0], foreL: [0, -0.4, 0], foreR: [0, 0.4, 0],
  },
  dead: {
    thighL: [-1.35, 0, 0.25], thighR: [-1.3, 0, -0.2], shinL: [0.2, 0, 0], shinR: [0.4, 0, 0],
    spine: [-0.42, 0, 0.1], head: [0.85, 0, 0.4],
    armL: [0.2, 0, -1.15], armR: [0.25, 0, 1.15], foreL: [0, -0.2, 0], foreR: [0, 0.1, 0],
  },
  dragged: { armL: [0, 0, 2.0], armR: [0, 0, -2.0], head: [-0.3, 0, 0], thighL: [0, 0, 0.05], thighR: [0, 0, -0.05] },
  thumbs: { ...down, armR: [-0.5, 0, 1.0], foreR: [0, 1.5, 0] },
  point: { ...down, armR: [-1.45, 0, 1.1], foreR: [0, 0.1, 0], head: [0, -0.2, 0] },
  wave: { ...down, armR: [0, 0, -1.55], foreR: [0, 0.6, 0] },
  shrug: { ...down, armL: [-0.4, 0, -0.75], armR: [-0.4, 0, 0.75], foreL: [0, -1.2, 0], foreR: [0, 1.2, 0], head: [0, 0, 0.15] },
  hold: { ...down, armL: [-1.1, 0, -1.0], armR: [-1.1, 0, 1.0], foreL: [0, -1.0, 0], foreR: [0, 1.0, 0] },
};

// Gångcykel (fas p i radianer)
export function walkPose(p, amt = 1) {
  const s = Math.sin(p), c = Math.cos(p);
  return {
    thighL: [-s * 0.55 * amt, 0, 0], thighR: [s * 0.55 * amt, 0, 0],
    shinL: [Math.max(0, -c) * 0.9 * amt + 0.05, 0, 0], shinR: [Math.max(0, c) * 0.9 * amt + 0.05, 0, 0],
    armL: [s * 0.4 * amt, 0, -1.08], armR: [-s * 0.4 * amt, 0, 1.08],
    foreL: [0, -0.3, 0], foreR: [0, 0.3, 0], spine: [0.06 * amt, 0, 0],
  };
}

// ---------- spindeln ----------
export const SPIDER_LEGS = [];
for (const n of [1, 2, 3, 4]) for (const s of ['L', 'R']) SPIDER_LEGS.push({ key: `L${n}${s}`, bone: `Leg${n}_${s}_1`, knee: `Leg${n}_${s}_2`, n, s });
export const SPIDER_BONES = { chL: 'Chelicera_L_1', chR: 'Chelicera_R_1' };
SPIDER_LEGS.forEach((l) => { SPIDER_BONES[l.key] = l.bone; SPIDER_BONES[l.key + 'k'] = l.knee; });

// Spindelns gång: två grupper av ben växlar (som riktiga spindlar). Spindeln tittar mot +X i sin egen modell.
export function spiderPose(p, amt, state = 'walk', t = 0) {
  const pose = {};
  for (const l of SPIDER_LEGS) {
    const groupA = (l.n + (l.s === 'L' ? 0 : 1)) % 2 === 0;
    const ph = p + (groupA ? 0 : Math.PI) + l.n * 0.3;
    const side = l.s === 'R' ? -1 : 1;
    if (state === 'stun' || state === 'dead') {
      const tw = state === 'stun' ? Math.sin(t * 25 + l.n) * 0.08 : 0;
      pose[l.key] = [side * 0.9 + tw, 0, 0];
      pose[l.key + 'k'] = [side * 0.9, 0, 0];
    } else {
      pose[l.key] = [side * Math.max(0, Math.cos(ph)) * 0.35 * amt, Math.sin(ph) * 0.32 * amt, 0];
      pose[l.key + 'k'] = [side * Math.max(0, Math.cos(ph)) * 0.25 * amt, 0, 0];
    }
  }
  const bite = state === 'bite' ? Math.sin(t * 30) * 0.4 : Math.sin(t * 3) * 0.08;
  pose.chL = [0, 0, bite]; pose.chR = [0, 0, -bite];
  return pose;
}
