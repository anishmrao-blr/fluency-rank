import {$, $$, esc, clamp, fmt, reduceMotion} from './util.js';
import {DRILL_N, TYPE_N} from './content.js';
import {app, save} from './state.js';
import {primeAudio, cue, startAmbient, stopAmbient} from './audio.js';
import {award} from './rules.js';
import {nextRun} from './drills.js';
import {renderAll, weekHtml} from './views.js';

const MOTION_MS = reduceMotion ? 0 : 380;
const CLOSE = new Set(); // pending close timers for covers and sheets, kept outside T so stopRun's T.clear() cannot cancel them

export function toast(m, sys) {
  const c = $('#toasts'), d = document.createElement('div');
  d.className = 'toast' + (sys ? ' sys-t' : '');
  d.innerHTML = (sys ? '' : '<span class="toast-ok" aria-hidden="true">✓</span>') + '<span>' + esc(m) + '</span>';
  c.appendChild(d);
  setTimeout(() => d.remove(), 3400);
}
let modalReturn = null;
/* Used only for a rank up: the leveling layer's biggest reward moment. */
export function modal(title, body, rank) {
  const m = $('#modal');
  modalReturn = document.activeElement;
  m.classList.remove('sheet-modal');
  m.innerHTML = '<div class="modal-in" role="alertdialog" aria-modal="true" aria-labelledby="mt" aria-describedby="mb">' + (rank ? emblem(rank, true) : '') + '<div class="sys"><p id="mt">' + esc(title) + '</p></div><p id="mb">' + esc(body) + '</p><button type="button" class="btn btn-p" id="mclose">Continue</button></div>';
  m.hidden = false;
  $('#mclose').onclick = closeModal; $('#mclose').focus();
}
/* iPhone-style confirmation sheet for destructive actions (e.g. Reset progress). */
export function confirmModal(o) {
  const m = $('#modal');
  modalReturn = document.activeElement;
  m.classList.add('sheet-modal');
  m.innerHTML = '<div class="modal-in confirm-in" role="alertdialog" aria-modal="true" aria-labelledby="mt" aria-describedby="mb">'
    + '<div class="confirm-card"><h2 id="mt">' + esc(o.title) + '</h2><p id="mb" class="note">' + esc(o.body) + '</p>'
    + '<button type="button" class="confirm-act" id="mconfirm">' + esc(o.confirmLabel || 'Confirm') + '</button></div>'
    + '<button type="button" class="confirm-cancel" id="mclose">' + esc(o.cancelLabel || 'Cancel') + '</button></div>';
  m.hidden = false;
  $('#mclose').onclick = closeModal;
  $('#mconfirm').onclick = () => { closeModal(); if (o.onConfirm) o.onConfirm(); };
  $('#mclose').focus();
}
export function closeModal() { const m = $('#modal'); if (m.hidden) return; m.hidden = true; m.classList.remove('sheet-modal'); if (modalReturn && modalReturn.focus) { try { modalReturn.focus(); } catch (e) { /* element gone */ } } }
export const emblem = (r, lg) => '<div class="emblem' + (lg ? ' lg' : '') + '" role="img" aria-label="Rank ' + r + '"><i aria-hidden="true">' + r + '</i></div>';
export const bar = p => '<div class="bar" aria-hidden="true"><i style="transform:scaleX(' + (clamp(p, 0, 100) / 100).toFixed(3) + ')"></i></div>';
export const ICON = {
  chev: '<svg class="ic chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  gear: '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.04 10.05L21.38 10.47L21.38 13.53L19.04 13.95L18.35 15.6L19.71 17.55L17.55 19.71L15.6 18.35L13.95 19.04L13.53 21.38L10.47 21.38L10.05 19.04L8.4 18.35L6.45 19.71L4.29 17.55L5.65 15.6L4.96 13.95L2.62 13.53L2.62 10.47L4.96 10.05L5.65 8.4L4.29 6.45L6.45 4.29L8.4 5.65L10.05 4.96L10.47 2.62L13.53 2.62L13.95 4.96L15.6 5.65L17.55 4.29L19.71 6.45L18.35 8.4Z"/><circle cx="12" cy="12" r="3"/></svg>'
};

const cleanups = new Set();
export const T = {
  ids: [], raf: 0,
  after(ms, fn) { const id = setTimeout(fn, ms); this.ids.push(['t', id]); return id; },
  every(ms, fn) { const id = setInterval(fn, ms); this.ids.push(['i', id]); return id; },
  onClear(fn) { cleanups.add(fn); },
  clear() { this.ids.forEach(p => { if (p[0] === 't') clearTimeout(p[1]); else clearInterval(p[1]); }); this.ids = []; cancelAnimationFrame(this.raf); stopAmbient(); cleanups.forEach(fn => { try { fn(); } catch (e) { /* ignore */ } }); }
};

/* optional audio cues & ambient bed so practice can be done eyes-off-screen */
export {primeAudio, cue, startAmbient, stopAmbient};

/* ---------- background inertness, shared by covers and sheets ---------- */
export function setInert(on) { ['#app', '#tabs'].forEach(s => { const el = $(s); el.inert = on; if (on) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden'); }); }
function closeLater(el, done) {
  if (!MOTION_MS) { done(); return; }
  el.classList.add('sink');
  const id = setTimeout(() => { CLOSE.delete(id); el.classList.remove('sink'); done(); }, MOTION_MS);
  CLOSE.add(id); el._closeId = id;
}
function cancelClose(el) { if (el._closeId) { clearTimeout(el._closeId); CLOSE.delete(el._closeId); el._closeId = 0; el.classList.remove('sink'); } }

/* ---------- settings sheet ---------- */
let sheetReturn = null;
export const sheetOpen = () => !$('#sheet').hidden && !$('#sheet').classList.contains('sink');
export function openSheet(render) {
  const sh = $('#sheet'), sc = $('#scrim');
  cancelClose(sh); sc.classList.remove('fadeout');
  sheetReturn = document.activeElement;
  render();
  sh.hidden = false; sc.hidden = false; setInert(true);
  $('#sheetBody').scrollTop = 0;
  try { $('#sheetTitle').focus({preventScroll:true}); } catch (e) { /* ignore */ }
}
export function closeSheet() {
  const sh = $('#sheet'), sc = $('#scrim');
  if (sh.hidden) return;
  if (!app.running) setInert(false);
  sc.classList.add('fadeout');
  closeLater(sh, () => { sh.hidden = true; sc.hidden = true; sc.classList.remove('fadeout'); });
  if (sheetReturn && sheetReturn.isConnected && sheetReturn.focus) { try { sheetReturn.focus(); } catch (e) { /* ignore */ } }
}

/* ---------- full-screen cover for drills ---------- */
let runReturn = null;
export const runEl = $('#run'), runBody = $('#runBody'), runTitle = $('#runTitle'), runFoot = $('#runFoot');
/* q: drills still to come in a session; i of n: the current step. partial: see setPartial. */
export const RUN = {active:false, label:'', q:[], i:0, n:0, partial:null};
export function syncSoundBtn() { const b = $('#snd'); b.textContent = app.S.sound ? 'Sound on' : 'Sound off'; b.setAttribute('aria-pressed', String(app.S.sound)); b.setAttribute('aria-label', 'Sound cues, ' + (app.S.sound ? 'on' : 'off')); }
export function setDarkCover(on) {
  runEl.classList.toggle('dark-cover', !!on);
}
export function setSteps(labels, activeIdx) {
  const el = $('#runSteps');
  if (!el) return;
  if (!labels || !labels.length) { el.hidden = true; el.innerHTML = ''; return; }
  el.innerHTML = labels.map((l, i) => '<li class="' + (i < activeIdx ? 'done' : i === activeIdx ? 'now' : '') + '"><i>' + (i + 1) + '</i><span>' + esc(l) + '</span></li>').join('');
  el.hidden = false;
}
export function openRun(title) {
  T.clear(); cancelClose(runEl);
  if (!app.running) runReturn = document.activeElement;
  app.running = true; RUN.partial = null;
  setDarkCover(false);
  if (RUN.active && RUN.steps) setSteps(RUN.steps, RUN.i - 1);
  else setSteps(null);
  runTitle.textContent = RUN.active ? RUN.label + ' · ' + RUN.i + ' of ' + RUN.n : title;
  runBody.innerHTML = ''; runEl.hidden = false; runBody.scrollTop = 0;
  document.body.style.overflow = 'hidden'; setInert(true); syncSoundBtn(); primeAudio();
  showEnd();
}
export function stopRun() {
  T.clear(); app.running = false; RUN.active = false; RUN.q = []; RUN.steps = null; RUN.partial = null;
  setDarkCover(false); setSteps(null);
  document.body.style.overflow = ''; setInert(false);
  closeLater(runEl, () => { runEl.hidden = true; runBody.innerHTML = ''; runFoot.innerHTML = ''; });
  renderAll();
  if (runReturn && runReturn.isConnected && runReturn.focus) { try { runReturn.focus(); } catch (e) { /* ignore */ } }
}
/* Replaces the cover's content and moves focus to its heading. The End control comes back unless the
   screen draws its own footer (result screens do). */
export function setRun(html, foot) {
  runBody.innerHTML = html; runBody.scrollTop = 0;
  if (foot != null) runFoot.innerHTML = foot; else showEnd();
  const h = $('h2', runBody);
  if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({preventScroll:true}); } catch (e) { /* ignore */ } }
}

/* ---------- the End control ----------
   fn() returns null when nothing counts yet, or {type, opts, say, lead}: what award() should credit,
   how to describe it in the confirmation ("The 1 min you did") and the plain lead line afterwards. */
export function setPartial(fn) { RUN.partial = fn || null; }
export function showEnd() {
  runFoot.innerHTML = '<button type="button" class="btn btn-s" id="end">End</button>';
  $('#end').onclick = askEnd;
}
export const minsDone = s => Math.max(1, Math.floor(s / 60)) + ' min';
function askEnd() {
  const p = RUN.partial ? RUN.partial() : null;
  const msg = p ? 'End now? ' + p.say + '.'
    : (RUN.active && RUN.i > 1 ? 'End now? What you finished earlier is saved.' : 'End now? Less than a minute so far, so nothing is logged.');
  runFoot.innerHTML = '<div class="endq" role="group" aria-labelledby="endMsg"><p id="endMsg">' + esc(msg) + '</p><div class="row"><button type="button" class="btn btn-s" id="endYes">End</button><button type="button" class="btn btn-p" id="endNo">Keep going</button></div></div>';
  $('#endNo').onclick = () => { showEnd(); try { $('#end').focus(); } catch (e) { /* ignore */ } };
  $('#endYes').onclick = () => endNow();
  try { $('#endNo').focus(); } catch (e) { /* ignore */ }
}
export function dismissEnd() { if ($('#endYes', runFoot)) { showEnd(); return true; } return false; }
function endNow() {
  const p = RUN.partial ? RUN.partial() : null;
  T.clear();
  if (!p) { stopRun(); return; }
  RUN.q = [];
  const res = award(p.type, Object.assign({}, p.opts, {partial:true}));
  resultScreen({lead:p.lead, lines:[], res, type:p.type});
}
$('#snd').onclick = () => {
  app.S.sound = !app.S.sound;
  save();
  syncSoundBtn();
  if (app.S.sound) {
    primeAudio();
    cue('go');
    if ($('#tp') && app.S.ambient) startAmbient();
  } else {
    stopAmbient();
  }
};

export function choiceRow(name, opts, sel, lab, label) {
  return '<div class="seg" role="group"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '>' + opts.map(v => '<button type="button" class="segb" data-ch="' + name + '" data-v="' + esc(v) + '" aria-pressed="' + (String(v) === String(sel)) + '"><b>' + esc(lab ? lab(v) : v) + '</b></button>').join('') + '</div>';
}
export function wireChoice(name, fn) { $$('[data-ch="' + name + '"]', runBody).forEach(b => { b.onclick = () => fn(b.getAttribute('data-v')); }); }
export function rateHtml(id, label, hints) {
  return '<div class="rate" id="' + id + '" role="group" aria-label="' + esc(label) + '"><div class="rlabel">' + esc(label) + '</div><div class="seg">' + [1, 2, 3, 4, 5].map(n => '<button type="button" class="segb" data-n="' + n + '" aria-pressed="false"><b>' + n + '</b><span>' + esc(hints[n - 1]) + '</span></button>').join('') + '</div></div>';
}
export function wireRate(id, fn) {
  const root = $('#' + id, runBody);
  $$('.segb', root).forEach(b => { b.onclick = () => { $$('.segb', root).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); fn(Number(b.getAttribute('data-n'))); }; });
}

/* System notices for a result: the session's own XP first, then each bonus or title award() reported. */
export function notices(res, type) {
  const bonus = res.notes.reduce((s, n) => { const m = n.match(/\+(\d+) XP/); return s + (m ? Number(m[1]) : 0); }, 0);
  const base = res.xp - bonus, out = ['[Logged] ' + (TYPE_N[type] || 'Session') + (base > 0 ? ' · +' + base + ' XP' : '')];
  res.notes.forEach(n => out.push(n.charAt(0) === '[' ? n : '[' + n.replace(/: /, '] ')));
  if (res.rankUp) out.push('[Rank up] Rank ' + res.rankUp);
  else if (res.levelUp) out.push('[Level up] Level ' + res.levelUp);
  return out;
}
/* o: {lead, lines, res, type, actions:[{id, label, fn}]}. Leads with a plain line about what was done;
   XP and System notices sit below it. */
/* One notice as markup: the bracketed tag in seafoam (done), the XP kept on one line. Text is unchanged. */
function noticeHtml(n) {
  const m = n.match(/^(\[[^\]]+\])\s*(.*?)(\s*·?\s*\+\d+ XP.*)?$/);
  if (!m) return esc(n);
  return '<span class="tag">' + esc(m[1]) + '</span>' + ' ' + esc(m[2]) + (m[3] ? (m[2] ? ' ' : '') + '<span class="xp">' + esc(m[3].trim()) + '</span>' : '');
}
/* The week strip with today's high-water mark coming in from where it stood before this session. */
function resultTide(res) {
  const t = res.tide; if (!t || !t[1]) return '';
  let h = weekHtml();
  if (t[1] > t[0]) h = h.replace('class="wd n' + t[1] + ' today"', 'class="wd n' + t[1] + ' today rise" style="--from:' + (t[0] / 2) + '"');
  return '<div class="tide res">' + h + '</div>';
}
export function resultScreen(o) {
  const res = o.res, inRun = RUN.active && RUN.q.length > 0, lastOne = RUN.active && RUN.q.length === 0;
  RUN.partial = null;
  setDarkCover(false);
  if (res.rankUp) modal('[Rank up] Rank ' + res.rankUp, 'Your log, stats and mosaic carry over.', res.rankUp);
  const lines = (o.lines || []).concat(lastOne ? ['That is today’s session done.'] : []);
  const acts = inRun ? [{id:'nextb', label:'Next: ' + DRILL_N[RUN.q[0].replace(/\d+$/, '')], fn:nextRun}] : (o.actions || []);
  const med = '<div class="med-wrap" aria-hidden="true"><div class="med-glow"></div><div class="med"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 25.5 21 33.5 35.5 16.5"/></svg></div></div>';
  setRun(med + '<h2 class="lead center">' + esc(o.lead) + '</h2>' + (lines.length ? '<div class="stack">' + lines.map(l => '<p class="note center">' + esc(l) + '</p>').join('') + '</div>' : '')
    + '<div class="sys" role="status">' + notices(res, o.type).map(n => '<p>' + noticeHtml(n) + '</p>').join('') + '</div>' + resultTide(res),
    '<div class="stack">' + acts.map((a, i) => '<button type="button" class="btn ' + (i === 0 ? 'btn-p' : 'btn-s') + '" id="' + a.id + '">' + esc(a.label) + '</button>').join('') + '<button type="button" class="btn ' + (acts.length ? 'btn-s' : 'btn-p') + '" id="back">Done</button></div>');
  acts.forEach(a => { $('#' + a.id).onclick = a.fn; });
  $('#back').onclick = stopRun;
}
export const clockText = sec => app.S.hideClock ? '' : fmt(sec);
