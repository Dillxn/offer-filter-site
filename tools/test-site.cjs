#!/usr/bin/env node
'use strict';
// Local Chromium checks for the homepage and its live film player: the page fitting a laptop's screen, the hero's
// buttons, the footer's links and the emblem's corner, the tip buttons' icons, the sky button cycling as the app's
// does, the 3D sky drawn after the page's first paint (in a worker, and once on the page's own thread as browsers
// without OffscreenCanvas draw it), the film's poster picture with no renderer until it is wanted, playback in sync
// with the soundtrack, the app's screens loaded and drawn on the phone, keyboard pause, seeking, captions, dialogs
// pausing the film, the ending and replay. Chromium draws WebGL with SwiftShader here, so the 3D paths run without a
// GPU.
// Local browser evidence only, not a phone or live-domain receipt.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.vtt':'text/vtt','.mp4':'video/mp4','.webm':'audio/webm','.m4a':'audio/mp4','.woff2':'font/woff2','.ttf':'font/ttf'};
// Media elements seek with Range requests, so the test server answers them as GitHub Pages does.
function serve(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404).end(); return; }
    const type = mime[path.extname(file)] || 'application/octet-stream', range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (!range) { res.writeHead(200, {'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes'}); fs.createReadStream(file).pipe(res); return; }
    const start = range[1] ? +range[1] : 0, end = range[2] ? +range[2] : stat.size - 1;
    res.writeHead(206, {'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes'});
    fs.createReadStream(file, {start, end}).pipe(res);
  });
}
const state = page => page.evaluate(() => ({
  film: +document.getElementById('film-seek').value,
  audio: document.getElementById('film-audio').currentTime,
  quiet: document.body.classList.contains('motion-paused'),
  playLabel: document.querySelector('#film-play b').textContent,
  playHidden: document.getElementById('film-play').hidden
}));
const seekTo = (page, t) => page.evaluate(t => { const s = document.getElementById('film-seek'); s.value = t; s.dispatchEvent(new Event('input')); }, t);
async function main() {
  const server = http.createServer(serve);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  let browser;
  const results = [];
  try {
    browser = await chromium.launch({headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
      ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.CHROMIUM_EXECUTABLE_PATH} : {})});
    for (const [width, height, format] of [[1280, 800, 'landscape'], [400, 860, 'square']]) for (const night of [false, true]) {
      // One run draws the sky on the page's own thread, as a browser that cannot hand a canvas to a worker does.
      const here = width === 400 && night;
      const page = await browser.newPage({viewport: {width, height}});
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      // A fixed sky, and a count of the WebGL contexts the page's own thread asks for.
      await page.addInitScript(([mode, here]) => {
        localStorage.setItem('offerfilter.theme', mode);
        if (here) delete HTMLCanvasElement.prototype.transferControlToOffscreen;
        const get = HTMLCanvasElement.prototype.getContext; window.__webgl = 0;
        HTMLCanvasElement.prototype.getContext = function (type, ...rest) { if (/webgl/.test(type)) window.__webgl++; return get.call(this, type, ...rest); };
      }, [night ? 'NIGHT' : 'DAY', here]);
      await page.goto(base, {waitUntil: 'networkidle'});
      await page.waitForFunction(() => document.getElementById('film-stage').classList.contains('drawn') && document.getElementById('landscape').classList.contains('drawn'), null, {timeout: 20000});
      const look = await page.evaluate(() => {
        const box = s => document.querySelector(s).getBoundingClientRect(), stage = document.getElementById('film-stage');
        return {night: document.body.classList.contains('night'), sky3d: document.body.classList.contains('sky-3d'), webgl: window.__webgl, cpu: localStorage.getItem('offergl.software') === '1',
          poster: getComputedStyle(stage).backgroundImage, posterLoaded: performance.getEntriesByType('resource').some(e => /film-poster-(wide|square)\.avif/.test(e.name)),
          filmScript: !!window.OfferFilm, renderer: !!window.OfferGL, save: !!document.getElementById('film-save'),
          icons: [...document.querySelectorAll('#download-open svg, .source-button svg')].length, github: document.querySelector('.source-button').href,
          githubText: document.querySelector('.source-button').textContent.trim(), links: box('.footer-links'), signature: box('.signature'), world: box('.world'), stage: stage.getBoundingClientRect(),
          payIcons: document.querySelectorAll('.tip-options .pay-icon').length,
          overflow: document.documentElement.scrollWidth - innerWidth, scroll: document.documentElement.scrollHeight - innerHeight};
      });
      assert.equal(look.night, night, 'the chosen sky shows');
      assert(look.sky3d, 'the 3D sky is drawn');
      assert.match(look.poster, new RegExp(`film-poster-${format === 'landscape' ? 'wide' : 'square'}\\.avif`));
      assert(look.posterLoaded, 'the poster picture loads');
      assert(!look.filmScript, 'the film\'s script waits until the film is wanted');
      // In a worker, the sky asks the page's thread for no WebGL at all, nor loads the renderer there. On the page's
      // thread: one context, or on a first visit to a browser drawing WebGL on the CPU, a second without multisampling.
      if (here) assert.equal(look.webgl, look.cpu ? 2 : 1, 'only the sky asks for WebGL at load, none for the film yet');
      else { assert.equal(look.webgl, 0, 'the sky draws in a worker'); assert(!look.renderer, 'the renderer waits on the page until the film is wanted'); }
      assert(!look.save, 'no Save film link');
      assert.equal(look.icons, 2, 'both hero buttons carry icons');
      assert.equal(look.githubText, 'View on GitHub');
      assert.match(look.github, /github\.com\/Dillxn\/offer-filter-site/);
      assert(look.overflow <= 0, 'no horizontal overflow');
      if (format === 'landscape') assert(look.scroll <= 0, `the page fits the screen (${look.scroll} px over)`);
      // The links at the left; the emblem on its quarter circle in the page's bottom-right corner, clear of the links
      // and the film.
      assert(look.links.left - look.world.left < 90, 'links at the left');
      assert(Math.abs(look.signature.right - look.world.right) < 1 && Math.abs(look.signature.bottom - look.world.bottom) < 1, 'the emblem in the bottom-right corner');
      const clear = b => Math.hypot(look.world.right - Math.min(b.right, look.world.right), look.world.bottom - Math.min(b.bottom, look.world.bottom)) > look.signature.width;
      assert(clear(look.links) && clear(look.stage), 'the corner clear of the links and the film');
      assert.equal(look.payIcons, 2, 'Cash App and Venmo carry icons');

      // The sky button moves on as the app's sun does: Day, Night, System, Auto; a badge marks System and Auto.
      const sky = [];
      for (let k = 0; k < 4; k++) {
        await page.locator('#sky-toggle').click();
        sky.push(await page.evaluate(() => ({mode: document.getElementById('sky-toggle').dataset.mode,
          badge: getComputedStyle(document.querySelector('.sky-badge'), '::before').content, toast: document.getElementById('sky-toast').textContent})));
      }
      assert.deepEqual(sky.map(x => x.mode), night ? ['SYSTEM', 'AUTO', 'DAY', 'NIGHT'] : ['NIGHT', 'SYSTEM', 'AUTO', 'DAY']);
      for (const x of sky) assert.equal(x.badge, x.mode === 'AUTO' ? '"A"' : x.mode === 'SYSTEM' ? '"S"' : 'none');
      assert.match(sky.find(x => x.mode === 'AUTO').toast, /^Auto/);
      assert.equal(await page.evaluate(() => document.body.classList.contains('night')), night, 'four taps come back to the same sky');

      await page.locator('#film-play').click();
      await page.waitForFunction(() => +document.getElementById('film-seek').value > 2.5, null, {timeout: 20000});
      const playing = await state(page);
      assert(Math.abs(playing.film - playing.audio) < .3, `film ${playing.film} follows audio ${playing.audio}`);
      assert(playing.quiet && playing.playHidden, 'scenery rests and the play button steps aside');
      assert.match(await page.evaluate(() => document.getElementById('film-audio').currentSrc), /film-soundtrack\.(webm|m4a)/);

      // Play fetched the app's ported views (assets/app/files.json) and Roboto; seeking into the app's shots draws its page.
      await page.waitForFunction(() => window.OfferApp && OfferApp.page && document.fonts.check('500 12px Roboto'), null, {timeout: 10000});
      const app = await page.evaluate(() => {
        const files = [...document.scripts].map(s => s.src).filter(src => src.includes('/assets/app/'));
        let drawn = 0;
        const draw = OfferApp.page.draw;
        OfferApp.page.draw = function () { drawn++; return draw.apply(this, arguments); };
        for (const t of [2, 6.5, 12.5, 14.8, 17]) {
          const before = drawn, s = document.getElementById('film-seek');
          s.value = t; s.dispatchEvent(new Event('input'));
          if ((drawn > before) !== (t > 3.4 && t < 15.7)) return {files, wrong: t};
        }
        OfferApp.page.draw = draw;
        return {files, drawn};
      });
      assert.equal(app.wrong, undefined, `the phone shows the app only between its entrance and the close (wrong at ${app.wrong})`);
      assert.equal(app.files.length, 8, 'all eight app modules load');
      assert(app.drawn >= 3, 'the app\'s page is drawn into the phone');

      await page.locator('[data-act=toggle]').focus();
      await page.keyboard.press('k');
      const held = (await state(page)).film;
      await page.waitForTimeout(600);
      assert.equal((await state(page)).film, held, 'K pauses picture and sound');
      assert.equal(await page.evaluate(() => document.getElementById('film-audio').paused), true);

      await page.locator('[data-act=captions]').click();
      await seekTo(page, 16.6);
      assert.equal(await page.locator('#film-cue').textContent(), 'Free and open source.');
      await seekTo(page, 4.2);
      assert.equal(await page.locator('#film-cue').textContent(), 'Set your minimums.');
      await page.locator('[data-act=captions]').click();
      assert.equal(await page.locator('#film-cue').isHidden(), true);

      await page.locator('[data-act=toggle]').click();
      await page.waitForFunction(() => !document.getElementById('film-audio').paused);
      await page.locator('#about-open').click();
      assert.equal(await page.evaluate(() => window.offerFilm.paused), true, 'opening a dialog pauses the film');
      await page.keyboard.press('Escape');

      await seekTo(page, 20.3);
      await page.locator('[data-act=toggle]').click();
      await page.waitForFunction(() => !document.getElementById('film-play').hidden, null, {timeout: 8000});
      const end = await state(page);
      assert.equal(end.playLabel, 'Replay film');
      assert.equal(end.film, 21);
      await page.locator('#film-play').click();
      await page.waitForFunction(() => +document.getElementById('film-seek').value > .4 && +document.getElementById('film-seek').value < 5);
      assert.deepEqual(errors, []);
      results.push({width, night, format, sky: here ? 'page thread' : 'worker', poster: look.poster.match(/film-poster-[a-z]+\.avif/)[0], fitsScreen: format !== 'landscape' || look.scroll <= 0, skyCycle: sky.map(x => x.mode).join(' '), sync: +(playing.film - playing.audio).toFixed(3), appScreens: app.files.length, keyboardPause: true, captions: true, dialogPauses: true, endAndReplay: true, noOverflow: true, noPageErrors: true});
      await page.close();
    }
    console.log(JSON.stringify({checkedAt: new Date().toISOString(), scope: 'Local Chromium, not phone or live-domain proof', results}, null, 2));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
