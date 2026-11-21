# Fluency Rank

A practice web app for adults who stammer or freeze when speaking: breathwork, paced reading,
word warm-ups, practice questions and real-world speaking steps, with Solo Leveling-style ranks
(E to S) and a 66-cell practice mosaic. It is being rebuilt as a "speak with confidence" app.
The spec is in `docs/superpowers/specs/2026-11-21-speak-with-confidence-design.md`, and the
current implementation plan is in `docs/superpowers/plans/`.

## Run and test
- Serve the folder with any static server and open it in a browser. There is nothing to build.
- `npm install && npm test` runs the jsdom smoke test (fake clock, 85+ assertions). It must exit 0.

## Architecture (currently all in index.html; moving to ES modules in step 1 of the plan)
- One IIFE, with sections in this order: utilities, content (RANKS, QUESTIONS, PASSAGES, MISSIONS...),
  state and validation, game rules, UI helpers, run overlay, drills, views, events.
- State is a single object, `S`, stored under the localStorage key `fluency-rank:v2`. `sanitize()`
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
