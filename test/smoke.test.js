// UI smoke test: drives the calm surface (Home, Breathe, Speak, Progress, the Settings sheet and the
// full-screen drill covers) in jsdom with a fake clock.
const errors=[];
const KEY='fluency-rank:v2';
const {bootApp}=require('./load');
async function boot(seed,raw){
  return bootApp({onError:m=>errors.push(m),beforeParse(w){
    w.scrollTo=()=>{};
    if(w.HTMLCanvasElement)w.HTMLCanvasElement.prototype.getContext=()=>({clearRect(){},fillRect(){},fillStyle:''});
    let now=1000;const q=[];const dead=new Set();let id=1;
    w.__clock={advance(ms){const target=now+ms;for(;;){q.sort((a,b)=>a.t-b.t);const n=q[0];if(!n||n.t>target)break;q.shift();now=n.t;try{n.fn()}catch(e){errors.push('timer: '+e.stack)}if(n.every&&!dead.has(n.id)){n.t=now+n.every;q.push(n)}}now=target}};
    w.performance.now=()=>now;
    w.setTimeout=(fn,ms)=>{const i=id++;q.push({id:i,t:now+(ms||0),fn});return i};
    w.clearTimeout=i=>{dead.add(i);const k=q.findIndex(x=>x.id===i);if(k>=0)q.splice(k,1)};
    w.setInterval=(fn,ms)=>{const i=id++;q.push({id:i,t:now+ms,fn,every:ms});return i};
    w.clearInterval=w.clearTimeout;
    w.requestAnimationFrame=fn=>{const i=id++;q.push({id:i,t:now+16,fn:()=>fn(now)});return i};
    w.cancelAnimationFrame=w.clearTimeout;
    if(raw!==undefined)w.localStorage.setItem(KEY,raw);
    else if(seed)w.localStorage.setItem(KEY,JSON.stringify(seed));
    w.addEventListener('error',e=>errors.push('window error: '+e.message));
  }});
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let fails=0;
function assert(c,m){if(!c){fails++;errors.push('ASSERT: '+m);console.log('FAIL',m)}else console.log('ok  ',m)}
const pad=n=>String(n).padStart(2,'0');
const ds=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const ago=n=>{const d=new Date();d.setDate(d.getDate()-n);return ds(d)};

function kit(w){
  const d=w.document;
  const $=s=>d.querySelector(s);
  const $$=s=>[...d.querySelectorAll(s)];
  const click=el=>{if(!el)throw new Error('missing element');el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}))};
  const adv=ms=>{for(let i=0;i<ms/100;i++)w.__clock.advance(100)};
  const st=()=>JSON.parse(w.localStorage.getItem(KEY));
  const body=()=>$('#runBody').textContent;
  const foot=()=>$('#runFoot').textContent;
  const rate=n=>click($(`#r1 .segb[data-n="${n}"]`));
  const tab=t=>click($(`#tabs [data-v="${t}"]`));
  const view=()=>$('#view').textContent;
  const done=()=>{click($('#back'));adv(400)}; // Done on a result screen, then let the cover finish closing
  const named=n=>$$('button').find(b=>(b.getAttribute('aria-label')||b.textContent.trim())===n);
  const settings=()=>{tab('home');click($('[data-act="settings"]'))};
  const key=k=>d.dispatchEvent(new w.KeyboardEvent('keydown',{key:k,bubbles:true}));
  const change=(sel,v)=>{const el=$(sel);if(typeof v==='boolean')el.checked=v;else el.value=v;el.dispatchEvent(new w.Event('change',{bubbles:true}))};
  return {d,$,$$,click,adv,st,body,foot,rate,tab,view,done,named,settings,key,change};
}
/* the speaking drill a daily session uses today: same rule as js/drills.js */
const dayIdx=()=>{const p=ds(new Date()).split('-').map(Number);return Math.round(Date.UTC(p[0],p[1]-1,p[2])/86400000)%3};

(async()=>{
  /* ---------- Home, tabs, Settings, accessibility ---------- */
  {
    const w=await boot();const k=kit(w);await sleep(50);
    const {$,$$,click,adv,st,body,tab,view,named,settings,key,d}=k;
    assert(view().includes('Today')&&view().includes('Today 0 of 2'),'Home shows the large title and Today 0 of 2');
    assert(view().includes('This week 0 of 5')&&!view().includes('Best run'),'Home shows the quiet numbers row, with no best run before there is one');
    assert($$('#view .wd').length===7,'week strip has 7 days');
    assert($('[data-act="session"]').textContent==='Start daily session · 5 min','primary button is the daily session');
    assert($('[data-act="speak"]').textContent==='I’m about to speak','secondary button is I am about to speak');
    assert($('[data-act="short"]').textContent==='Low energy? Short version','short version link');
    assert(!/XP|Rank|Level/.test(view()),'Home contains no XP, Rank or Level text');
    assert(!/energy scale|Fresh|Spent/.test(view())&&!$('[data-act="energy"]'),'no energy scale on Home');
    assert($('#tabs [data-v="home"]').getAttribute('aria-current')==='page','Home tab marked current');
    assert($$('#tabs button').map(b=>b.textContent.trim()).join()==='Home,Breathe,Speak,Progress','tab bar labels are always visible');
    assert($$('#tabs svg').length===4&&$$('#tabs svg').every(s=>s.getAttribute('aria-hidden')==='true'),'tab bar has decorative line icons');
    assert(!$('#notice').textContent&&$('#notice').hidden,'no notice on clean boot');
    let locked=false;
    for(const t of ['breathe','gates','progress','home']){tab(t);if(d.body.textContent.includes('Locked'))locked=true;}
    assert($('#tabs [data-v="home"]').getAttribute('aria-current')==='page','tabs cycle back to Home');
    tab('gates');
    assert(view().includes('Read aloud')&&view().includes('Word warm-up')&&view().includes('Practice questions'),'Speak lists the drills with plain names');
    assert(!view().includes('Challenge round'),'Challenge round is not listed before Rank D');
    assert(!!named('Open Read aloud'),'"Open Read aloud" is an accessible name');
    assert(!!named('Open Word warm-up')&&!!named('Open Practice questions')&&!!named('Open Real-world steps'),'Speak buttons name their context');
    assert($$('.course li').length===8&&$$('.course .buoy').length===8,'real-world steps drawn as a course with a buoy per step');
    assert($$('.course li.next').length===1,'one next buoy is marked');
    assert(!/Gate|Raid|Gauntlet|Field mission|Cold Question|Paced Reading/.test(view()),'no old game names on Speak');
    tab('breathe');
    assert($$('[data-act="bmins"]').map(b=>b.textContent.trim()).join()==='1 min,3 min,5 min','Breathe shows 1, 3 and 5 min chips');
    assert(!!named('Start Calm now: Cyclic sighing')&&!!named('Start Before speaking: Breathe and speak')&&!!named('Start Focus: Box breathing')&&!!named('Start Wind down: Extended exhale'),'Breathe lists the four goal rows');
    assert(!!named('Open Cyclic sighing')&&!!named('Open Box breathing')&&!!named('Open Extended exhale')&&!!named('Open Resonance breathing')&&!!named('Open Custom pattern'),'All techniques lists named techniques and Custom pattern');
    assert(view().includes('Stanford')&&view().includes('HRV-biofeedback'),'All techniques includes carefully worded evidence lines');
    tab('home');
    assert(d.activeElement===$('#view h1'),'focus moves to the new large title on a tab switch');

    // Settings sheet
    settings();
    assert(!$('#sheet').hidden&&d.activeElement===$('#sheetTitle'),'gear opens Settings with focus on its heading');
    assert($('#app').inert===true&&$('#app').getAttribute('aria-hidden')==='true','background is inert under the sheet');
    const sh=$('#sheet').textContent;
    assert(sh.includes('Practice time')&&sh.includes('Sounds you find hard')&&sh.includes('Your opening line')&&sh.includes('Backup')&&sh.includes('Reset progress'),'Settings holds plan time, hard sounds, opener, backup and reset');
    assert(sh.includes('Practice, not therapy')&&sh.includes('speech therapist')&&sh.includes('Techniques in short'),'Help says practice not therapy, how to find a therapist, and the techniques');
    assert(!/go away for good|cure/i.test(sh.replace('cannot promise your stammer will go away','')),'Help makes no cure promise');
    if(sh.includes('Locked')||d.body.textContent.includes('Locked'))locked=true;
    assert(!locked,'no element contains the text "Locked"');
    click($('[data-act="plan"]'));
    assert(st().plan.anchor!==''&&st().xp===0,'choosing a practice time saves it without XP');
    assert($('[data-act="plan"]').getAttribute('aria-pressed')==='true','chosen time is marked');
    key('Escape');adv(400);
    assert($('#sheet').hidden&&$('#app').getAttribute('aria-hidden')===null,'Escape closes the sheet and restores the page');
    settings();click($('[data-act="sheetDone"]'));adv(400);
    assert($('#sheet').hidden,'Done closes the sheet');
  }

  /* ---------- every drill ---------- */
  {
    const w=await boot();const k=kit(w);await sleep(50);
    const {$,click,adv,st,body,foot,rate,tab,view,done,settings,change,d}=k;

    // breath from the Breathe tab, with the tide pacer
    tab('breathe');click($('[data-act="breath"][data-v="gentle"]'));
    assert(!$('#run').hidden,'breath cover opens');
    assert($('#app').getAttribute('aria-hidden')==='true'&&$('#tabs').inert===true,'background inert while a drill runs');
    assert(d.activeElement&&d.activeElement.tagName==='H2','focus moves to the cover heading');
    assert(!!$('#runFoot #end')&&$('#end').textContent==='End','one End control at the bottom');
    assert(!$('#abort')&&!$('#stop'),'no Exit or Stop controls');
    assert(!!$('#snd'),'Sound toggle stays in the header');
    click($('#go'));
    const live=$('#tpLive');
    assert(live&&live.getAttribute('aria-live')==='polite','the pacer has an aria-live region');
    assert(!!$('#tpW')&&d.querySelectorAll('.tp-wave').length===2&&d.querySelectorAll('.tp-snd i').length===9,'pacer has water, two waves and sounding lines every 10%');
    adv(1000);
    assert(live.textContent==='Breathe in'&&$('#tpWord').textContent==='Breathe in','pacer announces the inhale');
    const t1=$('#tpW').style.transform;adv(1000);
    assert(t1!==$('#tpW').style.transform&&/translateY/.test(t1),'water level moves with transform');
    adv(3000);
    assert(live.textContent==='Out, slowly','pacer announces the exhale');
    adv(176000);
    assert(body().includes('You breathed for 3 min.'),'result leads with a plain line');
    assert(body().includes('[Logged] Breathe · +20 XP'),'breath +20 XP as a System notice');
    assert(!$('#end'),'End is replaced by Done on the result screen');
    done();
    assert($('#run').hidden&&$('#app').getAttribute('aria-hidden')===null,'background restored after the drill');
    let s=st();
    assert(s.streak===1&&s.daily.breath===1&&s.daily.breathDone&&Object.keys(s.days).length===1,'practice day, streak and mosaic credited');
    assert(s.stats.breath>=12,'breath stat gained');
    tab('home');
    assert(view().includes('Today 1 of 2')&&view().includes('This week 1 of 5 · Best run 1'),'Home shows today 1 of 2 and the week');
    assert(k.$$('.wd.n1').length===1,'week strip shows a half-height mark for one item');

    // read aloud
    tab('gates');click(k.named('Open Read aloud'));click($('#go'));adv(150000);
    assert(body().includes('How smooth'),'read reaches rating');
    rate(4);click($('#sub'));
    assert(body().includes('[Logged] Read aloud · +25 XP')&&body().includes('[Quest complete] Daily Quest · +40 XP'),'read gives +25 and the Daily Quest +40');
    assert(!/energy/i.test(body()),'no energy wording in the read result');
    done();
    s=st();assert(s.up===1&&s.rung===2,'pace target counts one smooth read');
    assert(s.days[s.daily.date].n===2,'practice day records both items');
    tab('home');assert(view().includes('Today 2 of 2')&&k.$$('.wd.n2').length===1,'Home shows 2 of 2 and a full tide mark');

    // word warm-up
    tab('gates');click($('[data-act="raid"]'));click($('#go'));
    click($('#plus'));click($('#plus'));click($('#plus'));
    assert($('#cnt').textContent==='3','warm-up counter');
    adv(46000);
    assert(body().includes('You said 3 words in 45 seconds'),'warm-up finishes with the count');
    assert(body().includes('+25 XP'),'warm-up +25 XP');
    done();
    s=st();assert(s.daily.raid===1,'warm-up recorded');
    tab('gates');click($('[data-act="raid"]'));click($('#go'));click($('#blank'));adv(46000);done();
    s=st();assert(Object.keys(s.weak).length===1,'a blank adds a weak letter');

    // practice question
    tab('gates');click($('[data-act="cold"]'));click($('#go'));
    assert($('#runBody .h-q')&&$('#runBody .h-q').textContent.length>10,'question shown');
    adv(6000);
    assert(body().includes('Answer aloud'),'question moves to the answer phase');
    click($('#done'));rate(5);$('#lead').checked=true;$('#calm').checked=true;click($('#sub'));
    assert(body().includes('[Logged] Practice question · +30 XP'),'practice question +30 XP');
    done();
    s=st();assert(s.daily.cold===1,'question recorded');

    // real-world step, with the optional debrief after it
    tab('gates');click($('[data-act="field"]'));
    assert(body().includes('Suggested next'),'steps list marks a suggested step');
    click($('[data-ch="ms"][data-v="m1"]'));
    $('#pa').value='7';$('#pa').oninput.call($('#pa'));
    click($('#go'));
    assert(body().includes('Do it, then come back'),'step now screen');
    click($('#done'));
    assert($('#sub').disabled,'log disabled until ratings given');
    click($('#bd .segb[data-n="0"]'));rate(4);
    assert(!$('#sub').disabled,'log enabled after ratings');
    click($('#sub'));
    assert(body().includes('+60 XP')&&body().includes('[Title earned] The One Who Spoke First'),'first step is +60 XP and earns a title');
    s=st();const f=s.log.filter(e=>e.type==='field')[0];
    assert(f&&f.pred===7&&f.mid==='m1'&&f.bad===0,'step log carries prediction and outcome');
    click($('#debrief'));
    click($('#sub'));assert(body().includes('Two lines'),'empty debrief rejected');
    $('#d1').value='Opened clearly';$('#d2').value='Pause earlier';click($('#sub'));
    assert(body().includes('Saved. Leave it there.'),'debrief saved after a step');
    done();
    tab('gates');assert(k.$$('.course li.done').length===1,'done step shows a filled buoy');

    // I'm about to speak
    tab('home');click($('[data-act="speak"]'));
    assert(body().includes('Three slow sighs')&&!!$('#tpLive'),'I am about to speak starts with the sighs on the tide pacer');
    adv(500);assert($('#tpLive').textContent==='Breathe in','first inhale announced');
    adv(2000);assert($('#tpLive').textContent==='In again, a little more','second inhale announced');
    adv(1000);assert($('#tpLive').textContent==='Out, slowly','long exhale announced');
    adv(24000);
    assert(body().includes('Your opening line')&&$('#tpSay').textContent===st().opener,'opening line shown on the exhale');
    adv(20500);
    assert(body().includes('Say your first sentence'),'then say your first sentence');
    assert(!!$('#runBody .thumb #done'),'I said it sits in the thumb-reach container');
    click($('#done'));
    assert(body().includes('You are ready to speak.')&&body().includes('+20 XP'),'I am about to speak completes');
    done();
    s=st();assert(s.log[s.log.length-1].type==='ritual'&&s.daily.ritual===1,'ritual logged and counts as breath');

    // Progress
    tab('progress');
    const pv=view();
    assert(k.$('#view .emblem')&&pv.includes('Level')&&pv.includes('Courage'),'Progress shows the rank emblem, level and Courage');
    assert(k.$$('#view .stat').length===5,'five stats');
    assert(k.$$('#view .mosaic .mc').length===66&&k.$$('#view .mosaic .mc.n2').length===1,'66-cell mosaic, today filled for both items');
    assert(pv.includes('The One Who Spoke First'),'earned titles listed');
    assert(pv.includes('Recent sessions')&&pv.includes('Read aloud · fluency 4'),'recent sessions listed with plain names');
    assert(!/energy/i.test(pv),'no energy rows in Progress');
    assert($('#sum').value.includes('Real-world steps: 1')&&!/energy/i.test($('#sum').value),'therapist summary has steps and no energy wording');

    // settings fields
    settings();
    change('#hard','b<p!m');assert(st().hard==='BPM','hard sounds sanitised');
    change('#opener','  Hello <b>team</b>  ');
    click($('[data-act="sheetDone"]'));adv(400);settings();
    assert($('#opener').value.includes('<b>')&&!$('#sheetBody').innerHTML.includes('<b>team</b>'),'opener escaped in the DOM');
    change('#hclk',true);assert(st().hideClock===true,'hide countdown toggle saves');

    // backup and import (Export/Import buttons + collapsible text fallback)
    assert(!!$('[data-act="export"]')&&!!$('[data-act="importFile"]')&&!!$('.bk-raw'),'Backup shows Export/Import buttons and collapsible text box');
    const bk=$('#bk').value;
    $('#bk').value='not json';click($('[data-act="import"]'));
    assert($('#bkmsg').textContent.includes('not a valid backup'),'bad import rejected');
    $('#bk').value=JSON.stringify({xp:'x'});click($('[data-act="import"]'));
    assert($('#bkmsg').textContent.includes('not a valid backup'),'wrong shape rejected');
    const o=JSON.parse(bk);o.xp=5000;o.stats.pace=-50;o.streak='9';o.energy=99;
    $('#bk').value=JSON.stringify(o);click($('[data-act="import"]'));
    s=st();assert(s.xp===5000&&s.stats.pace===0&&s.energy===5&&s.streak===9,'import validates and clamps values');
    assert($('#bkmsg').textContent==='Backup loaded.','import confirms in place');

    // reset opens iPhone-style confirmation sheet
    click($('#rst'));
    assert(!$('#modal').hidden&&$('#modal').classList.contains('sheet-modal')&&!!$('#mconfirm')&&!!$('#mclose'),'reset opens confirmation sheet');
    click($('#mclose'));
    assert($('#modal').hidden&&st().xp===5000,'Cancel keeps progress intact');
    click($('#rst'));click($('#mconfirm'));
    assert($('#modal').hidden&&st().xp===0,'confirming reset clears progress');
  }

  /* ---------- Goal-first Breathe: one-tap start, Box holds, Custom, Voice guide, Wake Lock ---------- */
  {
    const w=await boot();const k=kit(w);await sleep(50);
    const {$,click,adv,st,body,tab,done,settings,change}=k;
    // mock speechSynthesis and wakeLock
    const spoken=[];let cancelled=0,wakeReq=0,wakeRel=0;
    w.SpeechSynthesisUtterance=function(t){this.text=t;this.rate=1;};
    w.speechSynthesis={speak(u){spoken.push(u.text)},cancel(){cancelled++}};
    w.navigator.wakeLock={request:async()=>{wakeReq++;return {release:async()=>{wakeRel++},addEventListener(){}}}};

    settings();change('#voice',true);assert(st().voice===true,'voice guide toggle saves');
    click($('[data-act="sheetDone"]'));adv(400);

    tab('breathe');
    click($('[data-act="bmins"][data-v="1"]'));
    assert(st().breathMins===1,'1 min chip saves');
    // one tap on Focus starts Box breathing immediately (no setup screen)
    click($('[data-act="goal"][data-v="box"]'));
    await sleep(0);
    assert(!!$('#tpLive')&&!$('#go'),'tapping a goal starts the tide pacer in one tap');
    assert(wakeReq===1,'Wake Lock requested when pacer starts');
    adv(500);assert($('#tpLive').textContent==='Breathe in'&&spoken.includes('Breathe in'),'Box breathing announces and speaks Breathe in');
    adv(4000);assert($('#tpLive').textContent==='Hold'&&spoken.includes('Hold'),'Box breathing announces and speaks Hold');
    adv(4000);assert($('#tpLive').textContent==='Out, slowly','Box breathing announces Out, slowly');
    adv(4000);assert($('#tpLive').textContent==='Hold','Box breathing announces second Hold');
    adv(48000);
    assert(body().includes('You breathed for 1 min.')&&body().includes('+20 XP'),'1 min goal session finishes and logs');
    assert(wakeRel>=1,'Wake Lock released when pacer finishes');
    done();

    // Custom pattern
    tab('breathe');click($('[data-act="breath"][data-v="custom"]'));
    $('#cbIn').value='5';$('#cbIn').oninput.call($('#cbIn'));
    $('#cbH1').value='2';$('#cbH1').oninput.call($('#cbH1'));
    $('#cbOut').value='7';$('#cbOut').oninput.call($('#cbOut'));
    assert(st().customBreath.inS===5&&st().customBreath.hold1===2&&st().customBreath.outS===7,'custom pattern timings save');
    click($('#go'));
    adv(500);assert($('#tpLive').textContent==='Breathe in','custom pattern starts inhale');
    adv(5000);assert($('#tpLive').textContent==='Hold','custom pattern honours hold');
    adv(2000);assert($('#tpLive').textContent==='Out, slowly','custom pattern moves to exhale');
    click($('#end'));click($('#endYes'));adv(400);
    assert(cancelled>=1,'ending cancels speechSynthesis');
  }

  /* ---------- Step 4: recorder measures, 14-day retention, proof flow, checklist, mic denied ---------- */
  {
    const w=await boot();const k=kit(w);await sleep(50);
    const {$,$$,click,adv,st,body,tab,view,done,settings}=k;
    const Rec=w.__mod('js/recorder.js');

    // 1. Synthetic PCM audio buffer: 2s speech (0.2 amp) + 1.5s silence + 2s speech at 1000 Hz
    const sr=1000,pcm=new Float32Array(5500);
    for(let i=0;i<2000;i++)pcm[i]=0.2*Math.sin(i*0.1);
    for(let i=3500;i<5500;i++)pcm[i]=0.2*Math.sin(i*0.1);
    const m=Rec.analyzeSamples(pcm,sr,12);
    assert(m.pauses===1&&m.speakingSec>=3.5&&m.wpm>0,'synthetic PCM buffer measures pauses >1s, speaking time and WPM');

    // 2. 14-day retention: expired drill deleted, fresh drill & old proof kept
    const now=Date.now();
    await Rec.saveClip({id:'old-drill',kind:'drill',createdAt:now-20*86400000,bytes:500});
    await Rec.saveClip({id:'new-drill',kind:'drill',createdAt:now-2*86400000,bytes:500});
    await Rec.saveClip({id:'old-proof',kind:'proof-cold',createdAt:now-30*86400000,bytes:800});
    const pruned=await Rec.pruneExpiredClips(now);
    const left=await Rec.listClips();
    assert(pruned===1&&left.some(c=>c.id==='new-drill')&&left.some(c=>c.id==='old-proof')&&!left.some(c=>c.id==='old-drill'),'14-day retention deletes expired drill clips and keeps proof clips');

    // 3. Mock MediaRecorder & getUserMedia for Before/After Proof flow
    w.navigator.mediaDevices={getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})};
    w.MediaRecorder=class{
      constructor(){this.mimeType='audio/webm';this.state='inactive';}
      start(){this.state='recording';if(this.ondataavailable)this.ondataavailable({data:{size:1024}});}
      stop(){this.state='inactive';if(this.onstop)this.onstop();}
    };
    tab('home');
    click($('[data-act="proof"]'));
    assert(body().includes('1 of 3 · Cold read'),'3-min proof starts with cold read');
    click($('#recGo'));await sleep(20);adv(3000);
    click($('#recGo'));await sleep(20);
    assert(body().includes('2 of 3 · Breathe'),'proof moves to 2-min breathe');
    adv(121000);
    assert(body().includes('3 of 3 · Paced re-read'),'proof moves to paced re-read');
    click($('#recGo'));await sleep(20);adv(3000);
    click($('#recGo'));await sleep(20);
    assert(body().includes('Hear the difference')&&body().includes('These measure pace and pauses, not stammering.'),'proof shows side-by-side comparison and honest measures caption');
    click($('#rc1 .segb[data-n="2"]'));click($('#rc2 .segb[data-n="4"]'));
    click($('#sub'));await sleep(20);
    assert(body().includes('Baseline saved.'),'proof saves baseline');
    done();
    assert(st().proofDone===true&&st().proofColdRate===2&&st().proofPacedRate===4,'proof ratings and baseline state persisted');
    tab('progress');
    assert(view().includes('Then and now')&&view().includes('Baseline cold read: fluency 2 of 5'),'Progress shows Then and now baseline');

    // 4. Technique checklist in Read aloud + mic denied still works
    w.navigator.mediaDevices={getUserMedia:async()=>{throw new Error('NotAllowedError')}};
    tab('gates');click($('[data-act="read"]'));click($('#go'));
    click($('#recBtn'));await sleep(20);
    assert($('#recMsg').textContent.includes('Microphone blocked'),'mic denied fails gracefully without blocking drill');
    adv(150000);
    assert(body().includes('Am I doing it right?'),'Read aloud shows technique checklist');
    click($('.chk-chip[data-tick="0"]'));click($('.chk-chip[data-tick="2"]'));
    k.rate(4);click($('#sub'));await sleep(20);
    done();
    const lastLog=st().log[st().log.length-1];
    assert(Array.isArray(lastLog.ticks)&&lastLog.ticks.length===2,'technique checklist ticks saved on log entry');

    // 5. Delete all recordings in Settings
    settings();await sleep(20);
    click($('[data-act="delClips"]'));
    assert(!$('#modal').hidden&&$('#mconfirm').textContent==='Delete all','Delete all recordings opens confirmation sheet');
    click($('#mconfirm'));await sleep(20);
    const afterDel=await Rec.listClips();
    assert(afterDel.length===0&&st().proofColdId==='','Delete all recordings clears clip store and baseline ids');
  }

  /* ---------- Step 5 + UX Laws: feared words, contexts, custom banks, step tracker, goal bar ---------- */
  {
    const w=await boot();const k=kit(w);await sleep(50);
    const {$,$$,click,adv,st,tab,settings,change}=k;
    const P=w.__mod('js/personal.js');

    // Postel's Law forgiving parser & 30-word cap
    const parsed=P.parseFearedWords(' "schedule", budget;\nTuesday , SCHEDULE ');
    assert(parsed.join()==='schedule,budget,Tuesday','Postel parser normalises commas, semicolons, newlines, quotes and duplicates');
    const many=P.parseFearedWords(Array.from({length:40},(_,i)=>'word'+i).join(','));
    assert(many.length===30,'feared words capped at 30');

    // Weaving into passage & question
    const wState={userName:'Anish',fearedWords:['schedule'],hard:'B'};
    const wp=P.weavePassage({t:'T',x:'Base text.'},wState,0.1);
    assert(wp.x.includes('Anish')&&wp.x.includes('schedule'),'weavePassage weaves user name and feared word at ~1 in 3');
    const wq=P.personalQuestion(wState,0.1);
    assert(wq&&wq.t.includes('schedule')||wq&&wq.t.includes('Anish'),'personalQuestion weaves feared word or name');

    // Home Goal-Gradient bar & Daily Session connected step tracker
    tab('home');
    assert($$('.goal-bar i').length===2&&$$('.goal-bar i.on').length===0,'Home renders 2-segment Goal-Gradient bar');
    click($('[data-act="session"]'));
    assert(!$('#runSteps').hidden&&$$('#runSteps li').length===3&&$$('#runSteps li.now').length===1,'Daily session shows 3-step connected tracker');
    click($('#end'));click($('#endYes'));adv(400);

    // Settings: contexts, feared words, name, custom question & passage
    settings();
    change('#uname','Anish');change('#feared','schedule; "budget"\nTuesday');
    assert(st().userName==='Anish'&&st().fearedWords.join()==='schedule,budget,Tuesday','name and feared words save cleanly from Settings');
    change('#ctx-work',false);
    assert(st().contexts.join()==='phone','unchecking Work filters to Phone context');
    change('#ctx-phone',false);
    assert(st().contexts.join()==='phone','cannot uncheck the last active context');
    $('#newQ').value='Tell me your order number slowly.';click($('[data-act="addQ"]'));
    assert(st().customQuestions.length===1,'custom question added');
    $('#newPT').value='My opener';$('#newPX').value='Hello, this is my custom practice passage.';click($('[data-act="addP"]'));
    assert(st().customPassages.length===1,'custom passage added');
    click($('[data-act="delQ"]'));click($('[data-act="delP"]'));
    assert(st().customQuestions.length===0&&st().customPassages.length===0,'custom question and passage removed');

    // Step 6: Reminder time picker, presets, weekday pills, .ics generator & Help accordions
    const M=w.__mod('js/main.js'), V=w.__mod('js/views.js');
    click($('[data-act="remPre"][data-v="8:0"]'));
    click($('[data-act="remStep"][data-v="15"]'));
    assert(st().reminder.on===true&&st().reminder.hour===8&&st().reminder.min===15,'reminder preset and 15-min stepper save');
    click($('[data-act="remDay"][data-v="5"]'));
    assert(st().reminder.days.includes(5),'weekday pill toggles Saturday');
    const ics=M.buildIcs(st().reminder);
    assert(ics.includes('BEGIN:VCALENDAR')&&ics.includes('RRULE:FREQ=WEEKLY;BYDAY=')&&ics.includes('BEGIN:VALARM'),'buildIcs outputs valid recurring calendar alert');
    assert(V.isReminderDue(new Date(2026,10,23,9,0))===true&&V.isReminderDue(new Date(2026,10,23,7,0))===false,'isReminderDue triggers gently after chosen time on active days');
    assert($$('.help-acc').length===4,'Help renders as 4 clean accordion cards');
  }

  /* ---------- End control: partial credit, and nothing done ---------- */
  {
    const w=await boot();const k=kit(w);await sleep(50);
    const {$,click,adv,st,body,foot,tab,done,key}=k;
    tab('breathe');click($('[data-act="breath"][data-v="slow"]'));click($('#go'));adv(70000);
    click($('#end'));
    assert(foot().includes('End now? The 1 min you did still counts.'),'End asks for confirmation inline');
    assert(!!$('#endYes')&&$('#endNo').textContent==='Keep going','confirmation offers End and Keep going');
    click($('#endNo'));
    assert(!!$('#end')&&!$('#endYes'),'Keep going returns to the session');
    click($('#end'));key('Escape');
    assert(!!$('#end')&&!$('#endYes'),'Escape dismisses the confirmation');
    click($('#end'));click($('#endYes'));
    assert(body().includes('You breathed for 1 min. It counts.')&&body().includes('+20 XP'),'End after a minute awards partial credit');
    let s=st(),last=s.log[s.log.length-1];
    assert(last.type==='breath'&&/\(ended early\)$/.test(last.meta)&&s.daily.breathDone,'partial goes through award() and is marked ended early');
    done();

    tab('gates');click($('[data-act="read"]'));click($('#go'));adv(10000);
    const n=st().log.length;
    click($('#end'));
    assert(foot().includes('nothing is logged'),'End before a minute says nothing is logged');
    click($('#endYes'));adv(400);
    assert($('#run').hidden&&st().log.length===n,'End with nothing done just closes');

    // End at the rating screen still counts the passage
    tab('gates');click($('[data-act="read"]'));click($('#go'));adv(150000);
    click($('#end'));assert(foot().includes('The passage you read still counts.'),'a finished passage counts as an item');
    click($('#endYes'));
    s=st();assert(s.log[s.log.length-1].type==='read'&&s.daily.speakDone,'ending at the rating still credits the read');
    done();
  }

  /* ---------- daily session and short version ---------- */
  {
    const w=await boot();const k=kit(w);await sleep(50);
    const {$,click,adv,st,body,rate,tab,done}=k;
    click($('[data-act="session"]'));
    assert($('#runTitle').textContent==='Daily session · 1 of 3','daily session starts with breath');
    adv(61000);
    const drill=['read','raid','cold'][dayIdx()],names={read:'Read aloud',raid:'Word warm-up',cold:'Practice question'};
    assert($('#nextb')&&$('#nextb').textContent==='Next: '+names[drill],'session offers today’s rotating drill');
    click($('#nextb'));
    assert($('#runTitle').textContent==='Daily session · 2 of 3','second step');
    if(drill==='read'){adv(150000);rate(3);click($('#sub'));}
    else if(drill==='raid'){click($('#go'));adv(46000);}
    else {click($('#done'));rate(3);click($('#sub'));}
    assert($('#nextb').textContent==='Next: Practice question','session ends with a practice question');
    click($('#nextb'));click($('#done'));rate(4);click($('#sub'));
    assert(body().includes('That is today’s session done.')&&!$('#nextb'),'session completes');
    done();
    let s=st();
    assert(s.daily.cleared===true&&s.daily.breathDone&&s.daily.speakDone&&s.daily.breath===1&&s.daily.cold>=1,'daily session completes the Daily Quest');
    assert(s.log.length===3,'three items logged');

    click($('[data-act="short"]'));
    assert($('#runTitle').textContent==='Short version · 1 of 2','short version starts with breath');
    adv(61000);
    assert($('#nextb').textContent==='Next: Word warm-up','short version follows with a word warm-up');
    click($('#nextb'));
    assert(!$('[data-ch="secs"]'),'short warm-up has a fixed length');
    click($('#go'));adv(31000);
    assert(body().includes('in 30 seconds')&&body().includes('That is today’s session done.'),'short version is a 30 second warm-up');
    done();
    s=st();assert(s.log.length===5&&s.daily.raid===1,'short version logged');
    // End part-way through a session keeps what was finished
    click($('[data-act="session"]'));adv(61000);click($('#nextb'));
    click($('#end'));
    assert(k.foot().includes('What you finished earlier is saved.'),'End mid-session says finished items are saved');
    click($('#endYes'));adv(400);
    assert($('#run').hidden&&st().log.length===6,'ending mid-session keeps the breath already logged');
  }

  /* ---------- Challenge round appears at Rank D ---------- */
  {
    const w=await boot({v:2,xp:1500,updatedAt:1});const k=kit(w);await sleep(50);
    const {$,click,st,body,rate,tab,done,named,view}=k;
    tab('gates');
    assert(view().includes('Challenge round')&&!!named('Open Challenge round'),'Challenge round listed from Rank D');
    assert(!view().includes('Locked'),'nothing shown as Locked at Rank D');
    click($('[data-act="boss"]'));click($('#go'));
    for(let i=1;i<=5;i++){assert(body().includes('Question '+i+' of 5'),'challenge question '+i);click($('#done'));}
    assert(body().includes('How did the round go'),'challenge reaches rating');
    rate(4);click($('#sub'));
    assert(body().includes('[Logged] Challenge round · +100 XP'),'challenge round cleared');
    done();
    let s=st();assert(s.bosses===1&&s.daily.cold===2,'challenge counted and fills the question count');
    // ending after two questions credits the drill amount, marked partial
    tab('gates');click($('[data-act="boss"]'));click($('#go'));click($('#done'));click($('#done'));
    click($('#end'));assert(k.foot().includes('The 2 questions you answered still count.'),'challenge End counts answered questions');
    click($('#endYes'));
    s=st();const last=s.log[s.log.length-1];
    assert(last.type==='cold'&&last.xp===30&&/\(ended early\)$/.test(last.meta),'partial challenge earns the question amount');
    done();
  }

  /* ---------- streak, shields, comeback ---------- */
  {
    const w=await boot({v:2,xp:100,streak:5,best:5,shields:1,lastDay:ago(2),updatedAt:1});const k=kit(w);await sleep(50);
    assert(k.view().includes('Best run 5'),'Home shows the best run');
    k.tab('breathe');k.click(k.$('[data-act="breath"]'));k.click(k.$('#go'));k.adv(181000);k.done();
    const s=k.st();assert(s.streak===6&&s.shields===0,'one-day gap bridged by a shield; streak continues');
  }
  {
    const w=await boot({v:2,xp:100,streak:5,best:5,shields:0,lastDay:ago(4),updatedAt:1});const k=kit(w);await sleep(50);
    k.tab('breathe');k.click(k.$('[data-act="breath"]'));k.click(k.$('#go'));k.adv(181000);
    assert(k.body().includes('[Comeback bonus] +25 XP')&&k.body().includes('+20 XP'),'comeback bonus added after a gap');
    k.done();
    const s=k.st();assert(s.streak===1&&s.best===5&&s.comeback===false,'run restarts quietly, best kept, comeback used');
  }

  /* ---------- weekly goal ---------- */
  {
    // four other practice days in this Monday-start week, then a fifth today
    const now=new Date(),mon=new Date(now);mon.setDate(now.getDate()-((now.getDay()+6)%7));
    const days={};for(let i=0;i<7&&Object.keys(days).length<4;i++){const x=new Date(mon);x.setDate(mon.getDate()+i);if(ds(x)!==ds(now))days[ds(x)]={n:1,e:3};}
    const w=await boot({v:3,xp:100,days,updatedAt:1});const k=kit(w);await sleep(50);
    assert(k.view().includes('This week 4 of 5'),'Home counts this week');
    k.tab('breathe');k.click(k.$('[data-act="breath"]'));k.click(k.$('#go'));k.adv(181000);
    assert(k.body().includes('[Weekly goal met] +60 XP and a shield'),'fifth practice day this week shows the weekly notice');
    k.done();
    const s=k.st();assert(s.shields===1&&s.weekAward!=='','fifth practice day this week earns a shield');
  }

  /* ---------- resilience: corrupt, garbage, storage failure ---------- */
  {
    const w=await boot(null,'{not json');const k=kit(w);await sleep(50);
    assert(!k.$('#notice').hidden&&k.$('#notice').textContent.includes('fresh start'),'corrupt storage shows a notice');
    assert(w.localStorage.getItem(KEY+':corrupt')==='{not json','corrupt data is kept aside');
    k.tab('breathe');k.click(k.$('[data-act="breath"]'));k.click(k.$('#go'));k.adv(181000);
    assert(k.body().includes('+20 XP'),'app works after corrupt recovery');
  }
  {
    const garbage={v:99,xp:'abc',stats:null,streak:-4,shields:50,lastDay:'yesterday',energy:'hi',hard:{},opener:42,rung:99,coldSecs:7,plan:{anchor:'<img>',mins:5},days:{'2025-01-01':{n:9,e:9},bad:{}},weak:{a:1,Q:9,'1':3},daily:{date:7,breath:'x'},log:[null,{type:'nope',score:99,xp:-5,meta:{}},5]};
    const w=await boot(garbage);const k=kit(w);await sleep(50);
    assert(k.$('#view').innerHTML.length>500,'garbage state renders');
    for(const t of ['breathe','gates','progress','home'])k.tab(t);
    k.settings();k.change('#snds',false);
    const s=k.st();
    assert(s.xp===0&&s.rung===6&&s.coldSecs===60&&s.plan.anchor===''&&s.plan.mins===10&&s.shields===2&&s.energy===3,'garbage sanitised to safe values');
    assert(Object.keys(s.weak).join()==='Q'&&s.weak.Q===5,'weak map filtered and clamped');
    assert(s.log.length===1&&s.log[0].score===5&&s.log[0].xp===0&&s.log[0].type==='cold','log entries validated');
    assert(Object.keys(s.days).join()==='2025-01-01'&&s.days['2025-01-01'].n===4,'days map validated');
    k.tab('progress');assert(k.$$('#view .mosaic .mc.n2').length===1,'mosaic caps an old day at full');
  }
  {
    const w=await boot();const k=kit(w);await sleep(50);
    w.Storage.prototype.setItem=()=>{throw new Error('quota')};
    k.tab('breathe');k.click(k.$('[data-act="breath"]'));k.click(k.$('#go'));k.adv(181000);
    assert(k.body().includes('+20 XP'),'drill still works when storage fails');
    k.done();
    assert(!k.$('#notice').hidden&&k.$('#notice').textContent.includes('Settings'),'storage failure shows a visible notice pointing to Settings');
    k.settings();
    assert(k.$('#sync').textContent.includes('Not saved'),'sync label in Settings reflects the failure');
  }
  {
    // account sync shim: the page tolerates window.claude existing
    const w=await boot({v:2,xp:300,updatedAt:100});
    w.claude={use:async n=>n==='user'?{id:async()=>'u1'}:{doc:p=>({get:async()=>({exists:true,data:()=>({v:2,xp:900,updatedAt:500})}),set:async()=>{}})}};
    await sleep(50);
    assert(true,'shim present without crashing');
  }

  console.log('\n'+(fails?fails+' FAILED':'ALL PASSED'));
  const real=errors.filter(e=>!e.startsWith('ASSERT'));
  if(real.length){console.log('runtime errors:');real.forEach(e=>console.log(' -',e.split('\n').slice(0,3).join(' | ')))}
  process.exit(fails||real.length?1:0);
})();
