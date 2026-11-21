// Checks that the app is installable and fully precached for offline use.
const fs = require('fs'), path = require('path');
const R = p => path.join(__dirname, '..', p);
let fails = 0;
const assert = (c, m) => { console.log((c ? 'ok  ' : 'FAIL') + ' ' + m); if (!c) fails++; };
const pngSize = f => { if (!fs.existsSync(R(f))) return null; const b = fs.readFileSync(R(f)); return b.readUInt32BE(0) === 0x89504e47 ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null; };

/* install metadata */
const html = fs.readFileSync(R('index.html'), 'utf8');
assert(/<link rel="manifest" href="manifest.webmanifest">/.test(html), 'index links the manifest');
assert(/<link rel="apple-touch-icon" href="icons\/icon-180.png">/.test(html), 'apple touch icon linked');
assert(/name="apple-mobile-web-app-capable" content="yes"/.test(html), 'iOS standalone meta');
assert(/viewport-fit=cover/.test(html), 'viewport covers the notch area');
assert(!/fonts\.googleapis|fonts\.gstatic/.test(html), 'no remote fonts');
assert(/<link rel="stylesheet" href="fonts\/fonts.css">/.test(html), 'local font stylesheet linked');
assert(/<link rel="stylesheet" href="css\/app.css">/.test(html), 'app stylesheet linked');
assert(!/<style[\s>]/.test(html), 'no inline style block: CSS lives in css/app.css');
assert(!/IBM Plex/i.test(html + fs.readFileSync(R('css/app.css'), 'utf8')), 'IBM Plex is retired');
const m = JSON.parse(fs.readFileSync(R('manifest.webmanifest'), 'utf8'));
assert(m.display === 'standalone' && m.start_url === './' && m.scope === './', 'manifest is standalone and relative');
assert(m.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'), 'maskable icon declared');
for (const i of m.icons) { const s = pngSize(i.src); assert(s && s.join('x') === i.sizes, 'icon ' + i.src + ' is a ' + i.sizes + ' PNG'); }
assert(JSON.stringify(pngSize('icons/icon-180.png')) === '[180,180]', 'apple icon is 180x180');

/* fonts are local and complete */
const fcss = fs.readFileSync(R('fonts/fonts.css'), 'utf8');
const fontFiles = [...fcss.matchAll(/url\(([^)]+)\)/g)].map(x => x[1]);
assert(fontFiles.length >= 2 && fontFiles.every(f => !/^https?:/.test(f) && fs.existsSync(R('fonts/' + f))), 'every @font-face points at a bundled file');

/* service worker precaches everything the app needs */
const sw = fs.readFileSync(R('sw.js'), 'utf8');
const list = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
for (const f of list) assert(f === './' || fs.existsSync(R(f)), 'precached file exists: ' + f);
const need = ['./', 'index.html', 'manifest.webmanifest', 'fonts/fonts.css',
  ...fs.readdirSync(R('js')).filter(f => f.endsWith('.js')).map(f => 'js/' + f),
  ...fs.readdirSync(R('fonts')).filter(f => f.endsWith('.woff2')).map(f => 'fonts/' + f),
  ...fs.readdirSync(R('css')).filter(f => f.endsWith('.css')).map(f => 'css/' + f),
  ...(fs.existsSync(R('assets')) ? fs.readdirSync(R('assets')).filter(f => /\.(jpg|jpeg|png|webp|svg)$/i.test(f)).map(f => 'assets/' + f) : []),
  ...m.icons.map(i => i.src), 'icons/icon-180.png'];
for (const f of need) assert(list.includes(f), 'precache includes ' + f);
assert(/const VERSION = '[^']+';/.test(sw), 'cache is versioned');
const main = fs.readFileSync(R('js/main.js'), 'utf8');
assert(/'serviceWorker' in navigator/.test(main) && /register\('sw\.js'\)/.test(main), 'main registers the service worker behind a feature check');

console.log('\n' + (fails ? fails + ' FAILED' : 'ALL PASSED'));
process.exit(fails ? 1 : 0);
