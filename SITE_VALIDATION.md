# Site validation record

Current record for the public-beta site (Cincinnati area), prepared 6 October 2026 on branch
`claude/nifty-fermi-su0qus`. Nothing here is deployed until the branch reaches `main`. Earlier entries (film, narration
and signature work of 3–4 October) are in this file's history: `git show 4e1aa5a:SITE_VALIDATION.md`.

## How to check

```sh
node tools/test-launch-help.cjs             # local Chromium; every outside request is faked or blocked
python3 tools/sync-release.py --check       # assets/release.json matches the app's release feed
python3 tools/build-legal.py --check        # terms/, privacy/, license/ match the app's texts
```

The test serves the site like GitHub Pages and checks, at 360 and 1366 px: no horizontal overflow, no text under
11 px, no console errors, every local link and asset (including CSS `url()`s, `og:image` and the sitemap), one
cache-buster, one poster and one small signature image per load with no video before Play, the download button
labelled from `release.json` (and working without JavaScript), the install steps and visible risk text, the legal
pages and links to them, the feedback form's messages (201, 429, 400, 413, 502, network failure, 15 s timeout,
offline, whitespace-only, the 4,000-character counter, the message kept on failure), dialog labels, keyboard use,
`#help`/`#feedback` addresses, Feedback returning to Help, Back closing a dialog, the captions switch, reduced motion,
and the landscape's 30 fps cap.

## Latest local results (6 October 2026)

- Test: all eight sections passed (0.4.72, version code 78, in `release.json`). The same test fails on the previous
  site at its first check (the stale `app-source` link).
- First load at 360 px, gzip as GitHub Pages serves it, video excluded: 1.43 MB before, 117 KB after. Under a
  1.6 Mbps / 150 ms throttle: largest contentful paint 3.4 s → 1.0 s, load 7.5 s → 0.9 s, headline font 4.8 s → 0.8 s,
  layout shift 0.051 → 0.
- Landscape: the reworked `scene.js` draws byte-identical frames to the previous one (day and night, 360 px at 2x and
  1366 px at 1x); it now runs at up to 30 fps and stops when hidden, off-screen or paused.
- Footer link contrast over the landscape, measured at glyph pixels (5th percentile) from 320 to 1920 px in both skies:
  at least 6.06:1 (previously as low as 1.36:1 where a tree or the car passed behind a link). Focus ring 10:1 or more
  on every surface; form borders 3.6:1 or more.
- The install page's QR code decodes to `https://offerfilter.org/install/`.

## Not verified here

- The live domain: HTTPS enforcement, the `www` certificate and redirects (owner settings in GitHub Pages).
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
