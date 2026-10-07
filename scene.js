/*
 * The page's scenery in 3D (OfferGL): a gradient sky with a sun's glow (stars and a moon's by night), far hills, a
 * small town whose windows light at night, trees on a rise, a road winding into the distance and the delivery car on
 * it, dust drifting in the air. The camera looks level over the land; a lens shift puts the horizon where the page
 * wants it (the road and car stay above the footer links), and the pointer sways the camera a little, so near things
 * pass in front of far ones. Every piece is placed where the earlier flat drawing put it on screen, at a depth that
 * keeps its size. Without WebGL the page keeps its plain background.
 */
(() => {
'use strict';
const canvas = document.getElementById('landscape');
const GL = window.OfferGL, r = GL && GL.create(canvas);
if (!r) { window.setSceneNight = () => {}; window.setScenePaused = () => {}; return; }
const {M, G} = GL, art = OfferModels.build(r);
const mix = GL.mix, lerp = (a, b, t) => a + (b - a) * t;
const rnd = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const DAY = {sky: ['#e5e9df', '#f1e8d6', '#f3d9bd'], glow: '#ffe6ad', far: '#c2d0c1', mid: '#b6c6b4', near: '#cad0b7',
  wallA: '#91a9a0', wallB: '#78948f', window: '#a9bdb5', road: '#e9e1c9', roadEdge: '#d2c8a9', dash: '#f7f2dd', tree: '#5b7d71', trunk: '#4f6b61',
  dust: '#546c68', fog: '#ece4d2', light: [.34, .32, .28], skyLight: [.8, .81, .8], ground: [.66, .65, .6], rim: [.25, .26, .24]};
const NIGHT = {sky: ['#102032', '#203649', '#394950'], glow: '#5b84a0', far: '#294354', mid: '#223b46', near: '#223638',
  wallA: '#20343f', wallB: '#182d36', window: '#2a3d4c', road: '#425051', roadEdge: '#2f3d3e', dash: '#78857b', tree: '#182f33', trunk: '#14272b',
  dust: '#e8dfba', fog: '#2b4150', light: [.22, .25, .32], skyLight: [.86, .9, 1], ground: [.62, .66, .74], rim: [.2, .26, .36]};
const pick = (k, n) => !Array.isArray(DAY[k]) ? mix(DAY[k], NIGHT[k], n)
  : typeof DAY[k][0] === 'number' ? DAY[k].map((v, i) => lerp(v, NIGHT[k][i], n)) : DAY[k].map((c, i) => mix(c, NIGHT[k][i], n));

let W = 0, H = 0, dpr = 1, night = 0, targetNight = 0, t = 2, prev = 0, raf = 0, px = 0, py = 0;
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let L = null;          // the layout and meshes for this size
const CAM_H = 2;       // the camera's height over the ground, metres

/* Where a point of the flat picture lies on the ground (y = 0) or at a given depth: the inverse of the camera. */
function ground(L, sx, sy) { const d = L.f * CAM_H / Math.max(1, sy - L.horizon); return [(sx - W / 2) / L.f * d, 0, L.camZ - d]; }
const depthAt = (L, dy) => L.f * CAM_H / Math.max(.5, dy);


function layout() {
  const mobile = W < 850, links = document.querySelector('.footer-links');
  const groundTop = links ? links.getBoundingClientRect().top - canvas.getBoundingClientRect().top : Infinity;
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
  L.land = land;
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
  // The sun's (or moon's) glow, in the sky's own gradient, where the flat drawing had it.
  L.glow = mobile ? {x: W * .49, y: H * .612, r: Math.min(W * .33, 155)} : {x: W * .744, y: H * .428, r: Math.min(W * .138, 210)};
  L.sorted = ORDER.map(k => L.meshes.find(m => m.key === k)).filter(Boolean);
  return L;
}

function size() {
  W = canvas.clientWidth; H = canvas.clientHeight; dpr = Math.min(devicePixelRatio || 1, 2);
  if (!W || !H) return;
  r.size(W, H, dpr);
  if (L) { for (const m of L.meshes) r.free(m.mesh); r.free(L.stars); r.free(L.dustCloud); }
  L = layout();
  draw();
}

/** The car's place on the road at s (0-1 along it) and its heading. */
function along(s) {
  const p = L.road, f = Math.max(0, Math.min(p.length - 1.001, s * (p.length - 1))), k = Math.floor(f), u = f - k;
  const a = p[k], b = p[k + 1];
  return {at: [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)], yaw: Math.atan2(-(b[2] - a[2]), b[0] - a[0])};
}

const SKIP = (location.search.match(/skip=([a-z,]*)/) || [])[1] || '';
const ORDER = ['tree', 'trunk', 'dash', 'roadEdge', 'road', 'near', 'window', 'lit', 'wallA', 'wallB', 'mid', 'far'].filter(k => !SKIP.includes(k));
function draw() {
  if (!L) return;
  const n = night, sky = pick('sky', n);
  r.clear(sky[2]);
  // A level camera, swayed by the pointer; the lens shift puts the horizon at L.horizon.
  const shiftY = (L.horizon - H / 2) / (H / 2), cam = [px * .9, CAM_H + py * .25, L.camZ];
  r.camera({eye: cam, at: [cam[0], cam[1], cam[2] - 10], fov: 2 * Math.atan(H / 2 / L.f), near: .5, far: 2000, shiftY});
  r.light({dir: [.5, .55, .65], color: pick('light', n), sky: pick('skyLight', n), ground: pick('ground', n), rim: pick('rim', n),
    gloss: [.6, .1, .7], fog: pick('fog', n), fogNear: 250, fogFar: 3000});
  // The car first (nearest), ambling to and fro on the road's left third, then the land near to far.
  const s = .3 + Math.sin(t * .06) * .025, p = along(s), d = L.camZ - p.at[2], k = 52 / L.f * d / (92 * art.carSize);
  const bob = Math.abs(Math.sin(t * 9)) * .008 * k, carAt = M.trs([p.at[0], p.at[1] + .06 + bob, p.at[2]], [p.yaw, 0, 0], k);
  if (!SKIP.includes('car')) art.car(carAt, {wheel: t * 3, lights: n});
  for (const m of L.sorted) {
    const tint = m.key === 'lit' ? mix(DAY.window, '#ecc27b', n) : pick(m.key, n);
    r.draw(m.mesh, M.ident(), {tint, rim: m.rim, spec: m.spec, glow: m.glowing ? n : 0, cull: false});
  }
  if (!SKIP.includes('sky')) r.sky({c0: sky[0], c1: sky[1], c2: sky[2], mid: .48, from: [0, 0], to: [0, 1],
    halo: pick('glow', n), haloAt: [L.glow.x / W, L.glow.y / H], haloR: L.glow.r * 2.05, haloA: .48});
  r.shadow(M.trs([p.at[0], p.at[1] + .07, p.at[2]], [p.yaw, 0, 0], [2.1 * k, 1, 1.2 * k]), {alpha: lerp(.18, .3, n)});
  if (n > .05) r.stars(L.stars, {color: '#f6edcd', alpha: n * .85, time: t, twinkle: .6});
  // Dust drifting in the air.
  const dust = L.dust.map(([a, b, c, e], i) => {
    const sx = (a * W + t * (3 + c * 7)) % (W + 30) - 15, sy = b * L.horizon * .95 + Math.sin(t * .4 + i) * 5;
    const dd = 20 + e * 80, x = (sx - W / 2) / L.f * dd, y = CAM_H + (L.horizon - sy) / L.f * dd;
    return [x, y, L.camZ - dd, 1 + c * 2.6, 0, .25 + c * .6];
  });
  if (!SKIP.includes('dust')) r.stars(r.updatePoints(L.dustCloud, dust), {color: pick('dust', n), alpha: .55, twinkle: 0});
  r.done();
}

function tick(ms) {
  raf = 0;
  if (document.hidden || paused) return;
  const dt = prev ? Math.min((ms - prev) / 1000, .05) : 0;
  prev = ms; t += dt; night += (targetNight - night) * Math.min(1, dt * 4);
  draw();
  raf = requestAnimationFrame(tick);
}
window.setSceneNight = v => { targetNight = v ? 1 : 0; if (paused) { night = targetNight; draw(); } };
window.setScenePaused = v => {
  paused = v;
  if (paused) { night = targetNight; if (raf) cancelAnimationFrame(raf); raf = 0; prev = 0; draw(); }
  else if (!raf && !document.hidden) { prev = 0; raf = requestAnimationFrame(tick); }
};
addEventListener('resize', size);
document.addEventListener('visibilitychange', () => { if (!document.hidden && !paused && !raf) raf = requestAnimationFrame(tick); });
document.addEventListener('pointermove', e => { if (!paused) { px += (e.clientX / W - .5) * 1.4 - px * .16; py += (e.clientY / H - .5) * .9 - py * .16; } });
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); paused = true; });
size();
window.__scene = {draw, r};
document.fonts.ready.then(size);
if (!paused) raf = requestAnimationFrame(tick);
})();
