import {$, $$, esc, dstr, dayNum, numStr, weekStartNum} from './util.js';
import {RANKS, rankOf, levelOf, STAT_KEYS, STAT_N, TYPE_N, WPM, STALL, ANCHORS, PATTERNS, BREATH_GOALS, BREATH_ALL, MISSIONS, TITLES} from './content.js';
import {app, updateSync} from './state.js';
import {practicedThisWeek, rollDay, questProgress} from './rules.js';
import {toast, bar, emblem, ICON, sheetOpen} from './ui.js';
import {missionStats, recommendedMission} from './drills.js';
import {customDesc} from './breath.js';

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const titleBar = (t, extra) => '<header class="lt"><h1 tabindex="-1">' + esc(t) + '</h1>' + (extra || '') + '</header>';
const gh = (t, id) => '<h2 class="gh"' + (id ? ' id="' + id + '"' : '') + '>' + esc(t) + '</h2>';
const rowBtn = (act, v, name, desc, label) => '<button type="button" class="li" data-act="' + act + '"' + (v ? ' data-v="' + esc(v) + '"' : '') + ' aria-label="' + esc(label || 'Open ' + name) + '"><span class="grow"><span class="tt">' + esc(name) + '</span>' + (desc ? '<span class="ds">' + esc(desc) + '</span>' : '') + '</span>' + ICON.chev + '</button>';

/* ---------- Home ---------- */
export function weekHtml() {
  const w = weekStartNum(dayNum(dstr())), today = dayNum(dstr()), L = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], F = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  let h = '';
  for (let i = 0; i < 7; i++) {
    const d = numStr(w + i), rec = app.S.days[d], n = rec ? Math.min(2, rec.n) : 0;
    h += '<li class="wd' + (n ? ' n' + n : '') + (w + i === today ? ' today' : '') + '"><span class="trk" aria-hidden="true"><i></i></span><span class="dl" aria-hidden="true">' + L[i] + '</span><span class="sr">' + F[i] + (w + i === today ? ', today' : '') + ': ' + (n === 2 ? 'both items done' : n === 1 ? 'one item done' : 'no practice') + '</span></li>';
  }
  return '<ul class="week" aria-label="This week">' + h + '</ul>';
}
export function viewHome() {
  const qp = questProgress();
  const hint = qp.done === 2 ? 'Breathing and speaking both done today.' : qp.items[0].ok ? 'Breathing done. One speaking drill completes today.' : qp.items[1].ok ? 'Speaking done. One breathing session completes today.' : 'One breathing session and one speaking drill.';
  return '<div class="home">' + titleBar('Today', '<button type="button" class="icb" data-act="settings" aria-label="Settings">' + ICON.gear + '</button>')
    + '<section class="tide" aria-label="This week"><p class="nums">This week ' + practicedThisWeek() + ' of 5' + (app.S.best > 0 ? ' · Best run ' + app.S.best : '') + '</p>' + weekHtml() + '</section>'
    + '<p class="today-line">Today ' + qp.done + ' of ' + qp.total + '</p><p class="today-sub">' + hint + '</p>'
    + '<div class="acts"><button type="button" class="btn btn-p" data-act="session">Start daily session · 5 min</button><button type="button" class="btn btn-s" data-act="speak">I’m about to speak</button><button type="button" class="lnk" data-act="short">Low energy? Short version</button></div></div>';
}

/* ---------- Breathe (goal-first, step 3) ---------- */
export function viewBreathe() {
  const mins = app.S.breathMins || 3;
  const chips = '<div class="seg b-len" role="group" aria-label="Session length">' + [1, 3, 5].map(m => '<button type="button" class="segb" data-act="bmins" data-v="' + m + '" aria-pressed="' + (m === mins) + '"><b>' + m + ' min</b></button>').join('') + '</div>';
  const goals = BREATH_GOALS.map(g => rowBtn('goal', g.pat, g.n, g.d, 'Start ' + g.n + ': ' + PATTERNS[g.pat].n)).join('');
  const all = BREATH_ALL.map(k => {
    const P = PATTERNS[k];
    return '<button type="button" class="li" data-act="breath" data-v="' + k + '" aria-label="Open ' + esc(P.n) + '"><span class="grow"><span class="tt">' + esc(P.n) + '</span><span class="ds">' + esc(P.d) + '</span>' + (P.ev ? '<span class="ev">' + esc(P.ev) + '</span>' : '') + '</span>' + ICON.chev + '</button>';
  }).join('') + rowBtn('breath', 'custom', 'Custom pattern', customDesc(app.S.customBreath) + ' seconds', 'Open Custom pattern');
  return titleBar('Breathe')
    + chips
    + gh('Start by goal', 'bgH') + '<div class="group" role="group" aria-labelledby="bgH">' + goals + '</div>'
    + '<p class="gf">One tap starts right away for ' + mins + ' min. Turn on sound cues or the voice guide in Settings to practise with your eyes closed.</p>'
    + gh('All techniques', 'baH') + '<div class="group" role="group" aria-labelledby="baH">' + all + '</div>';
}

/* ---------- Speak ---------- */
export function courseHtml() {
  const rec = recommendedMission();
  return '<ol class="course">' + MISSIONS.map((m, i) => {
    const st = missionStats(m.id), done = st.n > 0, next = m.id === rec;
    return '<li class="' + (done ? 'done' : '') + (next ? ' next' : '') + '"><span class="buoy" aria-hidden="true"></span><span class="grow"><span class="tt">' + esc(m.t) + '</span><span class="ds">' + (next ? 'Suggested next' + (done ? ' · done ' + st.n + (st.n > 1 ? ' times' : ' time') : '') : done ? 'Done ' + st.n + (st.n > 1 ? ' times' : ' time') : 'Step ' + (i + 1)) + '</span></span></li>';
  }).join('') + '</ol>';
}
export function viewGates() {
  const challenge = rankOf(app.S.xp) >= 1;
  return titleBar('Speak')
    + gh('Drills', 'drH') + '<div class="group" role="group" aria-labelledby="drH">'
    + rowBtn('read', '', 'Read aloud', 'Words light up at your pace target. About 2 min.')
    + rowBtn('raid', '', 'Word warm-up', 'Name words from a letter and a topic. Under 1 min a round.')
    + rowBtn('cold', '', 'Practice questions', 'Answer a question you have not seen. About 1 min.')
    + (challenge ? rowBtn('boss', '', 'Challenge round', 'Five questions back to back. About 5 min.') : '')
    + '</div>'
    + gh('Real-world steps', 'rwH') + '<div class="group" role="group" aria-labelledby="rwH">' + courseHtml() + '</div>'
    + '<p class="gf">Real conversations, from small to larger. They are always optional, and you never need them to progress.</p>'
    + '<div class="stack" style="margin-top:16px"><button type="button" class="btn btn-s" data-act="field" aria-label="Open Real-world steps">Choose a real-world step</button></div>';
}

/* ---------- Progress ---------- */
export function mosaicHtml() {
  const keys = Object.keys(app.S.days).sort(), total = keys.length;
  const start = total > 0 ? Math.floor((total - 1) / 66) * 66 : 0;
  const cells = keys.slice(start, start + 66);
  let h = '';
  for (let i = 0; i < 66; i++) { const n = cells[i] ? Math.min(2, app.S.days[cells[i]].n) : 0; h += '<div class="mc' + (n ? ' n' + n : '') + '"><b>' + (start + i + 1) + '</b><i></i></div>'; }
  return '<div class="mosaic" role="img" aria-label="Practice mosaic: ' + (total - start) + ' of 66 cells filled">' + h + '</div><div class="legend" aria-hidden="true"><span><i class="n1"></i>One item</span><span><i class="n2"></i>Both items</span></div>';
}
export function roughPatch() {
  const recent = app.S.log.filter(e => e.score != null).slice(-3);
  if (recent.length < 3) return false;
  return recent.every(e => e.score <= 2 && Date.now() - e.t < 10 * 86400000);
}
export function viewProgress() {
  const ri = rankOf(app.S.xp), R = RANKS[ri], N = RANKS[ri + 1], lvl = levelOf(app.S.xp), into = app.S.xp - (lvl - 1) * 150;
  const days = Object.keys(app.S.days).length;
  const titles = TITLES.filter(t => app.S.titles.indexOf(t.id) >= 0);
  const field = app.S.log.filter(e => e.type === 'field' && e.pred != null).slice(-10);
  const items = app.S.log.slice(-12).reverse();
  let h = titleBar('Progress');
  if (roughPatch()) h += '<p class="gf" style="margin-top:12px">Your last three ratings were low. That happens to everyone. Slow your pace, keep sessions short, and if you have a speech therapist, this is a good time to check in.</p>';
  h += gh('Rank') + '<div class="group"><div class="rankcard">' + emblem(R.r) + '<div class="grow"><span class="tt">Level ' + lvl + '</span>' + bar(into / 150 * 100) + '<span class="ds num">' + into + ' of 150 XP to level ' + (lvl + 1) + '</span><span class="ds num">' + (N ? (N.xp - app.S.xp).toLocaleString() + ' XP to Rank ' + N.r : 'Top rank') + ' · ' + app.S.xp.toLocaleString() + ' XP in all</span></div></div></div>';
  h += gh('Titles') + '<div class="group">' + (titles.length ? titles.map(t => '<div class="li"><span class="tt">' + esc(t.n) + '</span></div>').join('') : '<div class="li"><span class="ds">Titles arrive at milestones, such as your first real-world step and your seventh practice day.</span></div>') + '</div>';
  h += gh('Stats') + '<div class="group">' + STAT_KEYS.map(k => { const p = app.S.stats[k] || 0; return '<div class="li stat"><span>' + STAT_N[k] + '</span>' + bar(p % 100) + '<span class="vl">Lv ' + (1 + Math.floor(p / 100)) + '</span></div>'; }).join('') + '<div class="li"><span class="grow">Reading pace target</span><span class="vl">' + WPM[app.S.rung] + ' wpm</span></div></div>';
  h += gh('Practice mosaic') + '<div class="group">' + mosaicHtml() + '</div><p class="gf">One cell per practice day, so a gap leaves no hole. ' + days + ' practice day' + (days === 1 ? '' : 's') + ' so far. In one UCL study a new routine took 66 days on average to feel automatic, and a missed day did not derail it.</p>';
  if (field.length) {
    const pa = field.reduce((s, e) => s + e.pred, 0) / field.length, aa = field.reduce((s, e) => s + e.act, 0) / field.length, badN = field.filter(e => e.bad >= 1).length;
    h += gh('Predictions and reality') + '<div class="group"><div class="li"><span class="grow">Expected anxiety, average</span><span class="vl">' + pa.toFixed(1) + ' of 10</span></div><div class="li"><span class="grow">Actual anxiety, average</span><span class="vl">' + aa.toFixed(1) + ' of 10</span></div><div class="li"><span class="grow">Went badly, partly or fully</span><span class="vl">' + badN + ' of ' + field.length + '</span></div></div><p class="gf">' + (pa - aa >= 1.5 ? 'Real conversations have been easier than you predicted. That gap is a reason to move up a step.' : (aa - pa >= 1.5 ? 'Real conversations have run harder than predicted. Spend longer on the current step.' : 'Your predictions track reality well.')) + '</p>';
  }
  h += gh('Recent sessions') + '<div class="group log">' + (items.length ? items.map(e => '<div class="li"><span class="grow"><span class="tt">' + esc(TYPE_N[e.type] || e.type) + (e.score != null ? ' · fluency ' + e.score : '') + '</span><span class="ds">' + esc(new Date(e.t).toLocaleString([], {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})) + (e.meta ? ' · ' + esc(e.meta) : '') + '</span></span><span class="vl">+' + e.xp + '</span></div>').join('') : '<div class="li"><span class="ds">Nothing logged yet. Finish a drill and it appears here.</span></div>') + '</div>';
  h += gh('For your speech therapist') + '<div class="group"><div class="sumbox"><p class="ds">A plain summary of the last 14 days to bring to a session.</p><textarea id="sum" readonly aria-label="Summary for your speech therapist"></textarea><button type="button" class="btn btn-s" data-act="copysum">Copy summary</button><p class="ds" id="summsg" role="status"></p></div></div>';
  return h;
}
export function summaryText() {
  const since = Date.now() - 14 * 86400000, L = app.S.log.filter(e => e.t >= since), sess = L.filter(e => e.type !== 'debrief');
  const days = Object.keys(app.S.days).filter(d => dayNum(d) >= dayNum(dstr()) - 13).length;
  const lines = ['Fluency Rank: last 14 days', 'Practice days: ' + days + ' of 14. Sessions: ' + sess.length + '.'];
  const sc = L.filter(e => e.score != null);
  lines.push('Self-rated fluency out of 5: ' + (sc.length ? (sc.reduce((s, e) => s + e.score, 0) / sc.length).toFixed(1) + ' average, n=' + sc.length : 'not enough data') + '.');
  lines.push('Reading pace target: ' + WPM[app.S.rung] + ' wpm. Hard sounds set by me: ' + (app.S.hard || 'none') + '. Letters needing repeats: ' + (Object.keys(app.S.weak).join(', ') || 'none') + '.');
  const f = L.filter(e => e.type === 'field' && e.pred != null);
  lines.push('Real-world steps: ' + f.length + (f.length ? '. Predicted anxiety ' + (f.reduce((s, e) => s + e.pred, 0) / f.length).toFixed(1) + ', actual ' + (f.reduce((s, e) => s + e.act, 0) / f.length).toFixed(1) + ' (out of 10). Went badly in ' + f.filter(e => e.bad >= 1).length + '.' : '.'));
  const notes = L.filter(e => e.type === 'debrief' && e.meta).slice(-5).map(e => '- ' + e.meta);
  if (notes.length) lines.push('Debrief notes:', ...notes);
  return lines.join('\n');
}

/* ---------- Settings sheet (absorbs the old Guide) ---------- */
const toggle = (id, label, on) => '<label class="li tg"><span class="grow">' + esc(label) + '</span><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '></label>';
export function settingsHtml() {
  return gh('Practice time', 'ptH') + '<div class="group" role="group" aria-labelledby="ptH">' + ANCHORS.map(a => '<button type="button" class="li" data-act="plan" data-v="' + esc(a) + '" aria-pressed="' + (app.S.plan.anchor === a) + '"><span class="grow tt">' + esc(cap(a)) + '</span><svg class="ic ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>').join('') + '</div><p class="gf">Tie practice to something you already do each day. This app cannot send reminders yet, so set a phone alarm for the same moment.</p>'
    + gh('Your words') + '<div class="group"><div class="field"><label for="hard">Sounds you find hard (letters)</label><input type="text" id="hard" maxlength="12" placeholder="For example B P S T M" value="' + esc(app.S.hard) + '" autocomplete="off"></div><div class="field"><label for="opener">Your opening line</label><textarea id="opener" maxlength="200">' + esc(app.S.opener) + '</textarea></div></div><p class="gf">Word warm-up picks your hard sounds about half the time. I’m about to speak uses your opening line.</p>'
    + gh('Practice options') + '<div class="group">' + toggle('skel', 'Show the answer outline in practice questions', app.S.showSkeleton) + toggle('hclk', 'Hide countdown numbers', app.S.hideClock) + toggle('snds', 'Sound cues for breathing and timers', app.S.sound) + toggle('voice', 'Voice guide for breathing', app.S.voice) + '</div>'
    + gh('Backup') + '<div class="group"><div class="field"><p class="ds" id="sync" role="status"></p><div class="row"><button type="button" class="btn btn-s btn-sm" data-act="export">Export backup</button><button type="button" class="btn btn-s btn-sm" data-act="importFile">Import backup</button></div><input type="file" id="bkfile" accept="application/json,.json" hidden><p class="ds" id="bkmsg" role="status"></p></div><details class="bk-raw"><summary>Paste or copy backup text</summary><div class="field"><label for="bk">Backup text</label><textarea id="bk"></textarea><div class="row"><button type="button" class="btn btn-s btn-sm" data-act="copy">Copy text</button><button type="button" class="btn btn-s btn-sm" data-act="import">Load pasted backup</button></div></div></details></div><p class="gf">Progress stays on this device. Export a file to move it to another device, or import a saved backup.</p>'
    + '<div class="group" style="margin-top:16px"><button type="button" class="li" data-act="reset" id="rst"><span class="grow tt" style="color:var(--tint)">Reset progress</span></button></div>'
    + gh('Help') + '<div class="group help">'
    + '<div class="li"><span class="grow"><span class="tt">Practice, not therapy</span><span class="ds">This app gives you somewhere to practise breathing and speaking techniques every day. It does not treat stammering or anxiety, and it cannot promise your stammer will go away. A speech therapist can assess you and tell you which techniques fit you.</span></span></div>'
    + '<div class="li"><span class="grow"><span class="tt">Finding a speech therapist</span><span class="ds">Ask your doctor for a referral to a speech and language therapist (in the US, a speech-language pathologist). National stammering organisations keep directories and support groups: STAMMA in the UK (<a href="https://stamma.org" target="_blank" rel="noopener">stamma.org</a>), the National Stuttering Association (<a href="https://westutter.org" target="_blank" rel="noopener">westutter.org</a>) and ASHA ProFind (<a href="https://www.asha.org/profind/" target="_blank" rel="noopener">asha.org/profind</a>) in the US, and The Indian Stammering Association in India.</span></span></div>'
    + '<div class="li"><span class="grow"><span class="tt">Techniques in short</span><span class="ds">Speak on a breath: breathe in quietly and begin as you breathe out. Easy onset: start the first sound softly, like a sigh turning into a word. Slow rate: stretch syllables a little. Phrase and pause: speak in short chunks. Pause, do not dodge: a silent pause is fine, and you do not need to swap a word to avoid a sound.</span></span></div>'
    + '<div class="li"><span class="grow"><span class="tt">Answering on the spot</span><span class="ds">Position first (“My recommendation is…”), then one reason, then what would change your mind. To buy a moment honestly: ' + STALL.slice(0, 3).map(s => '“' + esc(s) + '”').join(', ') + '.</span></span></div>'
    + '</div>';
}
export function renderSheet() {
  $('#sheetBody').innerHTML = settingsHtml();
  $('#bk').value = JSON.stringify(app.S);
  updateSync();
}

const VIEWS = {home:viewHome, breathe:viewBreathe, gates:viewGates, progress:viewProgress};
export function renderAll() {
  try {
    rollDay();
    if (!VIEWS[app.tab]) app.tab = 'home';
    $('#view').innerHTML = VIEWS[app.tab]();
    $$('#tabs button').forEach(b => { if (b.getAttribute('data-v') === app.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const sm = $('#sum'); if (sm) sm.value = summaryText();
    if (sheetOpen()) renderSheet();
    updateSync();
  } catch (e) { toast('Something went wrong drawing this screen. Your progress is saved.'); }
}
