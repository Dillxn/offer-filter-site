/* Port of FilterHeroView in its placed mode, as the main page's sky draws it (SkyStage.compose → place() →
 * drawPlaced): the brush-drawn ring (Enso.java) and its wash, the twinkles on its left, the glazed funnel mascot
 * (drawMascot, drawArm, Mascot.face), an offer played out (drawOfferPlayed, drawTicket, drawBadgePopping,
 * OutcomeBadge.draw) and the three counts (drawCounts, drawCount). Needs base.js (OfferApp.util) loaded first.
 *
 * State (plain data; lengths in dp in the caller's page coordinates, times in seconds):
 *   mascotX, mascotY  the ring's middle (place x, y)
 *   mascotRadius      the ring's outer edge, brush included, from its middle (place radius; SkyStage: 28 to 36 dp,
 *                     36 on a phone). The ring, mascot and ticket are the 88 dp design scaled by mascotRadius / 88.
 *   counts            {left, top, right, bottom}: where the counts stand (place countsBox); 66 dp tall
 *   spacing           how far apart the counts' three columns stand (place spacing)
 *   passed, filtered, review   this dash's counts (FilterHeroView.set dash[]): the big numbers
 *   totals            [passed, filtered, review] since the history was cleared: "N total" under each number
 *   dashLabel         'This dash' | 'Last dash' | 'No dash yet': the heading, "THIS DASH · 13" ("NO DASH YET" alone)
 *   state             'ON' | 'PAUSED' | 'OFF'
 *   ringSince         when the state last changed (s, on the t clock): the ring draws itself over RING_DRAW (1.1 s)
 *                     from then. null/undefined = fully drawn (the app's state at launch is already settled).
 *   offer             {outcome, since} or null: an offer just decided, played out over OFFER (2.6 s) from `since`
 *                     (s); outcome 'PASSED' | 'ACCEPTED' (through the spout), 'DECLINED' (bounced off the sieve),
 *                     'REVIEW' | 'YOURS' | 'REQUESTED' (resting on the sieve). Shown only while state is 'ON'.
 *   t                 the clock (s): Motion.seconds(), which breathing, blinking, waving, twinkles and z's run on.
 *                     Waves come at t = 4.4 to 5.83 s (+ 11 s steps); blinks at t = 5.11 to 5.3 s (+ 5.3 s steps).
 *   clip              optional {left, top, right, bottom}: the hero view's bounds (SkyStage's heroBox, see
 *                     skyPlacement). Android clips a view's drawing to its bounds; on a phone this hides the
 *                     twinkle that would stand at the page's very left edge. Omit to draw unclipped.
 *   pressed           optional boolean: the mascot squishes to 0.93 while pressed (a tap pauses or resumes).
 *
 * Fixed as the contract asks: no tilt (slide() offsets are zero), animations on, default font scale (sp = dp).
 */
(function(root) {
'use strict';
const App = root.OfferApp = root.OfferApp || {};
const U = App.util;

const OFFER = 2.6;            // FilterHeroView.OFFER_MS
const RING_DRAW = 1.1;        // RING_DRAW_MS
const ON_SWEEP = 324, PAUSED_SWEEP = 228;
const RING_OUTER = 88, RING_MIDDLE = 104, COUNTS_HEIGHT = 66;
/** Stars around the ring: dp from the middle across, dp down, and size. */
const TWINKLES = [[-98, 40, 5], [-116, 118, 3.5], [-80, 170, 3], [100, 30, 4], [120, 96, 5.5], [88, 162, 3.5]];
const PAUSED_DASH = [7, 5], DOTTED = [2, 6];
const TAU = Math.PI * 2;

/* ---- Motion (the clock comes from the state) ---- */
const wave = (t, period, phase) => Math.sin((t / period + phase) * TAU);
const loop = (t, period, phase) => { const v = t / period + phase; return v - Math.floor(v); };
/** Motion.settle: eased (cubic out) 0–1 progress since `since`; 1 when there is no start. */
const settle = (t, since, duration) => {
  if (since == null) return 1;
  const u = U.clamp((t - since) / duration, 0, 1);
  return 1 - (1 - u) * (1 - u) * (1 - u);
};

/* ---- Colour helpers, as the Java's ---- */
const f = Math.fround;
/** FilterHeroView.blend: `from` moved a share `at` of the way to `to`, opaque (float maths as Java). */
const blend = (from, to, at) => {
  const ch = (c, s) => (c >>> s) & 255;
  const m = s => Math.round(f(ch(from, s) + f(f(ch(to, s) - ch(from, s)) * f(at))));
  return (0xFF000000 | (m(16) << 16) | (m(8) << 8) | m(0)) >>> 0;
};
/** FilterHeroView.withAlpha: the alpha replaced (clamped 0–255). */
const withAlpha = (c, a) => U.withAlpha(c, Math.trunc(a));
/** OutcomeBadge.withAlpha: the colour's own alpha scaled by `alpha`. */
const scaledAlpha = (c, alpha) => U.withAlpha(c, Math.trunc(((c >>> 24) * U.clamp(alpha, 0, 255)) / 255));
const onStatus = (ui, c) => (c >>> 0) === (ui.WARNING >>> 0) ? 0xFF0B0B0B : 0xFFFFFFFF;
const stateColor = (ui, state) => state === 'ON' ? ui.accent : state === 'PAUSED' ? ui.WARNING : ui.inkMuted;
const outcomeColor = (ui, o) => o === 'PASSED' || o === 'ACCEPTED' ? ui.GOOD : o === 'DECLINED' ? ui.CRITICAL
  : o === 'YOURS' ? ui.NEUTRAL : ui.WARNING;
const lerp = (a, b, at) => a + (b - a) * at;
const easeOut = t => 1 - (1 - t) * (1 - t);

/* ---- Canvas primitives in Android's terms ---- */
function fillCircle(ctx, x, y, r, color) {
  ctx.fillStyle = U.css(color);
  ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fill();
}
/** The `line` paint: a stroke with round caps and joins. */
function strokeStyle(ctx, color, width, dash) {
  ctx.strokeStyle = U.css(color); ctx.lineWidth = width;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.setLineDash(dash || []); ctx.lineDashOffset = 0;
}
/** canvas.drawArc(oval, start, sweep, true, fill): a wedge from the oval's middle. */
function fillWedge(ctx, l, t, r, b, start, sweep, color) {
  const cx = (l + r) / 2, cy = (t + b) / 2;
  ctx.fillStyle = U.css(color);
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.ellipse(cx, cy, (r - l) / 2, (b - t) / 2, 0, U.rad(start), U.rad(start + sweep), sweep < 0);
  ctx.closePath(); ctx.fill();
}
/** canvas.drawArc(oval, start, sweep, false, stroke). */
function strokeArc(ctx, l, t, r, b, start, sweep) {
  U.arcPath(ctx, (l + r) / 2, (t + b) / 2, (r - l) / 2, (b - t) / 2, start, sweep);
  ctx.stroke();
}

/* ---- Text ----
 * Roboto has no ✓ or ✕: Android draws them from its fallback NotoSansSymbols-Regular-Subsetted.ttf (a plain fallback
 * family ahead of the emoji fonts in fonts.xml). Their outlines, copied from that AOSP font (2048 units per em,
 * y down from the baseline), are drawn as paths so every browser shows Android's glyphs. */
const GLYPHS = {
  '✓': {adv: 1698, d: 'M475 65 463 59 457 61 428 90Q428 63 418 63L371 86Q371 70 354 66L338 63Q327 63 320 66Q313 69 297 78L289 62Q241 -15 199.5 -124Q158 -233 142.5 -285Q127 -337 104 -500Q130 -485 139 -485Q152 -485 166 -528Q174 -520 188 -520Q199 -520 207 -528L240 -578L276 -565H279Q285 -565 299.5 -576.5Q314 -588 324 -588L330 -586Q355 -574 371.5 -551.5Q388 -529 395 -496Q429 -340 469 -340Q504 -340 553.5 -418Q603 -496 657 -623Q660 -598 666 -598Q676 -598 687.5 -626Q699 -654 785 -790Q871 -926 1032.5 -1130.5Q1194 -1335 1247 -1372Q1327 -1429 1370 -1475Q1362 -1443 1362 -1434Q1362 -1425 1370 -1425L1427 -1454V-1446Q1427 -1430 1436 -1430Q1442 -1430 1459.5 -1448Q1477 -1466 1481 -1475L1477 -1446L1546 -1487L1530 -1450Q1561 -1473 1577 -1473Q1585 -1473 1589 -1463.5Q1593 -1454 1593 -1446Q1593 -1422 1557 -1378Q1521 -1334 1397 -1197L1300 -1090Q1231 -1008 1034 -739.5Q837 -471 784 -385L657 -171Q576 -31 548.5 4Q521 39 481 70Z'},
  '✕': {adv: 1769, d: 'M1554 156 887 -516 215 156 104 45 776 -631 104 -1307 215 -1417 887 -741 1554 -1417 1665 -1307 993 -631 1665 45Z'}
};
/**
 * paint.drawText at (x, y) baseline, Paint.Align `align`. Fake bold (setFakeBoldText) is FreeType's emboldening as
 * Skia applies it: the outline grown by size/48 on each side, i.e. a stroke of size/24 over the fill.
 */
function text(ctx, str, x, y, size, color, align, fakeBold) {
  ctx.save();
  const css = U.css(color), g = GLYPHS[str];
  ctx.fillStyle = css; ctx.strokeStyle = css; ctx.setLineDash([]);
  if (g) {
    const k = size / 2048, left = align === 'center' ? x - g.adv * k / 2 : align === 'right' ? x - g.adv * k : x;
    if (!g.path) g.path = new root.Path2D(g.d);
    ctx.translate(left, y); ctx.scale(k, k);
    ctx.fill(g.path);
    if (fakeBold) { ctx.lineWidth = 2048 / 24; ctx.lineJoin = 'miter'; ctx.miterLimit = 2; ctx.stroke(g.path); }
  } else {
    ctx.font = U.font(size);
    ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
    if (fakeBold) { ctx.lineWidth = size / 24; ctx.lineJoin = 'miter'; ctx.miterLimit = 2; ctx.strokeText(str, x, y); }
  }
  ctx.restore();
}
/** Centred text with Paint.setLetterSpacing(em): each character's advance grows by em × size, half on each side. */
function spacedText(ctx, str, cx, y, size, em, color, fakeBold) {
  ctx.save();
  ctx.font = U.font(size);
  const sp = em * size, chars = Array.from(str);
  const start = cx - (ctx.measureText(str).width + chars.length * sp) / 2;
  let prefix = '';
  chars.forEach((ch, i) => {
    const x = start + ctx.measureText(prefix).width + i * sp + sp / 2;
    text(ctx, ch, x, y, size, color, 'left', fakeBold);
    prefix += ch;
  });
  ctx.restore();
}

/* ---- Enso.java: one brush-drawn circle, painted as filled outlines ---- */
const START_DEGREES = 118, STEPS = 180;
/** Dry streaks in the lifting brush: offset across it (share of its width), where one starts, widest share. */
const STREAKS = [[-0.22, 0.72, 0.11], [0.2, 0.82, 0.09], [0.0, 0.9, 0.07]];
const smoothstep = (from, to, t) => { const x = U.clamp((t - from) / (to - from), 0, 1); return x * x * (3 - 2 * x); };
/** The stroke's middle line: a circle drawn by hand, drifting a little inward as it closes. */
const wobble = (radius, t) => radius * (1 + 0.011 * Math.sin(TAU * 1.4 * t + 0.6) + 0.005 * Math.sin(TAU * 3.1 * t + 1.3))
  - radius * 0.02 * t * t;
/** Brush width along the stroke, as a share of the full width. */
const profile = t => (t < 0.05 ? 0.72 + 0.28 * (t / 0.05) : 1) * (1 - 0.74 * smoothstep(0.42, 1, t))
  * (1 + 0.05 * Math.sin(11 * t));

/** Fills the band of the stroke from `from` to `to` (shares of the sweep); a negative share is the whole brush. */
function band(ctx, color, cx, cy, radius, thickness, sweep, from, to, offset, share) {
  const first = Math.round(STEPS * from), last = Math.max(first + 1, Math.round(STEPS * to)), count = last - first;
  const outer = [], inner = [];
  for (let i = 0; i <= count; i++) {
    const t = (first + i) / STEPS, angle = U.rad(START_DEGREES + sweep * t);
    const full = thickness * profile(t);
    const width = share < 0 ? full : thickness * share * smoothstep(from, 1, t);
    const middle = wobble(radius, t) + offset * full, cos = Math.cos(angle), sin = Math.sin(angle);
    outer.push(cx + (middle + width / 2) * cos, cy + (middle + width / 2) * sin);
    inner.push(cx + (middle - width / 2) * cos, cy + (middle - width / 2) * sin);
  }
  ctx.fillStyle = U.css(color);
  ctx.beginPath(); ctx.moveTo(outer[0], outer[1]);
  for (let i = 1; i <= count; i++) ctx.lineTo(outer[2 * i], outer[2 * i + 1]);
  for (let i = count; i >= 0; i--) ctx.lineTo(inner[2 * i], inner[2 * i + 1]);
  ctx.closePath(); ctx.fill();
}

/** Enso.draw: the stroke around (cx, cy); `drawn` is the share drawn so far (0–1). Streaks are in the page colour. */
function enso(ctx, color, page, cx, cy, radius, thickness, sweep, drawn) {
  ctx.save();
  const end = Math.max(1 / STEPS, Math.min(1, drawn));
  band(ctx, color, cx, cy, radius, thickness, sweep, 0, end, 0, -1);
  // Where the brush landed is round; where it lifts, it just thins away.
  const landed = U.rad(START_DEGREES), middle = wobble(radius, 0);
  fillCircle(ctx, cx + middle * Math.cos(landed), cy + middle * Math.sin(landed), thickness * profile(0) / 2, color);
  for (const dry of STREAKS) if (end > dry[1]) band(ctx, page, cx, cy, radius, thickness, sweep, dry[1], end, dry[0], dry[2]);
  ctx.restore();
}

/* ---- Mascot.face ---- */
const CHEEK = 0x66F28B8B, TONGUE = 0xFFF07A7A;
/** A face about `size` across, centred at (x, y): 'HAPPY' | 'BLINK' | 'CHEER' | 'SLEEPY' | 'IDLE'. */
function face(ctx, mood, x, y, size, ink) {
  ctx.save();
  const u = size / 28, eyeY = y - 3 * u, eyeX = 6.5 * u;
  strokeStyle(ctx, ink, Math.max(1, 1.8 * u));
  ctx.lineJoin = 'miter';                                   // Mascot's STROKE paint: round cap, default join
  if (mood !== 'IDLE') {
    const radius = 3.8 * u;
    for (let side = -1; side <= 1; side += 2) {
      const bx = x + side * 11 * u, by = y + 3 * u;
      const blush = ctx.createRadialGradient(bx, by, 0, bx, by, radius);
      blush.addColorStop(0, U.css(CHEEK)); blush.addColorStop(0.55, U.css(CHEEK));
      blush.addColorStop(1, U.css(CHEEK & 0x00FFFFFF));
      ctx.fillStyle = blush;
      ctx.beginPath(); ctx.arc(bx, by, radius, 0, TAU); ctx.fill();
    }
  }
  const mouth = () => strokeArc(ctx, x - 4.5 * u, y - 1 * u, x + 4.5 * u, y + 6 * u, 20, 140);
  switch (mood) {
    case 'HAPPY':
      for (let side = -1; side <= 1; side += 2) {
        fillCircle(ctx, x + side * eyeX, eyeY, 2.6 * u, ink);
        fillCircle(ctx, x + side * eyeX - 0.9 * u, eyeY - 1 * u, 0.9 * u, 0xFFFFFFFF);
        fillCircle(ctx, x + side * eyeX + 1.05 * u, eyeY + 1.1 * u, 0.45 * u, 0xFFFFFFFF);
      }
      mouth();
      break;
    case 'BLINK':
      for (let side = -1; side <= 1; side += 2) {
        ctx.beginPath(); ctx.moveTo(x + side * eyeX - 2.4 * u, eyeY); ctx.lineTo(x + side * eyeX + 2.4 * u, eyeY); ctx.stroke();
      }
      mouth();
      break;
    case 'CHEER':
      for (let side = -1; side <= 1; side += 2) {
        strokeArc(ctx, x + side * eyeX - 3 * u, eyeY - 1.5 * u, x + side * eyeX + 3 * u, eyeY + 3.5 * u, 200, 140);
      }
      fillWedge(ctx, x - 4.5 * u, y - 0.5 * u, x + 4.5 * u, y + 6.5 * u, 0, 180, ink);
      fillWedge(ctx, x - 2.4 * u, y + 2.6 * u, x + 2.4 * u, y + 5.9 * u, 0, 180, TONGUE);
      break;
    case 'SLEEPY':
      for (let side = -1; side <= 1; side += 2) {
        strokeArc(ctx, x + side * eyeX - 3 * u, eyeY - 2.5 * u, x + side * eyeX + 3 * u, eyeY + 2 * u, 10, 160);
      }
      ctx.beginPath(); ctx.arc(x, y + 4.5 * u, 1.4 * u, 0, TAU); ctx.stroke();
      break;
    default: // IDLE
      fillCircle(ctx, x - eyeX, eyeY, 1.8 * u, ink);
      fillCircle(ctx, x + eyeX, eyeY, 1.8 * u, ink);
      ctx.beginPath(); ctx.moveTo(x - 3 * u, y + 4.5 * u); ctx.lineTo(x + 3 * u, y + 4.5 * u); ctx.stroke();
  }
  ctx.restore();
}

/* ---- OutcomeBadge.draw ---- */
/** The badge centred at (x, y), ringed in the page's surface, at `alpha` (0–255). */
function badge(ctx, ui, x, y, outcome, alpha) {
  ctx.save();
  const color = outcomeColor(ui, outcome), radius = 7;
  fillCircle(ctx, x, y, radius + 2, scaledAlpha(ui.surface, alpha));
  fillCircle(ctx, x, y, radius, scaledAlpha(color, alpha));
  const ink = scaledAlpha(onStatus(ui, color), alpha);
  if (outcome === 'ACCEPTED') {
    // A shopping bag: its body widens to the bottom; its handle a wide, shallow loop.
    ctx.fillStyle = U.css(ink);
    ctx.beginPath(); ctx.moveTo(x - 3, y - 1.4); ctx.lineTo(x + 3, y - 1.4); ctx.lineTo(x + 3.9, y + 4.4);
    ctx.lineTo(x - 3.9, y + 4.4); ctx.closePath(); ctx.fill();
    strokeStyle(ctx, ink, 1.1); ctx.lineJoin = 'miter';
    strokeArc(ctx, x - 2.1, y - 3.9, x + 2.1, y + 0.6, 180, 180);
  } else if (outcome === 'YOURS') {
    // A person, head and shoulders.
    fillCircle(ctx, x, y - 2.2, 2, ink);
    fillWedge(ctx, x - 3.9, y + 0.9, x + 3.9, y + 8.1, 180, 180, ink);
  } else {
    const size = 10;     // min(sp(10), dp(11))
    text(ctx, outcome === 'PASSED' ? '✓' : outcome === 'DECLINED' ? '✕' : '?', x, y + size / 3, size, ink, 'center', true);
  }
  ctx.restore();
}

/* ---- FilterHeroView ---- */
function ringDrawn(s) {
  return s.state === 'OFF' ? 1 : settle(s.t || 0, s.ringSince, RING_DRAW);
}

/** The brush-drawn ring over a faint wash; the brush breathes a little while on. Off: a faint dotted circle. */
function drawRing(ctx, ui, s, cx) {
  ctx.save();
  const cy = RING_MIDDLE, radius = 82, t = s.t || 0;
  if (s.state === 'OFF') {
    strokeStyle(ctx, withAlpha(ui.inkMuted, 0x80), 1.5, DOTTED);
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, TAU); ctx.stroke();
  } else {
    const color = stateColor(ui, s.state), on = s.state === 'ON';
    fillCircle(ctx, cx, cy, radius - 9, withAlpha(color, 0x12));
    const breathe = on ? 1 + 0.06 * wave(t, 6, 0) : 1;
    enso(ctx, withAlpha(color, on ? 0xD9 : 0xBF), ui.page, cx, cy, radius, 9 * breathe, on ? ON_SWEEP : PAUSED_SWEEP,
      ringDrawn(s));
  }
  ctx.restore();
}

function sparkle(ctx, x, y, half, color) {
  const waist = half * 0.22;
  ctx.fillStyle = U.css(color);
  ctx.beginPath();
  ctx.moveTo(x, y - half);
  ctx.quadraticCurveTo(x + waist, y - waist, x + half, y);
  ctx.quadraticCurveTo(x + waist, y + waist, x, y + half);
  ctx.quadraticCurveTo(x - waist, y + waist, x - half, y);
  ctx.quadraticCurveTo(x - waist, y - waist, x, y - half);
  ctx.closePath(); ctx.fill();
}

/**
 * Small stars around the ring that brighten and fade in turn; none while off and none on the counts; with
 * `leftOnly`, only those on its left. The drawing is scaled by `scale` from (x, y) on the page.
 */
function drawTwinkles(ctx, ui, s, cx, leftOnly, x, y, scale) {
  if (s.state === 'OFF') return;
  ctx.save();
  const color = ui.dark ? 0xFFE9E2C8 : 0xFFE0B94F, margin = 6, box = s.counts, t = s.t || 0;
  TWINKLES.forEach((star, i) => {
    if (leftOnly && star[0] > 0) return;
    const atX = x + (cx + star[0]) * scale, atY = y + star[1] * scale;
    if (box && atX > box.left - margin && atX < box.right + margin && atY > box.top - margin && atY < box.bottom + margin) return;
    const twinkle = 0.5 + 0.5 * wave(t, 2.4 + i * 0.45, i * 0.23);
    sparkle(ctx, cx + star[0], star[1], star[2] * (0.55 + 0.45 * twinkle), withAlpha(color, 40 + 150 * twinkle));
  });
  ctx.restore();
}

/** How far through its playing the offer is (0–1), or -1 for none. */
function offerProgress(s) {
  if (!s.offer || s.state !== 'ON') return -1;
  const since = (s.t || 0) - (s.offer.since || 0);
  return since < 0 || since >= OFFER ? -1 : since / OFFER;
}

/**
 * An offer ticket at (x, y): a little card with "$", under a parachute shown at `chute` (0–1), at `alpha`, scaled
 * and turned by `turn` degrees about its middle.
 */
function drawTicket(ctx, ui, x, y, alpha, chute, scale, turn) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(U.rad(turn)); ctx.scale(scale, scale); ctx.translate(-x, -y);
  if (chute > 0) {
    const shown = Math.trunc(alpha * chute), dome = y - 22;
    strokeStyle(ctx, withAlpha(ui.baseline, shown), 1);
    ctx.beginPath(); ctx.moveTo(x - 12, dome); ctx.lineTo(x - 10, y - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 12, dome); ctx.lineTo(x + 10, y - 8); ctx.stroke();
    fillWedge(ctx, x - 13, dome - 13, x + 13, dome + 13, 180, 180, withAlpha(ui.dark ? 0xFF3D5A85 : 0xFFA9C8F2, shown));
  }
  ctx.fillStyle = U.css(withAlpha(ui.surface, alpha));
  U.rrect(ctx, x - 15, y - 8, x + 15, y + 8, 3, 3); ctx.fill();
  strokeStyle(ctx, withAlpha(ui.baseline, alpha), 1);
  U.rrect(ctx, x - 15, y - 8, x + 15, y + 8, 3, 3); ctx.stroke();
  text(ctx, '$', x, y + 3, 9, withAlpha(ui.inkSecondary, alpha), 'center', true);
  ctx.restore();
}

/** The offer's badge, `since` (a share of the rest of the play) after it appears: it pops, then settles. */
function drawBadgePopping(ctx, ui, outcome, x, y, since, alpha) {
  if (since < 0) return;
  const grow = Math.min(1, since / 0.12);
  const scale = grow < 1 ? grow * 1.15 : 1.15 - 0.15 * Math.min(1, (since - 0.12) / 0.1);
  if (scale <= 0) return;   // Android draws nothing at a zero scale
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale); ctx.translate(-x, -y);
  badge(ctx, ui, x, y, outcome, alpha);
  ctx.restore();
}

/**
 * The offer being played out: the parts the funnel hides (`behind`: a ticket going through), or those in front of it
 * (a ticket on the sieve, the badge). Its last part fades.
 */
function drawOfferPlayed(ctx, ui, s, cx, behind) {
  const t = offerProgress(s);
  if (t < 0) return;
  ctx.save();
  const outcome = s.offer.outcome, rimY = 72, onSieve = rimY - 9, land = 0.32;
  const through = outcome === 'PASSED' || outcome === 'ACCEPTED';
  const fade = Math.trunc(255 * Math.min(1, (1 - t) / 0.18));
  if (t < land) {
    // Down under its parachute onto the sieve.
    if (!behind) {
      const p = easeOut(t / land), sway = (1 - p) * wave(s.t || 0, 3.5, 0);
      drawTicket(ctx, ui, cx + 6 * sway, lerp(16, onSieve, p), 255, 1 - p, 1, 5 * sway);
    }
  } else {
    const p = (t - land) / (1 - land);
    if (through) {
      // Through the sieve (hidden by the funnel), out of the spout to the ground beneath it, and the badge.
      const sink = p / 0.16;
      if (behind && sink < 1) drawTicket(ctx, ui, cx, lerp(onSieve, rimY + 24, sink * sink), 255, 0, 1, 0);
      const out = (p - 0.2) / 0.35;
      if (out >= 0) {
        const y = lerp(154, 170, easeOut(Math.min(1, out)));
        if (behind) drawTicket(ctx, ui, cx, y, fade, 0, 0.75, 0);
        else drawBadgePopping(ctx, ui, outcome, cx + 24, y - 4, p - 0.45, fade);
      }
    } else if (outcome === 'DECLINED') {
      // Caught: it bounces off the sieve and away, the badge where it landed.
      if (!behind) {
        const b = Math.min(1, p / 0.7);
        const y = onSieve - 44 * Math.sin(b * Math.PI * 0.8) + 24 * b * b;
        drawTicket(ctx, ui, cx + 58 * b, y, Math.trunc(255 * (1 - b)), 0, 1 - 0.3 * b, 55 * b);
        drawBadgePopping(ctx, ui, outcome, cx, rimY - 28, p, fade);
      }
    } else if (!behind) {
      // Left on the sieve for the dasher.
      drawTicket(ctx, ui, cx, onSieve, fade, 0, 1, 0);
      drawBadgePopping(ctx, ui, outcome, cx + 19, onSieve - 11, p - 0.05, fade);
    }
  }
  ctx.restore();
}

/** One arm from the shoulder at (x, y), out to `dir`'s side, turned `lift` degrees, a round mitt with a glint. */
function drawArm(ctx, x, y, dir, lift, color, glint) {
  ctx.save();
  if (lift !== 0) { ctx.translate(x, y); ctx.rotate(U.rad(lift)); ctx.translate(-x, -y); }
  strokeStyle(ctx, color, 3);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + dir * 13, y + 5, x + dir * 16, y + 18); ctx.stroke();
  const handX = x + dir * 16.5, handY = y + 21.5;
  fillCircle(ctx, handX, handY, 4.2, color);
  fillCircle(ctx, handX - 1.3, handY - 1.3, 1.3, glint);
  ctx.restore();
}

/** Now and then while on, the right arm lifts and waves for about a second and a half: its turn in degrees. */
function waveAngle(s) {
  if (s.state !== 'ON') return 0;
  const t = loop(s.t || 0, 11, 0.6), span = 0.13;
  if (t > span) return 0;
  const p = t / span, up = Math.sin(p * Math.PI);
  return -up * (75 + 15 * Math.sin(p * Math.PI * 6));
}

/**
 * The mascot: a glazed funnel, lit from the upper left with a shine down its left side, whose rim shows its inside
 * (a sieve while on), narrowing to a collar and a rounded spout, with mittened arms and a face, over a soft shadow.
 */
function drawMascot(ctx, ui, s, cx) {
  ctx.save();
  const state = s.state, color = stateColor(ui, state), off = state === 'OFF', t = s.t || 0;
  const breathe = off ? 0 : wave(t, 4.5, 0);
  const squish = s.pressed ? 0.93 : 1;
  const rimY = 72, half = 62, neckY = 146, neck = 11, spoutY = 164, groundY = 177;

  // Its shadow, a little narrower as it breathes in.
  const shadow = 24 * squish * (1 - 0.04 * breathe);
  ctx.fillStyle = U.css(ui.dark ? 0x59000000 : withAlpha(ui.ink, 0x14));
  ctx.beginPath(); ctx.ellipse(cx, groundY, shadow, 3.5, 0, 0, TAU); ctx.fill();

  ctx.save();
  const k = (1 + 0.012 * breathe) * squish;
  ctx.translate(cx, 150); ctx.scale(k, k); ctx.translate(-cx, -150);
  const armY = 104, side = half - (half - neck) * (armY - rimY) / (neckY - rimY);
  const glint = blend(color, 0xFFFFFFFF, 0.55), lift = waveAngle(s);
  drawArm(ctx, cx - side, armY, -1, 0, color, glint);
  if (lift === 0) drawArm(ctx, cx + side, armY, 1, 0, color, glint);

  const round = 3.5;
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(cx - half, rimY);
    ctx.lineTo(cx - neck, neckY);
    ctx.lineTo(cx - neck, spoutY - round);
    ctx.quadraticCurveTo(cx - neck, spoutY, cx - neck + round, spoutY);
    ctx.lineTo(cx + neck - round, spoutY);
    ctx.quadraticCurveTo(cx + neck, spoutY, cx + neck, spoutY - round);
    ctx.lineTo(cx + neck, neckY);
    ctx.lineTo(cx + half, rimY);
    ctx.closePath();
  };
  // The glaze: lighter on the left, deeper on the right.
  const glaze = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
  glaze.addColorStop(0, U.css(blend(ui.surface, color, off ? 0.05 : 0.09)));
  glaze.addColorStop(1, U.css(blend(ui.surface, color, off ? 0.14 : 0.30)));
  ctx.fillStyle = glaze; body(); ctx.fill();
  // The shine: a long stroke down the left side, a gap, a dot.
  const shine = withAlpha(0xFFFFFFFF, ui.dark ? (off ? 0x1C : 0x30) : (off ? 0x99 : 0xC8));
  const shineX = at => cx - lerp(half, neck, at) + 9 * (1 - 0.35 * at);
  strokeStyle(ctx, shine, 3.5);
  ctx.beginPath();
  ctx.moveTo(shineX(0.13), lerp(rimY, neckY, 0.13)); ctx.lineTo(shineX(0.40), lerp(rimY, neckY, 0.40));
  ctx.stroke();
  fillCircle(ctx, shineX(0.51), lerp(rimY, neckY, 0.51), 1.9, shine);
  strokeStyle(ctx, color, 2.5, state === 'PAUSED' ? PAUSED_DASH : null);
  body(); ctx.stroke();

  // The collar where the body meets the spout.
  ctx.fillStyle = U.css(blend(ui.surface, color, off ? 0.2 : 0.38));
  U.rrect(ctx, cx - neck - 2.5, neckY - 1.5, cx + neck + 2.5, neckY + 4.5, 3, 3); ctx.fill();
  strokeStyle(ctx, color, 2);
  U.rrect(ctx, cx - neck - 2.5, neckY - 1.5, cx + neck + 2.5, neckY + 4.5, 3, 3); ctx.stroke();
  // A waving arm is in front of the body.
  if (lift !== 0) drawArm(ctx, cx + side, armY, 1, lift, color, glint);

  // The rim, its inside darker toward the near wall.
  const depth = ctx.createLinearGradient(0, rimY - 12, 0, rimY + 12);
  depth.addColorStop(0, U.css(blend(ui.surface, color, off ? 0.08 : 0.16)));
  depth.addColorStop(1, U.css(blend(ui.surface, color, off ? 0.2 : 0.42)));
  ctx.fillStyle = depth;
  ctx.beginPath(); ctx.ellipse(cx, rimY, half, 12, 0, 0, TAU); ctx.fill();
  if (state === 'ON') {
    for (let row = -1; row <= 1; row++) {
      for (let col = -4; col <= 4; col++) {
        const x = cx + col * 12 + (row === 0 ? 6 : 0), y = rimY + row * 5;
        const dx = (x - cx) / (half - 9), dy = (y - rimY) / 8;
        if (dx * dx + dy * dy <= 1) fillCircle(ctx, x, y, 1.6, withAlpha(color, 0xA0));
      }
    }
  }
  strokeStyle(ctx, color, 2.5, state === 'PAUSED' ? PAUSED_DASH : null);
  ctx.beginPath(); ctx.ellipse(cx, rimY, half, 12, 0, 0, TAU); ctx.stroke();
  // A glint on the far lip.
  strokeStyle(ctx, shine, 2);
  strokeArc(ctx, cx - half + 5, rimY - 12 + 3.5, cx + half - 5, rimY + 12 - 3.5, 208, 34);

  // A blink every few seconds while awake.
  const blink = state === 'ON' && loop(t, 5.3, 0) > 0.965;
  const mood = lift !== 0 ? 'CHEER' : blink ? 'BLINK' : state === 'ON' ? 'HAPPY' : state === 'PAUSED' ? 'SLEEPY' : 'IDLE';
  face(ctx, mood, cx, 110, 40, off ? ui.inkMuted : ui.ink);
  ctx.restore();

  if (state === 'PAUSED') {
    const z = loop(t, 3.2, 0);
    text(ctx, 'z', cx + 36 + 10 * z, 92 - 28 * z, 12 + 6 * z, withAlpha(ui.inkSecondary, 255 * (1 - z)), 'center', true);
  }
  ctx.restore();
}

/** One count: its badge (✓ ✕ ?) and number, and under them the all-time total. */
function drawCount(ctx, ui, x, top, result, count, total, live) {
  ctx.save();
  const color = result === 'KEEP' ? ui.GOOD : result === 'DECLINE' ? ui.CRITICAL : ui.WARNING;
  const numberSize = 18;                         // min(sp(18), dp(26))
  const number = String(count), badgeR = 8;
  ctx.font = U.font(numberSize);
  const rowWidth = badgeR * 2 + 6 + ctx.measureText(number).width, left = x - rowWidth / 2;
  fillCircle(ctx, left + badgeR, top, badgeR, withAlpha(color, live ? 0xFF : 0x60));
  const m = U.metrics(numberSize);
  text(ctx, number, left + badgeR * 2 + 6, top - (m.ascent + m.descent) / 2, numberSize, live ? ui.ink : ui.inkMuted,
    'left', true);
  text(ctx, result === 'KEEP' ? '✓' : result === 'DECLINE' ? '✕' : '?', left + badgeR, top + 9 / 3, 9,
    withAlpha(onStatus(ui, color), live ? 0xFF : 0xB0), 'center', true);
  const totalSize = 11;                          // min(sp(11), dp(15))
  text(ctx, total + ' total', x, top + 24 + totalSize / 2, totalSize, ui.inkMuted, 'center', false);
  ctx.restore();
}

/** "THIS DASH · 13" over three counts, each a badge and its number with, under it, the all-time total. */
function drawCounts(ctx, ui, s, cx, spacing, top) {
  ctx.save();
  const passed = s.passed || 0, filtered = s.filtered || 0, review = s.review || 0;
  const totals = s.totals || [0, 0, 0], label = s.dashLabel || 'No dash yet';
  const size = 10;                               // min(sp(10), dp(14))
  const heading = label.startsWith('No') ? label : label + ' · ' + (passed + filtered + review);
  spacedText(ctx, heading.toUpperCase(), cx, top + 8 - U.metrics(size).ascent / 2, size, 0.12, ui.inkMuted, true);
  const row = top + 30;
  drawCount(ctx, ui, cx - spacing, row, 'KEEP', passed, totals[0], s.state !== 'OFF');
  drawCount(ctx, ui, cx, row, 'DECLINE', filtered, totals[1], s.state === 'ON');
  drawCount(ctx, ui, cx + spacing, row, 'REVIEW', review, totals[2], s.state !== 'OFF');
  ctx.restore();
}

/**
 * FilterHeroView.drawPlaced: the ring, the mascot and its ticket scaled to the ring's radius around its middle, the
 * few stars on its left, and the counts where they were placed.
 */
function draw(ctx, ui, s) {
  ctx.save();
  if (s.clip) {
    ctx.beginPath();
    ctx.rect(s.clip.left, s.clip.top, s.clip.right - s.clip.left, s.clip.bottom - s.clip.top);
    ctx.clip();
  }
  const scale = s.mascotRadius / RING_OUTER;
  ctx.save();
  ctx.translate(s.mascotX, s.mascotY); ctx.scale(scale, scale); ctx.translate(0, -RING_MIDDLE);
  drawRing(ctx, ui, s, 0);
  drawTwinkles(ctx, ui, s, 0, true, s.mascotX, s.mascotY - RING_MIDDLE * scale, scale);
  // The app plays one offer at a time, the newest replacing any still playing (its offers come minutes apart); a
  // film's quicker offers may pass `offers`, each {outcome, since}, so one can finish while the next drops in.
  const played = s.offers ? s.offers.map(offer => Object.assign({}, s, {offer})) : [s];
  for (const p of played) drawOfferPlayed(ctx, ui, p, 0, true);
  drawMascot(ctx, ui, s, 0);
  for (const p of played) drawOfferPlayed(ctx, ui, p, 0, false);
  ctx.restore();
  if (s.counts) drawCounts(ctx, ui, s, (s.counts.left + s.counts.right) / 2, s.spacing, s.counts.top);
  ctx.restore();
}

/* ---- Layout, as FilterHeroView and SkyStage work it out (dp) ---- */
/** How tall the counts are: the heading, the numbers and the totals under them. */
const countsHeight = () => COUNTS_HEIGHT;
/** How far apart the counts' three columns stand in `room` of width. */
const countsSpacing = room => Math.min(96, room * 0.3);
/** How wide the three counts are with their columns `spacing` apart. */
const countsWidth = spacing => 2 * spacing + 64;

/**
 * Where the main page's sky (SkyStage.placeCounts and compose) puts the counts and the mascot on a page `width` dp
 * wide, with MainActivity.header()'s row along the top: padding 20/10/12/4, at least 62 tall, the empty title taking
 * the spare width, then Navigate (52), Split with Dasher (52, 4 after; only while Dasher is installed and not already
 * beside), the sun (56, 10 after) and Settings (52). The row is 10 + 56 + 4 = 70 dp tall.
 * The counts go beside the buttons when their columns get at least 60 dp there (title room × 0.3); otherwise they
 * are centred under the header. On a 412 dp phone the title gets 154 dp with the split button (counts under the
 * header) and 210 dp without it (counts beside). `mascotRadius` is SkyStage's min(36, room by the constellation's
 * spokes), at least 28: 36 on a phone. Answers the state's placement fields plus `clip` (the hero view's bounds).
 * opts: {width = 412, splitShown = false, mascotRadius = 36, headerHeight (override)}
 */
function skyPlacement(opts) {
  const o = opts || {}, width = o.width || 412, radius = o.mascotRadius || 36;
  const buttons = 52 + (o.splitShown ? 52 + 4 : 0) + 56 + 10 + 52;
  const headerHeight = o.headerHeight != null ? o.headerHeight : Math.max(62, 10 + 56 + 4);
  const titleRoom = Math.max(0, width - 20 - 12 - buttons);
  let spacing = countsSpacing(titleRoom), counts, beside = spacing >= 60;
  if (beside) {
    const wide = countsWidth(spacing), top = Math.max(0, (headerHeight - COUNTS_HEIGHT) / 2);
    counts = {left: 20, top, right: 20 + wide, bottom: top + COUNTS_HEIGHT};
  } else {
    spacing = countsSpacing(width - 2 * 16);
    const wide = countsWidth(spacing);
    counts = {left: (width - wide) / 2, top: headerHeight, right: (width + wide) / 2, bottom: headerHeight + COUNTS_HEIGHT};
  }
  const top = Math.max(headerHeight, counts.bottom) + 4;
  const mascotX = radius + 6, mascotY = top + radius + 2;
  const clip = {
    left: Math.floor(Math.min(counts.left, mascotX - radius)), top: Math.floor(Math.min(counts.top, mascotY - radius)),
    right: Math.ceil(Math.max(counts.right, mascotX + radius)), bottom: Math.ceil(Math.max(counts.bottom, mascotY + radius))
  };
  return {headerHeight, titleRoom, beside, counts, spacing, mascotX, mascotY, mascotRadius: radius, clip};
}

/* ---- Demo states (invented numbers) ----
 * The page as the film's phone shows it: 412 dp wide, counts beside the header's buttons (split button hidden).
 * Each is a plain object: copy it and set `t` (and `offer.since`, `ringSince`) on the film's clock. */
const place = skyPlacement({width: 412, splitShown: false});
const base = Object.assign({}, place, {
  state: 'ON', dashLabel: 'This dash', passed: 3, filtered: 9, review: 1, totals: [46, 128, 11],
  ringSince: null, offer: null, t: 2
});
const demo = {
  /** On, mid-dash: 3 passed, 9 filtered, 1 to review. */
  on: Object.assign({}, base),
  /** An offer bouncing off the sieve: play-out from offer.since over 2.6 s (counts already include it). */
  declining: Object.assign({}, base, {offer: {outcome: 'DECLINED', since: 1}, t: 2.2}),
  /** An offer passing through the spout. */
  passing: Object.assign({}, base, {passed: 4, totals: [47, 128, 11], offer: {outcome: 'PASSED', since: 1}, t: 2.4}),
  /** An offer left on the sieve to review. */
  review: Object.assign({}, base, {review: 2, totals: [46, 128, 12], offer: {outcome: 'REVIEW', since: 1}, t: 2.2}),
  /** Paused: the amber two-thirds ring drawing itself in from ringSince, the mascot asleep with drifting z's. */
  paused: Object.assign({}, base, {state: 'PAUSED', ringSince: 0, t: 2}),
  /** Off: no rules yet. Grey, still, a faint dotted ring; no dash yet. */
  off: Object.assign({}, base, {state: 'OFF', dashLabel: 'No dash yet', passed: 0, filtered: 0, review: 0,
    totals: [0, 0, 0]})
};

App.hero = {
  OFFER, RING_DRAW, RING_OUTER, RING_MIDDLE,
  countsHeight, countsSpacing, countsWidth, skyPlacement,
  draw, demo,
  /** Pieces other views share: Enso.draw, Mascot.face, OutcomeBadge.draw, text with Android's fake bold. */
  parts: {enso, face, badge, text, ringDrawn, offerProgress}
};
})(typeof window !== 'undefined' ? window : globalThis);
