import {$, dstr, reduceMotion} from './util.js';
import {rankOf, DEFAULT_OPENER, CONTEXTS} from './content.js';
import {parseFearedWords, parseName} from './personal.js';
import {app, fresh, sanitize, save, initDb} from './state.js';
import {rollDay} from './rules.js';
import {toast, confirmModal, closeModal, primeAudio, openSheet, closeSheet, sheetOpen, dismissEnd} from './ui.js';
import {runBreath, runRead, runRaid, runCold, runRitual, runField, runProof, runReeval, launchNext, startRun, SESSION, SHORT} from './drills.js';
import {clearClips, pruneExpiredClips} from './recorder.js';
import {renderAll, renderSheet} from './views.js';

export function buildIcs(r) {
  const byday = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
  const days = (r.days && r.days.length ? r.days : [0,1,2,3,4]).map(i => byday[i]).join(',');
  const pad = n => String(n).padStart(2, '0');
  const now = new Date();
  const dt = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) + 'T' + pad(r.hour) + pad(r.min) + '00';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Finetune//Daily Practice//EN',
    'BEGIN:VEVENT',
    'UID:finetune-daily@local',
    'SUMMARY:5-min speaking & breath practice',
    'DESCRIPTION:One breathing session and one short speaking drill.',
    'DTSTART:' + dt,
    'DURATION:PT5M',
    'RRULE:FREQ=WEEKLY;BYDAY=' + days,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Time for your 5-min practice',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}
function selectText(el) { el.removeAttribute('readonly'); el.focus(); el.select(); }
function loadBackupText(raw) {
  const msg = $('#bkmsg');
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || typeof o.xp !== 'number') throw new Error('shape');
    if (JSON.stringify(sanitize(o)) === JSON.stringify(app.S)) { if (msg) msg.textContent = 'That is the data you already have. Choose or paste a different backup.'; return; }
    app.S = sanitize(o); rollDay(); save(); renderAll();
    const m = $('#bkmsg'); if (m) m.textContent = 'Backup loaded.';
    toast('Backup loaded');
  } catch (e) { if (msg) msg.textContent = 'That file or text is not a valid backup. Nothing was changed.'; }
}
const ACT = {
  tab(t) {
    app.tab = t.getAttribute('data-v'); renderAll(); window.scrollTo(0, 0);
    const h = $('#view h1'); if (h) { try { h.focus({preventScroll:true}); } catch (e) { /* ignore */ } }
  },
  settings() { openSheet(renderSheet); },
  sheetDone() { closeSheet(); },
  session() { startRun(SESSION(), 'Daily session'); },
  short() { startRun(SHORT(), 'Short version'); },
  speak() { runRitual(); },
  bmins(t) {
    const m = Number(t.getAttribute('data-v'));
    if ([1, 3, 5].indexOf(m) >= 0) { app.S.breathMins = m; save(); renderAll(); }
  },
  goal(t) { runBreath({pat:t.getAttribute('data-v'), mins:app.S.breathMins, instant:true}); },
  breath(t) { runBreath({pat:t.getAttribute('data-v'), mins:app.S.breathMins}); },
  read() { runRead(); }, raid() { runRaid(); }, cold() { runCold(false); },
  field() { runField(); },
  proof() { runProof(); },
  reeval() { runReeval(); },
  nextStep(t) {
    const parts = String(t.getAttribute('data-v') || '').split(':');
    launchNext({act:parts[0] || 'read', val:parts[1] || ''});
  },
  delClips() {
    confirmModal({
      title:'Delete all recordings?',
      body:'This removes all drill clips and baseline recordings stored on this device. Your practice log, streak and stats stay intact.',
      confirmLabel:'Delete all',
      cancelLabel:'Cancel',
      onConfirm() {
        clearClips().then(() => {
          app.S.proofColdId = ''; app.S.proofPacedId = ''; app.S.reevalId = '';
          save(); renderAll(); toast('Recordings deleted');
        });
      }
    });
  },
  /* the Challenge round only appears from Rank D; a stale button does nothing */
  boss() { if (rankOf(app.S.xp) >= 1) runCold(true); },
  /* choosing a practice time no longer pays XP: all progress goes through award() */
  plan(t) { app.S.plan.anchor = t.getAttribute('data-v'); save(); renderSheet(); },
  remStep(t) {
    const delta = Number(t.getAttribute('data-v')) || 0;
    const total = (app.S.reminder.hour * 60 + app.S.reminder.min + delta + 1440) % 1440;
    app.S.reminder.hour = Math.floor(total / 60); app.S.reminder.min = total % 60;
    app.S.reminder.on = true; save(); renderSheet();
  },
  remAp(t) {
    const ap = t.getAttribute('data-v'), h = app.S.reminder.hour;
    if (ap === 'AM' && h >= 12) app.S.reminder.hour = h - 12;
    else if (ap === 'PM' && h < 12) app.S.reminder.hour = h + 12;
    app.S.reminder.on = true; save(); renderSheet();
  },
  remPre(t) {
    const [h, m] = t.getAttribute('data-v').split(':').map(Number);
    app.S.reminder.hour = h; app.S.reminder.min = m; app.S.reminder.on = true;
    save(); renderSheet();
  },
  remDay(t) {
    const i = Number(t.getAttribute('data-v'));
    let d = (app.S.reminder.days || []).slice();
    const k = d.indexOf(i);
    if (k >= 0 && d.length > 1) d.splice(k, 1);
    else if (k < 0) d.push(i);
    app.S.reminder.days = d.sort(); app.S.reminder.on = true;
    save(); renderSheet();
  },
  ics() {
    app.S.reminder.on = true; save();
    const content = buildIcs(app.S.reminder);
    try {
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
        const url = URL.createObjectURL(new Blob([content], {type:'text/calendar;charset=utf-8'}));
        const a = document.createElement('a');
        a.href = url; a.download = 'finetune-practice.ics';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);
        toast('Calendar alert downloaded');
        return;
      }
    } catch (e) { /* fall through */ }
    toast('Calendar file ready');
  },
  copysum() { const el = $('#sum'); selectText(el); let ok = false; try { ok = document.execCommand && document.execCommand('copy'); } catch (e) { ok = false; } el.setAttribute('readonly', ''); $('#summsg').textContent = ok ? 'Copied.' : 'Selected. Copy it with your keyboard.'; },
  copy() { const el = $('#bk'); selectText(el); let ok = false; try { ok = document.execCommand && document.execCommand('copy'); } catch (e) { ok = false; } $('#bkmsg').textContent = ok ? 'Copied.' : 'Selected. Copy it with your keyboard.'; },
  export() {
    const msg = $('#bkmsg'), data = JSON.stringify(app.S, null, 2);
    try {
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
        const url = URL.createObjectURL(new Blob([data], {type:'application/json'}));
        const a = document.createElement('a');
        a.href = url; a.download = 'finetune-backup-' + dstr() + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) {} }, 1000);
        if (msg) msg.textContent = 'Backup exported.';
        toast('Backup exported');
        return;
      }
    } catch (e) { /* fall through */ }
    const det = document.querySelector('.bk-raw'); if (det) det.open = true;
    const el = $('#bk'); if (el) selectText(el);
    if (msg) msg.textContent = 'Backup text selected below. Copy it to save.';
  },
  importFile() { const f = $('#bkfile'); if (f) { f.value = ''; f.click(); } },
  import() { const bk = $('#bk'); loadBackupText(bk ? bk.value : ''); },
  addQ() {
    const el = $('#newQ'), txt = (el && el.value || '').trim().slice(0, 200);
    if (!txt) { toast('Write a question first'); return; }
    app.S.customQuestions.unshift({t:txt});
    app.S.customQuestions = app.S.customQuestions.slice(0, 30);
    save(); renderSheet(); toast('Question added');
  },
  delQ(t) {
    const i = Number(t.getAttribute('data-v'));
    if (i >= 0) { app.S.customQuestions.splice(i, 1); save(); renderSheet(); }
  },
  addP() {
    const tEl = $('#newPT'), xEl = $('#newPX');
    const title = (tEl && tEl.value || '').trim().slice(0, 80), text = (xEl && xEl.value || '').trim().slice(0, 800);
    if (!title || !text) { toast('Add a title and passage text'); return; }
    app.S.customPassages.unshift({t:title, x:text});
    app.S.customPassages = app.S.customPassages.slice(0, 15);
    save(); renderSheet(); toast('Passage added');
  },
  delP(t) {
    const i = Number(t.getAttribute('data-v'));
    if (i >= 0) { app.S.customPassages.splice(i, 1); save(); renderSheet(); }
  },
  reset() {
    confirmModal({
      title:'Reset all progress?',
      body:'This clears your log, streak, stats and settings on this device. Export a backup first if you want a copy.',
      confirmLabel:'Reset everything',
      cancelLabel:'Cancel',
      onConfirm() { app.S = fresh(); rollDay(); save(); renderAll(); toast('Progress reset'); }
    });
  }
};
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = ACT[t.getAttribute('data-act')];
  if (!fn) return;
  try { fn(t); } catch (err) { toast('Something went wrong. Your progress is saved.'); }
});
$('#scrim').addEventListener('click', () => closeSheet());
$('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeModal(); });
document.addEventListener('change', e => {
  const id = e.target && e.target.id;
  if (id === 'hard') { app.S.hard = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12); e.target.value = app.S.hard; save(); }
  else if (id === 'uname') { app.S.userName = parseName(e.target.value); e.target.value = app.S.userName; save(); }
  else if (id === 'feared') { app.S.fearedWords = parseFearedWords(e.target.value); e.target.value = app.S.fearedWords.join(', '); save(); }
  else if (id && id.startsWith('ctx-')) {
    const cid = id.slice(4), on = e.target.checked;
    let next = (app.S.contexts || []).filter(x => x !== cid);
    if (on) next.push(cid);
    if (!next.length) { e.target.checked = true; toast('Keep at least one situation selected'); return; }
    app.S.contexts = CONTEXTS.map(c => c.id).filter(x => next.indexOf(x) >= 0);
    save();
  }
  else if (id === 'opener') { app.S.opener = e.target.value.trim().slice(0, 200) || DEFAULT_OPENER; save(); }
  else if (id === 'skel') { app.S.showSkeleton = e.target.checked; save(); }
  else if (id === 'hclk') { app.S.hideClock = e.target.checked; save(); }
  else if (id === 'snds') { app.S.sound = e.target.checked; save(); primeAudio(); }
  else if (id === 'amb') { app.S.ambient = e.target.checked; save(); }
  else if (id === 'voice') { app.S.voice = e.target.checked; save(); }
  else if (id === 'remOn') { app.S.reminder.on = e.target.checked; save(); renderAll(); }
  else if (id === 'bkfile') {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.text) file.text().then(loadBackupText).catch(() => { const m = $('#bkmsg'); if (m) m.textContent = 'Could not read that file.'; });
    else {
      const r = new FileReader();
      r.onload = () => loadBackupText(String(r.result || ''));
      r.onerror = () => { const m = $('#bkmsg'); if (m) m.textContent = 'Could not read that file.'; };
      r.readAsText(file);
    }
  }
});
document.addEventListener('keydown', e => {
  const m = $('#modal');
  if (!m.hidden) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab') {
      const btns = [...m.querySelectorAll('button')];
      if (btns.length) {
        e.preventDefault();
        const idx = btns.indexOf(document.activeElement);
        btns[(idx + (e.shiftKey ? btns.length - 1 : 1)) % btns.length].focus();
      }
    }
    return;
  }
  if (e.key !== 'Escape') return;
  if (sheetOpen()) { closeSheet(); return; }
  if (app.running) dismissEnd();
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !app.running) renderAll(); });
window.addEventListener('error', () => { toast('Something went wrong. Your progress is saved.'); });

/* Calm 1-breath animated intro on first open per session; tap anywhere to skip, off under reduced motion */
function playIntro() {
  const el = $('#intro');
  if (!el || reduceMotion) return;
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) return;
  try {
    if (sessionStorage.getItem('fr-intro')) return;
    sessionStorage.setItem('fr-intro', '1');
  } catch (e) { /* storage optional */ }
  const word = $('#introWord');
  let gone = false, t1 = 0, t2 = 0, t3 = 0;
  const dismiss = () => {
    if (gone) return;
    gone = true;
    clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
    el.classList.add('out');
    setTimeout(() => { el.hidden = true; el.classList.remove('out', 'in'); }, 460);
  };
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('in'));
  t1 = setTimeout(() => { if (word) word.textContent = 'Breathe in…'; }, 400);
  t2 = setTimeout(() => { el.classList.remove('in'); if (word) word.textContent = 'Out, slowly'; }, 2100);
  t3 = setTimeout(dismiss, 4000);
  el.addEventListener('click', dismiss, {once:true});
  document.addEventListener('keydown', dismiss, {once:true});
}

rollDay();
renderAll();
initDb();
pruneExpiredClips().catch(() => {});
playIntro();

/* offline support: cache the app so it opens without a connection */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
