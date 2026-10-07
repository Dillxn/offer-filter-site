/*
 * The page's scenery in 3D (OfferGL), the app's sky brought outdoors: a gradient sky with, behind the header's sky
 * button, a breathing sun and drifting clouds by day or a crescent moon and twinkling stars by night (the app's scene
 * paints its sun behind its own button the same way); far hills, a small town whose windows light at night, trees on a
 * rise, a road winding into the distance and the delivery car on it, dust drifting in the air. Day turns to night as a
 * short sunset: the sun shrinks away, the sky deepens, the stars and windows come out and the moon swings in.
 * The camera looks level over the land; a lens shift puts the horizon where the page wants it (the road and car stay
 * above the footer links), and the pointer sways the camera a little, so near things pass in front of far ones. Every
 * piece is placed where the earlier flat drawing put it on screen, at a depth that keeps its size. Without WebGL the
 * page keeps its plain background and the button its own sun and moon.
 */
(() => {
'use strict';
const GL = window.OfferGL;
if (!GL) { window.setSceneNight = () => {}; window.setScenePaused = () => {}; return; }
// The renderer and its canvas (the page's, or a fresh one in its place where WebGL is drawn by the CPU: gl.js) are
// made after the page's first paint, in start() below; the scenery then fades in.
let r = null, canvas = null, art = null, born = 0;
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
let W = 0, H = 0, dpr = 1, night = document.body.classList.contains('night') ? 1 : 0, turn = {from: night, to: night, at: -1e9};
let t = 2, prev = 0, raf = 0, px = 0, py = 0, rebuild = 0;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let L = null;          // the layout and meshes for this size
const CAM_H = 2;       // the camera's height over the ground, metres

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
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(.35, 'rgba(255,255,255,.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grad; x.fillRect(0, 0, 64, 64);
  glowTex = r.texture(c);
}
// The three clouds: [share of the way across at t = 0, seconds to cross, radius (app dp), haze (the app's alpha's
// complement), depth].
const CLOUDS = [[.52, 110, 12, .1, 640], [.12, 160, 15, .3, 470], [.8, 200, 11, .4, 330]];

function layout() {
  const mobile = W < 850, links = document.querySelector('.footer-links'), box = canvas.getBoundingClientRect();
  const groundTop = links ? links.getBoundingClientRect().top - box.top : Infinity;
  const horizon = Math.min(mobile ? H * .806 : H * .756, groundTop - 118);
  const f = Math.max(380, Math.min(1100, W * .62)), camZ = 6;
  const L = {mobile, horizon, f, camZ, meshes: []};
  const add = (geo, key, opt) => { if (geo.i.length) L.meshes.push(Object.assign({mesh: r.mesh(geo), key}, opt)); };
  // Two far ridges whose crests trace the flat drawing's hills, standing at depth: y = base + waves.
  const ridge = (base, amp, phase, d, key) => {
    const g = new G.Geo(), n = 64, top = [], bottom = [];
    for (let k = 0; k <= n; k++) {
      const sx = -60 + (W + 120) * k / n, sy = base + Math.sin(sx / W * 4 + phase) * amp + Math.sin(sx / W * 8 + phase) * amp * .3;
      const x = (sx - W / 2) / f * d, y = CAM_H + (horizon - sy) / f * d;
      top.push(g.vert([x, y, camZ - d], [0, .35, 1], '#ffffff'));
      bottom.push(g.vert([x, -d * .05, camZ - d], [0, .35, 1], '#ffffff'));
    }
    for (let k = 0; k < n; k++) g.quad(bottom[k], bottom[k + 1], top[k + 1], top[k]);
    add(g, key, {rim: .04, spec: 0});
  };
  ridge(horizon - 60, 35, 1.2, 700, 'far');
  ridge(horizon - 23, 22, 3.1, 420, 'mid');
  // The town along the horizon: eighteen buildings, every third gabled; their windows light at night.
  const town = depthAt(L, 3), walls = [new G.Geo(), new G.Geo()], lit = new G.Geo(), dark = new G.Geo();
  for (let i = 0; i < 18; i++) {
    const sx = i * (W / 16) - 25, hpx = 24 + ((i * 17) % 53), wpx = W / 33, d = town + (i % 4) * town * .04;
    const w = wpx / f * d, h = (hpx + 3) / f * d, x = (sx + wpx / 2 - W / 2) / f * d;
    const b = OfferModels.buildingParts(w, h, w * .8, {gable: i % 3 === 0, seed: i * 7 + 3, cols: Math.max(1, Math.round(wpx / 14)), rows: Math.max(1, Math.floor(hpx / 13))});
    const m = M.trs([x, -h * .03, camZ - d]);
    walls[i % 3 ? 0 : 1].add(b.walls, m); lit.add(b.lit, m); dark.add(b.dark, m);
  }
  add(walls[0], 'wallA', {rim: .1, spec: .03}); add(walls[1], 'wallB', {rim: .1, spec: .03});
  add(dark, 'window', {rim: 0, spec: 0}); add(lit, 'lit', {rim: 0, spec: 0, glowing: true});
  // The land: gently rolling, rising a little before the town so its feet sit behind a near swell.
  const swell = town * .5;
  const land = (x, z) => {
    const d = camZ - z, far = Math.min(1, Math.max(0, (d - 60) / 260)) * Math.min(1, Math.max(0, (town * .92 - d) / 60));
    return .55 * Math.exp(-Math.pow((d - swell) / (swell * .35), 2)) * (1 + .6 * Math.sin(x / swell * 9 + 2)) +
      far * (2.6 * Math.sin(x * .011 + 1.3) * Math.sin(z * .008 + .4) + 1.4 * Math.sin(x * .023 - z * .01)) +
      .12 * Math.sin(x * .7 + z * .3) * Math.min(1, d / 30);
  };
  const patch = (x, z) => { const v = .965 + .035 * Math.sin(x * .021 + z * .013) * Math.cos(z * .017 - x * .008); return [v, v, v, 0]; };
  add(G.terrain(-town * 1.6, town * 1.6, camZ - town * .985, camZ + 1, 120, 90, land, patch), 'near', {rim: .02, spec: 0});
  // The road: the flat drawing's curve laid on the land, with dashes along its middle.
  const roadY = horizon + 37, bez = u => {
    const p0 = [-20, roadY + 43], p1 = [W * .22, roadY + 73], p2 = [W * .58, roadY - 19], p3 = [W + 20, roadY + 11], v = 1 - u;
    return [0, 1].map(k => v * v * v * p0[k] + 3 * v * v * u * p1[k] + 3 * v * u * u * p2[k] + u * u * u * p3[k]);
  };
  const path = [];
  for (let k = 0; k <= 90; k++) { const [sx, sy] = bez(k / 90), p = ground(L, sx, sy); p[1] = land(p[0], p[2]); path.push(p); }
  const width = 36 / f * depthAt(L, 55);
  add(G.ribbon(path, width, '#ffffff', .04), 'road', {rim: 0, spec: .02});
  const edges = new G.Geo();
  for (const side of [-1, 1]) {
    const line = path.map((p, k) => {
      const a = path[Math.max(0, k - 1)], b = path[Math.min(path.length - 1, k + 1)], l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
      return [p[0] + (b[2] - a[2]) / l * width * .47 * side, p[1], p[2] - (b[0] - a[0]) / l * width * .47 * side];
    });
    edges.add(G.ribbon(line, width * .06, '#ffffff', .05));
  }
  add(edges, 'roadEdge', {rim: 0, spec: 0});
  const dashes = new G.Geo();
  let run = 0;
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], b = path[k];
    if (Math.floor(run / (width * 1.5)) % 2 === 0) dashes.add(G.ribbon([a, b], width * .07, '#ffffff', .07));
    run += Math.hypot(b[0] - a[0], b[2] - a[2]);
  }
  add(dashes, 'dash', {rim: 0, spec: 0});
  L.road = path;
  // Trees where the flat drawing set them, on the swell.
  const leaves = new G.Geo(), trunks = new G.Geo();
  [.05, .12, .4, .61, .86, .94].forEach((fx, i) => {
    const [x, , z] = ground(L, W * fx, horizon + 12 + Math.sin(i) * 15), d = camZ - z, s = (.75 + (i % 3) * .15) * 80 / f * d / 2;
    const tr = OfferModels.treeParts(), m = M.trs([x, land(x, z), z], [i, 0, 0], s);
    leaves.add(tr.leaf, m); trunks.add(tr.trunk, m);
  });
  const tr2 = rnd(5);
  // More trees scattered between the road and the town, where a wide page shows that ground.
  for (let i = 0; i < (mobile ? 0 : 16); i++) {
    const sx = tr2() * W, dy = 9 + tr2() * 22, [x, , z] = ground(L, sx, horizon + dy), d = camZ - z;
    const s = (.6 + tr2() * .5) * 64 / f * d / 2, tr = OfferModels.treeParts(), m = M.trs([x, land(x, z), z], [tr2() * 6, 0, 0], s);
    leaves.add(tr.leaf, m); trunks.add(tr.trunk, m);
  }
  add(leaves, 'tree', {rim: .2, spec: .04}); add(trunks, 'trunk', {rim: .1, spec: 0});
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
  const button = document.getElementById('sky-toggle'), b = button && button.getBoundingClientRect();
  L.sun = b && b.width ? {x: b.left + b.width / 2 - box.left, y: b.top + b.height / 2 - box.top, r: b.width * .36}
    : {x: W * .9, y: Math.min(70, H * .1), r: 15};
  L.glow = {x: L.sun.x, y: L.sun.y, r: Math.min(W * .42, 560)};
  L.cloudY = [Math.max(L.sun.y + 30, H * .06), horizon * .34, horizon * .62];
  L.cloudSize = clamp(W / 412 * .75, 1.2, 2.3);
  // Where the page's words stand: a cloud fades while it passes behind them, as the app's do.
  L.words = [...document.querySelectorAll('.wordmark, .intro h1, .lede, .app-actions, .footer-links')].map(e => {
    const q = e.getBoundingClientRect();
    return {left: q.left - box.left, top: q.top - box.top, right: q.right - box.left, bottom: q.bottom - box.top};
  });
  L.sorted = ORDER.map(k => L.meshes.find(m => m.key === k)).filter(Boolean);
  return L;
}

/* Sizes the canvas to the page; rebuilds the scenery when its size really changed (a phone's address bar coming and
 * going leaves it alone), at once the first time, else once the resizing has settled. */
function size(force) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  dpr = Math.min(devicePixelRatio || 1, 2);
  const same = w === W && h === H;
  W = w; H = h; r.size(W, H, dpr);
  clearTimeout(rebuild);
  if (!L) build();
  else if (force) build();
  else if (!same) { rebuild = setTimeout(build, 160); draw(); }
  else draw();
}
function build() {
  skyParts();
  if (L) { for (const m of L.meshes) r.free(m.mesh); r.free(L.stars); r.free(L.dustCloud); }
  L = layout();
  draw();
  // The sky fades in, and the sky button's own sun and moon give way to the sky's.
  canvas.classList.add('drawn');
  document.body.classList.add('sky-3d');
}

/** The car's place on the road at s (0-1 along it) and its heading. */
function along(s) {
  const p = L.road, f = Math.max(0, Math.min(p.length - 1.001, s * (p.length - 1))), k = Math.floor(f), u = f - k;
  const a = p[k], b = p[k + 1];
  return {at: [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)], yaw: Math.atan2(-(b[2] - a[2]), b[0] - a[0])};
}

const ORDER = ['tree', 'trunk', 'dash', 'roadEdge', 'road', 'near', 'window', 'lit', 'wallA', 'wallB', 'mid', 'far'];
function draw() {
  if (!L) return;
  const n = night, sky = pick('sky', n), I = M.ident();
  r.clear(sky[2]);
  // A level camera, swayed by the pointer; the lens shift puts the horizon at L.horizon.
  const shiftY = (L.horizon - H / 2) / (H / 2), cam = [px * .9, CAM_H + py * .25, L.camZ];
  const view = {eye: cam, at: [cam[0], cam[1], cam[2] - 10], fov: 2 * Math.atan(H / 2 / L.f), near: .5, far: 2000, shiftY};
  r.camera(view);
  const land = {dir: [.5, .55, .65], color: pick('light', n), sky: pick('skyLight', n), ground: pick('ground', n), rim: pick('rim', n),
    gloss: [.6, .1, .7], fog: pick('fog', n), fogNear: 250, fogFar: 3000};
  r.light(land);
  // The car first (nearest), ambling to and fro on the road's left third, then the land near to far.
  const s = .3 + Math.sin(t * .06) * .025, p = along(s), d = L.camZ - p.at[2], k = 52 / L.f * d / (92 * art.carSize);
  const bob = Math.abs(Math.sin(t * 9)) * .008 * k, carAt = M.trs([p.at[0], p.at[1] + .06 + bob, p.at[2]], [p.yaw, 0, 0], k);
  art.car(carAt, {wheel: t * 3, lights: smooth((n - .3) / .5)});
  for (const m of L.sorted) {
    const tint = m.key === 'lit' ? mix(DAY.window, '#ecc27b', n) : pick(m.key, n);
    r.draw(m.mesh, I, {tint, rim: m.rim, spec: m.spec, glow: m.glowing ? smooth((n - .3) / .5) : 0, cull: false});
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
  r.shadow(M.trs([p.at[0], p.at[1] + .07, p.at[2]], [p.yaw, 0, 0], [2.1 * k, 1, 1.2 * k]), {alpha: lerp(.18, .3, n)});
  const starsOn = smooth((n - .35) / .55);
  if (starsOn > .01) r.stars(L.stars, {color: '#f6edcd', alpha: starsOn * .85, time: t, twinkle: .6});
  sunAndMoon(n, cam);
  r.camera(view);
  // Dust drifting in the air.
  const dust = L.dust.map(([a, b, c, e], i) => {
    const sx = (a * W + t * (3 + c * 7)) % (W + 30) - 15, sy = b * L.horizon * .95 + Math.sin(t * .4 + i) * 5;
    const dd = 20 + e * 80, x = (sx - W / 2) / L.f * dd, y = CAM_H + (L.horizon - sy) / L.f * dd;
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
  if (document.hidden || paused) return;
  const dt = prev ? Math.min((ms - prev) / 1000, .05) : 0;
  prev = ms; t += dt;
  night = lerp(turn.from, turn.to, smooth((t - turn.at) / TURN));
  draw();
  raf = requestAnimationFrame(tick);
}
/** Turns the sky to night (true) or day (false): a short sunset or sunrise, or at once while motion is paused. */
window.setSceneNight = v => {
  const to = v ? 1 : 0;
  if (to === turn.to) return;
  turn = {from: night, to, at: t};
  if (paused) { night = to; draw(); }
};
window.setScenePaused = v => {
  if (!r) { paused = v; return; }
  paused = v;
  if (paused) { night = turn.to; if (raf) cancelAnimationFrame(raf); raf = 0; prev = 0; draw(); }
  else if (!raf && !document.hidden) { prev = 0; raf = requestAnimationFrame(tick); }
};
addEventListener('resize', () => { if (L) size(); });
document.addEventListener('visibilitychange', () => { if (L && !document.hidden && !paused && !raf) raf = requestAnimationFrame(tick); });
document.addEventListener('pointermove', e => { if (L && !paused) { px += (e.clientX / W - .5) * 1.4 - px * .16; py += (e.clientY / H - .5) * .9 - py * .16; } });
// After the page's first paint, in steps that each leave the page free between them: the renderer (where WebGL is
// missing, the page keeps its plain background and the button its own sun and moon), then, once its shaders are
// ready, the canvas at the page's size, then the scenery, and again when the fonts settle the footer's and the
// button's places.
function start() {
  r = GL.create(document.getElementById('landscape'));
  if (!r) return;
  canvas = r.canvas; born = performance.now();
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); paused = true; });
  art = OfferModels.build(r);
  setTimeout(settle, 0);
}
function settle() {
  // Where the browser cannot say when the shaders are ready, they get a moment in the background first.
  if (!r.ready() || (!r.parallel && performance.now() - born < 300)) { setTimeout(settle, 40); return; }
  W = canvas.clientWidth; H = canvas.clientHeight; dpr = Math.min(devicePixelRatio || 1, 2);
  if (W && H) r.size(W, H, dpr);
  setTimeout(() => {
    size(true);
    if (document.fonts.status !== 'loaded') document.fonts.ready.then(() => size(true));
    if (!paused && !raf) raf = requestAnimationFrame(tick);
  }, 0);
}
// Begun once the page has loaded and the browser is idle, so nothing of the 3D sky stands between a visit and its first
// paint (the page's own colors show until it fades in).
const begin = () => ('requestIdleCallback' in window ? requestIdleCallback(start, {timeout: 600}) : setTimeout(start, 50));
if (document.readyState === 'complete') begin(); else addEventListener('load', begin, {once: true});
})();
