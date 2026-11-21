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
  // lets unit tests reach a module's exports, e.g. window.__mod('js/rules.js').award
  dom.window.__mod = rel => cache.get(path.resolve(ROOT, rel)).namespace;
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
