#!/usr/bin/env node
'use strict';
/*
 * Local Chromium checks for offerfilter.org:   node tools/test-launch-help.cjs
 *
 * Serves the site the way GitHub Pages does (directory index files, 404.html for missing paths) and checks:
 * no horizontal overflow at 360 and 1366 px, no console errors, every internal link and asset resolves, the
 * download button is labelled from assets/release.json, the install steps (every risk statement, and the 0.5.0
 * guide's words with none of the retired ones) and legal pages are present, the
 * feedback form's messages for 201/429/400/413/offline/network/timeout, the dialogs and their addresses
 * (#help, #feedback, ...), reduced motion and the 30 fps cap, and that a phone fetches one poster and one small
 * signature image.
 *
 * It also checks dark mode (the home page starts at night; the reading pages switch palette, with readable contrast),
 * the iPhone visitor's path, the film's controls, and that the landscape copies its still backdrop instead of
 * redrawing it.
 *
 * Release gates come last. The site may be deployed only when they pass: the legal pages carry no drafting notes,
 * the app's own privacy text names the same private contact as the site, and once assets/release.json is 0.5.0 or
 * later, the terms and privacy describe Autopilot and drop the retired area mode and 0.4.73 wording. A failed gate
 * fails the run with "NOT READY TO DEPLOY", after every other check has run and passed.
 *
 * Nothing leaves this machine: every request that is not to the local server is answered by a fake or aborted, so
 * the real feedback endpoint never receives anything. Needs Playwright with Chromium (set CHROMIUM_EXECUTABLE_PATH
 * to use a specific browser binary).
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const FEEDBACK = 'https://zlnfvqyyjsltmkmmpgzp.supabase.co/functions/v1/offer-filter-feedback';
const APK = 'https://dash-offer-filter-build.onrender.com/OfferFilter.apk';
const CONTACT = 'privacy@offerfilter.org';
// The same notes tools/build-legal.py refuses (DRAFT_MARKERS there).
const DRAFT_MARKERS = /have a lawyer|not legal advice|no attorney review|draft of \d|not yet configured|to add before public release|\b(?:TODO|TBD|FIXME)\b/i;
const AUTOPILOT_VERSION_CODE = 80; // 0.5.0
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const PAGES = ['/', '/install/', '/privacy/', '/terms/', '/license/', '/404.html'];
const WIDTHS = [360, 1366];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.vtt': 'text/vtt',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.xml': 'application/xml',
  '.txt': 'text/plain', '.md': 'text/markdown', '.mp3': 'audio/mpeg',
};

function loadPlaywright() {
  try { return require('playwright'); } catch (error) {
    // A global install next to this Node (e.g. /usr/local/lib/node_modules/playwright).
    return require(path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'playwright'));
  }
}

function serve() {
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(301, {Location: pathname + '/'}).end(); return; }
      file = path.join(file, 'index.html');
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, {'Content-Type': MIME['.html']}).end(fs.readFileSync(path.join(root, '404.html')));
      return;
    }
    res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function get(base, url) {
  return new Promise((resolve, reject) => {
    http.get(new URL(url, base), res => { res.resume(); res.on('end', () => resolve(res.statusCode)); }).on('error', reject);
  });
}

// Every visible piece of text, inside the page or an open dialog, is at least 11 px.
const smallText = () => {
  const small = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const element = node.parentElement;
    if (!node.textContent.trim() || !element || element.closest('script,style,noscript,video,dialog:not([open])')) continue;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || getComputedStyle(element).visibility === 'hidden') continue;
    const size = parseFloat(getComputedStyle(element).fontSize);
    if (size < 11) small.push(`${size}px "${node.textContent.trim().slice(0, 40)}"`);
  }
  return small;
};

// Contrast of the reading pages' text against every background it sits on (the sky gradient's stops, the callout,
// the platform note, the primary button, the 0.5.0 tag). Colors come from the page's own CSS variables.
const readingContrast = () => {
  const probe = document.createElement('i');
  document.body.appendChild(probe);
  const rgb = value => {
    probe.style.color = '';
    probe.style.color = value;
    const [r, g, b] = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
    return [r, g, b];
  };
  const lum = c => c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const css = getComputedStyle(document.documentElement);
  const v = name => css.getPropertyValue(name).trim();
  const out = {};
  const check = (name, fg, backgrounds) => { out[name] = +Math.min(...backgrounds.map(bg => ratio(fg, bg))).toFixed(2); };
  const sky = [v('--sky-top'), v('--sky-mid'), v('--sky-low')];
  check('text', v('--text'), [...sky, v('--sand')]);
  check('muted', v('--muted'), [...sky, v('--sand')]);
  check('links and headings', v('--ink'), [...sky, v('--sand'), v('--sage')]);
  check('button', v('--on-ink'), [v('--ink'), v('--ink-hover')]);
  check('note and tag', v('--ink'), [v('--sage')]);
  probe.remove();
  return out;
};

const release = JSON.parse(fs.readFileSync(path.join(root, 'assets/release.json'), 'utf8'));
const releaseSize = release.sizeBytes >= 1e6 ? (release.sizeBytes / 1e6).toFixed(1) + ' MB' : Math.round(release.sizeBytes / 1e3) + ' KB';
const results = [];
const pass = (name, detail) => { results.push(detail === undefined ? name : `${name}: ${detail}`); };
const gates = {passed: [], failed: []};
const gate = (name, ok, detail) => { (ok ? gates.passed : gates.failed).push(ok || !detail ? name : `${name}: ${detail}`); };

async function main() {
  const {chromium} = loadPlaywright();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath: process.env.CHROMIUM_EXECUTABLE_PATH} : {})});
  const escaped = [];

  // A context that cannot reach the internet. Pages see the feedback endpoint only through fakes set per test.
  async function context(options = {}) {
    const ctx = await browser.newContext(options);
    await ctx.route(url => !url.href.startsWith(base), route => {
      escaped.push(route.request().method() + ' ' + route.request().url());
      return route.abort('blockedbyclient');
    });
    return ctx;
  }
  function watch(page) {
    const errors = [];
    page.on('pageerror', error => errors.push('pageerror: ' + error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push('console: ' + message.text()); });
    return errors;
  }

  try {
    // 1. Every page: no overflow, no console errors, nothing external on load, every local reference resolves.
    const checkedUrls = new Map();
    for (const width of WIDTHS) {
      const ctx = await context({viewport: {width, height: 860}});
      for (const pathname of PAGES) {
        const page = await ctx.newPage();
        const errors = watch(page);
        const response = await page.goto(base + pathname, {waitUntil: 'networkidle'});
        assert.equal(response.status(), 200, pathname + ' status');
        await page.evaluate(() => document.fonts.ready);
        assert.deepEqual(await page.evaluate(smallText), [], `${pathname} at ${width}px has text under 11px`);
        const bounds = await page.evaluate(() => ({scroll: document.documentElement.scrollWidth, viewport: innerWidth}));
        assert(bounds.scroll <= bounds.viewport, `${pathname} at ${width}px overflows: ${JSON.stringify(bounds)}`);
        const refs = await page.evaluate(() => {
          const out = [];
          const add = (value, kind) => { if (value) out.push({value, kind}); };
          document.querySelectorAll('a[href]').forEach(a => add(a.getAttribute('href'), 'a'));
          document.querySelectorAll('link[href]').forEach(l => add(l.getAttribute('href'), 'link'));
          document.querySelectorAll('script[src],img[src],source[src],track[src]').forEach(e => add(e.getAttribute('src'), 'asset'));
          document.querySelectorAll('img[srcset],source[srcset]').forEach(e => e.getAttribute('srcset').split(',').forEach(s => add(s.trim().split(/\s+/)[0], 'asset')));
          document.querySelectorAll('video').forEach(v => { add(v.getAttribute('poster'), 'asset'); Object.values(v.dataset).forEach(d => add(d, 'asset')); });
          document.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"]').forEach(m => { if (/^https?:/.test(m.content)) add(m.content, 'meta'); });
          return out;
        });
        for (const {value, kind} of refs) {
          assert(!/^http:\/\//.test(value), `${pathname}: insecure link ${value}`);
          assert(!/dillxn\.github\.io|offer-filter-site\/(tree|blob)\/app-source/.test(value), `${pathname}: stale link ${value}`);
          if (value.startsWith('#')) {
            const name = value.slice(1);
            if (!name) continue;
            const exists = await page.evaluate(n => !!(document.getElementById(n) || document.getElementById(n + '-dialog')), name);
            assert(exists, `${pathname}: ${value} has no target`);
            continue;
          }
          let url = new URL(value, base + pathname);
          if (url.origin === 'https://offerfilter.org') url = new URL(url.pathname + url.search + url.hash, base);
          if (url.origin !== base) { assert(/^https:|^mailto:/.test(url.href), `${pathname}: ${value}`); continue; }
          if (kind === 'a' && url.hash) {
            const target = url.pathname;
            checkedUrls.set(url.pathname + url.hash, {target, hash: url.hash});
          }
          const key = url.pathname + url.search;
          if (!checkedUrls.has(key)) checkedUrls.set(key, await get(base, key));
          assert.equal(checkedUrls.get(key), 200, `${pathname}: ${value} → ${checkedUrls.get(key)}`);
        }
        assert.deepEqual(errors, [], `${pathname} at ${width}px errors`);
        await page.close();
      }
      await ctx.close();
    }
    // Hash links to other pages point at real targets (#help, #feedback, #this-website ...).
    const ctxHash = await context({viewport: {width: 1366, height: 860}});
    const hashPage = await ctxHash.newPage();
    for (const [key, entry] of checkedUrls) {
      if (typeof entry !== 'object') continue;
      await hashPage.goto(base + entry.target, {waitUntil: 'domcontentloaded'});
      const name = entry.hash.slice(1);
      const exists = await hashPage.evaluate(n => !!(document.getElementById(n) || document.getElementById(n + '-dialog')), name);
      assert(exists, `link ${key} has no target`);
    }
    await ctxHash.close();
    // CSS url()s, the sitemap and robots.txt resolve too; GitHub Pages' 404 page answers missing paths.
    for (const sheet of ['style.css', 'doc.css']) {
      const css = fs.readFileSync(path.join(root, sheet), 'utf8');
      for (const [, ref] of css.matchAll(/url\(([^)]+)\)/g)) {
        assert.equal(await get(base, '/' + ref.replace(/["']/g, '').split('?')[0]), 200, `${sheet}: ${ref}`);
      }
    }
    const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
    const listed = [...sitemap.matchAll(/<loc>https:\/\/offerfilter\.org([^<]*)<\/loc>/g)].map(m => m[1]);
    assert.deepEqual(listed, ['/', '/install/', '/privacy/', '/terms/', '/license/']);
    for (const loc of listed) assert.equal(await get(base, loc), 200, 'sitemap ' + loc);
    assert.match(fs.readFileSync(path.join(root, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/offerfilter\.org\/sitemap\.xml/);
    assert.equal(await get(base, '/no-such-page/'), 404);
    for (const width of WIDTHS) {
      const ctx = await context({viewport: {width, height: 760}});
      const page = await ctx.newPage();
      for (const name of ['help', 'feedback', 'about', 'tip']) {
        await page.goto(base + '/#' + name, {waitUntil: 'networkidle'});
        assert(await page.locator(`#${name}-dialog`).evaluate(d => d.open), name + ' opens');
        assert.deepEqual(await page.evaluate(smallText), [], `#${name} at ${width}px has text under 11px`);
        const fit = await page.locator(`#${name}-dialog`).evaluate(d => ({scroll: d.scrollWidth, client: d.clientWidth, right: d.getBoundingClientRect().right}));
        assert(fit.scroll <= fit.client && fit.right <= width, `#${name} at ${width}px overflows: ${JSON.stringify(fit)}`);
      }
      await ctx.close();
    }
    pass('pages', `${PAGES.length} pages and 4 dialogs at ${WIDTHS.join(' and ')} px: no overflow, no text under 11px, no console errors, ${checkedUrls.size} local URLs resolve`);

    // 2. One cache-buster for every local asset reference.
    const tokens = new Set();
    for (const file of ['index.html', 'install/index.html', 'privacy/index.html', 'terms/index.html', 'license/index.html', '404.html', 'style.css', 'doc.css', 'install/install.js']) {
      const text = fs.readFileSync(path.join(root, file), 'utf8');
      for (const [, ref, token] of text.matchAll(/(?:href|src|srcset|url\(|data-[\w-]+)=?["(]?([^"')\s]+\.(?:css|js|png|jpg|webp|svg|woff2|mp4|vtt))(?:\?v=([\w.-]+))?/g)) {
        if (/^https?:/.test(ref)) continue;
        assert(token, `${file}: ${ref} has no ?v= cache-buster`);
        tokens.add(token);
      }
    }
    assert.equal(tokens.size, 1, 'cache-busters differ: ' + [...tokens].join(', '));
    pass('cache-busters', [...tokens][0]);

    // 3. Payload: a phone fetches one poster, the small signature once, WOFF2 fonts only, never the 818 KB master.
    for (const width of WIDTHS) {
      const ctx = await context({viewport: {width, height: 860}});
      const page = await ctx.newPage();
      const fetched = [];
      page.on('request', request => fetched.push(new URL(request.url()).pathname));
      await page.goto(base + '/', {waitUntil: 'networkidle'});
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForLoadState('networkidle');
      const count = re => fetched.filter(p => re.test(p)).length;
      assert.equal(count(/film-poster/), 1, `posters at ${width}px: ${fetched.filter(p => /poster/.test(p))}`);
      assert.equal(count(width <= 600 ? /film-poster-square\.webp$/ : /film-poster-wide\.webp$/), 1);
      assert.equal(count(/jesus-loves-you-signature\.(webp|png)$/), 1, 'signature fetched once');
      assert.equal(count(/jesus-loves-you-emblem\.png$/), 0, 'emblem master not fetched');
      assert.equal(count(/\.ttf$/), 0, 'no TTF fonts');
      assert(count(/baloo2-latin\.woff2$/) === 1 && count(/atkinson-latin\.woff2$/) === 1, 'WOFF2 fonts once each');
      assert.equal(count(/\.mp4$/), 0, 'film not fetched before play');
      await ctx.close();
    }
    pass('payload', 'one poster per layout, one signature image, WOFF2 fonts, no film until Play');

    // 4. The download: labelled from release.json, and a plain link that works without JavaScript.
    {
      const ctx = await context({viewport: {width: 360, height: 800}});
      const page = await ctx.newPage();
      await page.goto(base + '/install/', {waitUntil: 'networkidle'});
      const button = page.locator('#download-apk');
      const label = `Download Offer Filter ${release.versionName} · ${releaseSize}`;
      await page.waitForFunction(text => document.getElementById('download-apk').textContent.includes(text), label);
      assert.equal((await button.textContent()).replace('↓', '').trim(), label);
      assert.equal(await button.getAttribute('href'), release.apkUrl);
      assert.equal(release.apkUrl, APK);
      assert.equal(await page.locator('#download-sha').textContent(), release.sha256);
      assert.match(await page.locator('#download-meta').textContent(), new RegExp('Version ' + release.versionName.replace(/\./g, '\\.')));
      // At 360 px the version and size sit on their own line, whole, under "Download Offer Filter".
      const lines = await page.evaluate(() => {
        const [name, version] = document.querySelectorAll('#download-apk .download-text > span');
        const a = name.getBoundingClientRect(), b = version.getBoundingClientRect();
        return {nameBottom: a.bottom, versionTop: b.top, versionLines: Math.round(b.height / parseFloat(getComputedStyle(version).lineHeight))};
      });
      assert(lines.versionTop >= lines.nameBottom - 1, 'version on its own line: ' + JSON.stringify(lines));
      assert.equal(lines.versionLines, 1, 'version and size kept on one line: ' + JSON.stringify(lines));
      // While the published app is older than the guide's beta, the note sits right under the download facts.
      const upcoming = Number(await page.locator('#whats-new').getAttribute('data-version-code'));
      assert.equal(await page.locator('#beta-pending').isVisible(), release.versionCode < upcoming, 'pending-release note');
      assert.equal(await page.evaluate(() => document.getElementById('download-meta').nextElementSibling.id), 'beta-pending');
      if (release.versionCode < upcoming) {
        const note = await page.locator('#beta-pending').textContent();
        assert(note.includes(release.versionName) && note.includes('New in 0.5.0'), 'pending note: ' + note);
        const gap = await page.evaluate(() => document.getElementById('beta-pending').getBoundingClientRect().top - document.getElementById('download-apk').getBoundingClientRect().bottom);
        assert(gap < 200, 'pending note close to the button: ' + gap);
      }
      await ctx.close();
      // iPhone: no APK button (it can't be installed there), a way to send the page to an Android phone instead.
      const iphone = await context({viewport: {width: 390, height: 844}, userAgent: IPHONE_UA, isMobile: true, hasTouch: true});
      await iphone.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: base});
      const ios = await iphone.newPage();
      await ios.addInitScript(() => { Object.defineProperty(navigator, 'share', {value: undefined}); });
      await ios.goto(base + '/install/', {waitUntil: 'networkidle'});
      assert(await ios.locator('#platform-note').isVisible(), 'iPhone note');
      assert.match(await ios.locator('#platform-note').textContent(), /isn’t available for iPhone or iPad/);
      assert(!(await ios.locator('#download-apk').isVisible()) && !(await ios.locator('#download-meta').isVisible()), 'no APK button on iPhone');
      await ios.click('#share-link');
      await ios.waitForFunction(() => document.getElementById('share-link').textContent === 'Link copied');
      assert.equal(await ios.evaluate(() => navigator.clipboard.readText()), 'https://offerfilter.org/install/');
      await iphone.close();
      const noJs = await context({viewport: {width: 360, height: 800}, javaScriptEnabled: false});
      const plain = await noJs.newPage();
      await plain.goto(base + '/', {waitUntil: 'load'});
      await plain.click('#download-open');
      await plain.waitForURL(base + '/install/');
      assert.equal(await plain.locator('#download-apk').getAttribute('href'), APK);
      assert.match(await plain.locator('#download-apk').textContent(), /Download Offer Filter/);
      await noJs.close();
      pass('download', `"${label}" → ${APK}, version on its own line; pending note under it; works without JavaScript; iPhone gets a link to share instead`);
    }

    // 5. Install steps, visible risk text, legal pages and the links to them.
    {
      const ctx = await context({viewport: {width: 360, height: 800}});
      const page = await ctx.newPage();
      await page.goto(base + '/install/', {waitUntil: 'networkidle'});
      const text = await page.locator('main').innerText();
      // Risk statements first: none of these may ever be dropped.
      for (const phrase of ['It’s a beta.', 'It can misread an offer, decline one you wanted', 'Check your Dasher history',
        'Declines can lower your acceptance rate.', 'best effort, not a promise', 'your rate rises only when you accept offers',
        'Nothing here guarantees a rate or any earnings', 'It’s independent.', 'may conflict with DoorDash’s terms',
        'DoorDash could limit or deactivate your account', 'It needs two Android permissions',
        'Accessibility, to read Dasher’s screen and tap Decline', 'notification access, to see Dasher’s offer alerts',
        'Peek, on by default', 'uses more battery', 'never wakes or unlocks', 'Set it up while parked.',
        'Don’t handle your phone while driving', 'File might be harmful', 'Download anyway', 'Play Protect', 'Scan app',
        'If Play Protect says the app is harmful', 'stop there', 'Never turn Play Protect off', 'Auto Blocker',
        'Settings → Security and privacy → Auto Blocker', 'Turning it off lowers that protection for every app',
        'I understand and accept', 'Auto-accept stays off unless you turn it on separately', 'acceptance rate', 'DoorDash',
        'driving', 'Autopilot can only stop declining', 'never auto-accepted']) {
        assert(text.includes(phrase), 'install page lacks the risk statement: ' + phrase);
      }
      // The 0.5.0 guide: install, the homepage's setup steps (restricted settings first), three minimums, Autopilot's
      // question, driving layouts, Peek, the screen held during a dash, paused, feedback.
      for (const phrase of ['Allow from this source', 'Restricted setting', 'Allow restricted settings', 'App info',
        'App was denied access', 'Controlled by Restricted Setting', 'Settings → Accessibility → Installed apps',
        'Try the switch', 'within ten minutes', 'N more to set up', 'Turn on Offer Filter in Accessibility',
        'Allow notification access', 'Offer Filter background offers', 'Allow alerts',
        'Allow Offer Filter to send you notifications?', 'Allow updates', 'Update ready · Install now',
        'Turn Offer Filter off and on in Accessibility', 'Reconnect notification access', 'minimum pay', 'pay per mile',
        'pay per hour', 'max stops', 'no per-item or per-stop minimum', 'Tap to start with typical minimums',
        'Your rules are simpler now', 'Autopilot', 'What matters more?', 'Keep a top tier', 'acceptance rate 70% or more',
        'Suggested and preselected', 'Keep a tier', 'acceptance rate 50% or more', 'Pay first',
        'no acceptance-rate goal', 'Long-press the Auto button', 'from 50% to 150%',
        'check the Dasher app for your current requirements', 'Earn per Offer', 'Earn by Time', 'Dasher full screen',
        'Google Maps or Waze full screen', 'Peek', 'Maps and Dasher in split screen', 'split screen', 'for planning',
        'Back to map', 'Tap the mascot', 'Paused means Offer Filter isn’t reading Dasher at all',
        'Paused: Offer Filter is not reading Dasher', 'Peek waits for Dasher’s offer', 'unlock within 40 seconds',
        'keeps your screen from timing out', 'the power button still turns the screen off', 'Peek pauses while your phone is locked',
        'Send anonymous feedback', 'feedback form', 'Android 8', 'New in 0.5.0', 'Attach masked diagnostics',
        'Share anonymous diagnostics after each dash', 'Both start off', 'The screens you’re most likely to see']) {
        assert(text.includes(phrase), 'install page lacks: ' + phrase);
      }
      // Retired in 0.5.0: per-minute and per-item rules, and the setup labels the homepage checklist replaced (Settings'
      // "Updates can't install" became the homepage's Allow updates step).
      for (const stale of ['items on shopping orders', 'items for shopping orders', 'Every screen your phone may show',
        'anonymous diagnostics is optional', 'pay per minute', 'pay per item', 'Updates can’t install', 'Screen reading is off',
        'Background offers are off', 'Alerts are blocked', 'combined area score', 'Keep the learning you choose']) {
        assert(!text.includes(stale), 'install page still says: ' + stale);
      }
      assert(!/exact setup steps/.test(await page.locator('meta[property="og:description"]').getAttribute('content')), 'og:description overclaims');
      // "Before you install" names the two permissions and Peek before anyone installs.
      const before = await page.locator('#before-title + ul').innerText();
      assert(/Accessibility/.test(before) && /notification access/.test(before) && /Peek, on by default/.test(before), 'Before you install: permissions and Peek');
      const steps = await page.locator('ol.steps > li').count();
      assert(steps >= 17, 'install steps: ' + steps);
      // Numbering continues across the guide's sections (each list's start follows the previous list).
      const starts = await page.evaluate(() => [...document.querySelectorAll('ol.steps')].map(ol => [ol.start, ol.children.length]));
      starts.reduce((next, [start, length]) => { assert.equal(start, next, 'step numbering'); return start + length; }, 1);
      const risk = await page.locator('#before-title + ul li').first().evaluate(li => ({size: parseFloat(getComputedStyle(li).fontSize), opacity: getComputedStyle(li).opacity}));
      assert(risk.size >= 15 && risk.opacity === '1', 'risk text size ' + JSON.stringify(risk));
      for (const link of ['../terms/', '../privacy/', '../license/']) assert(await page.locator(`a[href="${link}"]`).count(), 'install page links ' + link);
      for (const [pathname, phrases] of [
        ['/terms/', ['terms of use', 'Acceptance-rate risk', 'No warranty']],
        ['/privacy/', ['This website', 'GitHub Pages', 'No cookies, no analytics', 'Supabase', 'Cloudflare', '90 days', 'Claude', 'ChatGPT/Codex', 'Cash App', 'Contact.', CONTACT]],
        ['/license/', ['MIT License', 'Permission is hereby granted', 'Dillxn/dasher-offer-filter']],
      ]) {
        await page.goto(base + pathname, {waitUntil: 'networkidle'});
        const body = await page.locator('main').innerText();
        for (const phrase of phrases) assert(body.toLowerCase().includes(phrase.toLowerCase()), `${pathname} lacks ${phrase}`);
        assert.equal(await page.locator('h1').count(), 1, pathname + ' h1');
      }
      await page.goto(base + '/', {waitUntil: 'networkidle'});
      for (const link of ['privacy/', 'terms/', 'license/']) {
        assert(await page.locator(`footer a[href="${link}"]`).count(), 'footer links ' + link);
        assert(await page.locator(`#help-dialog a[href="${link}"]`).count(), 'help links ' + link);
      }
      assert.equal(await page.locator('footer a[href="https://github.com/Dillxn/dasher-offer-filter"]').textContent(), 'Source code (MIT)');
      assert(await page.locator('#about-dialog a[href="https://github.com/Dillxn/dasher-offer-filter"]').count(), 'About source link');
      assert(await page.locator('#about-dialog a[href="https://github.com/Dillxn/offer-filter-site"]').count(), 'About website source');
      const copy = await page.evaluate(() => document.body.textContent);
      assert(!/GitHub account/i.test(copy), 'no GitHub-account copy');
      assert(copy.includes('No account needed'), 'No account needed');
      // The home page doesn't read release.json, so it says which version it describes: the 0.5.0 beta's three
      // minimums, Autopilot's question, the homepage setup steps, the driving layouts, Peek and paused.
      const about = await page.locator('#about-dialog').textContent();
      for (const phrase of ['Set three minimums', 'pay per mile', 'pay per hour', 'the most stops you’ll take',
        'New in 0.5.0', 'Autopilot', 'acceptance-rate goal', 'always yours to decide']) {
        assert(about.includes(phrase), 'About lacks: ' + phrase);
      }
      const help = await page.locator('#help-dialog').textContent();
      for (const phrase of ['0.5.0 public beta', 'acceptance-rate and account risks', 'I understand and accept',
        'Restricted setting', 'App was denied access', 'Allow restricted settings', 'Turn on Offer Filter in Accessibility',
        'Allow notification access', 'Allow alerts', 'Allow updates', 'Set three minimums', 'minimum pay', 'pay per mile',
        'pay per hour', 'max stops', 'What matters more?', 'keep a top tier', 'acceptance rate 70% or more, suggested',
        'keep a tier', '50% or more', 'pay first', 'Long-press', 'Earn per Offer', 'Earn by Time',
        'Dasher full screen and Offer Filter’s tab', 'Google Maps or Waze full screen with Peek',
        'Maps and Dasher in split screen with the tab', 'for planning while parked', 'Peek waits for Dasher',
        'unlock within 40 seconds', 'never woken or unlocked', 'the power button still turns it off',
        'In Offer Filter, tap the mascot on its home screen', 'doesn’t read Dasher at all', 'turn off Auto-accept',
        'A beta, not a guarantee of reliability', 'best effort, not a promise', 'Never handle your phone while driving']) {
        assert(help.toLowerCase().includes(phrase.toLowerCase()), 'Help lacks: ' + phrase);
      }
      assert(!/items on shopping orders|items for shopping orders|pay per item|pay per minute|Updates can’t install|From 0\.5\.0:/.test(copy),
        'home page still has retired wording');
      // The home page says it's independent, in the footer, readable size.
      const independent = page.locator('footer .independent');
      assert.equal((await independent.textContent()).trim(), 'Offer Filter is independent and isn’t affiliated with DoorDash.');
      assert.equal(await independent.evaluate(el => getComputedStyle(el).fontSize), '13px');
      // One private address, for privacy, deletion and security only, on the Help dialog and every reading page.
      assert(await page.locator(`#help-dialog a[href="mailto:${CONTACT}"]`).count(), 'Help names the private contact');
      for (const pathname of ['/install/', '/privacy/', '/terms/', '/license/', '/404.html']) {
        await page.goto(base + pathname, {waitUntil: 'domcontentloaded'});
        assert.equal(await page.locator(`.site-footer .contact a[href="mailto:${CONTACT}"]`).count(), 1, pathname + ' footer contact');
        const mail = await page.evaluate(() => [...document.querySelectorAll('a[href^="mailto:"]')].map(a => a.getAttribute('href')));
        assert(mail.every(href => href === 'mailto:' + CONTACT), pathname + ' mail links: ' + mail);
      }
      await ctx.close();
      pass('content', `${steps} install steps, risk text at ${risk.size}px, terms/privacy/license present and linked; the 0.5.0 guide (three minimums, Autopilot's question, the homepage setup steps, driving layouts, Peek, paused) marked; independence line and private contact on every page`);
    }

    // 6. Feedback: each response maps to an honest message; text is kept on failure; nothing real is sent.
    {
      const ctx = await context({viewport: {width: 360, height: 800}});
      const page = await ctx.newPage();
      const errors = watch(page);
      await page.clock.install();
      let mode = 'none';
      const sent = [];
      const cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS'};
      await page.route(FEEDBACK, route => {
        const request = route.request();
        if (request.method() === 'OPTIONS') return route.fulfill({status: 204, headers: cors});
        sent.push(JSON.parse(request.postData()));
        if (mode === 'created') return route.fulfill({status: 201, headers: cors, contentType: 'application/json', body: '{"ok":true,"reference":"abcd1234"}'});
        if (mode === 'rate') return route.fulfill({status: 429, headers: cors, contentType: 'application/json', body: '{"ok":false,"error":"rate_limited"}'});
        if (mode === 'invalid') return route.fulfill({status: 400, headers: cors, contentType: 'application/json', body: '{"ok":false,"error":"invalid_feedback"}'});
        if (mode === 'large') return route.fulfill({status: 413, headers: cors, contentType: 'application/json', body: '{"ok":false,"error":"too_large"}'});
        if (mode === 'server') return route.fulfill({status: 502, headers: cors, contentType: 'application/json', body: '{"ok":false,"error":"temporarily_unavailable"}'});
        if (mode === 'network') return route.abort('internetdisconnected');
        if (mode === 'hang') return undefined; // never answers
        return route.abort('failed');
      });
      await page.goto(base + '/#feedback', {waitUntil: 'networkidle'});
      assert(await page.locator('#feedback-dialog').evaluate(d => d.open), '#feedback opens the form');
      const field = page.locator('#feedback-message'), status = page.locator('#feedback-status');
      const send = async () => { await page.click('#feedback-submit'); };
      const expectStatus = async text => { await page.waitForFunction(t => document.getElementById('feedback-status').textContent === t, text, {timeout: 5000}); };

      await field.fill('   \n\t  ');
      await send();
      await expectStatus('Please type a message first.');
      assert.equal(await field.getAttribute('aria-invalid'), 'true');
      assert.equal(sent.length, 0, 'whitespace is not sent');

      await field.fill('abc');
      assert.equal(await page.locator('#feedback-count').textContent(), '3 / 4,000');
      assert.equal(await field.getAttribute('aria-invalid'), null, 'typing clears the error');
      await field.fill('x'.repeat(3900));
      assert.equal(await page.locator('#feedback-count').textContent(), '3,900 / 4,000');
      assert(await page.locator('#feedback-count.near-limit').count(), 'counter warns near the limit');
      assert.equal(await field.getAttribute('maxlength'), '4000');

      const message = '  The pass chime played twice.  ';
      const cases = [
        ['rate', 'Too many messages from this connection. Your message is still here; try again in about 10 minutes.'],
        ['invalid', 'That message couldn’t be accepted. Shorten it and try again; your text is still here.'],
        ['large', 'That message couldn’t be accepted. Shorten it and try again; your text is still here.'],
        ['server', 'The feedback service isn’t available right now. Your message is still here; please try again later.'],
        ['network', 'Couldn’t reach the feedback service. Your message is still here; check your connection and try again.'],
      ];
      for (const [name, expected] of cases) {
        mode = name;
        await field.fill(message);
        await send();
        await expectStatus(expected);
        assert.equal(await field.inputValue(), message, name + ': message kept');
        assert.equal(await page.locator('#feedback-submit').isDisabled(), false, name + ': button usable again');
      }
      mode = 'hang';
      await send();
      await expectStatus('Sending…');
      assert(await page.locator('#feedback-submit').isDisabled(), 'button disabled while sending');
      await page.clock.runFor(15100);
      await expectStatus('No answer after 15 seconds. Your message is still here; try again when your signal is better.');
      assert.equal(await field.inputValue(), message, 'timeout: message kept');
      await ctx.setOffline(true);
      const before = sent.length;
      await send();
      await expectStatus('You’re offline. Your message is still here; send it when you have signal.');
      assert.equal(sent.length, before, 'offline: nothing attempted');
      await ctx.setOffline(false);
      mode = 'created';
      await page.selectOption('#feedback-category', 'bug');
      await send();
      await expectStatus('Sent · reference abcd1234. Thank you.');
      assert.equal(await field.inputValue(), '', 'sent: field cleared');
      assert.equal(await page.locator('#feedback-count').textContent(), '0 / 4,000');
      assert.deepEqual(sent[sent.length - 1], {kind: 'feedback', category: 'bug', message: message.trim(), appVersion: 'web', diagnosticsConsented: false});
      const disclosure = await page.locator('#feedback-dialog').innerText();
      assert(disclosure.includes('AI assistants such as Anthropic’s Claude or OpenAI’s ChatGPT/Codex'), 'AI-review disclosure');
      assert(disclosure.includes('No account needed') && !/GitHub/.test(disclosure), 'accountless copy');
      // Choosing Privacy points to the private address (feedback can't be answered); other types restore the hint.
      const hint = page.locator('#feedback-hint');
      await page.selectOption('#feedback-category', 'privacy');
      assert(await page.locator(`#feedback-hint a[href="mailto:${CONTACT}"]`).count(), 'privacy hint names the contact');
      await page.selectOption('#feedback-category', 'general');
      assert.equal(await hint.textContent(), 'Your phone model and Android version help.');
      assert.deepEqual(errors.filter(e => !/net::ERR_INTERNET_DISCONNECTED|net::ERR_FAILED|Failed to load resource/.test(e)), [], 'feedback page errors');
      await ctx.close();
      pass('feedback', `whitespace, counter, 201/429/400/413/502/network/timeout/offline mapped; ${sent.length} faked sends`);
    }

    // 7. Dialogs: labelled, keyboard reachable, follow the address; Feedback from Help returns to Help; Back closes.
    {
      const ctx = await context({viewport: {width: 1366, height: 860}});
      const page = await ctx.newPage();
      const errors = watch(page);
      await page.goto(base + '/', {waitUntil: 'networkidle'});
      const isOpen = id => page.locator('#' + id).evaluate(d => d.open);
      for (const id of ['tip-dialog', 'about-dialog', 'help-dialog', 'feedback-dialog']) {
        const label = await page.locator('#' + id).evaluate(d => document.getElementById(d.getAttribute('aria-labelledby'))?.textContent.trim());
        assert(label, id + ' is labelled');
      }
      for (const [opener, id] of [['#tip-open', 'tip-dialog'], ['#about-open', 'about-dialog']]) {
        await page.click(opener);
        assert(await isOpen(id), id + ' opens');
        assert.equal(await page.evaluate(() => location.hash), '#' + id.replace('-dialog', ''));
        await page.click(`#${id} [data-close]`);
        await page.waitForFunction(i => !document.getElementById(i).open && location.hash === '', id);
      }
      // Keyboard: Tab to Help, Enter opens it, Escape closes it and focus returns.
      await page.evaluate(() => document.getElementById('feedback-open').focus());
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'help-open', 'Help is reachable by Tab');
      await page.keyboard.press('Enter');
      assert(await isOpen('help-dialog'), 'Enter opens Help');
      assert.equal(await page.evaluate(() => location.hash), '#help');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => location.hash === '' && !document.getElementById('help-dialog').open);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'help-open', 'focus returns to Help');
      // Feedback from Help returns to Help.
      await page.click('#help-open');
      await page.click('#help-feedback-open');
      assert(await isOpen('feedback-dialog') && !(await isOpen('help-dialog')), 'Feedback replaces Help');
      assert.equal(await page.evaluate(() => location.hash), '#feedback');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => document.getElementById('help-dialog').open);
      assert.equal(await page.evaluate(() => location.hash), '#help');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'help-feedback-open', 'focus back on Send feedback');
      await page.click('#help-dialog [data-close]');
      await page.waitForFunction(() => !document.querySelector('dialog[open]') && location.hash === '');
      // Back from #help closes it.
      await page.click('#help-open');
      assert(await isOpen('help-dialog'));
      await page.goBack();
      await page.waitForFunction(() => !document.getElementById('help-dialog').open);
      assert.equal(new URL(page.url()).hash, '');
      // A deep link opens its dialog; closing it stays on the page.
      await page.goto(base + '/#help', {waitUntil: 'networkidle'});
      assert(await isOpen('help-dialog'), '#help deep link');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.getElementById('help-dialog').open && location.hash === '');
      assert.equal(await page.evaluate(() => location.href), base + '/');
      // The film's captions switch is visible and works.
      assert(await page.locator('#captions-toggle').isVisible(), 'captions switch visible');
      assert.equal(await page.getByRole('button', {name: 'Captions', exact: true}).count(), 1, 'captions switch keeps its name');
      assert.match((await page.locator('#captions-toggle').innerText()).replace(/\s+/g, ' ').trim(), /^Captions (on|off)$/, 'captions switch reads "Captions on/off"');
      const pressed = await page.locator('#captions-toggle').getAttribute('aria-pressed');
      await page.click('#captions-toggle');
      assert.notEqual(await page.locator('#captions-toggle').getAttribute('aria-pressed'), pressed, 'captions toggle');
      // The player's controls stay off the poster (and its "Not affiliated with DoorDash" line) until the film plays,
      // and leave again when it ends. Without JavaScript the HTML's own controls remain.
      assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /<video id="film" controls /, 'controls without JavaScript');
      const film = page.locator('#film');
      assert.equal(await film.evaluate(v => v.controls), false, 'no controls over the poster');
      await film.evaluate(v => v.dispatchEvent(new Event('play')));
      assert.equal(await film.evaluate(v => v.controls), true, 'controls while the film plays');
      await film.evaluate(v => v.dispatchEvent(new Event('ended')));
      assert.equal(await film.evaluate(v => v.controls), false, 'controls leave when it ends');
      assert.equal(await page.locator('#film-play').textContent(), '▶Replay film');
      assert.deepEqual(errors, [], 'dialog errors');
      await ctx.close();
      pass('dialogs', 'labelled; Tab/Enter/Escape; #help/#feedback addresses; Feedback→Help; Back closes; captions switch; film controls only while playing');
    }

    // 8. Motion: reduced motion stops the landscape; otherwise it draws at most ~30 frames a second.
    {
      // A frame sets the page canvas's scale once; gradients on the page canvas mean the still backdrop was redrawn
      // instead of copied from its offscreen canvas.
      const countDraws = () => {
        window.__draws = 0;
        window.__gradients = 0;
        const proto = CanvasRenderingContext2D.prototype;
        const original = proto.setTransform;
        proto.setTransform = function (...args) {
          if (this.canvas && this.canvas.id === 'landscape') window.__draws++;
          return original.apply(this, args);
        };
        for (const name of ['createLinearGradient', 'createRadialGradient']) {
          const create = proto[name];
          proto[name] = function (...args) {
            if (this.canvas && this.canvas.id === 'landscape') window.__gradients++;
            return create.apply(this, args);
          };
        }
      };
      let gradients = 0;
      const measure = async page => {
        const start = await page.evaluate(() => [window.__draws, window.__gradients]);
        await page.waitForTimeout(2000);
        const end = await page.evaluate(() => [window.__draws, window.__gradients]);
        gradients = end[1] - start[1];
        return end[0] - start[0];
      };
      const reduced = await context({viewport: {width: 1366, height: 860}, reducedMotion: 'reduce'});
      await reduced.addInitScript(countDraws);
      const still = await reduced.newPage();
      await still.goto(base + '/', {waitUntil: 'networkidle'});
      assert.equal(await still.locator('#motion-toggle').textContent(), 'Resume motion');
      assert.equal(await still.locator('#motion-toggle').getAttribute('aria-pressed'), 'true');
      assert(await still.evaluate(() => document.body.classList.contains('motion-paused')));
      assert.equal(await still.locator('.atmosphere i').first().evaluate(i => getComputedStyle(i).animationName), 'none');
      const stillDraws = await measure(still);
      assert.equal(stillDraws, 0, 'reduced motion: landscape still');
      await reduced.close();
      const moving = await context({viewport: {width: 1366, height: 860}, reducedMotion: 'no-preference'});
      await moving.addInitScript(countDraws);
      const page = await moving.newPage();
      await page.goto(base + '/', {waitUntil: 'networkidle'});
      const draws = await measure(page);
      assert(draws >= 4 && draws <= 66, `about 30 fps: ${draws} draws in 2 s`);
      assert.equal(gradients, 0, 'the still backdrop is copied, not redrawn, each frame');
      await page.click('#motion-toggle');
      assert.equal(await measure(page), 0, 'Pause motion stops it');
      await moving.close();
      pass('motion', `reduced motion: 0 draws; running: ${draws} draws in 2 s (cap 60), backdrop copied (0 gradients); Pause motion: 0`);
    }

    // 9. Dark mode: the home page starts at night; the reading pages switch palette and keep readable contrast.
    {
      const dark = await context({viewport: {width: 360, height: 800}, colorScheme: 'dark'});
      const page = await dark.newPage();
      const errors = watch(page);
      await page.goto(base + '/', {waitUntil: 'networkidle'});
      assert(await page.evaluate(() => document.body.classList.contains('night')), 'home page starts at night');
      assert.equal(await page.locator('#sky-toggle').getAttribute('aria-label'), 'Switch to day');
      assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#102032');
      const skyTop = await page.evaluate(() => [...document.getElementById('landscape').getContext('2d').getImageData(4, 4, 1, 1).data]);
      assert(skyTop[0] < 60 && skyTop[1] < 70 && skyTop[2] < 90, 'night sky drawn from the start: ' + skyTop);
      await page.click('#sky-toggle');
      assert(!(await page.evaluate(() => document.body.classList.contains('night'))), 'the sky button still switches to day');
      const contrast = {};
      for (const scheme of ['dark', 'light']) {
        await page.emulateMedia({colorScheme: scheme});
        await page.goto(base + '/install/', {waitUntil: 'networkidle'});
        contrast[scheme] = await page.evaluate(readingContrast);
        for (const [name, value] of Object.entries(contrast[scheme])) assert(value >= 4.5, `${scheme} ${name} contrast ${value}`);
        const filter = await page.locator('.signature img').evaluate(img => getComputedStyle(img).filter);
        assert.equal(filter !== 'none', scheme === 'dark', `${scheme}: signature ${filter}`);
      }
      assert.deepEqual(errors, [], 'dark mode errors');
      await dark.close();
      pass('dark mode', `home starts at night; reading pages at least ${Math.min(...Object.values(contrast.dark))}:1 dark, ${Math.min(...Object.values(contrast.light))}:1 light`);
    }

    // Release gates: what must be true of the published texts before this site is deployed.
    {
      const ctx = await context({viewport: {width: 1366, height: 860}});
      const page = await ctx.newPage();
      const text = {};
      for (const pathname of ['/terms/', '/privacy/']) {
        await page.goto(base + pathname, {waitUntil: 'domcontentloaded'});
        text[pathname] = await page.locator('main').innerText();
        const notes = text[pathname].split('\n').filter(line => DRAFT_MARKERS.test(line));
        gate(`${pathname} carries no drafting notes`, notes.length === 0, notes.map(line => line.slice(0, 160)).join(' | '));
      }
      const appPrivacy = await page.evaluate(() => {
        const range = document.createRange();
        range.setStartBefore(document.querySelector('main').firstChild);
        range.setEndBefore(document.getElementById('this-website'));
        return range.toString();
      });
      gate(`the app's privacy text names ${CONTACT}, the site's private contact`, appPrivacy.includes(CONTACT),
        `PRIVACY.md in the app repository doesn't mention ${CONTACT}`);
      if (release.versionCode >= AUTOPILOT_VERSION_CODE) {
        for (const pathname of ['/terms/', '/privacy/']) {
          const stale = ['compensating', '0.4.73'].filter(word => text[pathname].includes(word));
          gate(`${pathname} describes Autopilot (release.json is ${release.versionName})`, text[pathname].includes('Autopilot'), 'no mention of Autopilot');
          gate(`${pathname} drops retired wording`, stale.length === 0, 'still says: ' + stale.join(', '));
        }
      } else {
        gate(`Autopilot wording in the terms and privacy (checked once release.json is 0.5.0 or later; it is ${release.versionName})`, true);
      }
      await ctx.close();
    }

    assert.deepEqual(escaped, [], 'requests left the local server');
    console.log(JSON.stringify({checkedAt: new Date().toISOString(), scope: 'Local Chromium against a local GitHub Pages-like server; not a phone or live-domain test', release: `${release.versionName} (${release.versionCode})`, passed: results, releaseGates: gates}, null, 2));
    if (gates.failed.length) {
      console.error(`\nNOT READY TO DEPLOY: every site check passed, but ${gates.failed.length} release gate(s) failed:\n` +
        gates.failed.map(failure => '  - ' + failure).join('\n'));
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
