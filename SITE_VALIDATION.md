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

This remains the original illustrative marketing draft, not final film polish or device-validation evidence. The currently published Android app description remains faithful to the live app; coordinate copy updates when a later optional auto-accept release is actually published.
