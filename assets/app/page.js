/* The app's main page as a 412 x 915 dp phone shows it (Android 15, edge to edge), composed from the ported views as
 * MainActivity.buildMain lays them out: ScenePage behind everything; SkyStage's sky holding the constellation, the
 * mascot with its counts and the header; the body below it (the offer caption, the wait estimate, the skyline, the area
 * map and its line); the road strip; then Android's status bar and gesture handle, and over them the bottom sheet with
 * an offer's ticket (MainActivity.showSelection, Decor.Ticket and Decor.Stamp) and the heads-up notification. The page's
 * state is plain data for one moment, filled by the film. Units are dp. */
(function(root) {
'use strict';
const App = root.OfferApp = root.OfferApp || {};
const U = App.util, P = App.phone;
const W = P.W, H = P.H, TOP = P.STATUS, BOTTOM = P.NAV, PAGE = H - TOP - BOTTOM, SIDE = 16, ROAD = 78;
const SIN = Math.sin(U.rad(30)), COS = Math.cos(U.rad(30));

/* SkyStage.compose without the constellation's port (it brings its own, OfferApp.star.stage): the largest circle whose
 * spokes and icons stay inside the sky below the header and counts, a little right of the middle, the mascot upper left. */
function compose(width, height, top) {
  const r = top + 36 + 2;
  return {x: width / 2 + 24, y: (top + height) / 2, radius: Math.min(width / 2 - 70, (height - top) / 2 - 40),
    mascot: {x: 42, y: r, radius: 36}, veils: []};
}

/* The page's measure pass on this screen, worked out once per header shape. */
const layouts = {};
function layout(split) {
  const key = split ? 'split' : 'plain';
  if (layouts[key]) return layouts[key];
  const head = App.header.layout(W, {split, top: 0}), place = App.hero.skyPlacement({width: W, splitShown: split});
  const headerHeight = place.headerHeight, counts = place.counts;
  // The sky (its header and counts) and the body share what the road leaves, by equal weight.
  const fixed = Math.max(headerHeight, counts.bottom), excess = PAGE - fixed - ROAD;
  const sky = fixed + excess / 2, body = excess / 2;
  // In the body: the caption and the wait estimate (48 dp each), the skyline (weight .7, 6 dp above) and the map
  // (weight 1, 2 dp above), then the area line (36 dp).
  const caption = 48, wait = 48, area = 36, share = body - caption - wait - 6 - 2 - area;
  const chartH = Math.max(App.skyline.least(false), share * .7 / 1.7), mapH = share - chartH;
  const captionTop = sky, waitTop = sky + caption, chartTop = waitTop + wait + 6, mapTop = chartTop + chartH + 2, areaTop = mapTop + mapH;
  const sun = {x: (head.sun.left + head.sun.right) / 2, y: (head.sun.top + head.sun.bottom) / 2, size: head.sun.right - head.sun.left};
  const star = App.star && App.star.stage
    ? App.star.stage({width: W, height: sky, headerHeight, counts, sun})
    : compose(W, sky, fixed + 4);
  return layouts[key] = {split, head, headerHeight, counts, spacing: place.spacing, mascot: star.mascot, star, sun, sky,
    captionTop, waitTop, chartTop, chartH, mapTop, mapH, areaTop, horizon: App.scene.horizon(chartTop + chartH, waitTop, PAGE),
    roadTop: PAGE - ROAD};
}

/* ---- The ticket in the bottom sheet (MainActivity.showSelection) ---- */

const STUB = 52, NOTCH = 9;
/** Decor.Ticket: a rounded card inset 1 dp, a notch bitten from each side at the stub's foot, a dashed tear line. */
function ticketShape(ctx, ui, l, t, r, b, stub) {
  const cut = t + stub, x0 = l + 1, x1 = r - 1, y0 = t + 1, y1 = b - 1, k = 14;
  const dy = Math.sqrt(NOTCH * NOTCH - 1), a = Math.atan2(dy, 1);
  ctx.beginPath();
  ctx.moveTo(x0 + k, y0);
  ctx.arcTo(x1, y0, x1, y0 + k, k);
  ctx.lineTo(x1, cut - dy);
  ctx.arc(r, cut, NOTCH, Math.PI + a, Math.PI - a, true);
  ctx.arcTo(x1, y1, x1 - k, y1, k);
  ctx.arcTo(x0, y1, x0, y1 - k, k);
  ctx.lineTo(x0, cut + dy);
  ctx.arc(l, cut, NOTCH, a, -a, true);
  ctx.arcTo(x0, y0, x0 + k, y0, k);
  ctx.closePath();
  ctx.fillStyle = U.css(ui.dark ? 0xFF22211F : 0xFFFFFDF7); ctx.fill();
  ctx.strokeStyle = U.css(ui.dark ? 0xFF3A3935 : 0xFFE3DFD2); ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(l + NOTCH + 4, cut); ctx.lineTo(r - NOTCH - 4, cut); ctx.stroke();
  ctx.setLineDash([]);
}

const STAMP_INK = {PASSED: [0xFF53C953, 0xFF0E8A0E], ACCEPTED: [0xFF53C953, 0xFF0E8A0E], DECLINED: [0xFFFF6B6B, 0xFFC62828]};
/** Decor.Stamp: the outcome's word in a worn, rounded border, slanted, thumping down as `press` goes 0 to 1. */
function stamp(ctx, ui, left, top, word, outcome, press) {
  const size = 15, em = .12, sp = em * size, chars = Array.from(word);
  ctx.save();
  ctx.font = U.font(size);
  const advance = ctx.measureText(word).width + chars.length * sp;
  const w = Math.round(advance + 34), h = Math.round(size * 2.4);
  const ink = outcome === 'YOURS' ? ui.inkSecondary : (STAMP_INK[outcome] || [0xFFF5B83D, 0xFFA86A00])[ui.dark ? 0 : 1];
  const color = U.withAlpha(ink, Math.round(255 * Math.min(1, press * 1.6)));
  ctx.translate(left + w / 2, top + h / 2);
  const scale = 1 + .45 * (1 - press);
  ctx.scale(scale, scale); ctx.rotate(U.rad(-7 - 5 * (1 - press)));
  ctx.translate(-w / 2, -h / 2);
  ctx.strokeStyle = U.css(color); ctx.fillStyle = U.css(color);
  ctx.lineWidth = 2.5; ctx.setLineDash([22, 2, 9, 3]); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  U.rrect(ctx, 8, h * .18, w - 8, h * .82, 5); ctx.stroke(); ctx.setLineDash([]);
  // Fake-bold, letter-spaced, centred on its middle.
  const m = U.metrics(size), y = h / 2 - (m.ascent + m.descent) / 2;
  let x = (w - advance) / 2 + sp / 2, prefix = '';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = size / 34; ctx.lineJoin = 'miter';
  chars.forEach((ch, i) => {
    const cx = x + ctx.measureText(prefix).width + i * sp;
    ctx.fillText(ch, cx, y); ctx.strokeText(ch, cx, y); prefix += ch;
  });
  ctx.restore();
  return {w, h};
}

/** A one-line TextView: its text at `size` from `top`, returns the line's height (Roboto's top to bottom). */
function line(ctx, text, x, top, size, color, medium, align) {
  const m = U.metrics(size);
  ctx.font = U.font(size, medium); ctx.fillStyle = U.css(color); ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, top - m.top);
  return m.bottom - m.top;
}

/** The ticket's height for `sheet` (see draw()), at the sheet's inner width. */
function ticketHeight(ctx, sheet, width) {
  const card = App.ticket.measure(ctx, width - 32, sheet.entry).height;
  const lh = size => U.metrics(size).bottom - U.metrics(size).top;
  return STUB + 12 + card + (sheet.score ? 8 + lh(14) : 0) + 10 + lh(16) + 4 + lh(13) + 10 + 48 + 14;
}

/** The ticket's column: stub (stamp and time), the offer card, its score, the reason, what the app did, the button. */
function ticket(ctx, ui, left, top, width, sheet) {
  const height = ticketHeight(ctx, sheet, width), e = sheet.entry;
  ctx.save();
  ticketShape(ctx, ui, left, top, left + width, top + height, STUB);
  const inner = left + 16, innerW = width - 32;
  const s = stamp(ctx, ui, inner, top + (STUB - Math.round(15 * 2.4)) / 2, sheet.word, sheet.outcome, U.clamp(sheet.press == null ? 1 : sheet.press, 0, 1));
  void s;
  const m13 = U.metrics(13);
  line(ctx, sheet.time, inner + innerW, top + (STUB - (m13.bottom - m13.top)) / 2, 13, ui.inkSecondary, false, 'right');
  let y = top + STUB + 12;
  const cardH = App.ticket.measure(ctx, innerW, e).height;
  ctx.save(); ctx.translate(inner, y); App.ticket.draw(ctx, ui, {width: innerW, height: cardH, entry: e}); ctx.restore();
  y += cardH;
  if (sheet.score) y += 8 + line(ctx, sheet.score, inner, y + 8, 14, ui.inkSecondary, true);
  y += 10 + line(ctx, sheet.reason, inner, y + 10, 16, ui.ink, true);
  y += 4 + line(ctx, sheet.action, inner, y + 4, 13, ui.inkSecondary, false);
  y += 10;
  U.rrect(ctx, inner, y, inner + innerW, y + 48, 24);
  ctx.fillStyle = U.css(ui.dark ? 0x14FFFFFF : 0x0F0B0B0B); ctx.fill();
  const m15 = U.metrics(15);
  ctx.font = U.font(15, true); ctx.fillStyle = U.css(ui.ink); ctx.textAlign = 'center';
  ctx.fillText('Minimums · blue saved / purple learned', inner + innerW / 2, y + 24 - (m15.ascent + m15.descent) / 2);
  ctx.restore();
  return height;
}

/** The constellation's state in place: the page's circle and veils over the film's rules and offers. */
function starState(L, s) {
  if (!s.star) return null;
  const at = {x: L.star.x, y: L.star.y, radius: L.star.radius, width: W, height: L.sky, veils: L.star.veils};
  const state = Object.assign({}, s.star, at, {t: s.t});
  if (state.glide) state.glide = {from: Object.assign({}, state.glide.from, at), since: state.glide.since};
  return state;
}
const inset = (b, d) => ({left: b.left - d, top: b.top - d, right: b.right + d, bottom: b.bottom + d});

/** Draws one moment of the page.
 *  state = {dark, t, split, mode, hero (FilterHeroView state), star (constellation state), skyline (DecisionChartView
 *  state), map (AreaMapView state), caption (text), wait (text or null), place, watching, watchingSince, time,
 *  notification {show, title, body}, sheet {open, entry, word, outcome, press, time, score, reason, action},
 *  touches [{press, then x, y (page dp, under the status bar) or knob: axis ('perMile'…) or flag: skyline index}]}. */
function draw(ctx, s) {
  const ui = U.palette(s.dark), L = layout(s.split !== false);
  // Views wholly outside the part of the page in sight (s.view, page dp) are skipped.
  const view = s.view || {top: -TOP, bottom: PAGE + BOTTOM}, seen = (top, bottom) => bottom >= view.top && top <= view.bottom;
  ctx.save();
  // Android's Paint defaults, whatever the caller's context was set to.
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.miterLimit = 4; ctx.setLineDash([]); ctx.lineDashOffset = 0;
  ctx.globalCompositeOperation = 'source-over'; ctx.shadowColor = 'transparent'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = U.css(App.scene.skyTop(s.dark)); ctx.fillRect(0, 0, W, H);
  ctx.translate(0, TOP);
  const star = App.star ? starState(L, s) : null;
  const chart = Object.assign({}, s.skyline, {width: W - 2 * SIDE, height: L.chartH, t: s.t});
  // SkyStage.wordsAt / iconsAt: the counts, the rings' dollars and the spokes' names; the constellation's icons.
  const words = [inset(L.counts, 4)], icons = [];
  const places = star && App.star.places ? App.star.places(ctx, ui, star) : null;
  if (places) {
    for (const label of places.levelLabels || []) words.push(inset(label.box, 3));
    for (const label of places.axisLabels || []) if (label && label.box) words.push(inset(label.box, 2));
    for (const box of [...(places.icons || []), places.score, places.adaptive, places.adopt, places.stops]) if (box) icons.push(box);
  }
  App.scene.draw(ctx, ui, {width: W, height: PAGE, horizonY: L.horizon, words, icons, sun: {x: L.sun.x, y: L.sun.y},
    watching: s.watching, watchingSince: s.watchingSince, place: s.place, t: s.t,
    skylineTop: (a, b) => L.chartTop + App.skyline.highestWithin(chart, a - SIDE, b - SIDE)});
  // The sky, back to front: the constellation, the mascot and its counts, then the header's buttons.
  if (star && seen(star.y - star.radius - 40, star.y + star.radius + 10)) App.star.draw(ctx, ui, star);
  if (seen(L.counts.top - 10, L.mascot.y + L.mascot.radius + 60)) {
    App.hero.draw(ctx, ui, Object.assign({}, s.hero, {mascotX: L.mascot.x, mascotY: L.mascot.y, mascotRadius: L.mascot.radius,
      counts: L.counts, spacing: L.spacing, t: s.t}));
  }
  if (seen(0, L.head.height)) App.header(ctx, ui, {width: W, top: 0, mode: s.mode || 'AUTO', split: L.split, t: s.t});
  // The body: the caption, the wait estimate, the skyline, the map and its line.
  ctx.save(); ctx.translate(SIDE, L.captionTop); App.caption.draw(ctx, ui, {width: W - 2 * SIDE, height: 48, text: s.caption}); ctx.restore();
  if (s.wait) {
    const m = U.metrics(13);
    ctx.save(); ctx.font = U.font(13); ctx.fillStyle = U.css(ui.inkSecondary); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(s.wait, W / 2, L.waitTop + 24 - (m.ascent + m.descent) / 2); ctx.restore();
  }
  if (seen(L.chartTop - 60, L.chartTop + L.chartH)) { ctx.save(); ctx.translate(SIDE, L.chartTop); App.skyline.draw(ctx, ui, chart); ctx.restore(); }
  const ground = App.areaMap.sceneGround(ui, L.mapTop, L.mapH, L.horizon, PAGE);
  const map = Object.assign({}, s.map, {width: W - 2 * SIDE, height: L.mapH, t: s.t, ground});
  if (seen(L.mapTop, L.areaTop + 36)) {
    ctx.save(); ctx.translate(SIDE, L.mapTop); App.areaMap.draw(ctx, ui, map); ctx.restore();
    ctx.save(); ctx.translate(SIDE, L.areaTop); App.areaMap.drawAreaLine(ctx, ui, map, W - 2 * SIDE, false); ctx.restore();
  }
  if (seen(L.roadTop, PAGE)) App.ground.draw(ctx, ui, {width: W, height: ROAD, top: L.roadTop, t: s.t});
  // A finger on the page, as Android's "Show taps" draws one: on a knob, a building's flag or a point.
  for (const touch of s.touches || []) {
    let at = touch.knob && places ? places.knobs[App.star.KEYS.indexOf(touch.knob)] : null;
    if (touch.flag != null) { const f = App.skyline.flagAt(chart, touch.flag); at = f && [SIDE + f[0], L.chartTop + f[1]]; }
    if (!at && touch.x != null) at = [touch.x, touch.y];
    if (at) P.touch(ctx, at[0], at[1], touch.press);
  }
  ctx.restore();
  // Android's own chrome over the page: the status bar and handle, the sheet, the heads-up notification.
  P.statusBar(ctx, !s.dark, s.time);
  P.handle(ctx, !s.dark);
  if (s.sheet && s.sheet.open > 0) {
    const height = 10 + 4 + 10 + ticketHeight(ctx, s.sheet, W - 32) + 16;
    P.sheet(ctx, ui, s.sheet.open, height, (c, left, top, width) => ticket(c, ui, left, top, width, s.sheet));
    P.handle(ctx, !s.dark);
  }
  if (s.notification) P.notification(ctx, s.dark, s.notification);
}

App.page = {W, H, TOP, PAGE, SIDE, layout, draw, ticket, ticketHeight};
})(typeof window !== 'undefined' ? window : globalThis);
