import {$, esc, fmt} from './util.js';
import {T} from './ui.js';

const DB_NAME = 'fluency-rank-clips';
const STORE = 'clips';
const RETENTION_MS = 14 * 86400000;

/* In-memory fallback when IndexedDB is unavailable (e.g. restricted private mode or minimal jsdom). */
const memStore = new Map();
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined' || !indexedDB.open) return Promise.resolve(null);
  dbPromise = new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath:'id'});
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (e) { resolve(null); }
  });
  return dbPromise;
}

export function resetRecorderCache() { dbPromise = null; memStore.clear(); }

export async function saveClip(clip) {
  const rec = Object.assign({id:'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), createdAt:Date.now(), kind:'drill'}, clip);
  const db = await openDb();
  if (!db) { memStore.set(rec.id, rec); return rec; }
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = () => resolve(rec);
      tx.onerror = () => { memStore.set(rec.id, rec); resolve(rec); };
    } catch (e) { memStore.set(rec.id, rec); resolve(rec); }
  });
}

export async function getClip(id) {
  if (!id) return null;
  const db = await openDb();
  if (!db) return memStore.get(id) || null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || memStore.get(id) || null);
      req.onerror = () => resolve(memStore.get(id) || null);
    } catch (e) { resolve(memStore.get(id) || null); }
  });
}

export async function listClips(kind) {
  const db = await openDb();
  let all = [];
  if (!db) {
    all = [...memStore.values()];
  } else {
    all = await new Promise(resolve => {
      try {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([...memStore.values()]);
      } catch (e) { resolve([...memStore.values()]); }
    });
  }
  return kind ? all.filter(c => c.kind === kind) : all;
}

export async function deleteClip(id) {
  memStore.delete(id);
  const db = await openDb();
  if (!db) return;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (e) { resolve(); }
  });
}

export async function clearClips() {
  memStore.clear();
  const db = await openDb();
  if (!db) return;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch (e) { resolve(); }
  });
}

/* Spec 5: drill clips expire after 14 days; proof and re-record clips stay until the user deletes them. */
export async function pruneExpiredClips(nowMs) {
  const now = nowMs || Date.now();
  const all = await listClips();
  let removed = 0;
  for (const c of all) {
    if (c.kind === 'drill' && (now - (c.createdAt || 0)) > RETENTION_MS) {
      await deleteClip(c.id);
      removed++;
    }
  }
  return removed;
}

export async function storageStats() {
  const all = await listClips();
  const bytes = all.reduce((sum, c) => sum + ((c.blob && c.blob.size) || c.bytes || 0), 0);
  return {count:all.length, bytes};
}

export function fmtBytes(b) {
  if (!b) return '0 KB';
  if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

/* ---------- On-device pace & pause measures (pure, unit-testable) ----------
   Computes durationSec, speakingSec, pauses (>= 1.0s silent gap between speech), and WPM.
   Always shown with: "These measure pace and pauses, not stammering." */
export function analyzeSamples(samples, sampleRate, wordCount) {
  if (!samples || !samples.length || !sampleRate) {
    return {durationSec:0, speakingSec:0, pauses:0, wpm:null};
  }
  const win = Math.max(1, Math.floor(sampleRate * 0.05)); // 50 ms frame
  const frames = [];
  for (let i = 0; i < samples.length; i += win) {
    let sum = 0;
    const end = Math.min(samples.length, i + win);
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    frames.push(Math.sqrt(sum / (end - i)));
  }
  return analyzeFrames(frames, 0.05, wordCount);
}

export function analyzeFrames(rmsFrames, frameSec, wordCount) {
  const dt = frameSec || 0.05;
  const n = (rmsFrames && rmsFrames.length) || 0;
  const durationSec = +(n * dt).toFixed(1);
  if (!n) return {durationSec:0, speakingSec:0, pauses:0, wpm:null};
  const thresh = 0.02;
  let speakingFrames = 0, pauses = 0, seenSpeech = false, silentRun = 0;
  for (let i = 0; i < n; i++) {
    if (rmsFrames[i] >= thresh) {
      if (seenSpeech && silentRun * dt >= 1.0) pauses++;
      seenSpeech = true;
      silentRun = 0;
      speakingFrames++;
    } else if (seenSpeech) {
      silentRun++;
    }
  }
  const speakingSec = +(speakingFrames * dt).toFixed(1);
  const wpm = wordCount > 0 && durationSec >= 2 ? Math.round(wordCount / (durationSec / 60)) : null;
  return {durationSec, speakingSec, pauses, wpm};
}

export function measuresHtml(m) {
  if (!m) return '';
  return '<div class="measures">'
    + '<div class="m-grid">'
    + '<div class="m-cell"><span class="m-k">Speaking time</span><b class="m-v num">' + esc(String(m.speakingSec)) + ' s</b></div>'
    + '<div class="m-cell"><span class="m-k">Pauses &gt; 1s</span><b class="m-v num">' + esc(String(m.pauses)) + '</b></div>'
    + '<div class="m-cell"><span class="m-k">Pace</span><b class="m-v num">' + (m.wpm != null ? m.wpm + ' wpm' : '—') + '</b></div>'
    + '</div>'
    + '<p class="cap">These measure pace and pauses, not stammering.</p>'
    + '</div>';
}

/* ---------- Live Microphone Recorder + Canvas Waveform ---------- */
let activeRec = null;
let cleanupWired = false;
function wireRecCleanup() {
  if (cleanupWired) return;
  cleanupWired = true;
  T.onClear(() => { if (activeRec) { activeRec.cancel(); activeRec = null; } });
}

export function micSupported() {
  return !!(typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof window.MediaRecorder !== 'undefined');
}

export function createRecorder(opts) {
  opts = opts || {};
  wireRecCleanup();
  let stream = null, mr = null, ac = null, analyser = null, chunks = [], frames = [], raf = 0, t0 = 0, stopped = false;

  const drawCanvas = () => {
    const cv = opts.canvas;
    if (!cv || stopped) return;
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return;
    let level = 0.04;
    if (analyser) {
      const buf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      level = Math.sqrt(s / buf.length);
    }
    frames.push(level);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const bars = 38, gap = 3, bw = (cv.width - gap * (bars - 1)) / bars, mid = cv.height / 2;
    const slice = frames.slice(-bars);
    for (let i = 0; i < bars; i++) {
      const v = slice[i] != null ? slice[i] : 0.01;
      const amp = Math.min(1, Math.max(0.08, v * 5.5));
      const h = Math.max(4, amp * (cv.height - 6));
      ctx.fillStyle = v >= 0.02 ? '#9CD8D0' : 'rgba(156,216,208,.35)';
      ctx.fillRect(i * (bw + gap), mid - h / 2, bw, h);
    }
    raf = requestAnimationFrame(drawCanvas);
  };

  const cleanup = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    if (stream && stream.getTracks) stream.getTracks().forEach(t => { try { t.stop(); } catch (e) {} });
    if (ac && ac.close) { try { ac.close(); } catch (e) {} }
    stream = null; ac = null; analyser = null;
  };

  const rec = {
    async start() {
      if (!micSupported()) return {ok:false, reason:'unsupported'};
      try {
        stream = await navigator.mediaDevices.getUserMedia({audio:true});
      } catch (e) {
        return {ok:false, reason:'denied'};
      }
      chunks = []; frames = []; stopped = false; t0 = performance.now();
      try {
        mr = new window.MediaRecorder(stream);
        mr.ondataavailable = e => { if (e && e.data && e.data.size > 0) chunks.push(e.data); };
        mr.start(250);
      } catch (e) {
        cleanup();
        return {ok:false, reason:'unsupported'};
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          ac = new AC();
          const src = ac.createMediaStreamSource(stream);
          analyser = ac.createAnalyser();
          analyser.fftSize = 256;
          src.connect(analyser);
        }
      } catch (e) { /* waveform falls back cleanly */ }
      activeRec = rec;
      if (opts.canvas) raf = requestAnimationFrame(drawCanvas);
      return {ok:true};
    },
    stop(wordCount) {
      return new Promise(resolve => {
        if (!mr || stopped) { cleanup(); resolve(null); return; }
        const durMs = Math.max(100, Math.round(performance.now() - t0));
        const finish = () => {
          const mime = (mr && mr.mimeType) || 'audio/webm';
          const blob = typeof Blob !== 'undefined' ? new Blob(chunks, {type:mime}) : {size:chunks.reduce((a, b) => a + (b.size || 0), 0), type:mime};
          const dt = frames.length > 1 ? (durMs / 1000) / frames.length : 0.05;
          const m = frames.length ? analyzeFrames(frames, dt, wordCount) : {durationSec:+(durMs / 1000).toFixed(1), speakingSec:+(durMs / 1000).toFixed(1), pauses:0, wpm:wordCount > 0 ? Math.round(wordCount / (durMs / 60000)) : null};
          cleanup();
          if (activeRec === rec) activeRec = null;
          resolve({blob, mimeType:mime, durationMs:durMs, bytes:blob.size || 0, measures:m});
        };
        mr.onstop = finish;
        try { mr.stop(); } catch (e) { finish(); }
      });
    },
    cancel() {
      try { if (mr && mr.state !== 'inactive') mr.stop(); } catch (e) {}
      cleanup();
      if (activeRec === rec) activeRec = null;
    }
  };
  return rec;
}

/* ---------- Compact Audio Player (21st.dev style) ---------- */
const urls = new Set();
export function revokeAllUrls() {
  urls.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
  urls.clear();
}

export function playerHtml(id, label, durSec) {
  return '<div class="ap-card" id="' + esc(id) + '">'
    + '<div class="ap-head"><span class="tt">' + esc(label) + '</span><span class="ds num" data-ap-time>' + fmt(Math.round(durSec || 0)) + '</span></div>'
    + '<div class="ap-row">'
    + '<button type="button" class="ap-play" data-ap-play aria-label="Play ' + esc(label) + '">▶</button>'
    + '<div class="ap-trk" aria-hidden="true"><i data-ap-fill style="transform:scaleX(0)"></i></div>'
    + '<button type="button" class="ap-spd" data-ap-spd aria-label="Playback speed">1.0x</button>'
    + '</div></div>';
}

export function wirePlayer(root, id, clip) {
  const el = $('#' + id, root);
  if (!el || !clip || !clip.blob) return;
  let audio = null, url = '', playing = false;
  const speeds = [1, 0.85, 1.2]; let si = 0;
  const playBtn = $('[data-ap-play]', el), fill = $('[data-ap-fill]', el), timeEl = $('[data-ap-time]', el), spdBtn = $('[data-ap-spd]', el);

  const ensureAudio = () => {
    if (audio) return audio;
    if (typeof URL !== 'undefined' && URL.createObjectURL && clip.blob instanceof Blob) {
      url = URL.createObjectURL(clip.blob);
      urls.add(url);
      audio = new Audio(url);
      audio.ontimeupdate = () => {
        if (!audio.duration || !isFinite(audio.duration)) return;
        fill.style.transform = 'scaleX(' + Math.min(1, audio.currentTime / audio.duration).toFixed(3) + ')';
        timeEl.textContent = fmt(Math.round(audio.currentTime));
      };
      audio.onended = () => { playing = false; playBtn.textContent = '▶'; fill.style.transform = 'scaleX(0)'; };
    }
    return audio;
  };

  playBtn.onclick = () => {
    const a = ensureAudio();
    if (!a) return;
    if (playing) { a.pause(); playing = false; playBtn.textContent = '▶'; }
    else { a.playbackRate = speeds[si]; a.play().catch(() => {}); playing = true; playBtn.textContent = '❚❚'; }
  };
  spdBtn.onclick = () => {
    si = (si + 1) % speeds.length;
    spdBtn.textContent = speeds[si].toFixed(si === 1 ? 2 : 1) + 'x';
    if (audio) audio.playbackRate = speeds[si];
  };
}
