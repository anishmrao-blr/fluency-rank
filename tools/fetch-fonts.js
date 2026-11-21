// Downloads the Latin subsets of the app's OFL fonts from Google Fonts into fonts/
// and writes fonts/fonts.css pointing at the local files.
// Usage: node tools/fetch-fonts.js <google-fonts-css-file>
const fs = require('fs'), path = require('path'), https = require('https');
const css = fs.readFileSync(process.argv[2], 'utf8');
const out = path.join(__dirname, '..', 'fonts');
fs.mkdirSync(out, {recursive: true});

const blocks = [...css.matchAll(/\/\* latin \*\/\s*@font-face\s*{([^}]*)}/g)].map(m => m[1]);
const faces = blocks.map(b => ({
  family: b.match(/font-family:\s*'([^']+)'/)[1],
  weight: b.match(/font-weight:\s*(\d+)/)[1],
  url: b.match(/url\(([^)]+)\)/)[1],
  range: (b.match(/unicode-range:\s*([^;]+);/) || [])[1]
}));
const files = new Map();
faces.forEach(f => {
  if (!files.has(f.url)) files.set(f.url, f.family.toLowerCase().replace(/\s+/g, '-') + '-' + f.weight + '.woff2');
  f.file = files.get(f.url);
});
const get = url => new Promise((res, rej) => https.get(url, r => {
  if (r.statusCode !== 200) return rej(new Error(url + ' ' + r.statusCode));
  const c = []; r.on('data', d => c.push(d)); r.on('end', () => res(Buffer.concat(c)));
}).on('error', rej));

(async () => {
  for (const [url, file] of files) fs.writeFileSync(path.join(out, file), await get(url));
  const rules = faces.map(f => `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};font-display:swap;src:url(${f.file}) format('woff2');${f.range ? 'unicode-range:' + f.range + ';' : ''}}`);
  fs.writeFileSync(path.join(out, 'fonts.css'), '/* OFL-licensed fonts (Barlow Condensed, IBM Plex), Latin subset, bundled for offline use. */\n' + rules.join('\n') + '\n');
  console.log(faces.length + ' faces, ' + files.size + ' files');
})().catch(e => { console.error(e.message); process.exit(1); });
