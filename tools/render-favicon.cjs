#!/usr/bin/env node
/* Reuse the same brand mascot as the wordmark; never maintain a second drawing. */
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas, Path2D, SvgExportFlag } = require('@napi-rs/canvas');
global.Path2D = Path2D;
require('../assets/brand.js');
const { OfferArt: A } = global;
const assets = path.resolve(__dirname, '../assets');
function draw(canvas, touchIcon = false) {
  const ctx = canvas.getContext('2d');
  ctx.scale(canvas.width / 128, canvas.height / 128);
  // Browser tabs should show only the mascot, with real alpha around it.
  // Keep the home-screen icon's existing tile separate from the favicon.
  if (touchIcon) {
    ctx.fillStyle = '#EFE9DB';
    A.roundRect(ctx, 0, 0, 128, 128, 28); ctx.fill();
  }
  A.mascot(ctx, 64, 55, .86, { mood: 'happy', wave: 7, dark: false });
}
const svg = createCanvas(128, 128, SvgExportFlag.NoPrettyXML);
draw(svg);
// The exporter tessellates curves; two decimal places retain subpixel fidelity.
const svgMarkup = svg.getContent().toString().replace('width="128" height="128"', 'width="128" height="128" viewBox="0 0 128 128"').replace(/-?\d+\.\d{3,}/g, n => String(Number(Number(n).toFixed(2))));
fs.writeFileSync(path.join(assets, 'favicon.svg'), svgMarkup);
for (const size of [16, 32, 180]) {
  const canvas = createCanvas(size, size); draw(canvas, size === 180);
  fs.writeFileSync(path.join(assets, size === 180 ? 'apple-touch-icon.png' : `favicon-${size}.png`), canvas.toBuffer('image/png'));
}
