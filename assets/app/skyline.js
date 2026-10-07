/* Offer Filter app → canvas: the main page's skyline of recent offers (DecisionChartView, with OutcomeBadge's flags),
 * one offer as a picture (OfferCardView, with the Glyph icons it uses) and the caption line naming the chosen offer
 * (MainActivity.refreshOfferCaption / captionOutcome / when). Ported from the app's Java onDraw code. Units are dp.
 * Load after base.js.
 *
 * OfferApp.skyline.draw(ctx, ui, state) — DecisionChartView. state:
 *   width, height        the view, dp. On the 412 dp page it is 380 wide (16 dp page padding each side); its height is
 *                        the ground's share (about 120), never under skyline.least() (64; 52 in a short window).
 *   entries              recent offers, OLDEST FIRST (Entry below). Only the newest 14 (SLOTS) are drawn, right-aligned.
 *   selected             index into entries of the chosen building, or -1. The app chooses the newest by default.
 *   payoutCents          the solid pay rail: current overall payout minimum in cents, already scaled (0 = no rail).
 *   minimumScalePercent  the dashed tree rail: the score cutoff in percent (default 100).
 *   scoreByArea          rail captions "Pay $4 spoke" / "Score 100% min" (by area), else "Pay $4 min" / "Score 100% ref".
 *   t                    the film's clock, seconds.
 *   riseSince            seconds: when the skyline first showed; offer i rises from riseSince + 0.045·i over 0.65 s,
 *                        eased. Omit (null) for a risen skyline.
 *   selectedSince        seconds: when `selected` was chosen; its spotlight fades in over 0.3 s. Omit = shown.
 * Entry (DecisionLog.Entry, flattened; also the ticket's and the caption's input):
 *   at                   ms since the epoch, read as UTC wall-clock (Date.UTC(...)): the offer's identity and time.
 *   pay                  cents, or null when pay was not read (a signpost instead of a building).
 *   miles, minutes, stops  read facts, or null (unknown).
 *   items, itemCountApplicable, hotspotMiles   optional facts the ticket shows on lines of their own.
 *   required             cents the offer's rules required (the ink tick); 0 = none; Infinity = out of reach.
 *   score                the recorded area score, whole percent; -1 = unavailable (an open marker, no tree).
 *   result               what the rules said: 'KEEP' | 'DECLINE' | 'REVIEW' (building and pay-bar colour).
 *   outcome              what became of it (the flag): 'PASSED' | 'DECLINED' | 'REVIEW' | 'YOURS' | 'ACCEPTED' |
 *                        'REQUESTED'; when omitted, the rules' result (PASSED / DECLINED / REVIEW).
 *   steps                optional [{kind, detail}] learning steps (DecisionLog.StepKind names): the caption's wording
 *                        of an acceptance ("Accepted by you", "Automatically accepted").
 *   riseSince            optional seconds: this offer alone rises from then (a new arrival).
 *   addOn                optional boolean.
 * Layout helpers: skyline.least(compact), skyline.layout(state), flagAt(state, index) / treeAt(state, index) (index
 *   into state.entries, as `selected`), highestWithin(state, fromX, toX), payoutThresholdY / scoreThresholdY(state),
 *   HORIZON_INSET_DP (the scene's horizon is 11 dp above the chart's bottom), badge / quietBadge (OutcomeBadge).
 *
 * OfferApp.ticket.draw(ctx, ui, {width, height, entry}) — OfferCardView: pay against needed, the route. In the app it
 *   sits in the ticket (16 dp padding) in the bottom sheet (16 dp padding), so on the 412 dp page it is 348 wide; its
 *   height is ticket.measure(ctx, width, entry).height (95 dp for a plain offer; more with item or hotspot lines).
 *
 * OfferApp.caption(entry, {latest | entries, ready}) → "Latest · $4.25 · Declined": the line under the sky. With no
 *   entry, "Waiting for offers" (ready, the default) or "No offers yet.". caption.when(at, now) → "6:11 PM" or
 *   "Oct 5, 6:11 PM"; caption.description(...) its spoken form; caption.stubTime(entry, now) the ticket stub's time
 *   line; caption.draw(ctx, ui, {width, height, text}) the TextView (13 sp medium ink, centred, 48 dp tall).
 */
(function(root) {
'use strict';
const App = root.OfferApp = root.OfferApp || {};
const U = App.util;

// ---- Shared: text as Android paints it, money and numbers as Java formats them ----

/** One device pixel on a 412 dp wide phone (1080 px, density 2.625): the Java's one-pixel minimums. */
const PX = 1 / 2.625;
/** After the system sans, fonts with ✓ ✕ →: Roboto lacks them, and Android draws them from its symbol fallbacks. */
const FALLBACK = ', "Noto Sans Symbols 2", "Noto Sans Symbols", "DejaVu Sans", "Segoe UI Symbol", "Apple Symbols"';
const font = (size, medium) => U.font(size, medium) + FALLBACK;

/**
 * Paint.setFakeBoldText on Android: FreeType emboldens each outline by text size / 34 in all (Skia's Android
 * divisor), each edge moving out half that; a stroke of that width over the fill does the same. With a translucent
 * colour the stroke's inner half doubles over the fill, so a faded symbol's edge is a touch denser than Android's.
 */
const boldStroke = size => size / 34;

function text(ctx, s, x, y, size, color, align, medium, fakeBold) {
  ctx.font = font(size, medium);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = U.css(color);
  ctx.fillText(s, x, y);
  if (!fakeBold) return;
  ctx.strokeStyle = U.css(color);
  ctx.lineWidth = boldStroke(size);
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 4;
  ctx.setLineDash([]);
  ctx.strokeText(s, x, y);
}

/** Ui.fit: shrinks the size (to minFraction at least) until s fits maxWidth, then ellipsizes what still does not. */
function fit(ctx, s, size, maxWidth, minFraction, medium) {
  ctx.font = font(size, medium);
  const width = ctx.measureText(s).width;
  if (width > maxWidth && width > 0) size = Math.max(size * minFraction, size * maxWidth / width);
  ctx.font = font(size, medium);
  const avail = Math.max(0, maxWidth);
  if (ctx.measureText(s).width <= avail) return {text: s, size};
  // TextUtils.ellipsize(END): as much as fits before "…".
  for (let n = s.length - 1; n > 0; n--) {
    const cut = s.slice(0, n) + '…';
    if (ctx.measureText(cut).width <= avail) return {text: cut, size};
  }
  return {text: '', size};
}

function line(ctx, color, width, cap, x1, y1, x2, y2, dash) {
  ctx.strokeStyle = U.css(color);
  ctx.lineWidth = width;
  ctx.lineCap = cap;
  ctx.setLineDash(dash || []);
  ctx.lineDashOffset = 0;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}

/** Java's String.format("%.Nf"): HALF_UP on the value's shortest decimal form (toFixed rounds its binary value). */
function fixed(value, digits) {
  const s = String(Math.abs(value));
  if (!isFinite(value) || /e/i.test(s)) return value.toFixed(digits);
  const [whole, frac = ''] = s.split('.');
  let n = BigInt(whole + frac.slice(0, digits).padEnd(digits, '0'));
  if ((frac[digits] || '0') >= '5') n += 1n;
  let out = n.toString().padStart(digits + 1, '0');
  if (digits > 0) out = out.slice(0, -digits) + '.' + out.slice(-digits);
  return (value < 0 && /[1-9]/.test(out) ? '-' : '') + out;
}

/** DecisionLog.money: "$7.25". */
const money = cents => '$' + fixed(cents / 100, 2);
/** DecisionLog.shortMoney: "$7" for whole dollars, otherwise "$7.50". */
const shortMoney = cents => cents % 100 === 0 ? '$' + Math.trunc(cents / 100) : money(cents);

/** Motion.settle: eased 0–1 progress from `since` over `duration` seconds; at rest (1) with no start. */
function settle(since, duration, t) {
  if (since == null) return 1;
  const k = Math.min(1, Math.max(0, ((t || 0) - since) / duration));
  return 1 - (1 - k) * (1 - k) * (1 - k);
}

// ---- Outcomes (DecisionLog.Outcome) and their badge (OutcomeBadge) ----

const SAID = {PASSED: 'Passed', DECLINED: 'Declined', REVIEW: 'Review', YOURS: 'Left to you', ACCEPTED: 'Accepted',
  REQUESTED: 'Accept requested, not confirmed'};
const VERDICT = {KEEP: 'PASSED', DECLINE: 'DECLINED', REVIEW: 'REVIEW'};
const outcomeOf = e => e.outcome || VERDICT[e.result] || 'REVIEW';

/** Ui.outcomeColor: accepted and passed good, declined critical, yours neutral, the rest (review, requested) warning. */
function outcomeColor(ui, outcome) {
  return outcome === 'PASSED' || outcome === 'ACCEPTED' ? ui.GOOD : outcome === 'DECLINED' ? ui.CRITICAL
    : outcome === 'YOURS' ? ui.NEUTRAL : ui.WARNING;
}
/** Ui.onStatus: the pale warning fill takes dark ink. */
const onStatus = (ui, color) => color === ui.WARNING ? 0xFF0B0B0B : 0xFFFFFFFF;
/** OutcomeBadge.withAlpha: the colour's own alpha scaled by alpha (0–255). */
const badgeAlpha = (color, alpha) =>
  ((color & 0xFFFFFF) | ((Math.trunc(((color >>> 24) * Math.max(0, Math.min(255, alpha))) / 255)) << 24)) >>> 0;

/** OutcomeBadge.draw: the outcome's colour with its symbol, ringed in the page's surface, at alpha (0–255). */
function badge(ctx, ui, x, y, outcome, alpha) {
  alpha = alpha == null ? 255 : alpha;
  ctx.save();
  const color = outcomeColor(ui, outcome);
  const radius = 7;
  ctx.fillStyle = U.css(badgeAlpha(ui.surface, alpha));
  circle(ctx, x, y, radius + 2);
  ctx.fill();
  ctx.fillStyle = U.css(badgeAlpha(color, alpha));
  circle(ctx, x, y, radius);
  ctx.fill();
  symbol(ctx, x, y, outcome, badgeAlpha(onStatus(ui, color), alpha));
  ctx.restore();
}

/** OutcomeBadge.drawQuiet: a quiet roof mark for history, the symbol alone in secondary ink. */
function quietBadge(ctx, ui, x, y, outcome) {
  ctx.save();
  symbol(ctx, x, y, outcome, ui.inkSecondary);
  ctx.restore();
}

function symbol(ctx, x, y, outcome, ink) {
  if (outcome === 'ACCEPTED') {
    // A shopping bag: its body widens to the bottom, its handle a wide, shallow loop.
    ctx.fillStyle = U.css(ink);
    ctx.beginPath();
    ctx.moveTo(x - 3, y - 1.4);
    ctx.lineTo(x + 3, y - 1.4);
    ctx.lineTo(x + 3.9, y + 4.4);
    ctx.lineTo(x - 3.9, y + 4.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = U.css(ink);
    ctx.lineWidth = Math.max(PX, 1.1);
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    U.arcPath(ctx, x, y - 1.65, 2.1, 2.25, 180, 180);
    ctx.stroke();
  } else if (outcome === 'YOURS') {
    // A person, head and shoulders.
    ctx.fillStyle = U.css(ink);
    circle(ctx, x, y - 2.2, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y + 4.5);
    ctx.ellipse(x, y + 4.5, 3.9, 3.6, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  } else {
    // The symbol belongs to its circle: min(10 sp, 11 dp), bold, centred a third of its size below the middle.
    const size = Math.min(10, 11), mark = outcome === 'PASSED' ? '✓' : outcome === 'DECLINED' ? '✕' : '?';
    // ✓ and ✕ from the hero's outlines of Android's symbol fallback, the same in every browser and the renderer.
    if (mark !== '?' && App.hero && App.hero.parts) App.hero.parts.text(ctx, mark, x, y + size / 3, size, ink, 'center', true);
    else text(ctx, mark, x, y + size / 3, size, ink, 'center', false, true);
  }
}

// ---- The skyline (DecisionChartView) ----

const SLOTS = 14;
const SIDE = 4;
const RISE = 0.65;
/** Values above $1,000 are drawn at the top of the scale. */
const SCALE_CAP = 100000;
/** Larger scores end in a chevron; one outlier must not flatten the ordinary score range. */
const SCORE_CAP = 400;
const NICE_DOLLARS = [10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200, 300, 500, 1000];

const treeColor = ui => ui.dark ? 0xFF9DD6B6 : 0xFF32664F;
const payoutColor = ui => ui.dark ? 0xFFF1C58B : 0xFF865423;

/** The smallest "nice" dollar ceiling at or above every pay and requirement shown. */
function scaleMax(entries, payout) {
  let max = payout;
  for (const e of entries) {
    if (e.pay != null) max = Math.max(max, e.pay);
    max = Math.max(max, Math.min(e.required || 0, SCALE_CAP));
  }
  for (const dollars of NICE_DOLLARS) if (dollars * 100 >= max) return dollars * 100;
  return Math.max(SCALE_CAP, payout);
}

/** Percent scale, independent of payouts; unknown scores contribute nothing. */
function scoreScaleMax(entries, minimumScale) {
  let max = Math.max(100, minimumScale);
  for (const e of entries) max = Math.max(max, Math.min(SCORE_CAP, e.score == null ? -1 : e.score));
  for (const ceiling of [150, 200, 250, 300, SCORE_CAP]) if (ceiling >= max) return ceiling;
  return SCORE_CAP;
}

const yOf = (value, max, top, bottom) => bottom - (bottom - top) * Math.min(Math.max(0, value), max) / max;

/** Everything the drawing derives from the state: plot edges, slot sizes and the two scales. */
function layout(s) {
  const all = s.entries || [];
  const skip = Math.max(0, all.length - SLOTS);
  const entries = all.slice(skip);
  const width = s.width, height = s.height;
  const top = Math.min(26, height * 0.40);
  // The 10 sp caption strip under the street: max(15 dp, 10 sp × 1.3 + 3 dp).
  const bottom = Math.max(top, height - Math.max(15, 10 * 1.3 + 3));
  const slot = Math.max(0, width - SIDE * 2) / SLOTS;
  const payout = s.payoutCents > 0 ? s.payoutCents : 0;
  const minimumScale = s.minimumScalePercent == null ? 100 : s.minimumScalePercent;
  return {
    entries, skip, width, height, top, bottom, left: SIDE, right: width - SIDE, slot,
    barWidth: Math.max(PX, Math.min(21, slot * 0.66)),
    treeWidth: Math.max(PX, Math.min(9, slot * 0.28)),
    first: SLOTS - entries.length,
    selected: s.selected == null || s.selected < 0 ? -1 : s.selected - skip,
    payout, minimumScale, byArea: !!s.scoreByArea,
    maxCents: scaleMax(entries, payout), maxScore: scoreScaleMax(entries, minimumScale)
  };
}
const buildingCenter = (L, i) => SIDE + L.slot * (L.first + i + 0.34);
const treeCenter = (L, i) => SIDE + L.slot * (L.first + i + 0.82);
const payoutY = L => L.payout > 0 ? yOf(L.payout, L.maxCents, L.top, L.bottom) : NaN;
const scoreY = L => yOf(L.minimumScale, L.maxScore, L.top, L.bottom);

function draw(ctx, ui, s) {
  const L = layout(s);
  const {entries, top, bottom, left, right} = L;
  if (right <= left || bottom <= top) return;
  ctx.save();
  if (!entries.length) {
    text(ctx, 'No offers recorded yet', L.width / 2, L.height / 2, 11, ui.inkSecondary, 'center');
    ctx.restore();
    return;
  }
  const t = s.t || 0;
  const barWidth = L.barWidth, treeWidth = L.treeWidth;
  const spotlight = settle(s.selectedSince, 0.3, t);
  if (L.selected >= 0 && L.selected < entries.length) {
    drawSpotlight(ctx, ui, left + L.slot * (L.first + L.selected + 0.5), barWidth, bottom, L.height, spotlight);
  }
  // The street sits underneath measured-zero marks, so a zero tree stays visibly distinct from unknown.
  ctx.fillStyle = U.css(ui.gridline);
  U.rrect(ctx, left, bottom, right, bottom + 3, 1.5);
  ctx.fill();
  // The guides go under the data so the score crown and building roof remain visible at a crossing.
  if (L.payout > 0) line(ctx, payoutColor(ui), 1, 'butt', left, payoutY(L), right, payoutY(L));
  line(ctx, treeColor(ui), 1, 'butt', left, scoreY(L), right, scoreY(L), [4, 3]);
  // The Java's one line paint keeps its cap from drawing to drawing: BUTT after the rails, ROUND once a requirement
  // tick or a tree has set it (the signpost and flag poles take whichever it is).
  let cap = 'butt';
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const center = buildingCenter(L, i), treeX = treeCenter(L, i);
    const since = e.riseSince != null ? e.riseSince : s.riseSince != null ? s.riseSince + i * 0.045 : null;
    const rise = settle(since, RISE, t);
    let roof = bottom;
    if (e.pay != null) {
      roof = bottom - (bottom - yOf(e.pay, L.maxCents, top, bottom)) * rise;
      if (rise > 0) drawBuilding(ctx, ui, center - barWidth / 2, roof, center + barWidth / 2, bottom, e.result);
    } else {
      // Pay not read: a signpost at street level instead of a building.
      line(ctx, ui.baseline, 2, cap, center, bottom, center, bottom - 12);
      roof = bottom - 14;
    }
    if (e.required > 0) {
      // The ink tick: the pay this offer's rules required.
      const rope = yOf(e.required, L.maxCents, top, bottom);
      cap = 'round';
      line(ctx, ui.ink, 2, cap, center - barWidth / 2, rope, center + barWidth / 2, rope);
    }
    const score = e.score == null ? -1 : e.score;
    if (score >= 0) {
      const tip = bottom - (bottom - yOf(score, L.maxScore, top, bottom)) * rise;
      if (rise > 0) {
        cap = 'round';
        drawTree(ctx, ui, treeX, tip, bottom, treeWidth);
        if (score > SCORE_CAP) {
          const half = treeWidth * 0.4;
          line(ctx, treeColor(ui), Math.max(PX, 1), cap, treeX - half, tip - 2, treeX, tip - 4);
          line(ctx, treeColor(ui), Math.max(PX, 1), cap, treeX, tip - 4, treeX + half, tip - 2);
        }
      }
    } else {
      // Unavailable and measured zero are distinct: an open ring versus a flat filled mark.
      ctx.strokeStyle = U.css(ui.inkSecondary);
      ctx.lineWidth = Math.max(PX, 1);
      ctx.setLineDash([]);
      circle(ctx, treeX, bottom - 2, Math.min(2, treeWidth / 3));
      ctx.stroke();
    }
    if (rise <= 0) continue;
    // A flag on a short pole on the roof, kept whole inside the view however tall its building.
    line(ctx, ui.baseline, Math.max(PX, 1.5), cap, center, roof, center, roof - 5);
    const flagY = Math.max(roof - 12, 10);
    if (i === L.selected) badge(ctx, ui, center, flagY, outcomeOf(e), 255);
    else quietBadge(ctx, ui, center, flagY, outcomeOf(e));
  }
  if (L.payout > 0) {
    railLabel(ctx, L, 'Pay ' + shortMoney(L.payout) + (L.byArea ? ' spoke' : ' min'), left, false, payoutColor(ui));
  }
  railLabel(ctx, L, 'Score ' + L.minimumScale + (L.byArea ? '% min' : '% ref'), right, true, treeColor(ui));
  ctx.restore();
}

/** A soft beam from the top of the chart down onto the selected building, and a mark under it. */
function drawSpotlight(ctx, ui, center, barWidth, bottom, height, shown) {
  ctx.beginPath();
  ctx.moveTo(center - 4, 0);
  ctx.lineTo(center + 4, 0);
  ctx.lineTo(center + barWidth / 2 + 8, bottom);
  ctx.lineTo(center - barWidth / 2 - 8, bottom);
  ctx.closePath();
  ctx.fillStyle = U.css(U.withAlpha(ui.accent, Math.round(0x12 * shown)));
  ctx.fill();
  ctx.fillStyle = U.css(U.withAlpha(ui.accent, Math.round(0xFF * shown)));
  U.rrect(ctx, center - barWidth / 2, height - 1.5, center + barWidth / 2, height, 0.75);
  ctx.fill();
}

/** A building with a rounded roofline and a grid of windows, lit when the offer passed. */
function drawBuilding(ctx, ui, l, t, r, b, result) {
  // Buildings belong to the landscape; the selected outcome badge carries the strong status colour.
  const color = result === 'KEEP' ? (ui.dark ? 0xFF557B63 : 0xFF78927D)
    : result === 'DECLINE' ? (ui.dark ? 0xFF87645E : 0xFFAA8C81) : (ui.dark ? 0xFF998454 : 0xFFBDAC85);
  const radius = Math.min(4, Math.min((r - l) / 2, (b - t) / 2));
  ctx.beginPath();
  ctx.moveTo(l, b);
  ctx.lineTo(l, t + radius);
  ctx.arcTo(l, t, l + radius, t, radius);
  ctx.lineTo(r - radius, t);
  ctx.arcTo(r, t, r, t + radius, radius);
  ctx.lineTo(r, b);
  ctx.closePath();
  ctx.fillStyle = U.css(color);
  ctx.fill();
  const window = Math.max(2, Math.min(4, (r - l) / 6));
  ctx.fillStyle = U.css(result === 'KEEP' ? 0xCCFFE9A3 : result === 'REVIEW' ? 0x70FFFFFF : 0x28000000);
  const gap = window * 1.2;
  for (let y = t + 6; y + window <= b - 4; y += window + gap) {
    for (let column = 0; column < 2; column++) {
      const x = l + (r - l) * (column === 0 ? 0.3 : 0.7) - window / 2;
      ctx.fillRect(x, y, window, window);
    }
  }
}

/** A slim evergreen: its very tip is the score, its trunk ends at the shared zero baseline. */
function drawTree(ctx, ui, x, tip, bottom, width) {
  const height = bottom - tip;
  const color = treeColor(ui);
  const stroke = Math.max(PX, Math.min(1.5, width / 4));
  if (height <= 0) {
    line(ctx, color, stroke, 'round', x - width / 3, bottom, x + width / 3, bottom);
    return;
  }
  line(ctx, color, stroke, 'round', x, tip, x, bottom);
  const crown = height * 0.84;
  ctx.beginPath();
  ctx.moveTo(x, tip);
  ctx.lineTo(x + width * 0.30, tip + crown * 0.43);
  ctx.lineTo(x + width * 0.15, tip + crown * 0.43);
  ctx.lineTo(x + width * 0.43, tip + crown * 0.72);
  ctx.lineTo(x + width * 0.24, tip + crown * 0.72);
  ctx.lineTo(x + width / 2, tip + crown);
  ctx.lineTo(x - width / 2, tip + crown);
  ctx.lineTo(x - width * 0.24, tip + crown * 0.72);
  ctx.lineTo(x - width * 0.43, tip + crown * 0.72);
  ctx.lineTo(x - width * 0.15, tip + crown * 0.43);
  ctx.lineTo(x - width * 0.30, tip + crown * 0.43);
  ctx.closePath();
  ctx.fillStyle = U.css(color);
  ctx.fill();
}

/** A rail's caption in the strip under the street: 10 sp medium, shrunk to half the width less 16 dp. */
function railLabel(ctx, L, s, edge, end, color) {
  let size = 10;
  ctx.font = font(size, true);
  const available = Math.max(PX, (L.width - (SIDE * 2 + 8)) / 2);
  const width = ctx.measureText(s).width;
  if (width > available) size = size * available / width;
  const baseline = L.height - 3 - U.metrics(size).descent;
  text(ctx, s, edge + (end ? -3 : 3), baseline, size, color, end ? 'right' : 'left', true);
}

/** Where the flag of state.entries[index] stands once risen: [x, y] in the view, or null when it is not drawn. */
function flagAt(s, index) {
  const L = layout(s), i = index - L.skip;
  if (i < 0 || i >= L.entries.length || L.width <= 0) return null;
  const e = L.entries[i];
  const roof = e.pay != null ? yOf(e.pay, L.maxCents, L.top, L.bottom) : L.bottom - 14;
  return [buildingCenter(L, i), Math.max(roof - 12, 10)];
}

/** The settled tree of state.entries[index]: [center x, tip y, baseline y, width], or null (unknown score). */
function treeAt(s, index) {
  const L = layout(s), i = index - L.skip;
  if (i < 0 || i >= L.entries.length || L.width <= 0 || !(L.entries[i].score >= 0)) return null;
  return [treeCenter(L, i), yOf(L.entries[i].score, L.maxScore, L.top, L.bottom), L.bottom, L.treeWidth];
}

/** The highest point (least y) a risen building, tree, rail or flag reaches between x = from and to; else height. */
function highestWithin(s, from, to) {
  const L = layout(s);
  let highest = L.height;
  if (!L.entries.length || L.width <= 0 || to < L.left || from > L.right) return highest;
  const reach = Math.max(L.barWidth / 2, 9);
  highest = Math.min(highest, scoreY(L) - 1);
  if (L.payout > 0) highest = Math.min(highest, payoutY(L) - 1);
  L.entries.forEach((e, i) => {
    const center = buildingCenter(L, i);
    if (center + reach >= from && center - reach <= to) {
      const roof = e.pay != null ? yOf(e.pay, L.maxCents, L.top, L.bottom) : L.bottom - 14;
      highest = Math.min(highest, Math.max(roof - 12, 10) - 9);
      if (e.required > 0) highest = Math.min(highest, yOf(e.required, L.maxCents, L.top, L.bottom) - 1);
    }
    const tree = treeAt(s, i + L.skip);
    if (tree && tree[0] + tree[3] / 2 >= from && tree[0] - tree[3] / 2 <= to) {
      highest = Math.min(highest, tree[1] - (e.score > SCORE_CAP ? 5 : 0));
    }
  });
  return highest;
}

// ---- One offer as a picture (OfferCardView) and its icons (Glyph) ----

/** Glyph.draw: the app's line icons on a 24-unit grid, `size` dp, top-left at (x, y). BAG, HOME and HOTSPOT. */
function glyph(ctx, shape, color, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = ctx.fillStyle = U.css(color);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  if (shape === 'BAG') {
    U.rrect(ctx, 5, 8, 19, 21, 2);
    ctx.stroke();
    U.arcPath(ctx, 12, 7, 3, 3.5, 180, 180);
    ctx.stroke();
  } else if (shape === 'HOME') {
    for (const points of [[3.5, 11.5, 12, 4, 20.5, 11.5], [6.5, 10, 6.5, 20, 17.5, 20, 17.5, 10],
      [10.5, 20, 10.5, 15, 13.5, 15, 13.5, 20]]) {
      ctx.beginPath();
      ctx.moveTo(points[0], points[1]);
      for (let k = 2; k < points.length; k += 2) ctx.lineTo(points[k], points[k + 1]);
      ctx.stroke();
    }
  } else if (shape === 'HOTSPOT') {
    // A destination point within a hot area's rings.
    circle(ctx, 12, 12, 3);
    ctx.fill();
    U.arcPath(ctx, 12, 12, 6, 6, -55, 290);
    ctx.stroke();
    U.arcPath(ctx, 12, 12, 9.5, 9.5, -35, 110);
    ctx.stroke();
    U.arcPath(ctx, 12, 12, 9.5, 9.5, 145, 110);
    ctx.stroke();
  }
  ctx.restore();
}

/** Ui.resultColor: passed good, declined critical, review warning. */
const resultColor = (ui, result) => result === 'KEEP' ? ui.GOOD : result === 'DECLINE' ? ui.CRITICAL : ui.WARNING;
const needed = e => e.required > 0 && e.required < Infinity ? e.required : 0;
const payText = e => e.pay == null ? 'Pay unknown' : 'Paid ' + money(e.pay);
const hasItemDetails = e => !!e && !!(e.itemCountApplicable || e.items > 0);
const knownHotspot = miles => miles != null && isFinite(miles) && miles >= 0;
const hasHotspot = e => !!e && knownHotspot(e.hotspotMiles);

/** "7.2 mi · 21 min · 2 stops", with "?" for anything not read; without stops where space is short. */
function route(e, withStops) {
  const parts = [e.miles == null ? '? mi' : fixed(e.miles, 1) + ' mi', e.minutes == null ? '? min' : e.minutes + ' min'];
  if (withStops || e.stops == null) {
    parts.push(e.stops == null ? '? stops' : e.stops + (e.stops === 1 ? ' stop' : ' stops'));
  }
  return parts.join(' · ');
}

/** MinimumsStarView.itemsLabel: observed quantities only; an absent count never becomes a one-item order. */
function itemsLabel(e) {
  if (!hasItemDetails(e)) return '';
  if (!(e.items > 0)) return 'Item count unavailable';
  const count = e.items + (e.items === 1 ? ' item' : ' items');
  if (e.pay == null) return count;
  return count + ' · ' + (e.pay % e.items !== 0 ? '≈' : '') + '$' + fixed(e.pay / (100 * e.items), 2) + '/item';
}

/** MinimumsStarView.distanceText: "0.4", "<0.01", "2". */
function distanceText(miles) {
  if (miles > 0 && miles < 0.01) return '<0.01';
  return fixed(miles, 2).replace(/0+$/, '').replace(/\.$/, '');
}

/** Vertical positions derived from the text sizes (OfferCardView.layoutLines and onMeasure). */
function measure(ctx, width, e) {
  const small = U.metrics(13), big = U.metrics(15);
  ctx.save();
  ctx.font = font(13);
  const neededWidth = !e || needed(e) === 0 ? 0 : ctx.measureText('needed ' + money(needed(e))).width;
  ctx.font = font(15);
  // When "Paid" and "needed" do not fit side by side, "needed" gets its own line.
  const crowded = !!e && neededWidth > 0 && ctx.measureText(payText(e)).width + neededWidth + 12 > width;
  ctx.restore();
  const payBaseline = -big.ascent;
  let lines = big.descent - big.ascent;
  const neededBaseline = crowded ? lines - small.ascent : payBaseline;
  if (crowded) lines += small.descent - small.ascent;
  const barTop = lines + 8;
  const routeLabelBaseline = barTop + 12 + 14 - small.ascent;
  const routeY = routeLabelBaseline + small.descent + 4 + 11;
  const itemsBaseline = routeY + 13 + 8 - small.ascent;
  const hotspotBaseline = hasItemDetails(e) ? itemsBaseline + small.descent + 8 - small.ascent : itemsBaseline;
  const height = hasHotspot(e) ? hotspotBaseline + small.descent + 2
    : hasItemDetails(e) ? itemsBaseline + small.descent + 2 : routeY + 13;
  return {crowded, payBaseline, neededBaseline, barTop, routeLabelBaseline, routeY, itemsBaseline, hotspotBaseline,
    height};
}

function drawCard(ctx, ui, s) {
  const e = s.entry;
  if (!e) return;
  const width = s.width;
  ctx.save();
  const L = measure(ctx, width, e);
  const color = resultColor(ui, e.result);
  // Pay against the pay the rules needed: side by side, or "needed" on its own line when crowded.
  const need = needed(e);
  let f = fit(ctx, payText(e), 15, width, 0.75);
  text(ctx, f.text, 0, L.payBaseline, f.size, ui.ink, 'left', false, true);
  if (need > 0) {
    f = fit(ctx, 'needed ' + money(need), 13, width, 0.75);
    text(ctx, f.text, L.crowded ? 0 : width, L.neededBaseline, f.size, ui.inkSecondary, L.crowded ? 'left' : 'right');
  }
  const barBottom = L.barTop + 12;
  ctx.fillStyle = U.css(ui.gridline);
  U.rrect(ctx, 0, L.barTop, width, barBottom, 6);
  ctx.fill();
  const scale = Math.max(e.pay == null ? 0 : e.pay, need) * 1.15;
  if (e.pay != null && scale > 0) {
    ctx.fillStyle = U.css(color);
    U.rrect(ctx, 0, L.barTop, Math.max(12, width * e.pay / scale), barBottom, 6);
    ctx.fill();
  }
  if (need > 0 && scale > 0) {
    const x = width * need / scale;
    line(ctx, ui.ink, 3, 'round', x, L.barTop - 5, x, barBottom + 5);
  }

  // The route: pickup bag, a dot per stop, drop-off house.
  const icon = 22;
  glyph(ctx, 'BAG', ui.inkSecondary, 0, L.routeY - icon / 2, icon);
  glyph(ctx, 'HOME', ui.inkSecondary, width - icon, L.routeY - icon / 2, icon);
  const lineLeft = icon + 8, lineRight = width - icon - 8;
  line(ctx, ui.baseline, 2, 'round', lineLeft, L.routeY, lineRight, L.routeY, [6, 5]);
  if (e.stops != null && e.stops > 0) {
    const dots = Math.min(e.stops, 8);
    ctx.fillStyle = U.css(ui.ink);
    for (let i = 0; i < dots; i++) {
      const x = dots === 1 ? (lineLeft + lineRight) / 2 : lineLeft + 6 + (lineRight - lineLeft - 12) * i / (dots - 1);
      circle(ctx, x, L.routeY, 4);
      ctx.fill();
    }
  }
  const room = width - 2 * (icon + 8);
  const full = route(e, true);
  ctx.font = font(13);
  f = fit(ctx, ctx.measureText(full).width * 0.8 <= room ? full : route(e, false), 13, room, 0.8);
  text(ctx, f.text, width / 2, L.routeLabelBaseline, f.size, ui.inkSecondary, 'center');
  if (hasItemDetails(e)) {
    const itemIcon = 16;
    glyph(ctx, 'BAG', ui.inkSecondary, 0, L.itemsBaseline - itemIcon + 2, itemIcon);
    f = fit(ctx, itemsLabel(e), 13, width - itemIcon - 7, 0.8);
    text(ctx, f.text, itemIcon + 7, L.itemsBaseline, f.size, ui.inkSecondary, 'left');
  }
  if (hasHotspot(e)) {
    const hotspotIcon = 16;
    glyph(ctx, 'HOTSPOT', ui.inkSecondary, 0, L.hotspotBaseline - hotspotIcon + 2, hotspotIcon);
    f = fit(ctx, 'Final stop → hotspot  ' + distanceText(e.hotspotMiles) + ' mi', 13, width - hotspotIcon - 7, 0.8);
    text(ctx, f.text, hotspotIcon + 7, L.hotspotBaseline, f.size, ui.inkSecondary, 'left');
  }
  ctx.restore();
}

// ---- The caption line naming the chosen offer (MainActivity) ----

const ACCEPTED_BY_YOU = ['ACCEPTED_LEARNED', 'ACCEPTED_BEST_SAVED', 'ACCEPTED_MINIMUMS_UNCHANGED', 'ACCEPTED_ADD_ON'];

/** captionOutcome: what became of it; an acceptance qualified only when its stored step says how. */
function captionOutcome(e) {
  const outcome = outcomeOf(e);
  if (outcome !== 'ACCEPTED') return SAID[outcome];
  const steps = e.steps || [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.kind === 'ACCEPTED_NOT_LEARNED') {
      return (step.detail || '').startsWith('automatic Accept was requested, and Dasher showed a delivery screen')
        ? 'Automatically accepted' : SAID.ACCEPTED;
    }
    if (step.kind === 'ACCEPTED_OBSERVED') return SAID.ACCEPTED;
    if (ACCEPTED_BY_YOU.includes(step.kind)) return 'Accepted by you';
  }
  return SAID.ACCEPTED;
}

/** refreshOfferCaption: "Latest · $4.25 · Declined" (the newest offer) or "Selected · …" (an older one). */
function caption(entry, opts) {
  opts = opts || {};
  if (!entry) return opts.ready === false ? 'No offers yet.' : 'Waiting for offers';
  const entries = opts.entries || [];
  const latest = opts.latest != null ? !!opts.latest
    : entries.length > 0 && entries[entries.length - 1].at === entry.at;
  return (latest ? 'Latest' : 'Selected') + ' · ' + (entry.pay == null ? 'Pay unread' : money(entry.pay))
    + ' · ' + captionOutcome(entry);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** when: "9:41 PM" today, otherwise "Sep 28, 9:41 PM" (en-US). UTC fields, so the film is the same everywhere. */
function when(at, now) {
  const d = new Date(at), n = new Date(now == null ? at : now);
  const hour = d.getUTCHours();
  const time = ((hour + 11) % 12 + 1) + ':' + String(d.getUTCMinutes()).padStart(2, '0') + (hour < 12 ? ' AM' : ' PM');
  const today = d.getUTCFullYear() === n.getUTCFullYear() && d.getUTCMonth() === n.getUTCMonth()
    && d.getUTCDate() === n.getUTCDate();
  return today ? time : MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + time;
}

/** What screen readers hear for the caption: "Latest · $4.25 · Declined. 6:11 PM. Open offer details". */
function description(entry, opts) {
  if (!entry) return null;
  return caption(entry, opts) + '. ' + when(entry.at, (opts || {}).now) + '. Open offer details';
}

/** showSelection's line beside the ticket's stamp: "6:11 PM", or "6:11 PM · add-on". */
const stubTime = (entry, now) => when(entry.at, now) + (entry.addOn ? ' · add-on' : '');

/** The caption's TextView: 13 sp medium ink, centred, padding 12/8 dp, at least 48 dp tall; wraps as needed. */
function drawCaption(ctx, ui, s) {
  const width = s.width, size = 13, m = U.metrics(size);
  ctx.save();
  ctx.font = font(size, true);
  const room = Math.max(0, width - 24);
  const lines = [];
  let current = '';
  for (const word of String(s.text).split(' ')) {
    const next = current ? current + ' ' + word : word;
    if (current && ctx.measureText(next).width > room) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  lines.push(current);
  // includeFontPadding: the first line from the font's top, the last to its bottom; lines 1.15 apart.
  const step = (m.descent - m.ascent) * 1.15;
  const block = (m.bottom - m.top) + step * (lines.length - 1);
  const height = Math.max(s.height || 48, block + 16);
  const first = 8 + (height - 16 - block) / 2 - m.top;
  lines.forEach((l, i) => text(ctx, l, width / 2, first + step * i, size, ui.ink, 'center', true));
  ctx.restore();
}

// ---- Demo: invented recent offers (rules: $4.00 minimum pay and $1.00 a mile; scored by area) ----

/**
 * Required pay = max($4.00, $1.00 × miles); the score is the area score of those two spokes, the geometric mean of
 * pay / $4.00 and pay / ($1 × miles), as the app records it in strict mode. Six declined, three passed, one review
 * (its miles not read: no per-mile requirement, no score).
 */
const at = (h, m) => Date.UTC(2026, 9, 6, h, m);
const DEMO = [
  {at: at(17, 2), pay: 350, miles: 4.1, minutes: 16, stops: 2, required: 410, score: 86, result: 'DECLINE'},
  {at: at(17, 9), pay: 250, miles: 1.2, minutes: 9, stops: 2, required: 400, score: 114, result: 'DECLINE'},
  {at: at(17, 15), pay: 925, miles: 6.3, minutes: 24, stops: 2, required: 630, score: 184, result: 'KEEP'},
  {at: at(17, 24), pay: 475, miles: 7.9, minutes: 27, stops: 2, required: 790, score: 84, result: 'DECLINE'},
  {at: at(17, 31), pay: 300, miles: 3.4, minutes: 14, stops: 2, required: 400, score: 81, result: 'DECLINE'},
  {at: at(17, 40), pay: 1840, miles: 12.4, minutes: 38, stops: 4, required: 1240, score: 261, result: 'KEEP'},
  {at: at(17, 48), pay: 550, miles: 9.6, minutes: 31, stops: 2, required: 960, score: 89, result: 'DECLINE'},
  {at: at(17, 55), pay: 680, miles: null, minutes: 22, stops: 2, required: 400, score: -1, result: 'REVIEW'},
  {at: at(18, 3), pay: 625, miles: 3.9, minutes: 18, stops: 2, required: 400, score: 158, result: 'KEEP'},
  {at: at(18, 11), pay: 425, miles: 8.8, minutes: 29, stops: 2, required: 880, score: 72, result: 'DECLINE'}
];

App.skyline = {
  draw, layout, least: compact => compact ? 52 : 64, flagAt, treeAt, highestWithin,
  payoutThresholdY: s => payoutY(layout(s)), scoreThresholdY: s => scoreY(layout(s)),
  badge, quietBadge, outcomeOf,
  SLOTS, SIDE_DP: SIDE, LEAST_DP: 64, LEAST_COMPACT_DP: 52, SHORT_DP: 56, PREFERRED_DP: 160, HORIZON_INSET_DP: 11,
  demo: {width: 380, height: 120, entries: DEMO, selected: DEMO.length - 1, payoutCents: 400, minimumScalePercent: 100,
    scoreByArea: false, t: 0, riseSince: null, selectedSince: null}
};
App.ticket = {
  draw: drawCard, measure, glyph, route, itemsLabel,
  /** On the 412 dp page: sheet padding 16 + ticket padding 16 on each side. */
  WIDTH_DP: 348,
  demo: {width: 348, height: 95, entry: DEMO[DEMO.length - 1]}
};
caption.outcome = captionOutcome;
caption.when = when;
caption.description = description;
caption.stubTime = stubTime;
caption.draw = drawCaption;
caption.money = money;
caption.shortMoney = shortMoney;
caption.demo = {entry: DEMO[DEMO.length - 1], opts: {entries: DEMO, now: at(18, 12)}};
App.caption = caption;
})(typeof window !== 'undefined' ? window : globalThis);
