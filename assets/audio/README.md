# Optional Custom Audio Overrides

By default, Fluency Rank synthesizes warm Tibetan singing-bowl chimes and a gentle stereo pink-noise rain/ocean bed 100% offline with zero extra file size (`js/audio.js`).

If you download `.mp3` clips from Pixabay Audio, Mixkit, or Freesound (CC0), drop them into this folder and map any slot you want to override in `assets/audio/manifest.json`:

```json
{
  "in": "in.mp3",
  "hold": "hold.mp3",
  "out": "out.mp3",
  "go": "go.mp3",
  "end": "end.mp3",
  "ambient": "ambient.mp3"
}
```

Any slot omitted from `manifest.json` automatically falls back to the built-in singing-bowl synthesizer. Remember to add any new `.mp3` files to `PRECACHE` in `sw.js` for offline use.
