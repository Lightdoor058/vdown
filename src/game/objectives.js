// Uppdragen på planeten (huvudkedja + sidouppdrag) och interaktioner med Fyren, terminaler och Mikko.
import { V3, rand, pick } from '../core/utils.js';
import { SFX, loop } from '../core/audio.js';
import { shake } from '../core/render.js';
import { P, S, F, EV } from './state.js';
import * as UI from '../ui/ui.js';
import { LOC, PLACE_NAMES, fillSlot, activateBeacon, installTransmitter, groundH } from '../world/planet.js';
import { ship, SR } from '../world/ship.js';
import { items, Item } from '../entities/items.js';
import { creatures } from '../entities/creatures.js';
import { invHas, invTake } from './inventory.js';
import { LORE } from './story.js';
import { rover } from '../world/rover.js';
import { grave } from './burial.js';
import { cast } from './cast.js';
import { act1Event } from './preflight.js';

const shipPt = (x, y, z) => ship.localToWorld(new V3(x, y, z));
const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const itemPos = (type) => { const it = items.find((i) => i.type === type); return it ? it.pos : null; };

// ---------- HUVUDKEDJAN ----------
const MAIN = [
  { id: 'exit', text: () => 'Ta dig ut ur Sparven. Kolla ryggsäcken [TAB].', done: () => isOutside(),
    onDone: () => UI.speak('you', 'Veyra... Okej. Fyren ligger nordost. Där kan jag ropa på hjälp.', 3) },
  { id: 'tower', text: () => 'Gå till Ödla-expeditionens fyr', marks: () => [{ pos: LOC.BEACON, label: 'FYREN' }], done: () => d2(P.pos, LOC.BEACON) < 22,
    onDone: () => {
      F.towerSeen = true;
      UI.speak('you', 'Nej... nej, nej. Masten är knäckt. Sändaren är bränd. Ingen kommer att höra mig härifrån.', 4);
      setTimeout(() => UI.speak('you', 'Okej. Andas, Ciro. Jag får klara mig själv ett tag. Bygga upp en bas vid Sparven.', 4), 5000);
    } },
  { id: 'camp', text: () => `Sätt upp läger vid Sparven: starta reservgeneratorn ${F.generator ? '✔' : '✘'} · tänd en lägereld med 3 stenar ${F.campfire ? '✔' : '✘'}`,
    marks: () => [!F.generator && { pos: shipPt(-2.4, 1, 6.3), label: 'GENERATOR' }, !F.campfire && { pos: LOC.CAMPFIRE, label: 'LÄGERELD' }].filter(Boolean),
    done: () => F.generator && F.campfire,
    onDone: () => UI.speak('you', 'Ström och värme. Det är en början. Nu behöver jag förstå de där spindlarna.', 3) },
  { id: 'lab', text: () => `Bygg minilabbet: mikroskop ${F.mic ? '✔' : '(Relästationen)'} · analysator ${F.ana ? '✔' : '(Ödla-lägret)'} → montera på labbänken [E]`,
    marks: () => {
      const m = [];
      if (!F.mic) m.push(invHas('microscope') ? { pos: shipPt(-2.5, 1, 2.6), label: 'LABBET' } : { pos: itemPos('microscope') || LOC.OP, label: 'MIKROSKOP' });
      if (!F.ana) m.push(invHas('analyzer') ? { pos: shipPt(-2.5, 1, 2.6), label: 'LABBET' } : { pos: itemPos('analyzer') || LOC.CAMP, label: 'ANALYSATOR' });
      return m;
    },
    done: () => F.mic && F.ana },
  { id: 'capture', text: () => 'Fånga en spindel: ta en bedövningsspruta (medicinskåpet), smyg fram och tryck [E] på en spindel, dra in den i labbets tank (håll vänster mus)',
    marks: () => {
      if (!invHas('tranq') && !creatures.some((c) => c.state === 'stun')) return [{ pos: shipPt(-2.8, 1.4, 8.1), label: 'MEDICINSKÅP' }];
      const st = creatures.find((c) => c.state === 'stun');
      if (st) return [{ pos: shipPt(2.25, 1, 2.4), label: 'TANKEN' }];
      let best = null, bd = 1e9;
      for (const c of creatures) { if (c.dead || c.state !== 'walk') continue; const d = d2(c.pos, P.pos); if (d < bd) { bd = d; best = c; } }
      return best ? [{ pos: best.pos, label: 'SPINDEL' }] : [];
    },
    done: () => F.captured },
  { id: 'blood', text: () => 'Ta ett blodprov från spindeln i tanken (tom spruta) [E]', marks: () => [{ pos: shipPt(2.25, 1, 2.4), label: 'TANKEN' }], done: () => F.blood },
  { id: 'analyze', text: () => 'Analysera blodprovet på labbänken [E]', marks: () => [{ pos: shipPt(-2.5, 1, 2.6), label: 'LABBET' }], done: () => F.analyzed },
  { id: 'anti', text: () => `Tillverka antigift: analyserat prov ✔ + kristallprov ${invHas('crystal') ? '✔' : '(bryt loss från lysande kristaller [E])'} + medkit ${invHas('med') ? '✔' : '✘'} — injicera det sen [TAB]`,
    marks: () => (invHas('crystal') && invHas('med')) || invHas('antivenom') ? [{ pos: shipPt(-2.5, 1, 2.6), label: 'LABBET' }] : [{ pos: new V3(-22, 0, 36), label: 'KRISTALLER' }],
    done: () => P.antivenom,
    onDone: () => UI.speak('you', 'Antigift. Nu kan de bita hur mycket de vill. Nästan.', 3) },
  { id: 'rover', text: () => `Få igång rovern: öppna svarta lådan ${F.roverOut ? '✔' : '✘'} · hjul ${rover.mounted}/4 (WEAPONS-lådan) · nyckeln (cockpit) → vrid om`,
    marks: () => {
      if (!F.roverOut) return [{ pos: shipPt(-5.1, 1, 6.6), label: 'ROVERLÅDA' }];
      const m = [{ pos: rover.pos, label: 'ROVER' }];
      if (rover.mounted < 4 && !invHas('wheel')) { const w = itemPos('wheel') || shipPt(2.12, 0.6, 7.45); m.push({ pos: w, label: 'WEAPONS' }); }
      if (!invHas('key') && !rover.keyPiv.visible) { const k = itemPos('key'); if (k) m.push({ pos: k, label: 'NYCKEL' }); }
      return m;
    },
    done: () => F.roverStarted || F.transmitter || invHas('transmitter'),
    onDone: () => UI.speak('you', 'Ha! Mikko, du skulle sett det här. Nu kommer jag långt.', 3) },
  { id: 'helion', text: () => 'Hämta en sändarmodul från Helion Station Theta (långt söderut/österut)', marks: () => [{ pos: LOC.HELION, label: 'HELION THETA' }],
    done: () => invHas('transmitter') || F.transmitter,
    onDone: () => UI.speak('you', 'En Helion-sändare. De ska få höra mig. Hela systemet ska få höra mig.', 3) },
  { id: 'repair', text: () => `Laga Fyren: montera sändarmodulen ${F.transmitter ? '✔' : '✘'} + energiceller ${P.inserted}/3 (har ${P.cells}) [E]`,
    marks: () => {
      const m = [{ pos: LOC.BEACON, label: 'FYREN' }];
      if (P.cells + P.inserted < 3) for (const it of items) if (it.type === 'cell') m.push({ pos: it.pos, label: 'ENERGICELL' });
      return m;
    },
    done: () => F.transmitter && P.inserted >= 3 },
  { id: 'defense', text: () => 'ÖVERLEV tills räddningen kommer!', done: () => false },
];

function isOutside() {
  const l = ship.worldToLocal(P.pos.clone());
  return l.z > 9.4 || Math.abs(l.x) > 3.4 || l.z < -10;
}

export function startPlanetObjectives() { S.mainIdx = 0; refreshText(); }

let lastText = '';
function refreshText() {
  if (S.act !== 'planet') return;
  const step = MAIN[S.mainIdx];
  const lines = [step.text()];
  side().forEach((s) => lines.push('◇ ' + s.text));
  const t = lines.join('\n');
  if (t !== lastText) { const ping = t.split('\n')[0] !== lastText.split('\n')[0]; lastText = t; UI.setObjective(t, ping); }
}

// sidouppdrag: begrava Mikko, laga pistolen
function side() {
  const s = [];
  if (F.bury === true && !F.buried) {
    let t;
    if (!invHas('shovel')) t = 'Begrav Mikko: hämta spaden på verktygshyllan i maskinrummet';
    else if (grave.dug < 1) t = 'Begrav Mikko: gräv en grav vid gravplatsen (håll vänster mus)';
    else if (!grave.bodyIn) t = 'Begrav Mikko: dra honom till graven (håll vänster mus på honom)';
    else t = 'Begrav Mikko: fyll igen graven [E]';
    s.push({ text: t, marks: () => {
      if (!invHas('shovel')) return [{ pos: shipPt(2.7, 1.1, 5.9), label: 'SPADE' }];
      if (grave.dug >= 1 && !grave.bodyIn && P.drag?.kind !== 'mikko') return [{ pos: cast.mikko.root.getWorldPosition(new V3()), label: 'MIKKO' }];
      return [{ pos: LOC.GRAVE, label: 'GRAV' }];
    } });
  }
  if (P.pistolBroken) s.push({ text: `Laga pistolen: hitta en ${P.brokenName} (troligen vid ${PLACE_NAMES[P.brokenAt]}) + verktygslåda → labbänken`,
    marks: () => { const p = itemPos(P.brokenPart); return invHas(P.brokenPart) ? [{ pos: shipPt(-2.5, 1, 2.6), label: 'LABBET' }] : (p ? [{ pos: p, label: P.brokenName.toUpperCase() }] : []); } });
  if (P.pistolBroken && !invHas('toolkit')) s.push({ text: 'Verktygslådan: gruvstationen K-4 kanske har en', marks: () => { const p = itemPos('toolkit'); return p ? [{ pos: p, label: 'VERKTYG' }] : []; } });
  return s;
}

let radioMid = false;
export function updateObjectives(dt) {
  if (S.act !== 'planet') return;
  const step = MAIN[S.mainIdx];
  if (step.done()) {
    if (step.onDone) step.onDone();
    S.mainIdx = Math.min(MAIN.length - 1, S.mainIdx + 1);
    SFX.objective();
    // hoppa över steg som redan är klara
    while (S.mainIdx < MAIN.length - 1 && MAIN[S.mainIdx].done() && MAIN[S.mainIdx].id !== 'defense') S.mainIdx++;
  }
  refreshText();
  const marks = [...(step.marks ? step.marks() : [])];
  side().forEach((s) => marks.push(...s.marks()));
  if (P.o2 < 35 && S.mainIdx > 0) marks.push({ pos: shipPt(-2.9, 1.4, -4.5), label: 'SPARVEN · SYRE' });
  UI.setMarkers(marks.filter((m) => m && m.pos));

  if (S.defense) {
    S.defenseT -= dt;
    UI.setTimer(Math.max(0, S.defenseT));
    if (!radioMid && S.defenseT < 45) { radioMid = true; SFX.radio(); UI.speak('radio', 'ARGUS här. Vi ser rörelse runt din position. Imponerande... fortsätt så.', 3); }
    if (S.defenseT <= 0) { S.defense = false; EV.onWin(); }
  }
}

// ---------- händelser från andra system ----------
export function onPickup(type) {
  if (S.act === 'ship') act1Event('pickup', type);
  if (type === 'shovel' && F.bury === true) UI.tip('shovel', 'Spaden! Gå till gravplatsen och håll vänster musknapp för att gräva.');
  if (type === 'crystal') UI.tip('crystal', 'Kristallprov! Används till antigift och bedövningssprutor.');
}
export function onCellCollected() {
  UI.toast(`Energicell (${P.cells + P.inserted}/3)`, 'good');
}
export function onRoverEvent() {}
export function onLabEvent() {}
export function onBurialEvent() {}

// slumpa var pistolens trasiga del finns
export function breakPistol() {
  const parts = [['part_circuit', 'plasmakrets'], ['part_lens', 'fokuslins'], ['part_cooler', 'kylcell']];
  const [type, name] = pick(parts);
  const at = pick(['LANDER', 'MINE', 'RADIO', 'CAMP']);
  P.pistolBroken = true; P.brokenPart = type; P.brokenName = name; P.brokenAt = at;
  const L = LOC[at];
  const x = L.x + rand(-3, 3), z = L.z + rand(3, 6);
  new Item(type, new V3(x, groundH(x, z) + 0.5, z));
  UI.toast(`PISTOLEN GICK SÖNDER! ${name.toUpperCase()} brann upp.`, 'bad');
  UI.speak('you', `Nej nej nej! ${name[0].toUpperCase() + name.slice(1)}n är bränd. Det borde finnas en reservdel vid ${PLACE_NAMES[at]}.`, 3.5);
}

// ---------- FYREN ----------
export function interactBeacon() {
  if (S.defense || P.inserted >= 3 && F.transmitter) return;
  if (!F.transmitter) {
    if (invTake('transmitter')) { F.transmitter = true; installTransmitter(); SFX.insert(); UI.toast('Sändarmodulen monterad!', 'good'); }
    else { UI.toast('Fyren är trasig. Den behöver en ny sändarmodul (Helion Station Theta) och 3 energiceller.'); }
  }
  if (P.cells > 0 && P.inserted < 3) {
    while (P.cells > 0 && P.inserted < 3) { P.cells--; fillSlot(P.inserted); P.inserted++; }
    SFX.insert(); UI.toast(`Energiceller i Fyren: ${P.inserted}/3`, 'good');
  } else if (F.transmitter && P.inserted < 3) UI.toast(`Fyren behöver ${3 - P.inserted} energiceller till.`);
  if (F.transmitter && P.inserted >= 3) startDefense();
}

function startDefense() {
  S.defense = true; S.defenseT = 90;
  S.mainIdx = MAIN.length - 1;
  activateBeacon();
  SFX.beaconOn(); shake.kick += 1.5;
  loop('tension', 0.05, 2);
  setTimeout(() => { SFX.radio(); UI.speak('radio', '...*sprak*... nödsignal mottagen... Det här är Helion-fregatten ARGUS. ETA nittio sekunder. Håll ut.', 3); }, 1500);
  setTimeout(() => UI.toast('Spindlarna dras till signalen! HÅLL UT!', 'bad'), 4000);
  setTimeout(() => UI.speak('you', P.readTerminal ? 'Helion... samma Helion som skickade asteroiden. Fantastiskt.' : 'Äntligen! Kom igen, kom igen...', 2.5), 8000);
}

export function interactTerminal(id = 'terminal') {
  UI.openReader(LORE[id]);
  if (id === 'terminal' && !P.readTerminal) {
    P.readTerminal = true;
    setTimeout(() => UI.speak('you', '...Projekt Magnet. De gjorde det med flit. Mikko hade rätt.', 3), 600);
  }
}

let mikkoTalks = 0;
const MIKKO_LINES = [
  'Jag är här, Mikko. Jag har inte glömt dig.',
  'Jag hittar dem som gjorde det här.',
  'Köttbullarna var dina. Jag vet.',
];
export function interactMikko() {
  UI.speak('you', MIKKO_LINES[mikkoTalks % MIKKO_LINES.length], 2.5);
  mikkoTalks++;
}
