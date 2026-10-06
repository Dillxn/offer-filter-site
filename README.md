# Offer Filter website

The static site for https://offerfilter.org, served by GitHub Pages from this repository (custom domain in `CNAME`).
It has no build step, no cookies, no analytics and no third-party embeds. The app itself lives in
[Dillxn/dasher-offer-filter](https://github.com/Dillxn/dasher-offer-filter); its signed APK and update feed are served
from https://dash-offer-filter-build.onrender.com.

## Pages

| Path | What it is |
|---|---|
| `/` (`index.html`, `style.css`, `page.js`, `scene.js`, `assets/brand.js`) | Hero, the 21-second film, the animated landscape, and the Help, Feedback, About and Tip dialogs. Dialogs have addresses: `/#help`, `/#feedback`, `/#about`, `/#tip`. The sky starts at night when the system is in dark mode (nothing is stored). |
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
node tools/test-launch-help.cjs        # local Chromium checks and release gates; nothing is sent anywhere
```

Run `sync-release.py` after the new APK is live on Render (its static site does not deploy itself), so the button
never names a version Render does not serve. Both Python scripts use only the standard library and take `--check` to
report, without writing, whether the committed files are current.

Deploy (merge to `main`) only when the test ends without "NOT READY TO DEPLOY". Its release gates hold the site back
while:

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

## Derived assets

Rebuild only when a master changes (needs Pillow, fonttools and brotli):

```sh
python3 tools/build-web-assets.py   # WOFF2 font subsets, the signature images, WebP posters
npx svgo --precision 1 --multipass assets/favicon.svg   # after tools/render-favicon.cjs rewrites the favicon
```

The masters stay in `assets/`: the TTF fonts and `jesus-loves-you-emblem.png` are used by the film tools, and
`film-poster-wide.jpg` is the social share image.

## The film

The film is rendered from deterministic Canvas animation (`tools/film/film.js`, `tools/render-film.cjs`) with the
bundled fonts, in landscape 1920 × 1080, square 1080 × 1080 and portrait 1080 × 1920. Phones get the square edit; the
page never fetches video before Play. It uses invented offers: it illustrates the idea and is not a device test, an
earnings promise or a claim about DoorDash's offer algorithm. To reproduce (Node.js with `@napi-rs/canvas`, Python 3
and FFmpeg):

```sh
python3 tools/film/make-audio.py /tmp/offer-film
node tools/render-film.cjs stills /tmp/offer-film
node tools/render-film.cjs landscape /tmp/offer-film   # and: portrait, square
```

Production receipts for the film, soundtrack and emblem are in `validation/` (see `SITE_VALIDATION.md`).

## Licenses

The website's code is MIT (`LICENSE`). Fonts are SIL OFL 1.1 and the film, recording, emblem and posters keep their own
rights; see `THIRD_PARTY_NOTICES.md`. Offer Filter is independent and not affiliated with DoorDash.
