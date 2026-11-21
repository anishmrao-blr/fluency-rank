/* Feared words, name & hard sounds weaving (Spec 2 & 6, Postel's Law forgiving input). */
import {rnd} from './util.js';

/* Accepts commas, semicolons, newlines, quotes, extra spaces; deduplicates and caps at 30 words. */
export function parseFearedWords(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(/[,;\n\r\t]+/);
  const seen = new Set(), out = [];
  for (const item of list) {
    const clean = String(item || '').replace(/["'“”‘’()[\]{}]/g, '').trim().replace(/\s+/g, ' ').slice(0, 32);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= 30) break;
  }
  return out;
}

export function parseName(raw) {
  return String(raw || '').replace(/[<>]/g, '').trim().slice(0, 40);
}

/* Letters pool from both explicit hard sounds and first letters of feared words. */
export function hardLetterPool(state) {
  const set = new Set();
  String((state && state.hard) || '').toUpperCase().replace(/[^A-Z]/g, '').split('').forEach(c => set.add(c));
  ((state && state.fearedWords) || []).forEach(w => {
    const ch = String(w).trim().charAt(0).toUpperCase();
    if (/^[A-Z]$/.test(ch)) set.add(ch);
  });
  return [...set];
}

/* Roughly 1 in 3 items weaves in the user's name or a feared word. */
export function personalQuestion(state, roll) {
  const words = (state && state.fearedWords) || [];
  const name = (state && state.userName) || '';
  const r = roll != null ? roll : Math.random();
  if (r >= 1 / 3 || (!words.length && !name)) return null;
  if (words.length && (!name || Math.random() < 0.7)) {
    const w = words[rnd(words.length)];
    return {t:'Give a quick update and naturally include the word “' + w + '”.', ctx:'personal'};
  }
  return {t:'Introduce yourself aloud: say your name (' + name + ') and what you are working on this week.', ctx:'personal'};
}

export function weavePassage(passage, state, roll) {
  const words = (state && state.fearedWords) || [];
  const name = (state && state.userName) || '';
  const r = roll != null ? roll : Math.random();
  if (r >= 1 / 3 || (!words.length && !name)) return passage;
  const parts = [];
  if (name) parts.push('Hi, this is ' + name + '.');
  if (words.length) {
    const w = words[rnd(words.length)];
    parts.push('I wanted to touch base about ' + w + ' today.');
  }
  return {t:passage.t, x:parts.join(' ') + ' ' + passage.x, ctx:passage.ctx};
}

export function weavePhrases(basePhrases, state) {
  const words = (state && state.fearedWords) || [];
  const name = (state && state.userName) || '';
  if (!words.length && !name) return basePhrases.slice();
  const extra = [];
  if (name) extra.push('Hi, my name is ' + name + ', thanks for taking my call.');
  words.slice(0, 6).forEach(w => extra.push('Let me follow up on ' + w + ' this afternoon.'));
  const out = [];
  let ei = 0;
  for (let i = 0; i < basePhrases.length; i++) {
    out.push(basePhrases[i]);
    if (i % 2 === 1 && ei < extra.length) out.push(extra[ei++]);
  }
  return out;
}

/* ---------- Phonetic hard-sound coaching (manner & place of articulation) ----------
   Maps any letter A-Z to a plain-English physical technique cue so drills coach
   light contact on stops, continuous airflow on fricatives, and easy onset on vowels. */
export function phoneticCue(letter) {
  const L = String(letter || '').trim().toUpperCase().replace(/[^A-Z]/g, '').charAt(0);
  if (!L) return null;
  if ('PB'.indexOf(L) >= 0) return {letter:L, group:'Bilabial stop', title:'Light lip touch', cue:'Touch your lips lightly for ' + L + ' instead of pressing, then release smoothly into the vowel.'};
  if ('TD'.indexOf(L) >= 0) return {letter:L, group:'Alveolar stop', title:'Light tongue tap', cue:'Tap your tongue lightly behind your top teeth for ' + L + ' and glide straight into the vowel.'};
  if ('KGCQ'.indexOf(L) >= 0) return {letter:L, group:'Velar stop', title:'Soft back-tongue release', cue:'Keep the back of your tongue light for ' + L + ' and let breath carry the sound forward.'};
  if ('FVSZHJX'.indexOf(L) >= 0) return {letter:L, group:'Fricative', title:'Steady gentle airflow', cue:'Let a quiet stream of air move first on ' + L + ', then ease smoothly into the rest of the word.'};
  if ('MNLRWY'.indexOf(L) >= 0) return {letter:L, group:'Continuous sound', title:'Soft resonant slide', cue:'Stretch ' + L + ' gently for a beat and slide straight into the vowel without stopping.'};
  return {letter:L, group:'Vowel start', title:'Easy onset', cue:'Begin ' + L + ' like a soft sigh turning gently into voice.'};
}

/* Returns up to 2 deduplicated phonetic cues for the user's hardest sounds (never overwhelms targets). */
export function phoneticGuideFor(state) {
  const pool = hardLetterPool(state).concat(Object.keys((state && state.weak) || {}));
  const out = [], seenGroups = new Set();
  for (let i = 0; i < pool.length; i++) {
    const info = phoneticCue(pool[i]);
    if (!info || seenGroups.has(info.group)) continue;
    seenGroups.add(info.group);
    out.push(info);
    if (out.length >= 2) break;
  }
  return out;
}
