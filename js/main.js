import {$} from './util.js';
import {rankOf, DEFAULT_OPENER} from './content.js';
import {app, fresh, sanitize, save, initDb} from './state.js';
import {rollDay} from './rules.js';
import {toast, closeModal, primeAudio, openSheet, closeSheet, sheetOpen, dismissEnd} from './ui.js';
import {runBreath, runRead, runRaid, runCold, runRitual, runField, startRun, SESSION, SHORT} from './drills.js';
import {renderAll, renderSheet} from './views.js';

let resetArmed = false;
function selectText(el) { el.removeAttribute('readonly'); el.focus(); el.select(); }
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
  breath(t) { runBreath({pat:t.getAttribute('data-v')}); },
  read() { runRead(); }, raid() { runRaid(); }, cold() { runCold(false); },
  field() { runField(); },
  /* the Challenge round only appears from Rank D; a stale button does nothing */
  boss() { if (rankOf(app.S.xp) >= 1) runCold(true); },
  /* choosing a practice time no longer pays XP: all progress goes through award() */
  plan(t) { app.S.plan.anchor = t.getAttribute('data-v'); save(); renderSheet(); },
  copysum() { const el = $('#sum'); selectText(el); let ok = false; try { ok = document.execCommand && document.execCommand('copy'); } catch (e) { ok = false; } el.setAttribute('readonly', ''); $('#summsg').textContent = ok ? 'Copied.' : 'Selected. Copy it with your keyboard.'; },
  copy() { const el = $('#bk'); selectText(el); let ok = false; try { ok = document.execCommand && document.execCommand('copy'); } catch (e) { ok = false; } $('#bkmsg').textContent = ok ? 'Copied.' : 'Selected. Copy it with your keyboard.'; },
  import() {
    const bk = $('#bk'), msg = $('#bkmsg');
    try {
      const o = JSON.parse(bk.value);
      if (!o || typeof o !== 'object' || typeof o.xp !== 'number') throw new Error('shape');
      if (JSON.stringify(sanitize(o)) === JSON.stringify(app.S)) { msg.textContent = 'That is the data you already have. Paste a saved backup over the text, then load it.'; return; }
      app.S = sanitize(o); rollDay(); save(); renderAll(); $('#bkmsg').textContent = 'Backup loaded.'; toast('Backup loaded');
    } catch (e) { msg.textContent = 'That text is not a valid backup. Nothing was changed.'; }
  },
  reset(t) {
    const label = t.querySelector('.tt') || t;
    if (!resetArmed) { resetArmed = true; label.textContent = 'Press again to reset everything'; setTimeout(() => { resetArmed = false; const b = $('#rst .tt'); if (b) b.textContent = 'Reset progress'; }, 4000); return; }
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
$('#scrim').addEventListener('click', () => closeSheet());
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
    return;
  }
  if (e.key !== 'Escape') return;
  if (sheetOpen()) { closeSheet(); return; }
  if (app.running) dismissEnd();
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
