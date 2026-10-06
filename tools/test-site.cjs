#!/usr/bin/env node
'use strict';
// Local Chromium checks for the homepage and its live film player: poster, playback in sync with the
// soundtrack, keyboard pause, seeking, captions, dialogs pausing the film, the ending and replay.
// Local browser evidence only, not a phone or live-domain receipt.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.vtt':'text/vtt','.mp4':'video/mp4','.webm':'audio/webm','.m4a':'audio/mp4','.woff2':'font/woff2','.ttf':'font/ttf'};
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
    browser = await chromium.launch({headless: true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.CHROMIUM_EXECUTABLE_PATH} : {})});
    for (const [width, height, format] of [[1280, 800, 'landscape'], [400, 860, 'square']]) for (const night of [false, true]) {
      const page = await browser.newPage({viewport: {width, height}});
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(base, {waitUntil: 'networkidle'});
      if (night) await page.locator('#sky-toggle').click();
      await page.waitForFunction(() => document.getElementById('film-stage').classList.contains('drawn'));
      const poster = await page.evaluate(() => {
        const c = document.getElementById('film-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let painted = 0; for (let i = 3; i < d.length; i += 4 * 101) if (d[i] === 255) painted++;
        return {painted, samples: Math.floor(d.length / 404), width: c.width, height: c.height, overflow: document.documentElement.scrollWidth - innerWidth};
      });
      assert(poster.painted > poster.samples * .95, 'poster frame is drawn edge to edge');
      assert(poster.overflow <= 0, 'no horizontal overflow');
      assert.match(await page.getAttribute('#film-save', 'href'), new RegExp(`offer-filter-${format}\\.mp4`));

      await page.locator('#film-play').click();
      await page.waitForFunction(() => +document.getElementById('film-seek').value > 2.5, null, {timeout: 20000});
      const playing = await state(page);
      assert(Math.abs(playing.film - playing.audio) < .3, `film ${playing.film} follows audio ${playing.audio}`);
      assert(playing.quiet && playing.playHidden, 'scenery rests and the play button steps aside');
      assert.match(await page.evaluate(() => document.getElementById('film-audio').currentSrc), /film-soundtrack\.(webm|m4a)/);

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
      results.push({width, night, format, poster: `${poster.width}x${poster.height}`, sync: +(playing.film - playing.audio).toFixed(3), keyboardPause: true, captions: true, dialogPauses: true, endAndReplay: true, noOverflow: true, noPageErrors: true});
      await page.close();
    }
    console.log(JSON.stringify({checkedAt: new Date().toISOString(), scope: 'Local Chromium, not phone or live-domain proof', results}, null, 2));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
