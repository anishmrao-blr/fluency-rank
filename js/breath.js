import {$, esc, clamp, reduceMotion, shuffle, fmt} from './util.js';
import {PATTERNS, PHRASES} from './content.js';
import {weavePhrases} from './personal.js';
import {app, save} from './state.js';
import {award} from './rules.js';
import {T, cue, runBody, openRun, setRun, setPartial, setDarkCover, choiceRow, wireChoice, resultScreen} from './ui.js';

export const LOW = 0.22, HIGH = 0.72;
export const BREATH_IN = s => ({w:'Breathe in', s, to:HIGH, cue:'in'});
export const BREATH_OUT = s => ({w:'Out, slowly', s, to:LOW, cue:'out'});
export const SIGH = [
  {w:'Breathe in', s:2, to:0.6, cue:'in'},
  {w:'In again, a little more', s:1, to:HIGH, cue:'in'},
  {w:'Out, slowly', s:6, to:LOW, cue:'out'}
];

/* ---------- optional voice guide (speechSynthesis) ---------- */
export function speakCue(text) {
  if (!app.S.voice || !text) return;
  try {
    const ss = window.speechSynthesis, Utt = window.SpeechSynthesisUtterance;
    if (!ss || !Utt) return;
    ss.cancel();
    const u = new Utt(text);
    u.rate = 0.95;
    ss.speak(u);
  } catch (e) { /* voice guide is optional */ }
}
export function stopVoice() {
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
}

/* ---------- optional screen Wake Lock with silent fallback ---------- */
let wakeSentinel = null, wantWake = false;
export function acquireWakeLock() {
  wantWake = true;
  try {
    if (!navigator.wakeLock || !navigator.wakeLock.request) return;
    navigator.wakeLock.request('screen').then(s => {
      if (!wantWake) { try { s.release(); } catch (e) {} return; }
      wakeSentinel = s;
      s.addEventListener && s.addEventListener('release', () => { if (wakeSentinel === s) wakeSentinel = null; });
    }).catch(() => {});
  } catch (e) { /* wake lock is optional */ }
}
export function releaseWakeLock() {
  wantWake = false;
  const s = wakeSentinel; wakeSentinel = null;
  if (s) { try { s.release(); } catch (e) { /* ignore */ } }
}
let cleanupRegistered = false;
function ensureCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;
  T.onClear(() => { stopVoice(); releaseWakeLock(); });
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wantWake && !wakeSentinel) acquireWakeLock();
});

/* ---------- phases for each technique or custom pattern ---------- */
export function customDesc(c) {
  const parts = [c.inS + ' in'];
  if (c.hold1 > 0) parts.push(c.hold1 + ' hold');
  parts.push(c.outS + ' out');
  if (c.hold2 > 0) parts.push(c.hold2 + ' hold');
  return parts.join(', ');
}
export function phasesFor(key, custom) {
  if (key === 'sigh') return SIGH;
  if (key === 'box') return [BREATH_IN(4), {w:'Hold', s:4, to:HIGH, cue:'hold'}, BREATH_OUT(4), {w:'Hold', s:4, to:LOW, cue:'hold'}];
  if (key === 'custom') {
    const c = custom || app.S.customBreath || {inS:4, hold1:0, outS:6, hold2:0};
    const out = [BREATH_IN(c.inS)];
    if (c.hold1 > 0) out.push({w:'Hold', s:c.hold1, to:HIGH, cue:'hold'});
    out.push(BREATH_OUT(c.outS));
    if (c.hold2 > 0) out.push({w:'Hold', s:c.hold2, to:LOW, cue:'hold'});
    return out;
  }
  const P = PATTERNS[key] || PATTERNS.gentle;
  return [BREATH_IN(P.inS), P.speak ? {w:'Say it on the out-breath', s:P.outS, to:LOW, cue:'out'} : BREATH_OUT(P.outS)];
}

/* ---------- the tide pacer ----------
   Water fills the cover from the bottom. Its surface is two layered sine waves drifting at different
   speeds; the level eases sinusoidally through each phase, so it slows at the top and bottom of a
   breath. Only transform is animated. Reduced motion: no wave and no slide; the word changes and a
   thin bar steps once a second. Phase words are announced through a polite live region. */
function wavePath(periods, amp) {
  let d = 'M0 14';
  for (let x = 4; x <= 400; x += 4) d += ' L' + x + ' ' + (14 + amp * Math.sin(x / 400 * periods * 2 * Math.PI)).toFixed(2);
  return d + ' L400 28 L0 28 Z';
}
const WAVES = '<svg class="tp-wave back" viewBox="0 0 400 28" preserveAspectRatio="none"><path d="' + wavePath(4, 7) + '"/></svg><svg class="tp-wave front" viewBox="0 0 400 28" preserveAspectRatio="none"><path d="' + wavePath(6, 5) + '"/></svg>';
const SOUNDINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => '<i style="top:' + (i * 10) + '%"' + (i === 5 ? ' class="mid"' : '') + '></i>').join('');

/* o: {title, head, phases:[{w, s, to, cue}], cycles | totalS, say(cycle, phase) -> text, onDone(cycles)}.
   Returns {elapsed()} in seconds. */
export function tidePacer(o) {
  const ph = o.phases, cycS = ph.reduce((a, p) => a + p.s, 0), totalS = o.totalS || cycS * o.cycles;
  ensureCleanup();
  acquireWakeLock();
  setDarkCover(true);
  const mode = app.S.pacerStyle === 'tide' ? 'tide' : 'bloom';
  setRun('<div class="tp-ui"><h2 class="h-t">' + esc(o.title) + '</h2>' + (o.head || '') + '<div class="tp-meta"><span id="tpCy"></span><span id="tpRem"></span><button type="button" class="mode-chip" id="tpMode" aria-label="Switch pacer visual">' + (mode === 'bloom' ? 'Orb view' : 'Tide view') + '</button></div><p class="tp-say" id="tpSay"></p></div>'
    + '<p class="sr" aria-live="polite" id="tpLive"></p>'
    + '<div class="tp' + (reduceMotion ? ' rm' : '') + (mode === 'bloom' ? ' bloom-on' : '') + '" id="tp" aria-hidden="true">'
    + '<div class="tp-bloom" id="tpB"><div class="tp-petals"><span></span><span></span><span></span><span></span></div><div class="tp-core"></div></div>'
    + '<div class="tp-water" id="tpW">' + WAVES + '</div><div class="tp-snd">' + SOUNDINGS + '</div><div class="tp-surf" id="tpS"><div class="tp-word" id="tpWord">Get ready</div><div class="tp-count" id="tpCount"></div></div><div class="tp-bar"><i id="tpBar"></i></div></div>');
  const W = $('#tpW'), S = $('#tpS'), B = $('#tpB'), word = $('#tpWord'), count = $('#tpCount'), live = $('#tpLive'), cy = $('#tpCy'), rem = $('#tpRem'), say = $('#tpSay'), tb = $('#tpBar');
  const start = performance.now();
  const elapsed = () => (performance.now() - start) / 1000;
  /* the gauge starts below the text block, so high water and the phase word never run under the copy */
  const tp = $('#tp'), ui = $('.tp-ui', runBody), snd = $('.tp-snd', tp);
  const modeBtn = $('#tpMode');
  if (modeBtn) modeBtn.onclick = () => {
    app.S.pacerStyle = app.S.pacerStyle === 'tide' ? 'bloom' : 'tide';
    save();
    tp.classList.toggle('bloom-on', app.S.pacerStyle === 'bloom');
    modeBtn.textContent = app.S.pacerStyle === 'bloom' ? 'Orb view' : 'Tide view';
  };
  /* ...and it ends above the End control, so low water and the count never run under it. The water
     body still reaches the bottom of the screen. Measured once, before any End confirmation opens. */
  const footH = ($('#runFoot') || {}).offsetHeight || 0;
  let span = 1;
  const fit = () => {
    const b = ui.getBoundingClientRect().bottom - $('#run').getBoundingClientRect().top; if (b > 0) tp.style.top = Math.round(b + 64) + 'px';
    const H = tp.clientHeight; if (H > 0 && footH) { span = clamp((H - footH - 8) / H, 0.5, 1); snd.style.bottom = Math.round(H * (1 - span)) + 'px'; }
  };
  fit();
  const place = lvl => {
    const t = 'translateY(' + (span * (1 - lvl) * 100).toFixed(2) + '%)';
    W.style.transform = t; S.style.transform = t;
    if (B) { const sc = 0.78 + ((lvl - LOW) / (HIGH - LOW)) * 0.44; B.style.transform = 'scale(' + sc.toFixed(3) + ')'; }
  };
  let last = '';
  const frame = () => {
    const el = elapsed();
    if (el >= totalS) { if (!reduceMotion) place(LOW); releaseWakeLock(); stopVoice(); cue('end'); o.onDone(Math.round(totalS / cycS)); return; }
    const idx = Math.floor(el / cycS), pos = el - idx * cycS;
    let k = 0, acc = 0;
    while (k < ph.length - 1 && pos >= acc + ph[k].s) { acc += ph[k].s; k++; }
    const P = ph[k], p = clamp((pos - acc) / P.s, 0, 1), from = ph[(k + ph.length - 1) % ph.length].to;
    if (reduceMotion) {
      const stepped = from + (P.to - from) * Math.min(1, Math.floor(p * P.s + 1e-6) / P.s);
      tb.style.transform = 'scaleX(' + ((stepped - LOW) / (HIGH - LOW)).toFixed(3) + ')';
    } else place(from + (P.to - from) * (1 - Math.cos(Math.PI * p)) / 2);
    const key = idx + ':' + k;
    if (key !== last) {
      last = key; cue(P.cue); speakCue(P.w);
      word.textContent = P.w; live.textContent = P.w;
      cy.textContent = 'Breath ' + (idx + 1) + (o.cycles ? ' of ' + o.cycles : '');
      say.textContent = o.say ? o.say(idx, k) || '' : '';
      fit();
    }
    count.textContent = app.S.hideClock ? '' : String(Math.max(1, Math.ceil(P.s - (pos - acc))));
    rem.textContent = app.S.hideClock ? '' : fmt(Math.ceil(totalS - el)) + ' left';
    T.raf = requestAnimationFrame(frame);
  };
  T.raf = requestAnimationFrame(frame);
  return {elapsed};
}

/* ---------- Breathe drill ---------- */
const PAT_HOW = {
  sigh:'Take two breaths in through the nose, then let a long breath out through the mouth.',
  speak:'Breathe in through the nose, then say the phrase softly on one easy out-breath.',
  box:'Breathe in, hold gently, breathe out, and rest for the same count.',
  slow:'Let the out-breath run twice as long as the in-breath.',
  resonance:'Keep each breath light and quiet, around six breaths a minute.',
  gentle:'In through the nose, out slowly through the mouth.'
};

export function runBreath(o) {
  o = o || {};
  const isCustom = o.pat === 'custom';
  let pat = isCustom ? 'custom' : (PATTERNS[o.pat] ? o.pat : 'gentle');
  let mins = o.auto ? 1 : ([1, 3, 5].indexOf(Number(o.mins)) >= 0 ? Number(o.mins) : (app.S.breathMins || 3));
  openRun('Breathe');

  const metaInfo = () => {
    if (pat === 'custom') return {n:'Custom pattern', d:customDesc(app.S.customBreath), ev:'', speak:false};
    return PATTERNS[pat];
  };

  const setup = () => {
    const P = metaInfo();
    setPartial(null);
    if (pat === 'custom') {
      const c = app.S.customBreath;
      setRun('<h2 class="h-t">Custom pattern</h2><p class="note">Set each part of the breath. Set either hold to 0 to skip it.</p>'
        + '<div class="group">'
        + '<div class="field"><label for="cbIn">Breathe in: <span id="cbInV" class="num">' + c.inS + '</span> s</label><input type="range" id="cbIn" min="2" max="8" step="1" value="' + c.inS + '"></div>'
        + '<div class="field"><label for="cbH1">Hold after inhale: <span id="cbH1V" class="num">' + c.hold1 + '</span> s</label><input type="range" id="cbH1" min="0" max="8" step="1" value="' + c.hold1 + '"></div>'
        + '<div class="field"><label for="cbOut">Breathe out: <span id="cbOutV" class="num">' + c.outS + '</span> s</label><input type="range" id="cbOut" min="2" max="12" step="1" value="' + c.outS + '"></div>'
        + '<div class="field"><label for="cbH2">Hold after exhale: <span id="cbH2V" class="num">' + c.hold2 + '</span> s</label><input type="range" id="cbH2" min="0" max="8" step="1" value="' + c.hold2 + '"></div>'
        + '</div>'
        + '<div class="lab" id="lenL">Length</div>' + choiceRow('mins', [1, 3, 5], mins, v => v + ' min', 'Length')
        + '<button type="button" class="btn btn-p" id="go">Begin</button>');
      const bind = (id, key, vid) => { $('#' + id).oninput = function () { app.S.customBreath[key] = Number(this.value); $('#' + vid).textContent = this.value; save(); }; };
      bind('cbIn', 'inS', 'cbInV'); bind('cbH1', 'hold1', 'cbH1V'); bind('cbOut', 'outS', 'cbOutV'); bind('cbH2', 'hold2', 'cbH2V');
    } else {
      setRun('<h2 class="h-t">' + esc(P.n) + '</h2><p class="note">' + esc(P.d) + '. ' + esc(PAT_HOW[pat] || '') + '</p>'
        + (P.ev ? '<p class="ev-note">' + esc(P.ev) + '</p>' : '')
        + '<div class="lab" id="lenL">Length</div>' + choiceRow('mins', [1, 3, 5], mins, v => v + ' min', 'Length')
        + '<button type="button" class="btn btn-p" id="go">Begin</button>');
    }
    wireChoice('mins', v => { mins = Number(v); app.S.breathMins = mins; save(); setup(); });
    $('#go').onclick = begin;
  };

  const begin = () => {
    const P = metaInfo(), phrases = P.speak ? shuffle(weavePhrases(PHRASES, app.S)) : null;
    const pc = tidePacer({
      title:P.n,
      totalS:mins * 60,
      phases:phasesFor(pat, app.S.customBreath),
      say:phrases ? (i, k) => (k === 0 ? 'Next: ' : 'Say: ') + phrases[i % phrases.length] : null,
      onDone:cycles => {
        const res = award('breath', {pts:{breath:6 * mins}, q:'breath', meta:P.n + ', ' + mins + ' min'});
        resultScreen({lead:'You breathed for ' + mins + ' min.', lines:[cycles + ' breaths, ' + P.d.toLowerCase() + '.', 'Carry this pace into your first sentence.'], res, type:'breath', actions:o.auto ? [] : [{id:'again', label:'Go again', fn:o.instant ? begin : setup}]});
      }
    });
    setPartial(() => {
      const el = pc.elapsed(); if (el < 60) return null;
      const m = Math.floor(el / 60);
      return {type:'breath', opts:{pts:{breath:6 * m}, q:'breath', meta:P.n + ', ' + m + ' min'}, say:'The ' + m + ' min you did still counts', lead:'You breathed for ' + m + ' min. It counts.'};
    });
  };

  if (o.auto || o.instant) begin(); else setup();
}
