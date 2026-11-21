import {$} from './util.js';
import {rankOf, DEFAULT_OPENER} from './content.js';
import {app, fresh, sanitize, save, initDb} from './state.js';
import {rollDay} from './rules.js';
import {toast, closeModal, primeAudio} from './ui.js';
import {runBreath, runRead, runRaid, runCold, runRitual, runDebrief, runField, startRun, RUN_FULL, RUN_SHORT} from './drills.js';
import {renderAll} from './views.js';

let resetArmed = false;
function selectText(el) { el.removeAttribute('readonly'); el.focus(); el.select(); }
const ACT = {
  tab(t) { app.tab = t.getAttribute('data-v'); renderAll(); window.scrollTo(0, 0); },
  energy(t) { app.S.energy = Number(t.getAttribute('data-v')); save(); renderAll(); },
  run(t) { startRun(t.getAttribute('data-v') === 'short' ? RUN_SHORT : RUN_FULL); },
  breath() { runBreath(); }, read() { runRead(); }, raid() { runRaid(); }, cold() { runCold(false); },
  field() { runField(); }, ritual() { runRitual(); }, debrief() { runDebrief(); },
  boss() { if (rankOf(app.S.xp) < 1) { toast('Boss Gauntlet unlocks at Rank D'); return; } runCold(true); },
  plan(t) {
    app.S.plan.anchor = t.getAttribute('data-v');
    if (!app.S.planBonus) { app.S.planBonus = true; app.S.xp += 30; toast('Plan saved: +30 XP'); }
    save(); renderAll();
  },
  mins(t) { app.S.plan.mins = Number(t.getAttribute('data-v')) === 3 ? 3 : 10; save(); renderAll(); },
  twist() { if (app.S.daily.twist) return; app.S.daily.twist = true; app.S.xp += 10; save(); toast('Twist done: +10 XP'); renderAll(); },
  copysum() { const el = $('#sum'); selectText(el); let ok = false; try { ok = document.execCommand && document.execCommand('copy'); } catch (e) { ok = false; } el.setAttribute('readonly', ''); $('#summsg').textContent = ok ? 'Copied.' : 'Selected. Copy it with your keyboard.'; },
  copy() { const el = $('#bk'); selectText(el); let ok = false; try { ok = document.execCommand && document.execCommand('copy'); } catch (e) { ok = false; } $('#bkmsg').textContent = ok ? 'Copied.' : 'Selected. Copy it with your keyboard.'; },
  import() {
    const bk = $('#bk'), msg = $('#bkmsg');
    try {
      const o = JSON.parse(bk.value);
      if (!o || typeof o !== 'object' || typeof o.xp !== 'number') throw new Error('shape');
      if (JSON.stringify(sanitize(o)) === JSON.stringify(app.S)) { msg.textContent = 'That is the data you already have. Paste a saved backup over the text, then load it.'; return; }
      app.S = sanitize(o); rollDay(); save(); renderAll(); toast('Backup loaded');
    } catch (e) { msg.textContent = 'That text is not a valid backup. Nothing was changed.'; }
  },
  reset(t) {
    if (!resetArmed) { resetArmed = true; t.textContent = 'Press again to confirm'; setTimeout(() => { resetArmed = false; const b = $('#rst'); if (b) b.textContent = 'Reset progress'; }, 4000); return; }
    resetArmed = false; app.S = fresh(); rollDay(); save(); renderAll(); toast('Progress reset');
  }
};
document.addEventListener('click', e => {
  const t = e.target.closest && e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = ACT[t.getAttribute('data-act')];
  if (!fn) return;
  try { fn(t); } catch (err) { toast('Something went wrong. Your progress is saved.'); }
});
document.addEventListener('change', e => {
  const id = e.target && e.target.id;
  if (id === 'hard') { app.S.hard = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12); e.target.value = app.S.hard; save(); }
  else if (id === 'opener') { app.S.opener = e.target.value.trim().slice(0, 200) || DEFAULT_OPENER; save(); }
  else if (id === 'skel') { app.S.showSkeleton = e.target.checked; save(); }
  else if (id === 'hclk') { app.S.hideClock = e.target.checked; save(); }
  else if (id === 'snds') { app.S.sound = e.target.checked; save(); primeAudio(); }
});
document.addEventListener('keydown', e => {
  const m = $('#modal');
  if (!m.hidden) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab') { e.preventDefault(); const b = $('#mclose'); if (b) b.focus(); }
  }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !app.running) renderAll(); });
window.addEventListener('error', () => { toast('Something went wrong. Your progress is saved.'); });

rollDay();
renderAll();
initDb();

/* offline support: cache the app so it opens without a connection */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
