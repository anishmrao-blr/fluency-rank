# Design: Modified Sanctuary Voice

## Direction contract
- **THESIS:** Calm botanical planning in warm sage-alabaster (`#F7F9F7`) paired with Deep Pine Teal (`#315753`), shifting seamlessly into Deep Pine Night (`#111916`) frosted-glass forest photography during active breathing and speaking/recording.
- **OWN-WORLD:** Native iOS structure with an uncluttered single-focal-ring Home screen, whisper-quiet 4-tab bottom bar (`Home · Breathe · Speak · Progress`), local bundled `Plus Jakarta Sans` UI typography, and `Barlow Condensed` reserved exclusively for the leveling layer (`[Quest complete]`, rank emblem, pacer countdown).
- **STORY:** The user opens the app and sees one calm focal ring surrounded by breathing room. One tap launches daily practice in a low-glare dark pine canvas; every completed session returns to light alabaster with a quiet lotus medallion and rising weekly tide mark.
- **FIRST VIEWPORT (Home):**
  - Large title "Today" + Settings gear.
  - Compact 7-day tide strip ("This week X of 5").
  - Central living focal ring ("Start daily session · 5 min") + "Today 0 of 2".
  - Thumb-zone "I'm about to speak" button + quiet "Low energy? Short version" and "3-min voice proof" links.
  - Whisper-quiet 4-tab bar.
- **ASSETS:** Bundled locally in `assets/` (`bg-forest-pacer.jpg`, `medallion-lotus.jpg`, `banner-rhythm.jpg`) and precached in `sw.js` for full offline Airplane Mode support.

## Platform rules (iOS-native web)
- **Structure:** tab bar for Home · Breathe · Speak · Progress. Settings opens from a gear button in Home's title bar. Drills open as full-screen covers.
- **Exits:** a full-screen cover has an "End" control at the bottom, in the thumb zone, and asks for confirmation. Settings and editors open as sheets with Cancel and Done.
- **Titles:** large titles on top-level screens. Lists are grouped inset lists with 12px corners. There are no bespoke card stacks or card grids.
- **Safe areas:** everything sits inside the `env(safe-area-inset-*)` insets.
- **Touch:** targets are at least 44px. The primary button is 52px tall, full width, with 14px corners.

## Colour (semantic tokens on `:root`, redefined per scheme)
| Token | Dark (harbour night) | Light (chart paper) | Use |
|---|---|---|---|
| `--bg` | #0B1A24 | #F2F6F7 | screen ground |
| `--bg-group` | #12242F | #FFFFFF | grouped list rows |
| `--fill` | #1A3240 | #E4EDF0 | secondary buttons, tracks |
| `--sep` | rgba(150,200,210,.18) | rgba(14,34,48,.14) | hairlines |
| `--label` | #EAF2F4 | #0E2230 | primary text |
| `--label-2` | #9FB6C0 | #4A6270 | secondary text (at least 4.5:1) |
| `--water` | #17414F | #CFE5EA | pacer water body, tide fills |
| `--sounding` | #7FD1C7 | #2E8C88 | soundings, tide marks, the "done" state |
| `--tint` | #F28C38 | #B4500C | the one interactive tint: buttons, links, selection |
| `--on-tint` | #1A0E04 | #FFFFFF | text on the tint |
| `--scrim` | rgba(2,8,12,.6) | rgba(14,34,48,.36) | dimming behind sheets and alerts |

- The light `--tint` was #C4580F. It measured 4.06:1 on `--bg` and 4.42:1 under white text, so step 2 darkened it to #B4500C (4.72:1 and 5.13:1).
- The scheme follows `prefers-color-scheme`. Both schemes are first-class and both get tested.
- The tint is for interaction only, never decoration. Seafoam means "done". There is no red error colour for missed days, because the app has no miss states.

## Type (5 sizes; Dynamic Type via `font: -apple-system-body` with a 17px fallback)
| Style | Size/line | Weight | Face |
|---|---|---|---|
| Large title | 34/41 | 700 | SF Pro (system-ui) |
| Title | 22/28 | 600 | SF Pro |
| Body | 17/22 | 400 | SF Pro |
| Subhead | 15/20 | 400/600 | SF Pro |
| Caption | 13/18 | 400 | SF Pro |

- **Numerals:** use `font-variant-numeric: tabular-nums` on SF Pro. There is no separate mono face.
- **Display (leveling layer only):** Barlow Condensed 600/700, uppercase with 0.06em tracking. It is used for System notices (`[Quest complete]`), the rank letter, and the big pacer count. It never appears in body text, labels or buttons.
- IBM Plex is retired.

## Signature elements
- **Tide pacer:** water fills the whole cover from the bottom. Its surface is a gentle wave (SVG path) that rises on the inhale and falls on the exhale. Fixed sounding lines sit every 10% with small depth ticks. The phase word ("Breathe in" / "Out, slowly") sits at the surface.
  - Reduced motion: no wave and no slide. The phase word changes and a thin fill bar steps.
  - Phases are announced through an `aria-live="polite"` region.
- **Tide-mark week strip:** 7 columns, Monday to Sunday. A practice day shows a high-water bar in `--sounding`: half height for 1 item, full height for 2. Today has a tint underline. Empty days are just the empty track, never a red mark.
- **Tide-table mosaic (Progress):** a 66-cell grid laid out like a tide table. Filled cells use `--sounding`, at 60% opacity for 1 item and 100% for 2. Day numbers are in `--label-2` and meet 4.5:1 contrast.
- **Course of real-world steps (Speak):** a vertical course line with a buoy (circle) per step. Done buoys are filled `--sounding`, and the next buoy is ringed in the tint.
- **Rank emblem (Progress and reward screens only):** the hexagon from the app icon, with its letter in display type.
- **System notices:** a toast or result line in display type inside brackets, for example `[QUEST COMPLETE] DAILY QUEST · +40 XP`. The bracketed tag is set in `--sounding` (done), and the XP figure never breaks across lines. They are only used for rewards.
- **Result tide mark:** every result screen that counts toward today shows the week strip, and today's high-water mark comes in from where it stood before the session.

## Motion
These rules follow Emil Kowalski's design-engineering skill from skills.sh, read for reference and not installed.
- **System transitions only.** Covers rise from the bottom and dismiss by reversing. Tab switches are instant.
- **Easing:**
  - Entrances and exits: `cubic-bezier(.23,1,.32,1)` (a strong ease-out).
  - On-screen movement: `cubic-bezier(.77,0,.175,1)`.
  - Colour changes: `ease`.
  - Never use `ease-in`, and never animate from `scale(0)`.
- **Durations:**
  - Press feedback is 120ms (`scale(.97)` on buttons).
  - UI changes stay under 250ms.
  - Covers and sheets take 380ms. Toasts take 400ms.
- **Pacer:** the gauge (soundings and low water) ends above the End control, so the count is never covered; the water body still runs to the bottom edge. The wave is the only continuous motion. The water level eases sinusoidally through each phase, never linearly, so it slows at the top and bottom of each breath. That idea came from the 21st.dev "breath bloom" component. Animate `transform` only.
- **No hover-only effects.** Hover styles sit behind `@media (hover:hover) and (pointer:fine)`.
- **Result tide mark:** today's bar rises once, 600ms with the strong ease-out after a 200ms delay. It is the one authored reward motion, and it is off under reduced motion.
- **Reduced motion** means fewer and gentler animations: opacity and colour changes stay, and movement goes.

## Craft references (inspiration only; no code copied)
- 21st.dev "Heat Strip": put a quiet numbers row above the week strip ("This week 3 of 5 · Best run 6"), and show intensity through opacity.
- 21st.dev "Wave Animation": build the water surface from a sine function, using 2 layered waves at different speeds and opacities for depth.
- 21st.dev pill bottom navs were rejected. iOS tab bars always show labels.

## Rules
- No neon glow, emoji icons, confetti, glassmorphism, card grids, side-stripe accents, red miss states, or uppercase body text.
- Icons are inline SVG line icons with a 1.75 stroke on a 24 grid, in one consistent family. There is no icon font.
