# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

The app ships first as an installable web app (PWA) on GitHub Pages. It is designed to feel native on iPhone from now on, so the later Capacitor App Store build is a wrapper, not a redesign.

## Users
Adults (18+) who stammer or freeze when speaking, practising on their phone. They often open the app right before a call, a meeting or an interview. Their job is to get their breath and voice steady, practise speaking techniques daily, and build the courage to approach real conversations. The first user is the project owner, and the design targets a general App Store audience.

## Product Purpose
Speak with confidence. Daily breathwork and short speaking drills get the user from opening the app to speaking in one tap. A same-session before/after recording shows a visible change within the first five minutes. Success means daily practice that sticks, and more real conversations approached, not "fluency" as a score.

## Positioning
A stammer-practice app that is honest, private and free at its core. It has no account, recordings never leave the phone, and it makes no cure claims. A light leveling layer (ranks, titles, a System voice at reward moments) sits on top of a calm, adult surface. Competitors either overwhelm with content and paywalls (Stamurai) or promise cures (StopStutter).

## Operating Context
- Used one-handed, often minutes before a dreaded phone call or meeting.
- Also used late at night when tired.
- Practice is spoken aloud.
- Breathwork may be done with eyes closed, with audio cues.
- Works offline.

## Capabilities and Constraints
- Native ES modules, no build step, no runtime dependencies. Offline service worker. Data in localStorage (key `fluency-rank:v2`, v3 schema) and recordings in IndexedDB.
- All progress goes through `award()`. Every saved field passes `sanitize()`. Old saves must keep loading.
- iOS web has no vibration, so haptics wait for the native build. Reminders are limited until native.
- Launch contexts: phone calls and services, and work meetings and calls.
- Undecided: final app name (step 5), pricing (free for now), analytics service (opt-in, needs approval).

## Brand Commitments
- Plain, calm voice for help and hard moments. A terse bracketed "System" voice only for rewards ([Quest complete], [Rank up], [Title earned]).
- Leveling inspired by the concept of Solo Leveling, not its art or names.
- No neon glow, no emoji icons, no identical card grids, no confetti, no childish rewards, no guilt or punishment copy.

## Evidence on Hand
- Breathwork evidence to cite carefully: the 2023 Stanford cyclic-sighing RCT (Balban et al., Cell Reports Medicine) and HRV-biofeedback meta-analyses for resonance breathing (~6 breaths/min).
- No testimonials, clinician endorsements, user counts or outcome data exist. Never fabricate them.

## Product Principles
1. One tap from opening to speaking.
2. Honest progress: show real change (recordings, measures, real conversations). Never promise a cure.
3. Calm surface, earned rewards: the game rewards effort and courage and never shames a miss.
4. Private by default: everything stays on the device.
5. Simple over complete: fewer, better drills.

## Accessibility & Inclusion
- 44pt+ targets; focus moved to each new heading; `inert` behind overlays; reduced motion respected; timers can be hidden; breathing phases announced to screen readers; text contrast at least 4.5:1.
- The app never requires speaking to a stranger in order to progress. Real-world steps are always optional.
