# Offer Filter website

The illustrated Offer Filter landing page and original 18.5-second motion-graphics draft, published with GitHub Pages.

Static HTML, CSS and JavaScript with local fonts, captions and MP4/WebM assets. No server, account connection, tracking or payment processing is embedded here. Tip links open the visitor's chosen provider.

The Download and setup action uses the app's existing signed distribution channel. This site does not build, sign or replace Android updates.

Publish the root of `main` with GitHub Pages. All local asset references are relative so the project path works without a custom domain.

The film uses invented offers. It is an illustrative marketing draft, not device-validation or earnings evidence. Font licenses are included beside the fonts.

The film is embedded inline at 16:9 with a visible poster from the landscape export. Playback starts only on user action; native controls and English captions remain available. The existing illustrated mascot now sits beside the header wordmark. The film occupies the hero illustration space, with no second player below the page. The footer closes with a small 144px “Jesus Loves You” signature in forest green by day and white by night, its complete passage, and the reference “1 John 4:19”. The Android app’s signature styling is released separately through its normal updater.

The soundtrack uses the user-supplied “Your Time Matters” narration and music. The final line is edited to “Free.” so it matches the existing source-available, proprietary license. The complete original recording remains unchanged in `assets/your-time-matters.mp3`. All four exports retain the original voice speed and level through the final word, then crossfade into the same recording’s speech-free instrumental tail, repeated once with a short crossfade and faded out. The film remains 18.5 seconds. No voice was generated and the original tonal score is not mixed in.

The final card uses the existing mascot and bundled brand typography in a newly spaced composition: the app name and tagline lead, with Android/tips and the small charcoal signature in a separate support area. The portrait layout is centered; the square and landscape formats balance the support copy against the emblem. Each element has clear space, and the full signature stays above the illustrated hills. Its complete passage and “1 JOHN 4:19” remain. The page emblem still uses forest green by day and white by night.

`tools/render-closing-scene.cjs` locally renders the last 2.5 seconds using the existing `assets/brand.js` vector primitives, bundled fonts and unchanged emblem master. `tools/recompose-film-ending.py` applies that scene only from 16 seconds, fading in by 16.3 seconds, against the SHA-256-guarded original clean-score exports. The composition stage retains 555 frames at 30 fps and the clean tonal score. The subsequent `tools/finish-narration.py` step replaces only audio: every compressed video packet and its presentation/decode time remains unchanged. The former overlay-only recipes remain for reproduction of historical versions; the composition recipe supersedes their closing layout. No hosted build or CI service is used.

To reproduce locally, with Node.js, `@napi-rs/canvas`, Python 3 and FFmpeg available:

```sh
node tools/render-closing-scene.cjs /tmp/offer-closing-scene
python3 tools/recompose-film-ending.py --source /path/to/original-clean-score-exports --ending /tmp/offer-closing-scene --output /tmp/offer-composed-films
python3 tools/finish-narration.py --source /tmp/offer-composed-films --audio assets/your-time-matters.mp3 --output /tmp/offer-narrated-films
```

Source inputs must match the guards in `tools/sign-emblem-film.py`; the script refuses a previously composited or otherwise changed source. The original emblem PNG is preserved without pixel changes, with its built-in image-generation provenance in `validation/`.

The earlier [music and spoken-narration brief](SUNO_MUSIC_BRIEF.md) remains as production background. English captions now follow the supplied speech, ending with “Free.”

The View source on GitHub button opens the separate public app-source branch. Its existing proprietary license remains unchanged; public source visibility does not grant an open-source license. The earlier unedited narrated alternative remains on `codex/recompose-film-endcard-20261004`; its “open source” wording is not used in this version.
