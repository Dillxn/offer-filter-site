// Source-level regressions for the real player, using a controlled DOM/media adapter.
// No browser, WebGL, audio decoding or video rendering is provided by this adapter.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(process.argv[2] || `${__dirname}/../player.js`, 'utf8');

function fixture(options = {}) {
  const calls = {fetch: 0, frames: 0, audioPlay: 0, unavailable: 0, scripts: []};
  const rafs = new Map(), timers = new Map(); let serial = 0;
  const context2d = new Proxy({}, {get: () => () => {}});
  class Element extends EventTarget {
    constructor(tagName = 'DIV') {
      super(); this.tagName = tagName; this.hidden = false; this.style = {setProperty() {}};
      this.attrs = {}; this.max = '21'; this.value = '0'; this.clientWidth = 800; this.clientHeight = 450;
      const names = new Set();
      this.classList = {add: s => names.add(s), remove: s => names.delete(s), contains: s => names.has(s),
        toggle(s, on) { if (on) names.add(s); else names.delete(s); }};
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    contains() { return false; }
    getContext() { return context2d; }
  }
  const ids = Object.fromEntries(['film-stage','film-canvas','film-audio','film-controls','film-seek','film-time','film-cue','film-play'].map(id => [id, new Element()]));
  const buttons = Object.fromEntries(['toggle','mute','captions','fullscreen'].map(id => [id, new Element('BUTTON')]));
  ids['film-controls'].querySelector = selector => buttons[selector.match(/"(.*?)"/)[1]];
  const audio = ids['film-audio'];
  Object.assign(audio, {currentTime: 0, paused: true, preload: 'none', muted: false,
    play() { calls.audioPlay++; this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; this.dispatchEvent(new Event('pause')); },
    querySelectorAll() { return [new Element('SOURCE')]; }});
  const signature = new Element('IMG'); Object.assign(signature, {complete: true, naturalWidth: 10, naturalHeight: 10});
  const ctx = {Event, EventTarget, console, navigator: {}, performance: {now: () => 0},
    matchMedia: () => ({matches: true}), localStorage: {getItem() { return null; }, setItem() {}},
    setTimeout(fn) { const id = ++serial; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    requestAnimationFrame(fn) { const id = ++serial; rafs.set(id, fn); return id; }, cancelAnimationFrame: id => rafs.delete(id),
    ResizeObserver: class {observe() {}}, IntersectionObserver: class {observe() {}}, addEventListener() {},
    document: {readyState: 'loading', activeElement: null, fullscreenEnabled: false,
      getElementById: id => ids[id], createElement: tag => new Element(tag.toUpperCase()),
      querySelector: () => signature, addEventListener() {},
      fonts: {load: () => options.fontError ? Promise.reject(new Error('font unavailable')) : Promise.resolve()},
      head: {append(script) {
        calls.scripts.push(script.src);
        queueMicrotask(() => {
          if (options.scriptError && script.src.includes(options.scriptError)) return script.onerror(new Event('error'));
          if (script.src.startsWith('assets/gl.js')) ctx.OfferGL = {create: () => options.noWebGL ? null : renderer};
          if (script.src.startsWith('assets/models.js')) ctx.OfferModels = {};
          if (script.src.startsWith('assets/film.js') && !options.noFilmGlobal) ctx.OfferFilm = film;
          script.onload(new Event('load'));
        });
      }}},
    fetch() {
      calls.fetch++;
      if (options.networkError) return Promise.reject(new Error('offline'));
      if (options.deferManifest) return new Promise(resolve => { calls.resolveManifest = resolve; });
      return Promise.resolve({ok: !options.httpError, json: () => options.jsonError ? Promise.reject(new SyntaxError('invalid JSON')) : Promise.resolve(['base.js'])});
    }};
  const renderer = {software: false, canvas: new Element('CANVAS'), size() {}, view() {}};
  const film = {CAPTIONS: [], prepare() { return []; }, frame() { calls.frames++; }};
  ctx.window = ctx; ctx.WebGLRenderingContext = function() {};
  vm.runInNewContext(source, ctx, {filename: process.argv[2] || 'player.js'});
  ctx.offerFilm.addEventListener('unavailable', () => { calls.unavailable++; calls.wantedAtHandoff = !!ctx.offerFilm.wanted; });
  return {ctx, calls, ids, audio, rafs, timers,
    async microtasks() { for (let i = 0; i < 12; i++) { await Promise.resolve(); await Promise.resolve(); } },
    frame(now = 1000) { const work = [...rafs.values()]; rafs.clear(); work.forEach(fn => fn(now)); },
    async flush() {
      // Drain microtasks and only immediate handoff timers; hide-control timers are harmless for these cases.
      for (let i = 0; i < 12; i++) { await Promise.resolve(); await Promise.resolve(); }
      const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn());
      for (let i = 0; i < 12; i++) await Promise.resolve();
    }};
}

for (const [name, options] of [
  ['manifest network failure', {networkError: true}],
  ['manifest invalid JSON', {jsonError: true}],
  ['manifest HTTP error with parseable body', {httpError: true}],
  ['film script error', {scriptError: 'assets/film.js'}],
  ['dependency script error', {scriptError: 'assets/app/base.js'}],
  ['film script loads without its API', {noFilmGlobal: true}],
  ['WebGL unavailable', {noWebGL: true}],
]) test(`${name}: hand off once, stop live audio and frames, preserve Play intent`, async () => {
  const f = fixture(options); await f.ctx.offerFilm.play(); await f.flush();
  assert.equal(f.calls.unavailable, 1, 'MP4 handoff event');
  assert.equal(f.calls.wantedAtHandoff, true, 'explicit Play survives the handoff');
  assert.equal(f.ctx.offerFilm.paused, true, 'live player stopped');
  assert.equal(f.audio.paused, true, 'live soundtrack stopped');
  assert.equal(f.rafs.size, 0, 'live frame loop canceled');
  await f.ctx.offerFilm.play(); await f.flush();
  assert.equal(f.calls.unavailable, 1, 'no repeated fallback');
  assert.equal(f.rafs.size, 0);
});

test('prefetch failure does not request autoplay', async () => {
  const f = fixture({networkError: true});
  f.ids['film-play'].dispatchEvent(new Event('pointerenter')); await f.flush();
  assert.equal(f.calls.unavailable, 1);
  assert.equal(f.calls.wantedAtHandoff, false);
  assert.equal(f.calls.audioPlay, 0);
});

test('pause during loading cancels the Play intent for the fallback', async () => {
  const f = fixture({deferManifest: true}); await f.ctx.offerFilm.play(); f.ctx.offerFilm.pause();
  f.calls.resolveManifest({ok: true, json: () => Promise.reject(new Error('invalid JSON'))}); await f.flush();
  assert.equal(f.calls.unavailable, 1);
  assert.equal(f.calls.wantedAtHandoff, false);
});

for (const fontError of [false, true]) test(`successful load preserves live playback (font error ${fontError})`, async () => {
  const f = fixture({fontError}); await f.flush();
  assert.equal(f.calls.fetch, 0, 'reduced-motion page stays lazy before Play');
  await f.ctx.offerFilm.play(); await f.flush();
  assert.equal(f.calls.unavailable, 0);
  assert.equal(f.ctx.offerFilm.paused, false);
  assert.equal(f.audio.paused, false);
  assert.ok(f.calls.frames > 0, 'real player called the film frame API');
  assert.ok(f.rafs.size > 0);
});

test('pause after failure but before handoff cancels autoplay', async () => {
  const f = fixture({networkError: true}); await f.ctx.offerFilm.play(); await f.microtasks();
  assert.equal(f.calls.unavailable, 0, 'handoff still queued');
  f.ctx.offerFilm.pause(); await f.flush();
  assert.equal(f.calls.wantedAtHandoff, false);
});

test('queued audio play after failure cannot revive canceled handoff intent', async () => {
  const f = fixture({deferManifest: true}); await f.ctx.offerFilm.play(); f.ctx.offerFilm.pause();
  f.calls.resolveManifest({ok: true, json: () => Promise.reject(new Error('invalid JSON'))}); await f.microtasks();
  f.audio.dispatchEvent(new Event('play')); await f.flush();
  assert.equal(f.calls.wantedAtHandoff, false);
  assert.equal(f.calls.audioPlay, 1);
});

test('late soundtrack play event at 21 seconds preserves the closing frame and Replay state', async () => {
  const f = fixture(); await f.ctx.offerFilm.play(); await f.flush();
  f.audio.currentTime = 21; f.frame();
  assert.equal(f.ctx.offerFilm.ended, true);
  assert.equal(f.audio.paused, true);
  f.audio.dispatchEvent(new Event('play')); await f.microtasks();
  assert.equal(f.ctx.offerFilm.ended, true, 'queued play must not replay the completed film');
  assert.equal(f.ctx.offerFilm.paused, true);
  assert.equal(f.ids['film-seek'].value, 21);
  assert.equal(f.ids['film-controls'].hidden, true);
  assert.equal(f.calls.audioPlay, 1);
  assert.equal(f.rafs.size, 0);
  await f.ctx.offerFilm.play(); await f.microtasks();
  assert.equal(f.ctx.offerFilm.ended, false, 'explicit Replay still works');
  assert.equal(f.ids['film-seek'].value, 0);
  assert.equal(f.ctx.offerFilm.paused, false);
});

test('late play event cannot undo Pause, but an active media-key play can resume', async () => {
  const f = fixture(); await f.ctx.offerFilm.play(); await f.flush(); f.ctx.offerFilm.pause();
  f.audio.dispatchEvent(new Event('play')); await f.microtasks();
  assert.equal(f.ctx.offerFilm.paused, true);
  assert.equal(f.calls.audioPlay, 1);
  f.audio.paused = false; f.audio.dispatchEvent(new Event('play')); await f.microtasks();
  assert.equal(f.ctx.offerFilm.paused, false);
  assert.equal(f.calls.audioPlay, 2);
});
