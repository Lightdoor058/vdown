// Astronauterna (dina modeller: Mikko = blå, Ciro = röd) med animationer och enkel vägfinnande gång.
import * as THREE from 'three';
import { cloneAsset, tintClone } from '../core/assets.js';
import { Rig, HUMAN_BONES, POSES, walkPose } from './rig.js';
import { clamp } from '../core/utils.js';

const SCALE = 1.75 / 138.78;

export function makeAstronaut(kind = 'mikko', tint = null) {
  const model = cloneAsset(kind === 'corpse' ? 'mikko' : kind);
  if (tint) tintClone(model, tint);
  model.scale.setScalar(SCALE);
  const root = new THREE.Group();
  root.add(model);
  const rig = new Rig(model, HUMAN_BONES);
  const helmet = rig.b.head.bone;
  // osynlig träffyta (för att titta på / dra kroppen)
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.6), new THREE.MeshBasicMaterial());
  hit.position.y = 0.9; hit.visible = false; root.add(hit);

  const a = {
    kind, root, model, rig, helmet, hit,
    pose: 'idle', phase: 0, talk: 0, path: null, speed: 1.4, onArrive: null, faceTo: null,
    gesture: 0, look: 0, extra: null, t: Math.random() * 10,
    setPose(name, snap = false) {
      a.pose = name;
      if (snap) rig.snap(name === 'walk' ? walkPose(0) : POSES[name] || POSES.idle);
    },
    // gå längs en lista med punkter (i förälderns koordinater)
    walkTo(points, onArrive, endPose = 'idle', faceY = null) {
      a.path = points.map((p) => new THREE.Vector3(p[0], 0, p[1]));
      a.onArrive = onArrive; a.endPose = endPose; a.faceTo = faceY;
      a.root.position.y = 0; a.root.rotation.x = 0; a.root.rotation.z = 0;
      a.pose = 'walk';
    },
    update(dt) {
      a.t += dt;
      if (a.path && a.path.length) {
        const p = a.root.position, tgt = a.path[0];
        const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
        if (d < 0.08) {
          a.path.shift();
          if (!a.path.length) {
            a.path = null; a.pose = a.endPose;
            if (a.faceTo != null) a.targetYaw = a.faceTo;
            const cb = a.onArrive; a.onArrive = null; if (cb) cb();
          }
        } else {
          const step = Math.min(d, a.speed * dt);
          p.x += dx / d * step; p.z += dz / d * step;
          a.targetYaw = Math.atan2(dx, dz);
          a.phase += dt * a.speed * 5.2;
        }
      }
      if (a.targetYaw != null) {
        let df = a.targetYaw - a.root.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df));
        a.root.rotation.y += df * Math.min(1, dt * 7);
      }
      if (a.pose === 'static') return;
      let pose;
      if (a.pose === 'walk') pose = walkPose(a.phase);
      else pose = { ...(POSES[a.pose] || POSES.idle) };
      // andning + liv
      const br = Math.sin(a.t * 1.6) * 0.025;
      if (a.pose === 'idle' || a.pose === 'work' || a.pose === 'sit' || a.pose === 'pilot' || a.pose === 'hold') {
        pose.spine = [(pose.spine ? pose.spine[0] : 0) + br, 0, 0];
        pose.head = [(pose.head ? pose.head[0] : 0) + Math.sin(a.t * 0.5) * 0.04, Math.sin(a.t * 0.37) * 0.18 + a.look, 0];
      }
      if (a.pose === 'work') {
        pose.foreL = [0, -0.95 + Math.sin(a.t * 7) * 0.15, 0];
        pose.foreR = [0, 0.95 + Math.sin(a.t * 6 + 1) * 0.15, 0];
      }
      if (a.pose === 'pilot') {
        pose.armL = [-1.0 + Math.sin(a.t * 0.8) * 0.05, 0, -0.95];
        pose.armR = [-1.0 + Math.sin(a.t * 0.9 + 1) * 0.05, 0, 0.95];
      }
      // gester när personen pratar
      if (a.talk > 0 && (a.pose === 'idle' || a.pose === 'sit')) {
        a.talk -= dt;
        const g = Math.sin(a.t * 5);
        pose.armR = [-0.5 + g * 0.25, 0, a.pose === 'sit' ? 1.0 : 0.95];
        pose.foreR = [0, 1.1 + Math.sin(a.t * 7) * 0.2, 0];
        pose.head = [(pose.head ? pose.head[0] : 0) + Math.sin(a.t * 6) * 0.06, pose.head ? pose.head[1] : 0, 0];
      }
      if (a.pose === 'wave') pose.foreR = [0, 0.6 + Math.sin(a.t * 10) * 0.4, 0];
      rig.blend(pose, 1 - Math.exp(-9 * dt));
      // gung i höften när man går
      if (a.pose === 'walk' && a.model) a.model.position.y = Math.abs(Math.sin(a.phase)) * 0.035;
      else if (a.model) a.model.position.y += (0 - a.model.position.y) * 0.2;
    },
  };
  root.userData.astro = a;
  return a;
}

// Färgscheman för döda forskare/astronauter i världen
export const SUITS = {
  odla: { all: 0xbfa66a, 'Material.006': 0x6a4a1a, 'Material.008': 0x6a4a1a },
  helion: { all: 0x3a3e46, 'Material.006': 0xffcf3a, 'Material.008': 0xffcf3a },
  miner: { all: 0xd0782a, 'Material.006': 0x222222, 'Material.008': 0x222222 },
};

export function makeCorpse(suit, pose = 'dead') {
  const a = makeAstronaut('corpse', SUITS[suit]);
  a.setPose(pose, true);
  a.pose = 'static';
  return a;
}
