// Ryggsäckens fönster (TAB): klicka = använd, högerklick = släpp på marken.
import { $ } from '../core/utils.js';
import { camera } from '../core/render.js';
import { SFX } from '../core/audio.js';
import { INV, invTake } from '../game/inventory.js';
import { IDEF, Item } from '../entities/items.js';
import { P, S, F } from '../game/state.js';
import * as UI from './ui.js';
import * as THREE from 'three';

let open = false;
export const invOpen = () => open;

export function toggleInventory() {
  if (open) return closeInventory();
  if (S.mode !== 'play') return;
  if (!F.backpack) { UI.toast('Du har ingen ryggsäck än.'); return; }
  open = true; S.mode = 'ui';
  if (document.pointerLockElement) document.exitPointerLock();
  render();
  $('invPanel').classList.remove('hidden');
  SFX.click();
}
export function closeInventory() {
  if (!open) return;
  open = false; S.mode = 'play';
  $('invPanel').classList.add('hidden');
  if (UI.UIHooks.relock) UI.UIHooks.relock();
}

function render() {
  const grid = $('invGrid');
  grid.innerHTML = '';
  for (let i = 0; i < INV.max; i++) {
    const s = INV.slots[i];
    const d = document.createElement('div');
    d.className = 'slot' + (s ? '' : ' empty');
    if (s) {
      const def = IDEF[s.type];
      d.innerHTML = `<div class="ico">${def.icon || '?'}</div><div class="nm">${def.name}</div>${s.n > 1 ? `<div class="cnt">×${s.n}</div>` : ''}`;
      d.title = `${def.name}${def.desc ? ' — ' + def.desc : ''}`;
      d.onmouseenter = () => { $('invInfo').innerHTML = `<b>${def.icon} ${def.name}</b><br>${def.desc || ''}<br><small>${def.use ? 'Klick = använd · ' : ''}Högerklick = släpp</small>`; };
      d.onclick = () => use(s);
      d.oncontextmenu = (e) => { e.preventDefault(); drop(s); };
    }
    grid.appendChild(d);
  }
  $('invStats').textContent = `Plasma: ${P.hasPistol ? P.ammo : '–'}  ·  Energiceller: ${P.cells}  ·  ${P.antivenom ? 'Antigift aktivt' : 'Inget antigift'}`;
}

function use(s) {
  const def = IDEF[s.type];
  if (!def.use) { UI.toast(`${def.name} kan inte användas direkt.`); return; }
  if (def.use({ extra: s.extra })) { invTake(s.type); SFX.pickup(); }
  render();
}
function drop(s) {
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const p = camera.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 1.0);
  invTake(s.type);
  new Item(s.type, p, s.extra);
  SFX.thud(0.2);
  render();
}
