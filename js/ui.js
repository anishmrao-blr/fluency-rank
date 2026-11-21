import {$, $$, esc, clamp, fmt} from './util.js';
import {ENERGY, DRILL_N} from './content.js';
import {app, save} from './state.js';
import {nextRun} from './drills.js';
import {renderAll} from './views.js';

export function toast(m) { const c = $('#toasts'), d = document.createElement('div'); d.className = 'toast'; d.textContent = m; c.appendChild(d); setTimeout(() => d.remove(), 3400); }
let modalReturn = null;
export function modal(title, body) {
  const m = $('#modal');
  modalReturn = document.activeElement;
  m.innerHTML = '<div class="panel modal-in" role="alertdialog" aria-modal="true" aria-labelledby="mt"><div class="lbl">System</div><h2 class="t" id="mt">' + esc(title) + '</h2><p>' + esc(body) + '</p><button type="button" class="btn solid" id="mclose">Continue</button></div>';
  m.hidden = false;
  $('#mclose').onclick = closeModal; $('#mclose').focus();
}
export function closeModal() { const m = $('#modal'); if (m.hidden) return; m.hidden = true; if (modalReturn && modalReturn.focus) { try { modalReturn.focus(); } catch (e) { /* element gone */ } } }
export const block = (label, inner, cls) => '<section class="blk ' + (cls || '') + '">' + (label ? '<h2 class="lbl">' + esc(label) + '</h2>' : '') + inner + '</section>';
export const bar = (p, cls) => '<div class="bar ' + (cls || '') + '"><i style="width:' + clamp(p, 0, 100) + '%"></i></div>';
export const energySeg = () => '<div class="seg" role="group" aria-label="Energy right now">' + ENERGY.map((n, i) => '<button type="button" class="segb" data-act="energy" data-v="' + (i + 1) + '" aria-pressed="' + (app.S.energy === i + 1) + '"><b>' + (i + 1) + '</b><span>' + n + '</span></button>').join('') + '</div>';

export const T = {
  ids: [], raf: 0,
  after(ms, fn) { const id = setTimeout(fn, ms); this.ids.push(['t', id]); return id; },
  every(ms, fn) { const id = setInterval(fn, ms); this.ids.push(['i', id]); return id; },
  clear() { this.ids.forEach(p => { if (p[0] === 't') clearTimeout(p[1]); else clearInterval(p[1]); }); this.ids = []; cancelAnimationFrame(this.raf); }
};

/* optional audio cues so practice can be done eyes-off-screen */
let ac = null;
export function primeAudio() {
  if (!app.S.sound) return;
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; }
}
export function cue(kind) {
  if (!app.S.sound || !ac) return;
  try {
    const f = {in:520, out:390, go:660, end:440}[kind] || 440, o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'end' ? 0.5 : 0.22));
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.55);
  } catch (e) { /* audio is optional */ }
}

/* ---------- run overlay ---------- */
let runReturn = null;
export const runEl = $('#run'), runBody = $('#runBody'), runTitle = $('#runTitle');
export const RUN = {active:false, q:[], i:0, n:0};
export function setInert(on) { ['#app', '#tabs'].forEach(s => { const el = $(s); el.inert = on; if (on) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden'); }); }
export function syncSoundBtn() { const b = $('#snd'); b.textContent = app.S.sound ? 'Sound on' : 'Sound off'; b.setAttribute('aria-pressed', String(app.S.sound)); }
export function openRun(title) {
  T.clear(); if (!app.running) runReturn = document.activeElement;
  app.running = true;
  runTitle.textContent = RUN.active ? 'Run ' + RUN.i + ' of ' + RUN.n + ': ' + title : title;
  runBody.innerHTML = ''; runEl.style.display = 'block'; runEl.scrollTop = 0;
  document.body.style.overflow = 'hidden'; setInert(true); syncSoundBtn(); primeAudio();
}
export function stopRun() {
  T.clear(); app.running = false; RUN.active = false; RUN.q = [];
  runEl.style.display = 'none'; document.body.style.overflow = ''; setInert(false);
  renderAll();
  if (runReturn && runReturn.isConnected && runReturn.focus) { try { runReturn.focus(); } catch (e) { /* ignore */ } }
}
export function setRun(html) {
  runBody.innerHTML = html; runEl.scrollTop = 0;
  const h = $('h2', runBody);
  if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({preventScroll:true}); } catch (e) { /* ignore */ } }
}
$('#abort').onclick = stopRun;
$('#snd').onclick = () => { app.S.sound = !app.S.sound; save(); syncSoundBtn(); primeAudio(); cue('go'); };

export function choiceRow(name, opts, sel, lab) {
  return '<div class="seg" role="group">' + opts.map(v => '<button type="button" class="segb" data-ch="' + name + '" data-v="' + esc(v) + '" aria-pressed="' + (String(v) === String(sel)) + '"><b>' + esc(lab ? lab(v) : v) + '</b></button>').join('') + '</div>';
}
export function wireChoice(name, fn) { $$('[data-ch="' + name + '"]', runBody).forEach(b => { b.onclick = () => fn(b.getAttribute('data-v')); }); }
export function rateHtml(id, label, hints) {
  return '<div class="rate" id="' + id + '" role="group" aria-label="' + esc(label) + '"><div class="rlabel">' + esc(label) + '</div><div class="seg">' + [1, 2, 3, 4, 5].map(n => '<button type="button" class="segb" data-n="' + n + '" aria-pressed="false"><b>' + n + '</b><span>' + esc(hints[n - 1]) + '</span></button>').join('') + '</div></div>';
}
export function wireRate(id, fn) {
  const root = $('#' + id, runBody);
  $$('.segb', root).forEach(b => { b.onclick = () => { $$('.segb', root).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); fn(Number(b.getAttribute('data-n'))); }; });
}
export function afterAward(res) {
  if (res.rankUp) modal('Rank up', 'You reached Rank ' + res.rankUp + '. Your log, stats and mosaic carry over.');
  else if (res.levelUp) toast('Level ' + res.levelUp + ' reached');
  res.notes.slice(0, 3).forEach(n => toast(n));
}
export function resultScreen(title, lines, res, again) {
  afterAward(res);
  const inRun = RUN.active && RUN.q.length > 0;
  const lastOne = RUN.active && RUN.q.length === 0;
  const all = lastOne ? lines.concat(['Run complete.']) : lines;
  setRun(block(title, '<div class="xp mono">+' + res.xp + ' XP</div>' + (res.tired ? '<p class="note">Tired-session bonus applied (+50% session XP).</p>' : '') + '<ul class="plain">' + all.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul><div class="row">' + (inRun ? '<button type="button" class="btn solid" id="nextb">Next: ' + DRILL_N[RUN.q[0]] + '</button>' : (again ? '<button type="button" class="btn solid" id="again">' + esc(again.label) + '</button>' : '')) + '<button type="button" class="btn" id="back">' + (inRun ? 'End run' : 'Done') + '</button></div>'));
  if (inRun) $('#nextb').onclick = nextRun; else if (again) $('#again').onclick = again.fn;
  $('#back').onclick = stopRun;
}
export const clockText = sec => app.S.hideClock ? '' : fmt(sec);
