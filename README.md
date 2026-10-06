# Offer Filter website

The static site for https://offerfilter.org, served by GitHub Pages from this repository (custom domain in `CNAME`).
It has no build step, no cookies, no analytics and no third-party embeds. The app itself lives in
[Dillxn/dasher-offer-filter](https://github.com/Dillxn/dasher-offer-filter); its signed APK and update feed are served
from https://dash-offer-filter-build.onrender.com.

## Pages

| Path | What it is |
|---|---|
| `/` (`index.html`, `style.css`, `page.js`, `scene.js`, `assets/brand.js`) | Hero, the 21-second film, the animated landscape, and the Help, Feedback, About and Tip dialogs. Dialogs have addresses: `/#help`, `/#feedback`, `/#about`, `/#tip`. |
| `/install/` (`install/index.html`, `install/install.js`) | The download button and the step-by-step setup guide. The button is labelled from `assets/release.json`. |
| `/privacy/`, `/terms/`, `/license/` | Generated from the app's `PRIVACY.md`, `TERMS.md` and `LICENSE`; Privacy adds a "This website" section. |
| `404.html`, `robots.txt`, `sitemap.xml` | Not-found page, crawler rules and sitemap. |

`doc.css` styles the reading pages (install, legal, 404).

## At every release

Run from this repository, with the app repository checked out beside it (`../dasher-offer-filter`, or pass
`--app-repo PATH`, or set `OFFER_FILTER_APP_REPO`):

```sh
python3 tools/sync-release.py      # assets/release.json from the app's release/latest.json (or --live: what Render serves)
python3 tools/build-legal.py       # terms/, privacy/, license/ from the app's TERMS.md, PRIVACY.md, LICENSE
node tools/test-launch-help.cjs    # local Chromium checks; nothing is sent anywhere
```

Run `sync-release.py` after the new APK is live on Render (its static site does not deploy itself), so the button
never names a version Render does not serve. Both Python scripts use only the standard library and take `--check` to
report, without writing, whether the committed files are current.

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
