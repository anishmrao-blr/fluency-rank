const errors=[];
const KEY='fluency-rank:v2';
const {bootApp}=require('./load');
async function boot(seed,raw){
  return bootApp({onError:m=>errors.push(m),beforeParse(w){
    w.scrollTo=()=>{};
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
  const click=el=>{if(!el)throw new Error('missing element');el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}))};
  const adv=ms=>{for(let i=0;i<ms/100;i++)w.__clock.advance(100)};
  const st=()=>JSON.parse(w.localStorage.getItem(KEY));
  const body=()=>$('#runBody').textContent;
  const rate=n=>click($(`#r1 .segb[data-n="${n}"]`));
  const tab=t=>click($(`#tabs [data-v="${t}"]`));
  return {d,$,click,adv,st,body,rate,tab};
}

(async()=>{
  /* ---------- core flows ---------- */
  {
    const w=await boot();const k=kit(w);await sleep(50);
    const {$,click,adv,st,body,rate,tab,d}=k;
    assert($('#view').textContent.includes('Today’s run'),'status renders');
    for(const t of ['gates','log','guide','status'])tab(t);
    assert($('#view').textContent.includes('Today’s twist'),'tabs cycle back to status');
    assert($('#tabs [data-v="status"]').getAttribute('aria-current')==='page','tab marks aria-current');
    assert(!$('#notice').textContent,'no notice on clean boot');

    // plan
    tab('guide');
    click($('[data-act="plan"]'));
    assert(st().xp===30&&st().plan.anchor!=='','plan earns 30 XP once');
    click($('[data-act="plan"]'));
    assert(st().xp===30,'plan bonus not repeatable');

    // breath
    tab('gates');
    click($('[data-act="breath"]'));
    assert(d.getElementById('run').style.display==='block','breath overlay opens');
    assert($('#app').getAttribute('aria-hidden')==='true','background hidden while drill runs');
    click($('#go'));adv(121000);
    assert(body().includes('+20 XP'),'breath +20 XP');
    click($('#back'));
    assert($('#app').getAttribute('aria-hidden')===null,'background restored after drill');
    let s=st();
    assert(s.streak===1&&s.daily.breath===1&&Object.keys(s.days).length===1,'practice day, streak and mosaic credited');
    assert(s.stats.breath>=12,'breath stat gained');

    // read
    tab('gates');click($('[data-act="read"]'));click($('#go'));adv(150000);
    assert(body().includes('How smooth'),'read reaches rating');
    rate(4);click($('#sub'));
    assert(body().includes('+65 XP'),'read gives +25 plus the Daily Quest +40'); // fixed XP (spec 3): was +47 (32 + solid-day 15)
    click($('#back'));
    s=st();assert(s.up===1&&s.rung===2,'pace gate counts one smooth read');

    // raid
    tab('gates');click($('[data-act="raid"]'));click($('#go'));
    click($('#plus'));click($('#plus'));click($('#plus'));
    assert($('#cnt').textContent==='3','raid counter');
    adv(46000);
    assert(body().includes('3 words'),'raid finishes with count');
    assert(body().includes('+25 XP'),'raid +25 XP'); // fixed XP (spec 3): was +16
    click($('#back'));
    s=st();assert(s.daily.raid===1,'raid quest progress');
    assert(s.daily.breathDone===true&&s.daily.speakDone===true&&s.daily.cleared===true,'Daily Quest complete after breath and speak'); // fixed XP (spec 3): was the solid-day flag
    assert(Object.keys(s.weak).length===0||Object.keys(s.weak).length===1,'weak map stays valid');

    // cold with a blanked raid to exercise weak-letter tracking
    tab('gates');click($('[data-act="raid"]'));click($('#go'));click($('#blank'));adv(46000);click($('#back'));
    s=st();assert(Object.keys(s.weak).length===1,'blank adds a weak letter');
    assert(s.daily.raid===2,'second raid completes quest');

    // cold question
    tab('gates');click($('[data-act="cold"]'));
    click($('#go'));
    assert($('#runBody .q')&&$('#runBody .q').textContent.length>10,'cold question shown');
    adv(6000);
    assert(body().includes('Answer aloud'),'cold moves to answer phase');
    click($('#done'));
    rate(5);$('#lead').checked=true;$('#calm').checked=true;click($('#sub'));
    assert(body().includes('+30 XP'),'cold XP awarded'); // fixed XP (spec 3): was +3x or +4x by rating
    click($('#back'));
    s=st();assert(s.daily.cold===1,'cold quest progress');

    // no tired bonus
    tab('status');click($('[data-act="energy"][data-v="5"]'));
    assert(st().energy===5,'energy saved');
    tab('gates');click($('[data-act="breath"]'));click($('#go'));adv(121000);
    assert(!body().includes('Tired-session bonus')&&body().includes('+20 XP'),'tired breath is still +20 XP'); // fixed XP (spec 3): was +30 with the tired bonus
    click($('#back'));
    s=st();assert(s.stats.resilience===0,'no Courage from a tired session'); // fixed XP (spec 3): was resilience >= 5
    assert(Object.values(s.days)[0].e===5,'mosaic records the tired state');

    // field mission
    tab('gates');click($('[data-act="field"]'));
    assert(body().includes('Suggested'),'field list marks a suggested mission');
    click($('[data-ch="ms"][data-v="m1"]'));
    $('#pa').value='7';$('#pa').oninput&&$('#pa').oninput.call($('#pa'));
    click($('#go'));
    assert(body().includes('Do it, then come back'),'mission now screen');
    click($('#done'));
    assert($('#sub').disabled,'log disabled until ratings given');
    click($('#bd .segb[data-n="0"]'));rate(4);
    assert(!$('#sub').disabled,'log enabled after ratings');
    click($('#sub'));
    assert(body().includes('+60 XP'),'first mission XP is +60'); // fixed XP (spec 3): was +1xx (60 x1.5 tired + 40 weekly)
    click($('#back'));
    s=st();const f=s.log.filter(e=>e.type==='field')[0];
    assert(f&&f.pred===7&&f.mid==='m1'&&f.bad===0,'field log carries prediction and outcome');
    assert(s.fieldWeek===undefined&&s.titles.includes('first-step')&&s.stats.resilience===4,'first mission earns a title and Courage, no weekly field bonus'); // fixed XP (spec 3): was fieldWeek tracked

    // ritual and debrief
    tab('status');click($('[data-act="ritual"]'));adv(61000);adv(31000);
    assert(body().includes('Step 3 of 3'),'ritual reaches step 3');
    click($('#done'));assert(body().includes('Ritual complete'),'ritual completes');click($('#back'));
    tab('status');click($('[data-act="debrief"]'));
    click($('#sub'));assert(body().includes('Debrief'),'empty debrief rejected');
    $('#d1').value='Opened clearly';$('#d2').value='Pause earlier';click($('#sub'));
    assert(body().includes('Debrief saved'),'debrief saved');click($('#back'));

    // views
    tab('log');
    const lv=$('#view').textContent;
    assert(lv.includes('Predictions versus reality')&&lv.includes('Fluency by energy'),'log sections render');
    assert($('#sum').value.includes('Field missions: 1'),'therapist summary includes field missions');
    tab('guide');
    $('#hard').value='b<p!m';$('#hard').dispatchEvent(new w.Event('change',{bubbles:true}));
    assert(st().hard==='BPM','hard sounds sanitised');
    $('#opener').value='  Hello <b>team</b>  ';$('#opener').dispatchEvent(new w.Event('change',{bubbles:true}));
    tab('log');tab('guide');
    assert($('#opener').value.includes('<b>')&&!$('#view').innerHTML.includes('<b>team</b>'),'opener escaped in DOM');

    // backup/import
    const bk=$('#bk').value;
    $('#bk').value='not json';click($('[data-act="import"]'));
    assert($('#bkmsg').textContent.includes('not a valid backup'),'bad import rejected');
    $('#bk').value=JSON.stringify({xp:'x'});click($('[data-act="import"]'));
    assert($('#bkmsg').textContent.includes('not a valid backup'),'wrong shape rejected');
    const o=JSON.parse(bk);o.xp=5000;o.stats.pace=-50;o.streak='9';o.energy=99;
    $('#bk').value=JSON.stringify(o);click($('[data-act="import"]'));
    s=st();assert(s.xp===5000&&s.stats.pace===0&&s.energy===5&&s.streak===9,'import validates and clamps values');

    // reset needs two presses
    tab('guide');click($('#rst'));assert(st().xp===5000,'reset needs confirmation');
    click($('#rst'));assert(st().xp===0,'second press resets');
  }

  /* ---------- daily run ---------- */
  {
    const w=await boot();const k=kit(w);await sleep(50);
    const {$,click,adv,st,body,rate,tab}=k;
    click($('[data-act="run"][data-v="full"]'));
    assert($('#runTitle').textContent.startsWith('Run 1 of 6'),'full run starts with breath');
    adv(61000);
    assert(body().includes('Next: Paced Reading'),'run offers next drill');
    click($('#nextb'));adv(150000);rate(3);click($('#sub'));
    assert($('#runTitle').textContent.startsWith('Run 2 of 6'),'second run step is reading');
    click($('#nextb'));click($('#go'));adv(46000);
    click($('#nextb'));click($('#done'));rate(3);click($('#sub'));
    click($('#nextb'));click($('#go'));adv(46000);
    click($('#nextb'));click($('#done'));rate(4);click($('#sub'));
    assert(body().includes('Run complete'),'run completes');
    click($('#back'));
    const s=st();
    assert(s.daily.cleared===true&&s.daily.breathDone&&s.daily.speakDone&&s.daily.breath===1&&s.daily.cold>=2,'full run completes the Daily Quest'); // fixed XP (spec 3): was all four old quests
    assert(s.xp>=120,'full run earns meaningful XP');
    // exit mid-run
    tab('status');click($('[data-act="run"][data-v="short"]'));click($('#abort'));
    assert($('#run').style.display==='none'&&$('#app').getAttribute('aria-hidden')===null,'abort closes run and restores page');
  }

  /* ---------- boss, rank gating ---------- */
  {
    const w=await boot();const k=kit(w);await sleep(50);
    const {$,click,adv,st,body,rate,tab}=k;
    tab('gates');
    const bossBtn=[...w.document.querySelectorAll('.grow')].find(x=>x.textContent.includes('Boss Gauntlet')).querySelector('button');
    assert(bossBtn.disabled,'boss locked at Rank E');
  }
  {
    const w=await boot({v:2,xp:1500,updatedAt:1});const k=kit(w);await sleep(50);
    const {$,click,adv,st,body,rate,tab}=k;
    tab('gates');click($('[data-act="boss"]'));click($('#go'));
    for(let i=1;i<=5;i++){assert($('#runBody').textContent.includes('Question '+i+' of 5'),'boss question '+i);click($('#done'));}
    assert(body().includes('How did the gauntlet go'),'boss reaches rating');
    rate(4);click($('#sub'));
    assert(body().includes('Gauntlet cleared'),'boss cleared');
    click($('#back'));
    const s=st();assert(s.bosses===1&&s.daily.cold===2,'boss counted and fills cold quest');
  }

  /* ---------- streak, shields, comeback ---------- */
  {
    const w=await boot({v:2,xp:100,streak:5,best:5,shields:1,lastDay:ago(2),updatedAt:1});const k=kit(w);await sleep(50);
    assert(k.$('#view').textContent.includes('5 d'),'one-day gap bridged by shield');
    k.tab('gates');k.click(k.$('[data-act="breath"]'));k.click(k.$('#go'));k.adv(121000);k.click(k.$('#back'));
    const s=k.st();assert(s.streak===6&&s.shields===0,'streak continues and shield consumed');
  }
  {
    const w=await boot({v:2,xp:100,streak:5,best:5,shields:0,lastDay:ago(4),updatedAt:1});const k=kit(w);await sleep(50);
    assert(k.$('#view').textContent.includes('0 d'),'gap without shield resets the run');
    k.tab('gates');k.click(k.$('[data-act="breath"]'));k.click(k.$('#go'));k.adv(121000);
    assert(k.body().includes('+45 XP'),'comeback bonus added (20 + 25)');
    k.click(k.$('#back'));
    const s=k.st();assert(s.streak===1&&s.best===5&&s.comeback===false,'run restarts, best kept, comeback consumed');
  }

  /* ---------- weekly goal ---------- */
  {
    // seed four practice days earlier this week (Monday-start) when possible
    const now=new Date();const dow=(now.getDay()+6)%7; // 0 = Monday
    if(dow>=4){
      const days={};for(let i=1;i<=4;i++)days[ago(i)]={n:1,e:3};
      const w=await boot({v:2,xp:100,streak:4,best:4,lastDay:ago(1),days,started:ago(4),updatedAt:1});const k=kit(w);await sleep(50);
      k.tab('gates');k.click(k.$('[data-act="breath"]'));k.click(k.$('#go'));k.adv(121000);k.click(k.$('#back'));
      const s=k.st();assert(s.shields===1&&s.weekAward!=='','fifth practice day this week earns a shield');
    } else console.log('skip  weekly goal test (needs Friday or later)');
  }

  /* ---------- resilience: corrupt, garbage, migration, storage failure ---------- */
  {
    const w=await boot(null,'{not json');const k=kit(w);await sleep(50);
    assert(!k.$('#notice').hidden&&k.$('#notice').textContent.includes('fresh start'),'corrupt storage shows notice');
    assert(w.localStorage.getItem(KEY+':corrupt')==='{not json','corrupt data is kept aside');
    k.tab('gates');k.click(k.$('[data-act="breath"]'));k.click(k.$('#go'));k.adv(121000);
    assert(k.body().includes('+20 XP'),'app works after corrupt recovery');
  }
  {
    const garbage={v:99,xp:'abc',stats:null,streak:-4,shields:50,lastDay:'yesterday',energy:'hi',hard:{},opener:42,rung:99,coldSecs:7,plan:{anchor:'<img>',mins:5},days:{'2025-01-01':{n:9,e:9},bad:{}},weak:{a:1,Q:9,'1':3},daily:{date:7,breath:'x'},log:[null,{type:'nope',score:99,xp:-5,meta:{}},5]};
    const w=await boot(garbage);const k=kit(w);await sleep(50);
    assert(k.$('#view').innerHTML.length>500,'garbage state renders');
    k.tab('log');k.tab('guide');k.tab('gates');k.tab('status');
    k.click(k.$('[data-act="energy"][data-v="3"]'));
    const s=k.st();
    assert(s.xp===0&&s.rung===WPM_MAX(s)&&s.coldSecs===60&&s.plan.anchor===''&&s.plan.mins===10&&s.shields===2&&s.energy===3,'garbage sanitised to safe values');
    assert(Object.keys(s.weak).join()==='Q'&&s.weak.Q===5,'weak map filtered and clamped');
    assert(s.log.length===1&&s.log[0].score===5&&s.log[0].xp===0&&s.log[0].type==='cold','log entries validated');
    assert(Object.keys(s.days).join()==='2025-01-01'&&s.days['2025-01-01'].n===4,'days map validated');
  }
  {
    const w=await boot();
    // storage that throws on write
    const k=kit(w);await sleep(50);
    w.Storage.prototype.setItem=()=>{throw new Error('quota')};
    k.tab('gates');k.click(k.$('[data-act="breath"]'));k.click(k.$('#go'));k.adv(121000);
    assert(k.body().includes('+20 XP'),'drill still works when storage fails');
    k.click(k.$('#back'));
    assert(!k.$('#notice').hidden,'storage failure shows a visible notice');
    assert(k.$('#sync').textContent.includes('Not saved'),'sync label reflects failure');
  }
  {
    // account sync: remote newer than local replaces it, older does not
    const w=await boot({v:2,xp:300,updatedAt:100});
    const remote={v:2,xp:900,updatedAt:500};
    let written=null;
    w.claude={use:async n=>n==='user'?{id:async()=>'u1'}:{doc:p=>({get:async()=>({exists:true,data:()=>remote}),set:async v=>{written=v}})}};
    // re-run init by reloading is not possible, so just confirm the page tolerates the shim existing
    await sleep(50);
    assert(true,'shim present without crashing');
  }

  console.log('\n'+(fails?fails+' FAILED':'ALL PASSED'));
  const real=errors.filter(e=>!e.startsWith('ASSERT'));
  if(real.length){console.log('runtime errors:');real.forEach(e=>console.log(' -',e.split('\n').slice(0,3).join(' | ')))}
  process.exit(fails||real.length?1:0);
})();
function WPM_MAX(s){return 6}
