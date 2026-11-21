import {$, $$, esc, rnd, clamp, reduceMotion, shuffle, fmt, dstr, dayNum} from './util.js';
import {FLU, PATTERNS, PHRASES, WPM, PASSAGES, QUESTIONS, STALL, LETTERS, CATS, MISSIONS} from './content.js';
import {app, save} from './state.js';
import {award} from './rules.js';
import {toast, bar, T, cue, runBody, RUN, openRun, setRun, setPartial, minsDone, choiceRow, wireChoice, rateHtml, wireRate, resultScreen, ICON} from './ui.js';

export const QUSED = {};
export function nextQuestion() {
  if (Object.keys(QUSED).length >= QUESTIONS.length) Object.keys(QUSED).forEach(k => delete QUSED[k]);
  let i, g = 0; do { i = rnd(QUESTIONS.length); g++; } while (QUSED[i] && g < 200);
  QUSED[i] = 1; return QUESTIONS[i];
}
export function pickRaid(last) {
  const hard = Array.from(new Set((app.S.hard || '').split('')));
  const weak = Object.keys(app.S.weak);
  const pool = hard.concat(weak);
  const L = (pool.length && Math.random() < 0.5) ? pool[rnd(pool.length)] : LETTERS[rnd(LETTERS.length)];
  let C, g = 0; do { C = CATS[rnd(CATS.length)]; g++; } while (C === last && g < 50);
  return {L, C};
}
const barId = id => bar(0).replace('<i ', '<i id="' + id + '" ');
const setBar = (id, p) => { const el = $('#' + id); if (el) el.style.transform = 'scaleX(' + (clamp(p, 0, 100) / 100).toFixed(3) + ')'; };

/* ---------- the tide pacer ----------
   Water fills the cover from the bottom. Its surface is two layered sine waves drifting at different
   speeds; the level eases sinusoidally through each phase, so it slows at the top and bottom of a
   breath. Only transform is animated. Reduced motion: no wave and no slide; the word changes and a
   thin bar steps once a second. Phase words are announced through a polite live region. */
export const LOW = 0.22, HIGH = 0.72;
const BREATH_IN = s => ({w:'Breathe in', s, to:HIGH, cue:'in'});
const BREATH_OUT = s => ({w:'Out, slowly', s, to:LOW, cue:'out'});
export const SIGH = [{w:'Breathe in', s:2, to:0.6, cue:'in'}, {w:'In again, a little more', s:1, to:HIGH, cue:'in'}, {w:'Out, slowly', s:6, to:LOW, cue:'out'}];
/* one sine surface across 400 units; the SVG is 200% wide and drifts by half, so whole periods loop seamlessly */
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
  setRun('<div class="tp-ui"><h2 class="h-t">' + esc(o.title) + '</h2>' + (o.head || '') + '<div class="tp-meta"><span id="tpCy"></span><span id="tpRem"></span></div><p class="tp-say" id="tpSay"></p></div>'
    + '<p class="sr" aria-live="polite" id="tpLive"></p>'
    + '<div class="tp' + (reduceMotion ? ' rm' : '') + '" id="tp" aria-hidden="true"><div class="tp-water" id="tpW">' + WAVES + '</div><div class="tp-snd">' + SOUNDINGS + '</div><div class="tp-surf" id="tpS"><div class="tp-word" id="tpWord">Get ready</div><div class="tp-count" id="tpCount"></div></div><div class="tp-bar"><i id="tpBar"></i></div></div>');
  const W = $('#tpW'), S = $('#tpS'), word = $('#tpWord'), count = $('#tpCount'), live = $('#tpLive'), cy = $('#tpCy'), rem = $('#tpRem'), say = $('#tpSay'), tb = $('#tpBar');
  const start = performance.now();
  const elapsed = () => (performance.now() - start) / 1000;
  /* the gauge starts below the text block, so high water and the phase word never run under the copy */
  const tp = $('#tp'), ui = $('.tp-ui', runBody);
  const fit = () => { const b = ui.getBoundingClientRect().bottom - $('#run').getBoundingClientRect().top; if (b > 0) tp.style.top = Math.round(b + 64) + 'px'; };
  fit();
  const place = lvl => { const t = 'translateY(' + ((1 - lvl) * 100).toFixed(2) + '%)'; W.style.transform = t; S.style.transform = t; };
  let last = '';
  const frame = () => {
    const el = elapsed();
    if (el >= totalS) { if (!reduceMotion) place(LOW); cue('end'); o.onDone(Math.round(totalS / cycS)); return; }
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
      last = key; cue(P.cue);
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

/* ---------- Breathe ---------- */
const PAT_HOW = {gentle:'In through the nose, out slowly through the mouth.', slow:'Let the out-breath run longer than the in-breath.', speak:'Breathe in, then say the phrase softly on one easy out-breath.'};
export function runBreath(o) {
  o = o || {};
  let pat = PATTERNS[o.pat] ? o.pat : 'gentle', mins = 2;
  openRun('Breathe');
  const setup = () => {
    const P = PATTERNS[pat];
    setPartial(null);
    setRun('<h2 class="h-t">' + esc(P.n) + '</h2><p class="note">' + esc(P.d) + '. ' + PAT_HOW[pat] + '</p><div class="lab" id="lenL">Length</div>' + choiceRow('mins', [1, 2, 3, 5], mins, v => v + ' min', 'Length') + '<button type="button" class="btn btn-p" id="go">Begin</button>');
    wireChoice('mins', v => { mins = Number(v); setup(); });
    $('#go').onclick = begin;
  };
  const begin = () => {
    const P = PATTERNS[pat], phrases = P.speak ? shuffle(PHRASES) : null;
    const pc = tidePacer({title:P.n, totalS:mins * 60,
      phases:[BREATH_IN(P.inS), P.speak ? {w:'Say it on the out-breath', s:P.outS, to:LOW, cue:'out'} : BREATH_OUT(P.outS)],
      say: phrases ? (i, k) => (k === 0 ? 'Next: ' : 'Say: ') + phrases[i % phrases.length] : null,
      onDone: cycles => {
        const res = award('breath', {pts:{breath:6 * mins}, q:'breath', meta:P.n + ', ' + mins + ' min'});
        resultScreen({lead:'You breathed for ' + mins + ' min.', lines:[cycles + ' breaths, ' + P.d.toLowerCase() + '.', 'Carry this pace into your first sentence.'], res, type:'breath', actions:o.auto ? [] : [{id:'again', label:'Go again', fn:setup}]});
      }});
    setPartial(() => {
      const el = pc.elapsed(); if (el < 60) return null;
      const m = Math.floor(el / 60);
      return {type:'breath', opts:{pts:{breath:6 * m}, q:'breath', meta:P.n + ', ' + m + ' min'}, say:'The ' + m + ' min you did still counts', lead:'You breathed for ' + m + ' min. It counts.'};
    });
  };
  if (o.auto) { mins = 1; begin(); } else setup();
}

/* ---------- Read aloud ---------- */
export function coachRead(sc, wpm) {
  if (sc >= 4) return 'Smooth at ' + wpm + ' words a minute. Two smooth reads in a row at your pace target move it up.';
  if (sc <= 2) return 'Try about 10 words a minute slower, and make the first sound of each phrase softer.';
  return 'Mixed. Start each phrase on the out-breath and pause at the marks.';
}
let lastPassage = -1;
export function runRead(o) {
  o = o || {};
  openRun('Read aloud');
  let sel = 0, wpm = WPM[app.S.rung];
  const readPartial = (say, P) => ({type:'read', opts:{pts:{pace:5, breath:2}, q:'read', meta:P.t + ' at ' + wpm + ' wpm'}, say, lead:'You read part of “' + P.t + '” aloud. It counts.'});
  const setup = () => {
    setPartial(null);
    setRun('<h2 class="h-t">Read aloud</h2><p class="note">Words light up at your pace. Read aloud, breathe at each ▾ mark and start each phrase softly. Your pace target is ' + WPM[app.S.rung] + ' words a minute. Two smooth reads in a row at the target move it up.</p><div class="lab" id="psL">Passage</div><div class="group" role="group" aria-labelledby="psL">' + PASSAGES.map((p, i) => '<button type="button" class="li" data-ch="ps" data-v="' + i + '" aria-pressed="' + (i === sel) + '"><span class="grow"><span class="tt">' + esc(p.t) + '</span><span class="ds">' + p.x.split(/\s+/).length + ' words</span></span><svg class="ic ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>').join('') + '</div><label class="lab" for="wpm">Pace: <span id="wv" class="num">' + wpm + '</span> words a minute</label><input type="range" id="wpm" min="60" max="150" step="5" value="' + wpm + '"><p class="note">Conversation runs near 150. Start slower than feels natural. A pace away from your target does not move the target.</p><button type="button" class="btn btn-p" id="go">Start reading</button>');
    $('#wpm').oninput = function () { wpm = Number(this.value); $('#wv').textContent = wpm; };
    wireChoice('ps', v => { sel = Number(v); setup(); });
    $('#go').onclick = play;
  };
  const play = () => {
    const P = PASSAGES[sel], words = P.x.split(/\s+/), t0 = performance.now();
    setRun('<h2 class="h-t">' + esc(P.t) + '</h2><p class="note num">' + wpm + ' words a minute</p><div class="reader" id="rd">' + words.map(w => '<span class="w' + (/[,;:]$/.test(w) ? ' c' : '') + (/[.?!]$/.test(w) ? ' s' : '') + '">' + esc(w) + '</span>').join(' ') + '</div>');
    setPartial(() => { const el = (performance.now() - t0) / 1000; return el >= 60 ? readPartial('The ' + minsDone(el) + ' you read still counts', P) : null; });
    const spans = $$('.w', runBody), base = 60000 / wpm;
    let i = 0;
    const step = () => {
      if (i > 0) { spans[i - 1].classList.remove('now'); spans[i - 1].classList.add('done'); }
      if (i >= spans.length) { T.after(500, rate); return; }
      const w = words[i];
      spans[i].classList.add('now');
      const d = base * (1 + (/[,;:]$/.test(w) ? 0.6 : 0) + (/[.?!]$/.test(w) ? 1.4 : 0) + (w.length > 8 ? 0.3 : 0));
      i++; T.after(d, step);
    };
    step();
  };
  const rate = () => {
    let sc = 0;
    const P = PASSAGES[sel];
    setPartial(() => readPartial('The passage you read still counts', P));
    setRun('<h2 class="h-t">How smooth was that?</h2>' + rateHtml('r1', 'Rate your fluency, not your effort.', FLU) + '<button type="button" class="btn btn-p" id="sub" disabled>Log it</button>');
    wireRate('r1', n => { sc = n; $('#sub').disabled = false; });
    $('#sub').onclick = () => {
      const coach = coachRead(sc, wpm), onTarget = wpm === WPM[app.S.rung];
      let note = '';
      if (onTarget) {
        if (sc >= 4) { app.S.up++; app.S.down = 0; if (app.S.up >= 2 && app.S.rung < WPM.length - 1) { app.S.rung++; app.S.up = 0; note = 'Pace target up: your next read starts at ' + WPM[app.S.rung] + ' words a minute.'; } }
        else if (sc <= 2) { app.S.up = 0; app.S.down++; if (app.S.down >= 2 && app.S.rung > 0) { app.S.rung--; app.S.down = 0; note = 'Pace target eased to ' + WPM[app.S.rung] + ' words a minute. Slower is part of the plan.'; } }
        else { app.S.up = 0; app.S.down = 0; }
      }
      const res = award('read', {pts:{pace:5 + sc * 2, breath:2}, q:'read', score:sc, meta:P.t + ' at ' + wpm + ' wpm'});
      resultScreen({lead:'You read “' + P.t + '” aloud at ' + wpm + ' words a minute.', lines:['Fluency ' + sc + ' of 5.', coach].concat(note ? [note] : []), res, type:'read', actions:o.auto ? [] : [{id:'again', label:'Another passage', fn:() => { wpm = WPM[app.S.rung]; setup(); }}]});
    };
  };
  if (o.auto) { do { sel = rnd(PASSAGES.length); } while (sel === lastPassage && PASSAGES.length > 1); lastPassage = sel; play(); } else setup();
}

/* ---------- Word warm-up ---------- */
export function runRaid(o) {
  o = o || {};
  openRun('Word warm-up');
  let secs = o.secs || 45, last = '';
  const prep = () => { const q = pickRaid(last); last = q.C; show(q); };
  const show = q => {
    setPartial(null);
    setRun('<div class="letter" aria-hidden="true">' + q.L + '</div><h2 class="h-t center">Words that start with ' + q.L + ': ' + esc(q.C.toLowerCase()) + '</h2><p class="note center">Say each word aloud and tap +1 as you go. Breathe in first and begin on the out-breath.</p>' + (o.secs ? '' : '<div class="lab" id="secL">Round length</div>' + choiceRow('secs', [30, 45, 60], secs, v => v + ' s', 'Round length')) + '<button type="button" class="btn btn-p" id="go">Start the clock</button>');
    wireChoice('secs', v => { secs = Number(v); show(q); });
    $('#go').onclick = () => play(q);
  };
  const play = q => {
    let count = 0, blanks = 0, total = secs;
    const t0 = performance.now();
    setRun('<h2 class="h-t center">' + q.L + ': ' + esc(q.C.toLowerCase()) + '</h2><div class="clock" id="clk" role="timer" aria-live="off">' + (app.S.hideClock ? '' : total + '.0 s') + '</div>' + barId('tb') + '<div class="count" id="cnt" aria-live="polite">0</div><button type="button" class="btn btn-p" id="plus" aria-label="Add one word">+1 word</button><div class="row"><button type="button" class="btn btn-s" id="blank">I blanked</button><button type="button" class="btn btn-s" id="more" aria-label="Add 15 seconds">+15 s</button></div><p class="note" id="tip">If you blank: pause, breathe out, say “let me think”, then keep going.</p>');
    cue('go');
    setPartial(() => { const el = (performance.now() - t0) / 1000; return el >= 60 ? {type:'raid', opts:{pts:{retrieval:3 + Math.min(count, 12)}, q:'raid', meta:q.L + ', ' + q.C + ': ' + count + ' words'}, say:'The ' + minsDone(el) + ' you did still counts', lead:'You named ' + count + ' words. It counts.'} : null; });
    $('#plus').onclick = () => { count++; $('#cnt').textContent = count; };
    $('#blank').onclick = () => { blanks++; $('#tip').textContent = 'Blank noted. A pause is fine. Breathe out and restart softly.'; };
    $('#more').onclick = () => { total += 15; };
    const iv = T.every(100, () => {
      const left = Math.max(0, total - (performance.now() - t0) / 1000);
      if (!app.S.hideClock) $('#clk').textContent = left.toFixed(1) + ' s';
      setBar('tb', (1 - left / total) * 100);
      if (left <= 0) { clearInterval(iv); cue('end'); finish(q, count, blanks, total); }
    });
  };
  const finish = (q, count, blanks, total) => {
    const c = Math.min(count, 12), w = app.S.weak[q.L] || 0;
    const nw = clamp(w + ((blanks > 0 || count <= 2) ? 1 : 0) - ((count >= 6 && blanks === 0) ? 1 : 0), 0, 5);
    if (nw > 0) app.S.weak[q.L] = nw; else delete app.S.weak[q.L];
    const res = award('raid', {pts:{retrieval:3 + c}, q:'raid', meta:q.L + ', ' + q.C + ': ' + count + ' words'});
    const coach = nw > w ? q.L + ' will come back sooner. Spaced repeats on hard sounds are how they get easier.' : (count >= 6 && blanks === 0 ? 'A clean round. ' + q.L + ' is getting easier.' : 'Recovering from a blank is the skill, not avoiding one.');
    resultScreen({lead:'You said ' + count + ' words in ' + total + ' seconds' + (blanks ? ', with ' + blanks + ' blank' + (blanks > 1 ? 's' : '') : '') + '.', lines:[coach], res, type:'raid', actions:o.auto ? [] : [{id:'again', label:'Next round', fn:prep}]});
  };
  prep();
}

/* ---------- Practice questions and the Challenge round ---------- */
export function coachCold(sc, lead, calm) {
  if (!lead) return 'Open with your position: “My recommendation is…”. Reasons come second.';
  if (!calm) return 'When you stall, stop, breathe out and restart softly. There is no need to rush through it.';
  if (sc <= 2) return 'Cut to one reason and stop. A short answer with a clean ending works well.';
  return 'Position first and steady under pressure. Try a different question tomorrow.';
}
export function runCold(boss, o) {
  o = o || {};
  const name = boss ? 'Challenge round' : 'Practice questions';
  openRun(name);
  let secs = boss ? 45 : app.S.coldSecs;
  const coldPartial = (say, lead, meta) => ({type:'cold', opts:{pts:{composure:4}, q:'cold', meta}, say, lead});
  const intro = () => {
    setPartial(null);
    setRun('<h2 class="h-t">' + (boss ? 'Five questions, back to back' : 'Answer a question you have not seen') + '</h2><p class="note">' + (boss ? 'Each question gives you a short breath, then ' + secs + ' seconds to answer aloud. You rate yourself once at the end.' : 'You get a 5 second breath, then your answer time. Lead with your position, give a reason, and say what would change your mind. Speak aloud.') + '</p>' + (boss ? '' : '<div class="lab" id="secL">Answer time</div>' + choiceRow('secs', [45, 60, 90], secs, v => v + ' s', 'Answer time')) + '<button type="button" class="btn btn-p" id="go">' + (boss ? 'Begin' : 'Ask me') + '</button>');
    if (!boss) wireChoice('secs', v => { secs = Number(v); app.S.coldSecs = secs; save(); intro(); });
    $('#go').onclick = () => askOne(0);
  };
  const askOne = idx => {
    const q = nextQuestion(), stall = shuffle(STALL).slice(0, 3), breathS = boss ? 3 : 5;
    let total = secs;
    setRun((boss ? '<p class="note num">Question ' + (idx + 1) + ' of 5</p>' : '') + '<h2 class="h-q">' + esc(q.t) + '</h2>' + (q.u ? '<p class="note">You may not know this one. Give a position, what you would check, and when you will confirm.</p>' : '')
      + (app.S.showSkeleton ? '<div class="group outline" aria-label="Answer outline"><div class="li"><span><b>Position.</b> My recommendation is…</span></div><div class="li"><span><b>Because.</b> One or two reasons, one number if you have it.</span></div><div class="li"><span><b>Change.</b> I would revisit if…</span></div></div>' : '')
      + '<div class="phaseline"><span id="phl">Breathe</span><span id="clk" class="num" role="timer" aria-live="off">' + (app.S.hideClock ? '' : breathS) + '</span></div>' + barId('tb')
      + '<div class="chips" aria-label="Phrases that buy a moment">' + stall.map(s => '<span class="chip">' + esc(s) + '</span>').join('') + '</div><div class="row"><button type="button" class="btn btn-p" id="done">' + (boss && idx < 4 ? 'Next question' : 'Done') + '</button><button type="button" class="btn btn-s" id="more" aria-label="Add 15 seconds">+15 s</button></div>');
    let t0 = performance.now(), phase = 'breath', finished = false;
    if (boss) setPartial(() => idx >= 1 ? coldPartial('The ' + idx + ' question' + (idx > 1 ? 's you answered still count' : ' you answered still counts'), 'You answered ' + idx + ' of 5 questions. ' + (idx > 1 ? 'They count.' : 'It counts.'), 'Challenge round, ' + idx + ' of 5') : null);
    else setPartial(() => { const el = (performance.now() - t0) / 1000; return phase === 'speak' && el >= 60 ? coldPartial('The ' + minsDone(el) + ' you spoke still counts', 'You answered a practice question. It counts.', 'Practice question') : null; });
    const end = () => { if (finished) return; finished = true; clearInterval(iv); cue('end'); if (boss && idx < 4) askOne(idx + 1); else rate(); };
    $('#done').onclick = end;
    $('#more').onclick = () => { total += 15; };
    const iv = T.every(100, () => {
      const el = (performance.now() - t0) / 1000;
      if (phase === 'breath') {
        if (!app.S.hideClock) $('#clk').textContent = Math.max(0, Math.ceil(breathS - el));
        setBar('tb', el / breathS * 100);
        if (el >= breathS) { phase = 'speak'; t0 = performance.now(); $('#phl').textContent = 'Answer aloud'; cue('go'); }
      } else {
        if (!app.S.hideClock) $('#clk').textContent = fmt(Math.ceil(total - el));
        setBar('tb', el / total * 100);
        if (el >= total) end();
      }
    });
  };
  const rate = () => {
    let sc = 0;
    setPartial(() => boss ? coldPartial('The 5 questions you answered still count', 'You answered 5 questions. They count.', 'Challenge round, 5 of 5') : coldPartial('The answer you gave still counts', 'You answered a practice question. It counts.', 'Practice question'));
    setRun('<h2 class="h-t">' + (boss ? 'How did the round go?' : 'How did that go?') + '</h2>' + rateHtml('r1', 'Rate your fluency, not the quality of your answer.', FLU) + '<div class="group"><label class="li tg"><span class="grow">I led with a clear position</span><input type="checkbox" id="lead"></label><label class="li tg"><span class="grow">I stayed calm when I got stuck</span><input type="checkbox" id="calm"></label></div><button type="button" class="btn btn-p" id="sub" disabled>Log it</button>');
    wireRate('r1', n => { sc = n; $('#sub').disabled = false; });
    $('#sub').onclick = () => {
      const lead = $('#lead').checked, calm = $('#calm').checked, coach = coachCold(sc, lead, calm);
      if (boss) {
        app.S.bosses++;
        const res = award('boss', {pts:{composure:20 + sc * 3, retrieval:5, resilience:5}, q:'cold', qn:2, score:sc, meta:'Five question challenge round'});
        resultScreen({lead:'You answered five questions back to back.', lines:['Fluency ' + sc + ' of 5.', coach], res, type:'boss'});
      } else {
        const res = award('cold', {pts:{composure:4 + sc * 2 + (lead ? 2 : 0)}, q:'cold', score:sc, meta:'Practice question'});
        resultScreen({lead:'You answered a question you had not seen.', lines:['Fluency ' + sc + ' of 5.', coach], res, type:'cold', actions:o.auto ? [] : [{id:'again', label:'Next question', fn:() => askOne(0)}]});
      }
    };
  };
  if (o.auto) askOne(0); else intro();
}

/* ---------- I'm about to speak (about 90 seconds; counts as the breath item) ---------- */
export function runRitual() {
  openRun('I’m about to speak');
  const t0 = performance.now();
  let step = 1;
  setPartial(() => (step >= 3 || (performance.now() - t0) >= 60000) ? {type:'ritual', opts:{pts:{breath:3, composure:3}, q:'ritual', meta:'I’m about to speak'}, say:'The breathing you did still counts', lead:'You ended early. The breathing you did counts.'} : null);
  const s1 = () => tidePacer({title:'Three slow sighs', head:'<p class="note">Two breaths in through the nose, then a long breath out through the mouth.</p>', phases:SIGH, cycles:3, onDone:s2});
  const s2 = () => { step = 2; tidePacer({title:'Your opening line', head:'<p class="note">Breathe in, then say it softly on the out-breath. Twice.</p>', phases:[BREATH_IN(3), {w:'Say it now', s:7, to:LOW, cue:'out'}], cycles:2, say:() => app.S.opener, onDone:s3}); };
  const s3 = () => {
    step = 3;
    setRun('<h2 class="h-t">Say your first sentence</h2><p class="note">Breathe in, then start softly as you breathe out. Say, out loud, the first thing you will say on the call or in the meeting.</p><button type="button" class="btn btn-p" id="done">I said it</button>');
    $('#done').onclick = () => {
      const res = award('ritual', {pts:{breath:3, composure:3}, q:'ritual', meta:'I’m about to speak'});
      resultScreen({lead:'You are ready to speak.', lines:['Go in with your opening line. A pause is fine.', 'You can change the opening line in Settings.'], res, type:'ritual'});
    };
  };
  s1();
}

/* ---------- Debrief (optional, after a real-world step) ---------- */
export function runDebrief() {
  openRun('Debrief');
  setRun('<h2 class="h-t">Two lines, then done</h2><p class="note">Write it once and leave it there. Replaying a conversation in your head keeps the worry going.</p><div class="group"><div class="field"><label for="d1">What went fine</label><input type="text" id="d1" maxlength="140" autocomplete="off"></div><div class="field"><label for="d2">One thing to adjust next time</label><input type="text" id="d2" maxlength="140" autocomplete="off"></div></div><button type="button" class="btn btn-p" id="sub">Save and move on</button>');
  $('#sub').onclick = () => {
    const a = $('#d1').value.trim(), b = $('#d2').value.trim();
    if (!a && !b) { toast('Write at least one line'); return; }
    const first = !(app.S.daily.debrief > 0);
    const res = award('debrief', {pts:{composure:first ? 2 : 0}, q:'debrief', meta:'Fine: ' + a + ' | Next: ' + b});
    resultScreen({lead:'Saved. Leave it there.', lines:[], res, type:'debrief'});
  };
}

/* ---------- Real-world steps: a prediction before, the outcome after ---------- */
export function missionStats(id) {
  const a = app.S.log.filter(e => e.type === 'field' && e.mid === id);
  return {n:a.length, avgAct:a.length ? a.reduce((s, e) => s + (e.act || 0), 0) / a.length : null};
}
export function recommendedMission() {
  for (let i = 0; i < MISSIONS.length; i++) {
    const m = missionStats(MISSIONS[i].id);
    if (m.n < 2 || (m.avgAct !== null && m.avgAct > 4)) return MISSIONS[i].id;
  }
  return MISSIONS[MISSIONS.length - 1].id;
}
export function runField() {
  openRun('Real-world steps');
  const list = () => {
    const rec = recommendedMission();
    setPartial(null);
    setRun('<h2 class="h-t">Real conversations, in order</h2><p class="note">Drills build the skill. These steps use it in real conversations. Start with the suggested one, and move up when a step feels easier than you expected. They are always optional.</p><div class="group">' + MISSIONS.map((m, i) => { const st = missionStats(m.id); return '<button type="button" class="li" data-ch="ms" data-v="' + m.id + '" aria-label="Open step ' + (i + 1) + ': ' + esc(m.t) + '"><span class="grow"><span class="tt">' + (i + 1) + '. ' + esc(m.t) + '</span><span class="ds">' + (m.id === rec ? 'Suggested next' : (st.n ? 'Done ' + st.n + (st.n > 1 ? ' times' : ' time') : esc(m.d))) + '</span></span>' + ICON.chev + '</button>'; }).join('') + '</div>');
    wireChoice('ms', before);
  };
  const before = id => {
    const m = MISSIONS.filter(x => x.id === id)[0];
    let pred = 5, chance = 30;
    setPartial(null);
    setRun('<h2 class="h-t">' + esc(m.t) + '</h2><p class="note">' + esc(m.d) + ' Predict first, so you can compare it with what really happens.</p><label class="lab" for="pa">Expected anxiety: <span id="pav" class="num">5</span> of 10</label><input type="range" id="pa" min="0" max="10" step="1" value="5"><label class="lab" for="pc2">Chance it goes badly: <span id="pcv" class="num">30</span>%</label><input type="range" id="pc2" min="0" max="100" step="5" value="30"><p class="note">Goes badly means the thing you fear actually happens, for example people react badly or you cannot finish.</p><button type="button" class="btn btn-p" id="go">I will do it now</button><button type="button" class="lnk" id="back">Back to the list</button>');
    $('#pa').oninput = function () { pred = Number(this.value); $('#pav').textContent = pred; };
    $('#pc2').oninput = function () { chance = Number(this.value); $('#pcv').textContent = chance; };
    $('#back').onclick = list;
    $('#go').onclick = () => during(m, pred, chance);
  };
  const during = (m, pred, chance) => {
    setRun('<h2 class="h-q">' + esc(m.t) + '</h2><p class="note">Do it, then come back. Breathe out, start softly, and pause when you need to. Not today is a fine answer.</p><div class="row"><button type="button" class="btn btn-p" id="done">I did it</button><button type="button" class="btn btn-s" id="skip">Not today</button></div>');
    $('#done').onclick = () => after(m, pred, chance);
    $('#skip').onclick = list;
  };
  const after = (m, pred, chance) => {
    let act = 3, sc = 0, bad = -1;
    setPartial(() => ({type:'field', opts:{pts:{composure:10, resilience:4}, q:'field', meta:m.t, extra:{mid:m.id}}, say:'The step you took still counts', lead:'You did it: ' + m.t + '. It counts.'}));
    setRun('<h2 class="h-t">What actually happened</h2><label class="lab" for="aa">Actual anxiety: <span id="aav" class="num">3</span> of 10</label><input type="range" id="aa" min="0" max="10" step="1" value="3"><div class="rate" id="bd" role="group" aria-label="Did the thing you feared happen?"><div class="rlabel">Did the thing you feared happen?</div><div class="seg"><button type="button" class="segb" data-n="0" aria-pressed="false"><b>No</b></button><button type="button" class="segb" data-n="1" aria-pressed="false"><b>Partly</b></button><button type="button" class="segb" data-n="2" aria-pressed="false"><b>Yes</b></button></div></div>' + rateHtml('r1', 'Rate your fluency, not the outcome.', FLU) + '<button type="button" class="btn btn-p" id="sub" disabled>Log it</button>');
    const ready = () => { $('#sub').disabled = !(sc > 0 && bad >= 0); };
    $('#aa').oninput = function () { act = Number(this.value); $('#aav').textContent = act; };
    $$('#bd .segb', runBody).forEach(b => { b.onclick = () => { $$('#bd .segb', runBody).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); bad = Number(b.getAttribute('data-n')); ready(); }; });
    wireRate('r1', n => { sc = n; ready(); });
    $('#sub').onclick = () => {
      const res = award('field', {pts:{composure:10, resilience:4}, q:'field', score:sc, meta:m.t, extra:{pred, act, chance, bad, mid:m.id}});
      const gap = pred - act;
      const lines = ['Anxiety: expected ' + pred + ', actual ' + act + '. Fluency ' + sc + ' of 5.',
        bad === 0 ? 'You gave it a ' + chance + '% chance of going badly. It did not. Keep that on record.' : (bad === 1 ? 'It went partly badly. Note what you would change, then repeat this step.' : 'It went badly. That is information, not a verdict. Repeat this step at a smaller size.'),
        gap >= 2 ? 'The real thing was easier than you predicted, by ' + gap + ' points.' : (gap <= -2 ? 'It was harder than predicted. Stay on this step a little longer.' : 'Your prediction was close.')];
      resultScreen({lead:'You did it: ' + m.t + '.', lines, res, type:'field', actions:[{id:'debrief', label:'Add a short debrief', fn:runDebrief}, {id:'again', label:'Another step', fn:() => { openRun('Real-world steps'); list(); }}]});
    };
  };
  list();
}

/* ---------- sessions from Home ---------- */
export const DRILLS = {breath:runBreath, read:runRead, raid:runRaid, raid30:o => runRaid(Object.assign({secs:30}, o)), cold:o => runCold(false, o)};
/* Daily session: 1 minute of breath, one speaking drill that rotates by day, then one practice question. */
export const sessionDrill = () => ['read', 'raid', 'cold'][dayNum(dstr()) % 3];
export const SESSION = () => ['breath', sessionDrill(), 'cold'];
export const SHORT = () => ['breath', 'raid30'];
export function startRun(list, label) { RUN.active = true; RUN.label = label; RUN.q = list.slice(); RUN.n = list.length; RUN.i = 0; nextRun(); }
export function nextRun() { if (!RUN.q.length) return; const k = RUN.q.shift(); RUN.i++; DRILLS[k]({auto:true}); }
