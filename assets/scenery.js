/*
 * The page's scenery in 3D (OfferGL), the app's sky brought outdoors: a gradient sky with, behind the header's sky
 * button, a breathing sun and drifting clouds by day or a crescent moon and twinkling stars by night (the app's scene
 * paints its sun behind its own button the same way); far hills, a small town whose windows light at night, trees on a
 * rise, a road winding into the distance and the delivery car on it, dust drifting in the air. Day turns to night as a
 * short sunset: the sun shrinks away, the sky deepens, the stars and windows come out and the moon swings in.
 * The camera looks level over the land; a lens shift puts the horizon where the page wants it (the road and car stay
 * above the footer links). It rides along beside the car as it drives the winding road, so near things stream past
 * and far ones drift by. Every piece stands at the depth where the earlier flat drawing's size for it holds.
 * Where the browser lets a page hand its canvas to a worker (OffscreenCanvas), this runs in one, so building the
 * scenery and drawing it never take the page's own thread; elsewhere it runs on the page's. Either way scene.js, on the
 * page, says where the page's words, sky button and footer stand and passes on its sky and motion (receive()).
 */
(root => {
'use strict';
// In a worker, the renderer and the models load from beside this file, at its version.
const worker = typeof document === 'undefined' && typeof importScripts === 'function';
if (worker) importScripts('gl.js' + location.search, 'models.js' + location.search);
const GL = root.OfferGL;
// The renderer and its canvas, made once the page has painted (start() below); the scenery then fades in. `page` is
// where the page's things stand (scene.js: measure()), and `post` tells scene.js how things went.
let r = null, canvas = null, art = null, born = 0, page = null, shown = false, post = () => {};
const {M, G} = GL;
const mix = GL.mix, lerp = (a, b, t) => a + (b - a) * t, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
const rnd = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const DAY = {sky: ['#e5e9df', '#f1e8d6', '#f3d9bd'], glow: '#ffe6ad', far: '#c2d0c1', mid: '#b6c6b4', near: '#cad0b7',
  wallA: '#91a9a0', wallB: '#78948f', window: '#a9bdb5', road: '#e9e1c9', roadEdge: '#d2c8a9', dash: '#f7f2dd', tree: '#5b7d71', trunk: '#4f6b61',
  dust: '#546c68', fog: '#ece4d2', light: [.34, .32, .28], skyLight: [.8, .81, .8], ground: [.66, .65, .6], rim: [.25, .26, .24]};
const NIGHT = {sky: ['#102032', '#203649', '#394950'], glow: '#5b84a0', far: '#294354', mid: '#223b46', near: '#223638',
  wallA: '#20343f', wallB: '#182d36', window: '#2a3d4c', road: '#425051', roadEdge: '#2f3d3e', dash: '#78857b', tree: '#182f33', trunk: '#14272b',
  dust: '#e8dfba', fog: '#2b4150', light: [.22, .25, .32], skyLight: [.86, .9, 1], ground: [.62, .66, .74], rim: [.2, .26, .36]};
const pick = (k, n) => !Array.isArray(DAY[k]) ? mix(DAY[k], NIGHT[k], n)
  : typeof DAY[k][0] === 'number' ? DAY[k].map((v, i) => lerp(v, NIGHT[k][i], n)) : DAY[k].map((c, i) => mix(c, NIGHT[k][i], n));

// night runs 0 (day) to 1; a change of sky eases it there over TURN seconds.
const TURN = 1.6;
let W = 0, H = 0, dpr = 1, night = 0, turn = {from: 0, to: 0, at: -1e9};
let t = 2, prev = 0, raf = 0;
// The ride: metres along the road so far, at RIDE metres a second, and the car's wheels turned to match.
const RIDE = 3.5;
let ride = 0, spin = 0;
let paused = false, hidden = false, busy = false;
let L = null;          // the layout and meshes for this size
const CAM_H = 2;       // the camera's height over the ground, metres
// A worker's frames come from its own requestAnimationFrame where it has one.
const frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(() => fn(performance.now()), 16);
const unframe = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;

/* Where a point of the flat picture lies on the ground (y = 0) or at a given depth: the inverse of the camera. */
function ground(L, sx, sy) { const d = L.f * CAM_H / Math.max(1, sy - L.horizon); return [(sx - W / 2) / L.f * d, 0, L.camZ - d]; }
const depthAt = (L, dy) => L.f * CAM_H / Math.max(.5, dy);
/* The world point drawn at (sx, sy) at depth d, and a length of px pixels there. */
const at = (L, sx, sy, d) => [(sx - W / 2) / L.f * d, CAM_H + (L.horizon - sy) / L.f * d, L.camZ - d];
const per = (L, px, d) => px / L.f * d;

/* ---- The sky's own things, built once: the sun, the moon, a cloud, and a soft glow to lay behind them ---- */
// Built with the scenery (after the first paint, so no shader is waited on before it): a toy cloud (the app's: a
// round middle, two smaller puffs and a flat foot) its middle puff of radius 1; the sun; the app's crescent (a circle
// less a bite toward its upper right) as a plump tube along its middle, thickest at the lower left and tapering to its
// two points, radius 1 overall; and a soft round glow.
let cloudMesh, sunMesh, moonMesh, glowMesh, glowTex;
function skyParts() {
  if (cloudMesh) return;
  const g = new G.Geo();
  g.add(G.sphere(1, 14, '#ffffff'));
  g.add(G.sphere(.7, 12, '#ffffff'), M.trs([-1.1, -.35, .05]));
  g.add(G.sphere(.78, 12, '#ffffff'), M.trs([1.15, -.3, .05]));
  g.add(G.box(2.25, .7, 1.1, .35, '#ffffff', 4), M.trs([.03, -.7, 0]));
  cloudMesh = r.mesh(g);
  sunMesh = r.mesh(G.sphere(1, 20, '#f8c85a'));
  const pts = [];
  for (let k = 0; k <= 40; k++) { const a = (95 + 241 * k / 40) * Math.PI / 180; pts.push([Math.cos(a) * .64, Math.sin(a) * .64, 0]); }
  moonMesh = r.mesh(G.tube(pts, u => .01 + .35 * Math.pow(Math.sin(Math.PI * u), .85), 14, '#f1e6c8', true));
  glowMesh = r.mesh(G.plane(2, 2, '#ffffff'));
  const c = worker ? new OffscreenCanvas(64, 64) : document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(.35, 'rgba(255,255,255,.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
  glowTex = r.texture(c);
}
// The three clouds: [share of the way across at t = 0, seconds to cross, radius (app dp), haze (the app's alpha's
// complement), depth].
const CLOUDS = [[.52, 110, 12, .1, 640], [.12, 160, 15, .3, 470], [.8, 200, 11, .4, 330]];

/* One period of ground: x from 0 to P and z from z0 to z1 in nx x nz cells, its height y = height(x, z) and its color
 * col(x, z). Heights are sampled once a point on a lattice and normals come from the neighbouring heights, across the
 * period's ends too, so its repeats meet without a seam. */
function field(P, z0, z1, nx, nz, height, col) {
  const g = new G.Geo(), dx = P / nx, dz = (z1 - z0) / nz, Y = new Float64Array(nx * (nz + 1));
  for (let j = 0; j <= nz; j++) for (let k = 0; k < nx; k++) Y[j * nx + k] = height(dx * k, z0 + dz * j);
  const at = (k, j) => Y[Math.min(nz, Math.max(0, j)) * nx + (k % nx + nx) % nx];
  g.room((nx + 1) * (nz + 1), nx * nz * 6);
  for (let j = 0; j <= nz; j++) for (let k = 0; k <= nx; k++) {
    const sx = (at(k + 1, j) - at(k - 1, j)) / (2 * dx), sz = (at(k, j + 1) - at(k, j - 1)) / (dz * ((j > 0) + (j < nz)));
    const l = Math.hypot(sx, 1, sz), x = dx * k, z = z0 + dz * j;
    g.vert([x, at(k, j), z], [-sx / l, 1 / l, -sz / l], col(x, z), [k / nx, j / nz]);
  }
  for (let j = 0; j < nz; j++) for (let k = 0; k < nx; k++) { const a = j * (nx + 1) + k, b = a + nx + 1; g.quad(a, b, b + 1, a + 1); }
  return g;
}

function layout() {
  const mobile = W < 850, horizon = Math.min(mobile ? H * .806 : H * .756, page.groundTop - 118);
  const f = Math.max(380, Math.min(1100, W * .62)), camZ = 6, town = f * CAM_H / 3;
  // The period of the land, its road and trees, and the town: eighteen houses at the flat drawing's spacing, a little
  // wider than the view at the town.
  const P = 18 * (W / 16) / f * town;
  const L = {W, H, mobile, horizon, f, camZ, P, layers: []};
  const add = (geo, key, period, depth, opt) => { if (geo.i.length) L.layers.push(Object.assign({mesh: r.mesh(geo), key, period, depth}, opt)); };
  // Two far ridges whose crests trace the flat drawing's hills, standing at depth, each repeating with its longer wave.
  const ridge = (base, amp, phase, d, key) => {
    const period = Math.PI / 2 * W / f * d, g = new G.Geo(), n = 96, top = [], bottom = [];
    for (let k = 0; k <= n; k++) {
      const x = period * k / n, sx = W / 2 + x * f / d;
      const sy = base + Math.sin(sx / W * 4 + phase) * amp + Math.sin(sx / W * 8 + phase) * amp * .3;
      top.push(g.vert([x, CAM_H + (horizon - sy) / f * d, camZ - d], [0, .35, 1], '#ffffff'));
      bottom.push(g.vert([x, -d * .05, camZ - d], [0, .35, 1], '#ffffff'));
    }
    for (let k = 0; k < n; k++) g.quad(bottom[k], bottom[k + 1], top[k + 1], top[k]);
    add(g, key, period, d, {rim: .04, spec: 0});
  };
  ridge(horizon - 60, 35, 1.2, 700, 'far');
  ridge(horizon - 23, 22, 3.1, 420, 'mid');
  // The town along the horizon: eighteen houses to the period, every third gabled; their windows light at night.
  const walls = [new G.Geo(), new G.Geo()], lit = new G.Geo(), dark = new G.Geo();
  for (let i = 0; i < 18; i++) {
    const hpx = 24 + ((i * 17) % 53), wpx = W / 33, d = town + (i % 4) * town * .04;
    const w = wpx / f * d, h = (hpx + 3) / f * d;
    const b = OfferModels.buildingParts(w, h, w * .8, {gable: i % 3 === 0, seed: i * 7 + 3, cols: Math.max(1, Math.round(wpx / 14)), rows: Math.max(1, Math.floor(hpx / 13))});
    const m = M.trs([(i + .5) * P / 18, -h * .03, camZ - d]);
    walls[i % 3 ? 0 : 1].add(b.walls, m); lit.add(b.lit, m); dark.add(b.dark, m);
  }
  const back = town * 1.12;
  add(walls[0], 'wallA', P, back, {rim: .1, spec: .03}); add(walls[1], 'wallB', P, back, {rim: .1, spec: .03});
  add(dark, 'window', P, back, {rim: 0, spec: 0}); add(lit, 'lit', P, back, {rim: 0, spec: 0, glowing: true});
  // The land: gently rolling, rising a little before the town so its feet sit behind a near swell. Each of its waves
  // along x fits the period a whole number of times, so its repeats meet without a seam. Its fine bumps, finer than the
  // ground's mesh can follow, are kept off the near ground, where seen this flat they would rise through the road: they
  // begin past the road (dm, its middle distance) and are whole at three times its distance.
  const swell = town * .5, wave = k => 2 * Math.PI * Math.max(1, Math.round(k * P / (2 * Math.PI))) / P, dm = depthAt(L, 70);
  const kA = wave(9 / swell), kB = wave(.011), kC = wave(.023), kD = wave(.7), kE = wave(.021), kF = wave(.008);
  const land = L.land = (x, z) => {
    const d = camZ - z, far = Math.min(1, Math.max(0, (d - 60) / 260)) * Math.min(1, Math.max(0, (town * .92 - d) / 60));
    return .55 * Math.exp(-Math.pow((d - swell) / (swell * .35), 2)) * (1 + .6 * Math.sin(x * kA + 2)) +
      far * (2.6 * Math.sin(x * kB + 1.3) * Math.sin(z * .008 + .4) + 1.4 * Math.sin(x * kC - z * .01)) +
      .12 * Math.sin(x * kD + z * .3) * Math.min(1, Math.max(0, (d - dm * 1.6) / (dm * 1.4)));
  };
  const patch = (x, z) => { const v = .965 + .035 * Math.sin(x * kE + z * .013) * Math.cos(z * .017 - x * kF); return [v, v, v, 0]; };
  add(field(P, camZ - town * .985, camZ + 1, Math.max(24, Math.round(P / (town * .0267))), 90, land, patch), 'near', P, town, {rim: .02, spec: 0});
  // The road, winding nearer and farther: one wave to about a screen and a third at its middle distance, as the flat
  // drawing's curve did. Seen side on, it is wide enough to show 14 px deep there; its edges run along it and dashes
  // down its middle, a whole number of them to the period.
  const kR = wave(2 * Math.PI / (1.3 * W / f * dm)), kS = wave(2.3 * 2 * Math.PI / (1.3 * W / f * dm));
  L.roadDepth = x => dm * (1 + .2 * Math.sin(x * kR + .7) + .04 * Math.sin(x * kS + 2.1));
  L.roadSlope = x => dm * (.2 * kR * Math.cos(x * kR + .7) + .04 * kS * Math.cos(x * kS + 2.1));
  const onRoad = x => { const z = camZ - L.roadDepth(x); return [x, land(x, z), z]; };
  const nr = Math.round(P * kR / (2 * Math.PI)) * 28, path = [];
  for (let k = 0; k <= nr; k++) path.push(onRoad(P * k / nr));
  const width = 14 * dm * dm / (f * CAM_H), deep = dm * 1.3;
  add(G.ribbon(path, width, '#ffffff', .04), 'road', P, deep, {rim: 0, spec: .02});
  const edges = new G.Geo();
  for (const side of [-1, 1]) {
    const line = path.map((p, k) => {
      const a = path[Math.max(0, k - 1)], b = path[Math.min(path.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
      return [p[0] + (b[2] - a[2]) / l * width * .47 * side, p[1], p[2] - (b[0] - a[0]) / l * width * .47 * side];
    });
    edges.add(G.ribbon(line, width * .05, '#ffffff', .05));
  }
  add(edges, 'roadEdge', P, deep, {rim: 0, spec: 0});
  const count = Math.max(1, Math.round(P / (width * .9))), dashes = new G.Geo();
  for (let i = 0; i < count; i++) dashes.add(G.ribbon([0, .25, .5].map(u => onRoad((i + u) * P / count)), width * .1, '#ffffff', .07));
  add(dashes, 'dash', P, deep, {rim: 0, spec: 0});
  // Trees beyond the road at the flat drawing's depths, about as many to the screen at each depth as it had.
  const tree = OfferModels.treeParts(), leaves = new G.Geo(), trunks = new G.Geo(), tr = rnd(5);
  for (const [lo, hi] of [[9, 16], [16, 24], [24, 31]]) {
    const n = Math.round((mobile ? 2 : 6) * P / (W / f * depthAt(L, (lo + hi) / 2)));
    for (let i = 0; i < n; i++) {
      const x = (i + tr()) * P / n, d = depthAt(L, lo + tr() * (hi - lo)), z = camZ - d;
      const m = M.trs([x, land(x, z), z], [tr() * 6, 0, 0], (.6 + tr() * .6) * 72 / f * d / 2);
      leaves.add(tree.leaf, m); trunks.add(tree.trunk, m);
    }
  }
  const woods = depthAt(L, 9) * 1.05;
  add(leaves, 'tree', P, woods, {rim: .2, spec: .04}); add(trunks, 'trunk', P, woods, {rim: .1, spec: 0});
  // Stars far off, and dust in the air.
  const sr = rnd(28), stars = [];
  for (let i = 0; i < 90; i++) {
    const sx = sr() * W, sy = sr() * H * .7, d = 900;
    stars.push([(sx - W / 2) / f * d, CAM_H + (horizon - sy) / f * d, camZ - d, 1.4 + sr() * 2, sr() * 6, .35 + .6 * sr()]);
  }
  L.stars = r.points(stars);
  const dr = rnd(72);
  L.dust = Array.from({length: 34}, () => [dr(), dr(), dr(), dr()]);
  L.dustCloud = r.points(L.dust.map(() => [0, 0, 0]));
  // The sun or moon stands behind the header's sky button, as the app's scene paints its sun behind its own; the sky's
  // glow spreads from there. Clouds sail at the app's three heights, sized to the page.
  L.sun = page.sun || {x: W * .9, y: Math.min(70, H * .1), r: 15};
  L.glow = {x: L.sun.x, y: L.sun.y, r: Math.min(W * .42, 560)};
  L.cloudY = [Math.max(L.sun.y + 30, H * .06), horizon * .34, horizon * .62];
  L.cloudSize = clamp(W / 412 * .75, 1.2, 2.3);
  // Where the page's words stand: a cloud fades while it passes behind them, as the app's do.
  L.words = page.words;
  L.sorted = ORDER.map(k => L.layers.find(m => m.key === k)).filter(Boolean);
  return L;
}

/* The canvas at a new size, drawn at once with the scenery as it was; scene.js sends the page's new places once the
 * resizing has settled. Where WebGL is drawn by the CPU, the scenery (soft shapes, no type) is drawn at 60% of the
 * page's pixels and smoothed up, so it leaves the film beside it the most of the machine. */
function resize(w, h, d) {
  if (!w || !h) return;
  W = w; H = h; dpr = d; r.size(W, H, dpr * (r.software ? .6 : 1));
}
/* The page's places: the scenery is rebuilt when the canvas's size really changed (a phone's address bar coming and
 * going leaves it alone) or the places moved (`force`: the fonts arrived), else only drawn. */
function place(p, force) {
  page = p; resize(p.W, p.H, p.dpr);
  if (!W || !H) return;
  if (!L || force || L.W !== W || L.H !== H) build(); else draw();
}
function build() {
  skyParts();
  if (L) { for (const m of L.layers) r.free(m.mesh); r.free(L.stars); r.free(L.dustCloud); }
  L = layout();
  draw();
  // The sky fades in, and the sky button's own sun and moon give way to the sky's.
  if (!shown) { shown = true; post({type: 'drawn'}); }
}

/** Where the ride has brought the car: its place in the land's period, its depth on the road, and how far right of
 *  the camera it is, the camera keeping it a third of the way across the page. */
function riding() {
  const x = (ride % L.P + L.P) % L.P, d = L.roadDepth(x);
  return {x, d, z: L.camZ - d, ahead: (W * .3 - W / 2) / L.f * d};
}

const ORDER = ['tree', 'trunk', 'dash', 'roadEdge', 'road', 'near', 'window', 'lit', 'wallA', 'wallB', 'mid', 'far'];
function draw() {
  if (!L) return;
  const n = night, sky = pick('sky', n);
  r.clear(sky[2]);
  // A level camera riding beside the car; the lens shift puts the horizon at L.horizon. The camera stays at x = 0 and
  // the world moves past it, so its coordinates stay small however far the ride goes.
  const shiftY = (L.horizon - H / 2) / (H / 2), cam = [0, CAM_H, L.camZ];
  const view = {eye: cam, at: [0, CAM_H, L.camZ - 10], fov: 2 * Math.atan(H / 2 / L.f), near: .5, far: 2000, shiftY};
  r.camera(view);
  const land = {dir: [.5, .55, .65], color: pick('light', n), sky: pick('skyLight', n), ground: pick('ground', n), rim: pick('rim', n),
    gloss: [.6, .1, .7], fog: pick('fog', n), fogNear: 250, fogFar: 3000};
  r.light(land);
  // The car first (nearest), driving along the road, turning with it, then the land near to far: each layer at the
  // repeats of its period that the view takes in at its farthest.
  const c = riding(), camX = ride - c.ahead, k = 52 / L.f * c.d / (92 * art.carSize), yaw = Math.atan2(L.roadSlope(c.x), 1);
  const bob = Math.abs(Math.sin(t * 9)) * .008 * k, carY = L.land(c.x, c.z);
  art.car(M.trs([c.ahead, carY + .06 + bob, c.z], [yaw, 0, 0], k), {wheel: spin, lights: smooth((n - .3) / .5)});
  for (const m of L.sorted) {
    const tint = m.key === 'lit' ? mix(DAY.window, '#ecc27b', n) : pick(m.key, n);
    const o = {tint, rim: m.rim, spec: m.spec, glow: m.glowing ? smooth((n - .3) / .5) : 0, cull: false};
    const reach = W / 2 / L.f * m.depth + 20;
    for (let i = Math.floor((camX - reach) / m.period); i <= Math.floor((camX + reach) / m.period); i++) r.draw(m.mesh, M.trs([i * m.period - camX, 0, 0]), o);
  }
  // By day, the clouds drift across at their own paces; at dusk they melt into the sky.
  const fade = smooth(n / .7);
  if (fade < 1) {
    r.light({dir: [-.3, .7, .65], color: [.32, .31, .29], sky: [.86, .87, .88], ground: [.7, .72, .78], rim: [.4, .42, .44], gloss: [0, 0, 0], fog: sky[1]});
    CLOUDS.forEach(([share, period, size, haze, depth], i) => {
      const px = size * L.cloudSize, span = W + px * 5, x = ((share + t / period) % 1) * span - px * 2.5, y = L.cloudY[i];
      // The app's rule: the share of the cloud behind words fades it, gone once a fifth of it is behind them.
      const left = x - px * 1.8, top = y - px, right = x + px * 2.05, bottom = y + px * 1.05;
      let behind = 0;
      for (const b of L.words) behind += Math.max(0, Math.min(right, b.right) - Math.max(left, b.left)) * Math.max(0, Math.min(bottom, b.bottom) - Math.max(top, b.top));
      const shown = (1 - Math.min(1, behind / (.2 * (right - left) * (bottom - top)))) * (1 - fade);
      if (shown <= .01) return;
      r.draw(cloudMesh, M.trs(at(L, x, y, depth), null, [per(L, px, depth), per(L, px, depth), per(L, px * .7, depth)]),
        {rim: .35, spec: .05, shine: 12, haze: 1 - (1 - haze) * shown, fog: false, fogColor: sky[1]});
    });
  }
  r.sky({c0: sky[0], c1: sky[1], c2: sky[2], mid: .48, from: [0, 0], to: [0, 1],
    halo: pick('glow', n), haloAt: [L.glow.x / W, L.glow.y / H], haloR: L.glow.r, haloA: .42});
  r.light(land);
  r.shadow(M.trs([c.ahead, carY + .07, c.z], [yaw, 0, 0], [2.1 * k, 1, 1.2 * k]), {alpha: lerp(.18, .3, n)});
  const starsOn = smooth((n - .35) / .55);
  if (starsOn > .01) r.stars(L.stars, {color: '#f6edcd', alpha: starsOn * .85, time: t, twinkle: .6});
  sunAndMoon(n, cam);
  r.camera(view);
  // Dust in the air, drifting and streaming past as the ride goes.
  const dust = L.dust.map(([a, b, c, e], i) => {
    const dd = 20 + e * 80, span = W + 30, run = a * W + t * (3 + c * 7) - camX * L.f / dd;
    const sx = (run % span + span) % span - 15, sy = b * L.horizon * .95 + Math.sin(t * .4 + i) * 5;
    const x = (sx - W / 2) / L.f * dd, y = CAM_H + (L.horizon - sy) / L.f * dd;
    return [x, y, L.camZ - dd, 1 + c * 2.6, 0, .25 + c * .6];
  });
  r.stars(r.updatePoints(L.dustCloud, dust), {color: pick('dust', n), alpha: .55, twinkle: 0});
  r.done();
}

/* The sun or the moon behind the sky button, with a glow that breathes (the app's: 6% over seven seconds). Over a
 * change of sky the sun shrinks away, sinking, and the moon swings in after it. Out in the frame's corner a level
 * camera would stretch them into ovals, so they are drawn by one looking straight at them, its lens shifted back onto
 * the button. */
function sunAndMoon(n, eye) {
  const D = 900, S = L.sun, breathe = 1 + .06 * Math.sin(t * Math.PI * 2 / 7), sunK = 1 - smooth(n / .5), moonK = smooth((n - .5) / .5);
  const glow = [lerp(.42, .26, n), mix('#ffd36e', '#e9ddb8', n)], dip = 1 - .45 * Math.sin(Math.PI * n);
  r.draw(glowMesh, M.trs(at(L, S.x, S.y, D + 40), null, per(L, S.r * 2.8 * breathe * dip, D + 40)),
    {tex: glowTex, texAlpha: true, additive: true, unlit: true, tint: glow[1], alpha: glow[0], fog: false, cull: false});
  const p = at(L, S.x, S.y, D), dist = Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]);
  r.camera({eye, at: p, fov: 2 * Math.atan(H / 2 / L.f), near: .5, far: 2000, shiftX: 1 - 2 * S.x / W, shiftY: 2 * S.y / H - 1});
  // Its own small moves, in pixels about the button: the sun sinks right as it goes, the moon rises from the left.
  const spot = (dx, dy) => [p[0] + per(L, dx, dist), p[1] - per(L, dy, dist), p[2]];
  if (sunK > .01) {
    r.light({dir: [-.4, .6, .7], color: [.35, .3, .2], sky: [1, .96, .88], ground: [.92, .82, .66], rim: [1, .93, .7], gloss: [0, 0, 0]});
    r.draw(sunMesh, M.trs(spot(10 * (1 - sunK), 14 * (1 - sunK)), null, per(L, S.r * sunK, dist)), {rim: .7, spec: .25, shine: 18, fog: false});
  }
  if (moonK > .01) {
    r.light({dir: [-.45, .5, .75], color: [.42, .4, .36], sky: [.95, .93, .88], ground: [.62, .62, .68], rim: [.42, .45, .55], gloss: [-.7, .2, .6]});
    const pop = 1 + .12 * Math.sin(Math.PI * moonK) * (1 - moonK);
    r.draw(moonMesh, M.trs(spot(-10 * (1 - moonK), 12 * (1 - moonK)), [0, 0, (1 - moonK) * -.8], per(L, S.r * moonK * pop, dist)),
      {rim: .45, spec: .35, shine: 30, fog: false});
  }
}

function tick(ms) {
  raf = 0;
  if (hidden || paused) return;
  // Where WebGL is drawn by the CPU and the film is moving beside it, the scenery takes ten frames a second and leaves
  // the rest of the machine to the film; it rides on all the same.
  if (r.software && busy && prev && ms - prev < 95) { raf = frame(tick); return; }
  const dt = prev ? Math.min((ms - prev) / 1000, .15) : 0;
  prev = ms; t += dt;
  night = lerp(turn.from, turn.to, smooth((t - turn.at) / TURN));
  // The wheels (10 of the car's units in radius, at its scale for its depth) roll the ground the ride covers.
  ride += dt * RIDE; spin += dt * RIDE / (10 * 52 / L.f * riding().d / 92);
  draw();
  raf = frame(tick);
}
const wake = () => { if (L && !paused && !hidden && !raf) { prev = 0; raf = frame(tick); } };
/** Turns the sky to night (true) or day (false): a short sunset or sunrise, or at once while motion is paused. */
function setNight(v) {
  const to = v ? 1 : 0;
  if (to === turn.to) return;
  turn = {from: night, to, at: t};
  if (paused) { night = to; draw(); }
}
function setPaused(v) {
  paused = v;
  if (!r) return;
  if (paused) { night = turn.to; if (raf) unframe(raf); raf = 0; prev = 0; draw(); }
  else wake();
}
// In steps that each leave the thread free between them: the renderer (where WebGL is missing, the page keeps its plain
// background and the button its own sun and moon), then, once its shaders are ready, the canvas at the page's size,
// then the scenery.
function start(m) {
  night = m.night ? 1 : 0; turn = {from: night, to: night, at: -1e9};
  paused = m.paused; hidden = m.hidden; busy = m.busy; page = m.page;
  // A worker's context is made as gl.js would make it on the page: multisampled unless WebGL here is known to be drawn
  // by the CPU (scene.js remembers what the last visit found).
  begin(m.canvas, worker ? {antialias: m.software !== true} : undefined);
}
function begin(c, opts) {
  r = GL.create(c, opts);
  if (!r) { post({type: 'unavailable'}); return; }
  if (worker) {
    post({type: 'software', software: r.software});
    // Found drawn by the CPU, where multisampling costs as much as the picture: a context without it, on a fresh
    // canvas from the page (a context keeps the settings it was made with).
    if (r.software && opts.antialias) {
      const lose = r.gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      r = null; post({type: 'fresh'});
      return;
    }
  }
  canvas = r.canvas; born = performance.now();
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); paused = true; });
  art = OfferModels.build(r);
  setTimeout(settle, 0);
}
function settle() {
  // Where the browser cannot say when the shaders are ready, they get a moment in the background first.
  if (!r.ready() || (!r.parallel && performance.now() - born < 300)) { setTimeout(settle, 40); return; }
  resize(page.W, page.H, page.dpr);
  setTimeout(() => { place(page, true); wake(); }, 0);
}
/** What scene.js says: start (with the canvas and how things stand), a fresh canvas, the canvas's size while the page
 *  resizes, the page's places, the sky, motion paused, the page hidden, the film moving beside it. */
function receive(m) {
  switch (m.type) {
    case 'start': start(m); break;
    case 'canvas': begin(m.canvas, {antialias: false}); break;
    case 'size': if (L) { resize(m.W, m.H, m.dpr); draw(); } break;
    case 'page': if (L) place(m.page, m.force); else page = m.page; break;
    case 'night': setNight(m.night); break;
    case 'paused': setPaused(m.paused); break;
    case 'hidden': hidden = m.hidden; wake(); break;
    case 'busy': busy = m.busy; break;
  }
}
if (worker) { post = m => postMessage(m); onmessage = e => receive(e.data); }
else root.OfferScenery = {connect: send => { post = send; return receive; }};
})(typeof window !== 'undefined' ? window : self);
