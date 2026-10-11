// Executes the unchanged/exact film-event section of page.js with media event adapters.
// This focused source test does not claim DOM layout, native controls or decoded MP4 playback.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const path = process.argv[2] || `${__dirname}/../page.js`;
const source = fs.readFileSync(path, 'utf8');
const begin = source.indexOf('  // Film.\n'), end = source.indexOf('  // The sky button', begin);
assert.ok(begin >= 0 && end > begin, 'real page film event section found');
const production = source.slice(begin, end);

function fixture({wanted, refuse = false}) {
  const live = new EventTarget(), video = new EventTarget(), play = new EventTarget();
  const calls = {play: 0, motion: 0};
  Object.assign(play, {hidden: false, querySelector: () => ({}), setAttribute() {}});
  Object.assign(live, {wanted, play() { this.dispatchEvent(new Event('play')); return Promise.resolve(); }});
  video.play = () => { calls.play++; if (refuse) return Promise.reject(Object.assign(new Error(), {name:'NotAllowedError'})); video.dispatchEvent(new Event('play')); return Promise.resolve(); };
  vm.runInNewContext('let film = window.offerFilm;\n' + production, {
    window: {offerFilm: live}, play, videoFallback: () => video, syncMotion: () => { calls.motion++; },
  }, {filename:path});
  live.dispatchEvent(new Event('play'));
  assert.equal(play.hidden, true, 'initial live playback hid Play');
  calls.motion = 0;
  live.dispatchEvent(new Event('unavailable'));
  return {play, calls};
}

test('canceled playback hands off to a visible Play button without autoplay', () => {
  const f = fixture({wanted:false});
  assert.equal(f.play.hidden,false);
  assert.equal(f.calls.play,0);
  assert.ok(f.calls.motion > 0, 'motion state follows the replacement immediately');
});
test('requested playback starts the replacement and its own play event hides the button', () => {
  const f = fixture({wanted:true});
  assert.equal(f.calls.play,1);
  assert.equal(f.play.hidden,true);
});
test('browser refusing replacement playback restores Play for a fresh gesture', async () => {
  const f = fixture({wanted:true,refuse:true}); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.calls.play,1);
  assert.equal(f.play.hidden,false);
  assert.ok(f.calls.motion > 0);
});
