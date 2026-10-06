#!/usr/bin/env node
'use strict';
/*
 * Local Chromium checks for offerfilter.org:   node tools/test-launch-help.cjs
 *
 * Serves the site the way GitHub Pages does (directory index files, 404.html for missing paths) and checks:
 * no horizontal overflow at 360 and 1366 px, no console errors, every internal link and asset resolves, the
 * download button is labelled from assets/release.json, the install steps and legal pages are present, the
 * feedback form's messages for 201/429/400/413/offline/network/timeout, the dialogs and their addresses
 * (#help, #feedback, ...), reduced motion and the 30 fps cap, and that a phone fetches one poster and one small
 * signature image.
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

const release = JSON.parse(fs.readFileSync(path.join(root, 'assets/release.json'), 'utf8'));
const releaseSize = release.sizeBytes >= 1e6 ? (release.sizeBytes / 1e6).toFixed(1) + ' MB' : Math.round(release.sizeBytes / 1e3) + ' KB';
const results = [];
const pass = (name, detail) => { results.push(detail === undefined ? name : `${name}: ${detail}`); };

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
      const upcoming = Number(await page.locator('#whats-new').getAttribute('data-version-code'));
      assert.equal(await page.locator('#beta-pending').isVisible(), release.versionCode < upcoming, 'pending-release note');
      await ctx.close();
      const noJs = await context({viewport: {width: 360, height: 800}, javaScriptEnabled: false});
      const plain = await noJs.newPage();
      await plain.goto(base + '/', {waitUntil: 'load'});
      await plain.click('#download-open');
      await plain.waitForURL(base + '/install/');
      assert.equal(await plain.locator('#download-apk').getAttribute('href'), APK);
      assert.match(await plain.locator('#download-apk').textContent(), /Download Offer Filter/);
      await noJs.close();
      pass('download', `"${label}" → ${APK}; works without JavaScript`);
    }

    // 5. Install steps, visible risk text, legal pages and the links to them.
    {
      const ctx = await context({viewport: {width: 360, height: 800}});
      const page = await ctx.newPage();
      await page.goto(base + '/install/', {waitUntil: 'networkidle'});
      const text = await page.locator('main').innerText();
      for (const phrase of ['File might be harmful', 'Download anyway', 'Allow from this source', 'Play Protect', 'Scan app',
        'Never turn Play Protect off', 'stop there', 'Auto Blocker', 'Settings → Security and privacy → Auto Blocker',
        'I understand and accept', 'Restricted setting', 'Allow restricted settings', 'App info',
        'Allow Offer Filter to send you notifications?', 'Updates can’t install', 'Autopilot', '70%', 'Earn per Offer',
        'Earn by Time', 'Dasher full screen', 'Google Maps or Waze full screen', 'Peek', 'split screen',
        'for planning', 'Tap the mascot', 'Send anonymous feedback', 'feedback form', 'Android 8',
        'acceptance rate', 'DoorDash', 'driving']) {
        assert(text.includes(phrase), 'install page lacks: ' + phrase);
      }
      const steps = await page.locator('ol.steps > li').count();
      assert(steps >= 16, 'install steps: ' + steps);
      // Numbering continues across the guide's sections (each list's start follows the previous list).
      const starts = await page.evaluate(() => [...document.querySelectorAll('ol.steps')].map(ol => [ol.start, ol.children.length]));
      starts.reduce((next, [start, length]) => { assert.equal(start, next, 'step numbering'); return start + length; }, 1);
      const risk = await page.locator('#before-title + ul li').first().evaluate(li => ({size: parseFloat(getComputedStyle(li).fontSize), opacity: getComputedStyle(li).opacity}));
      assert(risk.size >= 15 && risk.opacity === '1', 'risk text size ' + JSON.stringify(risk));
      for (const link of ['../terms/', '../privacy/', '../license/']) assert(await page.locator(`a[href="${link}"]`).count(), 'install page links ' + link);
      for (const [pathname, phrases] of [
        ['/terms/', ['terms of use', 'Acceptance-rate risk', 'No warranty']],
        ['/privacy/', ['This website', 'GitHub Pages', 'No cookies, no analytics', 'Supabase', 'Cloudflare', '90 days', 'Claude', 'ChatGPT/Codex', 'Cash App']],
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
      await ctx.close();
      pass('content', `${steps} install steps, risk text at ${risk.size}px, terms/privacy/license present and linked`);
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
        ['rate', 'Too many sends from this network — try again in a few minutes.'],
        ['invalid', 'Couldn’t be accepted — shorten it?'],
        ['large', 'Couldn’t be accepted — shorten it?'],
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
      assert.deepEqual(errors, [], 'dialog errors');
      await ctx.close();
      pass('dialogs', 'labelled; Tab/Enter/Escape; #help/#feedback addresses; Feedback→Help; Back closes; captions switch');
    }

    // 8. Motion: reduced motion stops the landscape; otherwise it draws at most ~30 frames a second.
    {
      const countDraws = () => {
        window.__draws = 0;
        const original = CanvasRenderingContext2D.prototype.setTransform;
        CanvasRenderingContext2D.prototype.setTransform = function (...args) {
          if (this.canvas && this.canvas.id === 'landscape') window.__draws++;
          return original.apply(this, args);
        };
      };
      const measure = async page => {
        const start = await page.evaluate(() => window.__draws);
        await page.waitForTimeout(2000);
        return (await page.evaluate(() => window.__draws)) - start;
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
      await page.click('#motion-toggle');
      assert.equal(await measure(page), 0, 'Pause motion stops it');
      await moving.close();
      pass('motion', `reduced motion: 0 draws; running: ${draws} draws in 2 s (cap 60); Pause motion: 0`);
    }

    assert.deepEqual(escaped, [], 'requests left the local server');
    console.log(JSON.stringify({checkedAt: new Date().toISOString(), scope: 'Local Chromium against a local GitHub Pages-like server; not a phone or live-domain test', release: `${release.versionName} (${release.versionCode})`, passed: results}, null, 2));
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
