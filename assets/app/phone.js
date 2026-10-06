/* The phone the film holds the app in: a frame around a 412 x 915 dp screen, Android's status bar and gesture
 * handle, a heads-up notification card, the app's bottom sheet, and a touch indicator like Android's "Show taps".
 * Units are dp, as in the app's own ports (OfferApp.util). */
(function(root) {
'use strict';
const App = root.OfferApp = root.OfferApp || {};
const U = App.util;
const W = 412, H = 915, BEZEL = 11, OUTER = 54, INNER = 44, STATUS = 36, NAV = 22;
const phone = App.phone = {W, H, BEZEL, STATUS, NAV, outer: {left: -BEZEL, top: -BEZEL, right: W + BEZEL, bottom: H + BEZEL}};

/** The body, its rim and the side keys; then the caller draws the screen inside clip() and finishes with lens(). */
phone.body = (ctx, light) => {
  ctx.save();
  ctx.shadowColor = 'rgba(4,10,22,.45)'; ctx.shadowBlur = 60 * Math.hypot(ctx.getTransform().a, ctx.getTransform().b); ctx.shadowOffsetY = 26 * Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
  U.rrect(ctx, -BEZEL, -BEZEL, W + BEZEL, H + BEZEL, OUTER);
  ctx.fillStyle = '#121418'; ctx.fill();
  ctx.shadowColor = 'transparent';
  // A brushed rim: lighter at the top-left, as if lit from the sky.
  const rim = ctx.createLinearGradient(-BEZEL, -BEZEL, W + BEZEL, H + BEZEL);
  rim.addColorStop(0, light ? '#9aa3b2' : '#5d6574'); rim.addColorStop(.5, '#272b33'); rim.addColorStop(1, light ? '#6c7380' : '#3a404b');
  ctx.lineWidth = 2.2; ctx.strokeStyle = rim; ctx.stroke();
  // Volume and power keys on the right edge.
  ctx.fillStyle = '#2a2e36';
  for (const [y, h] of [[170, 64], [252, 96]]) { U.rrect(ctx, W + BEZEL - 1, y, W + BEZEL + 3, y + h, 1.5); ctx.fill(); }
  ctx.restore();
};
/** Clip to the screen's rounded rectangle (save before, restore after). */
phone.clip = ctx => { U.rrect(ctx, 0, 0, W, H, INNER); ctx.clip(); };
/** The punch-hole camera over the screen. */
phone.lens = ctx => {
  ctx.save();
  ctx.beginPath(); ctx.arc(W / 2, 18, 6.2, 0, Math.PI * 2); ctx.fillStyle = '#050608'; ctx.fill();
  ctx.beginPath(); ctx.arc(W / 2 - 1.6, 16.6, 1.6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(90,110,150,.55)'; ctx.fill();
  ctx.restore();
};

/** Android's status bar: the time on the left, signal, Wi-Fi and battery on the right, in light or dark ink. */
phone.statusBar = (ctx, darkIcons, time) => {
  const ink = darkIcons ? 'rgba(24,26,30,.92)' : 'rgba(255,255,255,.95)';
  ctx.save();
  ctx.fillStyle = ink; ctx.strokeStyle = ink;
  ctx.font = U.font(14, true); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(time || '9:41', 26, 25);
  // Battery: an outlined body with its charge, and a nub.
  const bx = W - 46, by = 13.5;
  U.rrect(ctx, bx, by, bx + 21, by + 11, 3); ctx.lineWidth = 1.4; ctx.globalAlpha = .55; ctx.stroke(); ctx.globalAlpha = 1;
  U.rrect(ctx, bx + 2, by + 2, bx + 2 + 13.5, by + 9, 1.6); ctx.fill();
  U.rrect(ctx, bx + 21.6, by + 3.6, bx + 23.2, by + 7.4, .8); ctx.globalAlpha = .55; ctx.fill(); ctx.globalAlpha = 1;
  // Wi-Fi: three arcs over a dot.
  const wx = W - 70, wy = 24;
  ctx.lineCap = 'round'; ctx.lineWidth = 1.9;
  for (const r of [4.2, 7.6, 11]) { ctx.beginPath(); ctx.arc(wx, wy, r, -Math.PI * .76, -Math.PI * .24); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(wx, wy - .4, 1.4, 0, Math.PI * 2); ctx.fill();
  // Signal: four rising bars.
  for (let i = 0; i < 4; i++) { const h = 3.5 + i * 2.6; U.rrect(ctx, W - 104 + i * 4.4, 24.5 - h, W - 104 + i * 4.4 + 2.8, 24.5, .8); ctx.fill(); }
  ctx.restore();
};
/** The gesture handle along the bottom. */
phone.handle = (ctx, darkIcons) => {
  ctx.save(); U.rrect(ctx, W / 2 - 54, H - 11, W / 2 + 54, H - 7, 2);
  ctx.fillStyle = darkIcons ? 'rgba(20,22,26,.42)' : 'rgba(255,255,255,.62)'; ctx.fill(); ctx.restore();
};

/** The app's status-bar icon (res/drawable/ic_notification.xml), filled in `color`, 24 dp design at `size`. */
const FUNNEL = 'M3.6,3.5 L20.4,3.5 Q21.6,3.5 20.8,4.4 L14,12.6 L14,19.2 Q14,19.8 13.4,20.1 L10.9,21.4 Q10,21.8 10,20.8 L10,12.6 L3.2,4.4 Q2.4,3.5 3.6,3.5 Z';
let funnelPath = null;
phone.funnel = (ctx, x, y, size, color) => {
  if (!funnelPath) funnelPath = new Path2D(FUNNEL);
  ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color; ctx.fill(funnelPath); ctx.restore();
};

/** Shortens `text` with an ellipsis to fit `width` at the context's current font. */
function fit(ctx, text, width) {
  if (ctx.measureText(text).width <= width) return text;
  let lo = 0, hi = text.length;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (ctx.measureText(text.slice(0, mid) + '…').width <= width) lo = mid; else hi = mid; }
  return text.slice(0, lo).trimEnd() + '…';
}
/** Wraps `text` into at most `lines` lines of `width`, the last one ellipsized. */
function wrap(ctx, text, width, lines) {
  const words = text.split(' '), out = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(next).width <= width || !line) { line = next; continue; }
    if (out.length === lines - 1) { out.push(fit(ctx, words.slice(i - line.split(' ').length).join(' '), width)); return out; }
    out.push(line); line = words[i];
  }
  if (line) out.push(out.length === lines - 1 ? fit(ctx, line, width) : line);
  return out.slice(0, lines);
}
phone.fit = fit;
phone.wrap = wrap;

/**
 * A heads-up notification as Android draws one for the app's passing alert (OfferAlerts.notifyOffer): the small icon
 * in the accent circle, "Offer Filter · now", the title and the first lines of the body. `show` 0..1 slides it in.
 */
phone.notification = (ctx, dark, state) => {
  const show = U.clamp(state.show, 0, 1);
  if (show <= 0) return;
  const left = 8, right = W - 8, top = STATUS + 4 - (1 - show) * 130, height = 112;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, show * 1.6);
  const k = Math.hypot(ctx.getTransform().a, ctx.getTransform().b);
  ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 18 * k; ctx.shadowOffsetY = 6 * k;
  U.rrect(ctx, left, top, right, top + height, 26);
  ctx.fillStyle = dark ? '#2C2D31' : '#F4F3F7'; ctx.fill();
  ctx.shadowColor = 'transparent';
  const ink = dark ? '#E6E5EA' : '#1B1B1F', soft = dark ? '#B4B3BA' : '#5E5D66';
  ctx.beginPath(); ctx.arc(left + 32, top + 34, 17, 0, Math.PI * 2); ctx.fillStyle = U.css(0xFF256ABF); ctx.fill();
  phone.funnel(ctx, left + 32, top + 34.5, 20, '#FFFFFF');
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = U.font(12.5, false); ctx.fillStyle = soft;
  ctx.fillText('Offer Filter · now', left + 60, top + 26);
  ctx.font = U.font(15, true); ctx.fillStyle = ink;
  ctx.fillText(fit(ctx, state.title, right - left - 84), left + 60, top + 48);
  ctx.font = U.font(14, false); ctx.fillStyle = soft;
  wrap(ctx, state.body, right - left - 84, 3).forEach((l, i) => ctx.fillText(l, left + 60, top + 69 + i * 19));
  // The expand chevron.
  ctx.strokeStyle = soft; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(right - 30, top + 22); ctx.lineTo(right - 25, top + 27); ctx.lineTo(right - 20, top + 22); ctx.stroke();
  ctx.restore();
};

/**
 * The app's bottom sheet (MainActivity.buildSheet/openSheet): the page dims, and a page-colored card with 24 dp top
 * corners and a handle rises 120 dp over 220 ms. `open` 0..1; draws the content via `body(ctx, left, top, width)`
 * and returns nothing. `height` is the card's height in dp.
 */
phone.sheet = (ctx, ui, open, height, body) => {
  if (open <= 0) return;
  ctx.save();
  ctx.globalAlpha *= U.clamp(open * 1.4, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, W, H);
  const top = H - height + (1 - open) * 120;
  ctx.beginPath(); ctx.moveTo(0, top + 24); ctx.arcTo(0, top, 24, top, 24); ctx.lineTo(W - 24, top); ctx.arcTo(W, top, W, top + 24, 24);
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
  ctx.fillStyle = U.css(ui.page); ctx.fill();
  U.rrect(ctx, W / 2 - 18, top + 10, W / 2 + 18, top + 14, 2); ctx.fillStyle = U.css(ui.baseline); ctx.fill();
  body(ctx, 16, top + 24, W - 32);
  ctx.restore();
};

/** A touch like Android's "Show taps": a soft disc that swells as the finger lands and fades as it lifts. */
phone.touch = (ctx, x, y, press) => {
  if (press <= 0) return;
  ctx.save();
  ctx.globalAlpha *= U.clamp(press, 0, 1);
  const r = 17 + 5 * (1 - U.clamp(press, 0, 1));
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.34)'; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.stroke();
  ctx.restore();
};
})(typeof window !== 'undefined' ? window : globalThis);
