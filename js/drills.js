import {$, $$, esc, rnd, clamp, reduceMotion, shuffle, fmt} from './util.js';
import {FLU, PATTERNS, PHRASES, WPM, PASSAGES, QUESTIONS, STALL, LETTERS, CATS, MISSIONS} from './content.js';
import {app, save} from './state.js';
import {award, avgScore} from './rules.js';
import {toast, block, bar, T, cue, runBody, RUN, openRun, stopRun, setRun, choiceRow, wireChoice, rateHtml, wireRate, resultScreen} from './ui.js';

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
export function pacer(host, o) {
  host.innerHTML = '<div class="orb" id="orb"><div><div class="phase" id="ph">Get ready</div><div class="sub" id="sb"></div></div></div><div class="pc-meta"><span id="cy">Cycle 1</span><span id="rem"></span></div>';
  const orb = $('#orb', host), ph = $('#ph', host), sb = $('#sb', host), cy = $('#cy', host), rem = $('#rem', host);
  const start = performance.now(), cyc = (o.inS + o.outS) * 1000;
  let last = '';
  const frame = () => {
    const el = performance.now() - start;
    if (el >= o.totalS * 1000) { orb.style.transform = 'scale(.6)'; cue('end'); o.onDone(Math.floor(el / cyc)); return; }
    const pos = el % cyc, idx = Math.floor(el / cyc);
    const inhale = pos < o.inS * 1000;
    const p = inhale ? pos / (o.inS * 1000) : (pos - o.inS * 1000) / (o.outS * 1000);
    if (!reduceMotion) orb.style.transform = 'scale(' + (inhale ? 0.6 + 0.4 * p : 1 - 0.4 * p).toFixed(3) + ')';
    const key = (inhale ? 'in' : 'out') + idx;
    if (key !== last) {
      last = key; cue(inhale ? 'in' : 'out');
      ph.textContent = inhale ? 'Breathe in' : 'Breathe out slowly';
      if (o.phrases) sb.textContent = (inhale ? 'Next: ' : 'Say: ') + o.phrases[idx % o.phrases.length];
      cy.textContent = 'Cycle ' + (idx + 1);
    }
    rem.textContent = app.S.hideClock ? '' : fmt(Math.ceil((o.totalS * 1000 - el) / 1000));
    T.raf = requestAnimationFrame(frame);
  };
  T.raf = requestAnimationFrame(frame);
}

export function runBreath(o) {
  o = o || {};
  openRun('Breath Gate');
  let pat = 'gentle', mins = 2;
  const setup = () => {
    setRun(block('Breath Gate', '<h2 class="t">Pace your breath</h2><p class="note">Breathe in through the nose, out slowly. In speak mode, say the phrase on the exhale in one easy breath and start it softly.</p><div class="lab">Pattern</div><div class="seg">' + Object.keys(PATTERNS).map(k => '<button type="button" class="segb wide" data-ch="pat" data-v="' + k + '" aria-pressed="' + (k === pat) + '"><b>' + PATTERNS[k].n + '</b><span>' + PATTERNS[k].d + '</span></button>').join('') + '</div><div class="lab">Length</div>' + choiceRow('mins', [1, 2, 3, 5], mins, v => v + ' min') + '<button type="button" class="btn solid" id="go">Begin</button>'));
    wireChoice('pat', v => { pat = v; setup(); });
    wireChoice('mins', v => { mins = Number(v); setup(); });
    $('#go').onclick = begin;
  };
  const begin = () => {
    const P = PATTERNS[pat];
    setRun(block(P.n + ' · ' + P.d, '<h2 class="sr">Breathing guide</h2><div id="pc"></div><button type="button" class="btn sm" id="stop">Stop</button>', 'center'));
    $('#stop').onclick = () => { T.clear(); if (o.auto) stopRun(); else setup(); };
    pacer($('#pc'), {inS:P.inS, outS:P.outS, totalS:mins * 60, phrases:P.speak ? shuffle(PHRASES) : null, onDone: cycles => {
      const res = award('breath', {xp:10 * mins, pts:{breath:6 * mins}, q:'breath', meta:P.n + ', ' + mins + ' min'});
      resultScreen('Breath Gate cleared', [cycles + ' cycles of ' + P.d, 'Carry this pace into your first sentence.'], res, {label:'Go again', fn:setup});
    }});
  };
  if (o.auto) { mins = 1; begin(); } else setup();
}

export function coachRead(sc, wpm) {
  const base = avgScore(e => e.energy <= 2);
  if (app.S.energy >= 4 && sc >= 3 && base !== null && sc >= base - 0.5) return 'You matched your fresh-day average while tired. That is the target condition.';
  if (sc >= 4) return 'Smooth at ' + wpm + ' wpm. Two smooth reads in a row at your pace gate move it up.';
  if (sc <= 2) return 'Drop about 10 wpm and make the first sound of each phrase softer.';
  return 'Mixed. Start each phrase on the exhale and pause at the marks.';
}
let lastPassage = -1;
export function runRead(o) {
  o = o || {};
  openRun('Paced Reading');
  let sel = 0, wpm = WPM[app.S.rung];
  const setup = () => {
    setRun(block('Paced Reading', '<h2 class="t">Read at a set pace</h2><p class="note">Words light up at your chosen speed. Read aloud, breathe at each ▾ mark, start each phrase softly. Pace gate ' + (app.S.rung + 1) + ' of ' + WPM.length + ' is ' + WPM[app.S.rung] + ' wpm. Two smooth reads in a row move it up.</p><div class="lab">Passage</div><div class="seg">' + PASSAGES.map((p, i) => '<button type="button" class="segb wide" data-ch="ps" data-v="' + i + '" aria-pressed="' + (i === sel) + '"><b>' + esc(p.t) + '</b><span>' + p.x.split(/\s+/).length + ' words</span></button>').join('') + '</div><label class="lab" for="wpm">Pace: <span id="wv">' + wpm + '</span> words per minute</label><input type="range" id="wpm" min="60" max="150" step="5" value="' + wpm + '"><p class="note">Conversation runs near 150. Start slower than feels natural, especially when tired. Changing the pace off your gate means this read does not move the gate.</p><button type="button" class="btn solid" id="go">Start reading</button>'));
    $('#wpm').oninput = function () { wpm = Number(this.value); $('#wv').textContent = wpm; };
    wireChoice('ps', v => { sel = Number(v); setup(); });
    $('#go').onclick = play;
  };
  const play = () => {
    const P = PASSAGES[sel], words = P.x.split(/\s+/);
    setRun(block(P.t + ' · ' + wpm + ' wpm', '<h2 class="sr">Reading</h2><div class="reader" id="rd">' + words.map((w, i) => '<span class="w' + (/[,;:]$/.test(w) ? ' c' : '') + (/[.?!]$/.test(w) ? ' s' : '') + '">' + esc(w) + '</span>').join(' ') + '</div><button type="button" class="btn sm" id="stop">Stop</button>'));
    $('#stop').onclick = () => { T.clear(); if (o.auto) stopRun(); else setup(); };
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
    setRun(block('Self-check', '<h2 class="t">How smooth was that?</h2>' + rateHtml('r1', 'Rate your fluency, not your effort.', FLU) + '<button type="button" class="btn solid" id="sub" disabled>Log it</button>'));
    wireRate('r1', n => { sc = n; $('#sub').disabled = false; });
    $('#sub').onclick = () => {
      const coach = coachRead(sc, wpm), onGate = wpm === WPM[app.S.rung];
      let gateNote = '';
      if (onGate) {
        if (sc >= 4) { app.S.up++; app.S.down = 0; if (app.S.up >= 2 && app.S.rung < WPM.length - 1) { app.S.rung++; app.S.up = 0; gateNote = 'Pace gate up: next read starts at ' + WPM[app.S.rung] + ' wpm.'; } }
        else if (sc <= 2) { app.S.up = 0; if (app.S.energy < 4) { app.S.down++; if (app.S.down >= 2 && app.S.rung > 0) { app.S.rung--; app.S.down = 0; gateNote = 'Pace eased to ' + WPM[app.S.rung] + ' wpm. Slower is part of the plan.'; } } }
        else { app.S.up = 0; app.S.down = 0; }
      }
      const res = award('read', {xp:20 + sc * 3, pts:{pace:5 + sc * 2, breath:2}, q:'read', score:sc, meta:PASSAGES[sel].t + ' at ' + wpm + ' wpm'});
      resultScreen('Reading cleared', [PASSAGES[sel].t + ' at ' + wpm + ' wpm. Fluency ' + sc + ' of 5 at energy ' + app.S.energy + '.', coach].concat(gateNote ? [gateNote] : []), res, {label:'Another passage', fn:() => { wpm = WPM[app.S.rung]; setup(); }});
    };
  };
  if (o.auto) { do { sel = rnd(PASSAGES.length); } while (sel === lastPassage && PASSAGES.length > 1); lastPassage = sel; play(); } else setup();
}

export function runRaid(o) {
  o = o || {};
  openRun('Alphabet Raid');
  let secs = 45, last = '';
  const prep = () => { const q = pickRaid(last); last = q.C; show(q); };
  const show = q => {
    setRun(block('Alphabet Raid', '<div class="lab center">Round target</div><div class="big" aria-hidden="true">' + q.L + '</div><h2 class="t center">Words that start with ' + q.L + ': ' + esc(q.C.toLowerCase()) + '</h2><p class="note">Say each word aloud and tap +1 as you go. Breathe in first and begin on the exhale.</p>' + choiceRow('secs', [30, 45, 60], secs, v => v + ' s') + '<button type="button" class="btn solid" id="go">Start the clock</button>', 'center'));
    wireChoice('secs', v => { secs = Number(v); show(q); });
    $('#go').onclick = () => play(q);
  };
  const play = q => {
    let count = 0, blanks = 0, total = secs;
    const t0 = performance.now();
    setRun(block(q.L + ' · ' + q.C, '<h2 class="sr">Round running</h2><div class="clock" id="clk" role="timer" aria-live="off">' + (app.S.hideClock ? '' : total + '.0s') + '</div>' + bar(0, 'steel').replace('<i ', '<i id="tb" ') + '<div class="count" id="cnt" aria-live="polite">0</div><button type="button" class="btn solid xl" id="plus">+1 word</button><div class="row"><button type="button" class="btn" id="blank">I blanked</button><button type="button" class="btn" id="more">+15 s</button></div><p class="note" id="tip">If you blank: pause, breathe out, say "let me think", then keep going.</p>', 'center'));
    cue('go');
    $('#plus').onclick = () => { count++; $('#cnt').textContent = count; };
    $('#blank').onclick = () => { blanks++; $('#tip').textContent = 'Blank noted. A pause is fine. Breathe out and restart softly.'; };
    $('#more').onclick = () => { total += 15; };
    const iv = T.every(100, () => {
      const left = Math.max(0, total - (performance.now() - t0) / 1000);
      if (!app.S.hideClock) $('#clk').textContent = left.toFixed(1) + 's';
      $('#tb').style.width = clamp((1 - left / total) * 100, 0, 100) + '%';
      if (left <= 0) { clearInterval(iv); cue('end'); finish(q, count, blanks, total); }
    });
  };
  const finish = (q, count, blanks, total) => {
    const c = Math.min(count, 12), w = app.S.weak[q.L] || 0;
    const nw = clamp(w + ((blanks > 0 || count <= 2) ? 1 : 0) - ((count >= 6 && blanks === 0) ? 1 : 0), 0, 5);
    if (nw > 0) app.S.weak[q.L] = nw; else delete app.S.weak[q.L];
    const res = award('raid', {xp:10 + c * 2, pts:{retrieval:3 + c}, q:'raid', meta:q.L + ', ' + q.C + ': ' + count + ' words'});
    const coach = nw > w ? q.L + ' will come back sooner. Spaced repeats on weak sounds are how they improve.' : (count >= 6 && blanks === 0 ? 'Clean round. ' + q.L + ' is getting easier.' : 'Recovering from a blank is the skill, not avoiding one.');
    resultScreen('Round cleared', [count + ' words in ' + total + ' seconds' + (blanks ? ', ' + blanks + ' blank' + (blanks > 1 ? 's' : '') : '') + '.', coach], res, {label:'Next round', fn:prep});
  };
  prep();
}

export function coachCold(sc, lead, calm) {
  if (!lead) return 'Open with your position: "My recommendation is…". Reasons come second.';
  if (!calm) return 'When you stall, stop, breathe out and restart softly. Do not rush through it.';
  if (sc <= 2) return 'Cut to one reason and stop. A short answer with a clean ending beats a long one.';
  return 'Position first and steady under pressure. Repeat it tomorrow with a different question.';
}
export function runCold(boss, o) {
  o = o || {};
  openRun(boss ? 'Boss Gauntlet' : 'Cold Questions');
  let secs = boss ? 45 : app.S.coldSecs;
  const intro = () => {
    setRun(block(boss ? 'Boss Gauntlet' : 'Cold Questions', '<h2 class="t">' + (boss ? 'Five questions back to back' : 'Answer a question you have not seen') + '</h2><p class="note">' + (boss ? 'Each question gives you a short breath, then ' + secs + ' seconds to answer aloud. Rate yourself once at the end. It counts most when you are a little tired.' : 'You get a 5 second breath, then your answer time. Lead with your position, give a reason, say what would change your mind. Speak aloud.') + '</p>' + (boss ? '' : '<div class="lab">Answer time</div>' + choiceRow('secs', [45, 60, 90], secs, v => v + ' s')) + '<button type="button" class="btn solid" id="go">' + (boss ? 'Begin' : 'Ask me') + '</button>'));
    if (!boss) wireChoice('secs', v => { secs = Number(v); app.S.coldSecs = secs; save(); intro(); });
    $('#go').onclick = () => askOne(0);
  };
  const askOne = idx => {
    const q = nextQuestion(), stall = shuffle(STALL).slice(0, 3), breathS = boss ? 3 : 5;
    let total = secs;
    setRun(block(boss ? 'Question ' + (idx + 1) + ' of 5' : 'Cold question', '<h2 class="q">' + esc(q.t) + '</h2>' + (q.u ? '<p class="note">You may not know this one. Give a position, what you would check, and when you will confirm.</p>' : '') + (app.S.showSkeleton ? '<div class="skel"><span><b>Position.</b> My recommendation is…</span><span><b>Because.</b> One or two reasons, one number if you have it.</span><span><b>Change.</b> I would revisit if…</span></div>' : '') + '<div class="phaseline"><span id="phl">Breathe</span><span id="clk" class="mono" role="timer" aria-live="off">' + (app.S.hideClock ? '' : breathS) + '</span></div>' + bar(0, 'steel').replace('<i ', '<i id="tb" ') + '<div class="chips">' + stall.map(s => '<span class="chip">' + esc(s) + '</span>').join('') + '</div><div class="row"><button type="button" class="btn" id="done">' + (boss && idx < 4 ? 'Next question' : 'Done') + '</button><button type="button" class="btn" id="more">+15 s</button></div>'));
    let t0 = performance.now(), phase = 'breath', finished = false;
    const end = () => { if (finished) return; finished = true; clearInterval(iv); cue('end'); if (boss && idx < 4) askOne(idx + 1); else rate(); };
    $('#done').onclick = end;
    $('#more').onclick = () => { total += 15; };
    const iv = T.every(100, () => {
      const el = (performance.now() - t0) / 1000;
      if (phase === 'breath') {
        if (!app.S.hideClock) $('#clk').textContent = Math.max(0, Math.ceil(breathS - el));
        $('#tb').style.width = clamp(el / breathS * 100, 0, 100) + '%';
        if (el >= breathS) { phase = 'speak'; t0 = performance.now(); $('#phl').textContent = 'Answer aloud'; cue('go'); }
      } else {
        if (!app.S.hideClock) $('#clk').textContent = fmt(Math.ceil(total - el));
        $('#tb').style.width = clamp(el / total * 100, 0, 100) + '%';
        if (el >= total) end();
      }
    });
  };
  const rate = () => {
    let sc = 0;
    setRun(block('Self-check', '<h2 class="t">' + (boss ? 'How did the gauntlet go?' : 'How did that go?') + '</h2>' + rateHtml('r1', 'Rate your fluency, not the quality of your answer.', FLU) + '<label class="tg"><input type="checkbox" id="lead"> I led with a clear position</label><label class="tg"><input type="checkbox" id="calm"> I stayed calm when I got stuck</label><button type="button" class="btn solid" id="sub" disabled>Log it</button>'));
    wireRate('r1', n => { sc = n; $('#sub').disabled = false; });
    $('#sub').onclick = () => {
      const lead = $('#lead').checked, calm = $('#calm').checked, bonus = (lead ? 5 : 0) + (calm ? 5 : 0), coach = coachCold(sc, lead, calm);
      if (boss) {
        app.S.bosses++;
        const res = award('boss', {xp:80 + sc * 8 + bonus * 2, pts:{composure:20 + sc * 3, retrieval:5}, q:'cold', qn:2, score:sc, meta:'Five question gauntlet'});
        resultScreen('Gauntlet cleared', ['Fluency ' + sc + ' of 5 at energy ' + app.S.energy + '.', coach], res, {label:'Back to Gates', fn:stopRun});
      } else {
        const res = award('cold', {xp:20 + sc * 3 + bonus, pts:{composure:4 + sc * 2 + (lead ? 2 : 0)}, q:'cold', score:sc, meta:'Cold question'});
        resultScreen('Answer logged', ['Fluency ' + sc + ' of 5 at energy ' + app.S.energy + '.', coach], res, {label:'Next question', fn:() => askOne(0)});
      }
    };
  };
  if (o.auto) askOne(0); else intro();
}

export function runRitual() {
  openRun('Pre-call ritual');
  const s1 = () => {
    setRun(block('Step 1 of 3: breathe', '<h2 class="sr">Breathe</h2><div id="pc"></div><button type="button" class="btn sm" id="skip">Skip step</button>', 'center'));
    $('#skip').onclick = () => { T.clear(); s2(); };
    pacer($('#pc'), {inS:4, outS:6, totalS:60, onDone:s2});
  };
  const s2 = () => {
    const q = pickRaid(''), t0 = performance.now(), total = 30;
    setRun(block('Step 2 of 3: warm up retrieval', '<div class="big" aria-hidden="true">' + q.L + '</div><h2 class="t center">Words that start with ' + q.L + ': ' + esc(q.C.toLowerCase()) + '</h2><p class="note">Say words aloud, slowly, one per exhale. No counting.</p><div class="clock" id="clk" role="timer" aria-live="off">' + (app.S.hideClock ? '' : total) + '</div><button type="button" class="btn sm" id="skip">Next step</button>', 'center'));
    const go = () => { T.clear(); s3(); };
    $('#skip').onclick = go;
    const iv = T.every(200, () => { const left = Math.ceil(total - (performance.now() - t0) / 1000); if (!app.S.hideClock) $('#clk').textContent = Math.max(0, left); if (left <= 0) { clearInterval(iv); go(); } });
  };
  const s3 = () => {
    setRun(block('Step 3 of 3: your opening line', '<h2 class="q">' + esc(app.S.opener) + '</h2><p class="note">Say it aloud twice, each time on one easy breath, starting softly. Then decide your headline position for the call and say it once.</p><button type="button" class="btn solid" id="done">I am ready</button>'));
    $('#done').onclick = () => {
      const res = award('ritual', {xp:20, pts:{breath:3, composure:3}, q:'ritual', meta:'Pre-call ritual'});
      resultScreen('Ritual complete', ['Go into the call with your position ready.', 'You can change the opening line in the Guide.'], res, null);
    };
  };
  s1();
}

export function runDebrief() {
  openRun('Meeting debrief');
  setRun(block('Debrief', '<h2 class="t">Three lines, then done</h2><p class="note">Write it once and leave it there. Replaying a meeting in your head keeps the anxiety alive.</p><label class="lab" for="d1">What went fine</label><input type="text" id="d1" maxlength="140" autocomplete="off"><label class="lab" for="d2">One adjustment for next time</label><input type="text" id="d2" maxlength="140" autocomplete="off"><button type="button" class="btn solid" id="sub">Save and move on</button>'));
  $('#sub').onclick = () => {
    const a = $('#d1').value.trim(), b = $('#d2').value.trim();
    if (!a && !b) { toast('Write at least one line'); return; }
    const first = !(app.S.daily.debrief > 0);
    const res = award('debrief', {xp:first ? 10 : 0, pts:{composure:first ? 2 : 0}, q:'debrief', meta:'Fine: ' + a + ' | Next: ' + b});
    resultScreen('Debrief saved', ['Done. Leave it there.'], res, null);
  };
}

/* Field missions: graded real-world speaking, with a prediction before and the outcome after. */
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
  openRun('Field mission');
  const rec = recommendedMission();
  const list = () => {
    setRun(block('Field missions', '<h2 class="t">Real situations, in order</h2><p class="note">Drills build skill. Missions test it in real conversations, which is where progress counts. Do the suggested one, then move up when your anxiety at a step drops.</p><div class="seg">' + MISSIONS.map((m, i) => { const st = missionStats(m.id); return '<button type="button" class="segb wide" data-ch="ms" data-v="' + m.id + '" aria-pressed="false"><b>' + (i + 1) + '. ' + esc(m.t) + '</b><span>' + (m.id === rec ? 'Suggested' : (st.n ? 'Done ' + st.n + 'x' : '')) + '</span></button>'; }).join('') + '</div>'));
    wireChoice('ms', before);
  };
  const before = id => {
    const m = MISSIONS.filter(x => x.id === id)[0];
    let pred = 5, chance = 30;
    setRun(block('Before', '<h2 class="t">' + esc(m.t) + '</h2><p class="note">' + esc(m.d) + ' Predict first, so you can compare with what really happens.</p><label class="lab" for="pa">Expected anxiety: <span id="pav">5</span> of 10</label><input type="range" id="pa" min="0" max="10" step="1" value="5"><label class="lab" for="pc2">Chance it goes badly: <span id="pcv">30</span>%</label><input type="range" id="pc2" min="0" max="100" step="5" value="30"><p class="note">Goes badly means the thing you fear actually happens, for example people react badly or you cannot finish.</p><button type="button" class="btn solid" id="go">I will do it now</button><button type="button" class="btn link" id="back">Back to the list</button>'));
    $('#pa').oninput = function () { pred = Number(this.value); $('#pav').textContent = pred; };
    $('#pc2').oninput = function () { chance = Number(this.value); $('#pcv').textContent = chance; };
    $('#back').onclick = list;
    $('#go').onclick = () => during(m, pred, chance);
  };
  const during = (m, pred, chance) => {
    setRun(block('Now', '<h2 class="q">' + esc(m.t) + '</h2><p class="note">Do it, then come back. Breathe out, start softly, pause when you need to. Not today is a fine answer.</p><div class="row"><button type="button" class="btn solid" id="done">I did it</button><button type="button" class="btn" id="skip">Not today</button></div>'));
    $('#done').onclick = () => after(m, pred, chance);
    $('#skip').onclick = list;
  };
  const after = (m, pred, chance) => {
    let act = 3, sc = 0, bad = -1;
    setRun(block('After', '<h2 class="t">What actually happened</h2><label class="lab" for="aa">Actual anxiety: <span id="aav">3</span> of 10</label><input type="range" id="aa" min="0" max="10" step="1" value="3"><div class="rate" id="bd" role="group" aria-label="Did the bad outcome happen"><div class="rlabel">Did the thing you feared happen?</div><div class="seg"><button type="button" class="segb" data-n="0" aria-pressed="false"><b>No</b></button><button type="button" class="segb" data-n="1" aria-pressed="false"><b>Partly</b></button><button type="button" class="segb" data-n="2" aria-pressed="false"><b>Yes</b></button></div></div>' + rateHtml('r1', 'Rate your fluency, not the outcome.', FLU) + '<button type="button" class="btn solid" id="sub" disabled>Log it</button>'));
    const ready = () => { $('#sub').disabled = !(sc > 0 && bad >= 0); };
    $('#aa').oninput = function () { act = Number(this.value); $('#aav').textContent = act; };
    $$('#bd .segb', runBody).forEach(b => { b.onclick = () => { $$('#bd .segb', runBody).forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); bad = Number(b.getAttribute('data-n')); ready(); }; });
    wireRate('r1', n => { sc = n; ready(); });
    $('#sub').onclick = () => {
      const first = missionStats(m.id).n === 0;
      const res = award('field', {xp:first ? 60 : 35, pts:{composure:10, resilience:4}, q:'field', score:sc, meta:m.t, extra:{pred, act, chance, bad, mid:m.id}});
      const gap = pred - act;
      const lines = ['Anxiety: expected ' + pred + ', actual ' + act + '. Fluency ' + sc + ' of 5.',
        bad === 0 ? 'You gave it a ' + chance + '% chance of going badly. It did not. Keep that on record.' : (bad === 1 ? 'It went partly badly. Note what you would change, then repeat this step.' : 'It went badly. That is data, not a verdict. Repeat this step at a smaller size.'),
        gap >= 2 ? 'The real thing was easier than you predicted by ' + gap + ' points.' : (gap <= -2 ? 'It was harder than predicted. Stay on this step before moving up.' : 'Your prediction was close.')];
      resultScreen('Mission logged', lines, res, {label:'Another mission', fn:() => { openRun('Field mission'); list(); }});
    };
  };
  list();
}
export const DRILLS = {breath:runBreath, read:runRead, raid:runRaid, cold:o => runCold(false, o)};
export function startRun(list) { RUN.active = true; RUN.q = list.slice(); RUN.n = list.length; RUN.i = 0; nextRun(); }
export function nextRun() { if (!RUN.q.length) { stopRun(); return; } const k = RUN.q.shift(); RUN.i++; DRILLS[k]({auto:true}); }
export const RUN_FULL = ['breath', 'read', 'raid', 'cold', 'raid', 'cold'];
export const RUN_SHORT = ['breath', 'raid', 'cold'];
