# Offer Filter website

The illustrated Offer Filter landing page and 21-second animated ad, published as finished static assets on the existing GitHub Pages site at https://offerfilter.org.

The Android download still uses the existing signed distribution and automatic-update channel. This change does not build, sign, or replace the Android app.

## The film

The 21-second film is deterministic animation in `assets/film.js`, drawn in two layers: its art in real-time 3D (WebGL, through the small hand-written renderer in `assets/gl.js` and the models in `assets/models.js`: the sky and stars, three hills and a town, the falling offers, the road and car, the phone's body, the mascot, its ensō and sparkles) and, over it, a 2D canvas for every word, the emblem and the app's own screen. The homepage plays it live: `player.js` draws each frame, clocked by the soundtrack. The same code renders the MP4s (`tools/render-film.cjs`, through headless Chromium), so the page and the files show the same frames. Each format is composed separately: landscape 1920 × 1080, portrait 1080 × 1920 and square 1080 × 1080, all 630 frames at 30 fps.

From "Set your minimums" to the close, the film shows the app itself on a phone. Rather than a screen recording, `assets/app/` redraws the app's main page from its own source: the Java `onDraw` code of the constellation of minimums, the mascot and its counts, the skyline of recent offers, the area map, the scenery and header, and the offer ticket in its bottom sheet, ported line by line to the canvas API with the app's palette, sizes and Roboto type (`files.json` lists them in load order; `page.js` lays them out as `MainActivity` does on a 412 × 915 dp phone). The film plays a short story on it, cued to the beat: a finger drags the per-mile minimum from $1.50 to $1.85, three low offers are declined (the mascot catches each one on the sieve as its badge pops, the counts and skyline follow), a good one passes with its heads-up alert, its building is tapped and its ticket opens, and at dawn the app turns to its day palette over the area map. A camera eases between close-ups of the parts in play. The offers, times and area are invented; the phone frame, status bar and alert card are generic Android, not any company's interface.

Why live: playing the film downloads about 300 KB of soundtrack (Opus, with an AAC fallback) instead of a 4.4–5.9 MB video. Until a visitor reaches for Play, the stage shows the film's closing frame as a 36 KB WebP (30 KB square on phones) and nothing of the film runs: no WebGL context, no film script. Hovering, focusing or touching Play fetches the film script and the app's ports (about 29 KB and 268 KB, 10 KB and 89 KB compressed) and builds the film's 3D meshes a few milliseconds at a time, so playing starts without a stall. The 3D art and the 2D words are composed in one canvas (the art is drawn on a canvas off the page and laid in), so the page composites a single layer. The renderer sends each uniform and switch only when it changes and binds each mesh's layout in one call. Measured against the 2D film in local Chromium with software rendering only (no GPU, the slowest case), the 3D film draws more frames for less CPU: 9.3 against 6.3 frames a second at 347 against 461 ms of CPU per frame on a desktop stage, and 8.2 against 6.8 at 384 against 474 ms on a phone-sized square. Where WebGL is drawn by the CPU, the moving picture is drawn at half its pixels and smoothed up (still frames at all of them). The player draws at most 60 frames a second and falls back to 30, the MP4's rate, on a device that needs more than 10 ms per frame. Hardware video decoding is still cheaper per frame than drawing, so the MP4 remains the right file for sharing.

The player has play/pause, seeking, captions, mute and full screen, with keyboard shortcuts (K or Space, ←/→, C, M, F). Picture time follows the soundtrack's clock; if the soundtrack cannot load, the film plays silently on the page's own clock. Without WebGL (found when the film is first wanted) or without the player's script, the page plays the composed MP4 with native controls, and without JavaScript a `<noscript>` video does the same. The MP4s carry the English captions as a soft subtitle track; `assets/film-captions.vtt` and the live captions both come from `OfferFilm.CAPTIONS`.

Shots are cut on the soundtrack's beat grid (105.15 BPM), each just before its line: time (0 s), minimums (3.51 s), declining (5.22 s), choice (9.22 s), history (10.93 s), area guidance (13.78 s) and the closing scene (15.49 s). Headings land with their words; the three declined offers get their badges on beats 11, 13 and 15 and the good one on beat 18; dawn breaks on the 13.78 s downbeat; "Free" and "& open source" appear as each is spoken, and sparkles take the last four beats. The night backdrop, stars and hills run continuously through every cut while only the foreground crossfades, and the phone stays in one continuous layer from its entrance to its bow before the close. The ending pairs the mascot with a left-aligned text column in landscape and one centered column in portrait and square. The Jesus Loves You emblem is a small unbacked signature with the complete passage; only its foreground ink is tinted forest green and the original alpha silhouette is unchanged.

Text is measured from actual font bounds and fitted within safe widths. No rectangular text-reveal mask can crop ascenders or descenders. Every visible text draw is checked against the frame during all 630 frames of each format (the app's own text stays inside the phone's screen). Background offer tickets deliberately enter and leave the scene; their decorative edge bleed is not essential text. The renderer draws through Chromium with the page's own WOFF2 fonts, so the MP4s' type matches the page's exactly.

The soundtrack is the supplied 20.4-second take in `assets/your-time-matters.mp3`, kept unchanged in the repository. The film plays it at its own speed and balance with a uniform 1 dB trim, because the take is mastered to 0 dBFS and lossy encodes would otherwise clip (true peaks are now −0.7 dBTP for Opus and −0.8 dBTP for AAC). Only its last 0.3 seconds, a chord ringing at about −35 dB, fade to silence before a 0.6-second hold. No music is looped or repeated. Creative-media rights remain described in THIRD_PARTY_NOTICES.md.

## The page in 3D

The page's scenery is drawn in real time with the same renderer (`scene.js`): a gradient sky, far hills, a small town whose windows light at night, trees, a winding road with the delivery car, and drifting dust, placed where the earlier flat drawing put them and lit by one soft key light, sky and ground light and a rim of sky light. The sky follows the app's: the sky button in the header shows the sky's own sun or moon (the app's scene paints its sun behind its header button the same way), with a breathing glow and three toy clouds drifting at the app's heights and paces by day (fading while they pass behind words, as the app's do) and a crescent moon and twinkling stars by night. Each tap moves on as the app's button does: Day, Night, System (the device's light or dark) and Auto, the default (night from 6 pm to 6 am on the device's clock, the app's fallback when it knows no place), with an "A" or "S" badge and a short note naming the choice. The sky turns in a 1.6-second sunset or sunrise, and the page's colors ease along with it. The logo, favicons and touch icon are pre-rendered from the 3D mascot.

The scene's WebGL setup waits until the page has loaded and the browser is idle, and its shaders link without blocking the page's thread (where the browser can report that), so it adds nothing before the first paint; the scenery fades in. A browser found to draw WebGL on the CPU gets a context without multisampling. A resize rebuilds the scenery once it settles, and a phone's address bar coming and going does not rebuild it at all.

## Reproduce locally

Requires Node.js with Playwright's Chromium, Python 3, FFmpeg with H.264/AAC, VP9/Opus and WebP, and fontTools with brotli for the fonts. The film renderer draws with SwiftShader, so a render does not depend on the machine's GPU. No external CI or build service is used.

```sh
sh tools/make-fonts.sh
python3 tools/film/make-audio.py /tmp/offer-film
node tools/render-film.cjs stills /tmp/offer-film
node tools/render-film.cjs landscape /tmp/offer-film
node tools/render-film.cjs portrait /tmp/offer-film
node tools/render-film.cjs square /tmp/offer-film
node tools/render-film.cjs posters /tmp/offer-film
ffmpeg -i /tmp/offer-film/offer-filter-portrait.mp4 -map 0:v -map 0:a -c:v libvpx-vp9 -crf 27 -b:v 0 -row-mt 1 -cpu-used 4 -c:a libopus -b:a 160k /tmp/offer-film/offer-filter-portrait.webm
NODE_PATH="$(npm root -g)" node tools/test-site.cjs
NODE_PATH="$(npm root -g)" node tools/test-launch-help.cjs
```

`assets/film.js` owns the complete animation and the app story; `assets/gl.js` is the WebGL renderer and `assets/models.js` the 3D characters and props; `assets/app/` holds the app's ported views; `player.js` plays it on the page; `tools/render-film.cjs` renders and audits it through `tools/film/render.html` and writes the captions and posters; `tools/film/make-audio.py` verifies the recording and prepares the soundtrack and the website's `film-soundtrack.webm` and `.m4a`; `tools/make-fonts.sh` derives the Latin WOFF2 web fonts (Baloo 2 keeps its weight axis) and the renderer's static bold. `tools/test-site.cjs` plays the live film in Chromium. Earlier ending recipes and receipts remain as historical production evidence and are superseded by this full-film renderer.

The film uses invented offers and map locations, and says so on screen. It is an illustration of the idea, not a device-validation run, an earnings promise, or evidence about DoorDash's offer algorithm. Default behavior is shown; passing an offer leaves the choice to the user.

The site is static HTML, CSS and JavaScript with local fonts and media; a first visit loads about 170 KB compressed (286 KB as stored), with the film and its soundtrack fetched only for playback. It does not embed tracking, account connections, payment processing, or an app build. Public Android source is on the separate app-source branch. The MIT License covers the website software; font and creative-media rights are separate in THIRD_PARTY_NOTICES.md.


## Accountless feedback

The public site includes a small feedback form that posts directly to the dedicated Offer Filter feedback endpoint at `https://zlnfvqyyjsltmkmmpgzp.supabase.co/functions/v1/offer-filter-feedback`. It asks for no name, email, GitHub account, or Offer Filter account and sends no diagnostics from the website. The form submits only the selected category, typed message, and a `web` source/version marker.

The feedback database is write-only from the public path, uses server-side rate limiting without storing the raw IP address in the feedback record, and expires feedback after 90 days. Supabase and network providers still handle ordinary connection metadata, so the UI describes this as accountless feedback rather than guaranteeing mathematical anonymity. The site still has no analytics or tracking.
