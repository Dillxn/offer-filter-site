/* The minimums' constellation as the main page's sky: a port of MinimumsStarView.java's sky drawing (drawSky and what
 * it calls), with SkyStage.java's placement maths. Units are dp, cents and degrees; colors are Android ARGB ints.
 *
 * Six spokes, at AreaScore.ANGLES (clockwise from the right, y down):
 *   0 pay        -150°  upper left   cents                 (rules.pay, e.g. 400 = $4.00)
 *   1 per mile    -30°  upper right  cents a mile          (rules.perMile, e.g. 150 = $1.50/mi)
 *   2 per minute   30°  lower right  cents a minute        (rules.perMinute, e.g. 30 = $0.30/min)
 *   3 per stop    150°  lower left   cents a stop          (rules.perStop)
 *   4 hotspot     -90°  straight up  hundredths of 1/mile  (rules.hotspot; the app cannot measure it: its knob is
 *                                                         grey, never dragged, its label "Hotspot unavailable")
 *   5 per item     90°  straight down cents an item        (rules.perItem; only shopping offers with an item count)
 * Strictly, distance from the middle is pay for one EXAMPLE offer (the newest offer whose miles, minutes and stops were
 * all read, else 5 mi / 20 min / 2 stops): a minimum stands at rate × the example's miles (minutes, stops, items), an
 * offer's mark at what its own rate would pay for the example; hotspot: 1 inverse mile shares the $10 radius. The rings
 * are $N apart (ringStep), three of them; by area every active minimum stands at 100% and the rings are 50% apart.
 *
 * API (OfferApp.star):
 *   SPREAD (30); backdropAbove(r), backdropBelow(r), backdropHalfWidth(r), spokeHalfHeight(r): MinimumsStarView's
 *     layout helpers, dp.
 *   stage(opts): SkyStage.compose() and veils(): {x, y, radius, mascot: {x, y, radius}, counts, veils, width, height}.
 *   draw(ctx, ui, state): ui = OfferApp.util.palette(dark). The view's top-left is the context's origin.
 *   places(ctx, ui, state): where the knobs, icons, buttons, badge, labels and readout stand (for a finger in the
 *     film; ctx only measures words).
 *   knobValueAt(state, axis, distance): the value a held knob takes that far (dp) out along its spoke, snapped to
 *     STEPS ($0.50 pay, $0.05/mi, $0.01/min, $0.25/stop, 0.05/mi hotspot, $0.05/item), 0 = off (rateAt/moveKnob).
 *   readout(axis, rate): "$1.85/mi" etc.; START_HINT; KEYS; ANGLES; STEPS.
 *   drawHint(ctx, ui, box, text): the page's own state line ("Drag a knob to start"), which is NOT this view's
 *     drawing (MainActivity's stateLine TextView over the sky); hintBox(ctx, text, width, linesTop) gives its box,
 *     which is also its veil (pass it in stage({lines: [box], linesHeight})).
 *   demo: {rules, drag, empty} example states, and stage / emptyStage, the layouts they use.
 *
 * Not a layer: the Java draws the rings, offers, shapes, knobs and icons into a saveLayer, fades its top and bottom
 * edges and the veils with DST_OUT, then draws the words and buttons over it. Here the edge fade is a gradient on the
 * rings' strokes (it only ever applied to them), and each veil zone of equal fade is drawn once, clipped, at that
 * fade's alpha; only where shapes overlap inside a faded zone do they mix a little differently than in a layer.
 *
 * State (all optional unless noted):
 *   x, y, radius     the circle as SkyStage.compose() put it (required), dp in the view
 *   width, height    the view's size (the sky stage: page width × sky height), dp; default 412 × 560
 *   veils            [{left, top, right, bottom, round, strength}]: where words (rect) or the mascot / sun (round, the
 *                    box is the disc's bounds) sit; strength 0..1 is how far the constellation fades (1 + round: the
 *                    mascot's disc, cut out)
 *   rules            {pay, perMile, perMinute, perStop, hotspot, perItem: set minimums (units above, 0 = none),
 *                     maxStops (0 = none), adaptive (the adaptive minimum on), byArea (score by area),
 *                     scalePercent (minimum scale, 100)}
 *   learned          the adaptive minimums learned: {pay: cents asked ("more than $5.75" is 576), perMile, perMinute,
 *                    perStop, perItem: cents per unit}; 0/absent = nothing learned on that spoke
 *   offers           recent offers, NEWEST FIRST: [{pay (cents), miles, minutes, stops, items, shopping,
 *                    hotspotMiles, result: 'passed'|'declined'|'review', addOn, id}]. Only the skyline's 14 newest
 *                    with pay (not add-ons) are marked, and of those the app draws ONE: the displayed offer.
 *   selected         index into offers chosen on the skyline (-1: the newest is displayed)
 *   open             index into offers whose ticket is open (its polygon and marks stand out; -1 none)
 *   pressedOffer     index into offers a finger is down on (-1 none)
 *   example          {miles, minutes, stops, items, shopping}: overrides the example offer
 *   drag             {axis (0-5 or 'perMile' …), value (the knob's rate in the spoke's unit, on its STEPS; 0 = off)}:
 *                    a knob mid-drag, drawn large under the finger with its readout pill ("Pay / mile · $1.85/mi");
 *                    the rings hold the scale of the rules as saved (rules keeps the value before the drag)
 *   press            axis: a finger resting on that knob before it moves (drawn large, readout shown)
 *   focus            axis: a screen reader's focus on that knob (readout shown)
 *   pressedButton    'score' | 'adaptive' | 'adopt' | 'stops': a finger on that round button / the badge
 *   stopsDrag        max stops shown while a finger drags across the badge
 *   scaleDrag        percent shown while a finger drags across the score toggle
 *   undo             true while Undo is offered after adopting the learned minimums
 *   beckonSince      t (s) when the hollow knobs were told to beckon (two swells over 1.6 s)
 *   glide            {from: an earlier state, since: t (s)}: points glide from where they stood (700 ms, ease out)
 *   knobs            false for a chart without knobs and buttons (default true, as the page's sky)
 *   t                seconds, for the sparkles' breathing, the pressed offer's pulse and the beckoning
 */
(function (root) {
'use strict';
const App = root.OfferApp = root.OfferApp || {};
const U = App.util;
const S = App.star = {};

// ---- The Java's constants ----
const PAY = 0, MILE = 1, MINUTE = 2, STOP = 3, HOTSPOT = 4, ITEM = 5, AXES = 6;
const SPREAD = 30;
const ANGLES = [SPREAD - 180, -SPREAD, SPREAD, 180 - SPREAD, -90, 90];
const DRAW_ORDER = [PAY, HOTSPOT, MILE, MINUTE, ITEM, STOP];
const COS = Math.cos(SPREAD * Math.PI / 180), SIN = Math.sin(SPREAD * Math.PI / 180);
const KEYS = ['pay', 'perMile', 'perMinute', 'perStop', 'hotspot', 'perItem'];
const AXIS_LABELS = ['Payout $', 'Pay / mile', 'Pay / min', 'Pay / stop', 'Hotspot unavailable', 'Pay / item'];
const ICONS = ['COIN', 'ROAD', 'CLOCK', 'PIN', 'HOTSPOT', 'BAG'];
const UNITS = ['', '/mi', '/min', '/stop', '/mi', '/item'];
const NIGHT_SET = 0xFFA9CBFF, NIGHT_LEARNED = 0xFFDCC2FF;
const NIGHT_PASSED = 0xFF8BE08B, NIGHT_DECLINED = 0xFFFF8F87, NIGHT_REVIEW = 0xFFFFD27A;
const SKY_DARK = 0xFF0D1428, SKY_LIGHT = 0xFFE7EEF2;
const GOOD = 0xFF0CA30C, CRITICAL = 0xFFD03B3B, WARNING = 0xFFFAB219;
const MARKS = 14, OFFER_STRETCH = 1.35, MARK_REACH = 1.02, MARK_STEP_DP = 2.2;
const AREA_RING = 0.5, AREA_LEAST = 1.5, AREA_MOST = 2.5;
const GLIDE_S = 0.7, BECKON_S = 1.6;
const BACKDROP_ICON_DP = 22, ICON_GAP_DP = 12, ICON_OUT_DP = 4, EDGE_FADE_DP = 28;
const KNOB_REACH_DP = 24, KNOB_REST_DP = 32, PUSH = 1.12, FIRST_RING_CENTS = 500;
const ADOPT_DP = 48, BUTTONS_APART_DP = 60, HOTSPOT_DISPLAY_UNIT = 10, ITEM_EDIT_UNITS = 10;
/** A knob moves in these steps of its spoke's unit: $0.50 of pay, $0.05 a mile, $0.01 a minute, $0.25 a stop. */
const STEPS = [50, 5, 1, 25, 5, 5], MOST_CENTS = 100000;
const KEEP = 'KEEP', DECLINE = 'DECLINE', REVIEW = 'REVIEW';
const TAU = Math.PI * 2;

S.SPREAD = SPREAD;
S.ANGLES = ANGLES.slice();
S.KEYS = KEYS.slice();
S.START_HINT = 'Drag a knob to start';
S.STEPS = STEPS.slice();

// ---- Layout helpers the page uses (MinimumsStarView), dp ----
/** Hotspot proximity points up, so an icon stands above the circle: the rim, the gap and the icon. */
S.backdropAbove = radius => radius + ICON_GAP_DP + BACKDROP_ICON_DP;
/** The lower rim belongs to the scene; the item icon sits just inside it. */
S.backdropBelow = radius => radius + 2;
S.backdropHalfHeight = S.backdropAbove;
S.backdropHalfWidth = radius => COS * radius + ICON_OUT_DP + BACKDROP_ICON_DP / 2;
S.spokeHalfHeight = radius => SIN * radius;

// ---- Small geometry ----
const box = (left, top, right, bottom) => ({left, top, right, bottom});
const isEmpty = b => !b || b.left >= b.right || b.top >= b.bottom;
const intersects = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const inset = (b, dx, dy) => box(b.left + dx, b.top + dy, b.right - dx, b.bottom - dy);
const centerX = b => (b.left + b.right) / 2, centerY = b => (b.top + b.bottom) / 2;
const widthOf = b => b.right - b.left, heightOf = b => b.bottom - b.top;
const rgb = c => c & 0x00FFFFFF;
const withA = (c, a) => ((a << 24) | rgb(c)) >>> 0;

// ---- The offers and rules as plain numbers (AreaScore.floors without BigDecimal) ----
function axisIndex(axis) {
  if (axis == null) return -1;
  return typeof axis === 'number' ? axis : KEYS.indexOf(axis);
}
function resultOf(r) {
  r = String(r || '').toLowerCase();
  return r === 'passed' || r === 'keep' || r === 'pass' ? KEEP : r === 'declined' || r === 'decline' ? DECLINE : REVIEW;
}
function num(v) { return v == null || !Number.isFinite(+v) || +v < 0 ? null : +v; }
function offerOf(o) {
  o = o || {};
  const items = o.items != null && o.items > 0 ? Math.round(o.items) : null;
  return {pay: num(o.pay), miles: num(o.miles), minutes: num(o.minutes), stops: num(o.stops), items,
    shopping: !!o.shopping || items != null, hotspotMiles: num(o.hotspotMiles), result: resultOf(o.result),
    addOn: !!o.addOn, id: o.id};
}
function withItems(o, items, applicable) {
  const n = items != null && items > 0 ? items : null;
  return Object.assign({}, o, {items: n, shopping: !!applicable || n != null});
}
const hasItems = o => !!o && o.shopping && o.items != null && o.items > 0;
const looksMisread = o => (o.minutes != null && o.minutes < 5) || (o.miles != null && o.miles < 0.5)
    || (o.stops != null && o.stops < 2);
function rulesOf(r) {
  r = r || {};
  return {minimums: KEYS.map(k => Math.max(0, Math.round(+r[k] || 0))), maxStops: Math.max(0, Math.round(+r.maxStops || 0)),
    adaptive: !!r.adaptive, byArea: !!r.byArea,
    scalePercent: U.clamp(Math.round(r.scalePercent == null ? 100 : +r.scalePercent), 1, 200)};
}
function learnedOf(l) {
  l = l || {};
  return [+l.pay || 0, +l.perMile || 0, +l.perMinute || 0, +l.perStop || 0, 0, +l.perItem || 0];
}
/** AreaScore.fixedFloor: what a set rate asks of an offer; null where off, unread or not applicable. */
function fixedFloor(axis, rate, o) {
  if (rate <= 0) return null;
  switch (axis) {
    case PAY: return rate;
    case MILE: return o.miles == null ? null : rate * o.miles;
    case MINUTE: return o.minutes == null ? null : rate * o.minutes;
    case STOP: return o.stops == null || o.stops < 2 ? null : rate * o.stops;
    case ITEM: return !o.shopping || o.items == null ? null : rate * o.items;
    default: return null;
  }
}
const ceilCents = v => Math.ceil(v - 1e-9);
/** AreaScore.floors(rules, offer): which spokes are active, the set and learned floors, the effective ones. */
function floors(rules, learned, o) {
  const m = rules.minimums, on = rules.adaptive;
  const f = {active: [m[PAY] > 0 || (on && learned[PAY] > 0), m[MILE] > 0 || (on && learned[MILE] > 0),
    m[MINUTE] > 0 || (on && learned[MINUTE] > 0), m[STOP] > 0 || (on && learned[STOP] > 0), m[HOTSPOT] > 0,
    (m[ITEM] > 0 || (on && learned[ITEM] > 0)) && o.shopping],
    fixed: [], learned: [], cents: [], hotspotDenominator: null};
  for (const axis of [PAY, MILE, MINUTE, STOP, ITEM]) f.fixed[axis] = fixedFloor(axis, m[axis], o);
  // The adaptive minimum's floor on this offer (the higher of what accepted and declined offers taught).
  f.learned[PAY] = learned[PAY] > 0 ? learned[PAY] : null;
  f.learned[MILE] = learned[MILE] > 0 && o.miles != null ? ceilCents(learned[MILE] * o.miles) : null;
  f.learned[MINUTE] = learned[MINUTE] > 0 && o.minutes != null ? ceilCents(learned[MINUTE] * o.minutes) : null;
  f.learned[STOP] = learned[STOP] > 0 && o.stops != null && o.stops >= 2 ? ceilCents(learned[STOP] * o.stops) : null;
  f.learned[ITEM] = learned[ITEM] > 0 && o.shopping && o.items != null ? ceilCents(learned[ITEM] * o.items) : null;
  for (let axis = 0; axis < AXES; axis++) {
    f.cents[axis] = null;
    if (!f.active[axis] || axis === HOTSPOT) continue;
    let read = f.fixed[axis] != null || f.learned[axis] != null;
    if (axis === MILE && o.miles === 0) read = false;
    if (axis === MINUTE && o.minutes === 0) read = false;
    if (read) f.cents[axis] = Math.max(0, f.fixed[axis] || 0, on && f.learned[axis] != null ? f.learned[axis] : 0);
  }
  if (f.active[HOTSPOT] && o.hotspotMiles != null) f.hotspotDenominator = m[HOTSPOT] * o.hotspotMiles / 100;
  return f;
}
/** AreaScore.ratios: pay ÷ each active floor; hotspot 1 ÷ its denominator; NaN where off or unread. */
function ratios(f, pay) {
  const r = [];
  for (let i = 0; i < AXES; i++) {
    if (!f.active[i]) r[i] = NaN;
    else if (i === HOTSPOT) r[i] = f.hotspotDenominator == null ? NaN : f.hotspotDenominator === 0 ? Infinity : 1 / f.hotspotDenominator;
    else r[i] = f.cents[i] == null ? NaN : pay / f.cents[i];
  }
  return r;
}
/** A round step in whole dollars so three rings just reach past topCents: any whole dollar to $10, then fives. */
function ringStep(topCents) {
  let dollars = Math.ceil(topCents * 1.05 / 3 / 100);
  if (dollars > 10) dollars = Math.floor((dollars + 4) / 5) * 5;
  return Math.max(1, dollars) * 100;
}
const hotspotDisplayValue = miles => miles != null && Number.isFinite(miles) && miles >= 0 ? 100 * HOTSPOT_DISPLAY_UNIT / miles : NaN;
const money = cents => '$' + (cents / 100).toFixed(2);
function distanceText(miles) {
  if (miles > 0 && miles < 0.01) return '<0.01';
  return miles.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
/** "$7.50", "$1.55/mi", "$0.42/min", "$2.25/stop", or "off". */
function readout(axis, rate) {
  if (rate <= 0) return 'off';
  if (axis === HOTSPOT) return (rate / 100).toFixed(2) + '/mi · ≤' + distanceText(100 / rate) + ' mi';
  return money(rate) + UNITS[axis];
}
S.readout = (axis, rate) => readout(axisIndex(axis), rate);
/** Clockwise drawn order; an empty half-plane closes through the center, as AreaScore's fan triangles do. */
function orderedPolygon(axes, cx, cy) {
  const points = [];
  let first = -1, previous = -1, count = 0;
  for (const p of axes) if (p) count++;
  for (const axis of DRAW_ORDER) {
    if (!axes[axis]) continue;
    if (first < 0) first = axis;
    else if (count >= 3 && emptySector(previous, axis)) points.push([cx, cy]);
    points.push(axes[axis]);
    previous = axis;
  }
  if (count >= 3 && previous !== first && first >= 0 && emptySector(previous, first)) points.push([cx, cy]);
  return points;
}
function emptySector(from, to) {
  const gap = ((ANGLES[to] - ANGLES[from]) % 360 + 360) % 360;
  return gap > 180;
}
function rightCrossing(polygon, cx, cy) {
  let most = NaN;
  for (let i = 0; i < polygon.length && polygon.length >= 2; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if (a[1] === b[1] || (a[1] - cy) * (b[1] - cy) > 0) continue;
    const x = a[0] + (cy - a[1]) * (b[0] - a[0]) / (b[1] - a[1]);
    if (x > cx && (Number.isNaN(most) || x > most)) most = x;
  }
  return most;
}
function uprightReach(polygon, x, cy, side) {
  let reach = 0;
  for (let i = 0; i < polygon.length && polygon.length >= 2; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    if (a[0] === b[0] || (a[0] - x) * (b[0] - x) > 0) continue;
    const y = a[1] + (x - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
    reach = Math.max(reach, (y - cy) * side);
  }
  return reach;
}

// ---- Text: Roboto's ≤ ∞ ≈ are missing from the site's Latin subsets, so they are drawn from Roboto Bold's own
// outlines (em units, baseline at 0, y down; AOSP Roboto at wght 700). ----
const SPECIAL = {
  '≤': [0.50977, 'M0.1375 -0.3512 0.4481 -0.2559V-0.1459L0.0266 -0.2963V-0.374ZM0.4481 -0.4287 0.1374 -0.3319 0.0266 -0.3108V-0.3885L0.4481 -0.5388ZM0.4517 -0.1038V-0.0005H0.0295V-0.1038Z'],
  '∞': [1.0498, 'M0.0467 -0.259V-0.2689Q0.0467 -0.3251 0.0642 -0.374Q0.0817 -0.4229 0.1144 -0.4598Q0.1472 -0.4968 0.1933 -0.5174Q0.2394 -0.5381 0.2969 -0.5381Q0.3483 -0.5381 0.3888 -0.5201Q0.4292 -0.5022 0.4596 -0.4728Q0.49 -0.4434 0.5117 -0.4083Q0.5333 -0.3733 0.5473 -0.3382Q0.5612 -0.3031 0.5689 -0.2744V-0.2602Q0.5612 -0.2316 0.5473 -0.1958Q0.5333 -0.16 0.5118 -0.1239Q0.4903 -0.0877 0.4599 -0.0573Q0.4294 -0.0269 0.3893 -0.0085Q0.3491 0.0099 0.2979 0.0099Q0.2399 0.0099 0.1935 -0.0107Q0.1472 -0.0314 0.1144 -0.0683Q0.0817 -0.1053 0.0642 -0.154Q0.0467 -0.2028 0.0467 -0.259ZM0.1837 -0.2689V-0.259Q0.1837 -0.226 0.1915 -0.1977Q0.1994 -0.1695 0.2149 -0.1482Q0.2304 -0.127 0.2531 -0.1152Q0.2758 -0.1033 0.3055 -0.1033Q0.3349 -0.1033 0.358 -0.1167Q0.3811 -0.1301 0.3985 -0.1506Q0.4159 -0.171 0.4275 -0.1931Q0.4391 -0.2152 0.4454 -0.2335Q0.4517 -0.2518 0.453 -0.2602V-0.2744Q0.4517 -0.2823 0.4454 -0.2999Q0.4391 -0.3175 0.4276 -0.3387Q0.4162 -0.36 0.3988 -0.3797Q0.3815 -0.3994 0.358 -0.4121Q0.3346 -0.4248 0.3045 -0.4248Q0.2753 -0.4248 0.2528 -0.4126Q0.2302 -0.4004 0.2148 -0.379Q0.1994 -0.3576 0.1915 -0.3293Q0.1837 -0.301 0.1837 -0.2689ZM1.0014 -0.2689V-0.259Q1.0014 -0.2028 0.984 -0.154Q0.9666 -0.1053 0.9337 -0.0683Q0.9008 -0.0314 0.8542 -0.0107Q0.8077 0.0099 0.7499 0.0099Q0.6986 0.0099 0.6585 -0.0085Q0.6184 -0.0269 0.5878 -0.0573Q0.5573 -0.0877 0.5358 -0.1239Q0.5143 -0.16 0.5001 -0.1958Q0.486 -0.2316 0.4785 -0.2602V-0.2744Q0.4862 -0.3031 0.5003 -0.3382Q0.5144 -0.3733 0.5361 -0.4083Q0.5578 -0.4434 0.5882 -0.4728Q0.6185 -0.5022 0.659 -0.5201Q0.6994 -0.5381 0.7509 -0.5381Q0.8085 -0.5381 0.8548 -0.5174Q0.9011 -0.4968 0.9339 -0.4598Q0.9667 -0.4229 0.9841 -0.374Q1.0014 -0.3251 1.0014 -0.2689ZM0.8641 -0.259V-0.2689Q0.8641 -0.301 0.8562 -0.3293Q0.8482 -0.3576 0.833 -0.379Q0.8177 -0.4004 0.7951 -0.4126Q0.7724 -0.4248 0.7432 -0.4248Q0.7131 -0.4248 0.6897 -0.4121Q0.6663 -0.3994 0.6489 -0.3797Q0.6316 -0.36 0.6201 -0.3387Q0.6085 -0.3175 0.6022 -0.2999Q0.5959 -0.2823 0.5946 -0.2744V-0.2602Q0.5959 -0.2518 0.6022 -0.2335Q0.6085 -0.2152 0.6202 -0.1931Q0.6319 -0.171 0.6492 -0.1506Q0.6665 -0.1301 0.6897 -0.1167Q0.7129 -0.1033 0.7423 -0.1033Q0.7715 -0.1033 0.7942 -0.1152Q0.8169 -0.127 0.8325 -0.1482Q0.8482 -0.1695 0.8562 -0.1977Q0.8641 -0.226 0.8641 -0.259Z'],
  '≈': [0.57715, 'M0.0496 -0.3328 0.0495 -0.4452Q0.0724 -0.4698 0.1051 -0.4837Q0.1377 -0.4976 0.1694 -0.4976Q0.2085 -0.4986 0.2345 -0.4881Q0.2605 -0.4776 0.2913 -0.462Q0.3201 -0.4473 0.3445 -0.4377Q0.3689 -0.4281 0.405 -0.4281Q0.4368 -0.4281 0.4652 -0.4446Q0.4937 -0.461 0.5166 -0.49L0.5168 -0.3775Q0.4938 -0.3533 0.4672 -0.3393Q0.4406 -0.3253 0.4088 -0.3253Q0.3727 -0.3253 0.3483 -0.3348Q0.3239 -0.3443 0.2951 -0.359Q0.2643 -0.3746 0.2382 -0.3851Q0.2121 -0.3956 0.1731 -0.3946Q0.1413 -0.3946 0.107 -0.3782Q0.0726 -0.3617 0.0496 -0.3328ZM0.0495 -0.1282 0.0493 -0.2406Q0.0723 -0.2652 0.1031 -0.279Q0.1339 -0.2929 0.1656 -0.2929Q0.2047 -0.2938 0.2306 -0.2833Q0.2564 -0.2728 0.2872 -0.2572Q0.316 -0.2426 0.3405 -0.233Q0.3651 -0.2235 0.4012 -0.2235Q0.433 -0.2235 0.4632 -0.24Q0.4935 -0.2564 0.5165 -0.2854L0.5166 -0.1727Q0.4937 -0.1485 0.4652 -0.1345Q0.4368 -0.1205 0.405 -0.1205Q0.3689 -0.1205 0.3445 -0.13Q0.3201 -0.1396 0.2913 -0.1542Q0.2605 -0.1698 0.2344 -0.1804Q0.2083 -0.191 0.1693 -0.19Q0.1375 -0.19 0.105 -0.1736Q0.0724 -0.1571 0.0495 -0.1282Z']
};
const SPECIAL_RE = /[≤∞≈]/;
const paths = {};
function specialPath(ch) { return paths[ch] || (paths[ch] = new root.Path2D(SPECIAL[ch][1])); }
function textRuns(text) {
  const runs = [];
  let plain = '';
  for (const ch of text) {
    if (SPECIAL[ch]) { if (plain) runs.push(plain); plain = ''; runs.push(ch); } else plain += ch;
  }
  if (plain) runs.push(plain);
  return runs;
}
/** Paint.measureText at the context's current font of {@code size}. */
function measure(ctx, text, size) {
  if (!SPECIAL_RE.test(text)) return ctx.measureText(text).width;
  let width = 0;
  for (const run of textRuns(text)) width += SPECIAL[run] ? SPECIAL[run][0] * size : ctx.measureText(run).width;
  return width;
}
/** canvas.drawText with Paint.Align {@code align}, baseline {@code y}. */
function fillText(ctx, text, x, y, align, size) {
  if (!SPECIAL_RE.test(text)) { ctx.textAlign = align; ctx.fillText(text, x, y); return; }
  const width = measure(ctx, text, size);
  let at = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
  ctx.textAlign = 'left';
  for (const run of textRuns(text)) {
    if (SPECIAL[run]) {
      ctx.save(); ctx.translate(at, y); ctx.scale(size, size); ctx.fill(specialPath(run)); ctx.restore();
      at += SPECIAL[run][0] * size;
    } else { ctx.fillText(run, at, y); at += ctx.measureText(run).width; }
  }
}
/** Ui.fit: shrinks the size (to at most minFraction of it) until the text fits, then ellipsizes. */
function fit(ctx, text, size, font, maxWidth, minFraction) {
  ctx.font = font(size);
  const width = measure(ctx, text, size);
  if (width > maxWidth && width > 0) { size = Math.max(size * minFraction, size * maxWidth / width); ctx.font = font(size); }
  if (measure(ctx, text, size) > maxWidth) {
    let cut = text;
    while (cut.length && measure(ctx, cut + '…', size) > maxWidth) cut = cut.slice(0, -1);
    text = cut + '…';
  }
  return {text, size};
}
/** Paint.setShadowLayer(3 dp, 0, 0, color): Skia's sigma 0.57735 r + 0.5, in device pixels, which canvas wants as 2σ. */
function halo(ctx, color, radiusDp) {
  const m = ctx.getTransform ? ctx.getTransform() : null;
  const px = m ? Math.hypot(m.a, m.b) || 1 : 1;
  ctx.shadowColor = U.css(color);
  ctx.shadowBlur = 2 * (0.57735 * radiusDp * px + 0.5);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// ---- Drawing primitives ----
function circlePath(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }
function fillCircle(ctx, x, y, r, color) { circlePath(ctx, x, y, r); ctx.fillStyle = U.css(color); ctx.fill(); }
function strokeCircle(ctx, x, y, r, color, width) {
  circlePath(ctx, x, y, r); ctx.strokeStyle = U.css(color); ctx.lineWidth = width; ctx.stroke();
}
function polygonPath(ctx, points) {
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.closePath();
}
/** A four-pointed sparkle, the adaptive minimums' mark. */
function sparklePath(ctx, x, y, half) {
  const waist = half * 0.22;
  ctx.beginPath();
  ctx.moveTo(x, y - half);
  ctx.quadraticCurveTo(x + waist, y - waist, x + half, y);
  ctx.quadraticCurveTo(x + waist, y + waist, x, y + half);
  ctx.quadraticCurveTo(x - waist, y + waist, x - half, y);
  ctx.quadraticCurveTo(x - waist, y - waist, x, y - half);
  ctx.closePath();
}

/** Glyph.java's icons on their 24-unit grid, at (left, top), {@code size} dp square; stroke 2 units, round. */
function glyph(ctx, shape, color, left, top, size, learnedInk, setInk) {
  const s = size / 24;
  ctx.save();
  ctx.translate(left, top);
  ctx.scale(s, s);
  ctx.setLineDash([]);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const ink = U.css(color);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  const line = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  const arc = (l, t, r, b, start, sweep) => { U.arcPath(ctx, (l + r) / 2, (t + b) / 2, (r - l) / 2, (b - t) / 2, start, sweep); ctx.stroke(); };
  switch (shape) {
    case 'CLOCK':
      strokeCircle(ctx, 12, 12, 9, color, 2);
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
      strokeCircle(ctx, 12, 10, 2.5, color, 2);
      break;
    case 'HOTSPOT':
      // A destination point within a hot area's rings, distinct from the per-stop pin.
      fillCircle(ctx, 12, 12, 3, color);
      arc(6, 6, 18, 18, -55, 290);
      arc(2.5, 2.5, 21.5, 21.5, -35, 110);
      arc(2.5, 2.5, 21.5, 21.5, 145, 110);
      break;
    case 'COIN':
      strokeCircle(ctx, 12, 12, 9, color, 2);
      // Paint.setFakeBoldText at 13: Skia strokes and fills the outline, 13 × (1/24 … 1/32) wide.
      ctx.font = U.font(13);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('$', 12, 16.5);
      ctx.lineWidth = 13 * (1 / 24 + (13 - 9) / 27 * (1 / 32 - 1 / 24));
      ctx.lineJoin = 'miter';
      ctx.strokeText('$', 12, 16.5);
      break;
    case 'BAG':
      U.rrect(ctx, 5, 8, 19, 21, 2, 2);
      ctx.stroke();
      arc(9, 3.5, 15, 10.5, 180, 180);
      break;
    case 'ADOPT': {
      // The learned (dashed) shape passing into the set (solid) one, the chevron between them in the ink.
      ctx.beginPath();
      ctx.moveTo(3.2, 8.8); ctx.lineTo(5, 5.6); ctx.lineTo(8.6, 12); ctx.lineTo(5, 18.4); ctx.lineTo(1.4, 12);
      ctx.closePath();
      ctx.strokeStyle = U.css(learnedInk);
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'butt';
      ctx.setLineDash([4.08, 3.26]);
      ctx.lineDashOffset = 5.71;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(19, 5.6); ctx.lineTo(22.6, 12); ctx.lineTo(19, 18.4); ctx.lineTo(15.4, 12);
      ctx.closePath();
      ctx.fillStyle = U.css(withA(setInk, 0x40));
      ctx.fill();
      ctx.strokeStyle = U.css(setInk);
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10.9, 9.8); ctx.lineTo(13.1, 12); ctx.lineTo(10.9, 14.2);
      ctx.stroke();
      break;
    }
    case 'UNDO':
      // A curved arrow back.
      ctx.beginPath();
      ctx.moveTo(9, 14); ctx.lineTo(4, 9); ctx.lineTo(9, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(4, 9); ctx.lineTo(14.5, 9);
      ctx.ellipse(14.5, 14.5, 5.5, 5.5, 0, -Math.PI / 2, Math.PI / 2, false);
      ctx.lineTo(11, 20);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

// ---- The view for one frame: MinimumsStarView.show() and the sky's layout, worked out from the state ----
function view(state, ui) {
  const V = {};
  const t = +state.t || 0;
  const width = state.width == null ? 412 : +state.width;
  const height = state.height == null ? 560 : +state.height;
  const skyX = +state.x, skyY = +state.y, skyRadius = Math.max(0, +state.radius || 0);
  const veils = (state.veils || []).map(v => ({box: box(+v.left, +v.top, +v.right, +v.bottom), round: !!v.round,
    fade: v.strength != null ? +v.strength : v.fade != null ? +v.fade : 1}));
  const rules = rulesOf(state.rules), learnedRates = learnedOf(state.learned);
  const entries = (state.offers || []).map(offerOf);
  const knobsOn = state.knobs !== false && skyRadius > 0;
  const byArea = rules.byArea, adaptiveOn = rules.adaptive, maxStops = rules.maxStops;
  const setRates = rules.minimums.slice();

  // A finger or a screen reader on the sky.
  const drag = state.drag ? {axis: axisIndex(state.drag.axis), value: Math.max(0, Math.round(+state.drag.value || 0))} : null;
  // There is no hotspot measurement, so its knob is never taken by a drag (a press shows its readout).
  const dragging = knobsOn && !!drag && drag.axis >= 0 && drag.axis < AXES && drag.axis !== HOTSPOT;
  const pressAxis = axisIndex(state.press);
  const held = dragging ? drag.axis : knobsOn && pressAxis >= 0 && pressAxis < AXES ? pressAxis : -1;
  const pressing = !dragging && held >= 0;
  const dragValue = dragging ? drag.value : 0;
  const focusAxis = axisIndex(state.focus);
  const readoutAxis = (dragging || pressing) && held >= 0 ? held
      : knobsOn && focusAxis >= 0 && focusAxis < AXES ? focusAxis : -1;
  const scaleDragging = state.scaleDrag != null;
  const stopsDragging = state.stopsDrag != null;
  const pressedButton = state.pressedButton || null;

  // The offers marked: only those on the skyline (its 14 newest) with pay, not add-ons; newest first.
  const markEntries = [];
  entries.slice(0, MARKS).forEach((e, i) => { if (!e.addOn && e.pay != null && e.pay > 0) markEntries.push(i); });
  const markOf = i => i == null || i < 0 ? -1 : markEntries.indexOf(i);
  const openAt = state.open == null ? -1 : +state.open;
  const chosenAt = state.selected == null ? -1 : +state.selected;
  const newestAt = entries.length ? 0 : -1;
  // strongShape(): the open ticket's offer, else the skyline's choice, else the newest (if it is marked).
  const strong = openAt >= 0 ? markOf(openAt) : markOf(chosenAt >= 0 ? chosenAt : newestAt);
  const opened = markOf(openAt), pressed = markOf(state.pressedOffer == null ? -1 : +state.pressedOffer);
  const displayed = m => m >= 0 && m === strong;

  // The example offer (MainActivity.exampleOffer), with the displayed offer's items.
  let example = state.example ? offerOf(state.example) : null;
  if (!example) {
    for (const e of entries) {
      if (!e.addOn && e.miles != null && e.minutes != null && e.stops != null && !looksMisread(e)) { example = e; break; }
    }
  }
  if (!example) example = offerOf({miles: 5, minutes: 20, stops: 2});
  const displayedAt = openAt >= 0 ? openAt : chosenAt >= 0 ? chosenAt : newestAt;
  if (displayedAt >= 0 && displayedAt < entries.length) {
    example = withItems(example, entries[displayedAt].items, entries[displayedAt].shopping);
  }

  // show(): what each minimum asks of the example offer, in cents.
  const exFloors = floors(rules, learnedRates, example);
  const setCents = [], learnedCents = [];
  for (let i = 0; i < AXES; i++) {
    const ask = i === HOTSPOT ? setRates[HOTSPOT] * HOTSPOT_DISPLAY_UNIT : exFloors.fixed[i] || 0;
    setCents[i] = setRates[i] > 0 && ask > 0 ? ask : NaN;
    const learnedAsk = i === HOTSPOT ? 0 : exFloors.learned[i] || 0;
    learnedCents[i] = learnedAsk > 0 ? learnedAsk : NaN;
  }
  // markOffers(): strictly, what each offer's own rates would pay for the example offer; by area, its ratios.
  const strictMarks = [], marks = [], markResults = [];
  for (const i of markEntries) {
    const o = entries[i], pay = o.pay;
    const cents = [pay, o.miles > 0 ? pay * example.miles / o.miles : NaN,
      o.minutes > 0 ? pay * example.minutes / o.minutes : NaN, o.stops > 0 ? pay * example.stops / o.stops : NaN,
      hotspotDisplayValue(o.hotspotMiles), hasItems(o) && hasItems(example) ? pay * example.items / o.items : NaN];
    strictMarks.push(cents);
    marks.push(byArea ? ratios(floors(rules, learnedRates, o), pay) : cents);
    markResults.push(o.result);
  }
  // The ring step: three rings just past the highest minimum, stretched (a little) for the offers.
  let top = 0;
  for (let i = 0; i < AXES; i++) {
    if (!Number.isNaN(setCents[i])) top = Math.max(top, setCents[i]);
    if (!Number.isNaN(learnedCents[i])) top = Math.max(top, learnedCents[i]);
  }
  let offers = 0;
  for (const mark of strictMarks) for (const cents of mark) if (Number.isFinite(cents)) offers = Math.max(offers, cents);
  if (top > 0) top = Math.max(top, top * rules.scalePercent / 100);
  top = top > 0 ? Math.max(top, Math.min(offers, top * OFFER_STRETCH)) : offers;
  let ringCents = top > 0 ? ringStep(top) : 0;
  // scaleTo() and takeScale(): the scale's units on each spoke, the outer ring, how many rings.
  const unit = [1, 1, 1, 1, 1, 1];
  let outer, rings;
  if (!byArea) {
    outer = ringCents * 3;
    rings = 3;
  } else {
    const strictOuter = (ringCents > 0 ? ringCents : FIRST_RING_CENTS) * 3;
    let reach = Math.max(1, rules.scalePercent / 100);
    for (let i = 0; i < AXES; i++) {
      const floor = exFloors.active[i] && (i === HOTSPOT || exFloors.cents[i] != null);
      unit[i] = !floor ? 0 : i === HOTSPOT ? setRates[HOTSPOT] * HOTSPOT_DISPLAY_UNIT : exFloors.cents[i];
      if (floor && !adaptiveOn && !Number.isNaN(learnedCents[i])) reach = Math.max(reach, learnedCents[i] / unit[i]);
    }
    let most = 0;
    for (const mark of marks) for (const r of mark) if (!Number.isNaN(r)) most = Math.max(most, r);
    most = Math.min(AREA_MOST, Math.max(reach, most) * 1.05);
    rings = Math.max(Math.round(AREA_LEAST / AREA_RING), Math.ceil(most / AREA_RING - 1e-9));
    outer = rings * AREA_RING;
    for (let i = 0; i < AXES; i++) if (unit[i] <= 0) unit[i] = strictOuter / outer;
  }
  // inUnits(): the minimums on the scale; by area, the minimums' polygon at 1 on each active spoke.
  const set = [], learned = [], areaMin = [];
  for (let i = 0; i < AXES; i++) {
    set[i] = setCents[i] / unit[i];
    learned[i] = learnedCents[i] / unit[i];
    areaMin[i] = byArea && exFloors.active[i] && (i !== ITEM || hasItems(example)) ? 1 : NaN;
    if (byArea && !exFloors.active[i]) learned[i] = NaN;
  }
  // takeKnob(): a first knob dragged out of an empty chart moves on $5 rings.
  if (dragging && outer <= 0) {
    ringCents = FIRST_RING_CENTS;
    unit.fill(1);
    outer = ringCents * 3;
    rings = 3;
  }
  const fraction = value => Number.isNaN(value) || outer <= 0 ? 0 : Math.min(1, value / outer);
  const setTo = set.map(fraction), learnedTo = learned.map(fraction), areaTo = areaMin.map(fraction);
  const markTo = marks.map(mark => mark.map(v => Number.isNaN(v) || outer <= 0 ? 0 : Math.min(MARK_REACH, v / outer)));
  const markKey = i => entries[i].id != null ? 'id:' + entries[i].id : 'at:' + i;

  // The glide (Motion.settle over 700 ms) from where an earlier state drew everything.
  let glide = 1, setFrom = setTo, learnedFrom = learnedTo, areaFrom = areaTo, markFrom = markTo;
  if (state.glide && state.glide.from) {
    const p = U.clamp((t - (+state.glide.since || 0)) / GLIDE_S, 0, 1);
    glide = 1 - (1 - p) * (1 - p) * (1 - p);
    const was = view(Object.assign({}, state.glide.from, {t, glide: null}), ui).drawn;
    setFrom = was.set;
    learnedFrom = was.learned;
    areaFrom = was.area;
    markFrom = markEntries.map((i, m) => was.marks[markKey(i)] || markTo[m]);
  }
  const lerp = (from, to, i, g) => from[i] + (to[i] - from[i]) * g;
  const markShown = (m, g) => markTo[m].map((to, i) => markFrom[m][i] + (to - markFrom[m][i]) * g);

  // ---- Geometry ----
  const detail = Math.max(0.6, Math.min(1, skyRadius / 45)) + Math.max(0, Math.min(0.35, (skyRadius - 100) / 150));
  function point(axis, frac, aside) {
    const angle = ANGLES[axis] * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    aside = aside || 0;
    return [skyX + cos * skyRadius * frac - sin * aside, skyY + sin * skyRadius * frac + cos * aside];
  }
  const restFraction = skyRadius > 0 ? KNOB_REST_DP / skyRadius : 0;
  function askCents(axis, rate) {
    if (axis === HOTSPOT) return rate * HOTSPOT_DISPLAY_UNIT;
    if (axis === ITEM && !hasItems(example)) return rate * ITEM_EDIT_UNITS;
    return fixedFloor(axis, rate, example) || 0;
  }
  function pushLimit(axis) {
    const angle = ANGLES[axis] * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle), margin = 10;
    let most = skyRadius * PUSH;
    if (cos > 1e-6) most = Math.min(most, (width - margin - skyX) / cos);
    if (cos < -1e-6) most = Math.min(most, (margin - skyX) / cos);
    if (sin > 1e-6) most = Math.min(most, (height - margin - skyY) / sin);
    if (sin < -1e-6) most = Math.min(most, (margin - skyY) / sin);
    return Math.max(KNOB_REST_DP + 1, most);
  }
  function heldFraction() {
    if (dragValue <= 0 || outer <= 0) return restFraction;
    return Math.min(askCents(held, dragValue) / unit[held] / outer, pushLimit(held) / skyRadius);
  }
  /** How far out a knob stands: at its set minimum, or resting; live = with the held knob where the finger is. */
  function knobFraction(axis, g, live) {
    if (live && dragging && axis === held) return heldFraction();
    if (Number.isNaN(set[axis])) return restFraction;
    return lerp(setFrom, setTo, axis, g);
  }
  // holdSet(): the set shape as drawn, the held knob's spoke standing where the knob is.
  const drawnSet = set.slice(), drawnFrom = setFrom.slice(), drawnTo = setTo.slice();
  if (dragging && !(held === ITEM && !hasItems(example))) {
    const at = heldFraction();
    drawnSet[held] = dragValue > 0 ? askCents(held, dragValue) / unit[held] : NaN;
    drawnFrom[held] = drawnTo[held] = at;
  }
  const shownScalePercent = scaleDragging ? U.clamp(Math.round(+state.scaleDrag), 1, 200) : rules.scalePercent;
  const anyLearned = learnedCents.some(c => !Number.isNaN(c));
  const setColor = ui.dark ? NIGHT_SET : ui.accent;
  const learnedColor = adaptiveOn ? (ui.dark ? NIGHT_LEARNED : ui.learned) : 0xFF8E8A9C;
  // By day Ui.resultColor; by night the sky's own lighter outcome colors.
  const markColor = r => !ui.dark ? (r === KEEP ? GOOD : r === DECLINE ? CRITICAL : WARNING)
      : r === KEEP ? NIGHT_PASSED : r === DECLINE ? NIGHT_DECLINED : NIGHT_REVIEW;
  const markAside = (m, d) => ((m % 5) - 2) * MARK_STEP_DP * d;

  /** By area the minimums' polygon (strictly the effective one); live: the held knob's spoke at what it asks. */
  function minimumPolygon(g, live) {
    const ds = live ? drawnSet : set, df = live ? drawnFrom : setFrom, dt = live ? drawnTo : setTo;
    const axes = [];
    for (let i = 0; i < AXES; i++) {
      let at, on;
      if (byArea) {
        at = lerp(areaFrom, areaTo, i, g);
        on = !Number.isNaN(areaMin[i]);
      } else {
        on = !Number.isNaN(ds[i]) || (adaptiveOn && !Number.isNaN(learned[i]));
        at = Number.isNaN(ds[i]) ? 0 : lerp(df, dt, i, g);
        if (adaptiveOn && !Number.isNaN(learned[i])) at = Math.max(at, lerp(learnedFrom, learnedTo, i, g));
      }
      if (live && dragging && i === held && outer > 0 && (i !== ITEM || hasItems(example))) {
        let ask = dragValue > 0 ? askCents(held, dragValue) / unit[held] : 0;
        if (adaptiveOn && !Number.isNaN(learned[i])) ask = Math.max(ask, learned[i]);
        on = ask > 0;
        at = Math.min(1, ask / outer);
      }
      if (on) axes[i] = point(i, at * shownScalePercent / 100);
    }
    return orderedPolygon(axes, skyX, skyY);
  }
  function offerPolygon(m, g) {
    const axes = [], shown = markShown(m, g);
    for (let i = 0; i < AXES; i++) if (!Number.isNaN(marks[m][i]) && outer > 0) axes[i] = point(i, shown[i]);
    return orderedPolygon(axes, skyX, skyY);
  }
  function markPoint(m, axis, g) {
    if (!displayed(m) || Number.isNaN(marks[m][axis]) || outer <= 0) return null;
    return point(axis, markShown(m, g)[axis], markAside(m, detail));
  }

  // ---- Where words or the mascot sit ----
  const underWords = b => veils.some(v => !v.round && intersects(v.box, b));
  function onMascot(b) {
    for (const v of veils) {
      if (!v.round || v.fade < 1) continue;
      const reach = widthOf(v.box) / 2 + 10, vx = centerX(v.box), vy = centerY(v.box);
      const dx = Math.max(0, Math.max(b.left - vx, vx - b.right)), dy = Math.max(0, Math.max(b.top - vy, vy - b.bottom));
      if (dx * dx + dy * dy < reach * reach) return true;
    }
    return false;
  }
  const distanceTo = (b, p) => Math.hypot(Math.max(0, Math.max(b.left - p[0], p[0] - b.right)),
      Math.max(0, Math.max(b.top - p[1], p[1] - b.bottom)));

  // ---- The layout, as a context: 'live' (as drawn now, a held knob where the finger is) or 'calm' (as the round
  // buttons were placed: the Java does not move them while a knob or the scale is dragged). ----
  function layout(live) {
    const C = {live, stopsIcon: null, placingStops: false, levelBoxes: [], levelWords: [], stopsBox: null};
    const g = glide;
    const kf = (axis, gl) => knobFraction(axis, gl, live);
    function iconClearOfKnobs(b) {
      for (let axis = 0; axis < AXES; axis++) if (distanceTo(b, point(axis, kf(axis, g))) < KNOB_REACH_DP) return false;
      return true;
    }
    function itemIconClear(b) {
      if (!iconClearOfKnobs(b)) return false;
      if (strong < 0) return true;
      const at = markPoint(strong, ITEM, g);
      if (!at) return true;
      const pad = 12 * detail;
      return b.right <= at[0] - pad || b.left >= at[0] + pad || b.bottom <= at[1] - pad || b.top >= at[1] + pad;
    }
    /** Where spoke {@code axis}'s icon stands: beyond its end, else on its other side, else (item, stop) nearby. */
    C.skyIcon = function (axis) {
      if (axis === STOP && !C.placingStops && C.stopsIcon) return Object.assign({}, C.stopsIcon);
      const tip = point(axis, 1);
      const upright = axis === HOTSPOT || axis === ITEM;
      const right = axis === MILE || axis === MINUTE;
      const below = axis === MINUTE || axis === STOP || axis === ITEM;
      const size = BACKDROP_ICON_DP;
      const middle = tip[0] + (upright ? 0 : (right ? 1 : -1) * ICON_OUT_DP);
      for (let side = 0; side < 2; side++) {
        const under = below === (side === 0);
        const topY = under ? tip[1] + ICON_GAP_DP : tip[1] - ICON_GAP_DP - size;
        const out = box(middle - size / 2, topY, middle + size / 2, topY + size);
        if (out.top >= 2 && out.bottom <= height - 2 && !underWords(out) && (side === 0 || !onMascot(out))
            && (axis !== ITEM || itemIconClear(out))) return out;
      }
      if (axis === ITEM) {
        const preferredTop = tip[1] - ICON_GAP_DP - size, across = size / 2 + KNOB_REACH_DP + 4;
        for (let rise = 0; rise <= 3; rise++) {
          for (const column of [0, 1, -1, 2, -2]) {
            const left = middle - size / 2 + column * across, topY = preferredTop - rise * 24;
            const out = box(left, topY, left + size, topY + size);
            if (out.left >= 4 && out.right <= width - 4 && out.top >= 4 && out.bottom <= height - 4 && !underWords(out)
                && !onMascot(out) && itemIconClear(out)) return out;
          }
        }
      }
      if (axis === STOP) {
        const preferredTop = tip[1] - ICON_GAP_DP - size;
        for (let rise = 0; rise <= 3; rise++) {
          for (let inward = 1; inward <= 4; inward++) {
            const left = middle - size / 2 + inward * 24, topY = preferredTop - rise * 24;
            const out = box(left, topY, left + size, topY + size);
            if (out.left >= 4 && out.right <= width - 4 && out.top >= 4 && out.bottom <= height - 4 && !underWords(out)
                && !onMascot(out) && iconClearOfKnobs(out)) return out;
          }
        }
      }
      return null;
    };
    C.iconClearOfKnobs = iconClearOfKnobs;
    /** The rings' dollars along the level line on the right, each just inside its ring (else outside it). */
    C.placeLevelLabels = function (gl, ctx) {
      C.levelBoxes = [];
      C.levelWords = [];
      if (outer <= 0) return;
      ctx.font = U.font(12, false, true);
      const metrics = U.metrics(12);
      const baseline = skyY - (metrics.ascent + metrics.descent) / 2;
      const ds = live ? drawnSet : set, df = live ? drawnFrom : setFrom, dt = live ? drawnTo : setTo;
      const edgeCrossing = (values, from, to) => {
        if (values.every(v => Number.isNaN(v))) return NaN;
        const upper = Number.isNaN(values[1]) ? 0 : lerp(from, to, 1, gl);
        const lower = Number.isNaN(values[2]) ? 0 : lerp(from, to, 2, gl);
        if (upper + lower <= 0) return skyX;
        return skyX + skyRadius * COS * 2 * upper * lower / (upper + lower);
      };
      const edges = byArea ? [rightCrossing(minimumPolygon(gl, live), skyX, skyY)]
          : [edgeCrossing(ds, df, dt), edgeCrossing(learned, learnedFrom, learnedTo)];
      const clear = 4 + Math.max(1, detail);
      let before = -Number.MAX_VALUE;
      const labelRings = byArea ? [2, Math.min(rings, 4)] : [2, 3];
      for (const ring of labelRings) {
        const words = byArea ? Math.round(ring * AREA_RING * 100) + '%' : '$' + Math.floor(ringCents * ring / 100);
        const w = measure(ctx, words, 12);
        const at = skyX + skyRadius * ring / rings;
        for (let side = 0; side < 2; side++) {
          const left = side === 0 ? at - 5 - w : at + 5;
          const b = box(left, baseline + metrics.ascent, left + w, baseline + metrics.descent);
          if (b.left < before + 8 || b.right > width - 6) continue;
          if (edges.some(e => !Number.isNaN(e) && e > b.left - clear && e < b.right + clear)) continue;
          C.levelBoxes.push(b);
          C.levelWords.push(words);
          before = b.right;
          break;
        }
      }
    };
    /** The max stops badge beside the per-stop spoke's icon, towards the middle, clear of everything. */
    C.placeStops = function (ctx) {
      C.stopsIcon = null;
      C.placingStops = true;
      try { C.stopsBox = placeStopsFromSpoke(ctx); } finally { C.placingStops = false; }
      return !!C.stopsBox;
    };
    function placeStopsFromSpoke(ctx) {
      const words = stopsWords(maxStops);
      ctx.font = U.font(14, false, true);
      const h = Math.max(26, U.lineHeight(14) + 8);
      const w = Math.max(h + 6, measure(ctx, words, 14) + 18);
      const icon = C.skyIcon(STOP);
      if (!icon) return null;
      const middle = centerY(icon), gap = 8;
      const places = [[icon.right + gap, middle - h / 2], [icon.left - gap - w, middle - h / 2],
        [centerX(icon) - w / 2, icon.bottom + gap], [centerX(icon) - w / 2, icon.top - gap - h]];
      for (const p of places) {
        const b = box(p[0], p[1], p[0] + w, p[1] + h);
        if (badgeFits(b) && pairStopsIcon(b, icon)) return b;
      }
      for (let step = 1; step <= 20; step++) {
        for (const side of [-1, 1]) {
          for (let across = 0; across <= 12; across++) {
            const left = icon.right + gap + across * 18, topY = middle - h / 2 + side * step * 12;
            const b = box(left, topY, left + w, topY + h);
            if (badgeFits(b) && pairStopsIcon(b, icon)) return b;
          }
        }
      }
      return null;
    }
    function badgeFits(b) {
      if (b.left < 4 || b.top < 4 || b.right > width - 4 || b.bottom > height - 4) return false;
      if (underWords(b) || onMascot(b)) return false;
      for (let i = 0; i < AXES; i++) { const icon = C.skyIcon(i); if (icon && intersects(icon, b)) return false; }
      for (const label of C.levelBoxes) if (intersects(label, b)) return false;
      for (let i = 0; i < AXES; i++) if (distanceTo(b, point(i, kf(i, g))) < KNOB_REACH_DP) return false;
      return true;
    }
    function pairStopsIcon(badge, original) {
      if (Math.hypot(centerX(badge) - centerX(original), centerY(badge) - centerY(original)) <= 80) return true;
      const size = BACKDROP_ICON_DP, gap = 8;
      const places = [[badge.left - gap - size, centerY(badge) - size / 2], [badge.right + gap, centerY(badge) - size / 2],
        [centerX(badge) - size / 2, badge.top - gap - size], [centerX(badge) - size / 2, badge.bottom + gap]];
      for (const p of places) {
        const candidate = box(p[0], p[1], p[0] + size, p[1] + size);
        if (candidate.left < 4 || candidate.right > width - 4 || candidate.top < 4 || candidate.bottom > height - 4
            || underWords(candidate) || onMascot(candidate) || !iconClearOfKnobs(candidate)) continue;
        let clear = true;
        for (let axis = 0; axis < AXES; axis++) {
          const other = axis !== STOP ? C.skyIcon(axis) : null;
          if (other && intersects(candidate, other)) clear = false;
        }
        for (const label of C.levelBoxes) if (intersects(candidate, label)) clear = false;
        if (clear) { C.stopsIcon = candidate; return true; }
      }
      return false;
    }
    return C;
  }
  function stopsWords(stops) { return stops > 0 ? '≤' + stops : '≤∞'; }

  /** placeButtons(): the round buttons in a row (score by area, adaptive, adopt's place), below the middle just
   * outside the shapes (else above), clear of the knobs, icons, badge, rings' dollars, words and the mascot. */
  function placeButtons(C) {
    const half = ADOPT_DP / 2, apart = BUTTONS_APART_DP, band = S.backdropHalfHeight(skyRadius) - half;
    const B = {score: box(0, 0, 0, 0), adaptive: box(0, 0, 0, 0), adopt: box(0, 0, 0, 0)};
    const stopsForButtons = !!C.stopsBox;
    function buttonFits(b, ...others) {
      if (b.left < 4 || b.top < 4 || b.right > width - 4 || b.bottom > height - 4) return false;
      const around = inset(b, -4, -4);
      if (underWords(around) || onMascot(b)) return false;
      for (const other of others) if (other && intersects(other, around)) return false;
      if (stopsForButtons && intersects(C.stopsBox, around)) return false;
      for (const label of C.levelBoxes) if (intersects(label, around)) return false;
      const clear = KNOB_REACH_DP + widthOf(b) / 2;
      for (let i = 0; i < AXES; i++) {
        const icon = C.skyIcon(i);
        if (icon && intersects(icon, around)) return false;
        const at = point(i, Number.isNaN(set[i]) ? restFraction : setTo[i]);
        if (Math.hypot(at[0] - centerX(b), at[1] - centerY(b)) < clear) return false;
      }
      return true;
    }
    function shapesReach(side, xs) {
      const shapes = [];
      if (byArea) {
        const axes = [];
        for (let i = 0; i < AXES; i++) if (!Number.isNaN(areaMin[i])) axes[i] = point(i, areaTo[i]);
        shapes.push(orderedPolygon(axes, skyX, skyY));
      }
      const values = [set, learned], to = [setTo, learnedTo];
      for (let s = 0; s < 2; s++) {
        if (values[s].every(v => Number.isNaN(v))) continue;
        const axes = [];
        for (let i = 0; i < AXES; i++) {
          if (Number.isNaN(values[s][i]) && (byArea || i === HOTSPOT || i === ITEM)) continue;
          axes[i] = point(i, Number.isNaN(values[s][i]) ? 0 : to[s][i]);
        }
        shapes.push(orderedPolygon(axes, skyX, skyY));
      }
      let reach = 0;
      for (const shape of shapes) for (const x of xs) reach = Math.max(reach, uprightReach(shape, x, skyY, side));
      return reach;
    }
    const row = ['score', 'adaptive', 'adopt'];
    let placed = false;
    for (let pass = 0; pass < 2 && !placed; pass++) {
      for (let side = 1; side >= -1 && !placed; side -= 2) {
        let from = half + KNOB_REST_DP;
        if (pass === 0) {
          from = Math.max(from, shapesReach(side, [skyX - apart - half, skyX - apart, skyX - apart / 2, skyX,
            skyX + apart / 2, skyX + apart, skyX + apart + half]) + 10 + half);
        }
        for (let d = from; d <= band; d += 2) {
          const y = skyY + side * d;
          for (let b = 0; b < 3; b++) { const x = skyX + (b - 1) * apart; B[row[b]] = box(x - half, y - half, x + half, y + half); }
          if (buttonFits(B.score) && buttonFits(B.adaptive, B.score) && buttonFits(B.adopt, B.adaptive)) { placed = true; break; }
        }
      }
    }
    B.togglePlaced = B.adaptivePlaced = B.adoptPlaced = placed;
    if (!placed) {
      const placeAlone = (name, ...others) => {
        for (let pass = 0; pass < 2; pass++) {
          for (let side = 1; side >= -1; side -= 2) {
            let from = half + KNOB_REST_DP;
            if (pass === 0) from = Math.max(from, shapesReach(side, [skyX]) + 10 + half);
            for (let d = from; d <= band; d += 2) {
              for (const column of [0, -1, 1, -2, 2]) {
                const x = skyX + column * BUTTONS_APART_DP, y = skyY + side * d;
                B[name] = box(x - half, y - half, x + half, y + half);
                if (buttonFits(B[name], ...others)) return true;
              }
            }
          }
        }
        // Six spokes can fill both rows in a short split: the nearest open place in the remaining sky.
        let best = null, nearest = Number.MAX_VALUE;
        for (let y = 4 + half; y <= height - 4 - half; y += 8) {
          for (let x = 4 + half; x <= width - 4 - half; x += 8) {
            const b = box(x - half, y - half, x + half, y + half);
            if (!buttonFits(b, ...others)) continue;
            const distance = Math.hypot(x - skyX, y - (skyY + band));
            if (distance < nearest) { nearest = distance; best = b; }
          }
        }
        if (best) { B[name] = best; return true; }
        return false;
      };
      B.togglePlaced = placeAlone('score');
      B.adaptivePlaced = placeAlone('adaptive', B.togglePlaced ? B.score : null);
      B.adoptPlaced = placeAlone('adopt', B.togglePlaced ? B.score : null, B.adaptivePlaced ? B.adaptive : null);
    }
    B.placed = B.togglePlaced || B.adaptivePlaced || B.adoptPlaced;
    return B;
  }

  // ---- Work the layout out (a measuring context is needed for the words) ----
  V.layOut = function (ctx) {
    ctx.save();
    const live = layout(true);
    live.placeLevelLabels(glide, ctx);
    let calm = live;
    if (dragging || scaleDragging || stopsDragging) {
      calm = layout(false);
      calm.placeLevelLabels(1, ctx);
    }
    if (knobsOn) {
      // placeButtons() worked out from the calm layout, its badge included.
      if (calm !== live) calm.placeStops(ctx);
      else live.placeStops(ctx);
      V.buttons = placeButtons(calm);
      if (calm !== live) live.placeStops(ctx);
      // A badge being dragged stays where it stood, only its words (and width) change.
      if (stopsDragging && live.stopsBox) {
        ctx.font = U.font(14, false, true);
        const words = stopsWords(Math.max(0, Math.round(+state.stopsDrag)));
        live.stopsBox.right = live.stopsBox.left + Math.max(32, measure(ctx, words, 14) + 18);
      }
    }
    V.live = live;
    V.iconBoxes = [];
    for (let i = 0; i < AXES; i++) V.iconBoxes[i] = live.skyIcon(i);
    const anyMinimumOn = rules.minimums.some((m, i) => m > 0)
        || (adaptiveOn && learnedRates.some((l, i) => l > 0 && i !== HOTSPOT));
    const B = V.buttons;
    V.scoreShown = knobsOn && anyMinimumOn && B.placed && B.togglePlaced;
    V.adaptiveShown = knobsOn && B && B.placed && B.adaptivePlaced;
    const adoptable = adaptiveOn && learnedRates.some((l, i) => i !== HOTSPOT && l > 0
        && (i === PAY ? Math.round(l) : Math.ceil(l - 1e-9)) > setRates[i]);
    V.adoptable = adoptable;
    V.adoptShown = knobsOn && (adoptable || !!state.undo) && B && B.placed && B.adoptPlaced;
    V.stopsShown = knobsOn && !!live.stopsBox;
    if (readoutAxis >= 0) placeReadout(ctx);
    if (knobsOn) placeAxisLabels(ctx);
    ctx.restore();
  };

  /** The held knob's readout pill: above the knob, else beside it (inwards, then out), else below. */
  function readoutWords(ctx) {
    const axis = readoutAxis;
    let words;
    if (axis === HOTSPOT) words = 'Hotspot unavailable · tap for details';
    else if (axis === ITEM) {
      const o = displayedAt >= 0 && displayedAt < entries.length ? entries[displayedAt] : null;
      let observed = '';
      if (o && o.shopping) {
        if (!hasItems(o)) observed = 'Item count unavailable';
        else {
          observed = o.items + (o.items === 1 ? ' item' : ' items');
          if (o.pay != null) observed += ' · ' + (o.pay % o.items !== 0 ? '≈' : '') + '$' + (o.pay / (100 * o.items)).toFixed(2) + '/item';
        }
      }
      if (!observed) observed = 'not applicable';
      const saved = 'Min ' + readout(axis, dragging && axis === held ? dragValue : setRates[axis]);
      const learnedWords = learnedRates[ITEM] > 0 ? ' · Learned $' + (learnedRates[ITEM] / 100).toFixed(2) + '/item'
          + (adaptiveOn ? '' : ' (off)') : '';
      words = saved + learnedWords + ' · ' + observed;
    } else words = AXIS_LABELS[axis] + ' · ' + readout(axis, dragging && axis === held ? dragValue : setRates[axis]);
    return fit(ctx, words, 14, s => U.font(s, false, true), Math.max(0, width - 30), 0.85);
  }
  function placeReadout(ctx) {
    const axis = readoutAxis;
    const at = point(axis, dragging ? heldFraction() : knobFraction(axis, glide, true));
    const words = readoutWords(ctx);
    ctx.font = U.font(words.size, false, true);
    const h = Math.max(26, U.lineHeight(words.size) + 8), w = measure(ctx, words.text, words.size) + 22, gap = 30;
    const inward = at[0] < width / 2 ? 1 : -1;
    const places = [[at[0] - w / 2, at[1] - gap - h], [inward > 0 ? at[0] + gap : at[0] - gap - w, at[1] - h / 2],
      [inward > 0 ? at[0] - gap - w : at[0] + gap, at[1] - h / 2], [at[0] - w / 2, at[1] + gap]];
    for (let i = 0; i <= places.length; i++) {
      const p = places[i % places.length];
      const left = Math.max(4, Math.min(width - 4 - w, p[0])), topY = Math.max(2, Math.min(height - 2 - h, p[1]));
      V.pill = box(left, topY, left + w, topY + h);
      V.pillWords = words;
      if (i === places.length) return;
      const moved = Math.abs(left - p[0]) > 24 || Math.abs(topY - p[1]) > 1;
      if (!moved && !underWords(V.pill) && !onMascot(V.pill)) return;
    }
  }
  /** Each icon's name ("Pay / mile"): below, above or beside its icon, else nearer the middle on its spoke. */
  function placeAxisLabels(ctx) {
    V.axisLabels = [];
    if (skyRadius < 48 || width <= 0 || height <= 0) return;
    const C = V.live, B = V.buttons;
    ctx.font = U.font(11, true);
    const metrics = U.metrics(11);
    const h = Math.max(11, U.lineHeight(11)), gap = 3;
    const boxes = [];
    const tryLabel = (axis, x, y, w) => {
      const margin = 4;
      x = Math.max(margin + w / 2, Math.min(width - margin - w / 2, x));
      const b = box(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
      if (b.top < margin || b.bottom > height - margin || widthOf(b) > width - 2 * margin || underWords(b) || onMascot(b)) return false;
      for (const v of veils) if (v.round && intersects(b, v.box)) return false;
      const padded = inset(b, -2, -2);
      for (const icon of V.iconBoxes) if (icon && intersects(padded, icon)) return false;
      for (let i = 0; i < AXES; i++) if (i !== axis && boxes[i] && intersects(padded, boxes[i])) return false;
      for (const level of C.levelBoxes) if (intersects(padded, level)) return false;
      if (B.placed && (intersects(padded, B.score) || intersects(padded, B.adaptive) || (V.adoptable && intersects(padded, B.adopt)))) return false;
      if (C.stopsBox && intersects(padded, C.stopsBox)) return false;
      for (let i = 0; i < AXES; i++) if (distanceTo(padded, point(i, knobFraction(i, 1, true))) < 9) return false;
      boxes[axis] = b;
      return true;
    };
    for (const axis of DRAW_ORDER) {
      const w = Math.max(1, measure(ctx, AXIS_LABELS[axis], 11));
      const icon = V.iconBoxes[axis], tip = point(axis, 1);
      const ax = icon ? centerX(icon) : tip[0], ay = icon ? centerY(icon) : tip[1], halfIcon = icon ? heightOf(icon) / 2 : 0;
      let placed = false;
      for (const at of [[ax, ay + halfIcon + gap + h / 2], [ax, ay - halfIcon - gap - h / 2],
        [ax + halfIcon + gap + w / 2, ay], [ax - halfIcon - gap - w / 2, ay]]) {
        if (tryLabel(axis, at[0], at[1], w)) { placed = true; break; }
      }
      for (const f of [0.9, 0.75, 0.6, 0.45]) {
        if (placed) break;
        const at = point(axis, f);
        for (const side of [-1, 1]) if (tryLabel(axis, at[0], at[1] + side * (h / 2 + 7), w)) { placed = true; break; }
      }
      if (!placed) {
        let best = null, closest = Number.MAX_VALUE;
        const step = Math.max(14, h + gap);
        for (let y = gap + h / 2; y < height - h / 2 - gap; y += step) {
          for (let x = gap + w / 2; x < width - w / 2 - gap; x += 24) {
            const distance = Math.hypot(x - ax, y - ay);
            if (distance >= closest || !tryLabel(axis, x, y, w)) continue;
            closest = distance;
            best = boxes[axis];
            boxes[axis] = null;
          }
        }
        if (best) boxes[axis] = best;
      }
    }
    V.axisLabels = boxes.map((b, i) => b ? {box: b, words: AXIS_LABELS[i], baseline: b.top - metrics.ascent} : null);
  }

  // ---- The layer: rings, offers, shapes, knobs and icons, faded at the view's edges and under the veils ----
  function drawLayer(ctx, fade) {
    drawGrid(ctx, fade);
    // drawOfferShapes(): the displayed offer's polygon.
    for (let m = 0; m < marks.length; m++) if (displayed(m)) drawOfferShape(ctx, m, glide, m === pressed);
    for (let m = 0; m < marks.length; m++) if (displayed(m)) drawOfferMarks(ctx, m, glide, m === opened ? 2 : m === pressed ? 1 : 0);
    drawMinimums(ctx, glide);
    drawChosenOutline(ctx);
    if (knobsOn) drawKnobs(ctx, glide);
    for (let i = 0; i < AXES; i++) {
      const b = V.iconBoxes[i];
      if (b) glyph(ctx, ICONS[i], ui.inkSecondary, b.left, b.top, widthOf(b));
    }
  }
  /** The rings and spokes, faint; strokes take the edge fade (a DST_OUT gradient over the layer in the Java). */
  function drawGrid(ctx, fade) {
    const paint = color => {
      if (!fade) return U.css(color);
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, U.css(withA(color, 0)));
      gradient.addColorStop(fade[0], U.css(color));
      gradient.addColorStop(fade[1], U.css(color));
      gradient.addColorStop(1, U.css(withA(color, 0)));
      return gradient;
    };
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    const adjusting = readoutAxis >= 0 || scaleDragging;
    for (let ring = 1; ring <= rings; ring++) {
      const reference = byArea ? ring === 2 : ring === rings;
      const color = ui.dark ? (reference || adjusting ? 0x24FFFFFF : 0x0EFFFFFF) : (reference || adjusting ? 0x180B2A55 : 0x0A0B2A55);
      circlePath(ctx, skyX, skyY, skyRadius * ring / rings);
      ctx.strokeStyle = paint(color);
      ctx.stroke();
    }
    ctx.strokeStyle = paint(ui.dark ? 0x20FFFFFF : 0x160B2A55);
    for (let i = 0; i < AXES; i++) {
      const tip = point(i, 1);
      ctx.beginPath(); ctx.moveTo(skyX, skyY); ctx.lineTo(tip[0], tip[1]); ctx.stroke();
    }
  }
  function drawOfferShape(ctx, m, g, isPressed) {
    const points = offerPolygon(m, g);
    if (points.length < 2) return;
    polygonPath(ctx, points);
    const color = rgb(markColor(markResults[m]));
    if (points.length > 2) { ctx.fillStyle = U.css(withA(color, isPressed ? 0x28 : 0x12)); ctx.fill(); }
    ctx.setLineDash([]);
    ctx.strokeStyle = U.css(withA(color, 0xE0));
    ctx.lineWidth = 1.8 * Math.max(1, detail);
    ctx.stroke();
  }
  /** Offer m's marks (● passed, ✕ declined, ○ review); lift 1 a finger on it, 2 its ticket open. */
  function drawOfferMarks(ctx, m, g, lift) {
    const mark = marks[m], shown = markShown(m, g), result = markResults[m];
    const color = rgb(markColor(result));
    const alpha = m === 0 || lift > 0 ? 0xFF : Math.max(0x60, 0xE0 - m * 0x0C);
    const aside = markAside(m, detail);
    for (let axis = 0; axis < AXES; axis++) {
      if (Number.isNaN(mark[axis]) || outer <= 0) continue;
      const at = point(axis, shown[axis], aside);
      if (lift > 0) fillCircle(ctx, at[0], at[1], (lift === 2 ? 8 : 10) * detail, withA(color, lift === 2 ? 0x40 : 0x2C));
      if (m === 0 && lift > 0) {
        const pulse = t / 2.4 - Math.floor(t / 2.4);
        ctx.setLineDash([]);
        strokeCircle(ctx, at[0], at[1], (4 + 7 * pulse) * detail, withA(color, Math.floor(0x90 * (1 - pulse))), 1);
      }
      drawMark(ctx, at[0], at[1], result, withA(color, alpha), lift === 2 ? 1.45 : 1);
    }
  }
  function drawMark(ctx, x, y, result, color, scale) {
    const size = 3.2 * detail * scale;
    if (result === KEEP) { fillCircle(ctx, x, y, size, color); return; }
    ctx.setLineDash([]);
    ctx.strokeStyle = U.css(color);
    ctx.lineWidth = 1.6 * Math.min(scale, 1.25);
    if (result === DECLINE) {
      ctx.beginPath();
      ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size);
      ctx.moveTo(x - size, y + size); ctx.lineTo(x + size, y - size);
      ctx.stroke();
    } else { circlePath(ctx, x, y, size); ctx.stroke(); }
  }
  /** Strictly the set shape (solid, filled) and the adaptive one (dashed); by area the minimums' area under both. */
  function drawMinimums(ctx, g) {
    if (!byArea) {
      const scaled = shownScalePercent !== 100;
      if (scaled) drawEffectiveMinimum(ctx, minimumPolygon(g, true));
      drawShape(ctx, drawnSet, drawnFrom, drawnTo, g, setColor, !scaled, false);
      drawShape(ctx, learned, learnedFrom, learnedTo, g, learnedColor, adaptiveOn && !scaled, true);
      drawNothingLearned(ctx, g);
      return;
    }
    drawEffectiveMinimum(ctx, minimumPolygon(g, true));
    drawShape(ctx, drawnSet, drawnFrom, drawnTo, g, setColor, false, false);
    drawShape(ctx, learned, learnedFrom, learnedTo, g, learnedColor, false, true);
    drawNothingLearned(ctx, g);
  }
  function drawEffectiveMinimum(ctx, area) {
    if (area.length < 2) return;
    polygonPath(ctx, area);
    ctx.fillStyle = U.css(withA(setColor, 0x38));
    ctx.fill();
    ctx.setLineDash([]);
    ctx.strokeStyle = U.css(withA(setColor, 0x80));
    ctx.lineWidth = 1.2 * Math.max(1, detail);
    ctx.stroke();
  }
  /** The adaptive minimum is on but learned nothing: a faint dashed outline just outside the set shape. */
  function drawNothingLearned(ctx, g) {
    if (!adaptiveOn || anyLearned || skyRadius <= 0) return;
    if (drawnSet.every(v => Number.isNaN(v))) return;
    const out = 4 * detail / skyRadius;
    const points = [];
    for (let i = 0; i < HOTSPOT; i++) points.push(point(i, (Number.isNaN(drawnSet[i]) ? 0 : lerp(drawnFrom, drawnTo, i, g)) + out));
    polygonPath(ctx, points);
    ctx.strokeStyle = U.css(withA(learnedColor, 0x73));
    ctx.lineWidth = 1.2 * Math.max(1, detail);
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function drawShape(ctx, values, from, to, g, color, filled, dashed) {
    if (values.every(v => Number.isNaN(v))) return;
    const points = values.map((v, i) => point(i, Number.isNaN(v) ? 0 : lerp(from, to, i, g)));
    const axes = points.map((p, i) => Number.isNaN(values[i]) && (byArea || i === HOTSPOT || i === ITEM) ? null : p);
    polygonPath(ctx, orderedPolygon(axes, skyX, skyY));
    if (filled) { ctx.fillStyle = U.css(withA(color, dashed ? 0x22 : 0x30)); ctx.fill(); }
    ctx.strokeStyle = U.css(color);
    ctx.lineWidth = 2 * Math.max(1, detail);
    ctx.setLineDash(dashed ? [5, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    // The adaptive sparkles breathe slowly.
    const breathe = dashed ? 1 + 0.14 * Math.sin(t / 3.2 * TAU) : 1;
    for (let i = 0; i < values.length; i++) {
      if (Number.isNaN(values[i])) continue;
      const at = points[i];
      fillCircle(ctx, at[0], at[1], 8 * breathe * detail, withA(color, 0x3A));
      if (dashed) {
        sparklePath(ctx, at[0], at[1], 6.5 * breathe * detail);
        ctx.fillStyle = U.css(color);
        ctx.fill();
      } else {
        fillCircle(ctx, at[0], at[1], 3.8 * detail, color);
        fillCircle(ctx, at[0], at[1], 1.6 * detail, 0xFFFFFFFF);
      }
    }
  }
  /** The chosen offer's outline once more, over the minimums' filled shape. */
  function drawChosenOutline(ctx) {
    if (strong < 0) return;
    const points = offerPolygon(strong, glide);
    if (points.length < 2) return;
    polygonPath(ctx, points);
    ctx.setLineDash([]);
    ctx.strokeStyle = U.css(withA(markColor(markResults[strong]), 0xC0));
    ctx.lineWidth = 1.8 * Math.max(1, detail);
    ctx.stroke();
  }
  /** The knobs at rest: a set minimum's star larger, in a white rim and a faint ring; else a small hollow knob. */
  function drawKnobs(ctx, g) {
    const breathe = 1 + 0.14 * Math.sin(t / 3.2 * TAU);
    const since = state.beckonSince == null ? -1 : t - +state.beckonSince;
    const beckoning = since >= 0 && since < BECKON_S;
    ctx.setLineDash([]);
    for (let i = 0; i < AXES; i++) {
      if (i === readoutAxis) continue;
      const color = i === HOTSPOT ? ui.inkSecondary : setColor;
      const f = knobFraction(i, g, true);
      const at = point(i, f);
      strokeCircle(ctx, at[0], at[1], 10.5 * detail, withA(color, 0x50), 1.2);
      if (Number.isNaN(set[i])) {
        strokeCircle(ctx, at[0], at[1], 5 * detail, withA(color, 0xC0), 1.8);
        if (i !== HOTSPOT && beckoning) {
          // Two swells, each a ring growing out of the knob's own and fading.
          const half = BECKON_S / 2, swell = (since % half) / half;
          strokeCircle(ctx, at[0], at[1], 10.5 * detail * (1 + 1.3 * swell), withA(color, Math.floor(0xD0 * (1 - swell))), 2);
        }
        continue;
      }
      const dot = 4.6 * detail;
      fillCircle(ctx, at[0], at[1], dot + 1.8 * detail, ui.dark ? 0xE0FFFFFF : 0xFFFFFFFF);
      fillCircle(ctx, at[0], at[1], dot, color);
      fillCircle(ctx, at[0], at[1], 1.8 * detail, 0xFFFFFFFF);
      if (Number.isNaN(learned[i])) continue;
      const sparkle = lerp(learnedFrom, learnedTo, i, g);
      if (Math.abs(sparkle - f) * skyRadius > 2 * detail) continue;
      const spot = point(i, sparkle);
      sparklePath(ctx, spot[0], spot[1], 6.5 * breathe * detail);
      ctx.strokeStyle = U.css(learnedColor);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  // ---- Veils: the Java fades the layer with DST_OUT shapes; without an offscreen layer the layer is drawn once per
  // zone of equal fade, clipped to it, at that zone's alpha. ----
  function veilShapes(v) {
    const feather = 7, b = v.box, shapes = [];
    const cx = centerX(b), cy = centerY(b), reach = widthOf(b) / 2;
    const circle = (r, keep) => shapes.push({circle: true, x: cx, y: cy, r, keep, bounds: box(cx - r, cy - r, cx + r, cy + r)});
    if (v.round && v.fade >= 1) {
      // The mascot's disc: cut out altogether inside its feathered edge.
      [0.35, 0.5, 1].forEach((alpha, step) => { const at = reach + feather * (1 - step); if (at > 0) circle(at, 1 - Math.round(255 * alpha) / 255); });
      return shapes;
    }
    const each = 1 - Math.cbrt(1 - Math.max(0, Math.min(0.99, v.fade)));
    const keep = 1 - Math.round(255 * each) / 255;
    for (let step = 0; step < 3; step++) {
      const d = feather * (step - 1);
      if (v.round) { if (reach - d > 0) circle(reach - d, keep); continue; }
      const r = inset(b, d, d);
      if (widthOf(r) > 0 && heightOf(r) > 0) shapes.push({circle: false, rect: r, corner: Math.min(16, heightOf(r) / 2), keep, bounds: r});
    }
    return shapes;
  }
  function shapePath(ctx, s) {
    if (s.circle) { ctx.moveTo(s.x + s.r, s.y); ctx.arc(s.x, s.y, s.r, 0, TAU); return; }
    ctx.roundRect(s.rect.left, s.rect.top, widthOf(s.rect), heightOf(s.rect), s.corner);
  }
  function clipShape(ctx, s, inside) {
    ctx.beginPath();
    if (!inside) ctx.rect(-8, -8, width + 16, height + 16);
    shapePath(ctx, s);
    ctx.clip(inside ? 'nonzero' : 'evenodd');
  }
  function zones(content) {
    const list = veils.map(veilShapes).filter(sh => sh.length && intersects(sh[0].bounds, content));
    const outside = list.map(sh => ({shape: sh[0], inside: false}));
    const result = [{alpha: 1, clips: outside}];
    // Veils whose outer shapes meet form a cluster; within it every combination of depths is a zone.
    const cluster = list.map((_, i) => i);
    const findRoot = i => cluster[i] === i ? i : (cluster[i] = findRoot(cluster[i]));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (intersects(inset(list[i][0].bounds, -1, -1), list[j][0].bounds)) cluster[findRoot(i)] = findRoot(j);
    }
    const groups = new Map();
    list.forEach((_, i) => { const r = findRoot(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
    for (const members of groups.values()) {
      const depth = members.map(() => 0);
      const total = members.reduce((n, i) => n * (list[i].length + 1), 1);
      for (let code = 1; code < total; code++) {
        let c = code;
        members.forEach((i, k) => { depth[k] = c % (list[i].length + 1); c = Math.floor(c / (list[i].length + 1)); });
        // Skip combinations whose shapes cannot meet.
        let common = box(-Infinity, -Infinity, Infinity, Infinity);
        members.forEach((i, k) => {
          if (!depth[k]) return;
          const b = list[i][depth[k] - 1].bounds;
          common = box(Math.max(common.left, b.left), Math.max(common.top, b.top), Math.min(common.right, b.right), Math.min(common.bottom, b.bottom));
        });
        if (isEmpty(common)) continue;
        let alpha = 1;
        const clips = [];
        members.forEach((i, k) => {
          const d = depth[k], shapes = list[i];
          for (let s = 0; s < d; s++) alpha *= shapes[s].keep;
          if (d > 0) clips.push({shape: shapes[d - 1], inside: true});
          if (d < shapes.length) clips.push({shape: shapes[d], inside: false});
        });
        if (alpha > 0.001) result.push({alpha, clips});
      }
    }
    return result;
  }

  // ---- Over the layer: the rings' dollars, the buttons, the badge, the icons' names, the held knob ----
  function drawLevelLabels(ctx) {
    const C = V.live;
    if (!C.levelBoxes.length) return;
    ctx.save();
    ctx.font = U.font(12, false, true);
    ctx.fillStyle = U.css(ui.dark ? 0xC8FFFFFF : 0xD0214066);
    // The sky's own color at its middle, so the halo reads as clear sky around the words.
    halo(ctx, ui.dark ? SKY_DARK : SKY_LIGHT, 3);
    const metrics = U.metrics(12);
    const baseline = skyY - (metrics.ascent + metrics.descent) / 2;
    for (let i = 0; i < C.levelBoxes.length; i++) {
      if (readoutAxis >= 0 && V.pill && intersects(C.levelBoxes[i], V.pill)) continue;
      // Twice, so the halo is soft but full.
      fillText(ctx, C.levelWords[i], C.levelBoxes[i].left, baseline, 'left', 12);
      fillText(ctx, C.levelWords[i], C.levelBoxes[i].left, baseline, 'left', 12);
    }
    ctx.restore();
  }
  function roundButton(ctx, b, pressedFace, ringColor, ringWidth) {
    const x = centerX(b), y = centerY(b), r = widthOf(b) / 2;
    fillCircle(ctx, x, y, r, pressedFace ? (ui.dark ? 0xFF2E2E2C : 0xFFE4E3DE) : ui.surface);
    ctx.setLineDash([]);
    strokeCircle(ctx, x, y, r - ringWidth / 2, ringColor, ringWidth);
    return [x, y, r];
  }
  /** Score by area's toggle: "Each" / "Area" over the minimum scale ("100%"). */
  function drawScoreToggle(ctx) {
    const b = V.buttons.score;
    const [x, y] = roundButton(ctx, b, pressedButton === 'score' || scaleDragging,
        byArea ? setColor : ui.dark ? 0x40FFFFFF : 0x330B0B0B, byArea ? 2 : 1);
    const color = byArea ? setColor : ui.inkSecondary;
    ctx.fillStyle = U.css(color);
    ctx.font = U.font(9, false, true);
    fillText(ctx, byArea ? 'Area' : 'Each', x, y - 6, 'center', 9);
    ctx.font = U.font(12, false, true);
    fillText(ctx, shownScalePercent + '%', x, y + 13, 'center', 12);
  }
  /** The adaptive minimum's toggle: "Learned", a sparkle and On (filled, ringed in purple) or Off (an outline). */
  function drawAdaptive(ctx) {
    const b = V.buttons.adaptive;
    const learnedInk = ui.dark ? NIGHT_LEARNED : ui.learned;
    const [x, y, r] = roundButton(ctx, b, pressedButton === 'adaptive', adaptiveOn ? learnedInk : ui.dark ? 0x40FFFFFF : 0x330B0B0B,
        adaptiveOn ? 2 : 1);
    let size = 10;
    ctx.font = U.font(size, false, true);
    const labelWidth = measure(ctx, 'Learned', size);
    if (labelWidth > r * 1.65) { size = size * r * 1.65 / labelWidth; ctx.font = U.font(size, false, true); }
    ctx.fillStyle = U.css(adaptiveOn ? learnedInk : ui.inkSecondary);
    fillText(ctx, 'Learned', x, y - 3, 'center', size);
    const words = adaptiveOn ? 'On' : 'Off';
    const iconX = x - measure(ctx, words, size) / 2 - 4;
    sparklePath(ctx, iconX, y + 7, 3);
    if (adaptiveOn) { ctx.fillStyle = U.css(learnedInk); ctx.fill(); }
    else { ctx.strokeStyle = U.css(ui.inkSecondary); ctx.lineWidth = 1; ctx.stroke(); }
    ctx.fillStyle = U.css(adaptiveOn ? learnedInk : ui.inkSecondary);
    fillText(ctx, words, x + 4, y + 11, 'center', size);
  }
  /** The adopt button (the learned minimums made the set ones), or Undo for a while after. */
  function drawAdopt(ctx) {
    const b = V.buttons.adopt;
    const [x, y] = roundButton(ctx, b, pressedButton === 'adopt', ui.dark ? 0x40FFFFFF : 0x330B0B0B, 1);
    glyph(ctx, state.undo ? 'UNDO' : 'ADOPT', ui.ink, Math.round(x - 12), Math.round(y - 12), 24, learnedColor, setColor);
  }
  /** The max stops badge: filled in the set color with the limit ("≤3"); with none, hollow, "≤∞". */
  function drawStops(ctx) {
    const value = stopsDragging ? Math.max(0, Math.round(+state.stopsDrag)) : maxStops;
    let b = V.live.stopsBox;
    if (pressedButton === 'stops' || stopsDragging) b = inset(b, -3, -3);
    const corner = heightOf(b) / 2;
    let textColor;
    if (value > 0) {
      U.rrect(ctx, b.left, b.top, b.right, b.bottom, corner, corner);
      ctx.fillStyle = U.css(setColor);
      ctx.fill();
      textColor = ui.dark ? SKY_DARK : 0xFFFFFFFF;
    } else {
      // The sky's own color under it, so the hollow badge reads over the rings and marks.
      U.rrect(ctx, b.left, b.top, b.right, b.bottom, corner, corner);
      ctx.fillStyle = U.css(ui.dark ? 0xC00D1428 : 0xC0E7EEF2);
      ctx.fill();
      const half = 0.75, r = inset(b, half, half);
      U.rrect(ctx, r.left, r.top, r.right, r.bottom, corner - half, corner - half);
      ctx.setLineDash([]);
      ctx.strokeStyle = U.css(withA(setColor, 0xB0));
      ctx.lineWidth = 1.5;
      ctx.stroke();
      b = r;
      textColor = withA(setColor, 0xD0);
    }
    const metrics = U.metrics(14);
    ctx.font = U.font(14, false, true);
    ctx.fillStyle = U.css(textColor);
    fillText(ctx, stopsWords(value), centerX(b), centerY(b) - (metrics.ascent + metrics.descent) / 2, 'center', 14);
  }
  function drawAxisLabels(ctx) {
    if (!V.axisLabels || !V.axisLabels.length) return;
    ctx.save();
    ctx.font = U.font(11, true);
    halo(ctx, ui.dark ? SKY_DARK : SKY_LIGHT, 3);
    V.axisLabels.forEach((label, i) => {
      if (!label) return;
      ctx.fillStyle = U.css(i === HOTSPOT ? ui.inkSecondary : ui.dark ? 0xFFE0E8EE : 0xFF394D5A);
      fillText(ctx, label.words, label.box.left, label.baseline, 'left', 11);
    });
    ctx.restore();
  }
  /** The knob under the finger, large, set to {@code value}, with its readout pill. */
  function drawHeld(ctx, at, value) {
    fillCircle(ctx, at[0], at[1], 18, withA(setColor, 0x38));
    if (value > 0) {
      fillCircle(ctx, at[0], at[1], 7.5, setColor);
      fillCircle(ctx, at[0], at[1], 2.8, 0xFFFFFFFF);
    } else {
      ctx.setLineDash([]);
      strokeCircle(ctx, at[0], at[1], 7, setColor, 2);
    }
    if (!V.pill) return;
    const words = V.pillWords, p = V.pill, h = heightOf(p);
    U.rrect(ctx, p.left, p.top, p.right, p.bottom, h / 2, h / 2);
    ctx.fillStyle = U.css(setColor);
    ctx.fill();
    const metrics = U.metrics(words.size);
    ctx.font = U.font(words.size, false, true);
    ctx.fillStyle = U.css(ui.dark ? SKY_DARK : 0xFFFFFFFF);
    fillText(ctx, words.text, centerX(p), centerY(p) - (metrics.ascent + metrics.descent) / 2, 'center', words.size);
  }

  /** drawSky(): the layer, then over it the words, the buttons and the knob under the finger. */
  V.draw = function (ctx) {
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    V.layOut(ctx);
    // A view draws inside its own bounds.
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    // The edge fade: where the circle runs past the view's top or bottom, its rings fade over the last 28 dp.
    const band = EDGE_FADE_DP;
    const fade = skyY - skyRadius >= band && skyY + skyRadius <= height - band ? null
        : [Math.min(0.5, band / height), Math.max(0.5, 1 - band / height)];
    let content = box(skyX - skyRadius - 24, skyY - skyRadius - 24, skyX + skyRadius + 24, skyY + skyRadius + 24);
    for (const b of V.iconBoxes) if (b) content = box(Math.min(content.left, b.left), Math.min(content.top, b.top),
        Math.max(content.right, b.right), Math.max(content.bottom, b.bottom));
    // As the Java: the layer drawn once offscreen, the veils cut from it with DST_OUT, then composited; where no
    // offscreen canvas can be had, once per zone of equal fade.
    const layer = zones(content).length > 1 && U.layer ? U.layer(ctx, width, height) : null;
    if (layer) {
      const lc = layer.ctx;
      drawLayer(lc, fade);
      lc.globalCompositeOperation = 'destination-out';
      for (const v of veils) for (const s of veilShapes(v)) {
        lc.globalAlpha = 1 - s.keep; lc.fillStyle = '#000';
        lc.beginPath(); shapePath(lc, s); lc.fill();
      }
      layer.done();
    } else for (const zone of zones(content)) {
      ctx.save();
      for (const c of zone.clips) clipShape(ctx, c.shape, c.inside);
      ctx.globalAlpha *= zone.alpha;
      drawLayer(ctx, fade);
      ctx.restore();
    }
    drawLevelLabels(ctx);
    if (knobsOn) {
      if (V.scoreShown) drawScoreToggle(ctx);
      if (V.adaptiveShown) drawAdaptive(ctx);
      if (V.adoptShown) drawAdopt(ctx);
      if (V.stopsShown) drawStops(ctx);
      drawAxisLabels(ctx);
      if (dragging) drawHeld(ctx, point(held, heldFraction()), dragValue);
      else if (pressing) drawHeld(ctx, point(held, knobFraction(held, glide, true)), setRates[held]);
      else if (readoutAxis >= 0) drawHeld(ctx, point(readoutAxis, knobFraction(readoutAxis, glide, true)), setRates[readoutAxis]);
    }
    ctx.restore();
  };

  /** moveKnob() / rateAt(): the value a knob held on {@code axis} takes {@code distance} dp out along its spoke, on the
   * scale the drag holds still: in steps; its own value within half a step of where it stood; 0 (off) inside the
   * resting place (a knob that set out inside it, a clear 12 dp further in). */
  V.knobValueAt = function (axis, distance) {
    let o = outer, u = unit;
    if (o <= 0) { o = FIRST_RING_CENTS * 3; u = [1, 1, 1, 1, 1, 1]; }
    const grab = knobFraction(axis, 1, false) * skyRadius;
    const offAt = setRates[axis] > 0 ? Math.min(KNOB_REST_DP, grab - 12) : KNOB_REST_DP;
    const units = [1, example.miles, example.minutes, example.stops, HOTSPOT_DISPLAY_UNIT,
      hasItems(example) ? example.items : ITEM_EDIT_UNITS][axis];
    const halfStep = askCents(axis, STEPS[axis]) / u[axis] / o * skyRadius / 2;
    if (Math.abs(distance - grab) < halfStep) return setRates[axis];
    const out = Math.min(distance, pushLimit(axis));
    if (out <= offAt) return 0;
    const steps = Math.max(1, Math.round(out / skyRadius * o * u[axis] / units / STEPS[axis]));
    return Math.min(MOST_CENTS, steps * STEPS[axis]);
  };
  /** Where things stand (for the film's finger), after layOut. */
  V.places = function () {
    return {
      knobs: KEYS.map((_, i) => point(i, knobFraction(i, glide, true))),
      tips: KEYS.map((_, i) => point(i, 1)),
      icons: V.iconBoxes,
      score: V.scoreShown ? V.buttons.score : null,
      adaptive: V.adaptiveShown ? V.buttons.adaptive : null,
      adopt: V.adoptShown ? V.buttons.adopt : null,
      stops: V.stopsShown ? V.live.stopsBox : null,
      levelLabels: V.live.levelBoxes.map((b, i) => ({box: b, words: V.live.levelWords[i]})),
      axisLabels: V.axisLabels || [],
      readout: V.pill ? {box: V.pill, words: V.pillWords.text} : null,
      ringCents, rings, outer, example
    };
  };
  /** Where everything is drawn now, as shares of the outer ring, for a later state's glide (letGo()). */
  V.drawn = {
    set: KEYS.map((_, i) => dragging && i === held ? (dragValue > 0 ? heldFraction() : 0) : lerp(setFrom, setTo, i, glide)),
    learned: KEYS.map((_, i) => lerp(learnedFrom, learnedTo, i, glide)),
    area: KEYS.map((_, i) => {
      if (dragging && i === held && byArea && (i !== ITEM || hasItems(example)) && outer > 0) {
        let ask = dragValue > 0 ? askCents(i, dragValue) / unit[i] : 0;
        if (adaptiveOn && !Number.isNaN(learned[i])) ask = Math.max(ask, learned[i]);
        return Math.min(1, ask / outer);
      }
      return lerp(areaFrom, areaTo, i, glide);
    }),
    marks: {}
  };
  markEntries.forEach((i, m) => { V.drawn.marks[markKey(i)] = markShown(m, glide); });
  return V;
}

/** Draws the constellation as the page's sky; see the state at the top of this file. */
S.draw = function (ctx, ui, state) {
  if (!state || !(state.radius > 0)) return;
  ctx.save();
  view(state, ui).draw(ctx);
  ctx.restore();
};

/** Where the knobs, icons, buttons, badge and words stand for {@code state} (needs a context to measure words). */
S.places = function (ctx, ui, state) {
  const V = view(state, ui);
  V.layOut(ctx);
  return V.places();
};

/** The value a knob held on {@code axis} takes {@code distance} dp out along its spoke (for scripting a drag). */
S.knobValueAt = function (state, axis, distance) {
  return view(state, U.palette(false)).knobValueAt(axisIndex(axis), distance);
};

// ---- SkyStage: where the page puts the circle, the mascot, and the veils ----
const SIDE_DP = 16, LEAST_RADIUS_DP = 56, MASCOT_MOST_DP = 36, MASCOT_LEAST_DP = 28, SPOKE_CLEAR_DP = 12;
const MASCOT_EDGE_DP = 6, OFF_MIDDLE_LEAST_DP = 8, OFF_MIDDLE_MOST_DP = 24, ICON_EDGE_DP = 4;
const HEADER_COUNTS_SPACING_DP = 60, COUNTS_HEIGHT_DP = 66;
/**
 * SkyStage.compose() and veils(). opts: width, height (the sky stage, dp), headerHeight (62), linesHeight (0; the
 * page's lines along the bottom), titleRoom (the header's empty title width, default for a 412 dp page without the
 * split button), counts ({left, top, right, bottom}; default from titleRoom as placeCounts() works it out),
 * sun ({x, y, size} of the header's sun/moon button, or false), lines ([{left, top, right, bottom}] each line's words).
 */
S.stage = function (opts) {
  opts = opts || {};
  const width = opts.width == null ? 412 : opts.width, height = opts.height == null ? 560 : opts.height;
  const headerHeight = opts.headerHeight == null ? 62 : opts.headerHeight;
  const linesHeight = opts.linesHeight || 0;
  let counts = opts.counts;
  if (!counts) {
    // placeCounts(): beside the header's buttons when the title leaves their columns room, else under the header.
    const room = opts.titleRoom == null ? width - 20 - 12 - 52 - 66 - 52 : opts.titleRoom;
    let spacing = Math.min(96, room * 0.3);
    if (spacing >= HEADER_COUNTS_SPACING_DP) {
      const top = Math.max(0, (headerHeight - COUNTS_HEIGHT_DP) / 2);
      counts = box(20, top, 20 + 2 * spacing + 64, top + COUNTS_HEIGHT_DP);
    } else {
      spacing = Math.min(96, (width - 2 * SIDE_DP) * 0.3);
      const wide = 2 * spacing + 64;
      counts = box((width - wide) / 2, headerHeight, (width + wide) / 2, headerHeight + COUNTS_HEIGHT_DP);
    }
  }
  const top = Math.max(headerHeight, counts.bottom) + 4;
  const floor = height - ICON_EDGE_DP;
  const linesTop = height - linesHeight;
  const mascotReach = (cx, cy, radius) => {
    const y = Math.min(cy, linesTop - 4 - radius);
    if (y - radius < top) return NaN;
    const reach = (radius + SPOKE_CLEAR_DP + (cy - y) * COS) / SIN;
    return reach <= cx - MASCOT_EDGE_DP - radius ? reach : NaN;
  };
  const largest = (side, cx) => {
    let low = 20, high = Math.max(low, width);
    while (high - low > 0.5) {
      const radius = (low + high) / 2;
      const fits = S.backdropHalfWidth(radius) <= side && top + S.backdropAbove(radius) + S.backdropBelow(radius) <= floor
          && !Number.isNaN(mascotReach(cx, top + S.backdropAbove(radius), MASCOT_LEAST_DP));
      if (fits) low = radius; else high = radius;
    }
    return low;
  };
  const tallest = largest(Number.MAX_VALUE, width / 2 + OFF_MIDDLE_MOST_DP);
  const room = width / 2 - ICON_EDGE_DP - S.backdropHalfWidth(tallest);
  const x = width / 2 + Math.max(OFF_MIDDLE_LEAST_DP, Math.min(OFF_MIDDLE_MOST_DP, room));
  const radius = largest(width - x - ICON_EDGE_DP, x);
  const highest = top + S.backdropAbove(radius);
  const lowest = Math.min(Math.min(floor, linesTop - ICON_EDGE_DP) - S.backdropBelow(radius), height - radius);
  const y = lowest >= highest ? (highest + lowest) / 2 : highest;
  // The mascot at the upper left, clear of both left spokes, under the header and counts.
  const fits = (x - MASCOT_EDGE_DP - SPOKE_CLEAR_DP / SIN) / (1 + 1 / SIN);
  const between = S.spokeHalfHeight(radius) + 4;
  const mascotRadius = Math.max(MASCOT_LEAST_DP, Math.min(MASCOT_MOST_DP, Math.min(fits, between)));
  const mascot = {x: mascotRadius + MASCOT_EDGE_DP, y: top + mascotRadius + 2, radius: mascotRadius};
  // veils(): under the counts, the mascot's disc cut out, the sun's glow, each line of words.
  const veils = [];
  veils.push({left: counts.left - 10, top: counts.top - 2, right: counts.right + 10, bottom: counts.bottom + 2, round: false, strength: 0.82});
  const ring = mascotRadius - 4;
  veils.push({left: mascot.x - ring, top: mascot.y - ring, right: mascot.x + ring, bottom: mascot.y + ring, round: true, strength: 1});
  const sun = opts.sun === false ? null : opts.sun || {x: width - 12 - 52 - 10 - 28, y: 10 + 28, size: 56};
  if (sun) {
    const glow = sun.size * 0.62;
    veils.push({left: sun.x - glow, top: sun.y - glow, right: sun.x + glow, bottom: sun.y + glow, round: true, strength: 0.7});
  }
  for (const line of opts.lines || []) veils.push({left: line.left, top: line.top, right: line.right, bottom: line.bottom, round: false, strength: 0.8});
  return {x, y, radius, width, height, mascot, counts, veils, top, linesTop};
};

/** The page's state line (16 sp medium, centered, 12/4 dp padding) at the bottom of the sky: its box (also its veil). */
S.hintBox = function (ctx, text, width, linesTop) {
  ctx.save();
  ctx.font = U.font(16, true);
  const w = ctx.measureText(text).width + 24;
  ctx.restore();
  const m = U.metrics(16);
  // includeFontPadding: the line runs from the font's top to its bottom.
  const h = 4 + (1.056641 + 0.270996) * 16 + 4;
  const left = width / 2 - w / 2;
  return {left, top: linesTop, right: left + w, bottom: linesTop + h, baseline: linesTop + 4 - m.top};
};
/** Draws the page's state line ("Drag a knob to start") in its box; MainActivity's TextView, not this view. */
S.drawHint = function (ctx, ui, hint, text) {
  ctx.save();
  ctx.font = U.font(16, true);
  ctx.fillStyle = U.css(ui.ink);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text || S.START_HINT, (hint.left + hint.right) / 2, hint.baseline);
  ctx.restore();
};

// ---- Demo states: invented offers, plausible DoorDash-like values ----
const DEMO_OFFERS = [
  {id: 8, pay: 650, miles: 4.8, minutes: 24, stops: 2, result: 'declined'},
  {id: 7, pay: 975, miles: 3.3, minutes: 18, stops: 2, result: 'passed'},
  {id: 6, pay: 350, miles: 2.1, minutes: 15, stops: 2, result: 'declined'},
  {id: 5, pay: 725, miles: 6.9, minutes: 31, stops: 2, result: 'declined'},
  {id: 4, pay: 1200, miles: 5.6, minutes: 26, stops: 2, result: 'passed'},
  {id: 3, pay: 500, miles: 4.0, minutes: 22, stops: 2, result: 'declined'},
  {id: 2, pay: 850, miles: 7.5, minutes: 35, stops: 2, result: 'declined'},
  {id: 1, pay: 1025, miles: 4.4, minutes: 21, stops: 2, result: 'passed'}
];
const demoStage = S.stage({width: 412, height: 560, headerHeight: 62});
const place = st => ({x: st.x, y: st.y, radius: st.radius, width: st.width, height: st.height, veils: st.veils});
S.demo = {
  /** The layout these states use: a 412 × 560 dp sky under a 62 dp header, the counts beside it. */
  stage: demoStage,
  /** (a) Rules set: $4.00 pay, $1.50/mi, $0.30/min, at most 3 stops, the adaptive minimum on and learning;
   * eight recent offers (five declined, three passed), the newest displayed. */
  rules: Object.assign(place(demoStage), {
    rules: {pay: 400, perMile: 150, perMinute: 30, maxStops: 3, adaptive: true},
    learned: {pay: 576, perMile: 172, perMinute: 38, perStop: 310},
    offers: DEMO_OFFERS, selected: -1, t: 0
  }),
  /** (b) The same, mid-drag of the per-mile knob, at $1.85/mi: the knob large under the finger, its readout pill. */
  drag: Object.assign(place(demoStage), {
    rules: {pay: 400, perMile: 150, perMinute: 30, maxStops: 3, adaptive: true},
    learned: {pay: 576, perMile: 172, perMinute: 38, perStop: 310},
    offers: DEMO_OFFERS, selected: -1, drag: {axis: 'perMile', value: 185}, t: 0
  }),
  /** (c) No rules yet: six hollow knobs beckoning; the page says "Drag a knob to start" at the bottom of the sky. */
  empty: null
};
// (c)'s line of words along the sky's bottom: its veil, and the line itself for the page to draw.
(function () {
  const linesHeight = 4 + (1.056641 + 0.270996) * 16 + 4;
  const textWidth = 141.3; // "Drag a knob to start" in Roboto Medium 16 (measured)
  const left = 206 - textWidth / 2 - 12;
  const hint = {left, top: 560 - linesHeight, right: left + textWidth + 24, bottom: 560};
  hint.baseline = hint.top + 4 + 1.056641 * 16;
  const st = S.stage({width: 412, height: 560, headerHeight: 62, linesHeight, lines: [hint]});
  S.demo.emptyStage = st;
  S.demo.empty = Object.assign(place(st), {rules: {}, learned: {}, offers: [], beckonSince: 0, t: 0.3,
    hint: Object.assign({text: S.START_HINT}, hint)});
})();
})(typeof window !== 'undefined' ? window : globalThis);
