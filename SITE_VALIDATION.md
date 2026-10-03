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
