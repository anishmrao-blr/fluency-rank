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
