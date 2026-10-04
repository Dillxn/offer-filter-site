# Offer Filter website

The illustrated Offer Filter landing page and original 18.5-second motion-graphics draft, published with GitHub Pages.

Static HTML, CSS and JavaScript with local fonts, captions and MP4/WebM assets. No server, account connection, tracking or payment processing is embedded here. Tip links open the visitor's chosen provider.

The Download and setup action uses the app's existing signed distribution channel. This site does not build, sign or replace Android updates.

Publish the root of `main` with GitHub Pages. All local asset references are relative so the project path works without a custom domain.

The film uses invented offers. It is an illustrative marketing draft, not device-validation or earnings evidence. Font licenses are included beside the fonts.

The film is embedded inline at 16:9 with a visible poster from the landscape export. Playback starts only on user action; native controls and English captions remain available. The existing illustrated mascot now sits beside the header wordmark. The film occupies the hero illustration space, with no second player below the page. The footer closes with a small 144px “Jesus Loves You” signature in forest green by day and white by night, its complete passage, and the reference “1 John 4:19”. The Android Settings version remains sandstone as requested.

The current soundtrack is the user-supplied “Your Time Matters” narration and music, made with Suno. All four exports use that track by itself. Its full spoken content is retained at the original speed and level; the music tail fades from 17.0 to 17.6 seconds, followed by 0.9 seconds of quiet. The original MP3 is preserved as `assets/your-time-matters.mp3`. `tools/apply-narration.py` replaces the old tonal score while copying every compressed video packet and its timing unchanged. Captions follow the actual supplied speech, checked with a local transcription model. No voice generation or external build service was used.

The final card uses the existing mascot and bundled brand typography in a newly spaced composition: the app name and tagline lead, with Android/tips and the small charcoal signature in a separate support area. The portrait layout is centered; the square and landscape formats balance the support copy against the emblem. Each element has clear space, and the full signature stays above the illustrated hills. Its complete passage and “1 JOHN 4:19” remain. The page emblem still uses forest green by day and white by night.

`tools/render-closing-scene.cjs` locally renders the last 2.5 seconds using the existing `assets/brand.js` vector primitives, bundled fonts and unchanged emblem master. `tools/recompose-film-ending.py` applies that scene only from 16 seconds, fading in by 16.3 seconds, against the SHA-256-guarded original clean-score exports. This composition stage retains 555 frames at 30 fps and the original clean score; the subsequent narration step changes only audio. The former overlay-only recipes remain for reproduction of historical versions; the composition recipe supersedes their closing layout. No hosted build or CI service is used.

To reproduce locally, with Node.js, `@napi-rs/canvas`, Python 3 and FFmpeg available:

```sh
node tools/render-closing-scene.cjs /tmp/offer-closing-scene
python3 tools/recompose-film-ending.py --source /path/to/original-clean-score-exports --ending /tmp/offer-closing-scene --output /tmp/offer-composed-films
python3 tools/apply-narration.py --source /tmp/offer-composed-films --audio assets/your-time-matters.mp3 --fade-start 17.0 --output /tmp/offer-narrated-films
```

Source inputs must match the guards in `tools/sign-emblem-film.py`; the script refuses a previously composited or otherwise changed source. The original emblem PNG is preserved without pixel changes, with its built-in image-generation provenance in `validation/`.

The earlier [music and spoken-narration brief](SUNO_MUSIC_BRIEF.md) remains as background to the supplied recording. The current exports use the supplied narration.
