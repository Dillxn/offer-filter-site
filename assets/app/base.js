/* Shared helpers for the canvas ports of the Offer Filter app's views (its Java onDraw code, Dillxn/dasher-offer-filter).
 * Units are dp: callers scale the context so 1 unit = 1 dp; sp is treated as dp. Colors stay Android ARGB ints
 * (0xAARRGGBB, as in the Java) until painted with U.css(). Deterministic: animations take explicit time t (seconds). */
(function(root) {
'use strict';
const App = root.OfferApp = root.OfferApp || {};
const U = App.util = {};
const cache = new Map();
U.css = c => {
  c = c >>> 0;
  let s = cache.get(c);
  if (!s) { s = `rgba(${(c >>> 16) & 255},${(c >>> 8) & 255},${c & 255},${+(((c >>> 24) & 255) / 255).toFixed(4)})`; cache.set(c, s); }
  return s;
};
U.alphaOf = c => (c >>> 24) & 255;
/** Android Color.argb / the "(alpha << 24) | (color & 0xFFFFFF)" idiom. */
U.withAlpha = (c, a255) => (((Math.max(0, Math.min(255, Math.round(a255))) << 24) | (c & 0xFFFFFF)) >>> 0);
U.argb = (a, r, g, b) => (((a & 255) << 24) | ((r & 255) << 16) | ((g & 255) << 8) | (b & 255)) >>> 0;
/** androidx ColorUtils.blendARGB: each channel (alpha included) mixed by ratio. */
U.blend = (c1, c2, t) => {
  const ch = (c, s) => (c >>> s) & 255, m = s => Math.round(ch(c1, s) * (1 - t) + ch(c2, s) * t);
  return U.argb(m(24), m(16), m(8), m(0));
};
/** One palette per theme, exactly as Ui.java. */
U.palette = dark => ({
  dark,
  page: dark ? 0xFF0D0D0D : 0xFFF1F0EC,
  surface: dark ? 0xFF1A1A19 : 0xFFFCFCFB,
  border: dark ? 0x1AFFFFFF : 0x1A0B0B0B,
  ink: dark ? 0xFFFFFFFF : 0xFF0B0B0B,
  inkSecondary: dark ? 0xFFC3C2B7 : 0xFF52514E,
  inkMuted: 0xFF898781,
  gridline: dark ? 0xFF2C2C2A : 0xFFE1E0D9,
  baseline: dark ? 0xFF383835 : 0xFFC3C2B7,
  accent: 0xFF256ABF,
  link: dark ? 0xFF8AB4F0 : 0xFF1D5499,
  learned: dark ? 0xFFB08CF0 : 0xFF7A4CC8,
  onAccent: 0xFFFFFFFF,
  selectionWash: dark ? 0xFF262625 : 0xFFF1F0EC,
  GOOD: 0xFF0CA30C, WARNING: 0xFFFAB219, CRITICAL: 0xFFD03B3B, NEUTRAL: 0xFF7D7A74
});
/** The app draws in the system sans (Roboto); Ui.MEDIUM is sans-serif-medium (Roboto 500). */
U.FAMILY = 'Roboto, "Atkinson Hyperlegible", sans-serif';
U.font = (size, medium, bold) => `${bold ? 700 : medium ? 500 : 400} ${size}px ${U.FAMILY}`;
/** Paint.FontMetrics for Roboto (hhea): ascent is negative, as on Android. */
U.metrics = size => ({ascent: -0.927734 * size, descent: 0.244141 * size, top: -1.056641 * size, bottom: 0.270996 * size});
U.lineHeight = size => (0.927734 + 0.244141) * size;
U.rad = d => d * Math.PI / 180;
/** canvas.drawArc(oval, start, sweep, false, paint) as a path (degrees, clockwise like Android). */
U.arcPath = (ctx, cx, cy, rx, ry, start, sweep) => {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0, rx), Math.max(0, ry), 0, U.rad(start), U.rad(start + sweep), sweep < 0);
};
U.rrect = (ctx, l, t, r, b, rx, ry) => {
  ctx.beginPath();
  const w = r - l, h = b - t;
  rx = Math.max(0, Math.min(rx, w / 2)); ry = Math.max(0, Math.min(ry == null ? rx : ry, h / 2));
  if (rx === ry) { ctx.roundRect(l, t, w, h, rx); return; }
  ctx.ellipse(l + rx, t + ry, rx, ry, 0, Math.PI, Math.PI * 1.5);
  ctx.lineTo(r - rx, t); ctx.ellipse(r - rx, t + ry, rx, ry, 0, Math.PI * 1.5, Math.PI * 2);
  ctx.lineTo(r, b - ry); ctx.ellipse(r - rx, b - ry, rx, ry, 0, 0, Math.PI / 2);
  ctx.lineTo(l + rx, b); ctx.ellipse(l + rx, b - ry, rx, ry, 0, Math.PI / 2, Math.PI);
  ctx.closePath();
};
/** java.util.Random, bit for bit (BigInt), for the app's seeded scatters. */
U.javaRandom = seed => {
  const M = (1n << 48n) - 1n, MUL = 0x5DEECE66Dn;
  let s = (BigInt(seed) ^ MUL) & M;
  const next = bits => { s = (s * MUL + 0xBn) & M; let v = Number(s >> BigInt(48 - bits)); if (bits === 32 && v >= 2 ** 31) v -= 2 ** 32; return v; };
  return {
    nextFloat: () => next(24) / (1 << 24),
    nextDouble: () => (next(26) * 2 ** 27 + next(27)) / 2 ** 53,
    nextInt: n => {
      if (n === undefined) return next(32);
      if ((n & -n) === n) return Number((BigInt(n) * BigInt(next(31))) >> 31n);
      let bits, val;
      do { bits = next(31); val = bits % n; } while (bits - val + (n - 1) < 0 || bits - val + (n - 1) >= 2 ** 31);
      return val;
    },
    nextBoolean: () => next(1) !== 0
  };
};
U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
U.lerp = (a, b, t) => a + (b - a) * t;

/** A scratch canvas w x h px, or null where none can be made. In a page it is a canvas element; the film renderer
 *  sets its own (OfferApp.util.makeCanvas = createCanvas) before drawing. */
U.makeCanvas = typeof document !== 'undefined'
  ? (w, h) => Object.assign(document.createElement('canvas'), {width: w, height: h}) : null;
/**
 * canvas.saveLayer: an offscreen layer over (0, 0)-(w, h) of ctx's current transform, at the device pixels it covers.
 * Returns {ctx, done()}: draw into ctx, then done() composites the layer back at the caller's alpha and clip. Null when
 * no canvas can be made or the transform turns or skews, so the caller draws another way. One layer at a time.
 */
let scratch = null;
U.layer = (ctx, w, h) => {
  const m = ctx.getTransform();
  if (!U.makeCanvas || m.b || m.c || m.a <= 0 || m.d <= 0) return null;
  const left = Math.floor(m.e), top = Math.floor(m.f);
  const pw = Math.ceil(w * m.a + m.e - left) + 1, ph = Math.ceil(h * m.d + m.f - top) + 1;
  if (pw > 4096 || ph > 4096) return null;
  if (!scratch || scratch.width < pw || scratch.height < ph) {
    scratch = U.makeCanvas(Math.max(pw, scratch ? scratch.width : 0), Math.max(ph, scratch ? scratch.height : 0));
  }
  const layer = scratch.getContext('2d');
  layer.setTransform(1, 0, 0, 1, 0, 0);
  layer.globalAlpha = 1; layer.globalCompositeOperation = 'source-over';
  layer.clearRect(0, 0, pw, ph);
  layer.setTransform(m.a, 0, 0, m.d, m.e - left, m.f - top);
  return {ctx: layer, done() {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(scratch, 0, 0, pw, ph, left, top, pw, ph);
    ctx.restore();
  }};
};
})(typeof window !== 'undefined' ? window : globalThis);
