/*
 * Offer Filter's characters and props in 3D, built once per renderer from OfferGL's geometry: the glazed funnel
 * mascot with its sieve, face, arms and brush ring; offer tickets; the delivery car; the phone; sparkles; the Android
 * head; trees and buildings. Proportions follow the 2D art they replace: the mascot is modelled in its design's dp
 * divided by 62 (the rim's half width), so its rim has radius 1.
 *   const art = OfferModels.build(r); art.mascot(model, pose); art.ticket(model, face); art.car(model, pose) ...
 */
(function(root) {
'use strict';
const {M, G, rgb, mix} = root.OfferGL;
const TAU = Math.PI * 2;
const C = {accent: '#256ABF', blue: '#4385EB', surface: '#FCFCFB', ink: '#0B0B0B', cheek: '#F28B8B', gold: '#F5C66F',
  cream: '#FFF7DF', sky: '#AFD0FF', pink: '#F29791', mint: '#B9E4BE', navy: '#2C415D', green: '#315B54'};
const tint = (k) => mix(C.surface, C.accent, k);

/* ---- The mascot (FilterHeroView's glazed funnel), rim radius 1 ---- */
const RIM_Y = 32 / 62, NECK_Y = -42 / 62, NECK = 11 / 62, SPOUT_Y = -60 / 62;
/** The funnel's radius at height y, between the rim and the neck. */
const coneR = y => NECK + (1 - NECK) * (y - NECK_Y) / (RIM_Y - NECK_Y);
const SLOPE = (1 - NECK) / (RIM_Y - NECK_Y);
/**
 * Where a point of the 2D face (picture position x, y, in rim units) lands on the funnel's front, seen from the
 * mascot's design view (12 degrees above its rim): the glaze point that view's ray meets, lifted `lift` off the glaze
 * along its normal, and that normal. The face then reads as drawn from that view, round eyes and all.
 */
const VIEW = 12 * Math.PI / 180;
function onCone(x, y, lift) {
  const ce = Math.cos(VIEW), se = Math.sin(VIEW), at = t => [x, y * ce + t * se, -y * se + t * ce];
  // From well in front, step back along the ray until it enters the funnel, then bisect to the glaze.
  let hi = 3, lo = 3;
  for (let t = 3; t > -1; t -= .02) { const p = at(t); if (Math.hypot(p[0], p[2]) <= coneR(p[1])) { lo = t; break; } hi = t; }
  for (let k = 0; k < 24; k++) { const m = (hi + lo) / 2, p = at(m); if (Math.hypot(p[0], p[2]) <= coneR(p[1])) lo = m; else hi = m; }
  const p = at(lo), th = Math.atan2(p[0], p[2]);
  const n = (() => { const v = [Math.sin(th), -SLOPE, Math.cos(th)], l = Math.hypot(...v); return v.map(c => c / l); })();
  return {p: [p[0] + n[0] * (lift || 0), p[1] + n[1] * (lift || 0), p[2] + n[2] * (lift || 0)], n};
}
/** A model matrix that stands a feature on the glaze at (x, y): its z axis along the glaze's normal. */
function facing(at, scale) {
  const n = at.n, yaw = Math.atan2(n[0], n[2]), pitch = -Math.asin(n[1]);
  return M.trs(at.p, [yaw, pitch, 0], scale);
}

function mascotParts() {
  const body = new G.Geo(), glaze = tint(.2), lip = tint(.27), collar = tint(.45);
  // The outside: the lip rolling over at the rim, the cone down to the neck, the collar, the spout's rounded end.
  const out = [[.9, RIM_Y - .01], [.95, RIM_Y + .035], [1.0, RIM_Y + .045], [1.045, RIM_Y + .02], [1.035, RIM_Y - .02],
    [NECK + .005, NECK_Y + .015]];
  body.add(G.lathe(out, 72, (t, a, k) => k < 4 ? lip : glaze));
  body.add(G.lathe([[NECK + .035, NECK_Y + .015], [NECK + .05, NECK_Y], [NECK + .05, NECK_Y - .075], [NECK + .035, NECK_Y - .09]], 48, collar));
  body.add(G.lathe([[NECK, NECK_Y - .1], [NECK, SPOUT_Y + .05], [NECK - .02, SPOUT_Y + .005], [NECK - .06, SPOUT_Y], [0, SPOUT_Y]], 48, glaze));
  // The sieve across the mouth, a little below the lip, and its holes.
  const sieve = new G.Geo();
  sieve.add(G.lathe([[0, RIM_Y - .03], [.92, RIM_Y - .03], [.93, RIM_Y - .01]], 72, tint(.3)));
  const hole = G.lathe([[0, 0], [.04, 0], [.045, -.004]], 12, mix(tint(.3), C.accent, .63));
  for (let row = -3; row <= 3; row++) for (let col = -4; col <= 4; col++) {
    const x = col * .2 + (row % 2 ? .1 : 0), z = row * .2;
    if (Math.hypot(x, z) < .78) sieve.add(hole, M.trs([x, RIM_Y - .028, z]));
  }
  // The face, in the 2D face's measures (size 40 dp at (0, 6)): eyes, their glints, cheeks and the smile.
  const u = 40 / 28 / 62, fy = -6 / 62, face = new G.Geo(), shine = new G.Geo(), cheeks = new G.Geo();
  for (const side of [-1, 1]) {
    const eye = onCone(side * 6.5 * u, fy + 3 * u, 0);
    face.add(G.sphere(2.6 * u, 16, C.ink), facing(eye, [1, 1, .7]));
    const big = onCone(side * 6.5 * u - .9 * u, fy + 4 * u, 1.75 * u), small = onCone(side * 6.5 * u + 1.05 * u, fy + 1.9 * u, 1.75 * u);
    shine.add(G.sphere(.9 * u, 8, '#ffffff'), facing(big, [1, 1, .4]));
    shine.add(G.sphere(.45 * u, 6, '#ffffff'), facing(small, [1, 1, .4]));
    cheeks.add(G.sphere(3.8 * u, 16, mix(glaze, C.cheek, .7)), facing(onCone(side * 11 * u, fy - 3 * u, 0), [1, .78, .3]));
  }
  const smile = [];
  for (let k = 0; k <= 16; k++) {
    const a = (20 + 140 * k / 16) * Math.PI / 180;
    smile.push(onCone(4.5 * u * Math.cos(a), fy - 2.5 * u - 3.5 * u * Math.sin(a), .006).p);
  }
  face.add(G.tube(smile, .9 * u, 8, C.ink, true));
  // The cheer: eyes shut in happy arcs and an open mouth (built apart, swapped in by mood).
  const cheer = new G.Geo();
  for (const side of [-1, 1]) {
    const arc = [];
    for (let k = 0; k <= 10; k++) {
      const a = (200 + 140 * k / 10) * Math.PI / 180;
      arc.push(onCone(side * 6.5 * u + 3 * u * Math.cos(a), fy + 3 * u - u - 2.5 * u * Math.sin(a), .006).p);
    }
    cheer.add(G.tube(arc, .9 * u, 8, C.ink, true));
  }
  const mouth = [];
  for (let k = 0; k <= 12; k++) { const a = Math.PI * k / 12; mouth.push([4.5 * u * Math.cos(a), -3.5 * u * Math.sin(a)]); }
  const lips = G.extrude(mouth.map(([x, y]) => [x, y]), .01, C.ink, C.ink);
  cheer.add(lips, facing(onCone(0, fy - 3 * u, .004), 1));
  // A blink: eyes closed in a line.
  const blink = new G.Geo();
  for (const side of [-1, 1]) {
    const line = [];
    for (let k = 0; k <= 6; k++) line.push(onCone(side * 6.5 * u - 2.4 * u + 4.8 * u * k / 6, fy + 3 * u, .006).p);
    blink.add(G.tube(line, .9 * u, 8, C.ink, true));
  }
  // Arms from the shoulder (at the origin) outward to +x (dir 1) or -x (dir -1): a curved tube reaching a little
  // forward, and a round mitt with a glint.
  const armOf = dir => {
    const g = new G.Geo(), path = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12, x = 2 * (1 - t) * t * 13 + t * t * 16, y = 2 * (1 - t) * t * 5 + t * t * 18;
      path.push([dir * x / 62, -y / 62, Math.sin(t * Math.PI * .5) * .1]);
    }
    g.add(G.tube(path, 1.6 / 62, 8, C.accent, false));
    g.add(G.sphere(4.2 / 62, 12, C.accent), M.trs([dir * 16.5 / 62, -21.5 / 62, .1]));
    g.add(G.sphere(1.3 / 62, 6, mix(C.accent, '#ffffff', .55)), M.trs([dir * 16.5 / 62 - 1.3 / 62, -20.2 / 62, .1 + 3.6 / 62]));
    return g;
  };
  const arm = armOf(1), armL = armOf(-1);
  // The ensō: a brush ring of radius 97 dp, swelling and tapering along its sweep, built start to end so a partial
  // draw paints it on.
  const ensoPts = [], sweep = TAU * .9, start = -Math.PI * .62;
  for (let k = 0; k <= 160; k++) {
    const p = k / 160, a = -(start + sweep * p), R = (97 + Math.sin(p * 9) * .64) / 62;
    ensoPts.push([Math.cos(a) * R, Math.sin(a) * R, 0]);
  }
  const enso = G.tube(ensoPts, t => 4 / 62 * (.35 + .65 * Math.sin(Math.PI * Math.min(1, t * 1.15 + .05))), 10, C.blue, true);
  return {body, sieve, face, shine, cheeks, cheer, blink, arm, armL, enso};
}

/* ---- Sparkle: the four-pointed star, as a plump, rounded token ---- */
function sparkleGeo(colour) {
  const pts = [], w = .22;
  // The 2D path's four quadratic curves, sampled.
  const q = (p0, c, p1) => { for (let k = 0; k < 8; k++) { const t = k / 8; pts.push([(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]]); } };
  q([0, 1], [w, w], [1, 0]); q([1, 0], [w, -w], [0, -1]); q([0, -1], [-w, -w], [-1, 0]); q([-1, 0], [-w, w], [0, 1]);
  const g = new G.Geo();
  // Two layers: a full star and a smaller, raised one, for a beveled look.
  g.add(G.extrude(pts.slice().reverse().map(([x, y]) => [x, y]), .16, colour, mix(colour, '#000000', .12)));
  g.add(G.extrude(pts.slice().reverse().map(([x, y]) => [x * .62, y * .62]), .26, mix(colour, '#ffffff', .25), colour));
  return g;
}

/* ---- The Android head beside "Free": a dome, two antennae and two eyes ---- */
function androidGeo(colour) {
  const g = new G.Geo();
  const dome = [];
  for (let k = 0; k <= 10; k++) { const a = Math.PI / 2 * k / 10; dome.push([Math.sin(a), Math.cos(a)]); }
  g.add(G.lathe(dome.concat([[1, -.02], [.96, -.08], [0, -.08]]), 28, colour));
  for (const s of [-1, 1]) {
    g.add(G.tube([[s * .42, .8, 0], [s * .62, 1.12, 0]], .07, 6, colour, true));
    g.add(G.sphere(.11, 8, '#FFF7DF'), M.trs([s * .4, .5, .82], null, [1, 1, .5]));
  }
  return g;
}

/* ---- The film's offer ticket (314 x 178 px at its design size, here 3.14 x 1.78): a paper card with a stub ---- */
const TICKET_W = 3.14, TICKET_H = 1.78;
function ticketGeo() {
  const shape = G.roundRect(TICKET_W, TICKET_H, .19, 5);
  return G.extrude(shape, .05, '#ffffff', mix(C.cream, '#B4BCB3', .5), [-TICKET_W / 2, -TICKET_H / 2, TICKET_W / 2, TICKET_H / 2]);
}
/** The faces of tickets ({pay, info, kind}) drawn once into one texture, a column of them, its sides powers of two so
 *  it can be mipmapped (a falling ticket's words stay smooth as it shrinks and turns). rowV: one face's share of v. */
function ticketAtlas(list) {
  const W = 512, H = Math.round(W * TICKET_H / TICKET_W), cv = document.createElement('canvas'), k2 = W / 314;
  cv.width = W; cv.height = Math.pow(2, Math.ceil(Math.log2(H * list.length)));
  const c = cv.getContext('2d');
  c.fillStyle = C.cream; c.fillRect(0, 0, cv.width, cv.height);
  list.forEach((o, k) => {
    // Each face kept to its own row, so no stub bleeds into the next.
    c.save(); c.beginPath(); c.rect(0, H * k, W, H); c.clip();
    c.translate(W / 2, H * k + H / 2); c.scale(k2, k2);
    const col = o.kind === 'decline' ? C.pink : o.kind === 'pass' ? C.mint : C.sky;
    c.fillStyle = col; c.fillRect(-170, -100, 70, 200);
    c.fillStyle = C.cream; c.fillRect(-113, -92, 22, 184);
    c.setLineDash([4, 6]); c.strokeStyle = '#B4BCB3'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-100, -74); c.lineTo(-100, 74); c.stroke(); c.setLineDash([]);
    c.save(); c.translate(-128, 0); c.rotate(-Math.PI / 2); c.fillStyle = '#162844'; c.font = '400 17px "Atkinson Hyperlegible", sans-serif'; c.textAlign = 'center'; c.fillText('OFFER', 0, 7); c.restore();
    c.fillStyle = '#162844'; c.font = '700 58px "Baloo 2", sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText(o.pay, -79, 6, 216);
    c.fillStyle = '#49616C'; c.font = '400 22px "Atkinson Hyperlegible", sans-serif'; c.fillText(o.info, -78, 45, 214);
    c.fillStyle = C.navy; for (const y of [-89, 89]) { c.beginPath(); c.arc(-100, y, 6, 0, TAU); c.fill(); }
    c.restore();
  });
  return {canvas: cv, count: list.length, rowV: H / cv.height};
}

/* ---- The delivery car (the 2D car's 92 x 58 dp, here /50): body, cabin, eyes, wheels, a parcel on the roof ---- */
function carParts() {
  const s = 1 / 50, body = new G.Geo(), wheel = new G.Geo(), glow = new G.Geo();
  body.add(G.box(92 * s, 30 * s, 52 * s, 13 * s, '#8FB3E6', 5), M.trs([0, 23 * s, 0]));
  body.add(G.box(58 * s, 20 * s, 44 * s, 8 * s, '#A9C8F2', 4), M.trs([-4 * s, 38 * s, 0]));
  body.add(G.box(28 * s, 17 * s, 26 * s, 3 * s, '#C79A5A', 3), M.trs([0, 55 * s, 0]));
  body.add(G.box(29 * s, 3 * s, 6 * s, 1 * s, '#E2C189', 2), M.trs([0, 64 * s, 0]));
  for (const z of [1, -1]) for (const x of [-6, 8]) {
    body.add(G.sphere(4 * s, 10, '#E8F1FB'), M.trs([x * s, 37 * s, z * 22.5 * s], null, [1, 1, .35]));
    body.add(G.sphere(1.9 * s, 8, '#3B3A36'), M.trs([x * s + .4 * s, 37 * s, z * 23.8 * s], null, [1, 1, .35]));
  }
  glow.add(G.sphere(4 * s, 10, rgb('#FFE3A0', 1)), M.trs([45 * s, 22 * s, 14 * s], null, [.5, 1, 1]));
  glow.add(G.sphere(4 * s, 10, rgb('#FFE3A0', 1)), M.trs([45 * s, 22 * s, -14 * s], null, [.5, 1, 1]));
  glow.add(G.sphere(3 * s, 8, rgb('#F2847C', 1)), M.trs([-45.5 * s, 24 * s, 16 * s], null, [.5, 1, 1]));
  glow.add(G.sphere(3 * s, 8, rgb('#F2847C', 1)), M.trs([-45.5 * s, 24 * s, -16 * s], null, [.5, 1, 1]));
  // A wheel at the origin, its axle along z: a tyre with a hub.
  const tyre = [[0, 6 * s], [8 * s, 6 * s], [10 * s, 4.5 * s], [10 * s, -4.5 * s], [8 * s, -6 * s], [0, -6 * s]];
  wheel.add(G.lathe(tyre.map(([r, y]) => [r, y]), 24, '#3B3A36'), M.trs(null, [0, Math.PI / 2, 0]));
  wheel.add(G.lathe([[0, 6.4 * s], [4 * s, 6.4 * s], [4.2 * s, 6 * s]], 16, '#9C9A93'), M.trs(null, [0, Math.PI / 2, 0]));
  wheel.add(G.lathe([[0, 6.4 * s], [4 * s, 6.4 * s], [4.2 * s, 6 * s]], 16, '#9C9A93'), M.trs(null, [0, -Math.PI / 2, 0]));
  return {body, wheel, glow, s};
}

/* ---- The phone the film holds the app in: 434 x 937 dp, 54 dp corners, 30 dp thick, here /100. Its front face is
 * at z = D / 2; the film draws the 412 x 915 dp screen (44 dp corners) over it, so only the bezel round it is built. ---- */
function phoneParts() {
  const s = 1 / 100, W = 434 * s, H = 937 * s, R = 54 * s, D = 30 * s, lip = 2 * s;
  const g = new G.Geo(), edge = G.roundRect(W, H, R, 12), screen = G.roundRect(412 * s, 915 * s, 44 * s, 12), n = edge.length;
  for (let k = 0; k < n; k++) {
    const p = edge[k], q = edge[(k + 1) % n], o = [q[1] - p[1], -(q[0] - p[0])], l = Math.hypot(o[0], o[1]) || 1, side = [o[0] / l, o[1] / l, 0];
    // A metal band round the sides,
    const a = g.vert([p[0], p[1], D / 2], side, '#3a404b'), b = g.vert([q[0], q[1], D / 2], side, '#3a404b');
    const c = g.vert([q[0], q[1], -D / 2], side, '#3a404b'), d = g.vert([p[0], p[1], -D / 2], side, '#3a404b');
    g.quad(a, d, c, b);
    // and the black glass of the bezel, from the edge in to the screen.
    const i = screen[k], j = screen[(k + 1) % n], f = [0, 0, 1];
    g.quad(g.vert([p[0], p[1], D / 2], f, '#121418'), g.vert([q[0], q[1], D / 2], f, '#121418'), g.vert([j[0], j[1], D / 2], f, '#121418'), g.vert([i[0], i[1], D / 2], f, '#121418'));
  }
  // A rounded metal lip round the face's edge, catching the light as the 2D rim's gradient did.
  const rim = G.roundRect(W - 2 * lip, H - 2 * lip, R - lip, 12).map(([x, y]) => [x, y, D / 2 - lip]);
  rim.push(rim[0]);
  g.add(G.tube(rim, lip * 1.05, 8, '#5d6574', false));
  for (const [y, h] of [[170, 64], [252, 96]]) g.add(G.box(5 * s, h * s, 12 * s, 2 * s, '#2a2e36', 2), M.trs([W / 2 + 1 * s, H / 2 - (y + h / 2) * s, 0]));
  return {g, s, W, H, D};
}

/* ---- Scenery pieces, each in parts so a scene can tint every part by day or night ---- */
/** A lollipop tree about 2 tall: {leaf, trunk}. */
function treeParts() {
  const trunk = G.lathe([[.05, 1.1], [.07, 0]], 8, '#ffffff');
  const leaf = new G.Geo().add(G.sphere(.34, 12, '#ffffff', 1.9), M.trs([0, 1.35, 0], [0, 0, -.12]));
  return {leaf, trunk};
}
/** A building w x h x d standing on y = 0: {walls (and roof), lit, dark}. o: {gable, seed (which windows are lit),
 *  cols, rows (windows on its front), win ([width, height] of a window as a share of its cell), round (its edges'
 *  radius as a share of its width)}. */
function buildingParts(w, h, d, o) {
  o = o || {};
  const walls = new G.Geo(), lit = new G.Geo(), dark = new G.Geo(), round = o.round, win = o.win || [.38, .45];
  walls.add(G.box(w, h, d, round ? w * round : Math.min(.02, w / 10), '#ffffff', round ? 3 : 1), M.trs([0, h / 2, 0]));
  if (o.gable) walls.add(G.extrude([[-w / 2 - w * .06, 0], [w / 2 + w * .06, 0], [0, w * .42]], d * 1.06, '#ffffff', '#ffffff'), M.trs([0, h, 0]));
  const cols = o.cols || Math.max(1, Math.round(w / .26)), rows = o.rows || Math.max(1, Math.floor((h - .3) / .36)), seed = o.seed || 0;
  const cw = w / cols, rh = Math.min(h * .9 / rows, cw * 1.6), ww = cw * win[0], wh = rh * win[1];
  let k = seed >>> 0;
  for (let row = 0; row < rows; row++) for (let c = 0; c < cols; c++) {
    k = (Math.imul(k, 1103515245) + 12345) >>> 0;
    const x = -w / 2 + cw * (c + .5), y = h - rh * (row + .7);
    if (y < wh) continue;
    (((k >> 16) % 9) < 4 ? lit : dark).add(G.plane(ww, wh, '#ffffff'), M.trs([x, y, d / 2 + d * .01]));
  }
  return {walls, lit, dark};
}
/**
 * Draw functions for renderer r; each model is built on its first draw, so a scene pays only for what it shows. Poses:
 *   mascot(model, {mood: 'happy'|'cheer'|'blink', wave (degrees), breathe (-1..1), ring (0-1 drawn), ringTilt})
 *   ticket(model, index, {alpha, and any of r.draw's options}) after setTickets([{pay, info, kind}, ...])
 *   car(model, {wheel (radians), lights (0-1)}), phoneBody(model, alpha), sparkle(model, colour), android(model)
 */
function build(r) {
  const mesh = g => r.mesh(g), once = make => { let v = null; return () => v || (v = make()); };
  const mascotM = once(() => { const P = mascotParts(), m = {}; for (const k in P) m[k] = mesh(P[k]); return m; });
  const car = carParts(), carM = once(() => ({body: mesh(car.body), wheel: mesh(car.wheel), glow: mesh(car.glow)}));
  const phone = {s: 1 / 100, W: 4.34, H: 9.37, D: .3}, phoneM = once(() => mesh(phoneParts().g));
  const sparkles = {}, android = {};
  let tickets = null;
  const glaze = {spec: .55, shine: 46, rim: .42, outline: .03, outlineColor: C.accent};
  const art = {
    C, TICKET_W, TICKET_H,
    mascot(model, o) {
      o = o || {};
      const m = mascotM();
      const b = 1 + .012 * (o.breathe || 0), at = M.mul(model, M.trs([0, -.82, 0], null, [b, b, b]));
      const body = M.mul(at, M.trs([0, .82, 0]));
      if (o.ring == null || o.ring > 0) {
        const ring = M.mul(model, M.trs([0, -8 / 62, -.05], [0, o.ringTilt || 0, 0]));
        r.draw(m.enso, ring, {spec: .3, shine: 30, rim: .3, count: o.ring == null ? null : Math.round(m.enso.count * Math.min(1, o.ring))});
      }
      r.draw(m.body, body, glaze);
      r.draw(m.sieve, body, {spec: .2, rim: .2});
      const mood = o.mood || 'happy';
      r.draw(mood === 'cheer' ? m.cheer : mood === 'blink' ? m.blink : m.face, body, {spec: .5, shine: 60, rim: .1});
      if (mood === 'happy') r.draw(m.shine, body, {unlit: true});
      r.draw(m.cheeks, body, {spec: .1, rim: .1});
      // Arms at the shoulders (on the glaze at y = 0, a little forward), the right one waving.
      const sh = coneR(0), z = .14, x = Math.sqrt(sh * sh - z * z);
      r.draw(m.arm, M.mul(body, M.trs([x, 0, z], [0, 0, (o.wave || 0) * Math.PI / 180])), {spec: .4, rim: .2});
      r.draw(m.armL, M.mul(body, M.trs([-x, 0, z])), {spec: .4, rim: .2});
    },
    /** The ground shadow under the mascot standing at model (its rim radius 1). */
    mascotShadow(model, alpha) { r.shadow(M.mul(model, M.trs([0, -73 / 62, 0], null, [.8, 1, .25])), {alpha: alpha == null ? .14 : alpha}); },
    setTickets(list) { const a = ticketAtlas(list); tickets = {tex: r.texture(a.canvas, true, true), rowV: a.rowV, meshes: []}; },
    ticket(model, index, o) {
      if (!tickets) return;
      // One mesh per face: the extrusion's uvs scaled into its row of the atlas.
      if (!tickets.meshes[index]) {
        const g = ticketGeo();
        // The front shows its row of the atlas; the back and the edges, plain paper (a cream corner of the row).
        const v = g.v;
        for (let k = 0; k < v.length; k += 12) {
          if (v[k + 5] <= .5) { v[k + 10] = .985; v[k + 11] = .015; }
          v[k + 11] = (index + v[k + 11]) * tickets.rowV;
        }
        tickets.meshes[index] = r.mesh(g);
      }
      r.draw(tickets.meshes[index], model, Object.assign({tex: tickets.tex, spec: .12, shine: 20, rim: .25, outlineColor: '#B4BCB3'}, o));
    },
    /** The car: o.wheel turns its wheels (radians), o.lights (0-1) lights its lamps, o.alpha fades it. */
    car(model, o) {
      o = o || {};
      const alpha = o.alpha == null ? 1 : o.alpha, m = carM();
      if (alpha <= 0) return;
      r.draw(m.body, model, {spec: .35, shine: 30, rim: .35, outline: alpha < 1 ? 0 : .012, outlineColor: '#4d6d9c', alpha});
      r.draw(m.glow, model, {glow: .35 + .65 * (o.lights == null ? 1 : o.lights), spec: .2, alpha});
      for (const x of [-27, 27]) for (const z of [1, -1]) {
        r.draw(m.wheel, M.mul(model, M.trs([x * car.s, 10 * car.s, z * 22 * car.s], [0, 0, -(o.wheel || 0)])), {spec: .15, rim: .15, alpha});
      }
    },
    carSize: car.s,
    phoneBody(model, alpha) { r.draw(phoneM(), model, {spec: .5, shine: 50, rim: .5, alpha}); },
    phoneSize: phone,
    sparkle(model, colour, alpha) {
      if (!sparkles[colour]) sparkles[colour] = mesh(sparkleGeo(colour));
      r.draw(sparkles[colour], model, {spec: .6, shine: 40, rim: .4, alpha});
    },
    android(model, colour, alpha) {
      if (!android[colour]) android[colour] = mesh(androidGeo(colour));
      r.draw(android[colour], model, {spec: .3, rim: .3, alpha});
    },
    /** Builds a model's meshes ahead of its first draw: 'mascot', 'car', 'phone', or 'sparkle' / 'android' in a colour. */
    warm(kind, colour) {
      if (kind === 'mascot') mascotM();
      else if (kind === 'car') carM();
      else if (kind === 'phone') phoneM();
      else if (kind === 'sparkle' && !sparkles[colour]) sparkles[colour] = mesh(sparkleGeo(colour));
      else if (kind === 'android' && !android[colour]) android[colour] = mesh(androidGeo(colour));
    }
  };
  return art;
}

root.OfferModels = {build, treeParts, buildingParts, C, coneR};
})(typeof window !== 'undefined' ? window : globalThis);
