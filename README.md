# Offer Filter website

The illustrated Offer Filter landing page and 21-second animated ad, published as finished static assets on the existing GitHub Pages site at https://offerfilter.org.

The Android download still uses the existing signed distribution and automatic-update channel. This change does not build, sign, or replace the Android app.

## The film

The complete film is rendered from deterministic Canvas animation with the bundled Baloo 2 and Atkinson Hyperlegible fonts. Each format is composed separately: landscape 1920 × 1080, portrait 1080 × 1920, and square 1080 × 1080, all 630 frames at 30 fps. The website selects the square composition on phones and keeps that choice stable during playback. Native controls, opt-in playback, replay, downloads, and English captions are preserved.

Shots follow the supplied narration: time (0s), minimums (1.78s), declining (3.72s), choice (7.08s), history (9s), area guidance (11.5s), and the illustrated closing scene (13.8s). The ending pairs the mascot with a left-aligned text column in landscape and follows one centered column in portrait and square. The colorful landscape continues through the final frame. The URL is plain blue type; the Jesus Loves You emblem is a smaller unbacked signature below, with the complete passage. Only its foreground ink is tinted forest green while the original alpha silhouette and source asset remain unchanged. Radar labels also sit directly on the scene, without filled circles or pills. There is no visible music-credit card or fade to black.

Text is measured from actual font bounds and fitted within safe widths. No rectangular text-reveal mask can crop ascenders or descenders. Every visible text draw is checked against the frame during all 630 frames of each format. Background offer tickets deliberately enter and leave the scene; their decorative edge bleed is not essential text.

The original user-supplied recording in `assets/your-time-matters.mp3` is unchanged. Its decoded samples remain unchanged through 17.45 seconds, including the complete spoken “Free and open source.” Only the speech-free instrumental tail repeats to support the ending, fading from 19.49 to 20.29 seconds. Voice speed and level are unchanged. Creative-media rights remain described in THIRD_PARTY_NOTICES.md.

## Reproduce locally

Requires Node.js, @napi-rs/canvas, Python 3, and FFmpeg with H.264/AAC and VP9/Opus. The renderer can use the installed primary runtime via CODEX_PRIMARY_RUNTIME_NODE_MODULES. No external CI or build service is used.

```sh
python3 tools/film/make-audio.py /tmp/offer-film
node tools/render-film.cjs stills /tmp/offer-film
node tools/render-film.cjs landscape /tmp/offer-film
node tools/render-film.cjs portrait /tmp/offer-film
node tools/render-film.cjs square /tmp/offer-film
ffmpeg -i /tmp/offer-film/offer-filter-portrait.mp4 -c:v libvpx-vp9 -crf 27 -b:v 0 -row-mt 1 -cpu-used 4 -c:a libopus -b:a 160k /tmp/offer-film/offer-filter-portrait.webm
```

`tools/film/film.js` owns the complete animation; `tools/render-film.cjs` renders and audits it; `tools/film/make-audio.py` verifies the original recording and prepares the soundtrack. Earlier ending recipes and receipts remain as historical production evidence and are superseded by this full-film renderer.

The film uses invented offers and map locations. It is an illustration of the idea, not a device-validation run, an earnings promise, or evidence about DoorDash's offer algorithm. Default behavior is shown; passing an offer leaves the choice to the user.

The site is static HTML, CSS and JavaScript with local fonts and media. It does not embed tracking, account connections, payment processing, or an app build. Public Android source is on the separate app-source branch. The MIT License covers the website software; font and creative-media rights are separate in THIRD_PARTY_NOTICES.md.


## Accountless feedback

The public site includes a small feedback form that posts directly to the dedicated Offer Filter feedback endpoint at `https://zlnfvqyyjsltmkmmpgzp.supabase.co/functions/v1/offer-filter-feedback`. It asks for no name, email, GitHub account, or Offer Filter account and sends no diagnostics from the website. The form submits only the selected category, typed message, and a `web` source/version marker.

The feedback database is write-only from the public path, uses server-side rate limiting without storing the raw IP address in the feedback record, and expires feedback after 90 days. Supabase and network providers still handle ordinary connection metadata, so the UI describes this as accountless feedback rather than guaranteeing mathematical anonymity. The site still has no analytics or tracking.
