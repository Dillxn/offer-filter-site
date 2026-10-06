# Site validation record

Current record for the public-beta site (Cincinnati area), prepared 6 October 2026 on branch
`claude/nifty-fermi-su0qus`. Nothing here is deployed until the branch reaches `main`. Earlier entries (film, narration
and signature work of 3–4 October) are in this file's history: `git show 4e1aa5a:SITE_VALIDATION.md`.

## How to check

```sh
node tools/test-launch-help.cjs             # local Chromium; every outside request is faked or blocked
python3 tools/sync-release.py --check       # assets/release.json matches the app's release feed
python3 tools/build-legal.py --check        # terms/, privacy/, license/ match the app's texts, and none is a draft
```

The test serves the site like GitHub Pages and checks, at 360 and 1366 px: no horizontal overflow, no text under
11 px, no console errors, every local link and asset (including CSS `url()`s, `og:image` and the sitemap), one
cache-buster, one poster and one small signature image per load with no video before Play, the download button
labelled from `release.json` (and working without JavaScript), the install steps and visible risk text, the legal
pages and links to them, the feedback form's messages (201, 429, 400, 413, 502, network failure, 15 s timeout,
offline, whitespace-only, the 4,000-character counter, the message kept on failure), dialog labels, keyboard use,
`#help`/`#feedback` addresses, Feedback returning to Help, Back closing a dialog, the captions switch, the film's
controls (only while it plays), reduced motion, the landscape's 30 fps cap and its cached backdrop, dark mode (the home
page starts at night; the reading pages' text at 4.5:1 or more in both palettes), the iPhone path (no APK button, a
link to share), the 0.5.0 marks and pending note, and the private contact on every page.

It ends with release gates, which must pass before the site is deployed: no drafting notes in /terms/ or /privacy/,
the app's privacy text naming the site's contact (privacy@offerfilter.org), and, once `release.json` is 0.5.0 or
later, terms and privacy that describe Autopilot without the retired area-mode and 0.4.73 wording. A failed gate ends
the run with "NOT READY TO DEPLOY" and exit code 1, after every other check.

## Latest local results (6 October 2026, after the QA fixes)

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

- privacy@offerfilter.org: offerfilter.org had no MX record on 6 October 2026, so mail to it would bounce. The
  forward must exist (and get a test message) before the site goes live.
- The final app texts: the gates hold the deploy until they drop the drafting notes, name the contact and describe
  Autopilot.
- The Render page at https://dash-offer-filter-build.onrender.com/ (built by the app repository) still shows the
  GitHub-era setup text; it needs its own update and a manual Render deploy, after this site is live.
- A real install on Samsung and Pixel phones (Chrome's warning, Play Protect, Auto Blocker, restricted settings). The
  guide follows Android's documented prompts and the app's own labels; record the real screens on first install.
- A real feedback submission from https://offerfilter.org (the test never contacts the endpoint).
- The 0.5.0 features the install page describes (Autopilot and the rest) against the final 0.5.0 build.

## Production records kept in `validation/`

- Emblem master and its white treatment: `emblem-asset-20261003.json`, `emblem-white-asset-20261003.json`.
- The current film (21 s, illustrated, supplied narration): `film-open-ending-20261004.json` and
  `film-illustrated-20261004.json` / `-browser-`, with earlier renders `film-composition-*`, `film-charcoal-*`,
  `film-emblem-*`, `film-signature-*`, `film-small-white-signature-*`, `film-movie-credits-*`, `film-narration-free-*`.
- Soundtrack and narration QA: `movie-credits-audio-qa-*`, `movie-credits-levels-*`, `narration-free-*`.
- Live film and signature checks: `*-live-*.json` and the screenshots in `validation/*-live/` and `validation/endcard/`.

The two launch-help receipts of 4 October were removed: they recorded a Help dialog, draft-legal links and a public
issue form that no longer exist.
