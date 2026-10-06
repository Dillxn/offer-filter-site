/* Offer Filter: the main page's backdrop and chrome, ported from the app's own drawing code (Java) to canvas 2D.
 *   OfferApp.scene       ScenePage: the main page as one illustration. The sky from the top down to the horizon (a soft
 *                        morning blue warming to the horizon, a sun and drifting clouds by day; deep blue, a moon and 46
 *                        seeded stars by night), the searchlights sweeping while the user is dashing, the far and near
 *                        hills, the ground below the horizon and the signpost naming where the phone is.
 *   OfferApp.ground      Scenery, Part.GROUND: the 78 dp strip the main page ends on (rolling hills, houses, trees, the
 *                        road with the little delivery car).
 *   OfferApp.glyph       Glyph: every icon shape, on the app's 24-unit grid.
 *   OfferApp.iconButton  MainActivity.iconButton: a round button carrying a glyph.
 *   OfferApp.sunButton   AppearanceButton: the header's sun/moon button. In the app the scene paints the sun (or moon)
 *                        behind it; the button itself adds only the mode badge ("A" Auto, "S" System).
 *   OfferApp.header      MainActivity.header(title, false): the main page's row of round buttons.
 * Units are dp (the caller scales the context); colors stay Android ARGB ints until painted. t is seconds on the app's
 * Motion clock (Motion.seconds()), always from the caller. The phone's tilt is zero and animations are on.
 *
 * STATE AND PARAMETERS
 * scene.draw(ctx, ui, state) paints the whole page backdrop (draw it first; everything else goes over it). state:
 *   width, height   the page (dp); default 412 x 915
 *   horizonY        the skyline's street, dp from the page top: the skyline chart's bottom - 11 dp (scene.horizon()
 *                   works it out as ScenePage.horizonY does). Omitted: height * 0.6. Held within [120, height].
 *   words           [{left, top, right, bottom}] page dp: where the sky's words stand (SkyStage.wordsAt: the counts,
 *                   the page's lines, the constellation's ring labels). No star shines within (its size + 3 dp) of
 *                   one; a cloud fades while it passes behind them (gone once a fifth of it is behind); the signpost's
 *                   board never overlaps one. Arrays [l, t, r, b] and {x, y, width, height} are taken too.
 *   icons           [{left, top, right, bottom}] page dp: the constellation's icons (SkyStage.iconsAt); the signpost
 *                   keeps 4 dp clear of them.
 *   sun             {x, y}: the middle of the header's sun button, where the sun or moon stands (header.layout().sun
 *                   gives it). Omitted: the main page header's for this width (310, 38 at 412 dp). null: unanchored,
 *                   the Java's fallback (width * 0.68, 44).
 *   watching        the user is dashing: two searchlights sweep the sky
 *   watchingSince   t (s) when watching turned on: the beams fade in over 0.6 s (Motion.settle). Omitted: fully on.
 *   place           the neighbourhood's name on the signpost; omitted/null: no signpost
 *   skylineTop      optional fn(fromX, toX) -> page y of the highest building, flag or tree of the skyline standing
 *                   between fromX and toX (DecisionChartView.highestWithin, shifted into page coordinates); the
 *                   signpost's board rises over them. Omitted: no skyline under the board.
 *   t               seconds (twinkle, sun's breath, cloud drift, beam sweep)
 *   returns {horizon, sun: {x, y}, signBoard: {left, top, right, bottom} | null (left out)}
 * scene.skyTop(dark)   the color at the very top of the sky (MainActivity paints it behind the status bar)
 * scene.horizon(chartBottom, captionBottom, height)   ScenePage.horizonY: chartBottom - 11 while the skyline shows,
 *                   else captionBottom + 24, else height * 0.6
 * scene.STARS     the 46 stars: [x share of width, y share of the sky, radius dp, twinkle phase], java.util.Random(11)
 *
 * ground.draw(ctx, ui, {width = 412, height = 78, top = 0, t}) paints Scenery's GROUND strip with its top-left at (0, top),
 *   clipped to the strip as a view's background is. On the main page it is the last 78 dp (top = page height - 78),
 *   drawn after the page's other views. The car crosses the page once every 16 s.
 *
 * glyph(ctx, shape, cx, cy, size, color, opts) one icon of size dp centred on (cx, cy); shape is one of glyph.SHAPES
 *   ('PIN', 'SPLIT', 'SLIDERS', ...). opts (ADOPT and AREA only): {learned, set} inks (default: color) and
 *   {level}: AREA's shape is filled while level > 0 (score by area on).
 * glyph.draw(ctx, shape, color, x, y, size, opts) the same by its top-left corner, as the Java's static Glyph.draw.
 * iconButton(ctx, ui, shape, left, top, size = 52, opts) the round button: surface fill, 1 dp border, the glyph 24 dp in
 *   ui.ink at its middle. opts go to the glyph.
 * sunButton(ctx, ui, left, top, size = 56, mode = 'AUTO', t = 0, opts) the mode badge for 'AUTO' ("A") and 'SYSTEM'
 *   ("S"); none for 'DAY' or 'NIGHT'. opts.sun: also paint the sun/moon with its glow at the button's middle, as the
 *   scene would (only when no scene is drawn behind it, or it shows twice).
 * header(ctx, ui, {width = 412, top = 0, mode = 'AUTO', split = true, t = 0, withSun = false}) the main page's header
 *   buttons: Navigate (PIN), Split screen with Dasher (SPLIT; split false = hidden, as when Dasher is beside), the sun
 *   button and Settings (SLIDERS), right-aligned. Returns header.layout(width, state).
 * header.layout(width, {split = true, top = 0}) -> {height: 70, title, pin, split (null when hidden), sun, settings}:
 *   boxes {left, top, right, bottom, x, y (middle), size} in page dp. title is the empty title's room at the left (the
 *   counts sit beside the buttons only when it is wide enough; at 412 dp it is not, and they go under the header).
 *
 * appearance (SolarCycle, Appearance): which palette the screens use, so whether the scene is by day or by night.
 *   night(atMs, latitude, longitude) -> true/false/null (NOAA sun position, apparent sunrise at 90.833 degrees);
 *   clockNight(atMs, utcOffsetMinutes) -> before 6 am or from 6 pm; resolve(mode, {at, latitude, longitude,
 *   offsetMinutes, systemNight}) -> {mode, night, clockFallback}; next(mode): DAY > NIGHT > SYSTEM > AUTO > DAY.
 */
(function(root) {
'use strict';
const App = root.OfferApp = root.OfferApp || {};
const U = App.util;
if (!U) throw new Error('scene.js needs base.js (OfferApp.util) loaded first');
const css = U.css;
const TAU = Math.PI * 2;

// ---- Motion.java, on the caller's clock (t = Motion.seconds()) ----
/** Motion.wave: swings between -1 and 1 once every period seconds, offset by phase (0-1). */
const wave = (t, period, phase) => Math.sin((t / period + phase) * TAU);
/** Motion.loop: 0 to 1 over period seconds, then again. */
const loop = (t, period, phase) => { const v = t / period + phase; return v - Math.floor(v); };
/** Motion.settle: eased 0-1 progress of something started at since (s) lasting ms; nothing started: done. */
const settle = (t, since, ms) => {
  if (since == null) return 1;
  const p = U.clamp((t - since) * 1000 / ms, 0, 1);
  return 1 - (1 - p) * (1 - p) * (1 - p);
};

const disc = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fill(); };
const box = b => Array.isArray(b) ? {left: b[0], top: b[1], right: b[2], bottom: b[3]}
  : b.right != null ? b
  : {left: b.x, top: b.y, right: b.x + (b.width != null ? b.width : b.w), bottom: b.y + (b.height != null ? b.height : b.h)};
/** RectF.intersects(a, b). */
const intersects = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Paint.setFakeBoldText: Skia strokes the glyphs' outlines (fill and stroke) by size/24 at 9 px or less, easing to
 * size/32 at 36 or more. Drawn in the current fillStyle, font and alignment.
 */
function fakeBoldText(ctx, text, x, y, size) {
  const k = U.clamp((size - 9) / 27, 0, 1);
  ctx.save();
  ctx.fillText(text, x, y);
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = size * (1 / 24 + (1 / 32 - 1 / 24) * k);
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 4;
  ctx.strokeText(text, x, y);
  ctx.restore();
}

/**
 * Ui.fit: shrinks the text size (down to minFraction of it) until value fits maxWidth, then TextUtils.ellipsize(END)
 * if it still does not. Leaves ctx.font at the size chosen.
 */
function fit(ctx, value, size, maxWidth, minFraction) {
  ctx.font = U.font(size);
  const width = ctx.measureText(value).width;
  if (width > maxWidth && width > 0) {
    size = Math.max(size * minFraction, size * maxWidth / width);
    ctx.font = U.font(size);
  }
  let text = value;
  if (ctx.measureText(text).width > maxWidth) {
    let n = value.length;
    while (n > 0 && ctx.measureText(value.slice(0, n) + '…').width > maxWidth) n--;
    text = n > 0 ? value.slice(0, n) + '…' : '';
  }
  return {text, size};
}

// ======================================================================================================== ScenePage
const scene = App.scene = {};

/** Stars across the whole night sky: position as shares of the sky, size in dp, twinkle phase (float maths as Java). */
const STARS = scene.STARS = (() => {
  const scatter = U.javaRandom(11), f = Math.fround, stars = [];
  for (let i = 0; i < 46; i++) {
    const x = scatter.nextFloat();
    const y = f(Math.pow(scatter.nextFloat(), 1.4));
    const size = f(f(0.7) + scatter.nextFloat());
    const phase = scatter.nextFloat();
    stars.push([x, y, size, phase]);
  }
  return stars;
})();

/** The color at the very top of the sky, for behind the status bar. */
scene.skyTop = dark => dark ? 0xFF070B16 : 0xFFD4E4F4;

/** ScenePage.horizonY: 11 dp above the skyline's bottom (its street), or 24 dp below the offer caption, or 60% down. */
scene.horizon = (chartBottom, captionBottom, height) =>
  chartBottom != null ? chartBottom - 11 : captionBottom != null ? captionBottom + 24 : height * 0.6;

/** Whether (x, y) is within margin of any of the sky's words. */
function underWords(words, x, y, margin) {
  for (const b of words) {
    if (x >= b.left - margin && x <= b.right + margin && y >= b.top - margin && y <= b.bottom + margin) return true;
  }
  return false;
}

function drawStars(ctx, width, line, words, t) {
  const reach = line - 70;
  for (const star of STARS) {
    const x = width * star[0];
    const y = 8 + reach * star[1];
    // None under the sky's words, so no dot lands on a letter.
    if (underWords(words, x, y, star[2] + 3)) continue;
    const twinkle = 0.5 + 0.5 * wave(t, 2.2 + star[3] * 3, star[3]);
    const alpha = Math.trunc(0x50 + 0x9F * twinkle * (1 - 0.5 * star[1]));
    ctx.fillStyle = css(U.withAlpha(0xFFF3E9, Math.min(255, alpha)));
    disc(ctx, x, y, star[2] * (0.7 + 0.3 * twinkle));
  }
}

/**
 * The crescent: circle (x, y, 15) less circle (x + 7, y - 5, 13), as Path.op(DIFFERENCE) leaves it: the first circle's
 * arc outside the bite, then the bite's arc back inside the first circle.
 */
function moonPath(ctx, x, y) {
  const r1 = 15, r2 = 13, dx = 7, dy = -5, d = Math.hypot(dx, dy);
  const a = (d * d + r1 * r1 - r2 * r2) / (2 * d), h = Math.sqrt(r1 * r1 - a * a);
  const mx = dx * a / d, my = dy * a / d;
  const p1x = mx - dy * h / d, p1y = my + dx * h / d, p2x = mx + dy * h / d, p2y = my - dx * h / d;
  ctx.beginPath();
  ctx.arc(x, y, r1, Math.atan2(p1y, p1x), Math.atan2(p2y, p2x), false);
  ctx.arc(x + dx, y + dy, r2, Math.atan2(p2y - dy, p2x - dx), Math.atan2(p1y - dy, p1x - dx), true);
  ctx.closePath();
}

/** By day a sun, by night a crescent moon, at (x, y) (the sun button's middle), both with a soft glow that breathes. */
function drawSun(ctx, dark, x, y, t) {
  const breathe = 1 + 0.06 * wave(t, 7, 0);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(breathe, breathe);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 60);
  glow.addColorStop(0, css(dark ? 0x40E9DDB8 : 0x66FFD36E));
  glow.addColorStop(1, css(0x00FFFFFF));
  ctx.fillStyle = glow;
  disc(ctx, 0, 0, 60);
  ctx.restore();
  if (dark) {
    moonPath(ctx, x, y);
    ctx.fillStyle = css(0xFFF1E6C8);
    ctx.fill();
  } else {
    ctx.fillStyle = css(0xFFFFE3A0);
    disc(ctx, x, y, 21);
    ctx.fillStyle = css(0xFFF8C85A);
    disc(ctx, x, y, 16);
  }
}

/** A cloud; it fades out while it passes behind the sky's words, gone once a fifth of it is behind them. */
function drawCloud(ctx, x, y, size, color, words) {
  const left = x - size * 1.8, top = y - size, right = x + size * 2.05, bottom = y + size * 1.05;
  let behind = 0;
  for (const b of words) {
    const across = Math.min(right, b.right) - Math.max(left, b.left);
    const down = Math.min(bottom, b.bottom) - Math.max(top, b.top);
    if (across > 0 && down > 0) behind += across * down;
  }
  const shown = 1 - Math.min(1, behind / (0.2 * (right - left) * (bottom - top)));
  if (shown <= 0) return;
  ctx.fillStyle = css(U.withAlpha(color, Math.round((color >>> 24) * shown)));
  // Each part is painted on its own, as in the Java, so the cloud is a touch whiter where they overlap.
  disc(ctx, x, y, size);
  disc(ctx, x - size * 1.1, y + size * 0.35, size * 0.7);
  disc(ctx, x + size * 1.15, y + size * 0.3, size * 0.78);
  ctx.fillRect(x - size * 1.1, y + size * 0.35, size * 2.25, size * 0.7);
}

/** Three soft clouds at different heights, each drifting across the sky at its own pace. */
function drawClouds(ctx, width, line, words, t) {
  const drift = (share, period) => (share + loop(t, period, 0)) % 1 * (width + 90) - 45;
  drawCloud(ctx, drift(0.52, 110), 30, 12, 0xE6FFFFFF, words);
  drawCloud(ctx, drift(0.12, 160), line * 0.34, 15, 0xB3FFFFFF, words);
  drawCloud(ctx, drift(0.8, 200), line * 0.62, 11, 0x99FFFFFF, words);
}

/** Two beams rising from behind the hills, each sweeping slowly to and fro on its own rhythm; they fade in. */
function drawSearchlights(ctx, dark, width, line, t, since) {
  const length = Math.max(200, line * 0.85);
  const color = dark ? 0x3DD6E6FF : 0x4DF5B942;
  const spread = length * 0.09;
  ctx.save();
  // The paint's alpha over the beam's shading.
  ctx.globalAlpha = Math.round(255 * settle(t, since, 600)) / 255;
  const beam = (x, y, degrees) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(U.rad(degrees));
    const shade = ctx.createLinearGradient(0, 0, 0, -length);
    shade.addColorStop(0, css(color));
    shade.addColorStop(1, css(color & 0x00FFFFFF));
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(-spread, -length);
    ctx.lineTo(spread, -length);
    ctx.lineTo(3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  beam(width * 0.26, line - 18, -14 + 24 * wave(t, 6.5, 0));
  beam(width * 0.76, line - 14, 12 - 24 * wave(t, 8.2, 0.3));
  ctx.restore();
}

/** Rolling hills whose tops reach rise above line, with waves crests across. */
function hillsPath(ctx, left, right, line, rise, waves) {
  ctx.beginPath();
  ctx.moveTo(left, line + 1);
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const x = left + (right - left) * i / steps;
    const t = i / steps;
    const swell = 0.55 + 0.25 * Math.sin(t * Math.PI * waves + 0.7) + 0.2 * Math.sin(t * Math.PI * waves * 2.3);
    ctx.lineTo(x, line - rise * swell);
  }
  ctx.lineTo(right, line + 1);
  ctx.closePath();
}

/** Two ranges of hills along the horizon, behind the skyline, the nearer darker. */
function drawHills(ctx, dark, width, line) {
  const over = 12;
  hillsPath(ctx, -over, width + over, line, 46, 3.0);
  ctx.fillStyle = css(dark ? 0xFF1B2238 : 0xFFDCE4D2);
  ctx.fill();
  hillsPath(ctx, -over, width + over, line, 26, 5.0);
  ctx.fillStyle = css(dark ? 0xFF151B28 : 0xFFD2DCC6);
  ctx.fill();
}

/** The first of the sky's words the board would overlap, or of its icons it would come within gap of. */
function signHit(words, icons, x, middle, halfWidth, halfHeight, gap) {
  const board = {left: x - halfWidth, top: middle - halfHeight, right: x + halfWidth, bottom: middle + halfHeight};
  for (const b of words) if (intersects(board, b)) return b;
  const clear = {left: board.left - gap, top: board.top - gap, right: board.right + gap, bottom: board.bottom + gap};
  for (const b of icons) if (intersects(clear, b)) return b;
  return null;
}

/**
 * A wooden signpost on the near hills at the left, naming where you are. Its board rises above the skyline where
 * buildings stand under it, and steps right past (or rises over) the sky's words and icons; one that would have to
 * rise more than 64 dp is left out. Returns the board, or null when left out.
 */
function drawSignpost(ctx, dark, s, width, line, words, icons) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  // Math.min(ui.sp(11), ui.dp(15)): 11 at the default font scale.
  const fitted = fit(ctx, String(s.place), Math.min(11, 15), width * 0.36, 0.8);
  const size = fitted.size, name = fitted.text;
  const halfWidth = ctx.measureText(name).width / 2 + 7;
  const halfHeight = size * 0.8;
  let x = Math.max(halfWidth + 10, width * 0.15);
  const foot = line - 4, rest = foot - 40, gap = 4;
  // The board's middle at x: at rest, or over the skyline's buildings and flags standing under it.
  const overSkyline = at => typeof s.skylineTop !== 'function' ? rest
    : Math.min(rest, s.skylineTop(at - halfWidth - gap, at + halfWidth + gap) - gap - halfHeight);
  let cap = rest, middle = rest;
  for (let pass = 0; pass < 5; pass++) {
    middle = Math.min(cap, overSkyline(x));
    const hit = signHit(words, icons, x, middle, halfWidth, halfHeight, gap);
    if (!hit) break;
    // Past the sky's words and icons: a step right if it stays on the left of the page, else up over them.
    const right = hit.right + gap + halfWidth;
    if (right + halfWidth <= width * 0.5) x = right;
    else cap = Math.min(cap, hit.top - gap - halfHeight);
  }
  if (rest - middle > 64 || signHit(words, icons, x, middle, halfWidth, halfHeight, gap)) {
    ctx.restore();
    return null;
  }
  ctx.fillStyle = css(dark ? 0xFF4A3D2A : 0xFF9C7A52);
  ctx.fillRect(x - 1.5, middle, 3, foot - middle);
  ctx.fillStyle = css(dark ? 0xFF5B4A33 : 0xFFC9A36F);
  U.rrect(ctx, x - halfWidth, middle - halfHeight, x + halfWidth, middle + halfHeight, 3);
  ctx.fill();
  ctx.fillStyle = css(dark ? 0xFF2A2216 : 0xFFF6E8CF);
  U.rrect(ctx, x - halfWidth + 2, middle - halfHeight + 2, x + halfWidth - 2, middle + halfHeight - 2, 2);
  ctx.fill();
  ctx.fillStyle = css(dark ? 0xFFF3E6C8 : 0xFF3A2A18);
  fakeBoldText(ctx, name, x, middle + size / 3, size);
  ctx.restore();
  return {left: x - halfWidth, top: middle - halfHeight, right: x + halfWidth, bottom: middle + halfHeight};
}

scene.draw = (ctx, ui, state) => {
  const s = state || {};
  const dark = ui.dark, t = s.t || 0, width = s.width || 412, height = s.height || 915;
  const line = Math.max(120, Math.min(height, s.horizonY == null ? height * 0.6 : s.horizonY));
  const words = (s.words || []).map(box), icons = (s.icons || []).map(box);
  const anchor = s.sun === undefined ? headerLayout(width).sun : s.sun;
  const sunX = anchor ? anchor.x : width * 0.68, sunY = anchor ? anchor.y : 44;
  ctx.save();
  // The sky down to the horizon, the ground below it (down to the colors the road strip at the bottom starts from,
  // so they meet without a seam).
  const skyColors = dark ? [scene.skyTop(true), 0xFF0D1428, 0xFF1C1B34] : [scene.skyTop(false), 0xFFE7EEF2, 0xFFF6E7D2];
  const sky = ctx.createLinearGradient(0, 0, 0, line);
  sky.addColorStop(0, css(skyColors[0]));
  sky.addColorStop(0.55, css(skyColors[1]));
  sky.addColorStop(1, css(skyColors[2]));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, line);
  const ground = ctx.createLinearGradient(0, line, 0, height);
  ground.addColorStop(0, css(dark ? 0xFF121821 : 0xFFE3E7D6));
  ground.addColorStop(1, css(dark ? 0xFF141413 : 0xFFE8E6DE));
  ctx.fillStyle = ground;
  ctx.fillRect(0, line, width, height - line);

  if (dark) drawStars(ctx, width, line, words, t);
  drawSun(ctx, dark, sunX, sunY, t);
  if (!dark) drawClouds(ctx, width, line, words, t);
  if (s.watching) drawSearchlights(ctx, dark, width, line, t, s.watchingSince);
  drawHills(ctx, dark, width, line);
  const signBoard = s.place != null ? drawSignpost(ctx, dark, s, width, line, words, icons) : null;
  ctx.restore();
  return {horizon: line, sun: {x: sunX, y: sunY}, signBoard};
};

// ==================================================================================== SolarCycle and Appearance
/** Which palette the app's screens use (and so whether the scene is drawn by day or by night). */
const appearance = App.appearance = {MODES: ['DAY', 'NIGHT', 'SYSTEM', 'AUTO']};
const SUNRISE_COSINE = Math.cos(90.833 / 180 * Math.PI);
const toRadians = d => d / 180 * Math.PI;

/**
 * SolarCycle.night: NOAA's general solar-position equations at `at` (ms since the epoch) for latitude and longitude
 * (degrees, east positive): true while the sun is below the apparent-sunrise zenith of 90.833 degrees; null for
 * invalid coordinates.
 */
appearance.night = (at, latitude, longitude) => {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90
      || Math.abs(longitude) > 180) return null;
  const d = new Date(at), y = d.getUTCFullYear();
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 + d.getUTCMilliseconds() / 60000;
  const dayOfYear = Math.round((Date.UTC(y, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  const days = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
  const year = 2 * Math.PI / days * (dayOfYear - 1 + (minutes / 60 - 12) / 24);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(year) - 0.032077 * Math.sin(year)
    - 0.014615 * Math.cos(2 * year) - 0.040849 * Math.sin(2 * year));
  const declination = 0.006918 - 0.399912 * Math.cos(year) + 0.070257 * Math.sin(year)
    - 0.006758 * Math.cos(2 * year) + 0.000907 * Math.sin(2 * year)
    - 0.002697 * Math.cos(3 * year) + 0.00148 * Math.sin(3 * year);
  // UTC has no daylight-saving offset. Positive longitude is east; cosine is periodic across the date line.
  const hourAngle = toRadians((minutes + equation + 4 * longitude) / 4 - 180);
  const lat = toRadians(latitude);
  const zenithCosine = Math.sin(lat) * Math.sin(declination)
    + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
  return zenithCosine < SUNRISE_COSINE;
};

/** SolarCycle.clockNight: the clock fallback, night before 6 am and from 6 pm, at a UTC offset in minutes (east +). */
appearance.clockNight = (at, offsetMinutes) => {
  const hour = Math.floor((((at + (offsetMinutes || 0) * 60000) % 86400000) + 86400000) % 86400000 / 3600000);
  return hour < 6 || hour >= 18;
};

/** Math.rint: to the nearest whole number, halves to even. */
const rint = v => { const r = Math.round(v); return Math.abs(v % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r; };

/**
 * Appearance.resolve: {mode, night, clockFallback}. DAY and NIGHT are fixed; SYSTEM follows Android (systemNight);
 * AUTO follows the local sun at the map's recent position (latitude, longitude, rounded to 0.1 degree first), or
 * without one the local clock (offsetMinutes from UTC), day from 6 am to 6 pm. Fresh installs are AUTO.
 */
appearance.resolve = (mode, o) => {
  o = o || {};
  mode = String(mode || 'AUTO').toUpperCase();
  if (mode === 'DAY' || mode === 'NIGHT') return {mode, night: mode === 'NIGHT', clockFallback: false};
  if (mode === 'SYSTEM') return {mode, night: !!o.systemNight, clockFallback: false};
  if (o.latitude != null && o.longitude != null) {
    const night = appearance.night(o.at, rint(o.latitude * 10) / 10, rint(o.longitude * 10) / 10);
    if (night != null) return {mode, night, clockFallback: false};
  }
  return {mode, night: appearance.clockNight(o.at, o.offsetMinutes), clockFallback: true};
};

/** Appearance.Mode.next: what a tap on the sun button turns the theme to. */
appearance.next = mode => ({DAY: 'NIGHT', NIGHT: 'SYSTEM', SYSTEM: 'AUTO'})[String(mode).toUpperCase()] || 'DAY';

// ==================================================================================================== Scenery GROUND
const ground = App.ground = {HEIGHT: 78};

/** PathMeasure over one cubic: length by fine steps, and the position and tangent on the curve at a distance. */
function cubicMeasure(x0, y0, x1, y1, x2, y2, x3, y3) {
  const at = t => {
    const u = 1 - t;
    return [u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3];
  };
  const slope = t => {
    const u = 1 - t;
    return [3 * u * u * (x1 - x0) + 6 * u * t * (x2 - x1) + 3 * t * t * (x3 - x2),
      3 * u * u * (y1 - y0) + 6 * u * t * (y2 - y1) + 3 * t * t * (y3 - y2)];
  };
  const steps = 256, lengths = [0];
  let previous = at(0), length = 0;
  for (let i = 1; i <= steps; i++) {
    const p = at(i / steps);
    length += Math.hypot(p[0] - previous[0], p[1] - previous[1]);
    lengths.push(length);
    previous = p;
  }
  return {
    length,
    posTan(distance) {
      const d = U.clamp(distance, 0, length);
      let i = 1;
      while (i < steps && lengths[i] < d) i++;
      const span = lengths[i] - lengths[i - 1];
      const t = (i - 1 + (span > 0 ? (d - lengths[i - 1]) / span : 0)) / steps;
      const p = at(t), g = slope(t), m = Math.hypot(g[0], g[1]) || 1;
      return {x: p[0], y: p[1], tx: g[0] / m, ty: g[1] / m};
    }
  };
}

/** A house sitting on the hill at (x, ground), size wide, with one lit window. */
function drawHouse(ctx, dark, x, ground, size) {
  const wall = size * 0.75;
  ctx.fillStyle = css(dark ? 0xFF1C1C1B : 0xFFDCD9CF);
  ctx.fillRect(x - size / 2, ground - wall, size, wall + size * 0.15);
  ctx.fillStyle = css(dark ? 0xFF232321 : 0xFFD2CFC4);
  ctx.beginPath();
  ctx.moveTo(x - size * 0.62, ground - wall);
  ctx.lineTo(x, ground - wall - size * 0.5);
  ctx.lineTo(x + size * 0.62, ground - wall);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = css(dark ? 0xFF3B3524 : 0xFFF2E6C4);
  const pane = size * 0.2;
  ctx.fillRect(x - size * 0.3, ground - wall + size * 0.18, pane, pane);
}

function drawTree(ctx, dark, x, ground, size) {
  ctx.fillStyle = css(dark ? 0xFF1D1C1A : 0xFFD3CEC2);
  ctx.fillRect(x - size * 0.12, ground - size * 1.1, size * 0.24, size * 1.3);
  ctx.fillStyle = css(dark ? 0xFF18201A : 0xFFD2DBC8);
  disc(ctx, x, ground - size * 1.3, size);
}

/** A little round car with a parcel on its roof and eyes in its windshield, riding the road at `at`. */
function drawCar(ctx, dark, at, t) {
  ctx.save();
  // A gentle bounce on the road.
  ctx.translate(at.x, at.y - 0.8 * Math.abs(wave(t, 0.9, 0)));
  ctx.rotate(Math.atan2(at.ty, at.tx));
  const body = dark ? 0xFF2D4C73 : 0xFFA9C1E0, glass = dark ? 0xFF3E5F87 : 0xFFE3ECF7;
  const shade = dark ? 0xFF3A3A38 : 0xFF6E6C67;
  const part = (l, top, r, b, radius, color) => {
    ctx.fillStyle = css(color);
    U.rrect(ctx, l, top, r, b, radius);
    ctx.fill();
  };
  part(-9, -27, 3, -19, 1.5, dark ? 0xFF6B5A3E : 0xFFDCC59C);
  part(-16, -20, 10, -8, 6, body);
  part(-20, -13, 20, -1, 5, body);
  part(-1, -18, 9, -11, 3, glass);
  ctx.fillStyle = css(shade);
  disc(ctx, 2.5, -14.5, 1.3);
  disc(ctx, 6.5, -14.5, 1.3);
  disc(ctx, -11, -1, 4.2);
  disc(ctx, 11, -1, 4.2);
  ctx.fillStyle = css(dark ? 0xFF807F7A : 0xFFE9E7E1);
  disc(ctx, -11, -1, 1.6);
  disc(ctx, 11, -1, 1.6);
  ctx.restore();
}

ground.draw = (ctx, ui, state) => {
  const s = state || {}, dark = ui.dark, t = s.t || 0;
  const width = s.width || 412, height = s.height == null ? 78 : s.height;
  ctx.save();
  ctx.translate(0, s.top || 0);
  // A view's background: drawn within the view's bounds.
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  // The ground fills its strip, up to a height where the hills would look stretched.
  const g = Math.min(180, height), bottom = height, top = bottom - g;
  // Past the edges by more than any layer slides.
  const over = 9 + 6, left = -over, right = width + over, below = bottom + over;

  ctx.beginPath();
  ctx.moveTo(left, top + g * 0.35);
  ctx.bezierCurveTo(width * 0.25, top + g * 0.05, width * 0.45, top + g * 0.45, width * 0.68, top + g * 0.2);
  ctx.bezierCurveTo(width * 0.82, top + g * 0.05, width * 0.93, top + g * 0.2, right, top + g * 0.3);
  ctx.lineTo(right, below);
  ctx.lineTo(left, below);
  ctx.closePath();
  ctx.fillStyle = css(dark ? 0xFF141413 : 0xFFE8E6DE);
  ctx.fill();
  drawHouse(ctx, dark, width * 0.2, top + g * 0.2, 22);
  drawTree(ctx, dark, width * 0.33, top + g * 0.3, 9);
  drawHouse(ctx, dark, width * 0.76, top + g * 0.16, 18);
  drawTree(ctx, dark, width * 0.88, top + g * 0.21, 8);

  ctx.beginPath();
  ctx.moveTo(left, top + g * 0.62);
  ctx.bezierCurveTo(width * 0.3, top + g * 0.45, width * 0.6, top + g * 0.7, right, top + g * 0.52);
  ctx.lineTo(right, below);
  ctx.lineTo(left, below);
  ctx.closePath();
  ctx.fillStyle = css(dark ? 0xFF111110 : 0xFFE1DFD6);
  ctx.fill();
  drawTree(ctx, dark, width * 0.08, top + g * 0.6, 11);

  const road = [left - 24, top + g * 0.86, width * 0.35, top + g * 0.7, width * 0.65, top + g * 0.92,
    right + 24, top + g * 0.74];
  ctx.beginPath();
  ctx.moveTo(road[0], road[1]);
  ctx.bezierCurveTo(road[2], road[3], road[4], road[5], road[6], road[7]);
  ctx.lineCap = 'round';
  ctx.lineWidth = 18;
  ctx.strokeStyle = css(dark ? 0xFF1E1E1D : 0xFFD6D3C9);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = css(dark ? 0xFF2C2C2A : 0xFFEFEDE7);
  ctx.setLineDash([8, 8]);
  ctx.lineDashOffset = 0;
  ctx.stroke();
  ctx.setLineDash([]);
  // Across the page once every 16 seconds.
  const measure = cubicMeasure(...road);
  drawCar(ctx, dark, measure.posTan(measure.length * loop(t, 16, 0.64)), t);
  ctx.restore();
};

// ============================================================================================================= Glyph
const SHAPES = ['CLOCK', 'ROAD', 'PIN', 'HOTSPOT', 'COIN', 'BAG', 'HOME', 'TREND', 'STOPS', 'SLIDERS', 'BACK', 'SIGN',
  'CHEVRON', 'SPLIT', 'ADOPT', 'UNDO', 'AREA'];

/**
 * The app's small line icons, drawn on a 24-unit grid: a clock for minutes, a road for miles, a pin for stops, a
 * hotspot, a coin for pay, a bag for the pickup, a house for the drop-off, a rising line for the adaptive minimum, dots
 * for the stop count, sliders for settings, a back arrow, a warning sign, a row's chevron, a phone split in two, the
 * learned minimums passing into the set ones (ADOPT), a curved arrow back (UNDO) and an area chart (AREA).
 */
const glyph = App.glyph = (ctx, shape, cx, cy, size, color, opts) => {
  const o = opts || {};
  const learnedInk = o.learned != null ? o.learned : color, setInk = o.set != null ? o.set : color;
  const ink = css(color);
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const ring = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); };
  const poly = (points, close) => {
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    if (close) ctx.closePath();
  };
  switch (String(shape).toUpperCase()) {
    case 'CLOCK':
      ring(12, 12, 9);
      line(12, 12, 12, 7);
      line(12, 12, 15.5, 14);
      break;
    case 'ROAD':
      line(5, 21, 9, 3);
      line(19, 21, 15, 3);
      line(12, 4.5, 12, 7);
      line(12, 10.5, 12, 13.5);
      line(12, 17, 12, 20);
      break;
    case 'PIN':
      ctx.beginPath();
      ctx.moveTo(12, 21);
      ctx.bezierCurveTo(12, 21, 5, 14.5, 5, 10);
      ctx.bezierCurveTo(5, 6.1, 8.1, 3, 12, 3);
      ctx.bezierCurveTo(15.9, 3, 19, 6.1, 19, 10);
      ctx.bezierCurveTo(19, 14.5, 12, 21, 12, 21);
      ctx.closePath();
      ctx.stroke();
      ring(12, 10, 2.5);
      break;
    case 'HOTSPOT':
      // A destination point within a hot area's rings, distinct from the per-stop pin.
      disc(ctx, 12, 12, 3);
      U.arcPath(ctx, 12, 12, 6, 6, -55, 290);
      ctx.stroke();
      U.arcPath(ctx, 12, 12, 9.5, 9.5, -35, 110);
      ctx.stroke();
      U.arcPath(ctx, 12, 12, 9.5, 9.5, 145, 110);
      ctx.stroke();
      break;
    case 'COIN':
      ring(12, 12, 9);
      ctx.font = U.font(13);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      fakeBoldText(ctx, '$', 12, 16.5, 13);
      break;
    case 'BAG':
      U.rrect(ctx, 5, 8, 19, 21, 2);
      ctx.stroke();
      U.arcPath(ctx, 12, 7, 3, 3.5, 180, 180);
      ctx.stroke();
      break;
    case 'HOME':
      poly([3.5, 11.5, 12, 4, 20.5, 11.5]);
      ctx.stroke();
      poly([6.5, 10, 6.5, 20, 17.5, 20, 17.5, 10]);
      ctx.stroke();
      poly([10.5, 20, 10.5, 15, 13.5, 15, 13.5, 20]);
      ctx.stroke();
      break;
    case 'TREND':
      poly([3, 17, 9, 11, 13, 15, 21, 7]);
      ctx.stroke();
      poly([15, 7, 21, 7, 21, 13]);
      ctx.stroke();
      break;
    case 'STOPS':
      line(3, 12, 21, 12);
      disc(ctx, 5, 12, 2.2);
      disc(ctx, 12, 12, 2.2);
      disc(ctx, 19, 12, 2.2);
      break;
    case 'BACK':
      line(20, 12, 4.5, 12);
      poly([11, 5, 4, 12, 11, 19]);
      ctx.stroke();
      break;
    case 'SIGN':
      poly([12, 3.5, 21, 19.5, 3, 19.5], true);
      ctx.stroke();
      line(12, 9.5, 12, 13.5);
      disc(ctx, 12, 16.5, 1.1);
      break;
    case 'CHEVRON':
      poly([9.5, 6, 15.5, 12, 9.5, 18]);
      ctx.stroke();
      break;
    case 'SPLIT':
      // A phone split in two, with a pin in its lower half: Dasher's map under Offer Filter.
      U.rrect(ctx, 6, 2.5, 18, 21.5, 2.5);
      ctx.stroke();
      line(6, 12, 18, 12);
      disc(ctx, 12, 16.3, 1.8);
      line(9, 7.2, 15, 7.2);
      break;
    case 'ADOPT':
      // The learned (dashed) shape passing into the set (solid) one, the chevron between them in the ink. The dashes:
      // one to each side, bent round its corner, a gap in the middle of each side (drawn from a side's middle).
      poly([3.2, 8.8, 5, 5.6, 8.6, 12, 5, 18.4, 1.4, 12], true);
      ctx.strokeStyle = css(learnedInk);
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'butt';
      ctx.setLineDash([4.08, 3.26]);
      ctx.lineDashOffset = 5.71;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.lineCap = 'round';
      poly([19, 5.6, 22.6, 12, 19, 18.4, 15.4, 12], true);
      ctx.fillStyle = css(U.withAlpha(setInk, 0x40));
      ctx.fill();
      ctx.strokeStyle = css(setInk);
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      poly([10.9, 9.8, 13.1, 12, 10.9, 14.2]);
      ctx.stroke();
      break;
    case 'AREA':
      // The constellation's two crossing spokes and an offer's shape on them; filled while score by area is on.
      ctx.strokeStyle = css(U.withAlpha(learnedInk, 0x80));
      ctx.lineWidth = 1.1;
      line(2.9, 6.75, 21.1, 17.25);
      line(21.1, 6.75, 2.9, 17.25);
      poly([3.35, 7, 18.05, 8.5, 20.65, 17, 6.35, 15.25], true);
      if (o.level > 0) {
        ctx.fillStyle = css(U.withAlpha(setInk, 0x70));
        ctx.fill();
      }
      ctx.strokeStyle = css(setInk);
      ctx.lineWidth = 1.8;
      ctx.stroke();
      break;
    case 'UNDO':
      // A curved arrow back.
      poly([9, 14, 4, 9, 9, 4]);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(4, 9);
      ctx.lineTo(14.5, 9);
      ctx.arc(14.5, 14.5, 5.5, -Math.PI / 2, Math.PI / 2, false);
      ctx.lineTo(11, 20);
      ctx.stroke();
      break;
    case 'SLIDERS':
      line(3, 7, 21, 7);
      line(3, 17, 21, 17);
      disc(ctx, 9, 7, 2.6);
      disc(ctx, 15, 17, 2.6);
      break;
  }
  ctx.restore();
};
glyph.SHAPES = SHAPES;
/** Glyph.draw(canvas, shape, color, x, y, size): the same icon by its top-left corner, in the Java's argument order. */
glyph.draw = (ctx, shape, color, x, y, size, opts) => glyph(ctx, shape, x + size / 2, y + size / 2, size, color, opts);

// ========================================================= MainActivity.iconButton, AppearanceButton, MainActivity.header
/**
 * A round button carrying a drawn icon: ui.rounded(ui.surface, dark ? 0x40FFFFFF : 0x330B0B0B, 26), so a 1 dp border
 * (GradientDrawable insets the shape by half its stroke), and the glyph at 24 dp in the ink, centred (ImageButton's
 * CENTER scale type).
 */
const iconButton = App.iconButton = (ctx, ui, shape, left, top, size, opts) => {
  size = size || 52;
  ctx.save();
  U.rrect(ctx, left + 0.5, top + 0.5, left + size - 0.5, top + size - 0.5, Math.min(26, (size - 1) / 2));
  ctx.fillStyle = css(ui.surface);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = css(ui.dark ? 0x40FFFFFF : 0x330B0B0B);
  ctx.stroke();
  glyph(ctx, shape, left + size / 2, top + size / 2, 24, ui.ink, opts);
  ctx.restore();
};

/**
 * AppearanceButton: the scene supplies the sun/moon; this touch target adds only the small mode indicator, "S" for
 * System or "A" for Auto (none for a fixed Day or Night): 10 sp medium ink, 4/2 dp padding, at least 18 x 18, on
 * ui.rounded(ui.page, ui.border, 12), at the bottom end with 2 dp margins.
 */
App.sunButton = (ctx, ui, left, top, size, mode, t, opts) => {
  size = size || 56;
  mode = String(mode || 'AUTO').toUpperCase();
  ctx.save();
  if (opts && opts.sun) drawSun(ctx, ui.dark, left + size / 2, top + size / 2, t || 0);
  const mark = mode === 'SYSTEM' ? 'S' : mode === 'AUTO' ? 'A' : '';
  if (mark) {
    ctx.font = U.font(10, true);
    const m = U.metrics(10);
    const textHeight = m.descent - m.ascent;  // includeFontPadding off
    const w = Math.max(18, ctx.measureText(mark).width + 8), h = Math.max(18, textHeight + 4);
    const right = left + size - 2, bottom = top + size - 2, l = right - w, tp = bottom - h;
    U.rrect(ctx, l + 0.5, tp + 0.5, right - 0.5, bottom - 0.5, Math.min(12, (Math.min(w, h) - 1) / 2));
    ctx.fillStyle = css(ui.page);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = css(ui.border);
    ctx.stroke();
    ctx.fillStyle = css(ui.ink);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(mark, l + w / 2, tp + 2 + (h - 4 - textHeight) / 2 - m.ascent);
  }
  ctx.restore();
};

/**
 * The main page's header row (ui.row(): centred vertically): padding 20, 10, 12, 4 and at least 62 tall; the empty
 * title takes the spare width; then Navigate 52, Split 52 with a 4 dp end margin, the sun 56 with 10, Settings 52.
 */
function headerLayout(width, opts) {
  const o = opts || {}, offset = o.top || 0, split = o.split !== false;
  const padLeft = 20, padTop = 10, padRight = 12, padBottom = 4;
  const height = Math.max(62, padTop + 56 + padBottom);
  const space = height - padTop - padBottom;
  const place = (right, size) => {
    const top = offset + padTop + Math.trunc((space - size) / 2);
    return {left: right - size, top, right, bottom: top + size, x: right - size / 2, y: top + size / 2, size};
  };
  const settings = place(width - padRight, 52);
  const sun = place(settings.left - 10, 56);
  const splitBox = split ? place(sun.left - 4, 52) : null;
  const pin = place(split ? splitBox.left : sun.left, 52);
  const title = {left: padLeft, top: offset + padTop, right: pin.left, bottom: offset + height - padBottom};
  title.x = (title.left + title.right) / 2;
  title.y = (title.top + title.bottom) / 2;
  title.size = title.right - title.left;
  return {height, top: offset, title, pin, split: splitBox, sun, settings};
}

const header = App.header = (ctx, ui, state) => {
  const s = state || {}, width = s.width || 412;
  const at = headerLayout(width, s);
  ctx.save();
  iconButton(ctx, ui, 'PIN', at.pin.left, at.pin.top, 52);
  if (at.split) iconButton(ctx, ui, 'SPLIT', at.split.left, at.split.top, 52);
  App.sunButton(ctx, ui, at.sun.left, at.sun.top, 56, s.mode || 'AUTO', s.t || 0, {sun: !!s.withSun});
  iconButton(ctx, ui, 'SLIDERS', at.settings.left, at.settings.top, 52);
  ctx.restore();
  return at;
};
header.layout = headerLayout;

// ============================================================================================================ demos
/**
 * A whole-screen main page (412 x 915 dp) while dashing: the skyline's street 600 dp down, the counts' words under the
 * header (SkyStage puts them there at this width: 256 x 66 dp, centred, 2/4 dp margins as wordsAt adds), the sun
 * at the header's sun button, and a made-up neighbourhood on the signpost.
 */
scene.demo = {
  width: 412, height: 915, horizonY: 600,
  words: [{left: 74, top: 68, right: 338, bottom: 138}],
  icons: [],
  sun: {x: 310, y: 38, size: 56},
  watching: true, watchingSince: 0.5, place: 'Riverside', t: 14
};
ground.demo = {width: 412, height: 78, top: 915 - 78, t: 14};
header.demo = {width: 412, top: 0, mode: 'AUTO', split: true, t: 14, withSun: false};
})(typeof window !== 'undefined' ? window : globalThis);
