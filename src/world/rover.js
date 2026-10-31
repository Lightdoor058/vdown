// Minirovern: ligger i den svarta lådan vid Sparven. Lyft ut den, montera 4 hjul, vrid nyckeln och kör.
import * as THREE from 'three';
import { scene, camera, shake } from '../core/render.js';
import { V3, clamp, lerp, rand } from '../core/utils.js';
import { SFX, loop, loopPitch } from '../core/audio.js';
import { M, emis, bmm } from './materials.js';
import { resolveChar, groundH, addBoxCol } from '../systems/physics.js';
import { ship, SR } from './ship.js';
import { P, S, F } from '../game/state.js';
import { invHas, invTake, invCount } from '../game/inventory.js';
import { creatures } from '../entities/creatures.js';
import { burst, FX } from '../systems/particles.js';
import * as UI from '../ui/ui.js';
import { onRoverEvent } from '../game/objectives.js';

export const rover = {
  g: new THREE.Group(), state: 'boxed', wheels: [], mounted: 0, speed: 0, heading: 0, keyAngle: 0, started: false,
  pos: new V3(), vel: new V3(), col: null, camYaw: 0, camPitch: 0.25, pitch: 0, roll: 0,
};

const WHEEL_POS = [[-0.85, 0.95], [0.85, 0.95], [-0.85, -0.95], [0.85, -0.95]];

export function buildRover() {
  const g = rover.g;
  const body = new THREE.Group(); g.add(body); rover.body = body;
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 2.5), new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.5, metalness: 0.4 }));
  chassis.position.y = 0.45; chassis.castShadow = true; body.add(chassis);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.08, 2.52), M.orange); stripe.position.y = 0.5; body.add(stripe);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.55), M.seat); seat.position.set(0, 0.68, 0.1); body.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.1), M.seat); back.position.set(0, 0.95, 0.4); body.add(back);
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.25), M.dark2); dash.position.set(0, 0.75, -0.6); dash.rotation.x = -0.4; body.add(dash);
  const wheelS = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 16), M.dark2); wheelS.position.set(0, 0.95, -0.4); wheelS.rotation.x = -0.9; body.add(wheelS); rover.steer = wheelS;
  // rullbur
  const cageM = new THREE.MeshStandardMaterial({ color: 0x2a2e35, metalness: 0.7, roughness: 0.4 });
  for (const s of [-1, 1]) {
    for (const z of [-0.5, 0.55]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), cageM); p.position.set(s * 0.65, 1.1, z); body.add(p); }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 6), cageM); top.rotation.x = Math.PI / 2; top.position.set(s * 0.65, 1.65, 0.02); body.add(top);
  }
  const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), cageM); cross.rotation.z = Math.PI / 2; cross.position.set(0, 1.65, 0.55); body.add(cross);
  // lastflak
  bmm(body, -0.7, 0.6, 0.6, 0.7, 0.85, 1.25, M.dark, false);
  // strålkastare
  for (const s of [-1, 1]) { const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), emis(0xfff4d0, 0.3)); hl.rotation.x = Math.PI / 2; hl.position.set(s * 0.55, 0.6, -1.27); body.add(hl); (rover.lamps ||= []).push(hl); }
  rover.light = new THREE.SpotLight(0xfff0d0, 0, 40, 0.6, 0.5, 1.3); rover.light.position.set(0, 0.7, -1.3); body.add(rover.light);
  rover.light.target.position.set(0, 0, -10); body.add(rover.light.target);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.2, 4), cageM); ant.position.set(0.6, 1.9, 1.0); body.add(ant);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.15), new THREE.MeshStandardMaterial({ color: 0xff7a2a, side: THREE.DoubleSide })); flag.position.set(0.72, 2.4, 1.0); body.add(flag); rover.flag = flag;
  // nyckel i tändningslåset
  const keyPiv = new THREE.Group(); keyPiv.position.set(0.25, 0.86, -0.62); keyPiv.rotation.x = -0.4; body.add(keyPiv);
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.015), new THREE.MeshStandardMaterial({ color: 0xd0b040, metalness: 0.9, roughness: 0.3 })); key.position.y = 0.04; keyPiv.add(key);
  keyPiv.visible = false; rover.keyPiv = keyPiv;
  // axlar + hjul (hjulen syns först när de monterats)
  WHEEL_POS.forEach(([x, z]) => {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8), M.dark2); axle.rotation.z = Math.PI / 2; axle.position.set(x * 0.85, 0.36, z); body.add(axle);
    const wg = new THREE.Group(); wg.position.set(x, 0.36, z); body.add(wg);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.1, 10, 20), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.9 })); tire.rotation.y = Math.PI / 2; wg.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8 })); hub.rotation.z = Math.PI / 2; wg.add(hub);
    wg.visible = false; rover.wheels.push(wg);
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (!o.userData.int) o.userData.int = { kind: 'rover' }; } });
  key.userData.int = { kind: 'roverkey' };
  // ligger i lådan
  g.position.set(-5.1, 0.08, 6.6); g.scale.setScalar(0.5);
  ship.add(g);
}

// E på rovern
export function interactRover() {
  if (rover.state === 'boxed') {
    if (SR.roverBox.angle < 1.2) { UI.toast('Öppna lådan först (håll vänster musknapp på locket och dra uppåt).'); return; }
    rover.state = 'out';
    scene.attach(rover.g);
    rover.g.scale.setScalar(1);
    const wp = ship.localToWorld(new V3(-8.4, 0, 6.6));
    rover.pos.set(wp.x, groundH(wp.x, wp.z), wp.z);
    rover.heading = Math.PI / 2;
    placeRover();
    rover.col = addBoxCol(new V3(), new V3());
    updateCol();
    SFX.thud(0.6); burst(rover.pos.clone(), 'dust', 10);
    F.roverOut = true;
    UI.toast('Rovern är ute! Den saknar hjul — de ligger i maskinrummet.', 'good');
    onRoverEvent();
    return;
  }
  if (rover.mounted < 4) {
    let n = 0;
    while (rover.mounted < 4 && invTake('wheel')) { rover.wheels[rover.mounted].visible = true; rover.mounted++; n++; }
    if (n) { SFX.keyTurn(); SFX.thud(0.4); UI.toast(`Monterade ${n} hjul (${rover.mounted}/4)`, 'good'); F.wheels = rover.mounted; onRoverEvent(); }
    else UI.toast(`Rovern behöver ${4 - rover.mounted} hjul till. Lägg dem i ryggsäcken [F] eller släpp dem bredvid rovern.`);
    return;
  }
  // sätt dig i rovern
  P.rover = rover;
  rover.camYaw = 0;
  if (rover.col) rover.col.on = false;
  if (!rover.started) {
    if (invHas('key') || rover.keyPiv.visible) { rover.keyPiv.visible = true; invTake('key'); UI.toast('Håll VÄNSTER musknapp på nyckeln och dra musen ÅT HÖGER för att starta.', 'tip'); }
    else UI.toast('Du behöver rovernyckeln. Den ligger i nyckelboxen i cockpit.', 'bad');
  }
}

// Montera hjul som släpps bredvid rovern
export function tryMountDropped(item) {
  if (rover.state !== 'out' || rover.mounted >= 4 || item.type !== 'wheel') return false;
  if (item.pos.distanceTo(rover.pos) > 2.2) return false;
  rover.wheels[rover.mounted].visible = true; rover.mounted++; F.wheels = rover.mounted;
  item.remove(); SFX.keyTurn(); UI.toast(`Hjul monterat (${rover.mounted}/4)`, 'good'); onRoverEvent();
  return true;
}

export function turnKey(dx) {
  if (rover.started) return;
  rover.keyAngle = clamp(rover.keyAngle + dx * 0.008, 0, 1.3);
  rover.keyPiv.rotation.z = -rover.keyAngle;
  if (rover.keyAngle >= 1.25) {
    rover.started = true; F.roverStarted = true; S.keyDrag = false;
    SFX.keyTurn(); SFX.engineStart(); loop('rover', 0.08, 0.5);
    rover.light.intensity = 30; rover.lamps.forEach((l) => (l.material.emissiveIntensity = 4));
    UI.toast('VRUUUM! W/S = gas/back · A/D = sväng · mellanslag = broms · E = kliv ur', 'good');
    onRoverEvent();
  }
}

export function exitRover() {
  P.rover = null;
  const side = new V3(Math.cos(rover.heading), 0, -Math.sin(rover.heading));
  P.pos.copy(rover.pos).addScaledVector(side, -1.6);
  P.pos.y = groundH(P.pos.x, P.pos.z);
  P.vel.set(0, 0, 0);
  P.yaw = rover.heading;
  if (rover.col) { updateCol(); rover.col.on = true; }
  loop('rover', 0.02, 0.5);
}

function updateCol() {
  if (!rover.col) return;
  rover.col.box.min.set(rover.pos.x - 1.0, rover.pos.y, rover.pos.z - 1.0);
  rover.col.box.max.set(rover.pos.x + 1.0, rover.pos.y + 0.9, rover.pos.z + 1.0);
}

function placeRover() {
  const p = rover.pos, h = rover.heading;
  const f = new V3(-Math.sin(h), 0, -Math.cos(h)), r = new V3(Math.cos(h), 0, -Math.sin(h));
  const hf = groundH(p.x + f.x * 1.1, p.z + f.z * 1.1), hb = groundH(p.x - f.x * 1.1, p.z - f.z * 1.1);
  const hr = groundH(p.x + r.x * 0.8, p.z + r.z * 0.8), hl = groundH(p.x - r.x * 0.8, p.z - r.z * 0.8);
  rover.pitch = lerp(rover.pitch, Math.atan2(hf - hb, 2.2), 0.3);
  rover.roll = lerp(rover.roll, Math.atan2(hr - hl, 1.6), 0.3);
  p.y = (hf + hb + hr + hl) / 4;
  rover.g.position.copy(p);
  rover.g.rotation.set(rover.pitch, h, -rover.roll, 'YXZ');
}

const _cam = new V3();
export function updateRover(dt, keys) {
  if (rover.state !== 'out') return;
  rover.flag.rotation.y = Math.sin(S.time * 6) * 0.4;
  if (P.rover !== rover) { rover.speed *= Math.exp(-3 * dt); return; }
  // körning
  if (rover.started) {
    const th = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const st = (keys.KeyA ? 1 : 0) - (keys.KeyD ? 1 : 0);
    rover.speed += th * (th * rover.speed < 0 ? 18 : 7) * dt;
    if (keys.Space) rover.speed *= Math.exp(-4 * dt);
    if (!th) rover.speed *= Math.exp(-0.6 * dt);
    rover.speed = clamp(rover.speed, -5, 17);
    rover.heading += st * clamp(rover.speed / 6, -1, 1) * 1.6 * dt;
    rover.steer.rotation.z = -st * 0.6;
    rover.wheels[0].rotation.y = rover.wheels[1].rotation.y = st * 0.35;
    const f = new V3(-Math.sin(rover.heading), 0, -Math.cos(rover.heading));
    rover.vel.copy(f).multiplyScalar(rover.speed);
    const before = rover.pos.clone();
    rover.pos.addScaledVector(rover.vel, dt);
    resolveChar(rover.pos, rover.vel, 1.1, 1.0, 0.7);
    const moved = rover.pos.distanceTo(before), expect = Math.abs(rover.speed) * dt;
    if (expect > 0.05 && moved < expect * 0.5) { if (Math.abs(rover.speed) > 6) { SFX.thud(0.6); shake.kick += 0.5; burst(rover.pos.clone().add(new V3(0, 0.5, 0)), 'spark', 8); } rover.speed *= -0.3; }
    const rr = Math.hypot(rover.pos.x, rover.pos.z); if (rr > 410) { rover.pos.x *= 410 / rr; rover.pos.z *= 410 / rr; rover.speed *= 0.5; }
    for (const w of rover.wheels) w.children[0].rotation.x += rover.speed * dt / 0.3;
    loopPitch('rover', 1 + Math.abs(rover.speed) / 8);
    loop('rover', 0.06 + Math.abs(rover.speed) * 0.008, 0.2);
    if (Math.abs(rover.speed) > 4 && Math.random() < dt * 20) FX.dust(rover.pos.clone().addScaledVector(f, -1.3));
    // kör över spindlar
    for (const c of creatures) {
      if (c.dead || c.state === 'captured') continue;
      if (c.pos.distanceTo(rover.pos) < 1.8 && Math.abs(rover.speed) > 4) { c.damage(Math.abs(rover.speed) * 8, f.clone()); rover.speed *= 0.7; shake.kick += 0.3; SFX.thud(0.5); }
    }
  }
  placeRover();
  P.pos.copy(rover.pos); P.vel.copy(rover.vel);
  // kamera bakom rovern
  const yaw = rover.heading + rover.camYaw;
  _cam.set(Math.sin(yaw) * 6, 2.6 + rover.camPitch * 4, Math.cos(yaw) * 6).add(rover.pos);
  const gh = groundH(_cam.x, _cam.z) + 0.8; if (_cam.y < gh) _cam.y = gh;
  camera.position.lerp(_cam, 1 - Math.exp(-8 * dt));
  camera.lookAt(rover.pos.x, rover.pos.y + 1.2, rover.pos.z);
  rover.camYaw *= Math.exp(-0.8 * dt);
}

export function roverMouse(e) {
  rover.camYaw -= e.movementX * 0.003;
  rover.camPitch = clamp(rover.camPitch + e.movementY * 0.002, -0.1, 0.8);
}
