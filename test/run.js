// Runs each test file in its own process. Exits non-zero if any fail.
const {spawnSync} = require('child_process');
const files = ['test/smoke.test.js', 'test/rules.test.js', 'test/pwa.test.js'].filter(f => require('fs').existsSync(f));
let bad = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', f], {stdio: 'inherit'});
  if (r.status !== 0) { bad++; console.log('FAILED FILE', f); }
}
process.exit(bad ? 1 : 0);
