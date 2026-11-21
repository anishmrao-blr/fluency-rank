import {dstr, dayNum, numStr, weekStartNum} from './util.js';
import {RANKS, rankOf, levelOf, XP, QUEST_ITEMS, BREATH_TYPES, SPEAK_TYPES, TITLES} from './content.js';
import {app, blankDaily, save} from './state.js';

/* Daily Quest progress for today: {done, total:2, items:[{id, n, d, ok}]}. */
export function questProgress() {
  const d = app.S.daily;
  const items = QUEST_ITEMS.map(q => ({id:q.id, n:q.n, d:q.d, ok: q.id === 'breath' ? d.breathDone === true : d.speakDone === true}));
  return {done: items.filter(i => i.ok).length, total: QUEST_ITEMS.length, items};
}
/* Title ids a state has earned, in TITLES order. Used by award() and by the v2 migration. */
export function earnedTitles(s) {
  const r = rankOf(s.xp), ids = [];
  if (s.log.some(e => e.type === 'field')) ids.push('first-step');
  if (Object.keys(s.days).length >= 7) ids.push('week');
  for (let i = 1; i <= r; i++) ids.push('rank-' + RANKS[i].r);
  return TITLES.map(t => t.id).filter(id => ids.indexOf(id) >= 0);
}
export const weekStr = () => numStr(weekStartNum(dayNum(dstr())));
export function practicedThisWeek() {
  const w = weekStartNum(dayNum(dstr()));
  return Object.keys(app.S.days).filter(d => weekStartNum(dayNum(d)) === w).length;
}
export function rollDay() {
  const t = dstr();
  if (app.S.daily.date === t) return false;
  if (app.S.lastDay) {
    const gap = dayNum(t) - dayNum(app.S.lastDay);
    if (gap > 1) {
      const missed = gap - 1;
      if (app.S.shields >= missed) { app.S.shields -= missed; app.S.lastDay = numStr(dayNum(t) - 1); }
      else { app.S.streak = 0; app.S.lastDay = null; app.S.comeback = true; }
    }
  }
  app.S.daily = blankDaily(); app.S.daily.date = t;
  return true;
}

/* o: {pts, q, qn, score, meta, extra, partial}. XP comes from the fixed XP table only.
   partial: the session was ended early; it earns the same XP and the log meta says so. */
export function award(type, o) {
  o = o || {};
  rollDay();
  const S = app.S, D = S.daily;
  const before = {rank: rankOf(S.xp), level: levelOf(S.xp)};
  const e = S.energy, notes = [];
  const xp = type === 'debrief' && (D.debrief || 0) > 0 ? 0 : (XP[type] || 0);
  let bonus = 0;
  Object.keys(o.pts || {}).forEach(k => { S.stats[k] = (S.stats[k] || 0) + o.pts[k]; });
  if (o.q) D[o.q] = (D[o.q] || 0) + (o.qn || 1);
  if (BREATH_TYPES.indexOf(type) >= 0) D.breathDone = true;
  if (SPEAK_TYPES.indexOf(type) >= 0) D.speakDone = true;
  const n = (D.breathDone ? 1 : 0) + (D.speakDone ? 1 : 0);
  if (n >= 1) {
    const t = D.date, rec = S.days[t] || {n:0, e:0};
    S.days[t] = {n, e: Math.max(rec.e, e)};
    const keys = Object.keys(S.days).sort();
    if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(k => { delete S.days[k]; });
    if (!S.started) S.started = t;
    if (S.lastDay !== t) {
      const gap = S.lastDay ? dayNum(t) - dayNum(S.lastDay) : null;
      S.streak = gap === 1 ? S.streak + 1 : 1;
      S.best = Math.max(S.best, S.streak);
      S.lastDay = t;
    }
    if (S.comeback) { S.comeback = false; bonus += XP.comeback; notes.push('Comeback bonus: +' + XP.comeback + ' XP'); }
    /* daily.cleared marks the Daily Quest bonus as paid today */
    if (n >= 2 && !D.cleared) { D.cleared = true; bonus += XP.quest; notes.push('[Quest complete] Daily Quest · +' + XP.quest + ' XP'); }
    const ws = weekStr();
    if (practicedThisWeek() >= 5 && S.weekAward !== ws) { S.weekAward = ws; bonus += XP.week; if (S.shields < 2) S.shields++; notes.push('Weekly goal met: +' + XP.week + ' XP and a shield'); }
  }
  S.xp += xp + bonus;
  const tail = o.partial === true ? ' (ended early)' : '';
  const meta = String(o.meta || '').slice(0, 300 - tail.length) + tail;
  S.log.push(Object.assign({t:Date.now(), type, energy:e, score:o.score == null ? null : o.score, xp:xp + bonus, meta, pred:null, act:null, chance:null, bad:null, mid:''}, o.extra || {}));
  if (S.log.length > 300) S.log = S.log.slice(-300);
  const titlesEarned = earnedTitles(S).filter(id => S.titles.indexOf(id) < 0);
  titlesEarned.forEach(id => { S.titles.push(id); notes.push('[Title earned] ' + TITLES.filter(x => x.id === id)[0].n); });
  save();
  const after = {rank: rankOf(S.xp), level: levelOf(S.xp)};
  return {xp: xp + bonus, notes, titlesEarned, rankUp: after.rank > before.rank ? RANKS[after.rank].r : null, levelUp: after.level > before.level ? after.level : null};
}
export function avgScore(filter) {
  const a = app.S.log.filter(e => e.score != null && filter(e));
  return a.length ? a.reduce((s, e) => s + e.score, 0) / a.length : null;
}
