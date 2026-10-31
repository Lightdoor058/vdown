// Minilabbet i Sparven: montera mikroskop/analysator, ta blodprov ur tanken, tillverka antigift och laga pistolen.
import * as THREE from 'three';
import { V3 } from '../core/utils.js';
import { SFX } from '../core/audio.js';
import { camera, scene } from '../core/render.js';
import { ship, SR } from '../world/ship.js';
import { P, S, F } from './state.js';
import { INV, invHas, invTake, invAdd, invCount } from './inventory.js';
import { IDEF } from '../entities/items.js';
import * as UI from '../ui/ui.js';
import { onLabEvent } from './objectives.js';
import { runMikkoMoment } from './cutscenes.js';

// ---------- recept ----------
const RECIPES = [
  { id: 'analyze', name: 'Analysera blodprov', need: { blood: 1 }, give: 'sample', time: 5, show: () => F.blood || invHas('blood'),
    done() { F.analyzed = true; } },
  { id: 'anti', name: 'Antigift', need: { sample: 1, crystal: 1, med: 1 }, give: 'antivenom', time: 4, show: () => F.analyzed },
  { id: 'tranq', name: 'Bedövningsspruta', need: { syringe: 1, crystal: 1 }, give: 'tranq', time: 2, show: () => F.analyzed || F.captured },
  { id: 'fix', name: 'Laga plasmapistolen', need: () => ({ [P.brokenPart]: 1, toolkit: 0 }), give: null, time: 4, show: () => P.pistolBroken,
    check: () => invHas('toolkit'), done() { P.pistolBroken = false; UI.toast('PLASMAPISTOLEN ÄR LAGAD!', 'good'); } },
];

function needOf(r) { return typeof r.need === 'function' ? r.need() : r.need; }
function canMake(r) {
  const n = needOf(r);
  for (const k in n) if (!invHas(k, Math.max(1, n[k])) && n[k] > 0) return false;
  if (r.check && !r.check()) return false;
  return true;
}

export function labStatus() {
  const L = [];
  L.push(SR.genOn ? 'STRÖM: PÅ' : 'STRÖM: AV — starta generatorn');
  L.push(`MIKROSKOP: ${F.mic ? 'OK' : 'SAKNAS'}`);
  L.push(`ANALYSATOR: ${F.ana ? 'OK' : 'SAKNAS'}`);
  L.push(`PROV I TANK: ${F.captured ? 'SPINDEL' : 'TOM'}`);
  SR.labStatus = L;
}

// E på labbänken
export function interactLab() {
  let installed = false;
  if (!F.mic && invTake('microscope')) { F.mic = true; SR.labParts.mic.visible = true; SR.labParts.micGhost.visible = false; installed = true; UI.toast('Mikroskopet monterat!', 'good'); }
  if (!F.ana && invTake('analyzer')) { F.ana = true; SR.labParts.ana.visible = true; SR.labParts.anaGhost.visible = false; installed = true; UI.toast('Analysatorn monterad!', 'good'); }
  labStatus();
  if (installed) { SFX.ok(); onLabEvent(); if (!(F.mic && F.ana)) return; }
  if (!F.mic || !F.ana) {
    UI.toast(`Labbet saknar: ${[!F.mic && 'mikroskop', !F.ana && 'analysator'].filter(Boolean).join(' och ')}.`);
    return;
  }
  if (!SR.genOn) { UI.toast('Ingen ström! Dra ner spaken på reservgeneratorn i maskinrummet.', 'bad'); return; }
  openLabUI();
}

let busy = false;
function openLabUI() {
  const rows = RECIPES.filter((r) => r.show()).map((r) => {
    const n = needOf(r);
    const parts = Object.keys(n).map((k) => {
      const have = invCount(k), want = Math.max(1, n[k]);
      const ok = have >= want;
      return `<span class="${ok ? 'ok' : 'miss'}">${IDEF[k].icon} ${IDEF[k].name}${n[k] === 0 ? ' (verktyg)' : ''}</span>`;
    }).join(' + ');
    return { id: r.id, html: `<b>${r.name}</b><div class="need">${parts}</div>`, ok: canMake(r) };
  });
  UI.openModal({
    title: 'MINILABB // SV-7',
    body: rows.length ? '' : '<p>Inget att göra just nu. Fånga en spindel och ta ett blodprov.</p>',
    rows: rows.map((r) => ({ html: r.html, btn: 'TILLVERKA', disabled: !r.ok, onClick: () => craft(r.id) })),
  });
}

async function craft(id) {
  if (busy) return;
  const r = RECIPES.find((x) => x.id === id);
  if (!r || !canMake(r)) return;
  busy = true;
  const n = needOf(r);
  for (const k in n) if (n[k] > 0) invTake(k, n[k]);
  UI.closeModal();
  SFX.blip(0.08);
  UI.toast(`${r.name}... arbetar`, 'tip');
  const first = id === 'analyze' && !F.analyzed;
  await new Promise((res) => setTimeout(res, r.time * 1000));
  if (r.give) { invAdd(r.give); UI.toast(`+ ${IDEF[r.give].icon} ${IDEF[r.give].name}`, 'good'); }
  if (r.done) r.done();
  SFX.ok();
  busy = false;
  onLabEvent();
  if (first) runMikkoMoment();
}

// E på tanken
export function interactTank() {
  if (!F.captured) { UI.toast('Tanken är tom. Bedöva en spindel och dra hit den.'); return; }
  if (F.blood) { UI.toast('Du har redan ett blodprov. Analysera det på labbänken.'); return; }
  if (!invTake('syringe')) { UI.toast('Du behöver en tom spruta (medicinskåpet).', 'bad'); return; }
  invAdd('blood'); F.blood = true;
  SFX.hiss(); UI.toast('+ 🩸 Blodprov', 'good');
  UI.speak('you', 'Grönt blod... Okej. Stilla nu, lilla monster.', 2);
  onLabEvent();
}

// Lägg en bedövad spindel i tanken (när man släpper den nära tanken)
export function tryCapture(spider) {
  const tp = SR.tank.getWorldPosition(new V3());
  if (Math.min(spider.pos.distanceTo(tp), P.pos.distanceTo(tp)) > 3.0) return false;
  spider.state = 'captured';
  scene.attach(spider.g);
  spider.g.position.set(tp.x, tp.y + 0.35, tp.z);
  spider.g.rotation.set(0, 0, 0);
  spider.g.scale.setScalar(0.45);
  spider.pos.copy(spider.g.position);
  F.captured = true;
  SFX.door(); SFX.ok();
  UI.toast('Spindeln är fångad i tanken!', 'good');
  UI.speak('you', 'Hej där. Nu ska vi se vad du är gjord av.', 2);
  labStatus();
  onLabEvent();
  return true;
}
