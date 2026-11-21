import {$, $$, esc, rnd, clamp, shuffle, fmt, dstr, dayNum} from './util.js';
import {FLU, WPM, PASSAGES, QUESTIONS, STALL, LETTERS, CATS, MISSIONS, BASELINE_PASSAGE, TECH_CHECKS, TECH_DEMOS, DRILL_N} from './content.js';
import {hardLetterPool, personalQuestion, weavePassage} from './personal.js';
import {app, save} from './state.js';
import {award} from './rules.js';
import {toast, bar, T, cue, runBody, RUN, openRun, setRun, setPartial, setDarkCover, setSteps, minsDone, choiceRow, wireChoice, rateHtml, wireRate, resultScreen, ICON} from './ui.js';
import {LOW, BREATH_IN, SIGH, tidePacer, runBreath} from './breath.js';
import {createRecorder, saveClip, getClip, measuresHtml, playerHtml, wirePlayer} from './recorder.js';
export {runBreath, tidePacer, SIGH, LOW};

export function activePassages() {
  const ctxs = app.S.contexts || ['work', 'phone'];
  const base = PASSAGES.filter(p => !p.ctx || ctxs.indexOf(p.ctx) >= 0);
  const list = (app.S.customPassages || []).concat(base);
  return list.length ? list : PASSAGES;
}
export function activeQuestions() {
  const ctxs = app.S.contexts || ['work', 'phone'];
  const base = QUESTIONS.filter(q => !q.ctx || ctxs.indexOf(q.ctx) >= 0);
  const list = (app.S.customQuestions || []).concat(base);
  return list.length ? list : QUESTIONS;
}

function techCheckHtml(kind) {
  const list = TECH_CHECKS[kind] || [], demo = TECH_DEMOS[kind] || '';
  if (!list.length) return '';
  return '<div class="tech-box"><div class="lab">Am I doing it right?</div>'
    + (demo ? '<p class="cap">' + esc(demo) + '</p>' : '')
    + '<div class="chk-chips" role="group" aria-label="Technique check">'
    + list.map((t, i) => '<button type="button" class="chk-chip" data-tick="' + i + '" aria-pressed="false">' + esc(t) + '</button>').join('')
    + '</div></div>';
}
function wireTechChecks(root) {
  $$('.chk-chip', root).forEach(b => {
    b.onclick = () => { b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); };
  });
}
function selectedTicks(root) {
  return $$('.chk-chip[aria-pressed="true"]', root).map(b => b.textContent.trim());
}

export const QUSED = {};
export function nextQuestion() {
  const pq = personalQuestion(app.S);
  if (pq) return pq;
  const pool = activeQuestions();
  if (Object.keys(QUSED).length >= pool.length) Object.keys(QUSED).forEach(k => delete QUSED[k]);
  let i, g = 0; do { i = rnd(pool.length); g++; } while (QUSED[i] && g < 200);
  QUSED[i] = 1; return pool[i];
}
export function pickRaid(last) {
  const hard = hardLetterPool(app.S);
  const weak = Object.keys(app.S.weak);
  const pool = hard.concat(weak);
  const L = (pool.length && Math.random() < 0.5) ? pool[rnd(pool.length)] : LETTERS[rnd(LETTERS.length)];
  let C, g = 0; do { C = CATS[rnd(CATS.length)]; g++; } while (C === last && g < 50);
  return {L, C};
}
const barId = id => bar(0).replace('<i ', '<i id="' + id + '" ');
const setBar = (id, p) => { const el = $('#' + id); if (el) el.style.transform = 'scaleX(' + (clamp(p, 0, 100) / 100).toFixed(3) + ')'; };

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
  const passages = activePassages();
  let sel = 0, wpm = WPM[app.S.rung];
  const readPartial = (say, P) => ({type:'read', opts:{pts:{pace:5, breath:2}, q:'read', meta:P.t + ' at ' + wpm + ' wpm'}, say, lead:'You read part of “' + P.t + '” aloud. It counts.'});
  const setup = () => {
    setPartial(null);
    setRun('<h2 class="h-t">Read aloud</h2><p class="note">Breathe at each ▾ mark and start softly. Pace target: ' + WPM[app.S.rung] + ' wpm.</p><div class="lab" id="psL">Passage</div><div class="group" role="group" aria-labelledby="psL">' + passages.map((p, i) => '<button type="button" class="li" data-ch="ps" data-v="' + i + '" aria-pressed="' + (i === sel) + '"><span class="grow"><span class="tt">' + esc(p.t) + '</span><span class="ds">' + p.x.split(/\s+/).length + ' words</span></span><svg class="ic ck" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>').join('') + '</div><label class="lab" for="wpm">Pace: <span id="wv" class="num">' + wpm + '</span> wpm</label><input type="range" id="wpm" min="60" max="150" step="5" value="' + wpm + '"><button type="button" class="btn btn-p" id="go">Start reading</button>');
    $('#wpm').oninput = function () { wpm = Number(this.value); $('#wv').textContent = wpm; };
    wireChoice('ps', v => { sel = Number(v); setup(); });
    $('#go').onclick = play;
  };
  const play = () => {
    const P = weavePassage(passages[sel] || passages[0], app.S), words = P.x.split(/\s+/), t0 = performance.now();
    let rec = null, recording = false, captured = null;
    setDarkCover(true);
    setRun('<h2 class="h-t">' + esc(P.t) + '</h2><p class="note num">' + wpm + ' words a minute</p>'
      + '<div class="glass-panel"><div class="reader" id="rd">' + words.map(w => '<span class="w' + (/[,;:]$/.test(w) ? ' c' : '') + (/[.?!]$/.test(w) ? ' s' : '') + '">' + esc(w) + '</span>').join(' ') + '</div>'
      + '<canvas class="wave-cv" id="waveCv" width="300" height="48" hidden></canvas>'
      + '<div class="rec-row"><button type="button" class="btn btn-s btn-sm" id="recBtn" aria-pressed="false">Record voice</button><span class="cap" id="recMsg" role="status">Stays on this device</span></div></div>');
    setPartial(() => { const el = (performance.now() - t0) / 1000; return el >= 60 ? readPartial('The ' + minsDone(el) + ' you read still counts', P) : null; });
    const recBtn = $('#recBtn'), recMsg = $('#recMsg'), waveCv = $('#waveCv');
    recBtn.onclick = async () => {
      if (recording && rec) {
        recBtn.disabled = true;
        captured = await rec.stop(words.length);
        recording = false; rec = null;
        waveCv.hidden = true;
        recBtn.disabled = false; recBtn.textContent = 'Recorded ✓'; recBtn.setAttribute('aria-pressed', 'false');
        recMsg.textContent = 'Saved for playback after reading.';
        return;
      }
      recBtn.disabled = true; recBtn.textContent = 'Opening mic…';
      rec = createRecorder({canvas:waveCv});
      const r = await rec.start();
      recBtn.disabled = false;
      if (!r.ok) {
        rec = null;
        recBtn.textContent = 'Record voice';
        recMsg.textContent = r.reason === 'denied' ? 'Microphone blocked. You can still finish without recording.' : 'Recording is not available in this browser.';
        return;
      }
      recording = true; waveCv.hidden = false;
      recBtn.textContent = 'Stop recording'; recBtn.setAttribute('aria-pressed', 'true');
      recMsg.textContent = 'Recording on device…';
    };
    const spans = $$('.w', runBody), base = 60000 / wpm;
    let i = 0;
    const step = () => {
      if (i > 0) { spans[i - 1].classList.remove('now'); spans[i - 1].classList.add('done'); }
      if (i >= spans.length) {
        T.after(500, async () => {
          if (recording && rec) { captured = await rec.stop(words.length); recording = false; rec = null; }
          rate(captured);
        });
        return;
      }
      const w = words[i];
      spans[i].classList.add('now');
      const d = base * (1 + (/[,;:]$/.test(w) ? 0.6 : 0) + (/[.?!]$/.test(w) ? 1.4 : 0) + (w.length > 8 ? 0.3 : 0));
      i++; T.after(d, step);
    };
    step();
  };
  const rate = clip => {
    let sc = 0;
    const P = passages[sel] || passages[0];
    setDarkCover(false);
    setPartial(() => readPartial('The passage you read still counts', P));
    const clipBlock = clip ? playerHtml('rdPlay', 'Your take', clip.measures.durationSec) + measuresHtml(clip.measures)
      + '<div class="group"><label class="li tg"><span class="grow">Keep this clip on device (14 days)</span><input type="checkbox" id="keepClip" checked></label></div>' : '';
    setRun('<h2 class="h-t">How smooth was that?</h2>' + clipBlock + rateHtml('r1', 'Rate your fluency, not your effort.', FLU) + techCheckHtml('read') + '<button type="button" class="btn btn-p" id="sub" disabled>Log it</button>');
    if (clip) wirePlayer(runBody, 'rdPlay', clip);
    wireTechChecks(runBody);
    wireRate('r1', n => { sc = n; $('#sub').disabled = false; });
    $('#sub').onclick = async () => {
      const ticks = selectedTicks(runBody);
      if (clip && $('#keepClip') && $('#keepClip').checked) {
        await saveClip({kind:'drill', durationMs:clip.durationMs, bytes:clip.bytes, blob:clip.blob, mimeType:clip.mimeType, wpm:clip.measures.wpm, pauses:clip.measures.pauses, speakingSec:clip.measures.speakingSec, ticks, meta:P.t});
      }
      const coach = coachRead(sc, wpm), onTarget = wpm === WPM[app.S.rung];
      let note = '';
      if (onTarget) {
        if (sc >= 4) { app.S.up++; app.S.down = 0; if (app.S.up >= 2 && app.S.rung < WPM.length - 1) { app.S.rung++; app.S.up = 0; note = 'Pace target up: your next read starts at ' + WPM[app.S.rung] + ' words a minute.'; } }
        else if (sc <= 2) { app.S.up = 0; app.S.down++; if (app.S.down >= 2 && app.S.rung > 0) { app.S.rung--; app.S.down = 0; note = 'Pace target eased to ' + WPM[app.S.rung] + ' words a minute. Slower is part of the plan.'; } }
        else { app.S.up = 0; app.S.down = 0; }
      }
      const win = clip ? ['Your take: ' + (clip.measures.wpm != null ? clip.measures.wpm + ' wpm · ' : '') + clip.measures.pauses + ' pause' + (clip.measures.pauses === 1 ? '' : 's') + ' >1s.'] : [];
      const res = award('read', {pts:{pace:5 + sc * 2, breath:2}, q:'read', score:sc, meta:P.t + ' at ' + wpm + ' wpm', extra:{ticks}});
      resultScreen({lead:'You read “' + P.t + '” aloud at ' + wpm + ' words a minute.', lines:['Fluency ' + sc + ' of 5.'].concat(win, [coach], note ? [note] : []), res, type:'read', actions:o.auto ? [] : [{id:'again', label:'Another passage', fn:() => { wpm = WPM[app.S.rung]; setup(); }}]});
    };
  };
  if (o.auto) { do { sel = rnd(passages.length); } while (sel === lastPassage && passages.length > 1); lastPassage = sel; play(); } else setup();
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
    let total = secs, rec = null, recording = false, captured = null;
    setDarkCover(false);
    setRun((boss ? '<p class="note num">Question ' + (idx + 1) + ' of 5</p>' : '') + '<h2 class="h-q">' + esc(q.t) + '</h2>' + (q.u ? '<p class="note">You may not know this one. Give a position, what you would check, and when you will confirm.</p>' : '')
      + (app.S.showSkeleton ? '<div class="group outline" aria-label="Answer outline"><div class="li"><span><b>Position.</b> My recommendation is…</span></div><div class="li"><span><b>Because.</b> One or two reasons, one number if you have it.</span></div><div class="li"><span><b>Change.</b> I would revisit if…</span></div></div>' : '')
      + '<div class="phaseline"><span id="phl">Breathe</span><span id="clk" class="num" role="timer" aria-live="off">' + (app.S.hideClock ? '' : breathS) + '</span></div>' + barId('tb')
      + (!boss ? '<canvas class="wave-cv" id="waveCv" width="300" height="44" hidden></canvas><div class="rec-row"><button type="button" class="btn btn-s btn-sm" id="recBtn" aria-pressed="false">Record answer</button><span class="cap" id="recMsg" role="status">Optional · stays on device</span></div>' : '')
      + '<div class="chips" aria-label="Phrases that buy a moment">' + stall.map(s => '<span class="chip">' + esc(s) + '</span>').join('') + '</div><div class="row"><button type="button" class="btn btn-p" id="done">' + (boss && idx < 4 ? 'Next question' : 'Done') + '</button><button type="button" class="btn btn-s" id="more" aria-label="Add 15 seconds">+15 s</button></div>');
    let t0 = performance.now(), phase = 'breath', finished = false;
    if (!boss && $('#recBtn')) {
      const recBtn = $('#recBtn'), recMsg = $('#recMsg'), waveCv = $('#waveCv');
      recBtn.onclick = async () => {
        if (recording && rec) {
          recBtn.disabled = true; captured = await rec.stop(0); recording = false; rec = null; waveCv.hidden = true;
          recBtn.disabled = false; recBtn.textContent = 'Recorded ✓'; recBtn.setAttribute('aria-pressed', 'false'); recMsg.textContent = 'Ready to play back.';
          return;
        }
        rec = createRecorder({canvas:waveCv});
        const r = await rec.start();
        if (!r.ok) { rec = null; recMsg.textContent = r.reason === 'denied' ? 'Microphone blocked. You can still answer without recording.' : 'Recording unavailable.'; return; }
        recording = true; waveCv.hidden = false; recBtn.textContent = 'Stop recording'; recBtn.setAttribute('aria-pressed', 'true'); recMsg.textContent = 'Recording on device…';
      };
    }
    if (boss) setPartial(() => idx >= 1 ? coldPartial('The ' + idx + ' question' + (idx > 1 ? 's you answered still count' : ' you answered still counts'), 'You answered ' + idx + ' of 5 questions. ' + (idx > 1 ? 'They count.' : 'It counts.'), 'Challenge round, ' + idx + ' of 5') : null);
    else setPartial(() => { const el = (performance.now() - t0) / 1000; return phase === 'speak' && el >= 60 ? coldPartial('The ' + minsDone(el) + ' you spoke still counts', 'You answered a practice question. It counts.', 'Practice question') : null; });
    const end = async () => {
      if (finished) return;
      finished = true; clearInterval(iv); cue('end');
      if (recording && rec) { captured = await rec.stop(0); recording = false; rec = null; }
      if (boss && idx < 4) askOne(idx + 1); else rate(captured);
    };
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
  const rate = clip => {
    let sc = 0;
    setPartial(() => boss ? coldPartial('The 5 questions you answered still count', 'You answered 5 questions. They count.', 'Challenge round, 5 of 5') : coldPartial('The answer you gave still counts', 'You answered a practice question. It counts.', 'Practice question'));
    const clipBlock = clip ? playerHtml('cdPlay', 'Your answer', clip.measures.durationSec) + measuresHtml(clip.measures)
      + '<div class="group"><label class="li tg"><span class="grow">Keep this clip on device (14 days)</span><input type="checkbox" id="keepClip" checked></label></div>' : '';
    setRun('<h2 class="h-t">' + (boss ? 'How did the round go?' : 'How did that go?') + '</h2>' + clipBlock + rateHtml('r1', 'Rate your fluency, not the quality of your answer.', FLU) + '<div class="group"><label class="li tg"><span class="grow">I led with a clear position</span><input type="checkbox" id="lead"></label><label class="li tg"><span class="grow">I stayed calm when I got stuck</span><input type="checkbox" id="calm"></label></div>' + (!boss ? techCheckHtml('cold') : '') + '<button type="button" class="btn btn-p" id="sub" disabled>Log it</button>');
    if (clip) wirePlayer(runBody, 'cdPlay', clip);
    wireTechChecks(runBody);
    wireRate('r1', n => { sc = n; $('#sub').disabled = false; });
    $('#sub').onclick = async () => {
      const ticks = selectedTicks(runBody);
      if (clip && $('#keepClip') && $('#keepClip').checked) {
        await saveClip({kind:'drill', durationMs:clip.durationMs, bytes:clip.bytes, blob:clip.blob, mimeType:clip.mimeType, wpm:clip.measures.wpm, pauses:clip.measures.pauses, speakingSec:clip.measures.speakingSec, ticks, meta:'Practice question'});
      }
      const lead = $('#lead').checked, calm = $('#calm').checked, coach = coachCold(sc, lead, calm);
      if (boss) {
        app.S.bosses++;
        const res = award('boss', {pts:{composure:20 + sc * 3, retrieval:5, resilience:5}, q:'cold', qn:2, score:sc, meta:'Five question challenge round'});
        resultScreen({lead:'You answered five questions back to back.', lines:['Fluency ' + sc + ' of 5.', coach], res, type:'boss'});
      } else {
        const res = award('cold', {pts:{composure:4 + sc * 2 + (lead ? 2 : 0)}, q:'cold', score:sc, meta:'Practice question', extra:{ticks}});
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
    setRun('<h2 class="h-t">Say your first sentence</h2><p class="note">Breathe in, then start softly as you breathe out. Say, out loud, the first thing you will say on the call or in the meeting.</p><div class="stack thumb"><button type="button" class="btn btn-p" id="done">I said it</button></div>');
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

/* ---------- Same-Session Before/After Proof (Step 4) & Weekly Re-Record ---------- */
function recordBaselineStep(opts) {
  const words = BASELINE_PASSAGE.x.split(/\s+/);
  let rec = null, recording = false;
  setDarkCover(true);
  const textHtml = opts.marks
    ? words.map(w => '<span class="w' + (/[,;:]$/.test(w) ? ' c' : '') + (/[.?!]$/.test(w) ? ' s' : '') + '">' + esc(w) + '</span>').join(' ')
    : esc(BASELINE_PASSAGE.x);
  setRun('<h2 class="h-t">' + esc(opts.title) + '</h2><p class="note">' + esc(opts.sub) + '</p>'
    + '<div class="glass-panel"><div class="reader">' + textHtml + '</div>'
    + '<canvas class="wave-cv" id="waveCv" width="300" height="48"></canvas>'
    + '<p class="cap" id="recMsg" role="status">Tap Record when you are ready. Recordings never leave this device.</p></div>'
    + '<div class="stack thumb"><button type="button" class="btn btn-p" id="recGo">Record (~20 s)</button>'
    + (opts.onSkip ? '<button type="button" class="lnk" id="recSkip">Skip recording</button>' : '') + '</div>');
  const btn = $('#recGo'), msg = $('#recMsg'), waveCv = $('#waveCv');
  if (opts.onSkip && $('#recSkip')) $('#recSkip').onclick = () => { if (rec) rec.cancel(); setDarkCover(false); opts.onSkip(); };
  btn.onclick = async () => {
    if (recording && rec) {
      btn.disabled = true;
      const clip = await rec.stop(words.length);
      recording = false; rec = null;
      setDarkCover(false);
      opts.onDone(clip);
      return;
    }
    rec = createRecorder({canvas:waveCv});
    const r = await rec.start();
    if (!r.ok) {
      rec = null;
      msg.textContent = r.reason === 'denied' ? 'Microphone permission was denied. You can skip recording and still practise.' : 'Microphone recording is not available in this browser.';
      return;
    }
    recording = true;
    btn.textContent = 'Stop recording';
    msg.textContent = 'Recording on device… read aloud at your natural pace.';
  };
}

export function runProof() {
  openRun('Before & after check');
  const pSteps = ['Cold', 'Breathe', 'Paced'];
  let coldClip = null, pacedClip = null;
  const step1 = () => {
    setSteps(pSteps, 0);
    recordBaselineStep({
      title:'1 of 3 · Cold read',
      sub:'Read this short passage aloud once before breathing. This also becomes your weekly baseline.',
      marks:false,
      onSkip:() => { app.S.proofDone = true; save(); startRun(SESSION(), 'Daily session'); },
      onDone:clip => { coldClip = clip; step2(); }
    });
  };
  const step2 = () => {
    setSteps(pSteps, 1);
    tidePacer({
      title:'2 of 3 · Breathe & settle',
      head:'<p class="note">Two minutes of cyclic sighing to drop tension before your second read.</p>',
      phases:SIGH,
      totalS:120,
      onDone:() => step3()
    });
  };
  const step3 = () => {
    setSteps(pSteps, 2);
    recordBaselineStep({
      title:'3 of 3 · Paced re-read',
      sub:'Read the exact same passage aloud now. Start each phrase softly and pause at each ▾ mark.',
      marks:true,
      onDone:clip => { pacedClip = clip; setSteps(null); compare(); }
    });
  };
  const compare = () => {
    let r1 = 0, r2 = 0;
    setDarkCover(false);
    setRun('<h2 class="h-t">Hear the difference</h2><p class="note">Play both clips side by side and rate each one.</p>'
      + (coldClip ? playerHtml('pCold', '1. Cold read', coldClip.measures.durationSec) + measuresHtml(coldClip.measures) : '')
      + (pacedClip ? playerHtml('pPaced', '2. After breathing', pacedClip.measures.durationSec) + measuresHtml(pacedClip.measures) : '')
      + rateHtml('rc1', 'Cold read fluency', FLU)
      + rateHtml('rc2', 'Paced read fluency', FLU)
      + '<button type="button" class="btn btn-p" id="sub" disabled>Save baseline</button>');
    if (coldClip) wirePlayer(runBody, 'pCold', coldClip);
    if (pacedClip) wirePlayer(runBody, 'pPaced', pacedClip);
    const ready = () => { $('#sub').disabled = !(r1 > 0 && r2 > 0); };
    wireRate('rc1', n => { r1 = n; ready(); });
    wireRate('rc2', n => { r2 = n; ready(); });
    $('#sub').onclick = async () => {
      if (coldClip) {
        const sc = await saveClip({kind:'proof-cold', durationMs:coldClip.durationMs, bytes:coldClip.bytes, blob:coldClip.blob, mimeType:coldClip.mimeType, wpm:coldClip.measures.wpm, pauses:coldClip.measures.pauses, speakingSec:coldClip.measures.speakingSec, meta:'Baseline cold read'});
        app.S.proofColdId = sc.id; app.S.proofColdMeta = coldClip.measures;
      }
      if (pacedClip) {
        const sp = await saveClip({kind:'proof-paced', durationMs:pacedClip.durationMs, bytes:pacedClip.bytes, blob:pacedClip.blob, mimeType:pacedClip.mimeType, wpm:pacedClip.measures.wpm, pauses:pacedClip.measures.pauses, speakingSec:pacedClip.measures.speakingSec, meta:'Baseline paced read'});
        app.S.proofPacedId = sp.id; app.S.proofPacedMeta = pacedClip.measures;
      }
      app.S.proofColdRate = r1; app.S.proofPacedRate = r2; app.S.proofDone = true; app.S.lastReeval = dstr();
      const res = award('read', {pts:{pace:6, breath:4}, q:'read', score:r2, meta:'Before/after proof (' + r1 + ' -> ' + r2 + ')'});
      resultScreen({lead:'Baseline saved.', lines:['Cold read ' + r1 + ' of 5 · After breathing ' + r2 + ' of 5.', 'Your cold read is saved in Progress for weekly then-and-now comparisons.'], res, type:'read'});
    };
  };
  step1();
}

export async function runReeval() {
  openRun('Weekly re-record');
  const baseClip = app.S.proofColdId ? await getClip(app.S.proofColdId) : null;
  recordBaselineStep({
    title:'Weekly baseline check',
    sub:'Read your baseline passage aloud to compare then and now.',
    marks:true,
    onDone:nowClip => {
      let sc = 0;
      setDarkCover(false);
      setRun('<h2 class="h-t">Then and now</h2><p class="note">Listen to your original baseline alongside today’s take.</p>'
        + (baseClip ? playerHtml('pThen', 'Then · original baseline', (app.S.proofColdMeta && app.S.proofColdMeta.durationSec) || 20) + measuresHtml(app.S.proofColdMeta) : '')
        + (nowClip ? playerHtml('pNow', 'Now · today', nowClip.measures.durationSec) + measuresHtml(nowClip.measures) : '')
        + rateHtml('r1', 'Rate today’s fluency', FLU)
        + '<button type="button" class="btn btn-p" id="sub" disabled>Log weekly check</button>');
      if (baseClip) wirePlayer(runBody, 'pThen', baseClip);
      if (nowClip) wirePlayer(runBody, 'pNow', nowClip);
      wireRate('r1', n => { sc = n; $('#sub').disabled = false; });
      $('#sub').onclick = async () => {
        if (nowClip) {
          const saved = await saveClip({kind:'reeval', durationMs:nowClip.durationMs, bytes:nowClip.bytes, blob:nowClip.blob, mimeType:nowClip.mimeType, wpm:nowClip.measures.wpm, pauses:nowClip.measures.pauses, speakingSec:nowClip.measures.speakingSec, meta:'Weekly re-record'});
          app.S.reevalId = saved.id; app.S.reevalMeta = nowClip.measures;
        }
        app.S.reevalRate = sc; app.S.lastReeval = dstr();
        const res = award('reeval', {pts:{pace:8, composure:4}, q:'read', score:sc, meta:'Weekly re-record'});
        resultScreen({lead:'Weekly check logged.', lines:['Fluency ' + sc + ' of 5. Your baseline comparison is updated in Progress.'], res, type:'reeval'});
      };
    }
  });
}

/* ---------- sessions from Home ---------- */
export const DRILLS = {breath:runBreath, read:runRead, raid:runRaid, raid30:o => runRaid(Object.assign({secs:30}, o)), cold:o => runCold(false, o)};
/* Daily session: 1 minute of breath, one speaking drill that rotates by day, then one practice question. */
export const sessionDrill = () => ['read', 'raid', 'cold'][dayNum(dstr()) % 3];
export const SESSION = () => ['breath', sessionDrill(), 'cold'];
export const SHORT = () => ['breath', 'raid30'];
export function startRun(list, label) {
  RUN.active = true; RUN.label = label; RUN.q = list.slice(); RUN.n = list.length; RUN.i = 0;
  RUN.steps = list.map(k => DRILL_N[k.replace(/\d+$/, '')] || 'Step');
  nextRun();
}
export function nextRun() { if (!RUN.q.length) return; const k = RUN.q.shift(); RUN.i++; DRILLS[k]({auto:true}); }
