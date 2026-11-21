# Fluency Rank

A practice web app for adults who stammer or freeze when speaking: breathwork, paced reading,
word warm-ups, practice questions and real-world speaking steps, with Solo Leveling-style ranks
(E to S) and a 66-cell practice mosaic. It is being rebuilt as a "speak with confidence" app.
The spec is in `docs/superpowers/specs/2026-11-21-speak-with-confidence-design.md`, and the
current implementation plan is in `docs/superpowers/plans/`.

## Run, test, release
- Serve the folder with any static server and open it in a browser. There is nothing to build.
  ES modules do not load from `file://`.
- `npm install && npm test` runs `test/run.js`, which runs `test/smoke.test.js` (jsdom with a fake
  clock; ES modules booted per window through `vm.SourceTextModule` in `test/load.js`) and
  `test/pwa.test.js` (manifest, icons, fonts, precache list). It must exit 0.
- Live at https://anishmrao-blr.github.io/fluency-rank/ (GitHub Pages, deployed from `main` at `/`).
- Release rule: bump `VERSION` in `sw.js` on every release, and add every new file to `PRECACHE`.
  The PWA test fails if a file under `js/` or `fonts/` is missing from the list.
- `tools/make-icons.js` regenerates the icons; `tools/fetch-fonts.js` re-downloads the fonts.

## Architecture (native ES modules in js/, no build step, no runtime dependencies)
- `util` helpers, `content` (RANKS, QUESTIONS, PASSAGES, MISSIONS...), `state` (the `app` object,
  `fresh/sanitize/save`), `rules` (`rollDay/award`), `ui` (toast, modal, run overlay, timers),
  `drills`, `views`, and `main` (events and boot). Shared mutable state lives on `app`:
  `app.S`, `app.tab`, `app.running`, `app.storageOk`, `app.noticeText`.
- State is a single object, `app.S`, stored under the localStorage key `fluency-rank:v2`. `sanitize()`
  validates and clamps everything read from storage, an account DB, or a pasted backup. Add any new
  field to it.
- `award(type, opts)` is the only place where XP, stats, streak, bonuses and the log change.
- `rollDay()` handles day rollover, shields and the comeback flag. The streak counts practice days.
- Drills (`runBreath/runRead/runRaid/runCold/runRitual/runDebrief/runField`) all render into
  `#runBody` through `setRun()`. All timers go through the `T` registry, so `stopRun()` cleans up.
- Views are string-templated (`viewStatus/Gates/Log/Guide`). User text goes through `esc()`.

## Rules
- Keep old saved data loading correctly. Every new saved field goes through `sanitize()`.
- The design is restrained: no neon glow, no emoji icons, no identical card grids, no confetti.
- Accessibility to preserve: 44px+ targets, `inert`/aria-hidden on the page behind the run overlay,
  focus moved to each new heading, adjustable countdown (hide numbers), reduced motion.
- Honest copy: never promise a stammer will disappear. It is practice, not therapy.
- `initDb()` syncs through `window.claude` when run as a Claude artifact. Everywhere else it does
  nothing, and the app uses localStorage plus the backup box.
