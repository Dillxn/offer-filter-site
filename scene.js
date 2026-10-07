/*
 * The page's side of its 3D scenery (assets/scenery.js builds and draws it). Where the browser lets a page hand its
 * canvas to a worker (OffscreenCanvas), the scenery is drawn there, so neither making its WebGL context, nor building
 * it, nor drawing it takes the page's own thread; elsewhere it is drawn on the page's thread. This side says where the
 * page's words, sky button and footer stand, and passes on the sky, motion, the page being hidden and the pointer.
 * Without WebGL the page keeps its plain background and the sky button its own sun and moon.
 */
(() => {
'use strict';
const V = '?v=20261007-3d3', KNOWN = 'offergl.software';
const canvas = () => document.getElementById('landscape');
if (!canvas() || !window.WebGLRenderingContext) { window.setSceneNight = window.setScenePaused = () => {}; return; }
let night = document.body.classList.contains('night'), paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let send = null, worker = null, drawn = false, settling = 0;
window.setSceneNight = v => { night = !!v; if (send) send({type: 'night', night}); };
window.setScenePaused = v => { paused = !!v; if (send) send({type: 'paused', paused}); };
const ratio = () => Math.min(devicePixelRatio || 1, 2);

/* Where things stand, in css px from the canvas's top-left: the footer's links (the land and its road stay above them),
 * the sky button (the sun or the moon stands behind it) and the words (clouds fade while they pass behind them). */
function measure() {
  const c = canvas(), box = c.getBoundingClientRect(), b = document.getElementById('sky-toggle'), q = b && b.getBoundingClientRect();
  const links = document.querySelector('.footer-links');
  const rect = e => { const k = e.getBoundingClientRect(); return {left: k.left - box.left, top: k.top - box.top, right: k.right - box.left, bottom: k.bottom - box.top}; };
  return {W: c.clientWidth, H: c.clientHeight, dpr: ratio(),
    groundTop: links ? links.getBoundingClientRect().top - box.top : Infinity,
    sun: q && q.width ? {x: q.left + q.width / 2 - box.left, y: q.top + q.height / 2 - box.top, r: q.width * .36} : null,
    words: [...document.querySelectorAll('.wordmark, .intro h1, .lede, .app-actions, .footer-links')].map(rect)};
}
// What the last visit found: whether WebGL here is drawn by the CPU (gl.js keeps the same note on the page's thread).
function known() { try { const k = localStorage.getItem(KNOWN); return k === '1' ? true : k === '0' ? false : null; } catch (e) { return null; } }
const opening = c => ({type: 'start', canvas: c, software: known(), night, paused, hidden: document.hidden, page: measure()});
// A canvas once handed to a worker cannot be drawn on here again: a fresh one takes its place.
function fresh() { const old = canvas(), c = old.cloneNode(false); old.replaceWith(c); return c; }

function receive(m) {
  if (m.type === 'drawn') { drawn = true; canvas().classList.add('drawn'); document.body.classList.add('sky-3d'); }
  else if (m.type === 'software') { try { localStorage.setItem(KNOWN, m.software ? '1' : '0'); } catch (e) {} }
  else if (m.type === 'fresh' && worker) { const off = fresh().transferControlToOffscreen(); worker.postMessage({type: 'canvas', canvas: off}, [off]); }
  // A browser whose workers cannot draw WebGL (or that failed to start one) draws the scenery here instead.
  else if (m.type === 'unavailable' && worker) { worker.terminate(); worker = send = null; here(fresh()); }
}
/* On the page's own thread: the renderer, the models and the scenery as scripts, in order. */
function here(c) {
  const list = [['OfferGL', 'assets/gl.js'], ['OfferModels', 'assets/models.js'], ['OfferScenery', 'assets/scenery.js']].filter(([name]) => !window[name]);
  let left = list.length;
  const go = () => { if (!window.OfferScenery) return; send = OfferScenery.connect(receive); send(opening(c)); };
  if (!left) return go();
  for (const [, src] of list) {
    const s = Object.assign(document.createElement('script'), {src: src + V, async: false});
    s.onload = s.onerror = () => { if (--left === 0) go(); };
    document.head.append(s);
  }
}
function start() {
  const c = canvas();
  if (typeof Worker !== 'function' || !c.transferControlToOffscreen) return here(c);
  let w = null;
  try {
    w = new Worker('assets/scenery.js' + V);
    const off = c.transferControlToOffscreen();
    w.onmessage = e => receive(e.data);
    w.onerror = () => { if (worker === w && !drawn) receive({type: 'unavailable'}); };
    w.postMessage(opening(off), [off]);
    worker = w; send = m => w.postMessage(m);
  } catch (e) {
    if (w) w.terminate();
    here(fresh());
  }
}

addEventListener('resize', () => {
  if (!send) return;
  const c = canvas();
  send({type: 'size', W: c.clientWidth, H: c.clientHeight, dpr: ratio()});
  clearTimeout(settling);
  settling = setTimeout(() => { if (send) send({type: 'page', page: measure()}); }, 160);
});
document.addEventListener('visibilitychange', () => { if (send) send({type: 'hidden', hidden: document.hidden}); });
document.addEventListener('pointermove', e => { if (send) send({type: 'pointer', x: e.clientX, y: e.clientY}); }, {passive: true});

// Begun once the page has loaded and shown its words (its first contentful paint, or a second after loading where the
// browser cannot say), when the browser is idle; the page's own colors show until the scenery fades in. When the fonts
// arrive later, the words and buttons have moved: the scenery hears their new places.
let loaded = false, painted = false, begun = false;
const go = () => {
  if (!loaded || !painted || begun) return;
  begun = true;
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 50));
  idle(() => {
    start();
    if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (send) send({type: 'page', page: measure(), force: true}); });
  }, {timeout: 600});
};
try {
  new PerformanceObserver((list, observer) => {
    if (list.getEntries().some(e => e.name === 'first-contentful-paint')) { observer.disconnect(); painted = true; go(); }
  }).observe({type: 'paint', buffered: true});
} catch (e) {}
const onLoad = () => { loaded = true; go(); setTimeout(() => { painted = true; go(); }, 1000); };
if (document.readyState === 'complete') onLoad(); else addEventListener('load', onLoad, {once: true});
})();
