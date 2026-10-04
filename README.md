# Offer Filter website

The illustrated Offer Filter landing page and 24-second motion-graphics film, published with GitHub Pages.

Static HTML, CSS and JavaScript with local fonts, captions and MP4/WebM assets. No server, account connection, tracking or payment processing is embedded here. Tip links open the visitor's chosen provider.

The Download and setup action uses the app's existing signed distribution channel. This site does not build, sign or replace Android updates.

Publish the root of `main` with GitHub Pages. All local asset references are relative so the project path works without a custom domain.

The film uses invented offers. It is an illustrative marketing draft, not device-validation or earnings evidence. Font licenses are included beside the fonts.

The film is embedded inline at 16:9 with a visible poster from the landscape export. Playback starts only on user action; native controls and English captions remain available. The existing illustrated mascot now sits beside the header wordmark. The film occupies the hero illustration space, with no second player below the page. The footer closes with a small 144px “Jesus Loves You” signature in forest green by day and white by night, its complete passage, and the reference “1 John 4:19”. The Android app’s signature styling is released separately through its normal updater.

The soundtrack uses the complete user-supplied “Your Time Matters” narration and music, including the original final sentence “Free and open source.” The original MP3 remains unchanged in `assets/your-time-matters.mp3`. Every spoken word retains the original speed and level. Only the recording’s speech-free instrumental outro repeats, with sample-counted equal-power crossfades, to accompany the longer credits; it fades naturally before the final hold ends. No voice was synthesized and no other soundtrack is mixed in.

The final eight seconds are movie credits: a centered white type column on black, slow upward movement and a 3.2-second final hold. The credits contain the film name, supplied soundtrack title, “JESUS LOVES YOU”, the complete “WE LOVE EACH OTHER / BECAUSE HE LOVES US FIRST.” passage, “1 JOHN 4:19”, and the independent-app notice. The previous mascot, skyline and promotional card are removed from this ending. Landscape, portrait and square are laid out individually. Both poster images now show the settled credits.

`tools/render-movie-credits.cjs` typesets the 8-second closing sequence with the bundled Atkinson font. `tools/assemble-movie-credits.py` preserves the previous edit through 15.65s, fades to black by 16s, and appends the credits through 24s. All formats have 720 frames at 30fps. Video is re-encoded, so its compressed packets are not claimed unchanged. The original voice remains intact through 17.45s; only the speech-free musical tail is extended. All rendering and verification is local. Historical film recipes and receipts remain for provenance; this recipe supersedes their end-card composition and clipped final sentence.

To reproduce locally, with Node.js, `@napi-rs/canvas`, Python 3 and FFmpeg available:

```sh
node tools/render-movie-credits.cjs /tmp/offer-movie-credits-frames
python3 tools/assemble-movie-credits.py --source /path/to/7375a83-film-assets --ending /tmp/offer-movie-credits-frames --audio assets/your-time-matters.mp3 --output /tmp/offer-movie-credits-exports
```

Source inputs must match the guards in `tools/assemble-movie-credits.py`; the script refuses different film or audio sources. The original emblem PNG is preserved without pixel changes, with its built-in image-generation provenance in `validation/`.

The earlier [music and spoken-narration brief](SUNO_MUSIC_BRIEF.md) remains as production background. English captions follow the complete supplied speech, ending with “Free and open source.”, followed by instrumental/fade cues.

Offer Filter is free and open source under the MIT License. The View source on GitHub button opens the Android `app-source` branch, whose `LICENSE`, `TERMS.md` and `PRIVACY.md` accompany the app. Website software is also covered by the [MIT License](LICENSE); the [third-party and creative-media notices](THIRD_PARTY_NOTICES.md) keep font and media rights separate. This website change does not itself modify the app-source branch.
