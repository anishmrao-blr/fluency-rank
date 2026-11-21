# Steps 0-1: Green tests, deploy, modules, offline PWA. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `npm test` exits 0. The current app is live on GitHub Pages. The single 86 KB file is split into native ES modules. The app installs to the iPhone Home Screen and works fully offline. Behaviour stays the same throughout.

**Architecture:**
- Today's IIFE in `index.html` becomes ES modules under `js/`. All mutable shared state lives in one exported object, `app` (in `js/state.js`).
- Tests run the modules inside each jsdom window through Node's `vm.SourceTextModule`, so every `boot()` gets fresh module instances. This needs no new dependency.
- A cache-first service worker precaches every file. A test checks that the precache list matches the files on disk.

**Tech Stack:** HTML, CSS, native ES modules, Service Worker, Web App Manifest, jsdom 24, Node 22 (`--experimental-vm-modules`), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-21-speak-with-confidence-design.md`, sections 6-8.

---

## File map

| File | Responsibility |
|---|---|
| `index.html` | Markup and CSS only (CSS moves out in step 2), plus `<script type="module" src="js/main.js">` |
| `js/util.js` | `$`, `$$`, `esc`, `rnd`, `clamp`, `num`, `int`, `isDate`, `reduceMotion`, `shuffle`, `pad`, date helpers, `fmt` |
| `js/content.js` | RANKS, ranks/levels helpers, STAT_*, ENERGY, FLU, QUESTS, TYPE_N, DRILL_N, PATTERNS, PHRASES, WPM, PASSAGES, QUESTIONS, STALL, LETTERS, CATS, MISSIONS, TWISTS, ANCHORS, DEFAULT_OPENER |
| `js/state.js` | `app` object, `KEY`, `blankDaily`, `fresh`, `sanitize`, `loadLocal`, `save`, `updateSync`, db sync |
| `js/rules.js` | `doneCount`, week helpers, `rollDay`, `award`, `avgScore` |
| `js/ui.js` | toast, modal, `block`, `bar`, `energySeg`, `T` timers, audio cues, run overlay, choice/rate widgets, `resultScreen`, `clockText` |
| `js/drills.js` | all `run*` drills, the questions queue, `startRun`/`nextRun` |
| `js/views.js` | `viewStatus/Gates/Log/Guide`, `summaryText`, `renderAll` |
| `js/main.js` | ACT handlers, event listeners, boot, service worker registration |
| `fonts/*.woff2`, `fonts/fonts.css` | Bundled OFL fonts (replaces Google Fonts links) |
| `manifest.webmanifest`, `icons/*.png` | Install metadata and icons |
| `sw.js` | Precache and cache-first fetch |
| `tools/make-icons.js` | Generates the PNG icons using Node's built-in zlib |
| `test/load.js` | jsdom + ES-module boot helper |
| `test/smoke.test.js` | Existing 85 checks, now booting via `test/load.js` |
| `test/pwa.test.js` | Manifest, icon, service worker precache and registration checks |
| `test/run.js` | Runs every test file and fails if any one fails |

---

### Task 1: Make `npm test` exit 0 (step 0)

**Files:** Modify `test/smoke.test.js:10` (the `beforeParse` hook)

- [ ] **Step 1: Confirm the current failure.** Run `npm test; echo "exit=$?"`. Expected: `ALL PASSED`, then a `runtime errors:` list of `Not implemented: window.scrollTo`, then `exit=1`.
- [ ] **Step 2: Stub `scrollTo` in the fake window.** In `beforeParse(w){`, add this first line:
```js
    w.scrollTo=()=>{};
```
- [ ] **Step 3: Run the tests.** Run `npm test; echo "exit=$?"`. Expected: `ALL PASSED`, no `runtime errors:` block, `exit=0`.
- [ ] **Step 4: Commit.**
```bash
git add test/smoke.test.js
git commit -m "test: stub window.scrollTo so npm test exits 0"
```

### Task 2: Create the GitHub repo and deploy the current app (step 0)

**Needs a user decision first.** Repo visibility: free GitHub Pages needs a public repo. `CLAUDE.md` must not contain personal or health details.

- [ ] **Step 1: Ask the user.** The options are a public repo with personal details removed from `CLAUDE.md`, a private repo with GitHub Pro, or a different host.
- [ ] **Step 2: If the repo will be public,** reword `CLAUDE.md` so it describes the product only, then commit (`docs: remove personal details before publishing`).
- [ ] **Step 3: Rename the branch and create the repo.**
```bash
git branch -m master main
gh repo create fluency-rank --public --source . --remote origin --push
```
- [ ] **Step 4: Enable Pages** from `main` at `/`:
```bash
gh api -X POST repos/{owner}/fluency-rank/pages -f "source[branch]=main" -f "source[path]=/"
```
- [ ] **Step 5: Wait for the first build.** Run `gh api repos/{owner}/fluency-rank/pages/builds/latest --jq .status` until it prints `built`. Then fetch `https://{owner}.github.io/fluency-rank/` and confirm HTTP 200 and that the body contains `Fluency Rank System`.

### Task 3: ES-module test loader

**Files:** Create `test/load.js`. Modify `package.json` scripts.

- [ ] **Step 1: Write `test/load.js`.**
```js
// Boots index.html in jsdom and runs its ES modules inside that window.
// Each call gets fresh module instances, so tests stay isolated.
const {JSDOM, VirtualConsole} = require('jsdom');
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');

async function runModules(dom, entryRel) {
  const context = dom.getInternalVMContext();
  const cache = new Map();
  const load = file => {
    if (!cache.has(file)) cache.set(file, new vm.SourceTextModule(fs.readFileSync(file, 'utf8'), {identifier: file, context}));
    return cache.get(file);
  };
  const entry = load(path.join(ROOT, entryRel));
  await entry.link((spec, ref) => load(path.resolve(path.dirname(ref.identifier), spec.split('?')[0])));
  await entry.evaluate();
}

/* opts: {url, beforeParse(w), onError(msg)}. Resolves to the window once main.js has run. */
async function bootApp(opts) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<link[^>]*>/g, '');
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => opts.onError('jsdomError: ' + (e.detail && e.detail.stack || e.message)));
  vc.on('error', e => opts.onError('console.error: ' + e));
  const dom = new JSDOM(html, {runScripts: 'outside-only', url: opts.url || 'https://example.com/', virtualConsole: vc, pretendToBeVisual: true, beforeParse: opts.beforeParse});
  try { await runModules(dom, 'js/main.js'); } catch (e) { opts.onError('module: ' + e.stack); }
  return dom.window;
}
module.exports = {bootApp, ROOT};
```
- [ ] **Step 2: Add the test runner** `test/run.js`:
```js
// Runs each test file in its own process. Exits non-zero if any fail.
const {spawnSync} = require('child_process');
const files = ['test/smoke.test.js', 'test/pwa.test.js'].filter(f => require('fs').existsSync(f));
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', f], {stdio: 'inherit'});
  if (r.status !== 0) { bad++; console.log('FAILED FILE', f); }
}
process.exit(bad ? 1 : 0);
```
- [ ] **Step 3: Update `package.json`.** Set `"scripts": { "test": "node test/run.js" }`.
- [ ] **Step 4: Run `npm test`.** Expected: still `ALL PASSED` and `exit=0`. The old inline-script boot is unchanged so far.

### Task 4: Split `index.html` into modules

**Files:**
- Create `js/util.js`, `js/content.js`, `js/state.js`, `js/rules.js`, `js/ui.js`, `js/drills.js`, `js/views.js`, `js/main.js`.
- Modify `index.html:226-1093` (the inline `<script>`) and `test/smoke.test.js` (the `boot` function).

The rule for every move: copy the code verbatim, then add `import`/`export` lines. The only allowed rewrite is replacing reads and writes of shared mutable variables with fields on `app`.

- [ ] **Step 1: Switch the smoke test to the loader (red first).** In `test/smoke.test.js`:
  - Replace the `boot` function with:
```js
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
```
  - Remove the `fs.readFileSync(... index.html ...)` line and the `JSDOM` require.
  - Replace every `const w=boot(` with `const w=await boot(`.
  - Run `npm test`. Expected: it fails with `module: ... ENOENT ... js/main.js`.
- [ ] **Step 2: Create `js/util.js`** from `index.html` lines 231-246, prefixing each `const` with `export`.
- [ ] **Step 3: Create `js/content.js`** from lines 249-333 with `export` on each `const`. It imports nothing.
- [ ] **Step 4: Create `js/state.js`** from lines 336-466.
  - Add this before `fresh` is used:
```js
export const app = {S: null, storageOk: true, noticeText: '', running: false, tab: 'status'};
```
  - Then set `app.S = fresh();` in place of `let S = fresh();`.
  - Replace `storageOk` with `app.storageOk` and `noticeText` with `app.noticeText`.
  - Replace standalone `S` identifiers with `app.S`, using a word-boundary match and checking every hit by hand. `S_updated` is not a match, and no string literal in lines 336-1091 contains a standalone `S`. Confirm the second point with `grep -n "'S'" index.html`, which should only hit the RANKS line in content.js.
  - Replace `running` with `app.running`.
  - Import `rollDay` from `./rules.js`, `renderAll` from `./views.js`, and helpers from `./util.js` and `./content.js`.
  - Export `KEY, blankDaily, fresh, sanitize, save, updateSync, initDb`.
  - Keep `loadLocal()` as an IIFE inside the module.
- [ ] **Step 5: Create `js/rules.js`** from lines 469-531 with the same `app.S` substitution. Remove the bare `rollDay();` call at line 489; `main.js` calls it at boot. Export `doneCount, weekStr, practicedThisWeek, rollDay, award, avgScore`.
- [ ] **Step 6: Create `js/ui.js`** from lines 534-623 with the same substitution, plus `app.running` in place of `running`. Element lookups such as `runEl = $('#run')` stay at module top level, because the module runs once per window. Export everything later files use.
- [ ] **Step 7: Create `js/drills.js`** from lines 626-923. Export `runBreath, runRead, runRaid, runCold, runRitual, runDebrief, runField, startRun, nextRun, RUN_FULL, RUN_SHORT`. `nextRun` is used by `ui.js`'s `resultScreen`; import it there.
- [ ] **Step 8: Create `js/views.js`** from lines 926-1030, with `app.tab` in place of `tab`. Export `renderAll`, `summaryText` and the views.
- [ ] **Step 9: Create `js/main.js`** from lines 1033-1091, with `app.tab` and `app.S`. End it with:
```js
rollDay();
renderAll();
initDb();
```
- [ ] **Step 10: Replace the inline script.** In `index.html`, replace lines 226-1093 (`<script>` through `</script>`) with:
```html
<script type="module" src="js/main.js"></script>
```
- [ ] **Step 11: Run the tests.** Run `npm test`. Expected: all 85 smoke checks pass, `exit=0`. If a check fails, compare against the original lines rather than editing the test's expectations.
- [ ] **Step 12: Check it in a real browser.** Serve the folder (`node <scratchpad>/serve.js . 5173`), open it in the browser pane, and click through all four tabs, a breath session and a reading. Expected: no console errors.
- [ ] **Step 13: Commit.**
```bash
git add index.html js test
git commit -m "refactor: split the app into native ES modules, tests boot modules in jsdom"
```

### Task 5: Bundle the fonts

**Files:** Create `fonts/*.woff2` and `fonts/fonts.css`. Modify `index.html:8-10`.

- [ ] **Step 1: Fetch the Google Fonts CSS** with a modern browser User-Agent, so it lists woff2 files:
```bash
curl -s -A "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" > /tmp-scratch/fonts.css
```
- [ ] **Step 2: Keep only the `/* latin */` blocks.** Download each `src: url(...)` into `fonts/<family>-<weight>.woff2`, and write `fonts/fonts.css` with the same `@font-face` rules pointing at `./<file>.woff2`. Expected: 8 files, roughly 150-250 KB in total.
- [ ] **Step 3: Swap the font links.** Replace the three Google Fonts `<link>` tags in `index.html` with `<link rel="stylesheet" href="fonts/fonts.css">`.
- [ ] **Step 4: Run the tests and check the page.** `npm test` should still exit 0. The browser pane should show the same fonts, and the network panel should show no requests to `fonts.g*`.
- [ ] **Step 5: Commit.** `git commit -m "feat: bundle OFL fonts locally for offline use"`

### Task 6: Manifest, icons and iOS meta tags

**Files:** Create `manifest.webmanifest`, `tools/make-icons.js`, `icons/icon-180.png`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/maskable-512.png` and `test/pwa.test.js`. Modify `index.html` `<head>`.

- [ ] **Step 1: Write the failing test** `test/pwa.test.js`:
```js
const fs=require('fs'),path=require('path');
const R=p=>path.join(__dirname,'..',p);
let fails=0;const assert=(c,m)=>{console.log((c?'ok  ':'FAIL')+' '+m);if(!c)fails++;};
const pngSize=f=>{const b=fs.readFileSync(R(f));return b.readUInt32BE(0)===0x89504e47?[b.readUInt32BE(16),b.readUInt32BE(20)]:null;};

const html=fs.readFileSync(R('index.html'),'utf8');
assert(/<link rel="manifest" href="manifest.webmanifest">/.test(html),'index links the manifest');
assert(/<link rel="apple-touch-icon" href="icons\/icon-180.png">/.test(html),'apple touch icon linked');
assert(/name="apple-mobile-web-app-capable" content="yes"/.test(html),'iOS standalone meta');
assert(!/fonts\.googleapis/.test(html),'no remote fonts');
const m=JSON.parse(fs.readFileSync(R('manifest.webmanifest'),'utf8'));
assert(m.display==='standalone'&&m.start_url==='./'&&m.scope==='./','manifest is standalone and relative');
assert(m.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable'),'maskable icon declared');
for(const i of m.icons){const s=pngSize(i.src);assert(s&&s.join('x')===i.sizes,'icon '+i.src+' is a '+i.sizes+' PNG');}
assert(JSON.stringify(pngSize('icons/icon-180.png'))==='[180,180]','apple icon is 180x180');
console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);
```
- [ ] **Step 2: Run the test.** Run `npm test`. Expected: FAIL on the manifest and icon lines.
- [ ] **Step 3: Write `tools/make-icons.js`.** It encodes the PNGs itself with `zlib` and draws the rank hexagon: a steel outline with an amber inner hexagon on ink `#0b101b`. The maskable icon keeps the art inside the 80% safe zone.
```js
const fs=require('fs'),zlib=require('zlib'),path=require('path');
const crcT=new Int32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c;});
const crc=b=>{let c=-1;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return (c^-1)>>>0;};
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
const hex=(x,y,cx,cy,r)=>{const dx=Math.abs(x-cx)/r,dy=Math.abs(y-cy)/r;return dx<=0.866&&dy<=1-dx*0.577;};
function png(size,scale){
  const ink=[11,16,27],steel=[125,180,240],amber=[233,180,76],raw=Buffer.alloc((size*4+1)*size);
  const c=size/2,r=size*0.40*scale;
  for(let y=0;y<size;y++){raw[y*(size*4+1)]=0;for(let x=0;x<size;x++){
    const px=x+0.5,py=y+0.5;let col=ink;
    if(hex(px,py,c,c,r))col=steel; if(hex(px,py,c,c,r*0.86))col=ink; if(hex(px,py,c,c,r*0.52))col=amber;
    const o=y*(size*4+1)+1+x*4;raw[o]=col[0];raw[o+1]=col[1];raw[o+2]=col[2];raw[o+3]=255;}}
  const ih=Buffer.alloc(13);ih.writeUInt32BE(size,0);ih.writeUInt32BE(size,4);ih[8]=8;ih[9]=6;
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const out=path.join(__dirname,'..','icons');fs.mkdirSync(out,{recursive:true});
[['icon-180.png',180,1],['icon-192.png',192,1],['icon-512.png',512,1],['maskable-512.png',512,0.78]].forEach(([f,s,k])=>fs.writeFileSync(path.join(out,f),png(s,k)));
console.log('icons written');
```
  Run `node tools/make-icons.js`.
- [ ] **Step 4: Write `manifest.webmanifest`.**
```json
{
  "name": "Fluency Rank",
  "short_name": "Fluency",
  "description": "Daily speaking and breathing practice.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0b101b",
  "theme_color": "#0b101b",
  "icons": [
    {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
    {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
    {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}
  ]
}
```
- [ ] **Step 5: Add the head tags to `index.html`,** after the viewport meta:
```html
<meta name="theme-color" content="#0b101b">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Fluency">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/icon-180.png">
```
  Also change the viewport meta to `width=device-width, initial-scale=1, viewport-fit=cover`. Add `padding-bottom: calc(... + env(safe-area-inset-bottom))` to `#tabs` and `padding-top: env(safe-area-inset-top)` to `#app` and `.run-in`, so the content clears the notch and the home indicator.
- [ ] **Step 6: Run `npm test`.** Expected: both files pass, `exit=0`.
- [ ] **Step 7: Commit.** `git commit -m "feat: web app manifest, generated icons, iOS standalone meta"`

### Task 7: Service worker

**Files:** Create `sw.js`. Modify `js/main.js` and `test/pwa.test.js`.

- [ ] **Step 1: Add the failing tests** to `test/pwa.test.js`, before the final line:
```js
const sw=fs.readFileSync(R('sw.js'),'utf8');
const list=JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
for(const f of list)assert(f==='./'||fs.existsSync(R(f)),'precached file exists: '+f);
const need=['./','index.html','manifest.webmanifest','fonts/fonts.css',...fs.readdirSync(R('js')).map(f=>'js/'+f),...fs.readdirSync(R('fonts')).filter(f=>f.endsWith('.woff2')).map(f=>'fonts/'+f),...m.icons.map(i=>i.src),'icons/icon-180.png'];
for(const f of need)assert(list.includes(f),'precache includes '+f);
assert(/const VERSION = '[^']+';/.test(sw),'cache is versioned');
const main=fs.readFileSync(R('js/main.js'),'utf8');
assert(/'serviceWorker' in navigator/.test(main)&&/register\('sw\.js'\)/.test(main),'main registers the service worker behind a feature check');
```
- [ ] **Step 2: Run the tests.** Run `npm test`. Expected: FAIL, because `sw.js` is missing.
- [ ] **Step 3: Write `sw.js`.** List every file under `js/` and `fonts/` explicitly.
```js
const VERSION = 'v1';
const PRECACHE = ["./","index.html","manifest.webmanifest","fonts/fonts.css","js/main.js","js/util.js","js/content.js","js/state.js","js/rules.js","js/ui.js","js/drills.js","js/views.js","icons/icon-180.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png"];
const CACHE = 'fluency-' + VERSION;
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('fluency-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
```
  Add the font file names (from Task 5) to `PRECACHE`.
- [ ] **Step 4: Register it** at the end of `js/main.js`:
```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
```
- [ ] **Step 5: Run `npm test`.** Expected: `exit=0`. jsdom has no `navigator.serviceWorker`, so the smoke test also proves the feature check works.
- [ ] **Step 6: Check it in the browser.** Serve locally and open the page in the browser pane. Then run `await navigator.serviceWorker.ready.then(r => !!r.active)` and `(await caches.keys())`. Expected: `true` and `['fluency-v1']`. Then run `await (await caches.open('fluency-v1')).keys()`, which should list every precached URL.
- [ ] **Step 7: Note the release rule in `CLAUDE.md`:** bump `VERSION` in `sw.js` on every release, and add any new file to `PRECACHE`. The test enforces the second part.
- [ ] **Step 8: Commit.** `git commit -m "feat: offline service worker with versioned precache"`

### Task 8: Deploy and verify on a phone

- [ ] **Step 1: Push.** Run `git push`, then wait for the Pages build as in Task 2, Step 5.
- [ ] **Step 2: Check the live site.** Fetch `https://{owner}.github.io/fluency-rank/sw.js` and `.../manifest.webmanifest`. Expected: HTTP 200 for both.
- [ ] **Step 3: User check on iPhone.** Open the URL in Safari, choose Share, then Add to Home Screen, and open the app from the icon. Turn on Airplane Mode and reopen it. Expected: the app loads and a breath session runs.
- [ ] **Step 4: Update `CLAUDE.md`'s Run and test section** to describe the module layout, `npm test`, the live URL and the release rule. Commit and push.

---

## Self-review
- **Spec coverage:** step 0 is covered by Tasks 1-2. Step 1 is covered by Tasks 3-8: modules, offline service worker, bundled fonts, icons, manifest and GitHub Pages hosting. Spec items for steps 2 onward are deliberately not in this plan.
- **No placeholders:** `{owner}` is filled in from `gh api user --jq .login` at run time. The font file names come from Task 5's output and are added to `PRECACHE` in Task 7, Step 3.
- **Consistency:** `bootApp`, `app.S`, `app.tab`, `app.running`, `PRECACHE` and `VERSION` are used the same way in every task.
