import {$, $$, esc, dstr, dayNum, numStr, weekStartNum} from './util.js';
import {RANKS, rankOf, levelOf, STAT_KEYS, STAT_N, TYPE_N, WPM, STALL, ANCHORS, PATTERNS, BREATH_GOALS, BREATH_ALL, MISSIONS, TITLES, CONTEXTS} from './content.js';
import {app, updateSync} from './state.js';
import {practicedThisWeek, rollDay, questProgress, generalizationPlan} from './rules.js';
import {toast, bar, emblem, ICON, sheetOpen} from './ui.js';
import {missionStats, recommendedMission} from './drills.js';
import {customDesc} from './breath.js';
import {storageStats, fmtBytes, getClip, playerHtml, wirePlayer, measuresHtml} from './recorder.js';

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const titleBar = (t, extra) => '<header class="lt"><h1 tabindex="-1">' + esc(t) + '</h1>' + (extra || '') + '</header>';
const gh = (t, id) => '<h2 class="gh"' + (id ? ' id="' + id + '"' : '') + '>' + esc(t) + '</h2>';
const rowBtn = (act, v, name, desc, label) => '<button type="button" class="li" data-act="' + act + '"' + (v ? ' data-v="' + esc(v) + '"' : '') + ' aria-label="' + esc(label || 'Open ' + name) + '"><span class="grow"><span class="tt">' + esc(name) + '</span>' + (desc ? '<span class="ds">' + esc(desc) + '</span>' : '') + '</span>' + ICON.chev + '</button>';

/* ---------- Home ---------- */
export function weekHtml() {
  const w = weekStartNum(dayNum(dstr())), today = dayNum(dstr()), L = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], F = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const chk = '<svg class="wd-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.5 11.5 12.5 4.5"/></svg>';
  const half = '<svg class="wd-ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3a5 5 0 0 1 0 10z" fill="currentColor" stroke="none"/></svg>';
  const dot = '<svg class="wd-ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none"/></svg>';
  let h = '';
  for (let i = 0; i < 7; i++) {
    const d = numStr(w + i), rec = app.S.days[d], n = rec ? Math.min(2, rec.n) : 0, isToday = w + i === today;
    const icon = n === 2 ? chk : n === 1 ? half : dot;
    h += '<li class="wd' + (n ? ' n' + n : '') + (isToday ? ' today' : '') + '"><span class="trk" aria-hidden="true"><i></i>' + icon + '</span><span class="dl" aria-hidden="true">' + L[i] + '</span><span class="sr">' + F[i] + (isToday ? ', today' : '') + ': ' + (n === 2 ? 'both items done' : n === 1 ? 'one item done' : 'no practice') + '</span></li>';
  }
  return '<ul class="week" aria-label="This week">' + h + '</ul>';
}
export function isReminderDue(now) {
  const r = app.S.reminder;
  if (!r || !r.on) return false;
  if (questProgress().done >= 2) return false;
  const d = now || new Date();
  const monIdx = (d.getDay() + 6) % 7; // 0=Mon..6=Sun
  if ((r.days || []).indexOf(monIdx) < 0) return false;
  const minsNow = d.getHours() * 60 + d.getMinutes();
  return minsNow >= (r.hour * 60 + r.min);
}
const CARD_ART = {
  hero:'<svg class="card-art" viewBox="0 0 120 120" aria-hidden="true"><circle cx="88" cy="34" r="46" stroke="currentColor" stroke-width="1.2" opacity=".22"/><circle cx="88" cy="34" r="30" stroke="currentColor" stroke-width="1.4" opacity=".32"/><circle cx="88" cy="34" r="14" fill="currentColor" opacity=".24"/></svg>',
  calm:'<svg class="card-art" viewBox="0 0 120 120" aria-hidden="true"><path d="M16 54c16-14 32-14 48 0s32 14 48 0" stroke="currentColor" stroke-width="2" opacity=".34"/><path d="M16 74c16-14 32-14 48 0s32 14 48 0" stroke="currentColor" stroke-width="1.6" opacity=".24"/><circle cx="92" cy="28" r="16" fill="currentColor" opacity=".18"/></svg>',
  speak:'<svg class="card-art" viewBox="0 0 120 120" aria-hidden="true"><circle cx="88" cy="40" r="34" stroke="currentColor" stroke-width="1.4" stroke-dasharray="4 6" opacity=".34"/><circle cx="88" cy="40" r="20" stroke="currentColor" stroke-width="1.8" opacity=".42"/><circle cx="88" cy="40" r="8" fill="currentColor" opacity=".35"/></svg>',
  focus:'<svg class="card-art" viewBox="0 0 120 120" aria-hidden="true"><rect x="52" y="14" width="54" height="54" rx="14" stroke="currentColor" stroke-width="1.5" opacity=".34"/><rect x="64" y="26" width="30" height="30" rx="8" stroke="currentColor" stroke-width="1.5" opacity=".44"/><circle cx="79" cy="41" r="5" fill="currentColor" opacity=".45"/></svg>',
  wind:'<svg class="card-art" viewBox="0 0 120 120" aria-hidden="true"><path d="M88 18a26 26 0 1 0 18 44 20 20 0 1 1-18-44z" fill="currentColor" opacity=".3"/><circle cx="48" cy="30" r="2.2" fill="currentColor" opacity=".45"/><circle cx="32" cy="48" r="1.6" fill="currentColor" opacity=".35"/></svg>',
  studio:'<svg class="card-art" viewBox="0 0 120 120" aria-hidden="true"><rect x="64" y="22" width="6" height="34" rx="3" fill="currentColor" opacity=".28"/><rect x="76" y="14" width="6" height="50" rx="3" fill="currentColor" opacity=".38"/><rect x="88" y="26" width="6" height="26" rx="3" fill="currentColor" opacity=".28"/><rect x="100" y="18" width="6" height="42" rx="3" fill="currentColor" opacity=".22"/></svg>'
};

export function viewHome() {
  const qp = questProgress();
  const due = isReminderDue();
  const hint = qp.done === 2 ? 'Both done today.' : qp.items[0].ok ? '1 drill left today · +40 XP' : qp.items[1].ok ? '1 breath left today · +40 XP' : (due ? 'Time for today’s 5-min session.' : '1 min breath + 1 drill.');
  return '<div class="home">' + titleBar('Today', '<button type="button" class="icb" data-act="settings" aria-label="Settings">' + ICON.gear + '</button>')
    + '<section class="tide-inline" aria-label="This week"><p class="nums">This week ' + practicedThisWeek() + ' of 5' + (app.S.best > 0 ? ' · Best run ' + app.S.best : '') + '</p>' + weekHtml() + '</section>'
    + '<section class="pcard hero-card mesh-hero" aria-label="Daily session">'
    + CARD_ART.hero
    + '<span class="pc-pill' + (due ? ' mint' : '') + '">' + (due ? 'Due today · ' : '') + 'Today ' + qp.done + ' of ' + qp.total + ' · 5 min</span>'
    + '<h2 class="pc-title">Daily voice session</h2>'
    + '<p class="pc-sub">' + hint + '</p>'
    + '<div class="goal-bar" aria-hidden="true"><i class="' + (qp.done >= 1 ? 'on' : '') + '"></i><i class="' + (qp.done >= 2 ? 'on' : '') + '"></i></div>'
    + '<button type="button" class="pc-cta" data-act="session">Start daily session · 5 min</button>'
    + '</section>'
    + '<section class="pcard relief-card mesh-speak" aria-label="Pre-call reset">'
    + CARD_ART.speak
    + '<span class="pc-pill">90 seconds · Pre-call</span>'
    + '<p class="pc-sub">3 sighs + say your opening line aloud.</p>'
    + '<button type="button" class="pc-cta ghost" data-act="speak">I’m about to speak</button>'
    + '</section>'
    + '<div class="home-chips">'
    + '<button type="button" class="chip-card" data-act="short">Low energy? Short version</button>'
    + (!app.S.proofDone ? '<button type="button" class="chip-card accent" data-act="proof">3-min voice proof</button>' : '')
    + '</div></div>';
}

/* ---------- Breathe (State-Mapped Atmospheric Mesh 2x2 Goal Cards) ---------- */
const GOAL_MEDIA = {
  calm:{cls:'mesh-calm', art:'calm', tag:'Cyclic sigh'},
  speak:{cls:'mesh-speak', art:'speak', tag:'Voice exhale'},
  focus:{cls:'mesh-focus', art:'focus', tag:'Box 4·4·4·4'},
  wind:{cls:'mesh-wind', art:'wind', tag:'Extended 4·8'}
};
export function viewBreathe() {
  const mins = app.S.breathMins || 3;
  const chips = '<div class="seg b-len" role="group" aria-label="Session length">' + [1, 3, 5].map(m => '<button type="button" class="segb" data-act="bmins" data-v="' + m + '" aria-pressed="' + (m === mins) + '"><b>' + m + ' min</b></button>').join('') + '</div>';
  const goals = BREATH_GOALS.map(g => {
    const med = GOAL_MEDIA[g.id] || GOAL_MEDIA.calm;
    return '<button type="button" class="pcard goal-card ' + med.cls + '" data-act="goal" data-v="' + esc(g.pat) + '" aria-label="Start ' + esc(g.n) + ': ' + esc(PATTERNS[g.pat].n) + '">'
      + (CARD_ART[med.art] || '')
      + '<span class="pc-pill">' + esc(med.tag) + '</span>'
      + '<span class="gc-name">' + esc(g.n) + '</span>'
      + '<span class="gc-sub">' + esc(PATTERNS[g.pat].n) + '</span>'
      + '</button>';
  }).join('');
  const all = BREATH_ALL.map(k => {
    const P = PATTERNS[k];
    return '<button type="button" class="li" data-act="breath" data-v="' + k + '" aria-label="Open ' + esc(P.n) + '"><span class="grow"><span class="tt">' + esc(P.n) + '</span><span class="ds">' + esc(P.d) + '</span>' + (P.ev ? '<span class="ev">' + esc(P.ev) + '</span>' : '') + '</span>' + ICON.chev + '</button>';
  }).join('') + rowBtn('breath', 'custom', 'Custom pattern', customDesc(app.S.customBreath) + ' seconds', 'Open Custom pattern');
  return titleBar('Breathe')
    + chips
    + '<div class="goal-grid" role="group" aria-label="Start by goal">' + goals + '</div>'
    + '<details class="clean-disc"><summary>All techniques &amp; custom</summary><div class="group" role="group" aria-label="All techniques">' + all + '</div></details>';
}

/* ---------- Speak (Visual Studio Hero + 2-Col Drill Cards + Stepping Stones) ---------- */
export function courseHtml() {
  const rec = recommendedMission();
  return '<ol class="course">' + MISSIONS.map((m, i) => {
    const st = missionStats(m.id), done = st.n > 0, next = m.id === rec;
    return '<li class="' + (done ? 'done' : '') + (next ? ' next' : '') + '"><span class="buoy" aria-hidden="true"></span><span class="grow"><span class="tt">' + esc(m.t) + '</span><span class="ds">' + (next ? 'Suggested next' + (done ? ' · done ' + st.n + (st.n > 1 ? ' times' : ' time') : '') : done ? 'Done ' + st.n + (st.n > 1 ? ' times' : ' time') : 'Step ' + (i + 1)) + '</span></span></li>';
  }).join('') + '</ol>';
}
export function viewGates() {
  const challenge = rankOf(app.S.xp) >= 1;
  const doneSteps = MISSIONS.filter(m => missionStats(m.id).n > 0).length;
  const recId = recommendedMission(), recM = MISSIONS.find(m => m.id === recId) || MISSIONS[0];
  return titleBar('Speak')
    + '<div class="speak-grid" role="group" aria-label="Drills">'
    + '<button type="button" class="pcard drill-hero mesh-studio" data-act="read" aria-label="Open Read aloud">'
    + CARD_ART.studio
    + '<span class="pc-pill">' + WPM[app.S.rung] + ' wpm · 2 min</span>'
    + '<span class="pc-title">Read aloud</span>'
    + '<span class="pc-sub">Soft starts + live recording</span>'
    + '<span class="wave-mini" aria-hidden="true"><i style="height:36%"></i><i style="height:68%"></i><i style="height:92%"></i><i style="height:52%"></i><i style="height:82%"></i><i style="height:40%"></i><i style="height:96%"></i><i style="height:62%"></i><i style="height:34%"></i><i style="height:76%"></i><i style="height:52%"></i><i style="height:86%"></i></span>'
    + '</button>'
    + '<div class="drill-pair">'
    + '<button type="button" class="dcard" data-act="raid" aria-label="Open Word warm-up"><span class="dicon warm" aria-hidden="true">Aa</span><span class="tt">Word warm-up</span><span class="ds">45 s · Word flow</span></button>'
    + '<button type="button" class="dcard" data-act="cold" aria-label="Open Practice questions"><span class="dicon cool" aria-hidden="true">“ ”</span><span class="tt">Practice questions</span><span class="ds">60 s · On the spot</span></button>'
    + '</div>'
    + (challenge ? '<button type="button" class="dcard full" data-act="boss" aria-label="Open Challenge round"><span class="dicon dusk" aria-hidden="true">5×</span><span class="grow"><span class="tt">Challenge round</span><span class="ds">5 questions · 5 min</span></span>' + ICON.chev + '</button>' : '')
    + '</div>'
    + '<div class="step-summary">'
    + '<div class="ss-head"><span class="cap">Real-world steps · ' + doneSteps + ' of ' + MISSIONS.length + '</span><span class="cap">Optional</span></div>'
    + '<strong class="tt">Next: ' + esc(recM.t) + '</strong>'
    + bar(doneSteps / MISSIONS.length * 100)
    + '<button type="button" class="btn btn-p btn-sm" data-act="field" aria-label="Open Real-world steps">Choose a real-world step</button>'
    + '</div>'
    + '<details class="clean-disc"><summary>All ' + MISSIONS.length + ' real-world steps</summary><div class="group">' + courseHtml() + '</div></details>';
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
  const doneSteps = MISSIONS.filter(m => missionStats(m.id).n > 0).length;
  let h = titleBar('Progress');
  if (roughPatch()) h += '<p class="gf" style="margin-top:12px">Your last three ratings were low. That happens to everyone. Slow your pace, keep sessions short, and if you have a speech therapist, this is a good time to check in.</p>';
  h += '<div class="group rank-banner"><div class="rankcard">' + emblem(R.r) + '<div class="grow"><span class="tt">Level ' + lvl + '</span>' + bar(into / 150 * 100) + '<span class="ds num">' + into + ' of 150 XP to level ' + (lvl + 1) + '</span><span class="ds num">' + (N ? (N.xp - app.S.xp).toLocaleString() + ' XP to Rank ' + N.r : 'Top rank') + ' · ' + app.S.xp.toLocaleString() + ' XP in all</span></div></div></div>';
  let insight = 'Your first 5-minute session starts your weekly tide and pace trend.';
  if (app.S.proofColdRate != null && app.S.proofPacedRate != null && app.S.proofPacedRate > app.S.proofColdRate) {
    insight = 'After 2 minutes of breathing, your baseline fluency rose from ' + app.S.proofColdRate + ' to ' + app.S.proofPacedRate + ' of 5.';
  } else if (field.length) {
    const pa = field.reduce((s, e) => s + e.pred, 0) / field.length, aa = field.reduce((s, e) => s + e.act, 0) / field.length;
    if (pa - aa >= 1) insight = 'Real conversations ran easier than you expected by ' + (pa - aa).toFixed(1) + ' points.';
  } else if (practicedThisWeek() >= 3) {
    insight = 'You practised ' + practicedThisWeek() + ' days this week. Short, steady sessions build the habit.';
  } else if (days > 0) {
    insight = days + ' practice day' + (days === 1 ? '' : 's') + ' logged so far. Every single day counts.';
  }
  const plan = generalizationPlan(app.S);
  h += '<div class="insight-card"><span class="insight-k">Your top insight</span><p class="insight-v">' + esc(insight) + '</p></div>';
  h += '<div class="journey-card">'
    + '<div class="j-head"><span class="insight-k">Your adaptive journey</span><span class="j-trend">' + esc(plan.trend) + '</span></div>'
    + '<ol class="j-ladder" aria-label="Generalization ladder">'
    + plan.stages.map((st, idx) => '<li class="' + (idx < plan.stage ? 'done' : idx === plan.stage ? 'now' : '') + '"><i>' + (idx + 1) + '</i><span>' + esc(st) + '</span></li>').join('')
    + '</ol>'
    + '<p class="ds">' + esc(plan.summary) + '</p>'
    + '<button type="button" class="btn btn-s btn-sm" data-act="nextStep" data-v="' + esc(plan.next.act + ':' + (plan.next.val || '')) + '">' + esc(plan.next.label) + '</button>'
    + '</div>';
  h += '<div class="kpi-grid">'
    + '<div class="kpi-card"><span class="cap">Practice days</span><b class="kpi-val num">' + days + '</b></div>'
    + '<div class="kpi-card"><span class="cap">This week</span><b class="kpi-val num">' + practicedThisWeek() + ' of 5</b></div>'
    + '<div class="kpi-card"><span class="cap">Real steps</span><b class="kpi-val num">' + doneSteps + ' of ' + MISSIONS.length + '</b></div>'
    + '<div class="kpi-card"><span class="cap">Pace target</span><b class="kpi-val num">' + WPM[app.S.rung] + ' wpm</b></div>'
    + '</div>';
  h += gh('Weekly activity') + '<div class="group"><div class="sumbox">' + weekHtml() + '</div></div>';
  h += gh('Titles') + '<div class="group">' + (titles.length ? titles.map(t => '<div class="li"><span class="tt">' + esc(t.n) + '</span></div>').join('') : '<div class="li"><span class="ds">Titles arrive at milestones, such as your first real-world step and your seventh practice day.</span></div>') + '</div>';
  h += gh('Stats') + '<div class="group">' + STAT_KEYS.map(k => { const p = app.S.stats[k] || 0; return '<div class="li stat"><span>' + STAT_N[k] + '</span>' + bar(p % 100) + '<span class="vl">Lv ' + (1 + Math.floor(p / 100)) + '</span></div>'; }).join('') + '<div class="li"><span class="grow">Reading pace target</span><span class="vl">' + WPM[app.S.rung] + ' wpm</span></div></div>';
  h += gh('Practice mosaic') + '<div class="group">' + mosaicHtml() + '</div><p class="gf">One cell per practice day, so a gap leaves no hole. ' + days + ' practice day' + (days === 1 ? '' : 's') + ' so far. In one UCL study a new routine took 66 days on average to feel automatic, and a missed day did not derail it.</p>';
  const daysSinceReeval = app.S.lastReeval ? dayNum(dstr()) - dayNum(app.S.lastReeval) : 99;
  h += gh('Then and now') + '<div class="group"><div class="sumbox" id="proofBox">';
  if (app.S.proofDone && (app.S.proofColdRate != null || app.S.reevalRate != null)) {
    const latestMeta = app.S.reevalMeta || app.S.proofPacedMeta;
    const latestRate = app.S.reevalRate != null ? app.S.reevalRate : app.S.proofPacedRate;
    h += '<p class="ds">Baseline cold read: fluency ' + (app.S.proofColdRate != null ? app.S.proofColdRate + ' of 5' : '—') + ' · Latest: ' + (latestRate != null ? latestRate + ' of 5' : '—') + '.</p>'
      + '<div id="proofPlayers"></div>'
      + (latestMeta ? measuresHtml(latestMeta) : '')
      + '<button type="button" class="btn btn-s" data-act="reeval">' + (daysSinceReeval >= 7 ? 'Weekly re-record due (+50 XP)' : 'Record a fresh comparison') + '</button>';
  } else {
    h += '<p class="ds">Record a 20-second baseline, breathe for 2 minutes, and hear the shift on your own phone.</p><button type="button" class="btn btn-s" data-act="proof">Start 3-min before/after check</button>';
  }
  h += '</div></div>';
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
  const lines = ['Finetune: last 14 days', 'Practice days: ' + days + ' of 14. Sessions: ' + sess.length + '.'];
  const sc = L.filter(e => e.score != null);
  lines.push('Self-rated fluency out of 5: ' + (sc.length ? (sc.reduce((s, e) => s + e.score, 0) / sc.length).toFixed(1) + ' average, n=' + sc.length : 'not enough data') + '.');
  lines.push('Reading pace target: ' + WPM[app.S.rung] + ' wpm. Hard sounds set by me: ' + (app.S.hard || 'none') + '. Letters needing repeats: ' + (Object.keys(app.S.weak).join(', ') || 'none') + '.');
  const f = L.filter(e => e.type === 'field' && e.pred != null);
  lines.push('Real-world steps: ' + f.length + (f.length ? '. Predicted anxiety ' + (f.reduce((s, e) => s + e.pred, 0) / f.length).toFixed(1) + ', actual ' + (f.reduce((s, e) => s + e.act, 0) / f.length).toFixed(1) + ' (out of 10). Went badly in ' + f.filter(e => e.bad >= 1).length + '.' : '.'));
  const notes = L.filter(e => e.type === 'debrief' && e.meta).slice(-5).map(e => '- ' + e.meta);
  if (notes.length) lines.push('Debrief notes:', ...notes);
  return lines.join('\n');
}

/* ---------- Settings sheet (absorbs the old Guide + Step 6 Reminders & Help Accordions) ---------- */
const toggle = (id, label, on) => '<label class="li tg"><span class="grow">' + esc(label) + '</span><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '></label>';
function fmtRemTime(r) {
  const h12 = (r.hour % 12) || 12, ap = r.hour < 12 ? 'AM' : 'PM';
  return {hm: String(h12).padStart(2, '0') + ' : ' + String(r.min).padStart(2, '0'), ap};
}
export function settingsHtml() {
  const r = app.S.reminder || {on:false, hour:8, min:30, days:[0,1,2,3,4]};
  const tm = fmtRemTime(r), dL = ['M', 'T', 'W', 'T', 'F', 'S', 'S'], dF = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const remCard = '<div class="group">'
    + toggle('remOn', 'Daily practice reminder', r.on)
    + '<div class="field rem-box">'
    + '<div class="rem-time">'
    + '<button type="button" class="rem-step" data-act="remStep" data-v="-15" aria-label="15 minutes earlier">−</button>'
    + '<span class="rem-val num">' + tm.hm + '</span>'
    + '<button type="button" class="rem-step" data-act="remStep" data-v="15" aria-label="15 minutes later">+</button>'
    + '<div class="rem-ap"><button type="button" data-act="remAp" data-v="AM" aria-pressed="' + (tm.ap === 'AM') + '">AM</button><button type="button" data-act="remAp" data-v="PM" aria-pressed="' + (tm.ap === 'PM') + '">PM</button></div>'
    + '</div>'
    + '<div class="rem-presets" role="group" aria-label="Quick time presets">'
    + '<button type="button" class="rem-pre" data-act="remPre" data-v="8:0">Morning 8:00</button>'
    + '<button type="button" class="rem-pre" data-act="remPre" data-v="13:0">Midday 1:00</button>'
    + '<button type="button" class="rem-pre" data-act="remPre" data-v="20:30">Evening 8:30</button>'
    + '</div>'
    + '<div class="rem-days" role="group" aria-label="Repeat days">'
    + dL.map((l, i) => '<button type="button" class="rem-day" data-act="remDay" data-v="' + i + '" aria-pressed="' + (r.days.indexOf(i) >= 0) + '" aria-label="' + dF[i] + '">' + l + '</button>').join('')
    + '</div>'
    + '<button type="button" class="btn btn-p btn-sm" data-act="ics">Add to calendar</button>'
    + '</div></div>'
    + '<p class="gf">iOS web apps cannot schedule their own alarm yet. Add to Calendar gives you an offline alert, and Home shows a gentle due nudge.</p>';

  return '<div class="rhythm-banner mesh-hero">' + CARD_ART.calm + '<span class="rb-k">Consistency</span><strong class="rb-t">Small steps, every day.</strong></div>'
    + gh('Daily reminder') + remCard
    + gh('Practice time', 'ptH') + '<div class="group" role="group" aria-labelledby="ptH">' + ANCHORS.map(a => '<button type="button" class="li" data-act="plan" data-v="' + esc(a) + '" aria-pressed="' + (app.S.plan.anchor === a) + '"><span class="grow tt">' + esc(cap(a)) + '</span><svg class="ic ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>').join('') + '</div><p class="gf">Tie practice to something you already do each day.</p>'
    + gh('Situations') + '<div class="group">' + CONTEXTS.map(c => toggle('ctx-' + c.id, c.n, (app.S.contexts || []).indexOf(c.id) >= 0)).join('') + '</div>'
    + gh('Your words') + '<div class="group">'
    + '<div class="field"><label for="uname">Your name (optional)</label><input type="text" id="uname" maxlength="40" placeholder="Used in phone &amp; intro prompts" value="' + esc(app.S.userName || '') + '" autocomplete="off"></div>'
    + '<div class="field"><label for="hard">Sounds you find hard (letters)</label><input type="text" id="hard" maxlength="12" placeholder="For example B P S T M" value="' + esc(app.S.hard) + '" autocomplete="off"></div>'
    + '<div class="field"><label for="feared">Words you avoid (up to 30)</label><textarea id="feared" placeholder="Comma or line separated, e.g. schedule, budget, Tuesday">' + esc((app.S.fearedWords || []).join(', ')) + '</textarea></div>'
    + '<div class="field"><label for="opener">Your opening line</label><textarea id="opener" maxlength="200">' + esc(app.S.opener) + '</textarea></div>'
    + '</div><p class="gf">Woven into roughly 1 in 3 drills. Commas, spaces or new lines all work.</p>'
    + '<details class="clean-disc"><summary>Custom passages &amp; questions (' + ((app.S.customPassages || []).length + (app.S.customQuestions || []).length) + ')</summary><div class="group">'
    + '<div class="field"><label for="newQ">Add a practice question</label><div class="row"><input type="text" id="newQ" maxlength="200" placeholder="e.g. Walk me through our launch timeline."><button type="button" class="btn btn-s btn-sm" data-act="addQ">Add</button></div></div>'
    + ((app.S.customQuestions || []).map((q, i) => '<div class="li"><span class="grow ds">' + esc(q.t) + '</span><button type="button" class="lnk" data-act="delQ" data-v="' + i + '">Remove</button></div>').join(''))
    + '<div class="field"><label for="newPT">Add a reading passage</label><input type="text" id="newPT" maxlength="80" placeholder="Passage title"><textarea id="newPX" maxlength="800" placeholder="Paste or write your passage…"></textarea><button type="button" class="btn btn-s btn-sm" data-act="addP">Add passage</button></div>'
    + ((app.S.customPassages || []).map((p, i) => '<div class="li"><span class="grow ds">' + esc(p.t) + '</span><button type="button" class="lnk" data-act="delP" data-v="' + i + '">Remove</button></div>').join(''))
    + '</div></details>'
    + gh('Practice options') + '<div class="group">' + toggle('skel', 'Show the answer outline in practice questions', app.S.showSkeleton) + toggle('hclk', 'Hide countdown numbers', app.S.hideClock) + toggle('snds', 'Sound cues for breathing and timers', app.S.sound) + toggle('amb', 'Ambient rain during breathing', app.S.ambient) + toggle('voice', 'Voice guide for breathing', app.S.voice) + '</div>'
    + gh('Recordings') + '<div class="group"><div class="field"><p class="ds" id="recStat" role="status">Checking on-device clips…</p><button type="button" class="btn btn-s btn-sm" data-act="delClips">Delete all recordings</button></div></div><p class="gf">Recordings stay on this device and are never uploaded. Drill clips delete after 14 days; baseline proof clips stay until you delete them.</p>'
    + gh('Backup') + '<div class="group"><div class="field"><p class="ds" id="sync" role="status"></p><div class="row"><button type="button" class="btn btn-s btn-sm" data-act="export">Export backup</button><button type="button" class="btn btn-s btn-sm" data-act="importFile">Import backup</button></div><input type="file" id="bkfile" accept="application/json,.json" hidden><p class="ds" id="bkmsg" role="status"></p></div><details class="bk-raw"><summary>Paste or copy backup text</summary><div class="field"><label for="bk">Backup text</label><textarea id="bk"></textarea><div class="row"><button type="button" class="btn btn-s btn-sm" data-act="copy">Copy text</button><button type="button" class="btn btn-s btn-sm" data-act="import">Load pasted backup</button></div></div></details></div><p class="gf">Progress stays on this device. Export a file to move it to another device, or import a saved backup.</p>'
    + '<div class="group" style="margin-top:16px"><button type="button" class="li" data-act="reset" id="rst"><span class="grow tt" style="color:var(--tint)">Reset progress</span></button></div>'
    + gh('Help') + '<div class="help-stack">'
    + '<details class="help-acc" open><summary>Practice, not therapy</summary><p class="ds">This app gives you somewhere to practise breathing and speaking techniques every day. It does not treat stammering or anxiety, and it cannot promise your stammer will go away. A speech therapist can assess you and tell you which techniques fit you.</p></details>'
    + '<details class="help-acc"><summary>Finding a speech therapist</summary><p class="ds">Ask your doctor for a referral to a speech and language therapist (in the US, a speech-language pathologist). Directories and support groups: STAMMA in the UK (<a href="https://stamma.org" target="_blank" rel="noopener">stamma.org</a>), the National Stuttering Association (<a href="https://westutter.org" target="_blank" rel="noopener">westutter.org</a>), ASHA ProFind (<a href="https://www.asha.org/profind/" target="_blank" rel="noopener">asha.org/profind</a>) in the US, and The Indian Stammering Association in India.</p></details>'
    + '<details class="help-acc"><summary>Techniques in short</summary><p class="ds">Speak on a breath: breathe in quietly and begin as you breathe out. Easy onset: start the first sound softly, like a sigh turning into a word. Slow rate: stretch syllables a little. Phrase and pause: speak in short chunks. Pause, do not dodge: a silent pause is fine. To buy a moment: ' + STALL.slice(0, 3).map(s => '“' + esc(s) + '”').join(', ') + '.</p></details>'
    + '<details class="help-acc"><summary>Known limits &amp; privacy</summary><p class="ds">Everything stays on this device and works offline. Pace and pause measures are indicators of change, not a diagnosis. iOS web apps do not support native alarms or haptics yet; use Add to calendar for offline reminders.</p></details>'
    + '</div>';
}
export function renderSheet() {
  $('#sheetBody').innerHTML = settingsHtml();
  $('#bk').value = JSON.stringify(app.S);
  updateSync();
  storageStats().then(st => {
    const el = $('#recStat');
    if (el) el.textContent = st.count + ' recording' + (st.count === 1 ? '' : 's') + ' on this device (' + fmtBytes(st.bytes) + ')';
  }).catch(() => {});
}

async function hydrateProofPlayers() {
  const host = $('#proofPlayers');
  if (!host) return;
  const cold = app.S.proofColdId ? await getClip(app.S.proofColdId) : null;
  const nowId = app.S.reevalId || app.S.proofPacedId;
  const latest = nowId ? await getClip(nowId) : null;
  let html = '';
  if (cold) html += playerHtml('prCold', 'Then · baseline', (app.S.proofColdMeta && app.S.proofColdMeta.durationSec) || 20);
  if (latest) html += playerHtml('prNow', app.S.reevalId ? 'Now · weekly check' : 'After breathing', ((app.S.reevalMeta || app.S.proofPacedMeta) && (app.S.reevalMeta || app.S.proofPacedMeta).durationSec) || 20);
  host.innerHTML = html;
  if (cold) wirePlayer(host, 'prCold', cold);
  if (latest) wirePlayer(host, 'prNow', latest);
}

const VIEWS = {home:viewHome, breathe:viewBreathe, gates:viewGates, progress:viewProgress};
export function renderAll() {
  try {
    rollDay();
    if (!VIEWS[app.tab]) app.tab = 'home';
    $('#view').innerHTML = VIEWS[app.tab]();
    $$('#tabs button').forEach(b => { if (b.getAttribute('data-v') === app.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const sm = $('#sum'); if (sm) sm.value = summaryText();
    if (app.tab === 'progress') hydrateProofPlayers();
    if (sheetOpen()) renderSheet();
    updateSync();
  } catch (e) { toast('Something went wrong drawing this screen. Your progress is saved.'); }
}
