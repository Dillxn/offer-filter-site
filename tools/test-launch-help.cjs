#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.vtt':'text/vtt','.mp4':'video/mp4','.webm':'audio/webm','.m4a':'audio/mp4','.ttf':'font/ttf','.woff2':'font/woff2'};
async function main() {
  const server = http.createServer((req,res) => {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    fs.readFile(file,(err,data) => { if(err){res.writeHead(404).end();return;} res.setHeader('Content-Type',mime[path.extname(file)] || 'application/octet-stream');res.end(data); });
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const results=[];
  try {
    browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.CHROMIUM_EXECUTABLE_PATH} : {})});
    for(const width of [320,400,520,1280]) for(const night of [false,true]) {
      const page=await browser.newPage({viewport:{width,height:900}});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(mode => localStorage.setItem('offerfilter.theme', mode), night ? 'NIGHT' : 'DAY');
      await page.goto(base,{waitUntil:'networkidle'});
      await page.locator('#help-open').click();
      assert.equal(await page.locator('#help-dialog').evaluate(d=>d.open),true);
      const copy=await page.locator('#help-dialog').innerText();
      for(const text of ['do not need GitHub','I understand and accept','Auto-accept is off','Send anonymous feedback','accountless feedback']) assert(copy.includes(text),text);
      const bounds=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,dialog:document.getElementById('help-dialog').scrollWidth,client:document.getElementById('help-dialog').clientWidth}));
      assert(bounds.page<=bounds.viewport+1,JSON.stringify(bounds));assert(bounds.dialog<=bounds.client+1,JSON.stringify(bounds));
      await page.locator('#help-feedback-open').click();
      assert.equal(await page.locator('#feedback-dialog').evaluate(d=>d.open),true);
      await page.keyboard.press('Escape');
      await page.locator('#help-open').click();
      await page.keyboard.press('Escape');assert.equal(await page.locator('#help-dialog').evaluate(d=>d.open),false);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'help-open');
      await page.goto(base+'/#help',{waitUntil:'networkidle'});
      assert.equal(await page.locator('#help-dialog').evaluate(d=>d.open),true);
      assert.deepEqual(errors,[]);
      results.push({width,night,help:true,deepLink:true,escapeFocus:true,noOverflow:true,noPageErrors:true});
      if(width===400&&!night){await page.locator('#help-dialog').screenshot({path:'/tmp/offer-filter-help-400.png'});}
      await page.close();
    }
    const template=fs.readFileSync(path.join(root,'.github/ISSUE_TEMPLATE/beta-help.yml'),'utf8');
    assert(template.includes('Everything in this issue is public'));assert(template.includes('required: true'));
    console.log(JSON.stringify({checkedAt:new Date().toISOString(),scope:'Local Chromium, not phone or live-domain proof',results},null,2));
  } finally { await browser?.close();await new Promise(resolve=>server.close(resolve)); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
