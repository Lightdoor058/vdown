// Allt som visas ovanpå 3D-bilden: pratbubblor, undertexter, HUD, QTE, menyer och läsaren.
import * as THREE from 'three';
import { $, clamp, wait, cine } from '../core/utils.js';
import { camera, canvas } from '../core/render.js';
import { SFX } from '../core/audio.js';
import { S } from '../game/state.js';

// ---------- repliker ----------
export const WHO = {
  mikko: { n: 'MIKKO', c: '#9fc3ff', c2: '#3a5f9a', p: 190 },
  you: { n: 'CIRO', c: '#ffb08a', c2: '#b04a1a', p: 290 },
  ai: { n: 'SPARVEN-AI', c: '#ff6a5a', p: 620 },
  radio: { n: 'RADIO', c: '#7fe0ff', p: 430 },
  vale: { n: 'KOMMENDÖR VALE', c: '#ffcf6a', p: 150 },
};
const speakers = {};
export function registerSpeaker(key, astro) { speakers[key] = astro; }

const lines = [];
function makeLine(who, text, forceSub) {
  const W = WHO[who], ch = speakers[who];
  const bubble = !forceSub && ch && ch.root.visible;
  const el = document.createElement('div');
  if (bubble) {
    el.className = 'bubble';
    el.innerHTML = `<div class="who" style="color:${W.c2}">${W.n}</div><div class="txt"></div>`;
    $('bubbles').appendChild(el);
  } else {
    el.className = 'subline';
    el.innerHTML = `<span class="who" style="color:${W.c}">${W.n}</span><span class="txt"></span>`;
    $('subs').appendChild(el);
  }
  const L = { el, txt: el.querySelector('.txt'), ch: bubble ? ch : null, text, shown: 0, who };
  lines.push(L);
  return L;
}
function killLine(L) { L.el.remove(); const i = lines.indexOf(L); if (i >= 0) lines.splice(i, 1); }
export function clearLines() { while (lines.length) killLine(lines[0]); }

// say = väntar tills repliken är klar (för mellansekvenser). speak = visar bara (under spel).
export async function say(who, text, o = {}) {
  const L = makeLine(who, text, o.sub);
  try { await wait(text.length / 42 + (o.hold ?? clamp(text.length * 0.045, 1.4, 3.4))); }
  finally { killLine(L); }
}
export function speak(who, text, hold = 2.5) {
  const L = makeLine(who, text, true);
  setTimeout(() => killLine(L), (text.length / 42 + hold) * 1000);
}

const _p = new THREE.Vector3();
function updateLines(dt) {
  for (const L of lines) {
    if (L.shown < L.text.length) {
      const prev = Math.floor(L.shown);
      L.shown = Math.min(L.text.length, L.shown + dt * 42);
      const now = Math.floor(L.shown);
      if (now !== prev) {
        L.txt.textContent = L.text.slice(0, now);
        if (now % 2 === 0 && L.text[now - 1] !== ' ') SFX.type(WHO[L.who].p * (0.9 + Math.random() * 0.2));
      }
    }
    if (L.ch) {
      L.ch.helmet.getWorldPosition(_p); _p.y += 0.6;
      L.ch.talk = 0.5;
      _p.project(camera);
      if (_p.z > 1 || Math.abs(_p.x) > 1.1 || Math.abs(_p.y) > 1.1) L.el.style.display = 'none';
      else {
        L.el.style.display = '';
        L.el.style.left = ((_p.x + 1) / 2 * innerWidth) + 'px';
        L.el.style.top = ((1 - _p.y) / 2 * innerHeight) + 'px';
      }
    }
  }
}

// ---------- notiser ----------
export function toast(text, type = '') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = text;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => el.remove(), 4200);
  while (box.children.length > 4) box.firstChild.remove();
}
const tipsShown = new Set();
export function tip(id, text) { if (tipsShown.has(id)) return; tipsShown.add(id); toast(text, 'tip'); }

// ---------- HUD ----------
let lastPrompt = null;
export function setPrompt(t) {
  if (t === lastPrompt) return;
  lastPrompt = t; $('prompt').textContent = t; $('prompt').style.opacity = t ? 1 : 0;
}
export function setObjective(t, ping = true) {
  const [main, ...rest] = t.split('\n');
  $('objText').innerHTML = `<div>${main}</div>` + rest.map((r) => `<div class="side">${r}</div>`).join('');
  if (ping) { const o = $('obj'); o.classList.remove('ping'); void o.offsetWidth; o.classList.add('ping'); }
}
export function venom(op) { $('venom').style.opacity = op; }
export function crack(level) {
  const c = $('crack');
  c.className = 'layer lvl' + level;
}

// ---------- modal (labbmeny m.m.) ----------
let modalOpen = false, prevMode = 'play';
export function openModal({ title, body = '', rows = [] }) {
  const m = $('modal');
  m.querySelector('.mtitle').textContent = title;
  const list = m.querySelector('.mbody');
  list.innerHTML = body;
  rows.forEach((r) => {
    const row = document.createElement('div'); row.className = 'mrow';
    row.innerHTML = `<div class="mtxt">${r.html}</div>`;
    const b = document.createElement('button'); b.textContent = r.btn; b.disabled = !!r.disabled;
    b.onclick = () => r.onClick();
    row.appendChild(b); list.appendChild(row);
  });
  m.classList.remove('hidden');
  if (!modalOpen) { prevMode = S.mode; modalOpen = true; S.mode = 'ui'; if (document.pointerLockElement) document.exitPointerLock(); }
}
export function closeModal() {
  if (!modalOpen) return;
  modalOpen = false;
  $('modal').classList.add('hidden');
  S.mode = 'play';
  if (UIHooks.relock) UIHooks.relock();
}
export const UIHooks = { relock: null };
export function isModalOpen() { return modalOpen; }

// ---------- val (två knappar) ----------
export function choice(question, options) {
  return new Promise((res) => {
    const c = $('choice');
    c.querySelector('.cq').textContent = question;
    const box = c.querySelector('.copts'); box.innerHTML = '';
    S.mode = 'ui';
    if (document.pointerLockElement) document.exitPointerLock();
    const done = (i) => { c.classList.add('hidden'); window.removeEventListener('keydown', kd); SFX.choice(); res(i); };
    const kd = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= options.length) done(n - 1); };
    options.forEach((o, i) => { const b = document.createElement('button'); b.className = i === 0 ? 'primary' : ''; b.textContent = `[${i + 1}] ${o}`; b.onclick = () => done(i); box.appendChild(b); });
    window.addEventListener('keydown', kd);
    c.classList.remove('hidden');
  });
}
export function setTimer(s) {
  const el = $('timer');
  if (s == null) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const m = Math.floor(s / 60), ss = Math.floor(s % 60);
  el.textContent = `RÄDDNING OM ${m}:${String(ss).padStart(2, '0')}`;
}
export function showHUD(on) { $('hud').classList.toggle('hidden', !on); }
export function updateHUD(P) {
  const set = (id, v) => { const e = $(id); e.style.width = clamp(v, 0, 100) + '%'; e.parentElement.classList.toggle('low', v < 25); };
  set('bHp', P.hp); set('bO2', P.o2); set('bFood', P.food); set('bSt', P.stamina);
  $('ammo').textContent = P.hasPistol ? P.ammo : '–';
  $('wpn').classList.toggle('on', P.equipped);
  $('cellsTxt').textContent = `${P.cells} i väskan · ${P.inserted}/3 i Fyren`;
  $('cross').classList.toggle('gun', P.equipped);
  $('wpn').classList.toggle('broken', !!P.pistolBroken);
  $('statusTags').innerHTML = (P.antivenom ? '<span class="tag good">ANTIGIFT</span>' : '') + (P.venom > 0 ? '<span class="tag bad">FÖRGIFTAD</span>' : '');
}

// ---------- markörer ----------
const markerEls = [];
let markerData = [];
export function setMarkers(list) { markerData = list; }
function updateMarkers(show) {
  const cont = $('markers');
  while (markerEls.length < markerData.length) {
    const e = document.createElement('div'); e.className = 'marker'; e.innerHTML = '<b></b><span></span>';
    cont.appendChild(e); markerEls.push(e);
  }
  markerEls.forEach((e, i) => {
    const m = markerData[i];
    if (!m || !show) { e.style.display = 'none'; return; }
    e.style.display = '';
    const d = camera.position.distanceTo(m.pos);
    _p.copy(m.pos); _p.y += 1.5; _p.project(camera);
    let x = _p.x, y = _p.y;
    const behind = _p.z > 1;
    if (behind) { x = -x; y = -y; }
    const edge = 0.9, mx = Math.max(Math.abs(x), Math.abs(y));
    if (behind || mx > edge) {
      if (mx < 0.01) { x = 0; y = -edge; } else { x *= edge / mx; y *= edge / mx; }
    }
    e.style.left = ((x + 1) / 2 * innerWidth) + 'px';
    e.style.top = ((1 - y) / 2 * innerHeight) + 'px';
    e.querySelector('b').textContent = m.label;
    e.querySelector('span').textContent = Math.round(d) + ' m';
  });
}

// ---------- filmiska effekter ----------
export function fade(op, dur = 1) { const f = $('fade'); f.style.transition = `opacity ${dur}s linear`; f.style.opacity = op; }
export function flash(color = '#fff', dur = 1) {
  const f = $('flash'); f.style.transition = 'none'; f.style.background = color; f.style.opacity = 1;
  void f.offsetWidth; f.style.transition = `opacity ${dur}s ease-out`; f.style.opacity = 0;
}
export function caption(t) { const c = $('caption'); if (t) { c.textContent = t; c.style.opacity = 1; } else c.style.opacity = 0; }
export function bigTitle(main, sub) {
  const b = $('bigtitle');
  if (!main) { b.classList.remove('on'); return; }
  $('btMain').textContent = main; $('btSub').textContent = sub || '';
  b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
}
export function letterbox(on) { document.body.classList.toggle('cine', on); }
export function skipHint(on) { $('skiphint').style.opacity = on ? 0.7 : 0; }
export function blur(px, dur = 1) { canvas.style.transition = `filter ${dur}s`; canvas.style.filter = px > 0 ? `blur(${px}px)` : 'none'; }
export function heat(op) { $('heat').style.opacity = op; }
export function hurt() {
  const h = $('hurt'); h.style.transition = 'none'; h.style.opacity = 0.85;
  void h.offsetWidth; h.style.transition = 'opacity .7s'; h.style.opacity = 0;
}
export function lowO2(op) { $('lowo2').style.opacity = op; }

// ---------- QTE (spamma en knapp) ----------
let Q = null;
export function qte(label, key, dur) {
  return new Promise((res) => {
    Q = { key, dur, t: 0, p: 0, res };
    $('qteLabel').innerHTML = label; $('qte').classList.add('on');
  });
}
export const qteActive = () => !!Q;
export const qteKey = () => (Q ? Q.key : null);
export const qteValue = () => (Q ? Q.p : 0);
export function qtePress() {
  if (!Q) return;
  Q.p = Math.min(1, Q.p + 0.075);
  const e = $('qte'); e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit');
  SFX.click();
}
function updateQte(dt) {
  if (!Q) return;
  Q.t += dt; Q.p = Math.max(0, Q.p - dt * 0.1);
  $('qteFill').style.width = (Q.p * 100) + '%';
  if (Q.t >= Q.dur || cine.skipping) { const q = Q; Q = null; $('qte').classList.remove('on'); q.res(q.p); }
}

// ---------- läsare för loggar ----------
export function openReader(doc) {
  $('rTitle').textContent = doc.title; $('rText').textContent = doc.text;
  $('reader').classList.remove('hidden');
  if (S.mode === 'play') S.mode = 'read';
  SFX.beep();
}
export function closeReader() {
  $('reader').classList.add('hidden');
  if (S.mode === 'read') S.mode = 'play';
}

// ---------- skärmar ----------
export function show(id, on) { $(id).classList.toggle('hidden', !on); }
export function showDeath(cause) { $('deathCause').textContent = cause; show('death', true); }
export function showEnding(stats) {
  const m = Math.floor(stats.time / 60), s = Math.floor(stats.time % 60);
  const rows = [
    ['end-line', 'Du överlevde Veyra.'],
    ['end-line', stats.buried ? 'Mikko Lind, 2153–2187. Begravd under Veyras orange himmel.' : 'Mikko Lind, 2153–2187. Han vilar kvar i Sparven, under fotot.'],
    ['end-line', 'Men Helion var aldrig där för att rädda dig.'],
    ['end-line end-big', 'FORTSÄTTNING FÖLJER...'],
    ['end-line end-stats', `TID ${m}:${String(s).padStart(2, '0')}  ·  SKÄRVARE DÖDADE ${stats.kills}`],
  ];
  $('endBox').innerHTML = rows.map(([c, t], i) => `<div class="${c}" style="animation-delay:${i * 1.6}s">${t}</div>`).join('')
    + `<button class="primary end-line" style="animation-delay:${rows.length * 1.6}s;margin-top:20px" onclick="location.reload()">HUVUDMENY</button>`;
  show('ending', true);
}

export function update(dt) {
  updateLines(dt);
  updateQte(dt);
  updateMarkers(S.mode === 'play' || S.mode === 'read' || S.mode === 'ui');
}
