import {$, $$, esc, dstr, dayNum, numStr, weekStartNum} from './util.js';
import {RANKS, rankOf, levelOf, STAT_KEYS, STAT_N, ENERGY, QUESTS, TYPE_N, WPM, STALL, TWISTS, ANCHORS} from './content.js';
import {app, updateSync} from './state.js';
import {practicedThisWeek, rollDay} from './rules.js';
import {toast, block, bar, energySeg} from './ui.js';

export function twistToday() { return TWISTS[dayNum(dstr()) % TWISTS.length]; }
export function mosaicHtml() {
  const keys = Object.keys(app.S.days).sort(), total = keys.length;
  const start = total > 0 ? Math.floor((total - 1) / 66) * 66 : 0;
  const cells = keys.slice(start, start + 66);
  let h = '';
  for (let i = 0; i < 66; i++) h += cells[i] ? '<div class="cell f e' + app.S.days[cells[i]].e + '" aria-hidden="true">' + (start + i + 1) + '</div>' : '<div class="cell" aria-hidden="true">' + (start + i + 1) + '</div>';
  return '<div class="mosaic" role="img" aria-label="Practice mosaic: ' + total + ' practice days painted, 66 cells per mosaic">' + h + '</div><div class="legend"><span>Colour is your most tired state that day:</span>' + ENERGY.map((n, i) => '<span><i class="e' + (i + 1) + '"></i>' + n + '</span>').join('') + '</div>';
}
export function weekHtml() {
  const w = weekStartNum(dayNum(dstr())), today = dayNum(dstr()), L = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  let h = '';
  for (let i = 0; i < 7; i++) { const d = numStr(w + i), on = !!app.S.days[d]; h += '<div class="wk' + (on ? ' on' : '') + (w + i === today ? ' today' : '') + '"><span aria-hidden="true">' + L[i] + '</span><span class="sr">' + d + (on ? ' practiced' : ' not practiced') + '</span></div>'; }
  return '<div class="week">' + h + '</div>';
}
export function roughPatch() {
  const recent = app.S.log.filter(e => e.score != null).slice(-3);
  if (recent.length < 3) return false;
  return recent.every(e => e.score <= 2 && Date.now() - e.t < 10 * 86400000);
}
export function viewStatus() {
  const ri = rankOf(app.S.xp), R = RANKS[ri], N = RANKS[ri + 1], lvl = levelOf(app.S.xp), into = app.S.xp - (lvl - 1) * 150;
  const days = Object.keys(app.S.days).length, wk = practicedThisWeek(), tired = app.S.energy >= 4;
  let h = '';
  h += '<section class="head"><div class="rank r' + R.r + '" role="img" aria-label="Rank ' + R.r + '"><i>' + R.r + '</i></div><div class="led"><div><span>Level</span><b>' + lvl + '</b></div><div><span>Level progress</span><b>' + into + ' / 150</b></div><div><span>' + (N ? 'To rank ' + N.r : 'Rank') + '</span><b>' + (N ? (N.xp - app.S.xp).toLocaleString() + ' XP' : 'Top') + '</b></div><div><span>Practice run</span><b>' + app.S.streak + ' d · best ' + app.S.best + '</b></div></div></section>';
  h += '<section class="panel"><div class="lbl">Today’s run</div><p>' + (app.S.plan.anchor ? 'Your plan: <b>' + esc(app.S.plan.anchor) + '</b>, do the run.' : 'Pick the moment you will do this each day. A fixed cue makes it automatic.') + '</p>'
    + '<p class="note">' + (tired ? 'You are tired. The short run keeps the habit and still counts.' : 'Drills alternate on purpose. Mixed practice sticks better than repeating one drill.') + '</p>'
    + '<div class="row"><button type="button" class="btn ' + (tired ? '' : 'solid') + '" data-act="run" data-v="full">Full run · 10 min</button><button type="button" class="btn ' + (tired ? 'solid' : '') + '" data-act="run" data-v="short">Short run · 4 min</button></div>'
    + '<p class="note">Any one drill counts as a practice day. Doing more earns bonus XP.</p></section>';
  if (!app.S.plan.anchor) h += block('Make it automatic', '<p class="note">Choose the moment you will practice. Say it as a plan: after this, I do that. Set a phone alarm for the same moment, since this page cannot send reminders. Choosing a plan earns 30 XP.</p><div class="seg">' + ANCHORS.map(a => '<button type="button" class="segb wide" data-act="plan" data-v="' + esc(a) + '" aria-pressed="false"><b>' + esc(a.charAt(0).toUpperCase() + a.slice(1)) + '</b></button>').join('') + '</div>');
  if (roughPatch()) h += block('Rough patch', '<p>Your last three ratings were low. That happens, and it is common after treatment. Slow your pace, keep sessions short, and book a booster session with your speech therapist. Your pace gate already eases when you are not tired.</p>');
  h += block('Energy right now', energySeg() + '<p class="note">' + (tired ? 'Tired sessions earn +50% session XP and build Resilience. Keep them short and protect your sleep.' : 'Set this before each session. Your ratings are tracked against it.') + '</p>');
  h += block('Daily quests', '<ul class="quests">' + QUESTS.map(q => { const n = Math.min(app.S.daily[q.id] || 0, q.need), ok = n >= q.need; return '<li class="' + (ok ? 'ok' : '') + '"><span class="chk" aria-hidden="true"></span><div><b>' + q.n + '</b><small>' + q.d + (ok ? ' (done)' : '') + '</small></div><span class="mono">' + n + '/' + q.need + '</span></li>'; }).join('') + '</ul><p class="note">One quest keeps your practice day. Two earn a solid day, four a full clear.</p>');
  h += block('This week', weekHtml() + '<p class="note"><b>' + wk + ' of 5</b> practice days. Reach five for a bonus and a shield. A shield quietly covers one missed day.' + (app.S.shields ? ' You hold ' + app.S.shields + '.' : '') + '</p>');
  h += block('Mosaic', mosaicHtml() + '<div class="led"><div><span>Practice days</span><b>' + days + ' / 66</b></div></div>' + bar(days % 66 / 66 * 100) + '<p class="note">One cell per practice day, not per calendar day, so a gap leaves no hole. In one UCL study a new routine took 66 days on average to feel automatic, ranging from 18 to 254, and an occasional missed day did not derail it.</p>');
  h += block('Today’s twist', '<div class="twist"><p>' + esc(twistToday()) + '</p></div><p class="note">Varying where and how you practice helps skills carry over to real situations.</p>' + (app.S.daily.twist ? '<p class="note">Claimed.</p>' : '<button type="button" class="btn sm" data-act="twist">I did it: +10 XP</button>'));
  h += block('Stats', STAT_KEYS.map(k => { const p = app.S.stats[k] || 0; return '<div class="stat"><span>' + STAT_N[k] + '</span>' + bar(p % 100) + '<span class="mono">Lv ' + (1 + Math.floor(p / 100)) + '</span></div>'; }).join('') + '<div class="stat"><span>Pace gate</span>' + bar((app.S.rung + 1) / WPM.length * 100, 'steel') + '<span class="mono">' + WPM[app.S.rung] + '</span></div>');
  h += block('Before and after a call', '<p class="note">Before: three minutes of breath, retrieval and your opening line. After: three lines, then stop.</p><div class="row"><button type="button" class="btn" data-act="ritual">Pre-call ritual</button><button type="button" class="btn" data-act="debrief">Debrief a meeting</button></div>');
  return h;
}
export function gateRow(name, xp, desc, act, locked, lockMsg) {
  return '<div class="grow' + (locked ? ' locked' : '') + '"><h3>' + name + '</h3><span class="xpr">' + xp + '</span><p>' + desc + (locked ? ' ' + lockMsg : '') + '</p><button type="button" class="btn sm' + (locked ? '' : ' solid') + '"' + (locked ? ' disabled' : ' data-act="' + act + '"') + '>' + (locked ? 'Locked' : 'Open') + '</button></div>';
}
export function viewGates() {
  const bossLocked = rankOf(app.S.xp) < 1;
  return block('Energy right now', energySeg())
    + block('Daily run', '<p class="note">Interleaved: breath, reading, two retrieval rounds, two cold answers.</p><div class="row"><button type="button" class="btn solid" data-act="run" data-v="full">Full run · 10 min</button><button type="button" class="btn" data-act="run" data-v="short">Short run · 4 min</button></div>')
    + block('Drills', gateRow('Breath Gate', '10 XP per minute', 'Paced breathing with a guide. Includes a mode where you say a phrase on each exhale.', 'breath')
      + gateRow('Paced Reading', '26 to 35 XP', 'Read aloud while words light up at your pace gate. Slow, chunked delivery with soft starts.', 'read')
      + gateRow('Alphabet Raid', '10 to 34 XP a round', 'Name words from a letter and category. Your hard and weak sounds come up more often.', 'raid')
      + gateRow('Cold Questions', '26 to 40 XP', 'Strategy-meeting questions you have not prepared for. Lead with a position and recover from a blank.', 'cold')
      + gateRow('Boss Gauntlet', '88 to 130 XP', 'Five cold questions back to back. Once a week, ideally when a little tired.', 'boss', bossLocked, 'Unlocks at Rank D.'))
    + block('Real world', gateRow('Field missions', '35 to 60 XP', 'Graded real conversations with a prediction before and the outcome after. This is where progress counts.', 'field'));
}
export function viewLog() {
  const sess = app.S.log.filter(e => e.type !== 'debrief'), tired = sess.filter(e => e.energy >= 4).length;
  const rows = [1, 2, 3, 4, 5].map(n => { const a = app.S.log.filter(e => e.score != null && e.energy === n), avg = a.length ? a.reduce((s, e) => s + e.score, 0) / a.length : 0; return '<div class="erow"><span>' + n + ' ' + ENERGY[n - 1] + '</span>' + bar(avg / 5 * 100, 'steel') + '<span class="mono">' + (a.length ? avg.toFixed(1) : '–') + '</span></div>'; }).join('');
  const scored = app.S.log.filter(e => e.score != null).length;
  const field = app.S.log.filter(e => e.type === 'field' && e.pred != null).slice(-10);
  let fieldHtml = '<p class="note">No field missions yet. After a few you will see how your predictions compare with reality.</p>';
  if (field.length) {
    const pa = field.reduce((s, e) => s + e.pred, 0) / field.length, aa = field.reduce((s, e) => s + e.act, 0) / field.length, pc = field.reduce((s, e) => s + e.chance, 0) / field.length, badN = field.filter(e => e.bad >= 1).length;
    fieldHtml = '<div class="led"><div><span>Predicted anxiety, average</span><b>' + pa.toFixed(1) + ' / 10</b></div><div><span>Actual anxiety, average</span><b>' + aa.toFixed(1) + ' / 10</b></div><div><span>Expected chance of going badly</span><b>' + Math.round(pc) + '%</b></div><div><span>Went badly, partly or fully</span><b>' + badN + ' of ' + field.length + '</b></div></div><p class="note">' + (pa - aa >= 1.5 ? 'Reality has been easier than you predicted. That gap is the evidence to move up a step.' : (aa - pa >= 1.5 ? 'Reality has run harder than predicted. Spend longer on the current step.' : 'Your predictions track reality well.')) + '</p>';
  }
  const items = app.S.log.slice(-15).reverse();
  return block('Totals', '<div class="led"><div><span>Sessions</span><b>' + sess.length + '</b></div><div><span>When tired or spent</span><b>' + tired + '</b></div><div><span>Gauntlets cleared</span><b>' + app.S.bosses + '</b></div><div><span>Total XP</span><b>' + app.S.xp.toLocaleString() + '</b></div></div>')
    + block('Fluency by energy', rows + '<p class="note">' + (scored < 6 ? 'Rate a few readings and answers at different energy levels. Your pattern appears here.' : 'Average self-rated fluency out of 5. A smaller gap between fresh and tired days is the progress to watch.') + '</p>')
    + block('Predictions versus reality', fieldHtml)
    + block('Recent sessions', items.length ? '<ul class="loglist">' + items.map(e => '<li><span>' + esc(TYPE_N[e.type] || e.type) + (e.score != null ? ' · fluency ' + e.score : '') + ' · energy ' + e.energy + '</span><span class="xp">+' + e.xp + '</span><small>' + esc(new Date(e.t).toLocaleString([], {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})) + (e.meta ? ' · ' + esc(e.meta) : '') + '</small></li>').join('') + '</ul>' : '<p class="note">Nothing logged yet. Clear a gate and it appears here.</p>')
    + block('For your speech therapist', '<p class="note">A plain summary of the last 14 days to bring to a session. Copy it or select it.</p><textarea id="sum" readonly aria-label="Summary for your speech therapist"></textarea><div class="row"><button type="button" class="btn sm" data-act="copysum">Copy summary</button></div><p class="note" id="summsg" role="status"></p>');
}
export function summaryText() {
  const since = Date.now() - 14 * 86400000, L = app.S.log.filter(e => e.t >= since), sess = L.filter(e => e.type !== 'debrief');
  const days = Object.keys(app.S.days).filter(d => dayNum(d) >= dayNum(dstr()) - 13).length;
  const lines = ['Fluency Rank System: last 14 days', 'Practice days: ' + days + ' of 14. Sessions: ' + sess.length + '. At energy 4 or 5: ' + sess.filter(e => e.energy >= 4).length + '.'];
  const byE = [1, 2, 3, 4, 5].map(n => { const a = L.filter(e => e.score != null && e.energy === n); return a.length ? n + ' (' + ENERGY[n - 1].toLowerCase() + '): ' + (a.reduce((s, e) => s + e.score, 0) / a.length).toFixed(1) + ', n=' + a.length : null; }).filter(Boolean);
  lines.push('Self-rated fluency out of 5 by energy: ' + (byE.length ? byE.join('; ') : 'not enough data'));
  lines.push('Reading pace gate: ' + WPM[app.S.rung] + ' wpm. Hard sounds set by me: ' + (app.S.hard || 'none') + '. Letters needing repeats: ' + (Object.keys(app.S.weak).join(', ') || 'none') + '.');
  const f = L.filter(e => e.type === 'field' && e.pred != null);
  lines.push('Field missions: ' + f.length + (f.length ? '. Predicted anxiety ' + (f.reduce((s, e) => s + e.pred, 0) / f.length).toFixed(1) + ', actual ' + (f.reduce((s, e) => s + e.act, 0) / f.length).toFixed(1) + ' (out of 10). Went badly in ' + f.filter(e => e.bad >= 1).length + '.' : '.'));
  const notes = L.filter(e => e.type === 'debrief' && e.meta).slice(-5).map(e => '- ' + e.meta);
  if (notes.length) lines.push('Debrief notes:', ...notes);
  return lines.join('\n');
}
export function viewGuide() {
  return block('Goal', '<p>The aim is smooth speech, and staying calm and in the conversation when a word catches. Fatigue makes speech bumpier for most people who stammer, so on tired days the target is a steady pace, not perfection. This app is practice. It supports your speech therapist and does not replace them.</p>', 'guide')
    + block('Techniques', '<ul><li><b>Speak on a breath.</b> Inhale quietly and begin as you exhale.</li><li><b>Easy onset.</b> Start the first sound softly, like a sigh turning into a word.</li><li><b>Slow rate.</b> Stretch syllables a little without going robotic.</li><li><b>Phrase and pause.</b> Speak in chunks and pause at commas and the ends of thoughts.</li><li><b>Pause, do not dodge.</b> A silent pause beats swapping a word to avoid a sound. Ask your therapist how they want you to handle a block.</li></ul>', 'guide')
    + block('Answering cold', '<ul><li><b>Position.</b> "My recommendation is…"</li><li><b>Because.</b> One or two reasons, one number if you have it.</li><li><b>Change.</b> "I would revisit if…"</li></ul><div class="lab">Buying a moment honestly</div><div class="chips">' + STALL.map(s => '<span class="chip">' + esc(s) + '</span>').join('') + '</div>', 'guide')
    + block('Tired-day protocol', '<ul><li><b>Lower the bar.</b> The short run counts as a practice day.</li><li><b>Slow down more.</b> About ten percent slower than a fresh day.</li><li><b>Run the pre-call ritual</b> before a late call.</li><li><b>One idea per breath.</b> Shorter sentences.</li><li><b>Protect sleep.</b> Practice earlier, not later. Never trade sleep for progress.</li></ul>', 'guide')
    + block('How this is built', '<ul><li><b>Choice and competence.</b> Gamification research finds that progression, goals and feedback help, while points alone drive short-term compliance. So you choose your drills, your plan and your twist, and pace gates move only when you do well.</li><li><b>Practice days, not streak pressure.</b> Streaks work through fear of loss and can backfire after a miss. Here one drill counts, shields cover a gap, a comeback earns a bonus, and the mosaic fills per practice day.</li><li><b>Mixed, varied, spaced.</b> Interleaved runs, a daily twist, and weak letters returning on a schedule are known ways to make practice transfer.</li><li><b>Relapse is planned for.</b> Studies report relapse after fluency treatment in a large share of people, with transfer to real situations the hard part. Hence field missions, rough-patch handling, and a summary for your therapist.</li><li><b>Prediction versus reality.</b> Comparing what you expected with what happened is a standard step in exposure work for social anxiety, though research on exactly why it works is still mixed.</li></ul><p class="note">None of this is a promise of results. People vary, and your therapist can tell you what fits you.</p>', 'guide')
    + block('Your plan', '<div class="lab">When I practice</div><div class="seg">' + ANCHORS.map(a => '<button type="button" class="segb wide" data-act="plan" data-v="' + esc(a) + '" aria-pressed="' + (app.S.plan.anchor === a) + '"><b>' + esc(a.charAt(0).toUpperCase() + a.slice(1)) + '</b></button>').join('') + '</div><div class="lab">Minimum on a hard day</div><div class="seg"><button type="button" class="segb" data-act="mins" data-v="3" aria-pressed="' + (app.S.plan.mins === 3) + '"><b>3 min</b></button><button type="button" class="segb" data-act="mins" data-v="10" aria-pressed="' + (app.S.plan.mins === 10) + '"><b>10 min</b></button></div><p class="note">Telling one person your plan makes it more likely to happen.</p>', 'guide')
    + block('Settings', '<label class="lab" for="hard">My hard sounds (letters)</label><input type="text" id="hard" maxlength="12" placeholder="For example BPSTM" value="' + esc(app.S.hard) + '" autocomplete="off"><p class="note">Alphabet Raid picks these about half the time, along with letters you struggle with.</p><label class="lab" for="opener">My opening line for calls</label><textarea id="opener" maxlength="200">' + esc(app.S.opener) + '</textarea><label class="tg"><input type="checkbox" id="skel"' + (app.S.showSkeleton ? ' checked' : '') + '> Show the answer outline during cold questions</label><label class="tg"><input type="checkbox" id="hclk"' + (app.S.hideClock ? ' checked' : '') + '> Hide countdown numbers, keep the progress bar</label><label class="tg"><input type="checkbox" id="snds"' + (app.S.sound ? ' checked' : '') + '> Sound cues for breathing and timers</label>', 'guide')
    + block('Backup', '<p class="note">Progress saves on this device and, where available, to your account. To move it by hand, copy this text, or paste a saved copy over it and load it.</p><textarea id="bk" aria-label="Backup data"></textarea><div class="row"><button type="button" class="btn sm" data-act="copy">Select backup</button><button type="button" class="btn sm" data-act="import">Load pasted backup</button><button type="button" class="btn sm amber" data-act="reset" id="rst">Reset progress</button></div><p class="note" id="bkmsg" role="status"></p>', 'guide');
}
export function renderAll() {
  try {
    rollDay();
    $('#view').innerHTML = app.tab === 'status' ? viewStatus() : app.tab === 'gates' ? viewGates() : app.tab === 'log' ? viewLog() : viewGuide();
    $$('#tabs button').forEach(b => { if (b.getAttribute('data-v') === app.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    const bk = $('#bk'); if (bk) bk.value = JSON.stringify(app.S);
    const sm = $('#sum'); if (sm) sm.value = summaryText();
    updateSync();
  } catch (e) { toast('Something went wrong drawing this screen. Your progress is saved.'); }
}
