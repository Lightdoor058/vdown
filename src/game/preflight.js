// AKT 1: ombord på Sparven i rymden. Gör uppgifter med Mikko och lär känna honom innan asteroiden kommer.
import * as THREE from 'three';
import { V3, pick } from '../core/utils.js';
import { SFX } from '../core/audio.js';
import { ship, SR, setGenerator } from '../world/ship.js';
import { P, S, F } from './state.js';
import { cast } from './cast.js';
import * as UI from '../ui/ui.js';
import { invHas, invTake, invAdd } from './inventory.js';
import { noteDoc } from './story.js';
import { runAsteroid } from './cutscenes.js';

const say = (who, text, hold = 2.5) => { if (S.act === 'ship' && S.mode !== 'cine') UI.speak(who, text, hold); };
const W = (x, y, z) => ship.localToWorld(new V3(x, y, z));
let step = 'start', busy = false;

const COLORS = ['red', 'blue', 'green'];
const COLOR_TONE = { red: 330, blue: 440, green: 554 };
const ROUND_LEN = [4, 5];

const nav = SR.navCal;
function makeSeq(n) {
  const s = [pick(COLORS)];
  while (s.length < n) { const c = pick(COLORS); if (c !== s[s.length - 1]) s.push(c); }
  return s;
}
function flashBtn(id) {
  const b = SR.buttons[id];
  if (!b) return;
  b.glow = 1.35;
  SFX.note(COLOR_TONE[id]);
}
function startNavDemo() {
  nav.phase = 'demo';
  nav.flashI = -1;
  nav.demoT = 0.55;
  nav.idx = 0;
  busy = true;
  Object.values(SR.buttons).forEach((b) => (b.glow = 0));
}
function beginRound(r) {
  nav.mode = 'live';
  nav.round = r;
  nav.total = ROUND_LEN.length;
  nav.seq = makeSeq(ROUND_LEN[r - 1]);
  nav.idx = 0;
  UI.setObjective('Kalibrera navigeringen: titta på knapparna, tryck samma ordning [E]', r === 1);
  startNavDemo();
}
function attachSlip() {
  nav.startSeq = makeSeq(4);
  nav.seq = nav.startSeq;
  if (SR.navSlipMesh) { SR.navSlipMesh.removeFromParent(); SR.navSlipMesh = null; }
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.004, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xe8d6b0, roughness: 0.85 })
  );
  m.position.set(0.16, 1.02, 0.28);
  m.rotation.set(-0.55, 0.35, 0.2);
  M().root.add(m);
  SR.navSlipMesh = m;
}
function giveSlip() {
  if (SR.navSlipMesh) { SR.navSlipMesh.removeFromParent(); SR.navSlipMesh = null; }
  const extra = { lore: 'navstart', seq: nav.startSeq };
  if (!invHas('note')) invAdd('note', extra);
  SFX.paper();
  UI.openReader(noteDoc(extra));
  nav.mode = 'start';
  nav.phase = 'input';
  nav.round = 0;
  nav.idx = 0;
  nav.seq = nav.startSeq;
  mikkoTo([[-1.0, -6.2]], 'pilot', Math.PI);
}

const TEXT = {
  backpack: 'Hämta din ryggsäck i skåpet (labbet, höger vägg) [E] och ta den [F]',
  slip: 'Ta startrutinen av Mikko i cockpit [E]',
  nav: 'Kalibrera navigeringen: läs lappen [TAB] och tryck knapparna i den ordningen [E]',
  gen: 'Testa reservgeneratorn: håll vänster mus på spaken i maskinrummet och dra NEDÅT',
  meat: 'Hämta Mikkos köttbullar i minikylen och ge dem till honom [E på Mikko]',
  photo: 'Mikko vill visa dig något. Titta på fotot vid kylen [E]',
  sit: 'Sätt dig vid bordet med Mikko [E på pallen]',
};
function setStep(s) { step = s; S.act1 = s; if (TEXT[s]) UI.setObjective(TEXT[s], true); SFX.objective(); updateMarks(); }
function updateMarks() {
  const m = {
    backpack: [{ pos: W(2.7, 1.2, 4.5), label: 'SKÅP' }],
    slip: [{ pos: cast.mikko.root.getWorldPosition(new V3()), label: 'MIKKO' }],
    nav: [{ pos: W(0, 1.2, -7.9), label: 'KNAPPAR' }],
    gen: [{ pos: W(-1.9, 1.1, 5.55), label: 'SPAK' }],
    meat: invHas('meatballs') ? [{ pos: cast.mikko.root.getWorldPosition(new V3()), label: 'MIKKO' }] : [{ pos: W(-2.65, 0.8, -0.9), label: 'KYL' }],
    photo: [{ pos: W(-2.9, 1.7, -0.9), label: 'FOTO' }],
    sit: [{ pos: W(1.8, 0.6, -1.4), label: 'PALL' }],
  }[step];
  UI.setMarkers(m || []);
}

// Mikkos förflyttningar (lokala skeppskoordinater x,z)
const M = () => cast.mikko;
function mikkoTo(points, pose, yaw, after) {
  M().walkTo(points, () => {
    if (pose === 'pilot') M().root.position.y = -0.2;
    if (pose === 'sit') M().root.position.y = -0.24;
    if (after) after();
  }, pose, yaw);
}

export function startAct1() {
  S.act = 'ship';
  const m = M();
  m.root.position.set(0.6, 0, -2.6); m.root.rotation.set(0, Math.PI, 0); m.setPose('idle', true);
  cast.you.root.visible = false;
  setStep('backpack');
  setTimeout(() => say('mikko', 'God morgon, Ciro! Dag 63. Tre veckor kvar till Ceres. Och tre veckor kvar av mina köttbullar.', 3), 1200);
  setTimeout(() => say('mikko', 'Ta din ryggsäck ur skåpet. Regel nummer ett i rymden: allt du äger ska få plats i en väska.', 3), 7500);
}

export function act1Event(kind, data) {
  if (S.act !== 'ship' || busy) return;
  if (kind === 'pickup' && data === 'backpack' && step === 'backpack') {
    busy = true;
    say('mikko', 'Snyggt. Kom till cockpit. Jag har startrutinen nerskriven, navet glappar igen.', 3);
    mikkoTo([[0, -3.5], [0, -5.4]], 'hold', 0, () => {
      attachSlip();
      say('mikko', 'Här. Helion-manual 7-C, fast med min handstil. Ta lappen, läs den, sen trycker du.', 4);
      busy = false;
    });
    setStep('slip');
  }
  if (kind === 'mikko' && step === 'slip') {
    giveSlip();
    say('mikko', 'Där. TAB om du behöver läsa om. Knapparna mitt på brädan, i den ordningen.', 3.5);
    setStep('nav');
    return;
  }
  if (kind === 'pickup' && data === 'note' && step === 'slip') {
    giveSlip();
    say('mikko', 'Bra. Läs den och tryck knapparna i den ordningen.', 3);
    setStep('nav');
    return;
  }
  if (kind === 'mikko' && step === 'nav' && nav.phase === 'input') {
    if (nav.mode === 'start') {
      UI.openReader(noteDoc({ seq: nav.startSeq }));
      say('mikko', 'Det står på lappen. Inte i mitt huvud.', 2);
      return;
    }
    say('mikko', 'Okej, en gång till. Titta.', 1.4);
    startNavDemo();
    return;
  }
  if (kind === 'button' && step === 'nav') {
    if (nav.phase !== 'input' || !nav.seq.length) {
      if (nav.phase === 'done') return;
      say('mikko', nav.phase === 'demo' ? 'Vänta, titta först!' : 'Ta lappen av mig först!', 1.4);
      return;
    }
    flashBtn(data);
    if (data === nav.seq[nav.idx]) {
      nav.idx++;
      if (nav.idx >= nav.seq.length) {
        if (nav.mode === 'start') {
          SFX.ok();
          say('mikko', 'Startrutinen sitter. Nu kör vi skarpt. Titta på knapparna — jag visar, du härmar.', 3);
          busy = true;
          setTimeout(() => beginRound(1), 2200);
        } else if (nav.round >= nav.total) {
          S.navOk = true;
          nav.phase = 'done';
          nav.mode = 'done';
          SFX.ok();
          say('mikko', pick(['Perfekt! Kursen ligger låst. Helion kommer älska oss. Eller inte märka något, som vanligt.', 'Kalibrerad! Du har fingrar som en konsertpianist, Ciro.']), 3);
          setTimeout(() => {
            say('mikko', 'Nästa: reservgeneratorn. Helion kräver ett test varje vecka. Dra ner spaken där bak.', 3);
            mikkoTo([[-1.0, -5.4], [0, -4.8], [0, 4.5], [-1.0, 5.0]], 'idle', -Math.PI / 2);
            setStep('gen');
          }, 2500);
        } else {
          SFX.ok();
          const nxt = nav.round + 1;
          say('mikko', pick([`Snyggt. Runda ${nxt}. Längre den här gången.`, `Bra. Nästa runda. Håll koll.`]), 1.8);
          busy = true;
          setTimeout(() => beginRound(nxt), 1600);
        }
      }
    } else {
      SFX.wrong();
      nav.idx = 0;
      Object.values(SR.buttons).forEach((x) => (x.glow = 0.55));
      if (nav.mode === 'start') {
        say('mikko', pick(['Fel. Läs lappen igen. TAB.', 'Nej. Det står på lappen, Ciro.', 'Haha, fel. Börja om från ettan.']), 2);
      } else {
        say('mikko', pick(['Fel. Titta igen.', 'Nej nej. Röd betyder inte "tryck på allt". Titta.', 'Haha, fel. Jag visar om.']), 1.8);
        busy = true;
        setTimeout(() => startNavDemo(), 1400);
      }
    }
  }
  if (kind === 'generator' && step === 'gen') {
    F.genTest = true;
    say('mikko', 'Hör du det där? Musik. Okej, stäng av den igen, vi sparar bränsle.', 2.5);
    setTimeout(() => { setGenerator(false); SFX.thud(0.3); }, 3500);
    setTimeout(() => {
      say('mikko', 'Bra jobbat. Nu förtjänar jag en paus. Kan du hämta mina köttbullar i kylen? Jag sitter vid bordet.', 3.5);
      mikkoTo([[0, 4.5], [0, -1.0], [0.6, -3.4], [1.8, -3.4]], 'sit', 0);
      setStep('meat');
    }, 4500);
  }
  if (kind === 'mikko' && step === 'meat') {
    if (!invTake('meatballs')) { say('mikko', 'Kylen, Ciro. Köttbullarna. Burken med den röda etiketten.', 2); return; }
    busy = true;
    say('mikko', 'Mina älsklingar! ...Fast jag kan inte äta med hjälmen på. Jag sparar dem tills vi landat.', 3.5);
    setTimeout(() => say('you', 'Du har sagt det i tre veckor.', 2), 5200);
    setTimeout(() => say('mikko', 'Och jag kommer säga det i tre veckor till. Hey, har du sett att jag hängt upp fotot? Gå och kolla!', 3), 8000);
    setTimeout(() => { busy = false; setStep('photo'); }, 10500);
  }
  if (kind === 'photo' && step === 'photo') photoTalk();
  if (kind === 'stool' && step === 'sit') { setStep('none'); UI.setMarkers([]); runAsteroid(); }
}

async function photoTalk() {
  busy = true; step = 'photoTalk'; UI.setMarkers([]);
  mikkoTo([[0.6, -3.4], [0.4, -1.4], [-1.6, -1.6]], 'idle', -Math.PI / 2 + 0.5);
  const lines = [
    ['mikko', 'Kommer du ihåg när vi tog den? Första dagen på Sparven.', 3],
    ['you', 'Du hade satt på dig handskarna fel. Tummen pekade åt fel håll.', 3],
    ['mikko', 'Det var en STIL. Och du sa att vi skulle bli rika.', 2.5],
    ['you', 'Vi blev rika på frystorkade köttbullar.', 2.5],
    ['mikko', 'Tre år. Tre år av skit-kaffe och trasig värme. Jag skulle inte byta bort en dag.', 3],
    ['mikko', 'Lova mig en sak, Ciro. Vad som än händer, låt bilden hänga kvar.', 3],
    ['you', 'Jag lovar. Tummen upp?', 2],
    ['mikko', 'Alltid tummen upp.', 2],
  ];
  for (const [w, t, h] of lines) { say(w, t, h); await new Promise((r) => setTimeout(r, (t.length / 42 + h) * 1000 + 200)); }
  F.photo = true;
  M().setPose('wave');
  say('mikko', 'Kom, sätt dig vid bordet. Vi kan titta på Veyra. Den syns från fönstret nu.', 3);
  mikkoTo([[0.4, -1.4], [0.6, -3.4], [1.8, -3.4]], 'sit', 0);
  busy = false;
  setStep('sit');
}

export function updateAct1(dt) {
  if (S.act !== 'ship') return;
  updateMarks();
  if (step !== 'nav' || nav.phase !== 'demo') return;
  nav.demoT = (nav.demoT || 0) - dt;
  if (nav.demoT > 0) return;
  nav.flashI++;
  if (nav.flashI >= nav.seq.length) {
    nav.phase = 'input';
    nav.idx = 0;
    nav.flashI = -1;
    busy = false;
    say('mikko', nav.round === 1 ? 'Din tur. Samma ordning.' : 'Din tur.', 1.4);
    return;
  }
  flashBtn(nav.seq[nav.flashI]);
  nav.demoT = 0.52;
}
