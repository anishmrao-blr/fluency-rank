// Unit tests for the game rules (spec 3): fixed XP, the two-item Daily Quest, titles,
// partial credit and the v3 migration. Boots the app through test/load.js and calls the modules.
const errors = [];
const KEY = 'fluency-rank:v2';
const {bootApp} = require('./load');
async function boot(seed) {
  const w = await bootApp({onError: m => errors.push(m), beforeParse(w) {
    w.scrollTo = () => {};
    let now = 1000; const q = []; const dead = new Set(); let id = 1;
    w.__clock = {advance(ms) { const target = now + ms; for (;;) { q.sort((a, b) => a.t - b.t); const n = q[0]; if (!n || n.t > target) break; q.shift(); now = n.t; try { n.fn(); } catch (e) { errors.push('timer: ' + e.stack); } if (n.every && !dead.has(n.id)) { n.t = now + n.every; q.push(n); } } now = target; }};
    w.performance.now = () => now;
    w.setTimeout = (fn, ms) => { const i = id++; q.push({id: i, t: now + (ms || 0), fn}); return i; };
    w.clearTimeout = i => { dead.add(i); const k = q.findIndex(x => x.id === i); if (k >= 0) q.splice(k, 1); };
    w.setInterval = (fn, ms) => { const i = id++; q.push({id: i, t: now + ms, fn, every: ms}); return i; };
    w.clearInterval = w.clearTimeout;
    w.requestAnimationFrame = fn => { const i = id++; q.push({id: i, t: now + 16, fn: () => fn(now)}); return i; };
    w.cancelAnimationFrame = w.clearTimeout;
    if (seed) w.localStorage.setItem(KEY, JSON.stringify(seed));
    w.addEventListener('error', e => errors.push('window error: ' + e.message));
  }});
  const R = w.__mod('js/rules.js'), St = w.__mod('js/state.js'), C = w.__mod('js/content.js');
  const $ = s => w.document.querySelector(s);
  const click = el => { if (!el) throw new Error('missing element'); el.dispatchEvent(new w.MouseEvent('click', {bubbles: true})); };
  const adv = ms => { for (let i = 0; i < ms / 100; i++) w.__clock.advance(100); };
  const body = () => $('#runBody').textContent;
  const tab = t => click($(`#tabs [data-v="${t}"]`));
  const rate = n => click($(`#r1 .segb[data-n="${n}"]`));
  /* a clean v3 state for each case, already rolled to today */
  const reset = o => { St.app.S = St.sanitize(Object.assign({v: 3}, o || {})); R.rollDay(); return St.app.S; };
  return {w, R, St, C, $, click, adv, body, tab, rate, reset, S: () => St.app.S};
}
let fails = 0;
function assert(c, m) { if (!c) { fails++; errors.push('ASSERT: ' + m); console.log('FAIL', m); } else console.log('ok  ', m); }
const J = x => JSON.stringify(x);
const pad = n => String(n).padStart(2, '0');
const ds = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return ds(d); };

(async () => {
  {
    const k = await boot();
    const {R, St, C, reset, S} = k;

    // fixed XP per type, each on a clean day so no bonus applies
    const want = {breath: 20, ritual: 20, read: 25, raid: 25, cold: 30, field: 60, boss: 100, reeval: 50, debrief: 10};
    assert(J(C.XP) === J({breath: 20, ritual: 20, read: 25, raid: 25, cold: 30, field: 60, boss: 100, reeval: 50, quest: 40, comeback: 25, week: 60, debrief: 10}), 'XP table matches spec 3');
    Object.keys(want).forEach(t => { reset(); const r = R.award(t, {meta: t}); assert(r.xp === want[t] && S().xp === want[t], t + ' earns ' + want[t] + ' XP'); });
    reset(); R.award('debrief', {q: 'debrief'});
    const d2 = R.award('debrief', {q: 'debrief'});
    assert(d2.xp === 0 && S().xp === 10, 'second debrief of the day earns 0 XP');
    reset(); R.award('breath', {q: 'breath', xp: 999});
    assert(S().xp === 20, 'a passed xp amount is ignored; the table decides');

    // ratings do not change XP
    reset(); const lo = R.award('read', {score: 1}).xp; reset(); const hi = R.award('read', {score: 5}).xp;
    assert(lo === 25 && hi === 25, 'read rated 1 and rated 5 both earn 25 XP');

    // one item marks the practice day, no quest bonus
    reset();
    let r = R.award('breath', {q: 'breath'});
    let s = S(); const today = s.daily.date;
    assert(r.xp === 20 && s.streak === 1 && s.lastDay === today && s.days[today].n === 1, 'one item keeps the practice day with n=1');
    assert(!s.daily.cleared && !r.notes.some(n => n.includes('Quest')), 'one item gives no quest bonus');
    const qp = R.questProgress();
    assert(qp.done === 1 && qp.total === 2 && J(qp.items.map(i => [i.id, i.ok])) === J([['breath', true], ['speak', false]]), 'questProgress shows breath done, speak open');

    // both items: +40 exactly once per day
    r = R.award('read', {q: 'read'});
    assert(r.xp === 65 && r.notes.includes('[Quest complete] Daily Quest · +40 XP'), 'second item earns 25 + quest 40 with the System note');
    assert(S().days[today].n === 2 && R.questProgress().done === 2, 'practice day records both items');
    const r2 = R.award('raid', {q: 'raid'}), r3 = R.award('breath', {q: 'breath'});
    assert(r2.xp === 25 && r3.xp === 20 && S().xp === 130, 'quest bonus paid only once per day');

    // ritual counts as breath
    reset();
    R.award('ritual', {q: 'ritual'});
    assert(S().daily.breathDone === true && S().days[S().daily.date].n === 1, 'ritual completes the breath item');
    r = R.award('cold', {q: 'cold'});
    assert(r.xp === 70, 'ritual plus a cold question completes the quest (30 + 40)');

    // no tired multiplier and no energy-based Courage
    reset({energy: 5});
    r = R.award('breath', {q: 'breath'});
    assert(r.xp === 20 && r.tired === undefined && S().stats.resilience === 0, 'energy 5 breath is 20 XP, no Courage');
    assert(C.STAT_N.resilience === 'Courage', 'resilience is labelled Courage');

    // partial credit keeps XP and marks the log
    reset();
    r = R.award('read', {q: 'read', meta: 'Vendor check-in', partial: true});
    let last = S().log[S().log.length - 1];
    assert(r.xp === 25 && last.meta === 'Vendor check-in (ended early)', 'partial earns the same XP and notes it ended early');
    R.award('raid', {meta: 'B, Foods', partial: 'yes'});
    last = S().log[S().log.length - 1];
    assert(last.meta === 'B, Foods', 'only partial === true marks the meta');

    // titles, once each
    reset();
    r = R.award('field', {q: 'field'});
    assert(J(r.titlesEarned) === J(['first-step']) && r.notes.includes('[Title earned] The One Who Spoke First'), 'first field mission earns its title');
    r = R.award('field', {q: 'field'});
    assert(J(r.titlesEarned) === J([]) && J(S().titles) === J(['first-step']), 'title not awarded twice');
    reset({xp: 1190});
    r = R.award('breath', {q: 'breath'});
    assert(r.rankUp === 'D' && J(r.titlesEarned) === J(['rank-D']) && r.notes.includes('[Title earned] Rank D Speaker'), 'reaching rank D earns Rank D Speaker');
    const six = {}; for (let i = 10; i < 16; i++) six[ago(i)] = {n: 1, e: 3};
    reset({days: six});
    r = R.award('breath', {q: 'breath'});
    assert(J(r.titlesEarned) === J(['week']) && r.notes.includes('[Title earned] Seven Days'), 'seventh practice day earns Seven Days');
    r = R.award('read', {q: 'read'});
    assert(J(r.titlesEarned) === J([]), 'Seven Days not repeated');

    // garbage titles filtered, fieldWeek dropped
    s = St.sanitize({v: 3, xp: 0, titles: ['rank-S', '<img>', 5, null, 'first-step', 'first-step', {}], fieldWeek: ago(1)});
    assert(J(s.titles) === J(['first-step', 'rank-S']), 'garbage titles filtered and deduplicated');
    assert(!('fieldWeek' in s) && s.v === 3, 'fieldWeek dropped and v is 3');
    s = St.sanitize({v: 2, xp: 0, titles: 'rank-A'});
    assert(J(s.titles) === J([]), 'non-array titles ignored');

    // weekly goal: five practice days this week gives +60 and a shield, max 2
    const mon = R.weekStr(), base = new Date(mon + 'T12:00:00'), wk = {};
    for (let i = 0; i < 7; i++) { const d = new Date(base); d.setDate(base.getDate() + i); const x = ds(d); if (x !== ds(new Date()) && Object.keys(wk).length < 4) wk[x] = {n: 1, e: 3}; }
    reset({days: wk});
    r = R.award('breath', {q: 'breath'});
    assert(r.xp === 80 && S().shields === 1 && S().weekAward === mon && r.notes.includes('Weekly goal met: +60 XP and a shield'), 'fifth practice day this week gives +60 and a shield');
    r = R.award('read', {q: 'read'});
    assert(r.xp === 65 && S().shields === 1, 'weekly bonus paid once per week');
    reset({days: wk, shields: 2});
    R.award('breath', {q: 'breath'});
    assert(S().shields === 2, 'shields stay capped at 2');

    // comeback bonus after a gap with no shield
    reset({xp: 100, streak: 5, best: 5, shields: 0, lastDay: ago(4)});
    assert(S().comeback === true && S().streak === 0, 'gap without a shield sets comeback');
    r = R.award('breath', {q: 'breath'});
    assert(r.xp === 45 && r.notes.includes('Comeback bonus: +25 XP') && S().comeback === false && S().best === 5, 'comeback bonus +25 paid once');
    reset({xp: 100, streak: 5, best: 5, shields: 0, lastDay: ago(4)});
    R.award('debrief', {q: 'debrief'});
    assert(S().comeback === true, 'a debrief alone does not use up the comeback');
  }

  /* drills: ratings, field Courage, boss Courage */
  {
    const k = await boot();
    const {$, click, adv, body, tab, rate, S} = k;
    tab('gates'); click($('[data-act="read"]')); click($('#go')); adv(150000); rate(1); click($('#sub'));
    assert(body().includes('+25 XP'), 'read rated 1 shows +25 XP in the drill');
    click($('#back'));
    tab('gates'); click($('[data-act="raid"]')); click($('#go')); for (let i = 0; i < 10; i++) click($('#plus')); adv(46000);
    assert(body().includes('+25 XP'), 'raid with 10 words still shows +25 XP');
    click($('#back'));
    tab('gates'); click($('[data-act="field"]')); click($('[data-ch="ms"][data-v="m1"]')); click($('#go')); click($('#done'));
    click($('#bd .segb[data-n="0"]')); rate(5); click($('#sub'));
    const s = S();
    assert(body().includes('+60 XP') && s.daily.speakDone === true && s.stats.resilience === 4, 'field mission counts as speak, 60 XP, Courage +4');
    assert(s.days[s.daily.date].n === 1 && !s.daily.breathDone, 'field alone is one quest item');
    click($('#back'));
  }
  {
    const k = await boot({v: 2, xp: 1500, updatedAt: 1});
    const {$, click, body, tab, rate, S} = k;
    tab('gates'); click($('[data-act="boss"]')); click($('#go'));
    for (let i = 0; i < 5; i++) click($('#done'));
    rate(2); click($('#sub'));
    assert(body().includes('+100 XP') && S().stats.resilience === 5, 'boss round is 100 XP and Courage +5');
    click($('#back'));
  }

  /* v2 migration */
  {
    const seed = {v: 2, xp: 1500, streak: 3, best: 4, shields: 1, fieldWeek: ago(2), energy: 4, log: [{t: 1, type: 'field', xp: 60, meta: 'Greet', mid: 'm1', pred: 5, act: 3, chance: 30, bad: 0}], days: {[ago(1)]: {n: 2, e: 4}}, updatedAt: 1};
    const k = await boot(seed);
    const s = k.S();
    assert(s.v === 3 && s.xp === 1500, 'v2 save migrates with xp unchanged');
    assert(J(s.titles) === J(['first-step', 'rank-D']), 'migration grants first-step and rank-D');
    assert(s.log.length === 1 && k.$('#toasts').children.length === 0 && k.$('#modal').hidden, 'migration is silent: no log entry, toast or modal');
    assert(!('fieldWeek' in s) && s.energy === 4 && s.shields === 1 && s.best === 4, 'fieldWeek dropped, energy and shields kept');
    const again = k.St.sanitize(JSON.parse(JSON.stringify(s)));
    assert(J(again.titles) === J(s.titles) && again.xp === 1500, 'v3 data round-trips through sanitize');
    const v3 = k.St.sanitize({v: 3, xp: 20000, titles: []});
    assert(J(v3.titles) === J([]), 'v3 data does not get titles back-filled');
  }

  console.log('\n' + (fails ? fails + ' FAILED' : 'ALL PASSED'));
  const real = errors.filter(e => !e.startsWith('ASSERT'));
  if (real.length) { console.log('runtime errors:'); real.forEach(e => console.log(' -', e.split('\n').slice(0, 3).join(' | '))); }
  process.exit(fails || real.length ? 1 : 0);
})();
