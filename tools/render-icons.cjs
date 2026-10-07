#!/usr/bin/env node
/* Renders the 3D mascot (assets/models.js) as the site's logo and icons, through headless Chromium and
 * tools/icons/render.html: the header's logo (assets/mascot-3d.webp, 192 px, clear), the touch icon (180 px on the
 * page's cream) and the favicons (drawn at 256 px and reduced to 32 and 16). node tools/render-icons.cjs [out]
 * Needs Playwright's Chromium and ffmpeg with WebP; the default out is assets/. */
const fs = require('fs'), path = require('path'), http = require('http'), {execFileSync} = require('child_process');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..'), OUT = path.resolve(process.argv[2] || path.join(root, 'assets'));
const serve = () => new Promise(resolve => {
  const types = {'.html': 'text/html', '.js': 'text/javascript'};
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'}); fs.createReadStream(file).pipe(res);
  });
  server.listen(0, '127.0.0.1', () => resolve(server));
});
(async () => {
  const server = await serve(), browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const shot = async (size, bg, pad, file) => {
    const page = await browser.newPage({viewport: {width: size, height: size}});
    await page.goto(`http://127.0.0.1:${server.address().port}/tools/icons/render.html?size=${size}&bg=${encodeURIComponent(bg)}&pad=${pad}`);
    const url = await page.waitForFunction(() => window.png).then(h => h.jsonValue());
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    await page.close();
  };
  try {
    fs.mkdirSync(OUT, {recursive: true});
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'offer-icons-'));
    await shot(192, 'transparent', .04, path.join(tmp, 'logo.png'));
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(tmp, 'logo.png'), '-c:v', 'libwebp', '-lossless', '0', '-quality', '90', '-compression_level', '6', path.join(OUT, 'mascot-3d.webp')]);
    await shot(180, '#efe9db', .16, path.join(OUT, 'apple-touch-icon.png'));
    await shot(256, 'transparent', .02, path.join(tmp, 'fav.png'));
    for (const s of [32, 16]) execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(tmp, 'fav.png'), '-vf', `scale=${s}:${s}:flags=lanczos`, path.join(OUT, `favicon-${s}.png`)]);
    fs.rmSync(tmp, {recursive: true, force: true});
    console.log('icons written to', OUT);
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
