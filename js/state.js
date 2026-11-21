import {$, num, int, isDate} from './util.js';
import {STAT_KEYS, TYPE_N, WPM, ANCHORS, DEFAULT_OPENER, TITLES} from './content.js';
import {rollDay, earnedTitles} from './rules.js';
import {renderAll} from './views.js';

export const app = {S: null, storageOk: true, noticeText: '', running: false, tab: 'home'};
export const KEY = 'fluency-rank:v2';
export const blankDaily = () => ({date:'', breath:0, read:0, raid:0, cold:0, ritual:0, debrief:0, field:0, breathDone:false, speakDone:false, solid:false, cleared:false, twist:false});
export const fresh = () => ({
  v:3, xp:0, stats:{breath:0, pace:0, retrieval:0, composure:0, resilience:0},
  streak:0, best:0, shields:0, lastDay:null, energy:3,
  hard:'', opener:DEFAULT_OPENER, showSkeleton:true, hideClock:false, sound:false, voice:false,
  breathMins:3, customBreath:{inS:4, hold1:0, outS:6, hold2:0},
  rung:2, up:0, down:0, coldSecs:60, bosses:0,
  plan:{anchor:'', mins:10}, planBonus:false, started:'', days:{},
  weekAward:'', weak:{}, comeback:false, titles:[],
  daily:blankDaily(), log:[], updatedAt:0
});

/* Every value read from storage, the account database or a pasted backup passes through here.
   v2 data migrates to v3: titles are filled from what was already earned, fieldWeek is dropped,
   and XP is never recalculated. */
export function sanitize(o) {
  const s = fresh();
  if (!o || typeof o !== 'object') return s;
  s.xp = int(o.xp, 0, 0, 1e7);
  STAT_KEYS.forEach(k => { s.stats[k] = int(o.stats && o.stats[k], 0, 0, 1e6); });
  s.streak = int(o.streak, 0, 0, 1e5);
  s.best = Math.max(s.streak, int(o.best, 0, 0, 1e5));
  s.shields = int(o.shields, 0, 0, 2);
  s.lastDay = isDate(o.lastDay) ? o.lastDay : null;
  s.energy = int(o.energy, 3, 1, 5);
  s.hard = String(o.hard || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12);
  s.opener = String(o.opener || '').slice(0, 200).trim() || DEFAULT_OPENER;
  s.showSkeleton = o.showSkeleton !== false;
  s.hideClock = o.hideClock === true;
  s.sound = o.sound === true;
  s.voice = o.voice === true;
  s.breathMins = [1, 3, 5].indexOf(Number(o.breathMins)) >= 0 ? Number(o.breathMins) : 3;
  const cb = o.customBreath || {};
  s.customBreath = {inS:int(cb.inS, 4, 2, 8), hold1:int(cb.hold1, 0, 0, 8), outS:int(cb.outS, 6, 2, 12), hold2:int(cb.hold2, 0, 0, 8)};
  s.rung = int(o.rung, 2, 0, WPM.length - 1);
  s.up = int(o.up, 0, 0, 5); s.down = int(o.down, 0, 0, 5);
  s.coldSecs = [45, 60, 90].indexOf(Number(o.coldSecs)) >= 0 ? Number(o.coldSecs) : 60;
  s.bosses = int(o.bosses, 0, 0, 1e4);
  const p = o.plan || {};
  s.plan = {anchor: ANCHORS.indexOf(p.anchor) >= 0 ? p.anchor : '', mins: p.mins === 3 ? 3 : 10};
  s.planBonus = o.planBonus === true;
  s.started = isDate(o.started) ? o.started : '';
  if (o.days && typeof o.days === 'object') {
    Object.keys(o.days).filter(isDate).sort().slice(-400).forEach(d => {
      const v = o.days[d] || {};
      s.days[d] = {n: int(v.n, 1, 1, 4), e: int(v.e, 3, 1, 5)};
    });
  }
  s.weekAward = isDate(o.weekAward) ? o.weekAward : '';
  if (o.weak && typeof o.weak === 'object') {
    Object.keys(o.weak).filter(k => /^[A-Z]$/.test(k)).forEach(k => { const n = int(o.weak[k], 0, 0, 5); if (n > 0) s.weak[k] = n; });
  }
  s.comeback = o.comeback === true;
  const d = o.daily || {};
  s.daily = blankDaily();
  s.daily.date = isDate(d.date) ? d.date : '';
  ['breath', 'read', 'raid', 'cold', 'ritual', 'debrief', 'field'].forEach(k => { s.daily[k] = int(d[k], 0, 0, 99); });
  ['solid', 'cleared', 'twist'].forEach(k => { s.daily[k] = d[k] === true; });
  s.daily.breathDone = d.breathDone === true || s.daily.breath > 0 || s.daily.ritual > 0;
  s.daily.speakDone = d.speakDone === true || ['read', 'raid', 'cold', 'field'].some(k => s.daily[k] > 0);
  s.log = (Array.isArray(o.log) ? o.log : []).slice(-300).filter(e => e && typeof e === 'object').map(e => ({
    t: num(e.t, 0, 0, 4e12),
    type: TYPE_N[e.type] ? e.type : 'cold',
    energy: int(e.energy, 3, 1, 5),
    score: e.score == null ? null : int(e.score, 3, 1, 5),
    xp: int(e.xp, 0, 0, 5000),
    meta: String(e.meta || '').slice(0, 300),
    pred: e.pred == null ? null : int(e.pred, 0, 0, 10),
    act: e.act == null ? null : int(e.act, 0, 0, 10),
    chance: e.chance == null ? null : int(e.chance, 0, 0, 100),
    bad: e.bad == null ? null : int(e.bad, 0, 0, 2),
    mid: typeof e.mid === 'string' && /^m\d$/.test(e.mid) ? e.mid : ''
  }));
  const had = Array.isArray(o.titles) ? o.titles : [], migrated = Number(o.v) >= 3 ? [] : earnedTitles(s);
  s.titles = TITLES.map(t => t.id).filter(id => had.indexOf(id) >= 0 || migrated.indexOf(id) >= 0);
  S_updated(s, o);
  return s;
}
export function S_updated(s, o) { s.updatedAt = num(o.updatedAt, 0, 0, 4e12); }

app.S = fresh();
(function loadLocal() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { app.storageOk = false; return; }
  if (!raw) return;
  try { app.S = sanitize(JSON.parse(raw)); }
  catch (e) {
    try { localStorage.setItem(KEY + ':corrupt', raw); } catch (_) { /* nothing more to do */ }
    app.noticeText = 'Your saved data could not be read, so this is a fresh start. The old data was kept aside and is not lost.';
  }
})();

let saveTimer = null, dbRef = null, writing = false, dirty = false;
export function updateSync() {
  const el = $('#sync');
  if (el) el.textContent = dbRef ? 'Synced to your account' : app.storageOk ? 'Saved on this device' : 'Not saved: use Backup in Settings';
  const n = $('#notice');
  const msg = app.noticeText || (!app.storageOk && !dbRef ? 'Progress cannot be saved in this view. Copy a backup from Settings before you leave.' : '');
  n.hidden = !msg; n.textContent = msg;
}
export function save() {
  app.S.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(app.S)); app.storageOk = true; } catch (e) { app.storageOk = false; }
  dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(flushDb, 800);
  updateSync();
}
export function flushDb() {
  if (!dbRef || writing || !dirty) return;
  writing = true; dirty = false;
  Promise.resolve().then(() => dbRef.set(JSON.parse(JSON.stringify(app.S)))).catch(() => {}).then(() => { writing = false; if (dirty) saveTimer = setTimeout(flushDb, 800); });
}
export function applyRemote(remote, tries) {
  if (app.running && tries < 40) { setTimeout(() => applyRemote(remote, tries + 1), 3000); return; }
  if (app.running) return;
  app.S = remote; rollDay();
  try { localStorage.setItem(KEY, JSON.stringify(app.S)); } catch (e) { /* account copy still holds it */ }
  renderAll();
}
export function initDb() {
  try {
    if (!window.claude || !window.claude.use) return;
    Promise.all([window.claude.use('db'), window.claude.use('user')]).then(r => {
      const db = r[0], user = r[1];
      if (!db || !user) return null;
      return Promise.resolve(user.id()).then(id => {
        if (!id) return null;
        const ref = db.doc('data/users/' + id + '/profile');
        return ref.get().then(snap => {
          dbRef = ref; updateSync();
          if (snap.exists) {
            const remote = sanitize(snap.data());
            if (remote.updatedAt > app.S.updatedAt) { applyRemote(remote, 0); return; }
          }
          if (app.S.updatedAt > 0) { dirty = true; flushDb(); }
        });
      });
    }).catch(() => {});
  } catch (e) { /* account sync is optional */ }
}
