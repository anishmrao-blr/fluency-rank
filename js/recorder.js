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

/* ---------- On-device pace, pause & Easy Onset measures (pure, unit-testable) ----------
   Computes durationSec, speakingSec, pauses (>= 1.0s silent gap between speech), WPM,
   and easyOnsetPct (% of speech starts with a gradual volume ramp vs abrupt spike).
   Always shown with: "These measure pace, pauses and soft starts, not stammering." */
export const rmsToDb = rms => 20 * Math.log10(Math.max(rms || 0, 1e-6));

export function isSoftOnset(onsetSlice) {
  if (!onsetSlice || !onsetSlice.length) return true;
  const first = onsetSlice[0];
  let peak = first;
  for (let i = 1; i < onsetSlice.length; i++) if (onsetSlice[i] > peak) peak = onsetSlice[i];
  /* Abrupt / hard glottal attack: jumps high immediately (>= -22 dB) at >= 78% of local peak */
  if (first >= 0.08 && peak > 0 && first >= peak * 0.78) return false;
  return true;
}

export function analyzeSamples(samples, sampleRate, wordCount) {
  if (!samples || !samples.length || !sampleRate) {
    return {durationSec:0, speakingSec:0, pauses:0, wpm:null, onsets:0, easyOnsetPct:null};
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
  if (!n) return {durationSec:0, speakingSec:0, pauses:0, wpm:null, onsets:0, easyOnsetPct:null};
  const thresh = 0.02;
  const onsetGapFrames = Math.max(1, Math.round(0.15 / dt));
  const onsetWin = Math.max(2, Math.min(5, Math.round(0.15 / dt)));
  let speakingFrames = 0, pauses = 0, seenSpeech = false, silentRun = onsetGapFrames;
  let onsets = 0, softOnsets = 0;
  for (let i = 0; i < n; i++) {
    if (rmsFrames[i] >= thresh) {
      if (seenSpeech && silentRun * dt >= 1.0) pauses++;
      if (silentRun >= onsetGapFrames) {
        onsets++;
        if (isSoftOnset(rmsFrames.slice(i, i + onsetWin))) softOnsets++;
      }
      seenSpeech = true;
      silentRun = 0;
      speakingFrames++;
    } else {
      silentRun++;
    }
  }
  const speakingSec = +(speakingFrames * dt).toFixed(1);
  const wpm = wordCount > 0 && durationSec >= 2 ? Math.round(wordCount / (durationSec / 60)) : null;
  const easyOnsetPct = onsets > 0 ? Math.round((softOnsets / onsets) * 100) : null;
  return {durationSec, speakingSec, pauses, wpm, onsets, easyOnsetPct};
}

export function onsetMeterHtml(id, hidden) {
  return '<div class="onset-box" id="' + esc(id || 'onsetBox') + '"' + (hidden === false ? '' : ' hidden') + '>'
    + '<div class="onset-head"><span class="onset-k">Easy onset</span><span class="onset-tag" data-onset-tag>Ready</span></div>'
    + '<div class="onset-trk" aria-hidden="true"><i class="onset-fill" data-onset-fill style="transform:scaleX(0)"></i></div>'
    + '</div>';
}

export function measuresHtml(m) {
  if (!m) return '';
  return '<div class="measures">'
    + '<div class="m-grid m4">'
    + '<div class="m-cell"><span class="m-k">Speaking time</span><b class="m-v num">' + esc(String(m.speakingSec)) + ' s</b></div>'
    + '<div class="m-cell"><span class="m-k">Pauses &gt; 1s</span><b class="m-v num">' + esc(String(m.pauses)) + '</b></div>'
    + '<div class="m-cell"><span class="m-k">Pace</span><b class="m-v num">' + (m.wpm != null ? m.wpm + ' wpm' : '—') + '</b></div>'
    + '<div class="m-cell"><span class="m-k">Soft starts</span><b class="m-v num">' + (m.easyOnsetPct != null ? m.easyOnsetPct + '%' : '—') + '</b></div>'
    + '</div>'
    + '<p class="cap">These measure pace and pauses, not stammering. Soft starts track volume ramp only.</p>'
    + '</div>';
}

/* ---------- On-Device Audio Clip Scorecard & Next-Drill Recommender ----------
   Pure, challengeable breakdown of a recorded clip (Pace, Soft starts, Pauses)
   plus a concrete next drill based on whichever signal needs support most. */
export function buildClipReview(m, targetWpm) {
  if (!m) return null;
  const target = targetWpm || 105;
  const rows = [];

  /* 1. Soft starts (Easy Onset) */
  if (m.easyOnsetPct == null) {
    rows.push({k:'Soft starts', level:'watch', badge:'Short clip', note:'Speak a few full phrases to gauge word starts.'});
  } else if (m.easyOnsetPct >= 70) {
    rows.push({k:'Soft starts', level:'steady', badge:'Steady', note:m.easyOnsetPct + '% gentle starts.'});
  } else if (m.easyOnsetPct >= 45) {
    rows.push({k:'Soft starts', level:'watch', badge:'Watch', note:m.easyOnsetPct + '% gentle starts. Soften the first sound slightly.'});
  } else {
    rows.push({k:'Soft starts', level:'focus', badge:'Focus', note:m.easyOnsetPct + '% gentle starts. Let breath move just before the word.'});
  }

  /* 2. Pace control */
  let paceFast = false;
  if (m.wpm == null) {
    rows.push({k:'Pace', level:'steady', badge:'Logged', note:m.speakingSec + ' s of speaking captured.'});
  } else {
    const diff = m.wpm - target;
    if (Math.abs(diff) <= 15) {
      rows.push({k:'Pace', level:'steady', badge:'Steady', note:m.wpm + ' wpm (on your ' + target + ' wpm target).'});
    } else if (diff > 15) {
      paceFast = true;
      rows.push({k:'Pace', level:'focus', badge:'Fast', note:m.wpm + ' wpm (' + diff + ' wpm above target). Stretch vowels slightly.'});
    } else {
      rows.push({k:'Pace', level:'steady', badge:'Unhurried', note:m.wpm + ' wpm (relaxed, unhurried pace).'});
    }
  }

  /* 3. Pauses & flow */
  if (m.pauses <= 1) {
    rows.push({k:'Pauses', level:'steady', badge:'Steady', note:m.pauses + ' pause >1s.'});
  } else if (m.pauses <= 3) {
    rows.push({k:'Pauses', level:'watch', badge:'Watch', note:m.pauses + ' pauses >1s. Shorter phrases keep airflow steady.'});
  } else {
    rows.push({k:'Pauses', level:'focus', badge:'Focus', note:m.pauses + ' pauses >1s. Pause to exhale rather than pushing through.'});
  }

  /* Concrete next drill recommendation */
  let next;
  if (m.easyOnsetPct != null && m.easyOnsetPct < 55) {
    next = {act:'breath', val:'speak', label:'Breathe & speak', why:'Pairs an easy exhale with softer word starts.'};
  } else if (paceFast) {
    next = {act:'read', val:'', label:'Read aloud (slower pace)', why:'Re-anchors a calm, stretched speaking rate.'};
  } else if (m.pauses > 2) {
    next = {act:'breath', val:'sigh', label:'Cyclic sighing (1 min)', why:'Drops speaking tension before your next round.'};
  } else {
    next = {act:'field', val:'', label:'Try a real-world step', why:'Starts and pace look steady. Carry this into live conversation.'};
  }

  return {rows, next};
}

export function clipReviewHtml(rev) {
  if (!rev) return '';
  return '<div class="score-card">'
    + '<div class="sc-head"><span class="sc-title">Voice scorecard</span><span class="cap">On-device indicator</span></div>'
    + rev.rows.map(r => '<div class="sc-row"><div class="sc-top"><b>' + esc(r.k) + '</b><span class="sc-pill ' + esc(r.level) + '">' + esc(r.badge) + '</span></div><p class="ds">' + esc(r.note) + '</p></div>').join('')
    + '<div class="sc-next"><span class="sc-nk">Suggested next</span><b>' + esc(rev.next.label) + '</b><span class="ds">' + esc(rev.next.why) + '</span></div>'
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
  let silentFrames = 10, onsetBuf = null, onsetState = '';
  const onsetFill = opts.onsetEl ? opts.onsetEl.querySelector('[data-onset-fill]') : null;
  const onsetTag = opts.onsetEl ? opts.onsetEl.querySelector('[data-onset-tag]') : null;

  const updateOnsetMeter = level => {
    if (!onsetFill || !onsetTag) return;
    const norm = Math.min(1, Math.max(0, level * 5.2));
    onsetFill.style.transform = 'scaleX(' + norm.toFixed(3) + ')';
    if (level >= 0.02) {
      if (silentFrames >= 8) onsetBuf = [level];
      else if (onsetBuf) {
        onsetBuf.push(level);
        if (onsetBuf.length >= 4) {
          const soft = isSoftOnset(onsetBuf);
          onsetState = soft ? 'soft' : 'hard';
          onsetTag.textContent = soft ? 'Soft start' : 'Abrupt start';
          onsetTag.className = 'onset-tag ' + onsetState;
          onsetFill.className = 'onset-fill ' + onsetState;
          onsetBuf = null;
        }
      }
      silentFrames = 0;
    } else {
      silentFrames++;
      if (silentFrames === 16) {
        onsetBuf = null;
        onsetState = '';
        onsetTag.textContent = 'Ready';
        onsetTag.className = 'onset-tag';
        onsetFill.className = 'onset-fill';
      }
    }
  };

  const drawCanvas = () => {
    const cv = opts.canvas;
    if ((!cv && !opts.onsetEl) || stopped) return;
    let level = 0.04;
    if (analyser) {
      const buf = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(buf);
      let s = 0;
      for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      level = Math.sqrt(s / buf.length);
    }
    frames.push(level);
    updateOnsetMeter(level);
    if (cv) {
      const ctx = cv.getContext && cv.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, cv.width, cv.height);
        const bars = 38, gap = 3, bw = (cv.width - gap * (bars - 1)) / bars, mid = cv.height / 2;
        const slice = frames.slice(-bars);
        for (let i = 0; i < bars; i++) {
          const v = slice[i] != null ? slice[i] : 0.01;
          const amp = Math.min(1, Math.max(0.08, v * 5.5));
          const h = Math.max(4, amp * (cv.height - 6));
          ctx.fillStyle = v >= 0.02 ? (onsetState === 'hard' && i === bars - 1 ? '#E8B86D' : '#9CD8D0') : 'rgba(156,216,208,.35)';
          ctx.fillRect(i * (bw + gap), mid - h / 2, bw, h);
        }
      }
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
      if (opts.canvas || opts.onsetEl) raf = requestAnimationFrame(drawCanvas);
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
