/*
 * OfferGL: the small WebGL renderer behind Offer Filter's 3D art (the page's scenery and the film). One lit shader
 * gives everything the same soft, toy-like look: sky-and-ground ambient light, one key light, a rim of sky light on
 * the edges, a little gloss, fog that fades distance into the sky, an inked outline for characters, and vertex
 * colors whose alpha makes them glow (lit windows, headlights). A gradient sky and a point shader for stars and
 * dust complete it. Geometry is built once on the CPU (lathes, tubes, rounded boxes, extrusions, terrain) and
 * drawn with a handful of calls a frame. Units are arbitrary world units; colors are '#rrggbb' or [r, g, b, glow].
 */
(function(root) {
'use strict';

/* ---- Math: column-major 4 x 4 matrices in Float32Arrays, as WebGL wants them ---- */
const M = {
  ident: () => { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b, out) {
    const o = out || new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  /** A perspective projection, its image shifted by (shiftX, shiftY) in clip units (a lens shift, as architects
   *  photograph buildings: the horizon moves without tilting the camera). */
  perspective(fovY, aspect, near, far, shiftX, shiftY) {
    const f = 1 / Math.tan(fovY / 2), m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f; m[8] = shiftX || 0; m[9] = shiftY || 0;
    m[10] = (far + near) / (near - far); m[11] = -1; m[14] = 2 * far * near / (near - far);
    return m;
  },
  lookAt(eye, at, up) {
    let zx = eye[0] - at[0], zy = eye[1] - at[1], zz = eye[2] - at[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx, m = new Float32Array(16);
    m[0] = xx; m[4] = xy; m[8] = xz; m[1] = yx; m[5] = yy; m[9] = yz; m[2] = zx; m[6] = zy; m[10] = zz;
    m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]); m[15] = 1;
    return m;
  },
  /** Translate, then turn (yaw about y, pitch about x, roll about z), then scale (a number or [x, y, z]). */
  trs(t, r, s, out) {
    const m = out || new Float32Array(16), [a, b, c] = r || [0, 0, 0];
    const sx = s == null ? 1 : s.length ? s[0] : s, sy = s == null ? 1 : s.length ? s[1] : s, sz = s == null ? 1 : s.length ? s[2] : s;
    const cy = Math.cos(a), sy_ = Math.sin(a), cx = Math.cos(b), sx_ = Math.sin(b), cz = Math.cos(c), sz_ = Math.sin(c);
    // R = Ry * Rx * Rz
    const r00 = cy * cz + sy_ * sx_ * sz_, r01 = -cy * sz_ + sy_ * sx_ * cz, r02 = sy_ * cx;
    const r10 = cx * sz_, r11 = cx * cz, r12 = -sx_;
    const r20 = -sy_ * cz + cy * sx_ * sz_, r21 = sy_ * sz_ + cy * sx_ * cz, r22 = cy * cx;
    m[0] = r00 * sx; m[1] = r10 * sx; m[2] = r20 * sx; m[3] = 0;
    m[4] = r01 * sy; m[5] = r11 * sy; m[6] = r21 * sy; m[7] = 0;
    m[8] = r02 * sz; m[9] = r12 * sz; m[10] = r22 * sz; m[11] = 0;
    m[12] = t ? t[0] : 0; m[13] = t ? t[1] : 0; m[14] = t ? t[2] : 0; m[15] = 1;
    return m;
  },
  /** The normal matrix: the inverse transpose of m's upper 3 x 3. */
  normal(m, out) {
    const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C || 1;
    const o = out || new Float32Array(9);
    o[0] = A / det; o[1] = B / det; o[2] = C / det;
    o[3] = -(b * i - c * h) / det; o[4] = (a * i - c * g) / det; o[5] = -(a * h - b * g) / det;
    o[6] = (b * f - c * e) / det; o[7] = -(a * f - c * d) / det; o[8] = (a * e - b * d) / det;
    return o;
  },
  apply(m, p) {
    const x = p[0], y = p[1], z = p[2], w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w];
  }
};

/* ---- Colors ---- */
const cache = new Map();
/** '#rrggbb' (or an [r, g, b, glow] array) as [r, g, b, glow], 0-1. */
function rgb(c, glow) {
  if (typeof c !== 'string') return glow == null ? c : [c[0], c[1], c[2], glow];
  let v = cache.get(c);
  if (!v) { const n = parseInt(c.slice(1), 16); v = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 0]; cache.set(c, v); }
  return glow == null ? v : [v[0], v[1], v[2], glow];
}
const mixc = (a, b, t) => { a = rgb(a); b = rgb(b); return [0, 1, 2, 3].map(i => a[i] + (b[i] - a[i]) * t); };

/* ---- Geometry, built on the CPU: 12 floats a vertex (position, normal, color + glow, uv), in typed arrays that grow
 * as it is built, so a scene of tens of thousands of vertices is put together in a few milliseconds ---- */
const STRIDE = 12, scratch9 = new Float32Array(9);
class Geo {
  constructor() { this.f = new Float32Array(STRIDE * 64); this.n = 0; this.ix = new Uint32Array(96); this.ni = 0; }
  get count() { return this.n; }
  /** The vertices and indices so far (views: writing to v changes the geometry). */
  get v() { return this.f.subarray(0, this.n * STRIDE); }
  get i() { return this.ix.subarray(0, this.ni); }
  room(verts, idx) {
    if ((this.n + verts) * STRIDE > this.f.length) { const f = new Float32Array(Math.max(this.f.length * 2, (this.n + verts) * STRIDE)); f.set(this.f); this.f = f; }
    if (this.ni + idx > this.ix.length) { const x = new Uint32Array(Math.max(this.ix.length * 2, this.ni + idx)); x.set(this.ix); this.ix = x; }
  }
  vert(p, n, c, uv) {
    c = rgb(c); this.room(1, 0);
    const f = this.f, o = this.n * STRIDE;
    f[o] = p[0]; f[o + 1] = p[1]; f[o + 2] = p[2]; f[o + 3] = n[0]; f[o + 4] = n[1]; f[o + 5] = n[2];
    f[o + 6] = c[0]; f[o + 7] = c[1]; f[o + 8] = c[2]; f[o + 9] = c[3] || 0; f[o + 10] = uv ? uv[0] : 0; f[o + 11] = uv ? uv[1] : 0;
    return this.n++;
  }
  tri(a, b, c) { this.room(0, 3); const x = this.ix; x[this.ni++] = a; x[this.ni++] = b; x[this.ni++] = c; return this; }
  quad(a, b, c, d) { this.room(0, 6); const x = this.ix; x[this.ni++] = a; x[this.ni++] = b; x[this.ni++] = c; x[this.ni++] = a; x[this.ni++] = c; x[this.ni++] = d; return this; }
  /** Appends another geometry, moved by matrix m (and recolored by fn(color) when given). */
  add(g, m, recolor) {
    const base = this.n, count = g.n;
    this.room(count, g.ni);
    const src = g.f, dst = this.f, nm = m ? M.normal(m, scratch9) : null;
    for (let k = 0; k < count; k++) {
      const s = k * STRIDE, o = (base + k) * STRIDE;
      let x = src[s], y = src[s + 1], z = src[s + 2], nx = src[s + 3], ny = src[s + 4], nz = src[s + 5];
      if (m) {
        const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
        const px = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w, py = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
        z = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w; x = px; y = py;
        const tx = nm[0] * nx + nm[3] * ny + nm[6] * nz, ty = nm[1] * nx + nm[4] * ny + nm[7] * nz, tz = nm[2] * nx + nm[5] * ny + nm[8] * nz;
        const l = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
        nx = tx / l; ny = ty / l; nz = tz / l;
      }
      dst[o] = x; dst[o + 1] = y; dst[o + 2] = z; dst[o + 3] = nx; dst[o + 4] = ny; dst[o + 5] = nz;
      if (recolor) { const c = rgb(recolor([src[s + 6], src[s + 7], src[s + 8], src[s + 9]])); dst[o + 6] = c[0]; dst[o + 7] = c[1]; dst[o + 8] = c[2]; dst[o + 9] = c[3] || 0; }
      else { dst[o + 6] = src[s + 6]; dst[o + 7] = src[s + 7]; dst[o + 8] = src[s + 8]; dst[o + 9] = src[s + 9]; }
      dst[o + 10] = src[s + 10]; dst[o + 11] = src[s + 11];
    }
    this.n += count;
    const xi = this.ix, si = g.ix;
    for (let k = 0; k < g.ni; k++) xi[this.ni + k] = si[k] + base;
    this.ni += g.ni;
    return this;
  }
}
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const color = (c, ...args) => typeof c === 'function' ? c(...args) : c;

const G = {
  Geo, rgb, mix: mixc,
  /**
   * A surface of revolution about the y axis: profile [[radius, y], ...] from top to bottom, `seg` steps round.
   * Normals come from the profile's slope, smooth unless a point repeats (a crease). col(t along profile, angle).
   */
  lathe(profile, seg, col, opts) {
    const g = new Geo(), n = profile.length, a0 = opts && opts.from || 0, a1 = opts && opts.to || Math.PI * 2;
    const normals = profile.map((p, k) => {
      const a = profile[Math.max(0, k - 1)], b = profile[Math.min(n - 1, k + 1)];
      const dr = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dr, dy) || 1;
      return [-dy / l, dr / l];   // outward when the profile runs top to bottom
    });
    const len = [0];
    for (let k = 1; k < n; k++) len.push(len[k - 1] + Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]));
    for (let s = 0; s <= seg; s++) {
      const a = a0 + (a1 - a0) * s / seg, ca = Math.cos(a), sa = Math.sin(a);
      for (let k = 0; k < n; k++) {
        const [r, y] = profile[k], [nr, ny] = normals[k];
        g.vert([r * sa, y, r * ca], norm([nr * sa, ny, nr * ca]), color(col, len[k] / (len[n - 1] || 1), a, k), [s / seg, k / (n - 1)]);
      }
    }
    for (let s = 0; s < seg; s++) for (let k = 0; k < n - 1; k++) {
      const a = s * n + k, b = a + n;
      g.quad(a, a + 1, b + 1, b);
    }
    return g;
  },
  sphere(r, seg, col, sy) {
    const prof = [];
    for (let k = 0; k <= seg; k++) { const a = Math.PI * k / seg; prof.push([Math.sin(a) * r, Math.cos(a) * r * (sy || 1)]); }
    return G.lathe(prof, seg * 2, col);
  },
  /** A tube along points [[x, y, z], ...]: radius(t) or a number, `sides` round, rounded ends when caps. */
  tube(points, radius, sides, col, caps) {
    const g = new Geo(), n = points.length, rad = typeof radius === 'function' ? radius : () => radius;
    let prevN = null;
    const frames = points.map((p, k) => {
      const a = points[Math.max(0, k - 1)], b = points[Math.min(n - 1, k + 1)];
      const t = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
      let nn = prevN ? norm(cross(cross(t, prevN), t)) : norm(cross(t, Math.abs(t[1]) < .9 ? [0, 1, 0] : [1, 0, 0]));
      if (!isFinite(nn[0])) nn = [1, 0, 0];
      prevN = nn;
      return [t, nn, cross(t, nn)];
    });
    for (let k = 0; k < n; k++) {
      const [, nn, bb] = frames[k], r = rad(k / (n - 1)), p = points[k];
      for (let s = 0; s <= sides; s++) {
        const a = Math.PI * 2 * s / sides, d = [nn[0] * Math.cos(a) + bb[0] * Math.sin(a), nn[1] * Math.cos(a) + bb[1] * Math.sin(a), nn[2] * Math.cos(a) + bb[2] * Math.sin(a)];
        g.vert([p[0] + d[0] * r, p[1] + d[1] * r, p[2] + d[2] * r], d, color(col, k / (n - 1)), [s / sides, k / (n - 1)]);
      }
    }
    for (let k = 0; k < n - 1; k++) for (let s = 0; s < sides; s++) {
      const a = k * (sides + 1) + s, b = a + sides + 1;
      g.quad(a, a + 1, b + 1, b);
    }
    if (caps) for (const k of [0, n - 1]) {
      const r = rad(k / (n - 1));
      if (r > 1e-4) g.add(G.sphere(r, Math.max(4, sides / 2 | 0), color(col, k / (n - 1))), M.trs(points[k]));
    }
    return g;
  },
  /** An arc of a circle of radius R in the x-y plane from angle a0 to a1, as a tube of radius r(t). */
  arc(R, r, a0, a1, seg, sides, col, caps) {
    const pts = [];
    for (let k = 0; k <= seg; k++) { const a = a0 + (a1 - a0) * k / seg; pts.push([Math.cos(a) * R, Math.sin(a) * R, 0]); }
    return G.tube(pts, r, sides, col, caps);
  },
  /** A box w x h x d centred on the origin, its edges rounded by r (0 for sharp), `n` steps across each face. */
  box(w, h, d, r, col, n) {
    const g = new Geo(), half = [w / 2, h / 2, d / 2];
    r = Math.min(r || 0, ...half); n = n || (r > 0 ? 6 : 1);
    const inner = half.map(v => v - r);
    // Each face: its normal and two directions across it, u x v = normal, so quads wind outward.
    const faces = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]],
      [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
    const ext = v => Math.abs(v[0]) * half[0] + Math.abs(v[1]) * half[1] + Math.abs(v[2]) * half[2];
    for (const [nf, u, v] of faces) {
      const base = g.count, hn = ext(nf), hu = ext(u), hv = ext(v);
      for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++) {
        const a = (k / n * 2 - 1) * hu, b = (j / n * 2 - 1) * hv;
        const p = [0, 1, 2].map(q => nf[q] * hn + u[q] * a + v[q] * b);
        // Round: clamp to the inner box, then push out by r along the difference.
        const c = p.map((x, q) => Math.max(-inner[q], Math.min(inner[q], x)));
        const dn = [p[0] - c[0], p[1] - c[1], p[2] - c[2]], l = Math.hypot(dn[0], dn[1], dn[2]);
        let nn = nf;
        if (r > 0 && l > 1e-6) { nn = [dn[0] / l, dn[1] / l, dn[2] / l]; for (let q = 0; q < 3; q++) p[q] = c[q] + nn[q] * r; }
        g.vert(p, nn, color(col, p, nn), [k / n, 1 - j / n]);
      }
      for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
        const a = base + j * (n + 1) + k, b = a + n + 1;
        g.quad(a, a + 1, b + 1, b);
      }
    }
    return g;
  },
  /** A flat shape [[x, y], ...] (star-shaped about its centroid) extruded `depth` along z, centred on z = 0.
   *  colFront for both faces, colSide for the edge; `bevel` rounds the edge outward. */
  extrude(shape, depth, colFront, colSide, uvBox) {
    const g = new Geo(), n = shape.length, hz = depth / 2;
    const cx = shape.reduce((s, p) => s + p[0], 0) / n, cy = shape.reduce((s, p) => s + p[1], 0) / n;
    const uv = p => uvBox ? [(p[0] - uvBox[0]) / (uvBox[2] - uvBox[0]), 1 - (p[1] - uvBox[1]) / (uvBox[3] - uvBox[1])] : [0, 0];
    for (const side of [1, -1]) {
      const c = g.vert([cx, cy, side * hz], [0, 0, side], colFront, uv([cx, cy]));
      const ring = shape.map(p => g.vert([p[0], p[1], side * hz], [0, 0, side], colFront, uv(p)));
      for (let k = 0; k < n; k++) side > 0 ? g.tri(c, ring[k], ring[(k + 1) % n]) : g.tri(c, ring[(k + 1) % n], ring[k]);
    }
    for (let k = 0; k < n; k++) {
      const p = shape[k], q = shape[(k + 1) % n], o = norm([q[1] - p[1], -(q[0] - p[0]), 0]);
      const a = g.vert([p[0], p[1], hz], o, colSide), b = g.vert([q[0], q[1], hz], o, colSide);
      const c = g.vert([q[0], q[1], -hz], o, colSide), d = g.vert([p[0], p[1], -hz], o, colSide);
      g.quad(a, d, c, b);
    }
    return g;
  },
  /** A rounded rectangle outline as points, counterclockwise. */
  roundRect(w, h, r, seg) {
    const pts = [], hx = w / 2, hy = h / 2;
    seg = seg || 6;
    for (const [cx, cy, a0] of [[hx - r, hy - r, 0], [-hx + r, hy - r, Math.PI / 2], [-hx + r, -hy + r, Math.PI], [hx - r, -hy + r, Math.PI * 1.5]]) {
      for (let k = 0; k <= seg; k++) { const a = a0 + Math.PI / 2 * k / seg; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    }
    return pts;
  },
  /** Ground from x0..x1, z0..z1 in nx x nz cells, its height y = height(x, z), colored col(x, z, y, normal). Heights
   *  are sampled once a point; normals come from the neighbouring points. */
  terrain(x0, x1, z0, z1, nx, nz, height, col) {
    const g = new Geo(), dx = (x1 - x0) / nx, dz = (z1 - z0) / nz, Y = new Float64Array((nx + 1) * (nz + 1));
    for (let j = 0; j <= nz; j++) for (let k = 0; k <= nx; k++) Y[j * (nx + 1) + k] = height(x0 + dx * k, z0 + dz * j);
    const at = (k, j) => Y[Math.min(nz, Math.max(0, j)) * (nx + 1) + Math.min(nx, Math.max(0, k))];
    g.room((nx + 1) * (nz + 1), nx * nz * 6);
    for (let j = 0; j <= nz; j++) for (let k = 0; k <= nx; k++) {
      const x = x0 + dx * k, z = z0 + dz * j, y = at(k, j);
      const sx = (at(k + 1, j) - at(k - 1, j)) / (dx * ((k > 0) + (k < nx))), sz = (at(k, j + 1) - at(k, j - 1)) / (dz * ((j > 0) + (j < nz)));
      const n = norm([-sx, 1, -sz]);
      g.vert([x, y, z], n, color(col, x, z, y, n), [k / nx, j / nz]);
    }
    for (let j = 0; j < nz; j++) for (let k = 0; k < nx; k++) {
      const a = j * (nx + 1) + k, b = a + nx + 1;
      g.quad(a, b, b + 1, a + 1);
    }
    return g;
  },
  /** A flat strip `width` wide along points on the ground ([[x, y, z], ...]), lifted by lift; v runs along it. */
  ribbon(points, width, col, lift) {
    const g = new Geo(), n = points.length;
    let run = 0;
    for (let k = 0; k < n; k++) {
      const a = points[Math.max(0, k - 1)], b = points[Math.min(n - 1, k + 1)], p = points[k];
      const t = norm([b[0] - a[0], 0, b[2] - a[2]]), s = [t[2], 0, -t[0]];
      if (k) run += Math.hypot(p[0] - points[k - 1][0], p[2] - points[k - 1][2]);
      for (const side of [-1, 1]) g.vert([p[0] + s[0] * width / 2 * side, p[1] + (lift || 0), p[2] + s[2] * width / 2 * side], [0, 1, 0], color(col, k / (n - 1)), [side < 0 ? 0 : 1, run]);
    }
    for (let k = 0; k < n - 1; k++) g.quad(k * 2, k * 2 + 2, k * 2 + 3, k * 2 + 1);
    return g;
  },
  /** A w x h rectangle facing +z (or +y when flat), with uv over it. */
  plane(w, h, col, flat) {
    const g = new Geo(), n = flat ? [0, 1, 0] : [0, 0, 1];
    const p = (x, y) => flat ? [x, 0, -y] : [x, y, 0];
    g.vert(p(-w / 2, -h / 2), n, col, [0, 1]); g.vert(p(w / 2, -h / 2), n, col, [1, 1]);
    g.vert(p(w / 2, h / 2), n, col, [1, 0]); g.vert(p(-w / 2, h / 2), n, col, [0, 0]);
    return g.quad(0, 1, 2, 3);
  }
};

/* ---- Shaders ---- */
const VS = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec4 aColor; attribute vec2 aUV;
uniform mat4 uViewProj, uModel; uniform mat3 uNormalMat; uniform float uOutline;
varying vec3 vN, vW; varying vec4 vC; varying vec2 vUV;
void main() {
  vec3 n = normalize(uNormalMat * aNormal);
  vec4 w = uModel * vec4(aPos, 1.0);
  w.xyz += n * uOutline;
  vW = w.xyz; vN = n; vC = aColor; vUV = aUV;
  gl_Position = uViewProj * w;
}`;
const FS = `
precision mediump float;
varying vec3 vN, vW; varying vec4 vC; varying vec2 vUV;
uniform vec3 uLight, uLightColor, uSkyLight, uGroundLight, uRimColor, uEye, uFogColor, uOutlineColor, uGloss;
uniform vec4 uTint; uniform float uRim, uSpec, uShine, uGlow, uFogNear, uFogFar, uMode, uTexOn, uHaze;
uniform sampler2D uTex;
void main() {
  float fog = clamp(clamp((distance(uEye, vW) - uFogNear) / max(uFogFar - uFogNear, 0.001), 0.0, 1.0) + uHaze, 0.0, 1.0);
  if (uMode > 2.5) {                       // a soft round shadow on the ground, from its uv
    float d = length(vUV * 2.0 - 1.0);
    gl_FragColor = vec4(uTint.rgb, uTint.a * (1.0 - smoothstep(0.15, 1.0, d)) * (1.0 - fog)); return;
  }
  if (uMode > 1.5) { gl_FragColor = vec4(mix(uOutlineColor, uFogColor, fog), uTint.a); return; }   // ink outline
  vec3 base = vC.rgb * uTint.rgb;
  float a = uTint.a;
  if (uTexOn > 0.5) {
    vec4 t = texture2D(uTex, vUV);
    if (uTexOn > 1.5) { base = t.rgb * uTint.rgb; a *= t.a; }     // the texture's own alpha (a light beam)
    else base = mix(base, t.rgb * uTint.rgb, t.a);
  }
  vec3 col = base;
  if (uMode < 0.5) {                        // lit
    vec3 n = normalize(gl_FrontFacing ? vN : -vN), v = normalize(uEye - vW);
    float diff = max(dot(n, uLight), 0.0);
    vec3 amb = mix(uGroundLight, uSkyLight, n.y * 0.5 + 0.5);
    float rim = pow(1.0 - max(dot(n, v), 0.0), 2.5) * uRim;
    float spec = pow(max(dot(n, normalize(uLight + v)), 0.0), uShine) * uSpec;
    // A second, highlight-only light (a bright window to one side) for the streak along glazed things.
    float gloss = pow(max(dot(n, normalize(normalize(uGloss) + v)), 0.0), uShine * 1.5) * uSpec * step(0.001, length(uGloss));
    col = base * (amb + uLightColor * diff) + uRimColor * rim + uLightColor * spec + vec3(gloss);
  }
  col = mix(col, base * 1.15, clamp(vC.a * uGlow, 0.0, 1.0));     // glowing parts ignore the light
  gl_FragColor = vec4(mix(col, uFogColor, fog), a);
}`;
const SKY_VS = `attribute vec2 aXY; varying vec2 vXY; void main() { vXY = aXY * 0.5 + 0.5; gl_Position = vec4(aXY, 1.0, 1.0); }`;
const SKY_FS = `
precision mediump float;
varying vec2 vXY;
uniform vec3 uC0, uC1, uC2, uHalo; uniform vec2 uFrom, uTo, uHaloAt, uSize; uniform float uMid, uHaloR, uHaloA, uLines, uDither;
void main() {
  vec2 p = vec2(vXY.x, 1.0 - vXY.y) * uSize, d = (uTo - uFrom) * uSize;
  float t = clamp(dot(p - uFrom * uSize, d) / dot(d, d), 0.0, 1.0);
  vec3 c = t < uMid ? mix(uC0, uC1, t / uMid) : mix(uC1, uC2, (t - uMid) / (1.0 - uMid));
  float h = 1.0 - clamp(distance(p, uHaloAt * uSize) / max(uHaloR, 1.0), 0.0, 1.0);
  c = mix(c, uHalo, uHaloA * h * h);
  c *= 1.0 - uLines * step(0.5, fract(p.y / 4.0));
  c += (fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * uDither;
  gl_FragColor = vec4(c, 1.0);
}`;
const PTS_VS = `
attribute vec3 aPos; attribute vec3 aInfo;          // size, twinkle phase, brightness
uniform mat4 uViewProj; uniform float uTime, uScale, uTwinkle;
varying float vA;
void main() {
  gl_Position = uViewProj * vec4(aPos, 1.0);
  gl_PointSize = aInfo.x * uScale;
  vA = aInfo.z * (1.0 - uTwinkle + uTwinkle * (0.55 + 0.45 * sin(uTime * (1.2 + aInfo.y) + aInfo.y * 7.0)));
}`;
const PTS_FS = `
precision mediump float;
varying float vA; uniform vec3 uColor; uniform float uAlpha;
void main() { float d = length(gl_PointCoord * 2.0 - 1.0); gl_FragColor = vec4(uColor, uAlpha * vA * (1.0 - smoothstep(0.35, 1.0, d))); }`;

/**
 * A renderer on `canvas`: create(canvas, {preserve, alpha, antialias}) -> null when WebGL is unavailable.
 *   r.size(cssW, cssH, dpr)            the drawing buffer at device pixels; r.width, r.height in css px
 *   r.view(x, y, w, h, [unitsW, unitsH]) a letterboxed frame inside it; r.scissor([x, y, w, h] | null) within that
 *   r.mesh(geo) / r.points([[x, y, z, size, phase, brightness], ...]) / r.updatePoints(cloud, list) / r.texture(canvas|image)
 *   r.camera({eye, at, up, fov (radians), near, far, shiftX, shiftY}); r.project(point)
 *   r.light({dir, color, sky, ground, rim, fog, fogNear, fogFar, gloss (a highlight-only light's direction, or [0, 0, 0])})
 *   r.sky({...}) after the opaque things: {c0, c1, c2, mid, from: [x, y], to: [x, y] (0-1 of the frame), halo, haloAt, haloR (px), haloA, lines}
 *   r.draw(mesh, model, {tint, alpha, rim, spec, shine, glow, outline, outlineColor, tex, texAlpha, additive, haze,
 *     fogNear, fogFar, fog (false: none), fogColor, cull, unlit, blend, depthWrite, count})
 *   r.faded(alpha, () => { ...draws }) fades a many-part model as one
 *   r.shadow(model, {color, alpha}) a soft blob on the ground, r.stars(points, {color, alpha, time, twinkle, size})
 */
/** Whether a context is drawn by the CPU (SwiftShader, llvmpipe and the like), where multisampling costs as much as
 *  the picture. */
const cpuDrawn = gl => {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '');
};
// What the last context found, remembered, so a later visit to a CPU-drawn browser asks for the right context at once.
const KNOWN = 'offergl.software';
let softwareGL = null;
try { const known = localStorage.getItem(KNOWN); if (known === '0' || known === '1') softwareGL = known === '1'; } catch (e) {}
/** Whether WebGL here is drawn by the CPU, as far as a context has shown (false until one has). */
const software = () => !!softwareGL;

function create(canvas, opts) {
  opts = opts || {};
  const attrs = aa => ({antialias: aa, alpha: !!opts.alpha, depth: true, stencil: false, premultipliedAlpha: true,
    preserveDrawingBuffer: !!opts.preserve, powerPreference: 'default'});
  const context = (c, aa) => c.getContext('webgl', attrs(aa)) || c.getContext('experimental-webgl', attrs(aa));
  // Smooth edges by multisampling where a GPU does it for free. A context found to be drawn by the CPU gives way to one
  // without, on a fresh canvas in the old one's place (a context keeps the settings it was made with): r.canvas.
  let gl = context(canvas, opts.antialias == null ? softwareGL !== true : !!opts.antialias);
  if (!gl) return null;
  const cpu = cpuDrawn(gl);
  if (softwareGL !== cpu) { softwareGL = cpu; try { localStorage.setItem(KNOWN, cpu ? '1' : '0'); } catch (e) {} }
  if (cpu && opts.antialias == null && gl.getContextAttributes().antialias) {
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    const fresh = canvas.cloneNode(false);
    if (canvas.parentNode) canvas.replaceWith(fresh);
    canvas = fresh;
    gl = context(canvas, false);
    if (!gl) return null;
  }
  // Shaders are compiled and linked without waiting: asking whether that worked makes the page's thread wait for the
  // GPU's, so it is asked on a program's first use (by then usually long done), and r.ready() says, where the browser
  // can tell without waiting, whether that use would wait.
  const parallel = gl.getExtension('KHR_parallel_shader_compile');
  const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const program = (vs, fs) => {
    const p = gl.createProgram(), shaders = [compile(gl.VERTEX_SHADER, vs), compile(gl.FRAGMENT_SHADER, fs)];
    for (const sh of shaders) gl.attachShader(p, sh);
    gl.linkProgram(p);
    return {p, shaders, u: null, a: null};
  };
  const resolve = prog => {
    if (prog.u) return prog;
    const p = prog.p;
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(prog.shaders.map(sh => gl.getShaderInfoLog(sh)).join(' ') + gl.getProgramInfoLog(p));
    const u = {}, a = {};
    for (let k = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) - 1; k >= 0; k--) { const n = gl.getActiveUniform(p, k).name; u[n] = gl.getUniformLocation(p, n); }
    for (let k = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES) - 1; k >= 0; k--) { const n = gl.getActiveAttrib(p, k).name; a[n] = gl.getAttribLocation(p, n); }
    prog.u = u; prog.a = a;
    return prog;
  };
  const lit = program(VS, FS), sky = program(SKY_VS, SKY_FS), pts = program(PTS_VS, PTS_FS);
  const tri = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, tri); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS);
  const big = gl.getExtension('OES_element_index_uint');
  const white = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, white); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  let view = M.ident(), proj = M.ident(), viewProj = M.ident(), eye = [0, 0, 1], current = null, ver = 0;
  const scene = {dir: norm([-.4, .8, .45]), color: [1, 1, 1], sky: [.5, .5, .55], ground: [.35, .33, .3], rim: [.5, .55, .6], fog: [.8, .85, .9], fogNear: 1e4, fogFar: 2e4, gloss: [0, 0, 0]};
  const normalMat = new Float32Array(9), blobGeo = G.plane(1, 1, '#000000', true);
  const use = prog => { if (current !== prog) { gl.useProgram(resolve(prog).p); current = prog; } };
  // A frame is a few dozen draws that mostly share their neighbours' settings, so every uniform and switch below is
  // sent only when it changes: each GL call costs the page's thread, whatever the GPU.
  const cache = new Map();
  const changed = (loc, v, n) => {
    let c = cache.get(loc), diff = false;
    if (!c) cache.set(loc, c = new Array(n).fill(NaN));
    for (let k = 0; k < n; k++) if (c[k] !== v[k]) { c[k] = v[k]; diff = true; }
    return diff;
  };
  const f1 = (loc, x) => { if (loc && cache.get(loc) !== x) { cache.set(loc, x); gl.uniform1f(loc, x); } };
  const v2 = (loc, v) => { if (loc && changed(loc, v, 2)) gl.uniform2f(loc, v[0], v[1]); };
  const v3 = (loc, c) => { c = rgb(c); if (loc && changed(loc, c, 3)) gl.uniform3f(loc, c[0], c[1], c[2]); };
  const v4 = (loc, v) => { if (loc && changed(loc, v, 4)) gl.uniform4f(loc, v[0], v[1], v[2], v[3]); };
  const m3 = (loc, m) => { if (loc && changed(loc, m, 9)) gl.uniformMatrix3fv(loc, false, m); };
  const m4 = (loc, m) => { if (loc && changed(loc, m, 16)) gl.uniformMatrix4fv(loc, false, m); };
  const st = {};
  const blending = (on, add) => {
    if (st.blend !== on) { if (on) gl.enable(gl.BLEND); else gl.disable(gl.BLEND); st.blend = on; }
    if (on && st.add !== !!add) { st.add = !!add; gl.blendFunc(gl.SRC_ALPHA, add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); }
  };
  const depth = (write, func) => {
    if (st.write !== write) { gl.depthMask(write); st.write = write; }
    if (st.func !== func) { gl.depthFunc(func); st.func = func; }
  };
  const culling = face => {
    if (st.cull !== !!face) { if (face) gl.enable(gl.CULL_FACE); else gl.disable(gl.CULL_FACE); st.cull = !!face; }
    if (face && st.face !== face) { gl.cullFace(face); st.face = face; }
  };
  const bindTex = t => { if (st.tex !== t) { gl.bindTexture(gl.TEXTURE_2D, t); st.tex = t; } };
  // Vertex array objects keep each mesh's attribute layout, so a draw binds one thing (WebGL 1 has them nearly
  // everywhere; without them the layout is set on each draw).
  const vao = gl.getExtension('OES_vertex_array_object');
  const layout = (mesh) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    for (const [name, n, off] of [['aPos', 3, 0], ['aNormal', 3, 3], ['aColor', 4, 6], ['aUV', 2, 10]]) {
      const at = resolve(lit).a[name];
      if (at >= 0) { gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, n, gl.FLOAT, false, STRIDE * 4, off * 4); }
    }
  };
  let bound = null;
  const bindMesh = mesh => {
    if (bound === mesh) return;
    bound = mesh;
    if (vao && mesh && mesh.vao) vao.bindVertexArrayOES(mesh.vao);
    else { if (vao) vao.bindVertexArrayOES(null); if (mesh) layout(mesh); }
  };
  gl.activeTexture(gl.TEXTURE0);
  const r = {
    gl, canvas, width: 0, height: 0, dpr: 1, unit: 1, M, G,
    /** Whether the shaders are ready, so a first draw would not wait for them (always, where the browser cannot say). */
    software: cpu, parallel: !!parallel,
    ready: () => !parallel || [lit, sky, pts].every(prog => prog.u || gl.getProgramParameter(prog.p, parallel.COMPLETION_STATUS_KHR)),
    size(w, h, dpr) {
      r.width = w; r.height = h; r.dpr = r.unit = dpr = dpr || 1;
      const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      gl.viewport(0, 0, pw, ph); gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, pw, ph);
      r.vp = [0, 0, pw, ph];
    },
    /** Draws into the rectangle (x, y, w, h) of the canvas, in css px from its top-left (a letterboxed frame): the
     *  viewport, a scissor, and the camera's aspect follow it until the next size() or view(). `units` ([w, h]) gives
     *  the frame its own measure (a film composed at 1920 x 1080 shown smaller): r.width, r.height, the sky's halo,
     *  point sizes, scissors and project() then work in it. */
    view(x, y, w, h, units) {
      const d = r.dpr, px = Math.round(x * d), pw = Math.round(w * d), ph = Math.round(h * d), py = canvas.height - Math.round(y * d) - ph;
      r.width = units ? units[0] : w; r.height = units ? units[1] : h; r.unit = pw / Math.max(1, r.width); r.vp = [px, py, pw, ph];
      gl.viewport(px, py, pw, ph); gl.enable(gl.SCISSOR_TEST); gl.scissor(px, py, pw, ph);
    },
    /** Draws a group of things (fn draws them) at `alpha` as one: first their depth alone, then their colors over
     *  only the nearest surface, so a model of many overlapping parts fades without showing its insides. */
    faded(alpha, fn) {
      if (alpha >= 1) return fn();
      if (alpha <= 0) return;
      gl.colorMask(false, false, false, false); r._pass = 'depth'; fn();
      gl.colorMask(true, true, true, true); r._pass = 'color'; r._fade = alpha; fn();
      r._pass = null; r._fade = 1;
    },
    _fade: 1, _pass: null,
    /** Limits drawing to [x, y, w, h] of the current view, in css px from its top-left; scissor(null) lifts it. */
    scissor(rect) {
      const [vx, vy, vw, vh] = r.vp, k = vw / Math.max(1, r.width);
      if (!rect) { gl.scissor(vx, vy, vw, vh); return; }
      const x0 = Math.max(0, Math.round(rect[0] * k)), x1 = Math.min(vw, Math.round((rect[0] + rect[2]) * k));
      const y0 = Math.max(0, Math.round(rect[1] * k)), y1 = Math.min(vh, Math.round((rect[1] + rect[3]) * k));
      gl.scissor(vx + x0, vy + vh - y1, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
    },
    mesh(geo) {
      const vbo = gl.createBuffer(), ibo = gl.createBuffer(), wide = geo.count > 65535;
      if (wide && !big) throw Error('mesh too large');
      const mesh = {vbo, ibo, count: geo.i.length, type: wide ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, vao: null};
      if (vao) { mesh.vao = vao.createVertexArrayOES(); vao.bindVertexArrayOES(mesh.vao); bound = mesh; }
      else bindMesh(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, geo.v, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, wide ? geo.i : new Uint16Array(geo.i), gl.STATIC_DRAW);
      if (vao) layout(mesh);
      bindMesh(null);
      return mesh;
    },
    points(list) {
      const data = new Float32Array(list.length * 6);
      list.forEach((p, k) => data.set([p[0], p[1], p[2], p[3] || 1, p[4] || 0, p[5] == null ? 1 : p[5]], k * 6));
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return {vbo, count: list.length};
    },
    /** Replaces a point cloud's points (the same count or fewer), for things that drift every frame. */
    updatePoints(cloud, list) {
      const data = cloud.data && cloud.data.length >= list.length * 6 ? cloud.data : (cloud.data = new Float32Array(list.length * 6));
      list.forEach((p, k) => data.set([p[0], p[1], p[2], p[3] || 1, p[4] || 0, p[5] == null ? 1 : p[5]], k * 6));
      gl.bindBuffer(gl.ARRAY_BUFFER, cloud.vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      cloud.count = list.length;
      return cloud;
    },
    /** Frees a mesh's or a cloud's buffers. */
    free(m) {
      if (!m) return;
      if (bound === m) bindMesh(null);
      if (m.vao) vao.deleteVertexArrayOES(m.vao);
      if (m.vbo) gl.deleteBuffer(m.vbo);
      if (m.ibo) gl.deleteBuffer(m.ibo);
    },
    /** A texture from a canvas or image; `mip` mipmaps it (its sides must be powers of two) for drawing much smaller. */
    texture(source, smooth, mip) {
      const t = gl.createTexture();
      bindTex(t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      const pow2 = n => (n & (n - 1)) === 0;
      mip = mip && pow2(source.width) && pow2(source.height);
      if (mip) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : smooth === false ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, smooth === false ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    },
    camera(c) {
      eye = c.eye;
      view = M.lookAt(c.eye, c.at, c.up || [0, 1, 0]);
      proj = M.perspective(c.fov || .7, r.width / Math.max(1, r.height), c.near || .1, c.far || 500, c.shiftX, c.shiftY);
      viewProj = M.mul(proj, view); ver++;
      return viewProj;
    },
    /** Where world point p lands, in css px of the frame: [x, y, depth]. */
    project(p) {
      const q = M.apply(viewProj, p);
      return [(q[0] * .5 + .5) * r.width, (.5 - q[1] * .5) * r.height, q[2]];
    },
    light(s) { Object.assign(scene, s); if (s.dir) scene.dir = norm(s.dir); ver++; },
    clear(c, a) {
      c = rgb(c || '#000000');
      depth(true, gl.LESS);
      gl.clearColor(c[0], c[1], c[2], a == null ? 1 : a); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    sky(s) {
      use(sky);
      // Drawn after the opaque scenery, the sky fills only what nothing else covered (depth still clear).
      depth(false, gl.LEQUAL); blending(false); culling(null); bindMesh(null);
      const u = sky.u;
      v3(u.uC0, s.c0); v3(u.uC1, s.c1); v3(u.uC2, s.c2); v3(u.uHalo, s.halo || s.c1);
      v2(u.uFrom, s.from || [0, 0]); v2(u.uTo, s.to || [0, 1]); v2(u.uHaloAt, s.haloAt || [.5, .5]); v2(u.uSize, [r.width, r.height]);
      f1(u.uMid, s.mid == null ? .5 : s.mid); f1(u.uHaloR, s.haloR || 0); f1(u.uHaloA, s.haloA || 0);
      f1(u.uLines, s.lines || 0); f1(u.uDither, 1.5 / 255);
      gl.bindBuffer(gl.ARRAY_BUFFER, tri);
      gl.enableVertexAttribArray(sky.a.aXY); gl.vertexAttribPointer(sky.a.aXY, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disableVertexAttribArray(sky.a.aXY);
    },
    draw(mesh, model, m) {
      m = m || {};
      // Inside faded(): the depth pass writes depth only; the color pass blends onto the surfaces it found.
      const pass = r._pass;
      if (pass === 'depth' && (m.additive || m.texAlpha)) return;
      use(lit);
      const u = lit.u;
      if (lit.ver !== ver) {
        m4(u.uViewProj, viewProj); v3(u.uEye, eye); v3(u.uLight, scene.dir); v3(u.uLightColor, scene.color);
        v3(u.uSkyLight, scene.sky); v3(u.uGroundLight, scene.ground); v3(u.uRimColor, scene.rim); v3(u.uGloss, scene.gloss);
        lit.ver = ver;
      }
      m4(u.uModel, model); m3(u.uNormalMat, M.normal(model, normalMat));
      v3(u.uFogColor, m.fogColor || scene.fog);
      f1(u.uFogNear, m.fog === false ? 1e9 : m.fogNear != null ? m.fogNear : scene.fogNear);
      f1(u.uFogFar, m.fog === false ? 2e9 : m.fogFar != null ? m.fogFar : scene.fogFar);
      const tint = rgb(m.tint || '#ffffff'), alpha = (m.alpha == null ? 1 : m.alpha) * r._fade;
      v4(u.uTint, [tint[0], tint[1], tint[2], alpha]);
      f1(u.uRim, m.rim == null ? .35 : m.rim); f1(u.uSpec, m.spec == null ? .18 : m.spec);
      f1(u.uShine, m.shine || 28); f1(u.uGlow, m.glow == null ? 1 : m.glow);
      f1(u.uMode, m.mode || (m.unlit ? 1 : 0)); f1(u.uOutline, 0);
      bindTex(m.tex || white); f1(u.uTexOn, m.tex ? (m.texAlpha ? 2 : 1) : 0); f1(u.uHaze, m.haze || 0);
      const blend = pass === 'depth' ? false : !!(m.blend || m.texAlpha || alpha < 1);
      blending(blend, m.additive);
      depth(pass === 'depth' ? true : pass === 'color' ? false : m.depthWrite != null ? m.depthWrite : !blend, pass === 'color' ? gl.LEQUAL : gl.LESS);
      bindMesh(mesh);
      const cull = m.cull === undefined ? 'back' : m.cull;
      culling(cull ? (cull === 'front' ? gl.FRONT : gl.BACK) : null);
      const count = m.count == null ? mesh.count : Math.max(0, Math.min(mesh.count, m.count - m.count % 3));
      gl.drawElements(gl.TRIANGLES, count, mesh.type, 0);
      // The ink outline: the mesh again, swollen along its normals, only its inside faces showing.
      if (m.outline) {
        f1(u.uOutline, m.outline); f1(u.uMode, 2); v3(u.uOutlineColor, m.outlineColor || '#203a66');
        culling(gl.FRONT);
        gl.drawElements(gl.TRIANGLES, count, mesh.type, 0);
      }
    },
    /** A soft round shadow: a flat unit square under the model's transform (scale it to the shadow's size). */
    shadow(model, m) {
      if (!r._blob) r._blob = r.mesh(blobGeo);
      r.draw(r._blob, model, {mode: 3, tint: m && m.color || '#000000', alpha: m && m.alpha != null ? m.alpha : .25, cull: false, blend: true, depthWrite: false});
    },
    stars(cloud, s) {
      use(pts);
      const u = pts.u, a = pts.a;
      m4(u.uViewProj, viewProj);
      f1(u.uTime, s.time || 0); f1(u.uScale, (s.size || 1) * r.unit); f1(u.uTwinkle, s.twinkle == null ? 1 : s.twinkle);
      v3(u.uColor, s.color || '#ffffff'); f1(u.uAlpha, s.alpha == null ? 1 : s.alpha);
      blending(true, false); depth(false, gl.LESS); bindMesh(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, cloud.vbo);
      gl.enableVertexAttribArray(a.aPos); gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(a.aInfo); gl.vertexAttribPointer(a.aInfo, 3, gl.FLOAT, false, 24, 12);
      gl.drawArrays(gl.POINTS, 0, cloud.count);
      gl.disableVertexAttribArray(a.aPos); gl.disableVertexAttribArray(a.aInfo);
    },
    /** Ends a frame: the default attribute layout left clean for whatever draws next. */
    done() { if (!vao) for (let k = 0; k < 4; k++) gl.disableVertexAttribArray(k); bindMesh(null); }
  };
  return r;
}

root.OfferGL = {M, G, rgb, mix: mixc, create, software};
})(typeof window !== 'undefined' ? window : globalThis);
