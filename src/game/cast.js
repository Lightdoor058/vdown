// Karaktärerna (Ciro och Mikko) och Mikkos skador efter kraschen.
import * as THREE from 'three';
import { ship } from '../world/ship.js';
import { M } from '../world/materials.js';

export const cast = { mikko: null, you: null, blood: null, injured: false, armProp: null };

export function mikkoInjured() {
  if (cast.injured) return;
  cast.injured = true;
  const m = cast.mikko;
  if (m.root.parent !== ship) ship.add(m.root);
  m.root.visible = true;
  m.path = null; m.targetYaw = null;
  m.root.position.set(2.5, -0.62, -4.6);
  m.root.rotation.set(0, -Math.PI / 2, 0);
  m.setPose('slump', true);

  // armen är borta: skala ner armbenet och lägg en lös arm på golvet
  const armBone = m.rig.b.armL.bone;
  armBone.scale.setScalar(0.001);
  const red = new THREE.MeshStandardMaterial({ color: 0x5a0505, roughness: 0.2, metalness: 0.1 });
  const stump = new THREE.Mesh(new THREE.SphereGeometry(9, 10, 8), red);
  stump.position.copy(armBone.position);
  armBone.parent.add(stump);

  const arm = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0xe8ebee, roughness: 0.62 });
  const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 10), suit); up.rotation.z = Math.PI / 2; up.position.x = 0.2; arm.add(up);
  const lo = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 4, 10), suit); lo.rotation.z = Math.PI / 2 + 0.5; lo.position.set(0.55, 0.06, 0.05); arm.add(lo);
  const glove = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), M.dark); glove.position.set(0.75, 0.15, 0.08); arm.add(glove);
  const end = new THREE.Mesh(new THREE.CircleGeometry(0.075, 10), red); end.rotation.y = -Math.PI / 2; end.position.x = 0.0; arm.add(end);
  arm.position.set(1.5, 0.08, -3.9); arm.rotation.set(0, 0.9, 0);
  arm.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  ship.add(arm); cast.armProp = arm;

  const pool = new THREE.MeshStandardMaterial({ color: 0x4a0404, roughness: 0.15, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 });
  const blood = new THREE.Mesh(new THREE.CircleGeometry(1, 28), pool);
  blood.rotation.x = -Math.PI / 2; blood.position.set(2.15, 0.012, -4.5); blood.scale.setScalar(0.3);
  ship.add(blood); cast.blood = blood;
  const b2 = blood.clone(); b2.position.set(1.55, 0.011, -3.9); b2.scale.setScalar(0.22); ship.add(b2);
}

export function mikkoDead() {
  const m = cast.mikko;
  m.setPose('dead');
  m.pose = 'dead';
  if (cast.blood) cast.blood.scale.setScalar(0.85);
}
