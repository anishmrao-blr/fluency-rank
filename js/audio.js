import {app} from './state.js';

/* Studio-grade offline Web Audio engine:
   - Warm harmonic Tibetan singing-bowl & chime cues (zero external KB, 100% offline)
   - Gentle stereo pink-noise ocean/rain ambient bed with slow wave filter modulation
   - Optional drop-in .mp3 override slots via assets/audio/manifest.json */

let ac = null, master = null, warmth = null;
let manifestLoaded = false, customMap = {}, customBufs = {};
let ambNode = null, ambGain = null, ambLfo = null, ambRunning = false;

function ensureContext() {
  if (!ac) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ac = new Ctx();
    warmth = ac.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.value = 2100;
    warmth.Q.value = 0.6;
    master = ac.createGain();
    master.gain.value = 0.85;
    warmth.connect(master);
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') {
    try { ac.resume(); } catch (e) { /* ignore */ }
  }
  return ac;
}

function loadCustomManifest() {
  if (manifestLoaded || typeof fetch !== 'function') return;
  manifestLoaded = true;
  fetch('assets/audio/manifest.json')
    .then(r => r.ok ? r.json() : {})
    .then(m => {
      if (!m || typeof m !== 'object') return;
      customMap = m;
      Object.keys(m).forEach(k => {
        const file = m[k];
        if (!file || typeof file !== 'string') return;
        fetch('assets/audio/' + file)
          .then(r => r.ok ? r.arrayBuffer() : null)
          .then(ab => ab && ac ? ac.decodeAudioData(ab) : null)
          .then(buf => { if (buf) customBufs[k] = buf; })
          .catch(() => {});
      });
    })
    .catch(() => {});
}

export function primeAudio() {
  if (!app.S.sound) return;
  try {
    ensureContext();
    loadCustomManifest();
  } catch (e) { ac = null; }
}

/* Plays one layered harmonic singing-bowl voice */
function bowlNote(freq, startT, dur, peak) {
  if (!ac || !warmth) return;
  const partials = [
    {ratio: 1, gain: 1.0, dec: dur},
    {ratio: 2.0, gain: 0.22, dec: dur * 0.65},
    {ratio: 2.756, gain: 0.14, dec: dur * 0.42}
  ];
  partials.forEach(p => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * p.ratio, startT);
    const amp = Math.max(0.0002, peak * p.gain);
    g.gain.setValueAtTime(0.0001, startT);
    g.gain.linearRampToValueAtTime(amp, startT + 0.045);
    g.gain.exponentialRampToValueAtTime(0.0001, startT + p.dec);
    o.connect(g);
    g.connect(warmth);
    o.start(startT);
    o.stop(startT + p.dec + 0.05);
  });
}

function playBuffer(buf, gainVal, loop) {
  if (!ac || !master || !buf) return null;
  const src = ac.createBufferSource();
  const g = ac.createGain();
  src.buffer = buf;
  src.loop = !!loop;
  g.gain.setValueAtTime(gainVal, ac.currentTime);
  src.connect(g);
  g.connect(master);
  src.start();
  return {src, gain: g};
}

export function cue(kind) {
  if (!app.S.sound) return;
  try {
    const ctx = ensureContext();
    if (!ctx) return;
    if (customBufs[kind]) {
      playBuffer(customBufs[kind], kind === 'hold' ? 0.45 : 0.72, false);
      return;
    }
    const t = ctx.currentTime + 0.01;
    if (kind === 'in') {
      /* Warm rising bloom (D4 -> gentle E4 overtone) */
      bowlNote(293.66, t, 1.35, 0.16);
      bowlNote(329.63, t + 0.14, 1.45, 0.09);
    } else if (kind === 'hold') {
      /* Quiet crystalline shimmer (A4) */
      bowlNote(440.0, t, 0.95, 0.075);
    } else if (kind === 'out') {
      /* Grounding deep singing bowl (A3 + soft 5th) */
      bowlNote(220.0, t, 1.9, 0.18);
      bowlNote(329.63, t + 0.06, 1.5, 0.06);
    } else if (kind === 'go') {
      /* Clean confirmation chime (G4) */
      bowlNote(392.0, t, 1.1, 0.15);
    } else if (kind === 'end') {
      /* Peaceful completion chord (C4 - E4 - G4) */
      bowlNote(261.63, t, 2.2, 0.14);
      bowlNote(329.63, t + 0.15, 2.2, 0.12);
      bowlNote(392.0, t + 0.30, 2.4, 0.11);
    } else {
      bowlNote(392.0, t, 1.0, 0.13);
    }
  } catch (e) { /* audio is optional */ }
}

/* Generates a 4-second seamless stereo pink-noise buffer (Paul Kellet filter) */
let pinkBuf = null;
function getPinkBuffer(ctx) {
  if (pinkBuf && pinkBuf.sampleRate === ctx.sampleRate) return pinkBuf;
  const len = Math.floor(ctx.sampleRate * 4);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const out = buf.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.045;
      b6 = w * 0.115926;
    }
    /* Smooth crossfade at loop seam so 4s loop never clicks */
    const fade = Math.min(2400, Math.floor(len * 0.05));
    for (let i = 0; i < fade; i++) {
      const a = i / fade;
      out[i] = out[i] * a + out[len - fade + i] * (1 - a);
    }
  }
  pinkBuf = buf;
  return buf;
}

export function startAmbient() {
  if (!app.S.sound || !app.S.ambient || ambRunning) return;
  try {
    const ctx = ensureContext();
    if (!ctx || !master) return;
    ambRunning = true;
    const t = ctx.currentTime;

    if (customBufs.ambient) {
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      src.buffer = customBufs.ambient;
      src.loop = true;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.28, t + 1.2);
      src.connect(g);
      g.connect(master);
      src.start(t);
      ambNode = src;
      ambGain = g;
      return;
    }

    const src = ctx.createBufferSource();
    src.buffer = getPinkBuffer(ctx);
    src.loop = true;

    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(420, t);
    filt.Q.value = 0.7;

    /* Slow wave swell LFO (~11s cycle) */
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.09;
    lfoGain.gain.value = 150;
    lfo.connect(lfoGain);
    lfoGain.connect(filt.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.26, t + 1.2);

    src.connect(filt);
    filt.connect(g);
    g.connect(master);

    src.start(t);
    lfo.start(t);
    ambNode = src;
    ambGain = g;
    ambLfo = lfo;
  } catch (e) { ambRunning = false; }
}

export function stopAmbient() {
  if (!ambRunning && !ambNode) return;
  ambRunning = false;
  const node = ambNode, g = ambGain, lfo = ambLfo;
  ambNode = null; ambGain = null; ambLfo = null;
  try {
    if (ac && g) {
      const t = ac.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      setTimeout(() => {
        try { if (node) node.stop(); } catch (e) {}
        try { if (lfo) lfo.stop(); } catch (e) {}
      }, 550);
    } else {
      if (node) node.stop();
      if (lfo) lfo.stop();
    }
  } catch (e) { /* ignore */ }
}
