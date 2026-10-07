/*
 * The page's side of its 3D scenery (assets/scenery.js builds and draws it). Where the browser lets a page hand its
 * canvas to a worker (OffscreenCanvas), the scenery is drawn there, so neither making its WebGL context, nor building
 * it, nor drawing it takes the page's own thread; elsewhere it is drawn on the page's thread. This side says where the
 * page's words, sky button and footer stand, and passes on the sky, motion and the page being hidden.
 * Without WebGL the page keeps its plain background and the sky button its own sun and moon.
 */
(() => {
'use strict';
const V = '?v=20261007-3d5', KNOWN = 'offergl.software';
const canvas = () => document.getElementById('landscape');
if (!canvas() || !window.WebGLRenderingContext) { window.setSceneNight = window.setScenePaused = window.setSceneBusy = () => {}; return; }
let night = document.body.classList.contains('night'), paused = matchMedia('(prefers-reduced-motion: reduce)').matches, busy = false;
let send = null, worker = null, drawn = false, settling = 0;
window.setSceneNight = v => { night = !!v; if (send) send({type: 'night', night}); };
window.setScenePaused = v => { paused = !!v; if (send) send({type: 'paused', paused}); };
// Whether the film is moving beside the scenery (where WebGL is drawn by the CPU, the scenery then draws less often).
window.setSceneBusy = v => { busy = !!v; if (send) send({type: 'busy', busy}); };
const ratio = () => Math.min(devicePixelRatio || 1, 2);

/* Where things stand, in css px from the canvas's top-left: the footer's links (the land and its road stay above them),
 * the sky button (the sun or the moon stands behind it) and the words (clouds fade while they pass behind them). Taken
 * from the layout, which the page's entrance animation and the button's hover do not move, so a measure taken while
 * they play still holds when they end. */
function measure() {
  const c = canvas(), world = c.offsetParent, b = document.getElementById('sky-toggle'), links = document.querySelector('.footer-links');
  const rect = e => {
    let left = 0, top = 0;
    for (let n = e; n && n !== world; n = n.offsetParent) { left += n.offsetLeft; top += n.offsetTop; }
    return {left: left - c.offsetLeft, top: top - c.offsetTop, right: left - c.offsetLeft + e.offsetWidth, bottom: top - c.offsetTop + e.offsetHeight};
  };
  const q = b && b.offsetWidth ? rect(b) : null;
  return {W: c.clientWidth, H: c.clientHeight, dpr: ratio(),
    groundTop: links ? rect(links).top : Infinity,
    sun: q ? {x: (q.left + q.right) / 2, y: (q.top + q.bottom) / 2, r: (q.right - q.left) * .36} : null,
    words: [...document.querySelectorAll('.wordmark, .intro h1, .lede, .app-actions, .footer-links')].map(rect)};
}
// What the last visit found: whether WebGL here is drawn by the CPU (gl.js keeps the same note on the page's thread).
function known() { try { const k = localStorage.getItem(KNOWN); return k === '1' ? true : k === '0' ? false : null; } catch (e) { return null; } }
window.sceneOnCPU = () => known() === true;
const opening = c => ({type: 'start', canvas: c, software: known(), night, paused, busy, hidden: document.hidden, page: measure()});
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
