# Website continuation checkpoint — October 3, 2026

Published source: `9c1c37a431aaf3689842684b67fa55e3e3a9fc30` (parent `45b6e23424364e44d583e9bdf434205a023c619c`). GitHub Pages deployment `37147871307` completed successfully.

## Delivered

- Removed the extra monochrome funnel in the header. The illustrated mascot and wordmark remain.
- Replaced the portrait modal with an inline 16:9 film section, existing 1920×1080 landscape export, poster extracted at 16.8 seconds, native controls, keyboard play/replay, and English captions. The poster is visible before media loads; no autoplay.
- Replaced the previous mixed soundtrack in all four exports with one original sparse tonal score. No voice, breathing, noise swells, or external samples. Generator: `tools/clean-film-score.py`.
- Kept the existing signed Android download channel and goodwill tip destinations. No app binaries, private diagnostics, or new payment processing are hosted here.

## Verification

- Local HTML asset references and JavaScript syntax passed.
- All MP4 exports remain 18.5 seconds, with 555 video frames at 30 fps. WebM container is 18.514 seconds including codec padding.
- Compressed video stream SHA-256 values are unchanged for landscape MP4, portrait MP4/WebM, and square MP4; only sound was replaced. Landscape video stream: `8de6ece2b4f5b95a5e05ae621e6e3d9926df28e99f93504f512cfa327cd2c945`.
- Full landscape MP4 and portrait WebM A/V decode passed with ffmpeg.
- Live HTML, page script, landscape poster and landscape MP4 match committed local bytes exactly. HTTP partial-content requests return 206 with correct range/size.
- Live inline playback completed at 18.5 seconds: ended=true, paused=true, readyState=4, with no media error. A fresh browser tab resolved an earlier stale-tab buffering observation.
- Live desktop browser showed inline player 1160×652.5 (16:9), no open film dialog, no horizontal overflow, and the expected poster before playback.

## Scope

This remains the original illustrative marketing draft, not final film polish or device-validation evidence. The film shows default behavior. Optional auto-accept is described in the download details and remains off unless the user separately enables it in Settings.

## 0.4.59 copy follow-up — October 3, 2026

After the original-signer 0.4.59 release reached the existing automatic update channel, the absolute “never accepts” claim was removed from download details. The text now explains that auto-accept is off by default, needs a separate Settings opt-in, and can commit the user to a matching delivery. Metadata and the film's caption qualify the default behavior without adding UI controls. Caption URLs are versioned to refresh cached text. The illustrated layout, four film exports, clean original soundtrack, tip destinations and signed download route are unchanged.

Release-channel evidence at preparation: version 0.4.59/code 65; APK 423,069 bytes; SHA-256 `cc1000c8ad33731f6a8fc3b9b016d7dfc6e8e6c40fdb988d23709efc247a20f4`. This is publication evidence, not a physical-phone test.

Copy source `9e9afff5afa02a50324559014e737d8d2b688075` deployed successfully in Pages run `37150686335`. Live HTML and VTT bytes matched the committed files. The rendered download dialog visibly states default-off auto-accept, separate Settings confirmation and possible delivery commitment; the acceptance-rate warning and existing signed download link remain present. No film or audio re-export was needed for this copy-only follow-up.


## Hero layout and closing signature — October 3, 2026

The existing illustrated mascot now appears beside the header wordmark. The single inline 16:9 player takes the former hero mascot space; there is no second film section or duplicate player. The hero uses a two-column layout on desktop and a stacked layout below 850 px, removing the previous illustration/text overlap on phones. A visible poster, user-started playback, controls, captions, signed download route and optional tips remain. The page’s final line reads “Jesus Loves You”. The ambient skyline stays behind the content, without duplicate offer tickets or constellation in the hero.

Local HTML checks passed: one video, unique element IDs, all referenced assets present, one page signature. JavaScript syntax passed. Live deployment and responsive playback verification follow below.

All four film exports now end with the exact signature “Jesus Loves You”, fading in from 16.3 to 16.7 seconds. Both posters were refreshed from the signed end card. Native captions also include the closing line. `tools/sign-film.py` records the guarded local operation, and `validation/film-signature-20261003.json` records output hashes, complete decode checks and audio/timing evidence. Each output contains 555 frames at 30 fps. MP4 duration remains 18.500 seconds. WebM container duration is 18.521 seconds versus the former 18.514 seconds because of Opus preroll metadata; actual packet presentation times are unchanged. Every compressed audio packet matches the existing clean tonal score, with no breathing or noise added.

Published source `f4e9c160cceda4a25ae72870aa1d4b9b6d8cc16d` reached GitHub Pages in successful run `37152526587`. Live HTML, CSS, scene JavaScript, wide poster, captions and landscape MP4 were fetched and matched local committed bytes exactly. Live landscape SHA-256: `99001b06f9811b5c8d5433f3159d518b197a795c9f6c728c60c7b89edad5796d` (3,158,448 bytes).

The actual live browser completed playback at 18.5 seconds (`ended=true`, `readyState=4`, no media error). At the available 520 px browser viewport / 505 px content width, the page had one video, no horizontal overflow, a clear header mascot and stacked hero without illustration/text overlap. Day/night and the download dialog were checked; the original signed download link and default-off auto-accept disclosure remain. Full-page screenshot was reviewed. Exact 400 px and 1280 px viewport checks were not available through this browser’s supported APIs and are not claimed. The code’s two-column desktop / stacked-below-850px rules were reviewed, but this is not a substitute for an exact desktop screenshot.

## Calm playback focus — October 3, 22:22 UTC

Source `9c425f04959de01bcbe772da5b7d722a8f89d7d8` reached Pages in successful run `37158131708`. Film playback and open dialogs temporarily stop the ambient canvas and decorative CSS animation. Closing a dialog or finishing playback restores the visitor's existing motion choice; the film is never automatically resumed. Pending animation frames are canceled while paused, and resuming resets the frame clock. No new visible controls or layout were added. All video/audio exports, captions, poster, tips and download destinations remain unchanged.

Local JavaScript syntax and whitespace checks passed. Live HTML, page.js and scene.js matched committed bytes. In the live browser, starting the film set ambient pause while the explicit motion preference remained off. The film reached18.5s/ended with no media error, and ambience resumed. Opening About paused ambience; closing it restored focus to About and resumed ambience after the close event. Explicit Pause motion remained selected during replay. The available browser had no horizontal overflow; no new exact400/1280 viewport or physical-phone test is claimed. This is a presentation refinement to the existing exported marketing draft, not a newly rendered or final film.


## Shared emblem and complete passage — October 3, 2026

Prepared locally from site main `7728c22bae6a2cc87ec5101acb44b41daf976012`. The plain footer signature is replaced by the user-requested warm sandstone emblem, including “WE LOVE EACH OTHER / BECAUSE HE LOVES US FIRST.” and “1 JOHN 4:19”. The same unmodified transparent PNG is used by the Android signature and video-compositing source. Its generation and exact prompt are recorded in `validation/emblem-asset-20261003.json`; the user’s reference photograph is not published. The footer image is responsive at a maximum width of 330px, with complete alt text. A CSS-only ink treatment provides contrast in the light theme; night retains the original sandstone color.

All four existing exports now close with a complete, full-frame emblem card. The card begins its 0.35-second fade at 16s and remains until 20s. The app name and independent-affiliation notice are retained around it. The extra 1.5s gives the full passage more reading time. Every compressed packet and presentation time of the existing clean tonal score is unchanged, leaving an intentional quiet tail after the score resolves. The first 16s retain the existing edit, subject to video re-encoding; they are not claimed byte-identical.

The guarded local recipe is `tools/sign-emblem-film.py`. All three MP4 files are exactly 20.000s, with 600 frames at 30fps. The WebM also has600 frames at 30fps, with a 19.999s container duration owing to millisecond timestamps. Complete A/V decoding passed for all four exports. Structured hashes, sizes and audio comparisons are in `validation/film-emblem-20261003.json`. Both poster images now come from the new closing card at 17.5s, and captions contain the complete passage. Landscape and portrait closing frames were visually inspected.

Local HTML checks passed: one film, one complete accessible emblem, unique IDs and existing local asset references. JavaScript syntax and whitespace checks passed. The header mascot, embedded 16:9 player, user-started playback, ambient playback pause, clean score, optional tips and existing signed Android download/update channel remain. Publication and live browser checks are pending the coordinating thread; this local receipt does not claim a live deployment.

Published source `e2db7e23d9b774b74cccd49408e57d1841080dbb` reached Pages in successful run `37161573165`. Ten live files (HTML, CSS, emblem, both posters, captions and all four videos) byte-match the local exports. The live embedded MP4 reached20.0 seconds/ended with no media error. At the available520px browser viewport the emblem loaded at its original1412px width, its full alternative text was present, and there was no horizontal overflow. Night mode preserves the sandstone color; the day preview uses contrasting ink. The final video frame and footer were visually reviewed. No exact400/1280viewport or phone run is claimed.

Visual follow-up: the Play/Replay button moves to the upper-left corner, preserving a44px touch height, so it no longer covers the center of the signature on the poster or finished film. No video bytes or soundtrack change in this follow-up.


## Correction: small white closing signature — October 3, 2026

Prepared from fresh main `66ca1f4e1db3e2be4470cc0f126ad6df0c31c883`. The user clarified that this should be a small signature, with white lettering on the website and video; Android retains the sandstone color at a smaller size. This correction supersedes the large footer and full-frame 20-second emblem treatment above.

The website footer now uses a white emblem at a maximum width of 200px. Its complete passage and accessible alternative text remain. A small quiet day-theme backing maintains white-letter contrast; the image stays white in both sky themes. The header mascot, embedded player, corner Play/Replay button, ambient pause, signed download route and goodwill tips are unchanged.

The original unsignatured 18.5-second exports were recovered locally and verified against all four SHA-256 guards from the original `tools/sign-film.py`. The corrected recipe `tools/sign-emblem-film.py` restores the original Offer Filter mascot/app closing scene, with a small white emblem fading in from 16.3 to 16.65 seconds at the lower left. The original title, free Android beta wording, tip invitation and affiliation notice stay visible. The emblem is 300px wide in the 1920px landscape and 1080px portrait exports, and 240px in the square export. A subtle letter shadow keeps the white signature visible against the illustrated hills. There is no full-frame emblem card or added silence.

The original sandstone PNG remains the single master, unchanged from its built-in image-generation output. CSS and video rendering tint RGB white while preserving alpha. The exact master prompt and hash remain in `validation/emblem-asset-20261003.json`; the white presentation is recorded in `validation/emblem-white-asset-20261003.json`. The user’s source photograph is not published. Landscape and square closing-frame previews were visually inspected before re-export. Verification receipts and final live status follow.


Local verification completed: all four corrected exports decode fully, contain 555 video frames at 30fps, and preserve every compressed audio packet and its presentation time from the original clean-score source. All MP4 durations are exactly 18.500s; WebM container duration is 18.521s owing to its Opus/container timestamp metadata. Both posters were regenerated at 17.5s. The structured receipt is `validation/film-small-white-signature-20261003.json`. HTML/CSS checks confirm one video, one 200px signature with complete alternative text, existing asset references, unique IDs, retained corner controls and signed download route. JavaScript syntax and whitespace checks pass. Publication and live browser verification are pending the coordinating thread; no live or phone outcome is claimed here.

### Compact white signature — live verification

Source `ceecaddee9f5de2e9fc5788ac685146eb6f9ce0d` deployed successfully through Pages run `37162673602`. Ten live HTML/CSS/image/caption/video assets byte-match the local source. The embedded film reached 18.5 seconds and `ended=true` without a media error. At the observed 520px browser viewport, the complete white footer signature is 200px wide and the page has no horizontal overflow. The original gold master is reused through presentation tint; no regenerated white asset is shipped. The original brand/mascot end card remains primary. See `validation/small-signature-live-20261003.json`. This supersedes the earlier oversized 20-second emblem ending, and remains a marketing draft.
