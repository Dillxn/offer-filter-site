/*
 * Offer Filter's look, drawn on a canvas: the sky, the ensō, the glazed funnel mascot, offer tickets, the
 * constellation of minimums, the skyline of offers and the road. A port of the app's own drawing (FilterHeroView,
 * Mascot, MinimumsStarView, DecisionChartView, ScenePage), used by the website and the video's animatic, so every
 * frame matches the app. Units: the mascot and constellation are drawn in the app's dp, scaled by `s`.
 */
(function (root) {
  'use strict';
  const C = {
    accent: '#256ABF', good: '#0CA30C', bad: '#D03B3B', warn: '#FAB219', neutral: '#7D7A74',
    learned: '#7A4CC8', ink: '#0B0B0B', surface: '#FCFCFB', page: '#F1F0EC', cheek: 'rgba(242,139,139,0.40)',
    tongue: '#F07A7A', baseline: '#C3C2B7', inkSoft: '#52514E',
  };
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    out: t => 1 - Math.pow(1 - clamp(t, 0, 1), 3),
    inOut: t => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    back: t => { t = clamp(t, 0, 1); const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    in: t => Math.pow(clamp(t, 0, 1), 2),
  };
  function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) {
    const x = hex(a), y = hex(b);
    return 'rgb(' + x.map((v, i) => Math.round(lerp(v, y[i], t))).join(',') + ')';
  }
  function rgba(h, a) { const x = hex(h); return 'rgba(' + x.join(',') + ',' + a + ')'; }
  function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  /** The sky: morning (night 0) to night (night 1), with the app's gradients; stars fade in at night. */
  function sky(ctx, w, h, night, t) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, mix('#D4E4F4', '#070B16', night));
    g.addColorStop(0.55, mix('#E7EEF2', '#0D1428', night));
    g.addColorStop(1, mix('#F6E7D2', '#1C1B34', night));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // Dawn and dusk: a warm glow along the horizon while the sky turns.
    const glow = Math.sin(Math.PI * clamp(night, 0, 1)) * 0.75;
    if (glow > 0.02) {
      const d = ctx.createLinearGradient(0, h * 0.35, 0, h);
      d.addColorStop(0, 'rgba(255,190,140,0)'); d.addColorStop(0.7, 'rgba(255,178,122,' + glow * 0.55 + ')');
      d.addColorStop(1, 'rgba(255,214,160,' + glow * 0.7 + ')');
      ctx.fillStyle = d; ctx.fillRect(0, 0, w, h);
    }
    if (night > 0.05) {
      const r = rnd(7);
      for (let i = 0; i < 140; i++) {
        const x = r() * w, y = r() * h * 0.75, z = r();
        const tw = 0.55 + 0.45 * Math.sin((t || 0) * (1.2 + z * 2) + i);
        ctx.fillStyle = 'rgba(233,226,200,' + (night * tw * (0.25 + 0.6 * z)) + ')';
        ctx.beginPath(); ctx.arc(x, y, 0.6 + z * 1.6, 0, TAU); ctx.fill();
      }
    }
  }

  /** A sun (day) or a moon (night). */
  function sunMoon(ctx, x, y, r, night) {
    ctx.save();
    if (night < 0.5) {
      const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.4);
      g.addColorStop(0, 'rgba(255,227,160,0.55)'); g.addColorStop(1, 'rgba(255,227,160,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#F8C85A'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    } else {
      ctx.fillStyle = '#F3E6C8'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(x + r * 0.45, y - r * 0.2, r * 0.92, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /** The brush-drawn ring, drawn {@code progress} of the way round (0–1), its stroke swelling and tapering. */
  function enso(ctx, cx, cy, r, progress, color, width) {
    const sweep = TAU * 0.9 * clamp(progress, 0, 1), start = -Math.PI * 0.62, steps = 90;
    ctx.save(); ctx.strokeStyle = color; ctx.lineCap = 'round';
    for (let i = 0; i < steps; i++) {
      const a0 = start + sweep * i / steps, a1 = start + sweep * (i + 1) / steps, p = i / steps;
      ctx.lineWidth = width * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, p * 1.15 + 0.05)));
      ctx.beginPath(); ctx.arc(cx, cy, r + Math.sin(p * 9) * width * 0.08, a0, a1 + 0.004); ctx.stroke();
    }
    ctx.restore();
  }

  /** The mascot's face (Mascot.face), {@code size} across, centred at (x, y). */
  function face(ctx, mood, x, y, size, ink) {
    const u = size / 28, eyeY = y - 3 * u, eyeX = 6.5 * u;
    ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = ink; ctx.lineWidth = Math.max(1, 1.8 * u);
    if (mood !== 'idle') {
      for (const side of [-1, 1]) {
        const g = ctx.createRadialGradient(x + side * 11 * u, y + 3 * u, 0, x + side * 11 * u, y + 3 * u, 3.8 * u);
        g.addColorStop(0, C.cheek); g.addColorStop(0.55, C.cheek); g.addColorStop(1, 'rgba(242,139,139,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + side * 11 * u, y + 3 * u, 3.8 * u, 0, TAU); ctx.fill();
      }
    }
    ctx.fillStyle = ink;
    if (mood === 'happy') {
      for (const side of [-1, 1]) {
        ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(x + side * eyeX, eyeY, 2.6 * u, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x + side * eyeX - 0.9 * u, eyeY - u, 0.9 * u, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x + side * eyeX + 1.05 * u, eyeY + 1.1 * u, 0.45 * u, 0, TAU); ctx.fill();
      }
      ctx.beginPath(); ctx.ellipse(x, y + 2.5 * u, 4.5 * u, 3.5 * u, 0, 20 / 180 * Math.PI, 160 / 180 * Math.PI); ctx.stroke();
    } else if (mood === 'cheer') {
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(x + side * eyeX, eyeY + u, 3 * u, 2.5 * u, 0, 200 / 180 * Math.PI, 340 / 180 * Math.PI); ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(x, y + 3 * u, 4.5 * u, 3.5 * u, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = C.tongue; ctx.beginPath(); ctx.ellipse(x, y + 4.25 * u, 2.4 * u, 1.65 * u, 0, 0, Math.PI); ctx.fill();
    } else if (mood === 'blink') {
      for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + side * eyeX - 2.4 * u, eyeY); ctx.lineTo(x + side * eyeX + 2.4 * u, eyeY); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(x, y + 2.5 * u, 4.5 * u, 3.5 * u, 0, 20 / 180 * Math.PI, 160 / 180 * Math.PI); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(x - eyeX, eyeY, 1.8 * u, 0, TAU); ctx.arc(x + eyeX, eyeY, 1.8 * u, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 3 * u, y + 4.5 * u); ctx.lineTo(x + 3 * u, y + 4.5 * u); ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * The glazed funnel (FilterHeroView.drawMascot) with its middle (the ring's middle in the app) at (cx, cy), drawn
   * at `s` px per dp. o: {mood, wave (degrees), breathe (0–1), dark, sieve}.
   */
  function mascot(ctx, cx, cy, s, o) {
    o = o || {};
    const A = C.accent, surface = o.dark ? '#1A1A19' : C.surface;
    const rimY = -32, half = 62, neckY = 42, neck = 11, spoutY = 60, armY = 0;
    const side = half - (half - neck) * (armY - rimY) / (neckY - rimY);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    ctx.fillStyle = o.dark ? 'rgba(0,0,0,0.35)' : 'rgba(11,11,11,0.08)';
    ctx.beginPath(); ctx.ellipse(0, 73, 24, 3.5, 0, 0, TAU); ctx.fill();
    const b = 1 + 0.012 * (o.breathe || 0);
    ctx.translate(0, 46); ctx.scale(b, b); ctx.translate(0, -46);
    const arm = (x, dir, turn) => {
      ctx.save(); ctx.translate(x, armY); ctx.rotate((turn || 0) * Math.PI / 180);
      ctx.strokeStyle = A; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(dir * 13, 5, dir * 16, 18); ctx.stroke();
      ctx.fillStyle = A; ctx.beginPath(); ctx.arc(dir * 16.5, 21.5, 4.2, 0, TAU); ctx.fill();
      ctx.fillStyle = mix(A, '#FFFFFF', 0.55); ctx.beginPath(); ctx.arc(dir * 16.5 - 1.3, 20.2, 1.3, 0, TAU); ctx.fill();
      ctx.restore();
    };
    const wave = o.wave || 0;
    arm(-side, -1, 0);
    if (!wave) arm(side, 1, 0);
    const body = new Path2D();
    body.moveTo(-half, rimY); body.lineTo(-neck, neckY); body.lineTo(-neck, spoutY - 3.5);
    body.quadraticCurveTo(-neck, spoutY, -neck + 3.5, spoutY); body.lineTo(neck - 3.5, spoutY);
    body.quadraticCurveTo(neck, spoutY, neck, spoutY - 3.5); body.lineTo(neck, neckY); body.lineTo(half, rimY);
    body.closePath();
    const g = ctx.createLinearGradient(-half, 0, half, 0);
    g.addColorStop(0, mix(surface, A, 0.09)); g.addColorStop(1, mix(surface, A, 0.30));
    ctx.fillStyle = g; ctx.fill(body);
    const edge = at => -lerp(half, neck, at) + 9 * (1 - 0.35 * at);
    ctx.strokeStyle = o.dark ? 'rgba(255,255,255,0.19)' : 'rgba(255,255,255,0.78)'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(edge(0.13), lerp(rimY, neckY, 0.13)); ctx.lineTo(edge(0.40), lerp(rimY, neckY, 0.40)); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle; ctx.beginPath(); ctx.arc(edge(0.51), lerp(rimY, neckY, 0.51), 1.9, 0, TAU); ctx.fill();
    ctx.strokeStyle = A; ctx.lineWidth = 2.5; ctx.stroke(body);
    ctx.fillStyle = mix(surface, A, 0.38); ctx.lineWidth = 2;
    roundRect(ctx, -neck - 2.5, neckY - 1.5, 2 * neck + 5, 6, 3); ctx.fill(); ctx.stroke();
    if (wave) arm(side, 1, -wave);
    const rg = ctx.createLinearGradient(0, rimY - 12, 0, rimY + 12);
    rg.addColorStop(0, mix(surface, A, 0.16)); rg.addColorStop(1, mix(surface, A, 0.42));
    ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(0, rimY, half, 12, 0, 0, TAU); ctx.fill();
    if (o.sieve !== false) {
      ctx.fillStyle = rgba(A, 0.63);
      for (let row = -1; row <= 1; row++) for (let col = -4; col <= 4; col++) {
        const x = col * 12 + (row === 0 ? 6 : 0), y = rimY + row * 5, dx = x / (half - 9), dy = (y - rimY) / 8;
        if (dx * dx + dy * dy <= 1) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill(); }
      }
    }
    ctx.strokeStyle = A; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, rimY, half, 12, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = o.dark ? 'rgba(255,255,255,0.19)' : 'rgba(255,255,255,0.78)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, rimY, half - 5, 8.5, 0, 208 / 180 * Math.PI, 242 / 180 * Math.PI); ctx.stroke();
    face(ctx, o.mood || 'happy', 0, 6, 40, o.dark ? '#FFFFFF' : C.ink);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /**
   * An offer ticket centred at (x, y), `s` px per dp (90 × 46 dp): pay large, route small, under a parachute shown at
   * `chute` (0–1). o: {pay, route, alpha, turn (degrees), chute, dark}.
   */
  function ticket(ctx, x, y, s, o) {
    o = o || {};
    const a = o.alpha == null ? 1 : o.alpha;
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.rotate((o.turn || 0) * Math.PI / 180); ctx.scale(s, s);
    if (o.chute > 0) {
      ctx.globalAlpha = a * o.chute;
      ctx.strokeStyle = o.dark ? '#5B6478' : C.baseline; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-34, -64); ctx.lineTo(-30, -23); ctx.moveTo(34, -64); ctx.lineTo(30, -23);
      ctx.moveTo(0, -78); ctx.lineTo(0, -23); ctx.stroke();
      ctx.fillStyle = o.dark ? '#3D5A85' : '#A9C8F2';
      ctx.beginPath(); ctx.ellipse(0, -62, 38, 24, 0, Math.PI, TAU); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = o.dark ? '#2C4468' : '#8FB3E6'; ctx.lineWidth = 1.2;
      for (const k of [-19, 0, 19]) { ctx.beginPath(); ctx.moveTo(k * 0.55, -84); ctx.quadraticCurveTo(k, -70, k, -62); ctx.stroke(); }
      ctx.globalAlpha = a;
    }
    ctx.fillStyle = o.dark ? '#22232A' : '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
    roundRect(ctx, -45, -23, 90, 46, 7); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = o.dark ? '#3A3B44' : C.baseline; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(-26, -21); ctx.lineTo(-26, 21); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = o.dark ? '#F3F2EC' : C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 17px "Baloo 2", "Atkinson Hyperlegible", system-ui, sans-serif';
    ctx.fillText(o.pay || '$', -20, -1);
    ctx.fillStyle = o.dark ? '#B9B8B0' : C.inkSoft; ctx.font = '600 9.5px "Atkinson Hyperlegible", system-ui, sans-serif';
    ctx.fillText(o.route || '', -20, 13);
    ctx.fillStyle = o.dark ? '#B9B8B0' : C.inkSoft; ctx.font = '700 13px "Baloo 2", system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('$', -36, 5);
    ctx.restore();
  }

  /** An outcome badge: ✓ passed (green), ✕ declined (red), ? review (amber). */
  function badge(ctx, x, y, r, kind, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    const col = kind === 'pass' ? C.good : kind === 'decline' ? C.bad : C.warn;
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x, y, r * 1.22, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = kind === 'review' ? C.ink : '#FFFFFF'; ctx.lineWidth = r * 0.24; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (kind === 'pass') { ctx.moveTo(x - r * 0.42, y + r * 0.02); ctx.lineTo(x - r * 0.1, y + r * 0.34); ctx.lineTo(x + r * 0.45, y - r * 0.32); }
    else if (kind === 'decline') { ctx.moveTo(x - r * 0.34, y - r * 0.34); ctx.lineTo(x + r * 0.34, y + r * 0.34); ctx.moveTo(x + r * 0.34, y - r * 0.34); ctx.lineTo(x - r * 0.34, y + r * 0.34); }
    ctx.stroke();
    if (kind === 'review') { ctx.fillStyle = C.ink; ctx.font = '800 ' + (r * 1.3) + 'px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', x, y + r * 0.05); }
    ctx.restore();
  }

  /** A building of the skyline: as tall as the offer's pay; green with lit windows when it passed, red when declined. */
  function building(ctx, x, base, w, h, kind, rise) {
    rise = rise == null ? 1 : clamp(rise, 0, 1);
    if (rise <= 0) return;
    const hh = h * ease.back(rise), col = kind === 'pass' ? C.good : C.bad;
    ctx.fillStyle = col; ctx.fillRect(x, base - hh, w, hh);
    const cols = Math.max(1, Math.floor((w - 6) / 11)), gap = (w - cols * 6) / (cols + 1);
    for (let r = 0; r * 13 + 10 < hh - 6; r++) for (let c = 0; c < cols; c++) {
      ctx.fillStyle = kind === 'pass' ? '#F6F2B4' : 'rgba(0,0,0,0.22)';
      ctx.fillRect(x + gap + c * (6 + gap), base - hh + 8 + r * 13, 6, 7);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + w / 2, base - hh); ctx.lineTo(x + w / 2, base - hh - 14); ctx.stroke();
    badge(ctx, x + w / 2, base - hh - 22, 9, kind, ease.out((rise - 0.5) * 2));
  }

  /** A soft searchlight beam from (x, base) at `angle` radians from vertical. */
  function beam(ctx, x, base, len, angle, color) {
    ctx.save(); ctx.translate(x, base); ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, 0, 0, -len);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-len * 0.12, -len); ctx.lineTo(len * 0.12, -len); ctx.lineTo(6, 0); ctx.fill();
    ctx.restore();
  }

  /** A spoke's icon: $ (pay), a road (per mile), a clock (per minute), a pin (per stop). */
  function icon(ctx, kind, x, y, r, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = r * 0.16; ctx.lineCap = 'round';
    if (kind === 0) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.font = '800 ' + r * 1.2 + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', x, y + r * 0.05); }
    else if (kind === 1) { ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + r); ctx.lineTo(x - r * 0.15, y - r); ctx.moveTo(x + r * 0.5, y + r); ctx.lineTo(x + r * 0.15, y - r); ctx.moveTo(x, y + r * 0.7); ctx.lineTo(x, y + r * 0.35); ctx.moveTo(x, y - r * 0.05); ctx.lineTo(x, y - r * 0.4); ctx.stroke(); }
    else if (kind === 2) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.moveTo(x, y); ctx.lineTo(x, y - r * 0.55); ctx.moveTo(x, y); ctx.lineTo(x + r * 0.4, y + r * 0.25); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(x, y - r * 0.25, r * 0.62, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(x, y + r); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y - r * 0.25, r * 0.22, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  const SPOKES = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.25, Math.PI * 0.75];
  function spokePoint(cx, cy, r, i, f) { return [cx + Math.cos(SPOKES[i]) * r * f, cy + Math.sin(SPOKES[i]) * r * f]; }
  function poly(ctx, pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
  function sparkle(ctx, x, y, h, color) {
    const w = h * 0.22; ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - h);
    ctx.quadraticCurveTo(x + w, y - w, x + h, y); ctx.quadraticCurveTo(x + w, y + w, x, y + h);
    ctx.quadraticCurveTo(x - w, y + w, x - h, y); ctx.quadraticCurveTo(x - w, y - w, x, y - h); ctx.fill();
  }

  /**
   * The constellation of minimums: rings, four spokes with their icons, recent offers as faint shapes, the set
   * minimums as a solid shape with knobs, and the learned ones as a dashed shape with sparkles.
   * o: {set: [4 fractions], learned: [4 fractions] | null, offers: [{f: [4], pass}], dark, alpha, held: index}
   */
  function constellation(ctx, cx, cy, r, o) {
    o = o || {};
    ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    const ink = o.dark ? 'rgba(233,226,200,0.32)' : 'rgba(60,70,90,0.22)';
    ctx.strokeStyle = ink; ctx.lineWidth = 1.2;
    for (const k of [0.33, 0.66, 1]) { ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, TAU); ctx.stroke(); }
    for (let i = 0; i < 4; i++) {
      const p = spokePoint(cx, cy, r, i, 1.0);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(p[0], p[1]); ctx.stroke();
      const q = spokePoint(cx, cy, r, i, 1.16);
      icon(ctx, i, q[0], q[1], r * 0.07, o.dark ? '#E9E2C8' : '#3B3A36');
    }
    for (const off of o.offers || []) {
      const pts = off.f.map((f, i) => spokePoint(cx, cy, r, i, f));
      poly(ctx, pts); ctx.fillStyle = rgba(off.pass ? C.good : C.bad, 0.06); ctx.fill();
      ctx.strokeStyle = rgba(off.pass ? C.good : C.bad, 0.45); ctx.lineWidth = 1.4; ctx.stroke();
      pts.forEach(p => { ctx.fillStyle = rgba(off.pass ? C.good : C.bad, 0.85); ctx.beginPath(); ctx.arc(p[0], p[1], r * 0.018, 0, TAU); ctx.fill(); });
    }
    if (o.learned) {
      const pts = o.learned.map((f, i) => spokePoint(cx, cy, r, i, f));
      poly(ctx, pts); ctx.setLineDash([r * 0.045, r * 0.03]); ctx.strokeStyle = o.dark ? '#B08CF0' : C.learned; ctx.lineWidth = r * 0.016; ctx.stroke(); ctx.setLineDash([]);
      pts.forEach(p => sparkle(ctx, p[0], p[1], r * 0.045, o.dark ? '#B08CF0' : C.learned));
    }
    const set = (o.set || [0.5, 0.5, 0.5, 0.5]).map((f, i) => spokePoint(cx, cy, r, i, f));
    poly(ctx, set); ctx.fillStyle = rgba(C.accent, 0.14); ctx.fill();
    ctx.strokeStyle = o.dark ? '#8AB4F0' : C.accent; ctx.lineWidth = r * 0.017; ctx.stroke();
    set.forEach((p, i) => {
      const k = r * (o.held === i ? 0.062 : 0.046);
      ctx.fillStyle = rgba(C.accent, o.held === i ? 0.22 : 0.12); ctx.beginPath(); ctx.arc(p[0], p[1], k * 1.7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(p[0], p[1], k, 0, TAU); ctx.fill();
      ctx.strokeStyle = C.accent; ctx.lineWidth = k * 0.32; ctx.stroke();
      ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(p[0], p[1], k * 0.32, 0, TAU); ctx.fill();
    });
    ctx.restore();
  }

  /** The road along the bottom, its dashes sliding by `travel` px, with low hills behind. */
  function road(ctx, w, y, travel, night) {
    ctx.fillStyle = mix('#DCE4D2', '#1B2238', night);
    ctx.beginPath(); ctx.moveTo(0, y - 30);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, y - 30 - 26 * Math.sin(x / w * 5 + 1) * Math.sin(x / w * 2.2));
    ctx.lineTo(w, y); ctx.lineTo(0, y); ctx.fill();
    ctx.fillStyle = mix('#E3E7D6', '#121821', night); ctx.fillRect(0, y, w, 400);
    ctx.fillStyle = mix('#D2D1C9', '#262a33', night); ctx.fillRect(0, y + 30, w, 46);
    ctx.strokeStyle = mix('#F7F5EE', '#8A8F9B', night); ctx.lineWidth = 4; ctx.setLineDash([28, 22]);
    ctx.lineDashOffset = travel; ctx.beginPath(); ctx.moveTo(0, y + 53); ctx.lineTo(w, y + 53); ctx.stroke();
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }

  /** The little blue car with a delivery bag on its roof, facing right, `s` px per dp (about 100 dp long). */
  function car(ctx, x, y, s, bounce) {
    ctx.save(); ctx.translate(x, y + (bounce || 0)); ctx.scale(s, s);
    ctx.fillStyle = '#C79A5A'; roundRect(ctx, -14, -58, 28, 18, 3); ctx.fill();
    ctx.fillStyle = '#8FB3E6'; roundRect(ctx, -46, -42, 92, 34, 14); ctx.fill();
    ctx.fillStyle = '#A9C8F2'; roundRect(ctx, -30, -40, 56, 18, 8); ctx.fill();
    ctx.fillStyle = '#E8F1FB'; ctx.beginPath(); ctx.arc(-6, -31, 4, 0, TAU); ctx.arc(8, -31, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3B3A36'; ctx.beginPath(); ctx.arc(-6, -31, 1.8, 0, TAU); ctx.arc(8, -31, 1.8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3B3A36'; ctx.beginPath(); ctx.arc(-27, -6, 10, 0, TAU); ctx.arc(27, -6, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9C9A93'; ctx.beginPath(); ctx.arc(-27, -6, 4, 0, TAU); ctx.arc(27, -6, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFE3A0'; ctx.beginPath(); ctx.arc(44, -24, 4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /** A rounded pill with an arrow and text (the best-area guide). */
  function pill(ctx, x, y, text, s, dark) {
    ctx.save(); ctx.font = '700 ' + 15 * s + 'px "Atkinson Hyperlegible", system-ui, sans-serif';
    const w = ctx.measureText(text).width + 52 * s, h = 34 * s;
    ctx.fillStyle = dark ? 'rgba(26,26,25,0.92)' : 'rgba(252,252,251,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 10 * s;
    roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = C.accent; ctx.beginPath(); ctx.moveTo(x - w / 2 + 16 * s, y + 7 * s); ctx.lineTo(x - w / 2 + 30 * s, y - 8 * s);
    ctx.lineTo(x - w / 2 + 27 * s, y + 2 * s); ctx.lineTo(x - w / 2 + 20 * s, y + 9 * s); ctx.fill();
    ctx.fillStyle = dark ? '#F3F2EC' : C.ink; ctx.textBaseline = 'middle'; ctx.fillText(text, x - w / 2 + 40 * s, y + 1);
    ctx.restore();
  }

  root.OfferArt = { C, ease, lerp, clamp, mix, rgba, rnd, sky, sunMoon, enso, mascot, face, ticket, badge, building,
    beam, constellation, spokePoint, road, car, pill, roundRect, sparkle };
})(typeof window !== 'undefined' ? window : globalThis);
