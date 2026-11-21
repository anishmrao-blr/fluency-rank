import {dstr, dayNum, numStr, weekStartNum} from './util.js';
import {RANKS, rankOf, levelOf, QUESTS} from './content.js';
import {app, blankDaily, save} from './state.js';

export const doneCount = () => QUESTS.filter(q => (app.S.daily[q.id] || 0) >= q.need).length;
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

/* o: {xp, pts, q, qn, score, meta, extra}. Session XP gets the tired bonus, bonuses do not. */
export function award(type, o) {
  rollDay();
  const before = {rank: rankOf(app.S.xp), level: levelOf(app.S.xp)};
  const e = app.S.energy, tired = e >= 4, notes = [];
  const xp = Math.round((o.xp || 0) * (tired ? 1.5 : 1));
  let bonus = 0;
  Object.keys(o.pts || {}).forEach(k => { app.S.stats[k] = (app.S.stats[k] || 0) + o.pts[k]; });
  if (e >= 3) app.S.stats.resilience += tired ? 5 : 2;
  if (o.q) app.S.daily[o.q] = (app.S.daily[o.q] || 0) + (o.qn || 1);
  const n = doneCount();
  if (n >= 1 || type === 'field') {
    const t = app.S.daily.date, rec = app.S.days[t] || {n:0, e:0};
    app.S.days[t] = {n: Math.max(rec.n, n, 1), e: Math.max(rec.e, e)};
    const keys = Object.keys(app.S.days).sort();
    if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(k => { delete app.S.days[k]; });
    if (!app.S.started) app.S.started = t;
    if (app.S.lastDay !== t) {
      const gap = app.S.lastDay ? dayNum(t) - dayNum(app.S.lastDay) : null;
      app.S.streak = gap === 1 ? app.S.streak + 1 : 1;
      app.S.best = Math.max(app.S.best, app.S.streak);
      app.S.lastDay = t;
    }
    if (app.S.comeback) { app.S.comeback = false; bonus += 25; notes.push('Comeback bonus: +25 XP'); }
    if (n >= 2 && !app.S.daily.solid) { app.S.daily.solid = true; bonus += 15; notes.push('Solid day: +15 XP'); }
    if (n >= QUESTS.length && !app.S.daily.cleared) { app.S.daily.cleared = true; bonus += 25; notes.push('Full clear: +25 XP'); }
    const ws = weekStr();
    if (practicedThisWeek() >= 5 && app.S.weekAward !== ws) { app.S.weekAward = ws; bonus += 60; if (app.S.shields < 2) app.S.shields++; notes.push('Weekly goal met: +60 XP and a shield'); }
    if (type === 'field' && app.S.fieldWeek !== ws) { app.S.fieldWeek = ws; bonus += 40; notes.push('First field mission this week: +40 XP'); }
  }
  app.S.xp += xp + bonus;
  app.S.log.push(Object.assign({t:Date.now(), type, energy:e, score:o.score == null ? null : o.score, xp:xp + bonus, meta:String(o.meta || '').slice(0, 300), pred:null, act:null, chance:null, bad:null, mid:''}, o.extra || {}));
  if (app.S.log.length > 300) app.S.log = app.S.log.slice(-300);
  save();
  const after = {rank: rankOf(app.S.xp), level: levelOf(app.S.xp)};
  return {xp: xp + bonus, tired, notes, rankUp: after.rank > before.rank ? RANKS[after.rank].r : null, levelUp: after.level > before.level ? after.level : null};
}
export function avgScore(filter) {
  const a = app.S.log.filter(e => e.score != null && filter(e));
  return a.length ? a.reduce((s, e) => s + e.score, 0) / a.length : null;
}
