#!/usr/bin/env node
/* Renders the film (assets/film.js) as the page draws it: headless Chromium draws each frame through
 * tools/film/render.html (its 3D art with WebGL, multisampled, under a 2D canvas of words and the app's screen) and
 * ffmpeg encodes the frames.
 *   node tools/render-film.cjs stills [out]       eight stills of each format and a contact sheet
 *   node tools/render-film.cjs captions [out]     the WebVTT captions, from OfferFilm.CAPTIONS
 *   node tools/render-film.cjs audit [out]        every frame's text-bounds audit, without video
 *   node tools/render-film.cjs posters [out]      the posters alone
 *   node tools/render-film.cjs <format> [out]     landscape | portrait | square: the MP4 (audited), and its posters
 * The soundtrack is <out>/soundtrack.wav (tools/film/make-audio.py). Needs Playwright's Chromium and ffmpeg; frames are
 * drawn by SwiftShader, so a render does not depend on the machine's GPU. */
const fs = require('fs'), path = require('path'), http = require('http'), {execFileSync} = require('child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const FORMATS = {landscape: [1920, 1080], portrait: [1080, 1920], square: [1080, 1080]};
// The posters: the JPEGs the page's MP4 fallback and link previews use, and the stage's own WebP pictures.
const POSTERS = {landscape: ['film-poster-wide', [1280, 720]], portrait: ['film-poster', null], square: ['film-poster-square', [900, 900]]};
const mode = process.argv[2] || 'stills', OUT = path.resolve(process.argv[3] || '/tmp/offer-filter-film');
fs.mkdirSync(OUT, {recursive: true});
const stamp = s => { const m = Math.floor(s / 60), r = (s - m * 60).toFixed(3).padStart(6, '0'); return `${String(m).padStart(2, '0')}:${r}`; };

// The repository over HTTP, so the render page can fetch the app's file list and fonts as the site does.
function serve() {
  const types = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.webp': 'image/webp'};
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const server = await serve(), base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  try {
    const page = await browser.newPage({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/tools/film/render.html`);
    await page.waitForFunction(() => window.film || window.failed, null, {timeout: 120000});
    const film = await page.evaluate(() => window.film || {failed: window.failed});
    if (film.failed) throw Error(film.failed);
    const {DURATION, FPS, POSTER, CAPTIONS} = film, FRAMES = Math.round(DURATION * FPS);
    const vtt = 'WEBVTT\n\nNOTE Generated from OfferFilm.CAPTIONS in assets/film.js, timed to the narration take\'s word boundaries.\n\n' +
      CAPTIONS.map(([a, b, s]) => `${stamp(a)} --> ${stamp(b)}\n${s}\n`).join('\n');
    const captions = path.join(OUT, 'film-captions.vtt');
    fs.writeFileSync(captions, vtt);
    if (mode === 'captions') return console.log(captions);
    // One frame as PNG bytes, and the visible text's bounds.
    const shot = async (t, w, h) => {
      const bounds = await page.evaluate(([t, w, h]) => window.renderFrame(t, w, h), [t, w, h]);
      return {bounds, png: await page.screenshot({type: 'png', clip: {x: 0, y: 0, width: w, height: h}})};
    };
    // The closing frame as the format's JPEG poster and, for the stage, a smaller WebP.
    const posters = async (name, w, h) => {
      const still = path.join(OUT, `poster-${name}.png`), [poster, small] = POSTERS[name];
      fs.writeFileSync(still, (await shot(POSTER, w, h)).png);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', still, '-q:v', '2', path.join(OUT, `${poster}.jpg`)]);
      if (small) execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', still, '-vf', `scale=${small[0]}:${small[1]}:flags=lanczos`, '-c:v', 'libwebp', '-quality', '80', '-compression_level', '6', path.join(OUT, `${poster}.webp`)]);
    };
    for (const [name, [w, h]] of Object.entries(FORMATS)) {
      if (!['stills', 'audit', 'posters', name].includes(mode)) continue;
      await page.setViewportSize({width: w, height: h});
      if (mode === 'stills') {
        const times = [2.6, 4.7, 6.5, 10.5, 12.9, 14.9, 17.9, POSTER], files = [];
        for (let i = 0; i < times.length; i++) { const file = path.join(OUT, `${name}-${i}.png`); fs.writeFileSync(file, (await shot(times[i], w, h)).png); files.push(file); }
        const tw = name === 'portrait' ? 270 : 480, th = Math.round(h * tw / w);
        const tiles = files.map((f, i) => `[${i}:v]scale=${tw}:${th}[v${i}]`).join(';') + ';' + files.map((f, i) => `[v${i}]`).join('') +
          `xstack=inputs=${files.length}:layout=${files.map((f, i) => `${i % 4 * tw}_${Math.floor(i / 4) * th}`).join('|')}[o]`;
        execFileSync('ffmpeg', ['-y', '-v', 'error', ...files.flatMap(f => ['-i', f]), '-filter_complex', tiles, '-map', '[o]', '-q:v', '3', path.join(OUT, `contact-${name}.jpg`)]);
        continue;
      }
      if (mode === 'posters') { await posters(name, w, h); continue; }
      const violations = [], minima = {left: Infinity, top: Infinity, right: Infinity, bottom: Infinity}, byScene = {};
      // Each frame (and its text bounds) is kept on disk as it is drawn, so an interrupted render resumes where it
      // stopped; the frames are encoded once all are there, and then removed.
      const frames = path.join(OUT, `frames-${name}`);
      if (mode !== 'audit') fs.mkdirSync(frames, {recursive: true});
      for (let f = 0; f < FRAMES; f++) {
        const t = f / FPS, png = path.join(frames, `${String(f).padStart(4, '0')}.png`), json = png.replace(/png$/, 'json');
        let bounds;
        if (mode !== 'audit' && fs.existsSync(png) && fs.existsSync(json)) bounds = JSON.parse(fs.readFileSync(json, 'utf8'));
        else if (mode === 'audit') bounds = await page.evaluate(([t, w, h]) => window.renderFrame(t, w, h), [t, w, h]);
        else { const frame = await shot(t, w, h); fs.writeFileSync(png, frame.png); fs.writeFileSync(json, JSON.stringify(frame.bounds)); bounds = frame.bounds; }
        for (const b of bounds) {
          minima.left = Math.min(minima.left, b.left); minima.top = Math.min(minima.top, b.top);
          minima.right = Math.min(minima.right, w - b.right); minima.bottom = Math.min(minima.bottom, h - b.bottom);
          byScene[b.scene] = (byScene[b.scene] || 0) + 1;
          if (b.left < 24 || b.top < 24 || b.right > w - 24 || b.bottom > h - 24) violations.push({frame: f, ...b});
        }
        if (f % 150 === 0) console.log(`${name}: ${f}/${FRAMES}`);
      }
      if (mode !== 'audit') {
        const wav = path.join(OUT, 'soundtrack.wav');
        if (!fs.existsSync(wav)) throw Error(`${wav} is missing: run python3 tools/film/make-audio.py ${OUT}`);
        // Captions ride along as a soft subtitle track, so a saved film keeps them.
        execFileSync('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-framerate', String(FPS), '-i', path.join(frames, '%04d.png'), '-i', wav, '-i', captions,
          '-map', '0:v', '-map', '1:a', '-map', '2:s', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-tune', 'animation', '-threads', '4', '-pix_fmt', 'yuv420p',
          '-c:a', 'aac', '-b:a', '192k', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng', '-movflags', '+faststart', '-frames:v', String(FRAMES),
          '-t', String(DURATION), '-map_metadata', '-1', path.join(OUT, `offer-filter-${name}.mp4`)], {stdio: 'inherit'});
      }
      const report = {format: name, width: w, height: h, frames: FRAMES, fps: FPS, duration: DURATION, renderer: film.renderer, minimumTextMargins: minima, checkedTextDraws: byScene, violations};
      fs.writeFileSync(path.join(OUT, `${name}-text-validation.json`), JSON.stringify(report, null, 2) + '\n');
      if (violations.length) throw Error(`${name}: ${violations.length} text boundary violations; see report`);
      if (mode !== 'audit') { await posters(name, w, h); fs.rmSync(frames, {recursive: true, force: true}); }
      console.log(`${name}: finished; all visible text inside safe frame`);
    }
    if (errors.length) throw Error('page errors: ' + errors.join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
