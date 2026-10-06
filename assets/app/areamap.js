/* AreaMapView.java, with what it draws from in AreaMap.java and MainActivity.java: the offer areas drawn into the main
 * page's ground, north up, with no map tiles. Each square where offers came in is gilded deeper the better its pay per
 * mile, with coins on the best three (named after their neighbourhood when known) and a dotted trail from you to the
 * best. Squares with too few offers to rank are dashed outlines. A dot marks where the phone is now; a scale bar and a
 * compass rose give distance and direction. The land fades out toward every edge; the heading, compass and scale stay
 * crisp above it. With no squares it says why. Units are dp (OfferApp.util); colors are Android ARGB ints.
 *
 * State (plain data):
 *   width, height  the view's size [dp]. On the main page: the body's width (412 - 2 x 16 = 380) by the map's share of
 *                  the ground, never under layout.leastDp (96 dp; 84 in a short window). 2 dp above it (topMargin).
 *   cells          AreaMap.Cell list, in the store's order: {row, col, offers, mileOffers, milePayCents, miles}.
 *                  row = floor(latitude / 0.02), col = floor(longitude / 0.02): squares of CELL_DEGREES (0.02 deg,
 *                  about 2.2 km north-south). offers: standalone offers noted there (not drawn); mileOffers: those
 *                  whose miles were read; milePayCents [cents] and miles [mi]: their summed pay and miles. Pay per mile
 *                  = milePayCents / miles. A square is ranked with mileOffers >= 3 (MIN_OFFERS) and miles > 0; ranks
 *                  (1 = best) are worked out here exactly as AreaMap.ranked does, not given.
 *   here           [latitude, longitude] of the phone [degrees], or null (no dot, no trail, no "You").
 *   selected       {row, col} of the chosen square. Omitted: the app's own choice, the best square (MainActivity.
 *                  refreshAreas selects it until the user taps one). null: none.
 *   names          place names by square, {"row,col": "Riverside"} (Places; the app asks only for the best three).
 *   emptyMessage   what the ground says with no squares (MainActivity sets "Offers will pin here", or
 *                  "Tap to allow location" / "Tap to map where offers pay best"). Default "Offers will pin here".
 *   ground         what lies behind the map: an ARGB int, or [atTop, atBottom] for a vertical gradient over the
 *                  view's height (see sceneGround). Default ui.page. Needed by the edge fade, see fadeEdges.
 *   t              seconds: the trail's dots walk (1.6 s loop) and the "You" halo breathes (2.8 s loop).
 */
(function(root) {
'use strict';
const App = root.OfferApp = root.OfferApp || {};
const U = App.util;

// AreaMap.java
const CELL = 0.02;               // CELL_DEGREES
const MIN_OFFERS = 3;            // offers with miles before a square is ranked
const MILES_PER_DEGREE = 69.05;  // MILES_PER_DEGREE_LATITUDE
// AreaMapView.java
const MEDALS = [0xFFE3B341, 0xFFB9BDC3, 0xFFCD8B4E];
const GOLD = 0xFFD39B2A;
const TITLE = 'Offers received \u00B7 $/mi';
const FADE_DP = 22;              // how far in from each edge the land fades from nothing to full
const KEY_HEIGHT = 20;           // keyHeight(): the heading's strip above the land
const EMPTY = 'Offers will pin here';

// ---- AreaMap.Cell and AreaMap's reading helpers ----
const latitude = c => (c.row + 0.5) * CELL;
const longitude = c => (c.col + 0.5) * CELL;
const isRanked = c => c.mileOffers >= MIN_OFFERS && c.miles > 0;
/** Pooled pay per mile: all pay over all miles, so one short trip cannot dominate. */
const centsPerMile = c => c.miles > 0 ? c.milePayCents / c.miles : 0;
const key = c => c.row + ',' + c.col;

/** Java's String.format("%.Nf"): HALF_UP on the double's shortest decimal digits (JS toFixed rounds the binary). */
function fixed(v, n) {
  const s = String(Math.abs(v));
  if (s.includes('e')) return v.toFixed(n);
  const [whole, frac = ''] = s.split('.');
  const digits = (whole + frac.padEnd(n + 1, '0')).split('').map(Number), keep = whole.length + n;
  const out = digits.slice(0, keep);
  let carry = digits[keep] >= 5;
  for (let k = keep - 1; carry && k >= 0; k--) { out[k] = (out[k] + 1) % 10; carry = out[k] === 0; }
  const str = (carry ? '1' : '') + out.join(''), cut = str.length - n;
  return (v < 0 ? '-' : '') + (n ? str.slice(0, cut) + '.' + str.slice(cut) : str);
}

/** Cell.perMile(): "$2.58/mi". */
const perMile = c => '$' + fixed(centsPerMile(c) / 100, 2) + '/mi';

/** Squares with enough offers, best pay per mile first (more offers first on a tie); a stable sort, like Java's. */
const ranked = cells => (cells || []).filter(isRanked)
  .sort((a, b) => Math.sign(centsPerMile(b) - centsPerMile(a)) || (b.mileOffers - a.mileOffers));

/** How far and which way a square's middle is from here: [miles, degrees clockwise from north]; null unknown. */
function offset(here, c) {
  if (!here) return null;
  const north = (latitude(c) - here[0]) * MILES_PER_DEGREE;
  const east = (longitude(c) - here[1]) * MILES_PER_DEGREE * Math.cos(U.rad(here[0]));
  return [Math.hypot(north, east), (Math.atan2(east, north) * 180 / Math.PI + 360) % 360];
}
const compassPoint = bearing => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8];
/** AreaMap.from: "2.1 mi NE of you", "Around you" within about a mile, or "" with no position to measure from. */
function from(here, c) {
  const way = offset(here, c);
  if (!way) return '';
  if (way[0] < 1) return 'Around you';
  return fixed(way[0], 1) + ' mi ' + compassPoint(way[1]) + ' of you';
}

/** The square shown as selected: the one asked for, or by default the best (refreshAreas); null when none. */
function chosen(s, cells, best) {
  const want = s.selected === undefined ? best[0] : s.selected;
  return want ? cells.find(c => c.row === want.row && c.col === want.col) || null : null;
}

/** AreaMapView.rank: 1 for the best square, 2, 3...; 0 when it has too few offers to rank. */
function rank(state, cell) {
  const best = ranked(state.cells);
  for (let i = 0; i < best.length; i++) if (best[i].row === cell.row && best[i].col === cell.col) return i + 1;
  return 0;
}

// ---- Layout ----
/** The heading and right-hand ornaments (compass, info control) have their own 58 dp. */
const mapWidth = width => Math.max(1, width - 58);
/** The left and right ramps: FADE_DP, never more than a quarter of a narrow map. */
const sideFade = width => Math.max(1, Math.min(FADE_DP, width / 4));
/** The top and bottom ramps: shorter, so a short map keeps most of its height clear. */
const topFade = height => Math.max(1, Math.min(FADE_DP, height * 0.12));

/**
 * AreaMapView.project: x = longitude x cos(mid latitude), y = latitude, north up, fitted to the land below the key.
 * Squares stay big enough to read: in a short strip the map centres on you (else the best square), or between you
 * and the best square's coin when both fit in the clear middle, and lets far squares fall outside.
 */
function project(width, height, cells, best, here) {
  width = mapWidth(width);
  const keyHeight = KEY_HEIGHT;
  height = Math.max(34, height - keyHeight);
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const c of cells) {
    minLat = Math.min(minLat, c.row * CELL);
    maxLat = Math.max(maxLat, (c.row + 1) * CELL);
    minLng = Math.min(minLng, c.col * CELL);
    maxLng = Math.max(maxLng, (c.col + 1) * CELL);
  }
  if (here) {
    minLat = Math.min(minLat, here[0]); maxLat = Math.max(maxLat, here[0]);
    minLng = Math.min(minLng, here[1]); maxLng = Math.max(maxLng, here[1]);
  }
  const margin = CELL * 0.6;
  minLat -= margin; maxLat += margin; minLng -= margin; maxLng += margin;
  const squash = Math.cos(U.rad((minLat + maxLat) / 2));
  const spanX = (maxLng - minLng) * squash, spanY = maxLat - minLat, pad = 16;
  let scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  // A lone square is not blown up to fill the map.
  scale = Math.min(scale, 70 / CELL);
  let left = minLng * squash - (width / scale - spanX) / 2;
  let top = maxLat + (height / scale - spanY) / 2;
  // A slightly smaller square in a very short map keeps both your dot and a nearby #1 coin visible.
  const readable = Math.min(34, Math.max(24, height - 22)) / CELL;
  if (scale < readable) {
    scale = readable;
    const focus = best.length ? best[0] : cells[0];
    let lat = here ? here[0] : latitude(focus), lng = here ? here[1] : longitude(focus);
    if (here && best.length) {
      // Where the best square's coin is drawn, in degrees: its square's top-right corner.
      const corner = Math.max(0, CELL * scale / 2 - 14) / scale;
      const coinLat = latitude(focus) + corner, coinLng = longitude(focus) + corner / squash;
      const roomX = (width / 2 - sideFade(width) - 14) / scale;
      const roomY = (height / 2 - (height <= 80 ? 10 : topFade(height) + 14)) / scale;
      if (Math.abs(coinLng - lng) * squash <= 2 * roomX && Math.abs(coinLat - lat) <= 2 * roomY) {
        lat = (lat + coinLat) / 2;
        lng = (lng + coinLng) / 2;
      }
    }
    left = lng * squash - width / scale / 2;
    top = lat + height / scale / 2;
  }
  top += keyHeight / scale;
  return {scale, left, top, squash, x: lng => (lng * squash - left) * scale, y: lat => (top - lat) * scale};
}

const cellBounds = (P, c) => ({l: P.x(c.col * CELL) + 2, t: P.y((c.row + 1) * CELL) + 2,
  r: P.x((c.col + 1) * CELL) - 2, b: P.y(c.row * CELL) - 2});
/** The coin's circle, in its square's top-right corner so the "You" dot stays clear. */
function medalBounds(P, c) {
  const radius = 11, corner = Math.max(0, CELL * P.scale / 2 - radius - 3);
  const cx = P.x(longitude(c)) + corner, cy = P.y(latitude(c)) - corner;
  return {l: cx - radius, t: cy - radius, r: cx + radius, b: cy + radius, cx, cy};
}
/** RectF.intersects. */
const intersects = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;

// ---- Text ----
/** Ui.fit: shrinks the size (down to minFraction of it) until value fits maxWidth, then ellipsizes. */
function fit(ctx, value, size, medium, maxWidth, minFraction) {
  ctx.font = U.font(size, medium);
  const width = ctx.measureText(value).width;
  if (width > maxWidth && width > 0) size = Math.max(size * minFraction, size * maxWidth / width);
  ctx.font = U.font(size, medium);
  let text = value;
  if (ctx.measureText(text).width > maxWidth) {
    text = '';
    for (let n = value.length - 1; n > 0; n--) {
      if (ctx.measureText(value.slice(0, n) + '\u2026').width <= maxWidth) { text = value.slice(0, n) + '\u2026'; break; }
    }
  }
  return {text, size};
}
/**
 * drawText with Paint.setFakeBoldText(true). Android's Skia emboldens each FreeType glyph outline by size / 34 in all
 * (FT_Outline_Embolden; SK_OUTLINE_EMBOLDEN_DIVISOR is 34 in framework builds), which is what stroking the glyphs that
 * wide around their fill does. Advances are unchanged, as on Android.
 */
function boldText(ctx, s, x, y, size) {
  ctx.fillText(s, x, y);
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineWidth = size / 34; ctx.lineJoin = 'miter'; ctx.strokeStyle = ctx.fillStyle;
  ctx.strokeText(s, x, y);
  ctx.restore();
}

// ---- Drawing ----
const brownOf = ui => ui.dark ? 0xFFC9B48C : 0xFF7A5C3A;
const trailOf = ui => ui.dark ? 0xFFE0876E : 0xFFB5523B;
/** Motion.loop: 0 to 1 over period seconds, then again. */
const loop = (t, period, phase) => { const v = t / period + phase; return v - Math.floor(v); };

function line(ctx, x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
function circle(ctx, cx, cy, r) { ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, r), 0, Math.PI * 2); }

/** Path.addRoundRect as Skia lays it out, clockwise from the left edge's lower end, so a dash starts where Android's does. */
function skiaRoundRect(ctx, l, t, r, b, rad) {
  rad = Math.max(0, Math.min(rad, (r - l) / 2, (b - t) / 2));
  ctx.beginPath();
  ctx.moveTo(l, b - rad);
  ctx.lineTo(l, t + rad); ctx.arc(l + rad, t + rad, rad, Math.PI, Math.PI * 1.5);
  ctx.lineTo(r - rad, t); ctx.arc(r - rad, t + rad, rad, Math.PI * 1.5, Math.PI * 2);
  ctx.lineTo(r, b - rad); ctx.arc(r - rad, b - rad, rad, 0, Math.PI / 2);
  ctx.lineTo(l + rad, b); ctx.arc(l + rad, b - rad, rad, Math.PI / 2, Math.PI);
  ctx.closePath();
}

/**
 * fadeEdges. The Java draws the land into a saveLayer and multiplies each edge strip by a clear-to-opaque ramp
 * (PorterDuff DST_IN), so the land dissolves into the ground. With no offscreen layer, the same picture comes from
 * painting the ground back over each strip with the ramp's complement (opaque ground at the edge, clear inward):
 * land L under mask m on a ground G composites to L.m + G.(1 - L.alpha.m), which is exactly what that over-painting
 * leaves, and successive strips compound multiplicatively as DST_IN's do (the corners, under two, fade the most).
 * Exact on a uniform ground; on a vertical gradient ([top, bottom]) the side strips use the colour at mid-height.
 */
function fadeEdges(ctx, ground, width, height) {
  const across = sideFade(width), down = topFade(height);
  const at = y => Array.isArray(ground) ? U.blend(ground[0], ground[1], U.clamp(y / height, 0, 1)) : ground;
  const strip = (l, t, r, b, x0, y0, x1, y1, c0, c1) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, U.css(U.withAlpha(c0, 255)));
    g.addColorStop(1, U.css(U.withAlpha(c1, 0)));
    ctx.fillStyle = g;
    ctx.fillRect(l, t, r - l, b - t);
  };
  strip(0, 0, width, down, 0, 0, 0, down, at(0), at(down));
  strip(0, height - down, width, height, 0, height, 0, height - down, at(height), at(height - down));
  strip(0, 0, across, height, 0, 0, across, 0, at(height / 2), at(height / 2));
  strip(width - across, 0, width, height, width, 0, width - across, 0, at(height / 2), at(height / 2));
}

/** A few faint field boundaries, so the ground still reads as land before any offer is mapped. */
function drawEmptyFields(ctx, brown, width, height) {
  ctx.strokeStyle = U.css(U.withAlpha(brown, 0x24));
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]); ctx.lineDashOffset = 0;
  const step = 56;
  for (let x = (width % step) / 2; x <= width; x += step) line(ctx, x, 0, x, height);
  for (let y = (height % step) / 2; y <= height; y += step) line(ctx, 0, y, width, y);
  ctx.setLineDash([]);
}

/** Faint lines along the square edges, so the squares read as a grid on the ground. */
function drawGrid(ctx, ui, brown, P, width, height) {
  ctx.strokeStyle = U.css(U.withAlpha(brown, ui.dark ? 0x1C : 0x26));
  ctx.lineWidth = 1;
  const step = CELL;
  if (step * P.scale < 10) return;
  for (let lng = Math.floor((P.left / P.squash) / step) * step; P.x(lng) <= width; lng += step) {
    line(ctx, P.x(lng), 0, P.x(lng), height);
  }
  for (let lat = Math.ceil(P.top / step) * step; P.y(lat) <= height; lat -= step) line(ctx, 0, P.y(lat), width, P.y(lat));
}

/** A dotted trail from where you are to the best area's coin; the dots walk slowly toward it. */
function drawTrail(ctx, ui, P, here, best, t) {
  const fromX = P.x(here[1]), fromY = P.y(here[0]);
  const corner = Math.max(0, CELL * P.scale / 2 - 14);
  const toX = P.x(longitude(best)) + corner, toY = P.y(latitude(best)) - corner;
  if (Math.hypot(toX - fromX, toY - fromY) < 24) return;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.quadraticCurveTo((fromX + toX) / 2 + (toY - fromY) * 0.25, (fromY + toY) / 2 - (toX - fromX) * 0.25, toX, toY);
  ctx.strokeStyle = U.css(trailOf(ui));
  ctx.lineWidth = 2.5;
  ctx.setLineDash([2, 6]);
  ctx.lineDashOffset = -8 * loop(t, 1.6, 0);
  ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
}

/** A coin with the area's place, in its square's top-right corner. */
function drawMedal(ctx, P, c, place) {
  const radius = 11, m = medalBounds(P, c);
  ctx.fillStyle = U.css(0x33000000); circle(ctx, m.cx, m.cy + 1.5, radius); ctx.fill();
  ctx.fillStyle = U.css(MEDALS[place]); circle(ctx, m.cx, m.cy, radius); ctx.fill();
  ctx.strokeStyle = U.css(0xFFFFFFFF); ctx.lineWidth = 1.5; circle(ctx, m.cx, m.cy, radius - 2); ctx.stroke();
  ctx.fillStyle = U.css(0xFF2B2A27); ctx.font = U.font(12); ctx.textAlign = 'center';
  boldText(ctx, String(place + 1), m.cx, m.cy + 12 / 3, 12);
}

/** measureLabel: fits the name and says where its pill would be. */
function measureLabel(ctx, label, cx, cy) {
  const f = fit(ctx, label, Math.min(10, 14), false, 120, 0.8);
  const halfWidth = ctx.measureText(f.text).width / 2 + 5, halfHeight = f.size * 0.75;
  return {text: f.text, size: f.size, l: cx - halfWidth, t: cy - halfHeight, r: cx + halfWidth, b: cy + halfHeight};
}

/** The square's neighbourhood on a soft pill under its coin; one that would overlap a name already shown is left out. */
function drawName(ctx, ui, P, c, names, pills) {
  const name = names[key(c)];
  if (!name) return;  // Places.name answers null for an unknown or nameless place
  const half = CELL * P.scale / 2;
  const cx = P.x(longitude(c)), cy = P.y(latitude(c)) + Math.min(half - 4, 14);
  const pill = measureLabel(ctx, name, cx, cy);
  for (const shown of pills) if (intersects(pill, shown)) return;
  pills.push(pill);
  const halfHeight = (pill.b - pill.t) / 2;
  ctx.fillStyle = U.css(ui.dark ? 0xCC14171C : 0xE6FFFFFF);
  U.rrect(ctx, pill.l, pill.t, pill.r, pill.b, halfHeight); ctx.fill();
  ctx.fillStyle = U.css(ui.dark ? 0xFFF3E6C8 : 0xFF3A2A18);
  ctx.font = U.font(pill.size); ctx.textAlign = 'center';
  boldText(ctx, pill.text, cx, cy + pill.size / 3, pill.size);
}

/** labelHasRoom: inside the land, clear of the coins, the names, the scale bar, and (first pass) every square. */
function labelHasRoom(box, avoidSquares, g) {
  if (box.l < 6 || box.r > mapWidth(g.width) - 6 || box.t < KEY_HEIGHT + 2 || box.b > g.height - 8) return false;
  for (let i = 0; i < Math.min(3, g.best.length); i++) {
    const m = medalBounds(g.P, g.best[i]);
    if (intersects(box, {l: m.l - 3, t: m.t - 3, r: m.r + 3, b: m.b + 3})) return false;
  }
  for (const pill of g.pills) if (intersects(box, pill)) return false;
  // The distance bar and its text.
  if (intersects(box, {l: 12, t: g.height - 38, r: 22 + mapWidth(g.width) / 3, b: g.height - 14})) return false;
  if (avoidSquares) for (const c of g.cells) if (intersects(box, cellBounds(g.P, c))) return false;
  return true;
}

/** placeHereLabel: clear land beside the dot first, then free space on a square; null when there is no honest spot. */
function placeHereLabel(ctx, cx, cy, g) {
  const m = U.metrics(10);
  ctx.font = U.font(10);
  const width = ctx.measureText('You').width, height = m.descent - m.ascent;
  for (let pass = 0; pass < 2; pass++) {
    for (let ring = 0; ring < 2; ring++) {
      const gap = 14 + ring * 12;
      for (let side = 0; side < 8; side++) {
        const left = side === 0 || side === 4 || side === 6 ? cx + gap
          : side === 1 || side === 5 || side === 7 ? cx - gap - width : cx - width / 2;
        const top = side === 2 || side === 4 || side === 5 ? cy + gap
          : side === 3 || side === 6 || side === 7 ? cy - gap - height : cy - height / 2;
        const box = {l: left, t: top, r: left + width, b: top + height};
        if (labelHasRoom(box, pass === 0, g)) return box;
      }
    }
  }
  return null;
}

/** The phone's position: a dot with a halo that breathes out and fades, and its "You" beside it. */
function drawHere(ctx, ui, brown, here, t, g) {
  const cx = g.P.x(here[1]), cy = g.P.y(here[0]);
  const pulse = loop(t, 2.8, 0);
  ctx.fillStyle = U.css(U.withAlpha(ui.accent, Math.round(0x4D * (1 - pulse))));
  circle(ctx, cx, cy, 9 + 10 * pulse); ctx.fill();
  ctx.fillStyle = U.css(0xFFFFFFFF); circle(ctx, cx, cy, 7.5); ctx.fill();
  ctx.fillStyle = U.css(ui.accent); circle(ctx, cx, cy, 5.5); ctx.fill();
  const label = placeHereLabel(ctx, cx, cy, g);
  if (!label) return;
  ctx.fillStyle = U.css(brown); ctx.font = U.font(10); ctx.textAlign = 'left';
  ctx.fillText('You', label.l, label.t - U.metrics(10).ascent);
}

/** A compass rose with north marked. */
function drawNorth(ctx, ui, brown, width) {
  const cx = width - 30, cy = 54, big = 15, small = 4;
  ctx.strokeStyle = U.css(U.withAlpha(brown, 0x80)); ctx.lineWidth = 1;
  circle(ctx, cx, cy, 10); ctx.stroke();
  for (let point = 0; point < 4; point++) {
    const angle = U.rad(point * 90 - 90), side = U.rad(point * 90 - 45);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(side) * small, cy + Math.sin(side) * small);
    ctx.lineTo(cx + Math.cos(angle) * big, cy + Math.sin(angle) * big);
    ctx.closePath();
    ctx.fillStyle = U.css(point === 0 ? trailOf(ui) : brown);
    ctx.fill();
  }
  ctx.fillStyle = U.css(brown); ctx.font = U.font(10); ctx.textAlign = 'center';
  boldText(ctx, 'N', cx, cy - big - 3, 10);
}

/** A bar of a round distance (1/4, 1/2, 1, 2, 5... mi) no wider than a third of the map. */
function drawScale(ctx, brown, P, width, height) {
  const pixelsPerMile = P.scale / MILES_PER_DEGREE;
  let miles = 0.25;
  for (const choice of [0.25, 0.5, 1, 2, 5, 10, 20, 50]) if (choice * pixelsPerMile <= mapWidth(width) / 3) miles = choice;
  const length = miles * pixelsPerMile, x0 = 18, y0 = height - 18;
  ctx.strokeStyle = U.css(brown); ctx.lineWidth = 2;
  line(ctx, x0, y0, x0 + length, y0);
  line(ctx, x0, y0 - 4, x0, y0 + 1);
  line(ctx, x0 + length, y0 - 4, x0 + length, y0 + 1);
  ctx.fillStyle = U.css(brown); ctx.font = U.font(10); ctx.textAlign = 'left';
  boldText(ctx, miles < 1 ? (miles === 0.25 ? '\u00BC' : '\u00BD') + ' mi' : fixed(miles, 0) + ' mi', x0, y0 - 7, 10);
}

/** One quiet heading, and the info control ("i" in a ring) that opens the atlas's key. */
function drawKey(ctx, brown, width) {
  ctx.fillStyle = U.css(brown); ctx.textAlign = 'left';
  const title = fit(ctx, TITLE, Math.min(11, 14), false, width - 60, 0.9);
  ctx.fillText(title.text, 12, 14);
  const cx = width - 25, cy = 13;
  ctx.strokeStyle = U.css(brown); ctx.lineWidth = 1;
  circle(ctx, cx, cy, 7); ctx.stroke();
  ctx.font = U.font(10); ctx.textAlign = 'center';
  boldText(ctx, 'i', cx, cy + 3.5, 10);
}

/** AreaMapView.onDraw, at (0, 0) in a width x height box. */
function draw(ctx, ui, state) {
  const s = state || {}, width = s.width, height = s.height, landWidth = mapWidth(width);
  const cells = s.cells || [], here = s.here || null, t = s.t || 0, names = s.names || {};
  const ground = s.ground == null ? ui.page : s.ground;
  const brown = brownOf(ui);
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.lineCap = 'round';  // the view's line paint is Cap.ROUND for every stroke, dashes included
  ctx.lineJoin = 'miter';
  ctx.setLineDash([]);
  // The land is clipped below the key and left of the ornaments' gutter, then faded at its edges.
  const clipLand = () => { ctx.beginPath(); ctx.rect(0, KEY_HEIGHT, landWidth, height - KEY_HEIGHT); ctx.clip(); };
  if (!cells.length) {
    ctx.save();
    clipLand();
    drawEmptyFields(ctx, brown, landWidth, height);
    fadeEdges(ctx, ground, landWidth, height);
    ctx.restore();
    ctx.fillStyle = U.css(brown); ctx.font = U.font(Math.min(14, 20)); ctx.textAlign = 'center';
    ctx.fillText(s.emptyMessage || EMPTY, width / 2, (height + KEY_HEIGHT) / 2);
    drawNorth(ctx, ui, brown, width);
    drawKey(ctx, brown, width);
    ctx.restore();
    return;
  }
  const best = ranked(cells), P = project(width, height, cells, best, here);
  const selected = chosen(s, cells, best);
  ctx.save();
  clipLand();
  drawGrid(ctx, ui, brown, P, landWidth, height);
  const most = best.length ? centsPerMile(best[0]) : 0, least = best.length ? centsPerMile(best[best.length - 1]) : 0;
  for (const c of cells) {
    const r = cellBounds(P, c), corner = Math.min(8, (r.r - r.l) / 4);
    if (isRanked(c)) {
      const share = most > least ? (centsPerMile(c) - least) / (most - least) : 1;
      ctx.fillStyle = U.css(U.withAlpha(GOLD, Math.round(0x40 + share * (0xE6 - 0x40))));
      U.rrect(ctx, r.l, r.t, r.r, r.b, corner); ctx.fill();
    } else {
      ctx.strokeStyle = U.css(brown); ctx.lineWidth = Math.max(1, 1.5);
      ctx.setLineDash([4, 3]); ctx.lineDashOffset = 0;
      skiaRoundRect(ctx, r.l, r.t, r.r, r.b, corner); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (selected && selected.row === c.row && selected.col === c.col) {
      ctx.strokeStyle = U.css(ui.dark ? 0xFFF3E6C8 : 0xFF4A3622); ctx.lineWidth = 2.5;
      U.rrect(ctx, r.l, r.t, r.r, r.b, corner); ctx.stroke();
    }
  }
  if (here && best.length) drawTrail(ctx, ui, P, here, best[0], t);
  for (let i = Math.min(3, best.length) - 1; i >= 0; i--) drawMedal(ctx, P, best[i], i);
  const pills = [];
  for (let i = 0; i < Math.min(3, best.length); i++) drawName(ctx, ui, P, best[i], names, pills);
  if (here) drawHere(ctx, ui, brown, here, t, {P, width, height, best, pills, cells});
  fadeEdges(ctx, ground, landWidth, height);
  ctx.restore();
  drawNorth(ctx, ui, brown, width);
  drawScale(ctx, brown, P, width, height);
  drawKey(ctx, brown, width);
  ctx.restore();
}

/** AreaMapView.areaBounds: a square's drawn rectangle {left, top, right, bottom} in the view [dp] (e.g. to aim a tap). */
function areaBounds(state, cell) {
  const cells = state.cells || [], P = project(state.width, state.height, cells, ranked(cells), state.here || null);
  const r = cellBounds(P, cell);
  return {left: r.l, top: r.t, right: r.r, bottom: r.b};
}
/** AreaMapView.rankBounds: where a square's coin is drawn. */
function rankBounds(state, cell) {
  const cells = state.cells || [], P = project(state.width, state.height, cells, ranked(cells), state.here || null);
  const m = medalBounds(P, cell);
  return {left: m.l, top: m.t, right: m.r, bottom: m.b};
}

/**
 * The line under the map (MainActivity.showArea, as refreshAreas shows it): the chosen square's place name (else how
 * far and which way it is), then its pay per mile and sample count, and a chevron for "open in Maps". By default the
 * chosen square is the best one. null when the line is hidden (no square chosen, so no ranked square either).
 */
function areaLine(state) {
  const cells = state.cells || [], cell = chosen(state, cells, ranked(cells));
  if (!cell) return null;
  const where = from(state.here || null, cell);
  const name = (state.names || {})[key(cell)];
  const samples = cell.mileOffers + (cell.mileOffers === 1 ? ' offer' : ' offers');
  const rate = isRanked(cell) ? perMile(cell) + ' \u00B7 ' + samples : 'Unranked \u00B7 ' + samples + ' with miles';
  // Its rank is on its coin; "of you" and Maps go without saying on the page.
  const parts = [];
  if (name) parts.push(name);
  else if (where) parts.push(where.split(' of you').join(''));
  parts.push(rate);
  return parts.join(' \u00B7 ') + '  \u203A';
}

/** Page layout around the view (MainActivity.addAreas). */
const layout = {
  leastDp: 96, leastDpCompact: 84,  // the map's least height (setLeastDp(84) in a short window)
  topMargin: 2,                     // mapParams.topMargin
  // The area line: a TextView, 13 sp Roboto Medium in ui.ink, centred, line spacing 1.0, at least 36 dp tall
  // (32 in a short window), full width, directly under the map; hidden when areaLine() is null.
  line: {size: 13, medium: true, minHeight: 36, minHeightCompact: 32}
};

/**
 * Draws the area line as its TextView would, in a width-wide box at (0, 0); returns the box's height [dp] (0 hidden).
 * Words wrap greedily (the text is one line in practice); includeFontPadding as Android's default.
 */
function drawAreaLine(ctx, ui, state, width, compact) {
  const text = areaLine(state);
  if (text == null) return 0;
  const L = layout.line, m = U.metrics(L.size);
  ctx.save();
  ctx.font = U.font(L.size, L.medium);
  const lines = [];
  let current = '';
  for (const word of text.split(' ')) {
    const next = current ? current + ' ' + word : word;
    if (current && ctx.measureText(next).width > width) { lines.push(current); current = word; } else current = next;
  }
  lines.push(current);
  const step = m.descent - m.ascent, block = -m.top + (lines.length - 1) * step + m.bottom;
  const height = Math.max(compact ? L.minHeightCompact : L.minHeight, block);
  ctx.fillStyle = U.css(ui.ink); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((s, i) => ctx.fillText(s, width / 2, (height - block) / 2 - m.top + i * step));
  ctx.restore();
  return height;
}

/**
 * The scene's ground behind the map, as `ground` wants it: ScenePage paints the ground as a vertical gradient from the
 * horizon to the page's bottom (dark 0xFF121821 to 0xFF141413, light 0xFFE3E7D6 to 0xFFE8E6DE). mapTop and
 * mapHeight place the view in the page, horizon and pageHeight the gradient [dp, page coordinates].
 */
function sceneGround(ui, mapTop, mapHeight, horizon, pageHeight) {
  const from = ui.dark ? 0xFF121821 : 0xFFE3E7D6, to = ui.dark ? 0xFF141413 : 0xFFE8E6DE;
  const at = y => U.blend(from, to, U.clamp((y - horizon) / Math.max(1, pageHeight - horizon), 0, 1));
  return [at(mapTop), at(mapTop + mapHeight)];
}

/**
 * An invented area, out in the open sea (around 33.93 N, 135.0 W, so no real place): 14 squares around the phone,
 * three clearly best and named with generic neighbourhood names, eleven others ranked from $1.12 to $1.86/mi, two
 * with too few offers to rank, and a few at the edges where the land fades. Pay and miles are plausible DoorDash-like
 * sums (about $6-$14 an offer over 3-7 mi).
 */
const demo = {
  width: 380, height: 200,
  cells: [
    {row: 1696, col: -6751, offers: 8, mileOffers: 7, milePayCents: 4766, miles: 32.2},    // yours, $1.48/mi
    {row: 1696, col: -6749, offers: 12, mileOffers: 11, milePayCents: 9649, miles: 37.4},  // #1 Riverside, $2.58/mi
    {row: 1697, col: -6752, offers: 9, mileOffers: 8, milePayCents: 7207, miles: 31.2},    // #2 Old Town, $2.31/mi
    {row: 1695, col: -6747, offers: 6, mileOffers: 6, milePayCents: 5342, miles: 25.2},    // #3 Midtown, $2.12/mi
    {row: 1696, col: -6750, offers: 6, mileOffers: 5, milePayCents: 4092, miles: 22},      // $1.86/mi
    {row: 1697, col: -6750, offers: 10, mileOffers: 9, milePayCents: 7436, miles: 45.9},   // $1.62/mi
    {row: 1697, col: -6751, offers: 5, mileOffers: 4, milePayCents: 2970, miles: 22},      // $1.35/mi
    {row: 1695, col: -6751, offers: 7, mileOffers: 6, milePayCents: 4501, miles: 37.2},    // $1.21/mi
    {row: 1695, col: -6750, offers: 3, mileOffers: 3, milePayCents: 2506, miles: 14.4},    // $1.74/mi
    {row: 1696, col: -6753, offers: 6, mileOffers: 5, milePayCents: 3976, miles: 35.5},    // $1.12/mi
    {row: 1696, col: -6755, offers: 4, mileOffers: 3, milePayCents: 2400, miles: 18.9},    // $1.27/mi, at the left edge
    {row: 1697, col: -6745, offers: 4, mileOffers: 4, milePayCents: 3100, miles: 20},      // $1.55/mi, at the right edge
    {row: 1698, col: -6749, offers: 2, mileOffers: 2, milePayCents: 1640, miles: 7.6},     // unranked
    {row: 1694, col: -6750, offers: 2, mileOffers: 1, milePayCents: 850, miles: 5.3}       // unranked, at the bottom
  ],
  here: [33.927, -135.009],
  names: {'1696,-6749': 'Riverside', '1697,-6752': 'Old Town', '1695,-6747': 'Midtown'},
  t: 0
};

App.areaMap = {draw, areaLine, drawAreaLine, demo, layout, sceneGround, ranked, rank, areaBounds, rankBounds,
  perMile, from, CELL_DEGREES: CELL, MIN_OFFERS};
})(typeof window !== 'undefined' ? window : globalThis);
