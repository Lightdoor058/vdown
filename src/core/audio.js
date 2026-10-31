// Alla ljud skapas med Web Audio (inga ljudfiler behövs).
import { rand } from './utils.js';

let ac = null, master = null, noiseBuf = null, muted = false;

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 0.8;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 5, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  heartbeatTick();
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ac.currentTime, 0.05); }
export function isMuted() { return muted; }

export function tone(f, dur, type = 'sine', vol = 0.2, f2 = null, delay = 0) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
export function holdTone(f, dur, vol = 0.1, type = 'sine') {
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator(); o.type = type; o.frequency.value = f;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.setValueAtTime(vol, t + dur - 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
export function noise(dur, vol, type = 'lowpass', f = 1000, f2 = null, q = 1, delay = 0, attack = 0.005) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  fl.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(master);
  s.start(t, Math.random() * Math.max(0, 4.9 - dur)); s.stop(t + dur + 0.05);
}

// ---------- ljudeffekter ----------
export const SFX = {
  type(p) { tone(p, 0.035, 'square', 0.022); },
  click() { tone(900, 0.04, 'square', 0.05); },
  explosion(s = 1) { noise(2.8 * s, 0.9 * s, 'lowpass', 2500, 50, 0.7); tone(60, 1.8 * s, 'sine', 0.9 * s, 22); noise(0.4, 0.6 * s, 'highpass', 3000, 800); },
  crunch() {
    noise(1.4, 1, 'lowpass', 4000, 70, 0.8); tone(45, 1.4, 'sawtooth', 0.5, 20);
    for (let i = 0; i < 8; i++) noise(0.15, 0.4, 'bandpass', rand(600, 3200), null, 4, rand(0, 0.7));
  },
  door() { noise(0.9, 0.35, 'bandpass', 300, 1800, 2); tone(90, 0.25, 'square', 0.12, 60, 0.75); },
  fridge() { noise(0.25, 0.2, 'bandpass', 600, null, 3); tone(220, 0.1, 'sine', 0.08); },
  creak() { tone(rand(100, 150), 0.3, 'sawtooth', 0.035, rand(80, 200)); },
  thud(v = 0.4) { tone(90, 0.18, 'sine', v * 0.8, 40); noise(0.12, v * 0.5, 'lowpass', 800); },
  clink(v = 0.3) { tone(rand(1400, 2200), 0.12, 'triangle', v * 0.35); noise(0.05, v * 0.2, 'highpass', 3000); },
  shoot() { tone(1400, 0.18, 'square', 0.14, 180); noise(0.15, 0.25, 'highpass', 2000, 600); tone(90, 0.12, 'sine', 0.3, 40); },
  empty() { tone(300, 0.06, 'square', 0.08); },
  pickup() { tone(660, 0.09, 'sine', 0.15); tone(990, 0.14, 'sine', 0.13, null, 0.08); },
  grab() { tone(320, 0.06, 'sine', 0.08); },
  hurt() { noise(0.2, 0.5, 'lowpass', 900); tone(140, 0.25, 'sawtooth', 0.15, 70); },
  screech(v = 0.3) { tone(rand(500, 800), 0.5, 'sawtooth', v * 0.4, rand(1500, 2500)); tone(rand(300, 400), 0.4, 'square', v * 0.2, rand(900, 1400)); },
  growl(v = 0.3) { tone(rand(55, 80), 0.7, 'sawtooth', v * 0.5, rand(40, 60)); noise(0.6, v * 0.3, 'bandpass', 300, null, 3); },
  cdie(v = 0.4) { tone(900, 0.9, 'sawtooth', v * 0.4, 80); noise(0.6, v * 0.4, 'bandpass', 1200, 200, 2); },
  hitc() { noise(0.1, 0.3, 'bandpass', 1500, null, 2); tone(400, 0.1, 'square', 0.1, 200); },
  step() { noise(0.09, 0.1, 'lowpass', rand(450, 750)); },
  land() { noise(0.18, 0.3, 'lowpass', 500); },
  whoosh() { noise(0.35, 0.3, 'bandpass', 400, 2500, 1.5, 0, 0.05); },
  beaconOn() { [220, 277, 330, 440, 554, 660].forEach((f, i) => tone(f, 2.5, 'sine', 0.12, null, i * 0.18)); noise(2, 0.3, 'lowpass', 200, 2000, 1); },
  beep() { tone(880, 0.12, 'sine', 0.12); },
  warn() { tone(520, 0.15, 'square', 0.07); tone(390, 0.2, 'square', 0.07, null, 0.17); },
  spark(v = 0.25) { for (let i = 0; i < 5; i++) noise(0.04, v, 'highpass', 4000, null, 1, i * rand(0.02, 0.07)); },
  insert() { tone(200, 0.3, 'square', 0.12, 600); tone(800, 0.3, 'sine', 0.15, null, 0.25); },
  hiss() { noise(1.2, 0.3, 'highpass', 3000, 6000, 1, 0, 0.05); },
  heartbeat(v = 0.7) { tone(58, 0.16, 'sine', v, 40); tone(52, 0.16, 'sine', v * 0.8, 36, 0.24); },
  ring() { tone(3900, 6, 'sine', 0.05); },
  laser() { tone(2200, 0.4, 'sawtooth', 0.12, 150); noise(0.3, 0.3, 'bandpass', 2500, 500, 1); },
  objective() { tone(523, 0.15, 'sine', 0.1); tone(784, 0.25, 'sine', 0.1, null, 0.12); },
  titleHit() { tone(40, 3, 'sine', 0.8, 30); noise(3, 0.4, 'lowpass', 400, 60, 1); tone(110, 3, 'sawtooth', 0.08, 55); },
  radio() { noise(0.4, 0.15, 'bandpass', 1800, null, 1); },
  sizzle() { noise(0.4, 0.08, 'highpass', 4000, null, 1); },
  squeak() { tone(rand(1800, 2600), 0.12, 'triangle', 0.06, rand(2400, 3400)); },
  crack() { noise(0.08, 0.6, 'highpass', 1500, null, 2); tone(220, 0.08, 'square', 0.15, 90); },
  dig() { noise(0.35, 0.35, 'lowpass', 900, 300, 1); tone(110, 0.15, 'sine', 0.15, 70); },
  wrong() { tone(160, 0.35, 'sawtooth', 0.12, 120); },
  ok() { tone(880, 0.1, 'sine', 0.12); tone(1320, 0.18, 'sine', 0.1, null, 0.1); },
  blip(v = 0.04) { tone(rand(900, 2400), 0.05, 'sine', v); },
  note(f, v = 0.14) { tone(f, 0.16, 'square', v); tone(f * 2, 0.1, 'sine', v * 0.45, null, 0.02); },
  paper() { noise(0.18, 0.12, 'bandpass', 1800, 900, 0.8); tone(rand(900, 1400), 0.08, 'triangle', 0.04); },
  scrape(v = 0.35) { noise(0.45, v, 'lowpass', 500, 180, 1); tone(70, 0.4, 'sawtooth', v * 0.25, 40); },
  keyTurn() { noise(0.1, 0.3, 'bandpass', 2500, null, 3); tone(400, 0.05, 'square', 0.1); },
  engineStart() { tone(60, 1.2, 'sawtooth', 0.25, 140); noise(1.2, 0.3, 'lowpass', 300, 900, 1); },
  creakBig() { tone(rand(60, 90), 1.2, 'sawtooth', 0.05, rand(40, 70)); },
  choice() { tone(523, 0.2, 'sine', 0.1); tone(659, 0.3, 'sine', 0.08, null, 0.15); },
};

// ---------- loopande ljud (ambiens, motorer, musik) ----------
function loopNoise(type, f, q) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ac.createGain(); g.gain.value = 0;
  s.connect(fl); fl.connect(g); g.connect(master); s.start();
  return { g, fl, stops: [() => s.stop()] };
}
function loopOsc(freqs, type, ff, q = 1) {
  const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = ff; fl.Q.value = q;
  const g = ac.createGain(); g.gain.value = 0;
  fl.connect(g); g.connect(master);
  const oscs = freqs.map((f) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.baseF = f; o.connect(fl); o.start(); return o; });
  return { g, fl, oscs, stops: oscs.map((o) => () => o.stop()) };
}
function lfo(param, rate, depth) {
  const o = ac.createOscillator(); o.frequency.value = rate;
  const g = ac.createGain(); g.gain.value = depth;
  o.connect(g); g.connect(param); o.start();
  return () => o.stop();
}
const LOOPS = {
  hum: () => loopOsc([55, 55.6, 110.4], 'sawtooth', 220),
  rumble: () => loopNoise('lowpass', 160, 0.8),
  wind: () => { const L = loopNoise('bandpass', 420, 0.7); L.stops.push(lfo(L.fl.frequency, 0.07, 220)); return L; },
  music: () => { const L = loopOsc([55, 82.41, 110.6, 164.4, 220.8], 'sawtooth', 380, 2); L.stops.push(lfo(L.fl.frequency, 0.05, 250)); return L; },
  tension: () => { const L = loopOsc([41.2, 61.7, 82.6], 'sawtooth', 300, 3); L.stops.push(lfo(L.fl.frequency, 0.6, 150)); return L; },
  engine: () => loopNoise('lowpass', 260, 1),
  gen: () => { const L = loopOsc([60, 120.5, 180.3], 'sawtooth', 300, 2); const N = loopNoise('bandpass', 900, 1); N.g.gain.value = 0.4; N.g.disconnect(); N.g.connect(L.fl); L.stops.push(...N.stops); return L; },
  vent: () => loopNoise('highpass', 2200, 0.5),
  cockpit: () => { const L = loopOsc([220, 330.4, 440.9], 'sine', 900, 1); L.stops.push(lfo(L.g.gain, 0.3, 0.004)); return L; },
  fire: () => loopNoise('lowpass', 700, 0.7),
  rover: () => { const L = loopOsc([40, 80.5], 'sawtooth', 260, 2); L.osc = true; return L; },
};
// Ändra tonhöjden på en loop (rovermotorn)
export function loopPitch(name, mul) {
  const L = active[name]; if (!L || !L.oscs) return;
  L.oscs.forEach((o, i) => o.frequency.setTargetAtTime(o.baseF * mul, ac.currentTime, 0.1));
}
const active = {};
export function loop(name, vol, tc = 0.5) {
  if (!ac) return;
  let L = active[name];
  if (!L) { if (vol <= 0) return; L = active[name] = LOOPS[name](); }
  L.g.gain.setTargetAtTime(vol, ac.currentTime, tc);
  if (vol <= 0) {
    delete active[name];
    setTimeout(() => L.stops.forEach((f) => { try { f(); } catch (e) { /* redan stoppad */ } }), tc * 6000 + 200);
  }
}

let alarmTimer = null;
export function alarm(on) {
  if (on && !alarmTimer) alarmTimer = setInterval(() => tone(780, 0.3, 'square', 0.045, 560), 700);
  else if (!on && alarmTimer) { clearInterval(alarmTimer); alarmTimer = null; }
}

let bpm = 0;
export function setHeartbeat(b) { bpm = b; }
function heartbeatTick() {
  if (bpm > 0) { SFX.heartbeat(); setTimeout(heartbeatTick, 60000 / bpm); }
  else setTimeout(heartbeatTick, 250);
}
