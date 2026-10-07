# Site validation record

Current record for the public-beta site (Cincinnati area), prepared 6–7 October 2026 on branch
`claude/nifty-fermi-su0qus` and merged with `main`'s 3D site and film (their own record follows, under "The 3D site
and film"). Nothing here is deployed until the branch reaches `main`. Earlier entries (film, narration and
signature work of 3–4 October) are in this file's history: `git show 4e1aa5a:SITE_VALIDATION.md`.

## How to check

```sh
NODE_PATH="$(npm root -g)" node tools/test-launch-help.cjs   # local Chromium; every outside request is faked or blocked
NODE_PATH="$(npm root -g)" node tools/test-site.cjs          # the live film, its player and the 3D scenery
python3 tools/sync-release.py --check       # assets/release.json matches the app's release feed
python3 tools/build-legal.py --check        # terms/, privacy/, license/ match the app's texts, and none is a draft
```

`test-launch-help.cjs` serves the site like GitHub Pages and checks, at 360 and 1366 px (the dialogs by day and night,
Help also at 320, 400 and 520 px): no horizontal overflow, no text under 11 px, no console errors, every local link
and asset (including CSS `url()`s, `og:image` and the sitemap), one cache-buster in the pages, stylesheets and the
scripts that load the film and the scenery, one AVIF poster and one emblem request per load with no video or
soundtrack before Play, the download button labelled from `release.json` (and working without JavaScript), the
install steps and visible risk text (every risk statement pinned; the 0.5.0 guide's words present and the retired ones
absent, also in Help and About), the legal pages and links to them, the feedback form's messages (201, 429, 400, 413,
502, network failure, 15 s timeout, offline, whitespace-only, the 4,000-character counter, the message kept on
failure), dialog labels, keyboard use, `#help`/`#feedback` addresses, Feedback returning to Help, Back closing a
dialog, the film player's controls (off the poster and the muted loop, up while it plays with sound, a Captions
button, Replay at the end), reduced motion (no scenery or film frames, nothing of the film loaded), the muted loop's
30 fps cap and Pause motion, dark mode (with the sky on System, a dark device gets the night sky and the theme colour
follows; the reading pages' text at 4.5:1 or more in both palettes), the iPhone path (no APK button, a link to share),
the 0.5.0 marks and pending note, and the private contact on every page. Chromium draws WebGL with SwiftShader, as
in `test-site.cjs`, which covers the live film, its player and the 3D scenery in depth.

It ends with release gates, which must pass before the site is deployed: no drafting notes in /terms/ or /privacy/,
the app's privacy text naming the site's contact (privacy@offerfilter.org), and, once `release.json` is 0.5.0 or
later, terms and privacy that describe Autopilot without the retired area-mode and 0.4.73 wording. A failed gate ends
the run with "NOT READY TO DEPLOY" and exit code 1, after every other check.

## Merged with main's 3D site and film (7 October 2026)

`main` at `320b5ad` (what offerfilter.org serves: the page and film in 3D, the live player, the worker-drawn sky, the
3D posters, fonts and icons) is merged into this branch. Main's design is kept whole and the beta's content sits in it:
the beta title and share tags, the "Free public beta · Cincinnati area" eyebrow, Download for Android as a link to
/install/, the Help dialog's 0.5.0 setup steps and Samsung's "App was denied access" wording, the About and anonymous
Feedback dialogs, the Privacy, Terms and License links to this site's own pages (View on GitHub and "Source code (MIT)"
open the app's repository), the independence line and the private contact. The merge commit lists each conflict and
its resolution. After it:

- The reading pages use the 3D mascot, the PNG favicons and main's WOFF2 fonts; this branch's font copies and
  `favicon.svg` are gone. One cache-buster, `20261007-beta`, in the pages, stylesheets and scripts.
- Privacy's "This website" section said the site stores nothing in the browser. Main's page keeps the sky and captions
  choices and a note on software WebGL in local storage; the section now says so (`build-legal.py`).
- The footer emblem was requested twice, as the image (no-cors) and as the CSS mask (cors), on main too;
  `crossorigin="anonymous"` on the image makes one request serve both.
- `test-launch-help.cjs` holds the same checks against the 3D page (see "How to check"); main's version of it, which
  this branch had rewritten, checked Help copy and an issue form that no longer exist.

Local results (Chromium with SwiftShader WebGL, `release.json` at 0.4.72, version code 78):

- `test-launch-help.cjs`, run twice: all nine sections pass. Release gates: /terms/ and /privacy/ carry no drafting
  notes, and the app's privacy text names privacy@offerfilter.org; the Autopilot-wording gate waits for `release.json`
  at 0.5.0. No "NOT READY TO DEPLOY". Reduced motion: 0 scenery and 0 film frames in 2 s, nothing of the film loaded;
  running: 6–13 scenery and 9–18 muted-loop frames in 2 s; Pause motion: 0. Reading pages at least 4.94:1 by day and
  6.86:1 by night.
- `test-site.cjs` (main's), unchanged: passes at 1280 and 400 px by day and night (the sky in a worker, once on the
  page's thread), the film within 5–7 ms of its soundtrack, all eight app modules, and the reduced-motion run.
- `build-legal.py --check`: the three pages are current with `../dasher-offer-filter`; `sync-release.py --check`:
  `assets/release.json` is current.
- Screenshots of /, /install/ and /terms/ at 390 × 844 and 1280 × 800 (served by `python3 -m http.server`): the 3D
  scenery and the film's muted loop draw, the beta's words and links show, nothing overlaps or clips, and no page
  scrolls sideways. The home page fits 1280 × 800 exactly, its links and the emblem sharing the footer's row; at 390 px
  the footer's rows stack, centred, above the emblem. By night the footer's links and line stay legible on the halo.

## Before the merge: the 0.5.0 guide and the final legal texts (7 October 2026)

- Legal pages: built with `python3 tools/build-legal.py --app-repo <app worktree wip/wp8-legal>` from the app's
  final TERMS.md and PRIVACY.md ("Beta terms, effective 7 October 2026 · for Offer Filter 0.5.0"; no drafting
  notes; privacy@offerfilter.org named; Ohio law; Autopilot described). `--check` against that worktree reports all
  three pages current. Run without `--app-repo`, it still refuses while the app checkout beside this repository
  carries the old drafts: build from the app branch that holds the final texts.
- Install guide, Help and About describe 0.5.0: three minimums (minimum pay, per mile, per hour) plus max stops, with
  no per-item or per-stop minimum; Autopilot's "What matters more?" (keep a top tier, 70%, suggested and
  preselected; keep a tier, 50%; pay first), changed by a long press, its goal a best effort; the homepage's
  numbered setup steps (Allow restricted settings first, then Accessibility, notification access, alerts, Allow
  updates) in place of Settings' "Updates can't install"; Peek waiting for Dasher's offer and checking one that
  dinged while the phone was locked; the screen held during a dash; paused meaning Offer Filter is not reading
  Dasher; and the four layouts (three for driving, Offer Filter's own split for planning). 17 steps (a Peek step is
  new). The restricted-settings section keeps the stock and Samsung ("App was denied access") wording.
- Test: all nine sections pass (0.4.72, version code 78, in `release.json`). Release gates: no drafting notes in
  /terms/ or /privacy/, and the app's privacy text names the site's contact: both pass. The Autopilot-wording gate
  is checked once `release.json` says 0.5.0 (`sync-release.py --live`, at the real release only). On a scratch
  copy with `release.json` set to 0.5.0 (code 80), every check and all seven gates pass: both texts describe
  Autopilot and neither says "compensating" or "0.4.73".
- `sync-release.py --check`: `assets/release.json` is current (0.4.72, the app's published feed).

## Earlier local results (6 October 2026, after the QA fixes)

The 2D landscape, the `<video>` film and the first-load sizes below are from before the merge with main's 3D page.

- Test: all nine sections pass (0.4.72, version code 78, in `release.json`). Three release gates fail, as they
  should: the app's TERMS.md and PRIVACY.md still open with "Draft of 6 October 2026. Not legal advice; have a lawyer
  review before public release", PRIVACY.md says the private contact is "not yet configured", and it doesn't name
  privacy@offerfilter.org. The legal pages in this branch are a preview (`build-legal.py --allow-draft`).
- The gates were checked on a scratch copy with stand-in final texts (an effective date instead of the note, the
  contact named): all pass. With `release.json` set to 0.5.0, the Autopilot gate fails until the texts describe
  Autopilot and drop "compensating" and "0.4.73", then passes.
- Landscape: the still backdrop (sky, glow, ribbon, stars) is now drawn once per size and sky and copied each frame.
  Frames are byte-identical to the previous `scene.js` in both skies at 360 px (3x), 412 px (2.625x), 768 px (2x),
  1366 px (1x) and 1920 px (1x); at 1366 px and 1.25x, night differs only on the last, partly covered device-pixel
  row (1,230 channel values, at most 5/255). Main-thread time while it runs (headless, software raster, 360 px at
  3x): 1,196–1,320 ms per 3 s before, 491–533 ms after; paused 2–4 ms. The earlier note that it stopped "off-screen"
  was wrong: the canvas is the page's background, so it is always on screen while the page is; that observer is gone.
- First load at 360 px after the fixes: 121.9 KB, 11 requests, no video. Under 1.6 Mbps / 150 ms with 4x CPU
  slowdown: first and largest paint 1.02 s, layout shift 0. /install/: 67 KB, largest paint 0.67 s.
- The home page's new "independent" line over the landscape, glyph pixels (5th percentile), 320 to 1920 px: at least
  7.33:1 by day and 12.07:1 by night. Reading pages: text at least 4.94:1 in the light palette and 6.86:1 in the dark.
- Earlier in this branch: first load at 360 px, gzip as GitHub Pages serves it, video excluded, went from 1.43 MB to
  117 KB, and under 1.6 Mbps / 150 ms the largest contentful paint from 3.4 s to 1.0 s and layout shift from 0.051
  to 0.
- Footer link contrast over the landscape, measured at glyph pixels (5th percentile) from 320 to 1920 px in both skies:
  at least 6.06:1 (previously as low as 1.36:1 where a tree or the car passed behind a link). Focus ring 10:1 or more
  on every surface; form borders 3.6:1 or more.
- The install page's QR code decodes to `https://offerfilter.org/install/`.
- The live domain (HEAD requests only, 6 October 2026): http://offerfilter.org, http:// and https://www, and the
  github.io address all answer 301 to https://offerfilter.org/, which answers 200.

## Not verified here

- privacy@offerfilter.org: offerfilter.org still had no MX record on 7 October 2026 (public DNS answered with the
  zone's SOA only), so mail to it would bounce. The forward must exist (and get a test message) before the site goes
  live; the test's gates only check that the texts name it.
- The legal pages carry the texts of the app checkout beside this repository (branch `claude/nifty-fermi-su0qus` at
  `c499f4e`, "Beta terms, effective 7 October 2026 · for Offer Filter 0.5.0"). If TERMS.md or PRIVACY.md change again
  before 0.5.0 ships, rebuild them (`build-legal.py --check` reports drift).
- `assets/brand.js` (the 2D art, with the retired four-spoke constellation) is no longer loaded by any page; only the
  retired `tools/render-closing-scene.cjs` requires it.
- The merged 3D page and live film on real phones and on a GPU: every check here ran in local Chromium with SwiftShader.
- Main's player: pressed Play with the film already at its very end (21.0 s), the film can finish before its
  soundtrack's own "play" event arrives, and that late event starts it over, paused at 0:00 with its controls up
  (seen in local Chromium; main's code, unchanged here). Both tests play from 20.3 s instead.
- The Render page at https://dash-offer-filter-build.onrender.com/ (built by the app repository) still shows the
  GitHub-era setup text; it needs its own update and a manual Render deploy, after this site is live.
- A real install on Samsung and Pixel phones (Chrome's warning, Play Protect, Auto Blocker, restricted settings). The
  guide follows Android's documented prompts and the app's own labels; record the real screens on first install.
- A real feedback submission from https://offerfilter.org (the test never contacts the endpoint).
- The 0.5.0 features the install page and Help describe (the numbered setup steps, Autopilot's question, Peek
  after an unlock, the screen held during a dash, paused, Back to map, the driving strip) against the final 0.5.0
  build on a real phone. The words follow the app's 0.5.0 source and README; none of it has been seen on a phone.

## Production records kept in `validation/`

- Emblem master and its white treatment: `emblem-asset-20261003.json`, `emblem-white-asset-20261003.json`.
- The current film (21 s, illustrated, supplied narration): `film-open-ending-20261004.json` and
  `film-illustrated-20261004.json` / `-browser-`, with earlier renders `film-composition-*`, `film-charcoal-*`,
  `film-emblem-*`, `film-signature-*`, `film-small-white-signature-*`, `film-movie-credits-*`, `film-narration-free-*`.
- Soundtrack and narration QA: `movie-credits-audio-qa-*`, `movie-credits-levels-*`, `narration-free-*`.
- Live film and signature checks: `*-live-*.json` and the screenshots in `validation/*-live/` and `validation/endcard/`.
- The live film and the 3D site (6–7 October, from `main`): `live-film-20261006.json`, `in-app-film-20261006.json`,
  `3d-worker-20261007.json` and `ride-loop-20261007.json`.

The two launch-help receipts of 4 October were removed: they recorded a Help dialog, draft-legal links and a public
issue form that no longer exist.

## The 3D site and film (from `main`, 6–7 October 2026)

### No rim around the film — October 7, 2026

Prepared locally on branch `claude/festive-bohr-kpz6zk` from live main `2480e19`, at the user's note on the live page ("can we remove any kind of border from the video?", with a crop of the film's left edge at night). The film has no CSS border; two things drew one. A light rim at its rounded corners was the poster picture still standing behind the drawn film and showing through the corners' soft edge: it now steps out 0.9 s after the film is first drawn (the film's fade-in takes 0.8 s), and from behind the MP4 where that plays instead. A dark line down two of its sides was the film's letterbox: the stage's 16:9 box rounds to a canvas a fraction of a pixel off 16:9 (591 × 332 for 590.8 × 332.3 css px on a 1365 px window), so the film was fitted inside it with a 0.4 px bar at each side, filled dark navy. Where the canvas is within 2 device pixels of the film's shape, the film now covers it edge to edge (at most a pixel of the picture is cropped); only a real letterbox (full screen on a screen of another shape) keeps its bars. The soft shadow under the film stays.

Measured in local Chromium at night, across the film's left edge at mid-height: on a 1365 × 689 window the edge pixel was (23, 37, 59), darker than both the page beside it (30, 53, 71) and the film (30, 45, 73); the page now meets the film with no line between, and the rim at the corner is gone. The same holds at 1440 × 900 at 2× pixels, 1280 × 720 at 1.5×, 1366 × 768 at 1.25×, 820 × 1180 at 2× and 400 × 860 at 3× (the square film on a phone).

`tools/test-site.cjs` now also checks that the poster stands in before the film is drawn and is gone from behind it after; it passes in day and night at 1280 and 400 px and the reduced-motion run (the film within 3–4 ms of its soundtrack), and `tools/test-launch-help.cjs` passes.

Published as main `188db6a`. Live check: all 26 checked files match the committed bytes, at version `20261007-3d6`. Chromium through the session proxy on https://offerfilter.org at night, across the film's left edge at mid-height, on a 1365 × 689 window (canvas 591 × 332), at 1440 × 900 at 2× and at 400 × 860 at 3×: the page meets the film with no line between, and the top-left corner shows no rim. This is browser evidence, not a physical-phone claim.

### The app's own repository behind View on GitHub — October 7, 2026

At the user's question about this repository's `app-source` branch: that branch is a reviewed snapshot of the app's source at 0.4.68, published on October 4 while the app's repository was private, so that the site's View on GitHub button and its MIT License, privacy notice and terms links had public pages to open. `Dillxn/dasher-offer-filter` is public now (at 0.4.74), and its `PRIVACY.md` and `TERMS.md` are the October 6 drafts, newer than the snapshot's of October 3 and 4; its `LICENSE` is the same MIT License. The button and the three links now open the app's own repository on `main`; the download dialog's "Website source" still opens this one. `THIRD_PARTY_NOTICES.md`, the README and the ports' shared header name the app's repository instead of the branch. The branch itself stayed at first: the APK download page, made by the app repository's `tools/mirror_repo_feed.py`, still linked its license, privacy and terms there (below).

The new targets answer publicly (raw.githubusercontent.com returns 200 for the app's `LICENSE`, `PRIVACY.md` and `TERMS.md`; github.com pages for that repository are refused to this session by its proxy, not by GitHub). `tools/test-site.cjs` now checks that View on GitHub opens `https://github.com/Dillxn/dasher-offer-filter` and passes in day and night at 1280 and 400 px and the reduced-motion run (film within 3–5 ms of its soundtrack); `tools/test-launch-help.cjs` passes.

Published as main `ccaeb07`. Live check: all 26 checked files and the ports' `base.js` match the committed bytes; the live page's View on GitHub, MIT License, privacy notice and terms links open `Dillxn/dasher-offer-filter`, and nothing on the page names `app-source`. Chromium through the session proxy at 1365 and 400 px: version `20261007-3d5`, the scenery drawn by its worker, the film looping muted with no soundtrack or MP4 fetched while the scenery rides on, the footer's row and the tip icons, the film played with sound within 7 ms of its soundtrack, no page errors and no horizontal overflow at either width.

The APK download page followed, at the user's go-ahead ("yes please fix the repo links"): the app repository's `tools/mirror_repo_feed.py` and its test now link that repository's own `TERMS.md`, `PRIVACY.md` and `LICENSE` on `main` (app repository `004c647`, on top of `44952a2`; `tools/test_mirror_onboarding.py` passes). Render does not deploy that page on a push, so the deploy was started through Render's API (`dep-db2sm5u7bikc73ars8d0`, live in 33 s). Before it, a build of the page from that commit, run here against the live feed, differed from the live page only in the three links; after it, the live page is byte for byte that build, and its `latest.json`, `verification.json` and APK (0.4.72, SHA-256 `8d373be1…`) are unchanged. Nothing current in either repository or on either page names `app-source` now (only the dated records do). Deleting the branch itself was refused to this session by its git proxy (HTTP 403), so it is left for the user to delete on GitHub; its one commit is `ebba04f28f617b8512b6128e92f555c6a65cd8cd`, and the app's 0.4.68 source it copied is in the app repository's own history (its 98 Java sources match that repository's 0.4.68 publish, `66b27eb`, byte for byte).

### The road whole, the sun in its ring, the ride beside the film — October 7, 2026

Prepared locally on branch `claude/festive-bohr-kpz6zk` from live main `a7fce85`, at the user's notes on the live page, and published as main `27383c5`. The road looked broken: the ground's finest bumps (0.12 m, finer than its mesh can follow) rose through the road where the camera sees it nearly side on; they are now kept off the near ground and come in past the road, and the road runs whole by day and at night at laptop and phone sizes. The sun or moon sat below its button's centre: the scenery measured the button while the page's entrance animation still had it moved down, and kept that place; it now measures the layout, which the animation does not move (with the header's animation slowed to 8 s, the sun's centre fell 16.8 px low before and sits on the button's centre after). Playing or pausing the film no longer starts or stops the scenery, except where WebGL is drawn by the CPU: there the scenery rests while the film plays with sound (the user's either-or), draws at 60% of the page's pixels, and takes ten frames a second while the film moves.

Measured in local Chromium with software rendering only (SwiftShader), against the 2D page (`fa55bdb`): playing the film with sound, 7.4 against 5.2 frames a second at 445 against 560 ms of CPU per frame on a desktop stage and 6.2 against 5.5 at 508 against 597 ms on a phone (with the scenery riding on beside it instead, the film fell to 2.6–2.7 frames a second here, the reason for the CPU's either-or). With the film looping muted beside it, the riding scenery draws 3.6–4.6 frames a second against the 2D page's scenery on its own at 4.5–6.0, and the page's own thread spends 35–46 ms a second on the film against 7–13 ms on the 2D page's scenery. These are CPU-only browser measurements; on a GPU the scenery and the film both keep moving.

`tools/test-site.cjs` passes in day and night at 1280 and 400 px and the reduced-motion run, now also checking that pausing the film leaves the scenery riding and that the scenery rests during sound playback only where WebGL is drawn by the CPU; `tools/test-launch-help.cjs` passes.

Live check of `27383c5`: all 26 checked files match the committed bytes. Chromium through the session proxy on https://offerfilter.org: version `20261007-3d5`, the scenery drawn by its worker, the film looping muted with no soundtrack or MP4 fetched while the scenery rides on, the footer's row and the tip icons, the film played with sound within 11 ms of its soundtrack at 1365 px, no page errors and no horizontal overflow. With the header's entrance slowed to 8 s, the sun's disc stands within half a pixel of the sky button's centre (its edges at 26–54 and 26–53 px in an 80 px crop centred on the button), and the road runs whole across a 1366 px screen. The scenery against the film, live, by the mean change of the land and road over 1.5 s (0–255 levels): on this CPU-drawn browser it rides during the muted loop (5.7), rests while the film plays with sound (0), rides when the film is paused (11.1) and rests again on resuming (0); with the page told it has a graphics card, it rides throughout (34.4 looping, 10.1 with sound, 11.3 paused, 8.2 resumed). One 400 px load got the stylesheet back as `text/plain` on its way through the proxy and drew unstyled; five direct requests (19,700 bytes each) and four more 400 px loads got it from GitHub as `text/css`, the loads with no errors and no overflow. This is browser evidence, not a physical-phone claim.

### The ride, the film on a muted loop, the ending turned round — October 7, 2026

Prepared locally on branch `claude/festive-bohr-kpz6zk` from live main `782b3d2` (the sky in a worker, below), at the user's notes, and published as main `f408c74`. Live check: all 26 checked files (the page, its scripts and the scenery worker, the renderer, models and film, the posters, the four films, the captions and the docs) match the committed bytes. Chromium through the session proxy on https://offerfilter.org at 1365 and 400 px: version `20261007-3d4`, the scenery drawn by its worker, the film looping muted with no soundtrack or MP4 fetched while the scenery rides on, the footer's row and the tip icons, the film played with sound within 4 ms of its soundtrack, no page errors and no horizontal overflow. This is browser evidence, not a physical-phone claim. The page's camera now rides beside the car instead of swaying with the pointer: the car holds its place a third of the way across the page, turning with a road that winds nearer and farther, its wheels rolling the ground it covers, while the dashes and near trees stream past and the town and hills drift by. The land, the road and its trees, and the town repeat seamlessly along the way (each hill ridge on a longer period of its own), so the ride needs no rebuilding as it goes; the camera stays at the origin and the world moves past it, so its coordinates stay small however long the page is open. The film now plays on page load, muted, round and round, at most 30 frames a second, on the page's own clock (no soundtrack is fetched for it); "Play with sound" starts it over with the narration, and at its end the closing frame holds three seconds before the loop resumes. The loop rests while motion is paused or a dialog is open and does not start where the visitor asks for reduced motion or less data. In landscape, the film's ending puts the mascot at the left and its type column close beside it on the right, the stack tightened and the pair centred; the mascot grows in once the last shot's words have gone. The tip dialog's Cash App and Venmo buttons carry those services' marks (CC0 shapes from Simple Icons; see THIRD_PARTY_NOTICES.md). A corner badge for the footer's emblem was tried and, at the user's word, left out: the footer is as it was.

The landscape MP4 and the wide posters are rendered again for the new ending: 630 H.264 frames, 21.000 s of AAC and the caption track in 5,073,241 bytes (the 2D film's was 5,477,669), every frame passing the text-bounds audit; the wide poster is now 13,590 bytes as AVIF, 35,048 as WebP and 212,232 as JPEG. The square and portrait films and posters are unchanged.

Measured in local Chromium with software rendering only (SwiftShader), the 2D page being `fa55bdb`: seven fresh visits to each page in turn, the 3D page shows its words and poster at 472 against 624 ms on a 1365 × 689 window and 456 against 576 ms on a phone. Starting the muted loop makes the film's WebGL context on the page's thread once, after the first paint, a long task of about 0.3 s here (0.1 s on the phone-sized page). On a throttled connection (1.6 Mbit/s, 150 ms round trips) the two pages show their words within about 0.15 s of each other, the order varying from run to run (the same build measured 1.17 s and 1.37 s in two sessions). With the film looping beside it, the riding scenery draws 5.0–6.0 frames a second at 538–622 ms of CPU per frame (the whole page's), as the 2D page's scenery did on its own (5.1–6.0 at 635–743 ms), and the page's own thread spends 26–31 ms a second on the film against the 2D page's 7–11 on its scenery. Playing the film with sound, 7.1 against 5.6 frames a second at 458 against 533 ms of CPU per frame on a desktop stage and 6.6 against 5.7 at 488 against 570 ms on a phone. A first visit fetches about 291 KB compressed against 110 KB: 140 KB of it is the film's loop (the app's ports, the film's script and Roboto), fetched after the first paint and not where reduced motion or less data is asked for. These are CPU-only browser measurements, not phone or GPU measurements.

`tools/test-site.cjs` now checks, in day and night at 1280 and 400 px, that the film loops muted after the page loads without fetching its soundtrack while the scenery rides on, that the loop goes round at its end, that "Play with sound" starts it over in time with the soundtrack (within 9 ms), and, in a further run, that it stays still with nothing of it loaded where reduced motion is asked for; it passes with the rest of its checks (the footer's row, the tip icons, the sky in a worker and on the page's thread, app screens, captions, keyboard pause, dialogs, the ending and replay, no overflow, no page errors). `tools/test-launch-help.cjs` passes.

Structured local evidence: `validation/ride-loop-20261007.json`.

### The sky in a worker, words from the first frame, smaller films — October 7, 2026

Prepared locally on branch `claude/festive-bohr-kpz6zk` from live main `e43d8bb5dd8272b48dd1e9213c44225a0514adc8` (the 3D site and film below). Measuring the published 3D page again before its MP4s were re-rendered showed that the entry below understated its loading cost: in local Chromium with software rendering, it showed its words at 1.1 s against 0.56 s for the 2D page, its largest paint came at 1.9 s, and making the sky's WebGL context blocked the page's thread for about half a second. Two causes: the entrance animation started the words fully transparent (Chromium counts no paint of invisible words), and the WebGL context, 0.4–0.6 s to make under SwiftShader, was made on the page's thread. The entry below's 0.13 s figure was measured incorrectly and is superseded here.

Changes: the scenery (`assets/scenery.js`, formerly the body of `scene.js`) runs in a worker with an OffscreenCanvas wherever the browser can hand a canvas to one, so making its context, building it and drawing it no longer take the page's thread; elsewhere (or if the worker cannot make a WebGL context) the same code runs on the page's thread. `scene.js` now only measures the page and passes on the sky, pausing and visibility, and the scenery starts after the first contentful paint. The renderer and models no longer load on the page at all until the film is wanted. The entrance animation starts the words at 40% opacity. The stage's poster is an AVIF (14 KB, 13 KB square; the WebP remains for browsers whose `image-set()` cannot choose by type), preloaded at high priority from the page's head. The MP4s are encoded from the 3D frames with x264 veryslow at CRF 20 and the portrait WebM, now from the same frames, with VP9 at CRF 30: landscape 5,105,388 bytes, portrait 5,270,463, square 3,894,129 and WebM 5,100,016, each 7–11% smaller than its 2D predecessor, at 50.2, 49.9, 49.2 and 48.2 dB PSNR (SSIM 0.995–0.996) against the frames they were made from. All 630 frames of each format pass the text-bounds audit; the posters and captions are byte-identical to the previous release.

Measured in local Chromium with software rendering only, the 2D page being live main before the 3D change (`fa55bdb5bd675e359b104157f3a6dec6b3642822`): five fresh visits each, the 3D page now shows its words at 448 against 564 ms on a 1365 × 689 window and 432 against 580 ms on a phone (390 × 844 at 2×), its largest paint at the same moment, with no long task. On a throttled connection (1.6 Mbit/s down, 150 ms round trips) the words and the poster show together at 1,172 against 1,184 ms and 1,160 against 1,196 ms. The scenery draws 12.4–13.4 frames a second at 285–307 ms of CPU each in its worker, against the 2D page's 5.2–5.8 at 647–706 ms, and the page's own thread spends 0–1 ms a second on it against 8–10 (on the page's thread, as without OffscreenCanvas, 9.0–10.2 frames a second at 369–428 ms). Playing the film, 7.5 against 5.4 frames a second at 428 against 558 ms of CPU per frame on a desktop stage and 6.4 against 5.4 at 504 against 602 ms on a phone. A first visit fetches 149 KB compressed against 110 KB (the scenery's 32 KB of 3D code is fetched by its worker after the first paint), and the scripts and styles that hold up the first paint are 23 KB against 35 KB. These are CPU-only browser measurements, not phone or GPU measurements.

`tools/test-site.cjs` now checks that the sky is drawn by a worker with no WebGL context and no renderer script on the page at load, and in one of its four runs draws the sky on the page's thread as a browser without OffscreenCanvas would. It passes in day and night at 1280 and 400 px: the AVIF poster, the page fitting the screen, the hero's buttons and the footer's row, the sky cycle, playback within 6 ms of the soundtrack with the renderer loaded on demand, all eight app modules, captions, keyboard pause, a dialog pausing the film, the ending and replay, no overflow and no page errors. `tools/test-launch-help.cjs` passes.

Structured local evidence: `validation/3d-worker-20261007.json`.

### The site and film in 3D — October 7, 2026

Prepared locally on branch `claude/festive-bohr-kpz6zk` and merged with live main `fa55bdb5bd675e359b104157f3a6dec6b3642822` (the emblem's link). The page's scenery, its logo and icons, and the film's art are drawn in real-time 3D by a small hand-written WebGL renderer (`assets/gl.js`) and models built from the 2D art's measures (`assets/models.js`); the film's words, emblem and the app's screen stay on a 2D canvas over the 3D art. The sky button now works as the app's sun button does (Day, Night, System, Auto by the local clock, with the A/S badge and a note), its sun or moon drawn in the 3D sky behind it with clouds by day and stars by night; the sky turns in a short sunset or sunrise and the page's colors ease along. The hero's second action is a "View on GitHub" button; both actions carry icons; "Save film" is gone. The footer keeps its links at the left and the emblem at the right, so the page fits laptop screens from 1024 × 640 to 1920 × 937 without scrolling (phones stack the emblem centred under the links).

Measured in local Chromium with software rendering only (SwiftShader, no GPU), against live main's 2D page: playing the film, 9.3 against 6.3 frames a second at 347 against 461 ms of CPU per frame on a desktop stage and 8.2 against 6.8 at 384 against 474 ms on a phone-sized square. The film's renderer and script load only when a visitor reaches for Play (the poster is a 36 KB WebP until then); the scene's WebGL setup waits until the page has loaded and is idle, so first contentful paint stays within about 0.13 s of the 2D page here, and shaders link without blocking where the browser can report it. A first visit is about 170 KB compressed against about 110 KB before (the poster picture, the 3D logo and about 16 KB more script). These are CPU-only browser measurements, not phone or GPU measurements.

`tools/test-site.cjs` (now run with WebGL) passes in day and night at 1280 and 400 px: the page fits the screen, the hero's buttons and the footer's row, the sky cycle and its badges, one WebGL context at load and none for the film until it is wanted, playback within 5 ms of the soundtrack, all eight app modules, captions, keyboard pause, a dialog pausing the film, the ending and replay, no overflow and no page errors. `tools/test-launch-help.cjs` passes. The posters are the 3D film's closing frame, rendered by `tools/render-film.cjs` through Chromium; the MP4s, which the page plays only without WebGL or JavaScript, are re-rendered separately.

### In-app footage — October 6, 2026

Prepared locally on branch `claude/festive-bohr-kpz6zk` from live main `a6d32d249e68242979ba54e4e17e56cadaf1e9b3` and published as main `fd8ce60d74ea495e44e02ef96331366b75d8c0de` (Pages run `37532310515`). Live check: all 37 checked files (pages, scripts, the eight app modules, Roboto, the films and posters, the docs) match the committed bytes. Chromium through the session proxy played the film on https://offerfilter.org at 1280 and 400 px: the eight app modules loaded at version `20261006-app`, the picture stayed within 8 ms of the soundtrack, the phone's screens drew at 4.4, 10.4, 12.5 and 14.9 s, and there were no page errors and no horizontal overflow. This is browser evidence, not a physical-phone or subjective-listening claim.

From "Set your minimums" to the close, the film now holds the Offer Filter app itself on a phone. The app's main page is redrawn from its own source, not recorded: its Java `onDraw` code (the constellation of minimums, the mascot with its counts and offer play-out, the skyline of recent offers, the area map, the scenery and header buttons, the offer ticket with its stamp in the bottom sheet) is ported to canvas in `assets/app/`, laid out as `MainActivity` lays it out on a 412 × 915 dp phone, in the app's palette and Roboto type. The port is from the MIT-licensed `app-source` branch, version 0.4.68 (`ebba04f`). The phone frame, status bar, heads-up card chrome and touch indicator are generic Android. On the beat, a finger drags the per-mile minimum from $1.50 to $1.85, three low offers are declined (badges on beats 11, 13 and 15, counts and skyline following), a good offer passes with its alert (beat 18), its building is tapped and its ticket opens, and the app turns to its day palette at dawn over the area map. All 13 offers, their times, the store and the area are invented, and the film says so on screen ("App screens drawn from its source · invented offers").

The ports load only when a visitor reaches for Play: eight files, 268 KB (89 KB compressed), plus Roboto. Views the camera has cropped are skipped (frames with and without skipping agree at 77.8 dB PSNR or better across 150 frames in three formats). The constellation's veils are cut from one offscreen layer, as Android's `saveLayer` does, instead of redrawing it once per fade zone, and the phone's large shadow is blurred once into a bitmap. In Chromium with software rendering only, a frame now takes about 15 ms while the phone is on screen at the desktop stage (about 6 ms before), of which under 4 ms is script; this is not a GPU or phone measurement.

All 630 frames of each format pass the text-bounds audit with no violations. Chromium canvas frames and the landscape MP4 agree at 33.4–37.2 dB PSNR. The MP4s keep 630 H.264 frames, 21.000 s of AAC and the English caption track; posters and captions are byte-identical to the previous release. `tools/test-site.cjs` now also checks that playing loads all eight app modules and that the phone's page is drawn only between its entrance and the close; it passes in day and night at 1280 and 400 px with playback within 11 ms of the soundtrack and no page errors. `tools/test-launch-help.cjs` passes.

Structured local evidence: `validation/in-app-film-20261006.json`.

### Live canvas film, new narration take and site touch-ups — October 6, 2026

Prepared locally on branch `claude/festive-bohr-kpz6zk` from main `4e1aa5afd3bd52a61d1a82d97f89daa5c6bcdb43`. This is a local candidate, not a live publication; live-domain checks follow deployment.

The homepage now draws the film live in a canvas from `assets/film.js`, clocked by the soundtrack, with custom play/pause, seek, captions, mute and full-screen controls. The MP4s render the same frames and remain the "Save film" download, the fallback when the film script or canvas is unavailable, and the `<noscript>` video. Playing the film fetches a 284 KB Opus soundtrack (338 KB AAC fallback) instead of a 3.8 MB video. A first visit now loads 193 KB instead of 2.6 MB: Latin WOFF2 fonts replace 737 KB of TTFs, a 25 KB emblem replaces the 818 KB original on the page, and the poster is the film's own closing frame.

The supplied 20.4-second take of “Your Time Matters” replaces the earlier recording and is kept unchanged in `assets/your-time-matters.mp3`. The soundtrack applies a uniform 1 dB trim for lossy headroom (true peak −0.7 dBTP Opus, −0.8 dBTP AAC) and fades only the final 0.3 seconds; nothing is looped. Narration word times come from faster-whisper medium.en, cross-checked with small.en and base.en. Shots are cut on the take's 105.15 BPM beat grid just before each line, and headings, declines, the dawn, "Free", "& open source" and the closing sparkles land on their words or beats. The film also gains a continuous backdrop through every cut, a hazy ticket rain with depth, stamps that travel with declined tickets instead of covering their text, a clearer history legend, solid skylines behind the hills, and a quieter ending without the skyline.

The renderer previously drew the variable Baloo 2 at its default regular weight, though the film asks for bold and browsers draw bold. It now uses a static bold instance; live canvas frames and MP4 frames agree at 33.6–38.1 dB PSNR, up from about 21 dB. All 630 frames of each format pass the text-bounds audit with no violations. Every MP4 has 630 H.264 frames, 21.000 s of AAC and an English caption track, and decodes fully without errors or black segments; the portrait WebM decodes fully.

Local Chromium (`tools/test-site.cjs`) checked the drawn poster, the per-screen download, playback in sync with the soundtrack (within 8 ms), keyboard pause, seeking, captions, a dialog pausing the film, the ending and replay, in day and night at 1280 and 400 px, with no page errors. `tools/test-launch-help.cjs` was updated to the current accountless-feedback help copy and passes all eight combinations. Screenshots at 1440, 1024, 820, 390 and 360 px in both skies show no horizontal overflow and footer links clear of the road and car. Frame cost was measured with software rendering only; it is not a phone, GPU or subjective-listening claim.

Structured local evidence: `validation/live-film-20261006.json`.
