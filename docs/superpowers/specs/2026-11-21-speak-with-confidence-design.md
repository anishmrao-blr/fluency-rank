# Speak with confidence: design spec

Status: brainstorming approved this spec on 2026-11-21 and revised it the same day after the critique in `docs/critique-2026-11-21.md`. It replaces the earlier SPEC.md.
If a later request conflicts with this spec, point to the line it conflicts with and confirm the change before building it.

## 1. Product
- **Promise:** Speak with confidence. For adults (18+) who stammer or freeze when they speak. Breathwork and calm are the tools; confident speaking is the outcome.
- **Honesty:** it is practice, not therapy. Never promise that a stammer will go away, and never claim to treat anxiety. A Help page links to finding a speech therapist.
- **Mental health scope:** breathwork only. No mood tracking and no CBT course. The existing prediction-versus-reality step stays inside Real-world steps as part of the mission.
- **Two layers:**
  - A **calm surface** that everyone sees: plain names, mixed-case type, an adult tone, nothing presented as "Locked".
  - A **leveling layer**: ranks, levels, the System voice and titles. It appears at reward moments and in Progress, never as the first thing on Home.
- **Launch contexts:** phone calls and services, and work meetings and calls. Interviews and presentations, and social conversation, come in a later update. The content model supports all four from the start.
- **Analytics:** opt-in and privacy-first before the App Store launch. Anonymous counts only, no recordings, no text. The service is chosen later and needs approval.
- **Name:** the app is renamed around confidence in step 5, from 3 to 5 candidates checked against the App Store. The storage key does not change.
- **Pricing:** everything is free for now, with no paywall code.
- **Quality bar:** comparable in craft to the best consumer apps, without copying any of them.

## 2. Experience
- **First run (under 3 minutes):**
  1. Pick contexts and a practice time.
  2. **Same-session proof:** record a 20-second cold read, do 2 minutes of breathe-and-pace, re-read the same passage, then hear both clips side by side and rate each one.
  3. The microphone is requested only when the first recording starts.
  4. Recording can be skipped. If it is, go straight to the first session.

  There is no account and no tour. The cold read also becomes the baseline for the weekly re-record.
- **Tabs:** Home · Breathe · Speak · Progress. Settings opens from a gear icon.
- **Home:**
  - The primary button, **Start daily session · 5 min**.
  - The secondary button, **I'm about to speak**, always visible: 90 seconds of 3 cyclic sighs, the opening line said twice on the exhale, then the first sentence.
  - A plain progress line: "Today 0 of 2".
  - A 7-day strip.

  There is no grade, rank badge or XP on Home.
- **Low energy:** a "Low energy? Short version" link on the session start runs a 2-minute session. There is no energy scale, no tired multiplier and no tired skin.
- **Breathe:** four goal rows: Calm now, Before speaking, Focus, Wind down. One tap starts the default technique for that goal, with 1, 3 and 5 minute chips. Named techniques and custom patterns sit under "All techniques".
- **Speak:** plain names throughout.
  - **Drills:** Read aloud, Breathe and speak, Word warm-up, Practice questions, and the Challenge round (the old Boss Gauntlet), which opens from Rank D. Before Rank D the Challenge round is not listed as "Locked". It simply appears when it opens.
  - **Real-world steps:** a ladder of missions for each chosen context.
  - Question and passage banks can be edited. Read aloud keeps its words-per-minute pace target.
  - The old pre-call ritual becomes "I'm about to speak". The three-line debrief becomes an optional step after a Real-world step.
  - Today's meeting content becomes the "Work meetings and calls" context, broadened beyond forecasting and vendor topics.
- **Feared words and sounds:**
  - Users can enter their name, the sounds they find hard, and words they avoid (up to 30).
  - Read aloud, Breathe and speak, and Word warm-up weave these in at roughly one in three items.
  - Practice questions can ask for them, for example "Say your name and your role."
- **Session control:** one **End** control, inside thumb reach at the bottom of the screen. It asks for confirmation ("End now? The 1 min you did still counts.") and credits the time already done through `award()`.
- **Progress:** rank, level, title and stats; the 66-day mosaic; the then-and-now re-record player with measures; the log; and the summary for a speech therapist.
- **Settings:** contexts; feared words and sounds; practice time with "Add to calendar"; tones and voice guide; hide timers; recordings storage with "Delete all"; analytics opt-in; backup and restore; Help.
- **Removed from view:** the daily twist and the energy scale. `sanitize()` still accepts their old saved fields.

## 3. Game system (the leveling layer)
- **Daily Quest:** two items, one breath session (at least 1 minute; "I'm about to speak" counts) and one speaking drill. One item keeps the practice day and paints a mosaic cell. Both items earn +40 XP.
- **Fixed XP:** breath 20 · drill 25 · practice question 30 · Real-world step 60 · Challenge round 100 · weekly re-record 50 · Daily Quest +40. Partial sessions ended early earn the breath or drill amount if they reach at least 1 minute or one item. Ratings do not change XP. XP already earned never changes.
- **Ranks:** E to S at the existing thresholds (0, 1200, 3600, 8000, 15000, 30000). A level every 150 XP. No rank exams.
- **Titles:** earned at milestones (first Real-world step, 7 practice days, each rank). They are shown in Progress and on reward screens.
- **Stats:** Breath, Pace, Word flow, Composure, Courage. Courage is the existing `resilience` key relabelled, and it grows from Real-world steps.
- **Forgiveness:**
  - 5 practice days in a week earns a shield (up to 2), which silently covers one missed day.
  - A comeback bonus is given after a gap.
  - A broken streak resets quietly, and the best streak stays visible.
  - No red warnings and no guilt copy.
- **Voice:** the terse System voice appears only on reward moments (`[Quest complete]`, `[Step cleared]`, `[Rank up]`, `[Title earned]`). Everything else uses a plain, calm voice.
- **All progress changes go through `award()`.**

## 4. Breathwork
| Goal | Default technique | Pattern |
|---|---|---|
| Calm now | Cyclic sighing | two nasal inhales, then a long mouth exhale |
| Before speaking | Breathe and speak | 3 s in, a phrase on a 6 to 7 s exhale |
| Focus | Box | 4 in, 4 hold, 4 out, 4 hold |
| Wind down | Extended exhale | 4 in, 8 out |
| (All techniques) | Resonance | about 6 breaths/min, light breaths |

- Each technique gets one line of evidence, worded carefully: the 2023 Stanford cyclic-sighing trial, and the HRV-biofeedback meta-analyses for resonance breathing.
- **Pacer:** one animated shape plus soft rising and falling tones (Web Audio), so the user can practise with eyes closed. An optional "Voice guide" speaks cues through `speechSynthesis`. Phase changes are also announced through an `aria-live` region. With reduced motion, the shape becomes a fill bar. The screen stays awake through the Wake Lock API, with a silent fallback.
- **Not available on iOS web:** vibration and haptics. These are deferred to the native step.

## 5. Recording, technique checks and proof
- There is a record button in Read aloud, Breathe and speak, and Practice questions. After recording, the user can play it back, rate it, and keep or discard it.
- **"Am I doing it right?" check:** after playback, a short listen-for checklist specific to the drill, for example soft start on the first word, steady pace, a pause at each ▾ mark, and an exhale before speaking. The user ticks what they heard, and the ticks are stored with the rating. Each drill has a short written technique demo explaining what good sounds like. Speech therapist-recorded audio examples are a later addition.
- **Storage:**
  - Clips are stored in IndexedDB on the device and never uploaded.
  - Drill clips are deleted after 14 days.
  - Proof and re-record clips are kept until the user deletes them.
  - Settings shows the storage used and has "Delete all".
- **Proof:**
  - The first-run same-session comparison shows two players (cold and paced), both ratings, and the measures.
  - The weekly re-record uses the same baseline passage every 7 days, and Progress shows then and now in the same way.
- **Measures (on device):** speaking time, pauses over 1 second, and words per minute. A caption reads: "These measure pace and pauses, not stammering."
- If microphone permission is denied, drills still work without recording.

## 6. Architecture
```
index.html            shell + design tokens
css/app.css
js/main.js            boot, tabs, event delegation
js/state.js           fresh(), sanitize(), load/save, migration
js/rules.js           award(), rollDay(), ranks, quests, XP table, titles
js/content/*.js       one file per context: questions, passages, real-world steps
js/personal.js        feared words/sounds weaving
js/breath.js          techniques, pacer, tones, voice, wake lock
js/recorder.js        MediaRecorder, IndexedDB store, retention, measures
js/drills.js          read aloud, breathe and speak, warm-up, questions, challenge, steps
js/views/*.js         home, breathe, speak, progress, settings, first-run
js/analytics.js       opt-in adapter, a no-op until a service is approved
sw.js  manifest.webmanifest  icons/  fonts/
```
- **Code and offline:** native ES modules with no bundler and no runtime dependencies. Fonts are bundled as OFL woff2 files. The service worker precaches everything, so the app works fully offline.
- **Visual direction:** the design moves from the combat heads-up display to a calm instrument. The new direction is chosen and documented in DESIGN.md at step 2, using the impeccable new-work flow. The leveling layer keeps a distinct, sharper visual voice of its own, used only at reward moments.
- **Data:**
  - The storage key stays `fluency-rank:v2`, now with `v:3`.
  - `sanitize()` migrates v2 data. XP, rank, stats, days, log, shields, streak and settings are kept. Energy and tired-only fields are dropped.
  - New fields go into `sanitize()`: contexts, feared words and sounds, technique check ticks, titles, and the analytics opt-in.
  - Recordings live outside the backup text.
- The `window.claude` sync becomes an optional adapter. Everywhere else it does nothing.
- **Accessibility:**
  - The CLAUDE.md rules stay: 44px targets, focus moved to each new heading, `inert` behind overlays, reduced motion, timers that can be hidden.
  - Every button's accessible name includes its context ("Open Read aloud").
  - Breathing phases are announced.
  - A 5-size type scale.
  - Text contrast of at least 4.5:1, including decorative numbers.
- **Design rules:** no neon glow, no emoji icons, no identical card grids, no confetti, no side-stripe accents, no filler copy.
- **Hosting:** GitHub Pages.

## 7. Testing
- **Runner:** Node creates a jsdom window, sets globals, then imports the modules. No new dependency.
- **Unit tests:** state, migration, `award()`, the XP table, partial credit, titles, feared-word weaving, retention, and measures (using synthetic audio buffers).
- **UI tests (jsdom):** a fake clock, plus mocks for `MediaRecorder`, `getUserMedia`, IndexedDB and `speechSynthesis`.
- **Existing checks:** all 85 are ported. Expectations change only where this spec changes the rules: fixed XP, no tired bonus, and plain names.
- **Done means `npm test` exits 0.**
- Adding Playwright WebKit as an optional dev dependency, for iOS-like checks, needs approval first.

## 8. Build order
0. Make `npm test` exit 0 by stubbing `scrollTo`. Make the first commit. Deploy the current app to GitHub Pages.
1. Split into modules and make the PWA work offline: manifest, service worker, fonts, icons. Behaviour stays the same.
2. The calm surface: new visual direction (DESIGN.md), the new Home and tabs, plain names, End control with partial credit, accessibility fixes, fixed XP, the two-item quest, "I'm about to speak", and the v3 migration.
3. The Breathe tab.
4. Recording, the "Am I doing it right?" check, first-run same-session proof, the weekly re-record, and the measures.
5. The two launch contexts and their content, feared words and sounds, editable banks, titles, and the rename.
6. Reminders ("Add to calendar" with an alert, plus an in-app due state, with the limits stated plainly) and the Help page.
7. Before the App Store: the opt-in analytics service (needs approval), the Capacitor shell, native notifications and haptics, and TestFlight.
8. After launch: interviews and presentations, and social conversation.

## 9. Known limits (stated plainly to the user)
- **Reminders:** iOS web can't schedule its own alarm. Web push needs the app on the Home Screen, permission granted, and a server, so it is not used. Calendar alerts are the offline workaround. Native notifications come in step 7.
- **Haptics:** none on iOS web.
- **Measures:** self-ratings, technique ticks, and the pace and pause measures are indicators of change. They are not a diagnosis of stammering.
- **App Store:** Apple guideline 4.2 rejects plain website wrappers, so the native step must add native reminders and recording.
