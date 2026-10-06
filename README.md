# Offer Filter website

The illustrated Offer Filter landing page and 21-second animated ad, published as finished static assets on the existing GitHub Pages site at https://offerfilter.org.

The Android download still uses the existing signed distribution and automatic-update channel. This change does not build, sign, or replace the Android app.

## The film

The 21-second film is deterministic Canvas animation in `assets/film.js`, and the homepage plays it live: `player.js` draws each frame into a canvas, clocked by the soundtrack. The same code renders the downloadable MP4s, so the page and the download show the same frames. Each format is composed separately: landscape 1920 × 1080, portrait 1080 × 1920 and square 1080 × 1080, all 630 frames at 30 fps.

From "Set your minimums" to the close, the film shows the app itself on a phone. Rather than a screen recording, `assets/app/` redraws the app's main page from its own source: the Java `onDraw` code of the constellation of minimums, the mascot and its counts, the skyline of recent offers, the area map, the scenery and header, and the offer ticket in its bottom sheet, ported line by line to the canvas API with the app's palette, sizes and Roboto type (`files.json` lists them in load order; `page.js` lays them out as `MainActivity` does on a 412 × 915 dp phone). The film plays a short story on it, cued to the beat: a finger drags the per-mile minimum from $1.50 to $1.85, three low offers are declined (the mascot catches each one on the sieve as its badge pops, the counts and skyline follow), a good one passes with its heads-up alert, its building is tapped and its ticket opens, and at dawn the app turns to its day palette over the area map. A camera eases between close-ups of the parts in play. The offers, times and area are invented; the phone frame, status bar and alert card are generic Android, not any company's interface.

Why live: playing the film downloads about 300 KB of soundtrack (Opus, with an AAC fallback) instead of a 4.4–5.9 MB video, the film script and the app's ports (about 22 KB and 268 KB, 10 KB and 89 KB compressed; the ports are fetched only when a visitor reaches for Play) are shared with the renderer, and the poster is the film's own closing frame rather than a JPEG. Frames are vector-sharp at any size, including full screen, and the composition follows the stage: landscape on wide screens, square on phones, portrait in a tall full screen. The app layer skips views the camera has cropped away, draws the constellation's fades in one offscreen layer as Android's `saveLayer` does, and stretches a pre-blurred phone shadow instead of blurring every frame. Measured in local Chromium with software rendering only (no GPU), a frame takes about 11 ms on a typical desktop stage and 10 ms on a phone-sized square over the whole film; while the phone is on screen it takes about 15 and 13 ms (before the app's screens, about 6 and 5), of which under 4 ms is script and the rest is rasterizing, which a GPU takes over. The player draws at most 60 frames a second and falls back to 30, the MP4's rate, on a device that needs more than 10 ms per frame. Hardware video decoding is still cheaper per frame than drawing, so the MP4 remains the right file for sharing.

The player has play/pause, seeking, captions, mute and full screen, with keyboard shortcuts (K or Space, ←/→, C, M, F). Picture time follows the soundtrack's clock; if the soundtrack cannot load, the film plays silently on the page's own clock. Without a canvas or the film script, the page plays the composed MP4 with native controls, and without JavaScript a `<noscript>` video does the same. "Save film" downloads the MP4 for the composition on screen. The MP4s carry the English captions as a soft subtitle track; `assets/film-captions.vtt` and the live captions both come from `OfferFilm.CAPTIONS`.

Shots are cut on the soundtrack's beat grid (105.15 BPM), each just before its line: time (0 s), minimums (3.51 s), declining (5.22 s), choice (9.22 s), history (10.93 s), area guidance (13.78 s) and the closing scene (15.49 s). Headings land with their words; the three declined offers get their badges on beats 11, 13 and 15 and the good one on beat 18; dawn breaks on the 13.78 s downbeat; "Free" and "& open source" appear as each is spoken, and sparkles take the last four beats. The night backdrop, stars and hills run continuously through every cut while only the foreground crossfades, and the phone stays in one continuous layer from its entrance to its bow before the close. The ending pairs the mascot with a left-aligned text column in landscape and one centered column in portrait and square. The Jesus Loves You emblem is a small unbacked signature with the complete passage; only its foreground ink is tinted forest green and the original alpha silhouette is unchanged.

Text is measured from actual font bounds and fitted within safe widths. No rectangular text-reveal mask can crop ascenders or descenders. Every visible text draw is checked against the frame during all 630 frames of each format (the app's own text stays inside the phone's screen). Background offer tickets deliberately enter and leave the scene; their decorative edge bleed is not essential text. Baloo 2 is a variable font, which Skia draws at its default weight, so the renderer uses a static bold instance (`assets/baloo2-bold-latin.ttf`); earlier MP4s showed the film's titles at regular weight while browsers draw them bold.

The soundtrack is the supplied 20.4-second take in `assets/your-time-matters.mp3`, kept unchanged in the repository. The film plays it at its own speed and balance with a uniform 1 dB trim, because the take is mastered to 0 dBFS and lossy encodes would otherwise clip (true peaks are now −0.7 dBTP for Opus and −0.8 dBTP for AAC). Only its last 0.3 seconds, a chord ringing at about −35 dB, fade to silence before a 0.6-second hold. No music is looped or repeated. Creative-media rights remain described in THIRD_PARTY_NOTICES.md.

## Reproduce locally

Requires Node.js, @napi-rs/canvas, Python 3, FFmpeg with H.264/AAC and VP9/Opus, and fontTools with brotli for the fonts. The renderer can use the installed primary runtime via CODEX_PRIMARY_RUNTIME_NODE_MODULES. No external CI or build service is used.

```sh
sh tools/make-fonts.sh
python3 tools/film/make-audio.py /tmp/offer-film
node tools/render-film.cjs stills /tmp/offer-film
node tools/render-film.cjs landscape /tmp/offer-film
node tools/render-film.cjs portrait /tmp/offer-film
node tools/render-film.cjs square /tmp/offer-film
ffmpeg -i /tmp/offer-film/offer-filter-portrait.mp4 -map 0:v -map 0:a -c:v libvpx-vp9 -crf 27 -b:v 0 -row-mt 1 -cpu-used 4 -c:a libopus -b:a 160k /tmp/offer-film/offer-filter-portrait.webm
NODE_PATH="$(npm root -g)" node tools/test-site.cjs
NODE_PATH="$(npm root -g)" node tools/test-launch-help.cjs
```

`assets/film.js` owns the complete animation and the app story; `assets/app/` holds the app's ported views; `player.js` plays it on the page; `tools/render-film.cjs` renders and audits it and writes the captions; `tools/film/make-audio.py` verifies the recording and prepares the soundtrack and the website's `film-soundtrack.webm` and `.m4a`; `tools/make-fonts.sh` derives the Latin WOFF2 web fonts (Baloo 2 keeps its weight axis) and the renderer's static bold. `tools/test-site.cjs` plays the live film in Chromium. Earlier ending recipes and receipts remain as historical production evidence and are superseded by this full-film renderer.

The film uses invented offers and map locations, and says so on screen. It is an illustration of the idea, not a device-validation run, an earnings promise, or evidence about DoorDash's offer algorithm. Default behavior is shown; passing an offer leaves the choice to the user.

The site is static HTML, CSS and JavaScript with local fonts and media; a first visit loads about 220 KB, with the soundtrack fetched only for playback. It does not embed tracking, account connections, payment processing, or an app build. Public Android source is on the separate app-source branch. The MIT License covers the website software; font and creative-media rights are separate in THIRD_PARTY_NOTICES.md.


## Accountless feedback

The public site includes a small feedback form that posts directly to the dedicated Offer Filter feedback endpoint at `https://zlnfvqyyjsltmkmmpgzp.supabase.co/functions/v1/offer-filter-feedback`. It asks for no name, email, GitHub account, or Offer Filter account and sends no diagnostics from the website. The form submits only the selected category, typed message, and a `web` source/version marker.

The feedback database is write-only from the public path, uses server-side rate limiting without storing the raw IP address in the feedback record, and expires feedback after 90 days. Supabase and network providers still handle ordinary connection metadata, so the UI describes this as accountless feedback rather than guaranteeing mathematical anonymity. The site still has no analytics or tracking.
