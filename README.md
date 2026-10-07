# Offer Filter website

The static site for https://offerfilter.org, served by GitHub Pages from this repository (custom domain in `CNAME`).
It has no build step, no cookies, no analytics and no third-party embeds; the home page keeps three small notes in the
browser's local storage (the sky and captions choices, and whether WebGL is drawn by the CPU there), which never leave
the device. The app itself lives in [Dillxn/dasher-offer-filter](https://github.com/Dillxn/dasher-offer-filter); its
signed APK and update feed are served from https://dash-offer-filter-build.onrender.com.

## Pages

| Path | What it is |
|---|---|
| `/` (`index.html`, `style.css`, `page.js`, `scene.js`, `player.js`, `assets/scenery.js`, `assets/gl.js`, `assets/models.js`, `assets/film.js`, `assets/app/`) | Hero, the 21-second film drawn live in 3D, the riding 3D scenery, and the Help, Feedback, About and Tip dialogs. Dialogs have addresses: `/#help`, `/#feedback`, `/#about`, `/#tip`. The sky button cycles Day, Night, System and Auto as the app's does (see "The page in 3D"). |
| `/install/` (`install/index.html`, `install/install.js`) | The download button and the step-by-step setup guide. The button is labelled from `assets/release.json`. |
| `/privacy/`, `/terms/`, `/license/` | Generated from the app's `PRIVACY.md`, `TERMS.md` and `LICENSE`; Privacy adds a "This website" section. |
| `404.html`, `robots.txt`, `sitemap.xml` | Not-found page, crawler rules and sitemap. |

`doc.css` styles the reading pages (install, legal, 404), with a dark palette from the home page's night colours.

## At every release

Run from this repository, with the app repository checked out beside it (`../dasher-offer-filter`, or pass
`--app-repo PATH`, or set `OFFER_FILTER_APP_REPO`):

```sh
python3 tools/sync-release.py --live   # assets/release.json from what Render serves (without --live: the app's release/latest.json)
python3 tools/build-legal.py           # terms/, privacy/, license/ from the app's TERMS.md, PRIVACY.md, LICENSE
NODE_PATH="$(npm root -g)" node tools/test-launch-help.cjs   # local Chromium checks and release gates; nothing is sent anywhere
NODE_PATH="$(npm root -g)" node tools/test-site.cjs          # the live film, its player and the 3D scenery in Chromium
```

Run `sync-release.py` after the new APK is live on Render (its static site does not deploy itself), so the button
never names a version Render does not serve. Both Python scripts use only the standard library and take `--check` to
report, without writing, whether the committed files are current. Both tests use Playwright's Chromium with WebGL
drawn by SwiftShader, so they need no GPU.

Deploy (merge to `main`) only when `test-launch-help.cjs` ends without "NOT READY TO DEPLOY" and `test-site.cjs`
passes. The release gates hold the site back while:

- the terms or privacy still carry a drafting note ("Draft of …", "have a lawyer review", "not yet configured" and
  similar). `build-legal.py` refuses those texts too and prints each such line; `--allow-draft` builds a local
  preview only;
- the app's `PRIVACY.md` doesn't name `privacy@offerfilter.org`, the private contact the site shows for privacy,
  data deletion and security requests (feedback stays anonymous). That address must exist as a mail forward before
  the site goes live;
- once `release.json` is 0.5.0 or later, the terms and privacy don't describe Autopilot, or still mention the retired
  area mode ("compensating") or 0.4.73.

While the published app is older than the guide's beta (0.5.0), the install page says so under the download button,
and the guide marks what is new in 0.5.0. Deploy this site before the Render page that links to its `/terms/`,
`/privacy/`, `/license/` and `/#help`.

## Feedback

The feedback form posts the chosen type and the typed message, marked `web`, to the Offer Filter feedback endpoint
(a Supabase Edge Function, `backend/anonymous-feedback` in the app repository). It needs no account and sends no
diagnostics. It times out after 15 seconds and explains rate limits (429), rejected messages (400/413), being offline
and other failures, keeping the message on any failure. The endpoint accepts only the `https://` origins of this site,
so HTTPS must stay enforced. The test answers every request with fakes; never test against the real endpoint.

## The film

The 21-second film is deterministic animation in `assets/film.js`, drawn in two layers: its art in real-time 3D (WebGL, through the small hand-written renderer in `assets/gl.js` and the models in `assets/models.js`: the sky and stars, three hills and a town, the falling offers, the road and car, the phone's body, the mascot, its ensō and sparkles) and, over it, a 2D canvas for every word, the emblem and the app's own screen. The homepage plays it live: `player.js` draws each frame, clocked by the soundtrack. The same code renders the MP4s (`tools/render-film.cjs`, through headless Chromium), so the page and the files show the same frames. Each format is composed separately: landscape 1920 × 1080, portrait 1080 × 1920 and square 1080 × 1080, all 630 frames at 30 fps.

From "Set your minimums" to the close, the film shows the app itself on a phone. Rather than a screen recording, `assets/app/` redraws the app's main page from its own source: the Java `onDraw` code of the constellation of minimums, the mascot and its counts, the skyline of recent offers, the area map, the scenery and header, and the offer ticket in its bottom sheet, ported line by line to the canvas API with the app's palette, sizes and Roboto type (`files.json` lists them in load order; `page.js` lays them out as `MainActivity` does on a 412 × 915 dp phone). The film plays a short story on it, cued to the beat: a finger drags the per-mile minimum from $1.50 to $1.85, three low offers are declined (the mascot catches each one on the sieve as its badge pops, the counts and skyline follow), a good one passes with its heads-up alert, its building is tapped and its ticket opens, and at dawn the app turns to its day palette over the area map. A camera eases between close-ups of the parts in play. The offers, times and area are invented; the phone frame, status bar and alert card are generic Android, not any company's interface.

Why live: the film's sound is about 300 KB of soundtrack (Opus, with an AAC fallback) instead of a 3.9–5.3 MB video. Once the page has shown its words and the browser is idle, the film plays muted, round and round, at most 30 frames a second, on the page's own clock, so no soundtrack is fetched for it; "Play with sound" starts it over with the narration, and at its end the closing frame holds three seconds before the loop resumes. The loop rests while motion is paused or a dialog is open, and does not start where the visitor asks for reduced motion or less data (there nothing of the film loads until Play is pressed). Until the loop begins, the stage shows the film's closing frame as a 14 KB AVIF picture (13 KB square on phones; WebP where a browser cannot pick AVIF). For the loop the page fetches the renderer and models (usually already in the cache from the scenery's worker), the film script and the app's ports (about 62 KB, 29 KB and 268 KB; 22 KB, 10 KB and 89 KB compressed) and builds the film's 3D meshes a few milliseconds at a time, so it starts without a stall. The 3D art and the 2D words are composed in one canvas (the art is drawn on a canvas off the page and laid in), so the page composites a single layer. The renderer sends each uniform and switch only when it changes and binds each mesh's layout in one call. Measured against the 2D film in local Chromium with software rendering only (no GPU, the slowest case, where the scenery rests while the film plays with sound), the 3D film draws more frames for less CPU: 7.4 against 5.2 frames a second at 445 against 560 ms of CPU per frame on a desktop stage, and 6.2 against 5.5 at 508 against 597 ms on a phone-sized square. Where WebGL is drawn by the CPU, the moving picture is drawn at half its pixels and smoothed up (still frames at all of them). The player draws at most 60 frames a second and falls back to 30, the MP4's rate, on a device that needs more than 10 ms per frame. Hardware video decoding is still cheaper per frame than drawing, so the MP4 remains the right file for sharing.

The player has play/pause, seeking, captions, mute and full screen, with keyboard shortcuts (K or Space, ←/→, C, M, F). Picture time follows the soundtrack's clock; if the soundtrack cannot load, the film plays silently on the page's own clock. Without WebGL (found when the film is first wanted) or without the player's script, the page plays the composed MP4 with native controls, and without JavaScript a `<noscript>` video does the same. The MP4s carry the English captions as a soft subtitle track; `assets/film-captions.vtt` and the live captions both come from `OfferFilm.CAPTIONS`.

Shots are cut on the soundtrack's beat grid (105.15 BPM), each just before its line: time (0 s), minimums (3.51 s), declining (5.22 s), choice (9.22 s), history (10.93 s), area guidance (13.78 s) and the closing scene (15.49 s). Headings land with their words; the three declined offers get their badges on beats 11, 13 and 15 and the good one on beat 18; dawn breaks on the 13.78 s downbeat; "Free" and "& open source" appear as each is spoken, and sparkles take the last four beats. The night backdrop, stars and hills run continuously through every cut while only the foreground crossfades, and the phone stays in one continuous layer from its entrance to its bow before the close. The ending pairs the mascot with a text column in landscape (the mascot at the left, the column close beside it on the right, the two centred as one group; the mascot grows in once the last shot's words have gone) and one centered column in portrait and square. The Jesus Loves You emblem is a small unbacked signature with the complete passage; only its foreground ink is tinted forest green and the original alpha silhouette is unchanged.

Text is measured from actual font bounds and fitted within safe widths. No rectangular text-reveal mask can crop ascenders or descenders. Every visible text draw is checked against the frame during all 630 frames of each format (the app's own text stays inside the phone's screen). Background offer tickets deliberately enter and leave the scene; their decorative edge bleed is not essential text. The renderer draws through Chromium with the page's own WOFF2 fonts, so the MP4s' type matches the page's exactly.

The soundtrack is the supplied 20.4-second take in `assets/your-time-matters.mp3`, kept unchanged in the repository. The film plays it at its own speed and balance with a uniform 1 dB trim, because the take is mastered to 0 dBFS and lossy encodes would otherwise clip (true peaks are now −0.7 dBTP for Opus and −0.8 dBTP for AAC). Only its last 0.3 seconds, a chord ringing at about −35 dB, fade to silence before a 0.6-second hold. No music is looped or repeated. Creative-media rights remain described in THIRD_PARTY_NOTICES.md.

## The page in 3D

The page's scenery is drawn in real time with the same renderer (`assets/scenery.js`): a gradient sky, far hills, a small town whose windows light at night, trees, a winding road with the delivery car, and drifting dust, at the sizes the earlier flat drawing gave them and lit by one soft key light, sky and ground light and a rim of sky light. The camera rides beside the car: the car holds its place a third of the way across the page, turning with the road as it winds nearer and farther, its wheels rolling the ground it covers, while the road's dashes and the near trees stream past and the town and hills drift by. The land, the road and its trees, and the town repeat seamlessly along the way (each hill ridge on a longer period of its own), so nothing is rebuilt as the ride goes on. The ride carries on beside the film, whether it loops muted or plays with sound, and rests while a dialog is open or motion is paused. Where WebGL is drawn by the CPU, the scenery draws at 60% of the page's pixels, takes ten frames a second while the film moves, and rests while the film plays with sound, so the film has the machine. The sky follows the app's: the sky button in the header shows the sky's own sun or moon (the app's scene paints its sun behind its header button the same way), with a breathing glow and three toy clouds drifting at the app's heights and paces by day (fading while they pass behind words, as the app's do) and a crescent moon and twinkling stars by night. Each tap moves on as the app's button does: Day, Night, System (the device's light or dark) and Auto, the default (night from 6 pm to 6 am on the device's clock, the app's fallback when it knows no place), with an "A" or "S" badge and a short note naming the choice. The sky turns in a 1.6-second sunset or sunrise, and the page's colors ease along with it. The logo, favicons and touch icon are pre-rendered from the 3D mascot. The tip dialog's Cash App and Venmo buttons carry those services' marks.

Where the browser lets a page hand its canvas to a worker (OffscreenCanvas: current Chrome, Edge, Firefox and Safari), the scenery runs in one (`assets/scenery.js`): making its WebGL context, building the land and drawing every frame all happen off the page's own thread, which only says where the words, the sky button and the footer stand and passes on the sky, pausing and the page being hidden (`scene.js`). Elsewhere the same code draws on the page's thread. It begins once the page has shown its words and the browser is idle, and fades in. A browser found to draw WebGL on the CPU gets a context without multisampling, and a resize rebuilds the scenery once it settles (a phone's address bar coming and going does not). The page's entrance animation starts its words faint rather than invisible, so they show from the first frame.

Measured in local Chromium with software rendering only (no GPU), seven fresh visits to each page in turn: the 3D page shows its words and the film's poster sooner than the 2D page did, at 472 against 624 ms on a 1365 × 689 window and 456 against 576 ms on a phone (the first 3D page took 1.1 s and blocked its thread for about half a second making the scenery's WebGL context). The poster is preloaded from the page's head at high priority; on a throttled connection (1.6 Mbit/s, 150 ms round trips) the two pages show their words within about 0.15 s of each other, the order varying from run to run. Starting the film's muted loop makes the film's WebGL context on the page's thread once, after the first paint: about 0.3 s with software rendering here, a small part of that on a GPU. With the film looping beside it, the riding scenery draws 3.6–4.6 frames a second here, against the 2D page's scenery on its own at 4.5–6.0 (the two drawings share the machine's four cores, and the scenery gives way to the film), and the page's own thread spends 35–46 ms a second on the film, against 7–13 ms for the 2D page's scenery. On a GPU, where the drawing is not the CPU's work, these limits do not apply.

## Reproduce locally

Requires Node.js with Playwright's Chromium, Python 3, FFmpeg with H.264/AAC, VP9/Opus, WebP and AV1 (libaom), and fontTools with brotli for the fonts. The film renderer draws with SwiftShader, so a render does not depend on the machine's GPU. No external CI or build service is used.

```sh
sh tools/make-fonts.sh
python3 tools/film/make-audio.py /tmp/offer-film
node tools/render-film.cjs stills /tmp/offer-film
node tools/render-film.cjs landscape /tmp/offer-film
node tools/render-film.cjs portrait /tmp/offer-film
node tools/render-film.cjs square /tmp/offer-film
node tools/render-film.cjs posters /tmp/offer-film
NODE_PATH="$(npm root -g)" node tools/test-site.cjs
NODE_PATH="$(npm root -g)" node tools/test-launch-help.cjs
```

`assets/film.js` owns the complete animation and the app story; `assets/gl.js` is the WebGL renderer and `assets/models.js` the 3D characters and props; `assets/scenery.js` draws the page's scenery (in a worker where the browser allows) and `scene.js` is its side on the page; `assets/app/` holds the app's ported views; `player.js` plays the film on the page; `tools/render-film.cjs` renders and audits it through `tools/film/render.html`, encodes the MP4s (and, from the portrait frames, the WebM) and writes the captions and posters; `tools/film/make-audio.py` verifies the recording and prepares the soundtrack and the website's `film-soundtrack.webm` and `.m4a`; `tools/make-fonts.sh` derives the Latin WOFF2 web fonts (Baloo 2 keeps its weight axis) and the renderer's static bold. `tools/test-site.cjs` plays the live film in Chromium. Earlier ending recipes and receipts remain as historical production evidence and are superseded by this full-film renderer.

The film uses invented offers and map locations, and says so on screen. It is an illustration of the idea, not a device-validation run, an earnings promise, or evidence about DoorDash's offer algorithm. Default behavior is shown; passing an offer leaves the choice to the user.

The site is static HTML, CSS and JavaScript with local fonts and media; a first visit loads about 290 KB compressed (590 KB as stored; the 2D page loaded about 110 KB). Of that, 140 KB is the film's muted loop (the app's ports, the film's script and Roboto), fetched after the first paint and not at all where the visitor asks for reduced motion or less data, and 32 KB is the scenery's 3D code, fetched by its worker after the first paint; the scripts and styles that hold up the first paint are 25 KB compressed against the 2D page's 35 KB. The soundtrack is fetched only when the film is played with sound. It does not embed tracking, account connections, payment processing, or an app build. The Android app's source is public in its own repository, https://github.com/Dillxn/dasher-offer-filter. The MIT License covers the website software; font and creative-media rights are separate in THIRD_PARTY_NOTICES.md.

Production receipts for the film, soundtrack and emblem are in `validation/` (see `SITE_VALIDATION.md`).

## Derived assets

Rebuild only when a master changes:

```sh
sh tools/make-fonts.sh                          # Latin WOFF2 web fonts and the renderer's static bold (fontTools, brotli)
node tools/render-icons.cjs                     # logo, touch icon and favicons from the 3D mascot (Playwright, FFmpeg)
node tools/render-film.cjs posters /tmp/offer-film   # the posters (JPEG, AVIF, WebP) from the film's closing frame
python3 tools/build-web-assets.py               # the reading pages' small signature image (Pillow)
```

The masters stay in `assets/`: the TTF fonts and `jesus-loves-you-emblem.png`; the home page's footer and the film use
`jesus-loves-you-emblem-560.png`, and `film-poster-wide.jpg` is the social share image.

## Licenses

The website's code is MIT (`LICENSE`). Fonts are SIL OFL 1.1 (Roboto, in the film's phone, Apache 2.0) and the film,
recording, emblem and posters keep their own rights; see `THIRD_PARTY_NOTICES.md`. Offer Filter is independent and not
affiliated with DoorDash.
