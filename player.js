/* The film, drawn live. OfferFilm renders each frame, so the page downloads a few hundred kilobytes of audio instead of
 * megabytes of video and stays sharp at any size: its art in 3D (WebGL, on a canvas off the page), copied into the
 * film's canvas under its words and the app's screen, so the page composites one layer. Once the page has shown its
 * words and the browser is idle, the film plays muted, round and round, on the page's own clock (no soundtrack is
 * fetched for it), until someone plays it with sound: then it starts over, clocked by the soundtrack, and when it ends
 * it goes back to its loop. Until the loop begins, the stage shows the film's closing frame as a picture. The loop waits
 * while motion is paused or a dialog is open, and does not start where the visitor asks for reduced motion or less
 * data. The MP4 renders of the same frames remain the fallback without script or WebGL. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const stage = $('film-stage'), canvas = $('film-canvas');
  // The film's own script (assets/film.js, OfferFilm) loads with the renderer, the models and the app's views when the
  // film is first wanted.
  let F = null;
  // Without the film's script or WebGL, page.js plays the MP4 instead: at once without the script or WebGL; when a
  // WebGL context turns out not to be made as the film is first wanted, through the 'unavailable' event.
  let ctx = null;
  try { ctx = window.WebGLRenderingContext && canvas.getContext('2d'); } catch (e) {}
  if (!ctx) return;
  // The renderer, made on the film's first live frame. Where WebGL is drawn by the CPU, the moving art is drawn at half
  // the frame's pixels and smoothed up to it; a still frame (a pause) always at all of them.
  let r = null, quality = 1, live = false;
  let missing = false;
  function renderer() {
    if (!r && !missing && window.OfferGL) {
      r = OfferGL.create(document.createElement('canvas'));
      if (!r) {
        // The film hands over to the MP4, which plays if the film was asked to.
        missing = true; player.wanted = player.wanted || playing;
        if (playing) { playing = false; if (!silent) audio.pause(); if (raf) cancelAnimationFrame(raf); raf = 0; }
        setTimeout(() => player.dispatchEvent(new Event('unavailable')), 0);
        return null;
      }
      quality = r.software ? .5 : 1;
      // A lost WebGL context (a GPU reset, a long while in the background) comes back empty: build the renderer again.
      r.canvas.addEventListener('webglcontextlost', e => e.preventDefault());
      r.canvas.addEventListener('webglcontextrestored', () => { r = null; if (ready && live) fit(); });
    }
    return r;
  }
  const audio = $('film-audio'), controls = $('film-controls'), seek = $('film-seek'), clockText = $('film-time'), cue = $('film-cue');
  const button = act => controls.querySelector(`[data-act="${act}"]`);
  const MEDIA = '?v=20261007-beta', D = +seek.max;
  const SIZES = {landscape: [1920, 1080], square: [1080, 1080], portrait: [1080, 1920]};
  const player = new EventTarget();
  let format = 'landscape', comp = SIZES.landscape, scale = 1, ox = 0, oy = 0, visible = true;
  let emblem = document.createElement('canvas'), ready = false, playing = false, ended = false, started = false;
  let silent = false, buffering = false, dragging = false, captions = false, hideTimer = 0, raf = 0;
  // 'idle' until the film first moves, then 'loop' (muted, round and round) or 'sound' (played with its soundtrack).
  let mode = 'idle', resting = false, back = 0;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || !!(navigator.connection && navigator.connection.saveData);
  let t = 0, anchorT = 0, anchorAt = 0, lastAudio = -1, shownSecond = -1, cueText = null, lastDraw = 0, cost = 0;
  emblem.width = emblem.height = 1;

  // Film time follows the soundtrack. Between the audio clock's updates it advances with the frame clock,
  // never more than a quarter second ahead, so a stalled stream holds the picture instead of drifting.
  function clock(now) {
    if (silent || mode === 'loop') return anchorT + (now - anchorAt) / 1000;
    const a = audio.currentTime;
    if (a !== lastAudio || buffering) { lastAudio = a; anchorT = a; anchorAt = now; return a; }
    return anchorT + Math.min((now - anchorAt) / 1000, .25);
  }
  // The frame is the composition (comp units) scaled by `scale` device pixels and letterboxed at (ox, oy); the 3D art
  // fills a canvas of its own the frame's size.
  function draw() {
    if (!F || !renderer()) return;
    const w = comp[0] * scale, h = comp[1] * scale;
    r.size(w, h, playing ? quality : 1); r.view(0, 0, w, h, comp);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (ox > 0 || oy > 0) { ctx.fillStyle = '#0b1725'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, comp[0], comp[1]); ctx.clip();
    F.frame(r, ctx, t, comp[0], comp[1], emblem, {audit: false});
    ctx.restore();
  }
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function sync() {
    const second = Math.floor(t);
    if (second !== shownSecond) {
      shownSecond = second; clockText.textContent = `${fmt(t)} / ${fmt(D)}`;
      seek.setAttribute('aria-valuetext', `${fmt(t)} of ${fmt(D)}`);
    }
    if (!dragging) seek.value = t;
    seek.style.setProperty('--progress', `${t / D * 100}%`);
    const line = captions && F && (F.CAPTIONS.find(([a, b]) => t >= a && t < b) || [])[2] || '';
    if (line !== cueText) { cueText = line; cue.textContent = line; cue.hidden = !line; }
  }
  function loop(now) {
    raf = 0;
    if (!playing) return;
    t = Math.max(t, clock(now));
    if (t >= D) {
      if (mode !== 'loop') return finish();
      t %= D; anchorT = t; anchorAt = now;
    }
    // At most 60 frames a second; the muted loop, and a device that needs more than 10 ms per frame, get 30, as in the MP4.
    if (visible && now - lastDraw >= (mode === 'loop' || cost > 10 ? 29 : 12)) {
      // Once the film has faded in over its poster, the poster goes: left behind it, it would show through the rounded
      // corners' soft edge as a light rim.
      if (!stage.classList.contains('live')) { stage.classList.add('live'); setTimeout(() => stage.classList.add('bare'), 900); }
      const begin = performance.now();
      draw(); lastDraw = now;
      cost = cost * .9 + (performance.now() - begin) * .1;
    }
    sync();
    raf = requestAnimationFrame(loop);
  }
  function setState() {
    stage.classList.toggle('playing', playing && mode === 'sound');
    stage.classList.toggle('looping', mode === 'loop');
    const toggle = button('toggle');
    toggle.setAttribute('aria-label', playing ? 'Pause film' : 'Play film');
    toggle.classList.toggle('is-playing', playing);
  }
  function emit(type) { setState(); player.dispatchEvent(new Event(type)); }
  function seekTo(value) {
    t = Math.max(0, Math.min(D, value)); ended = false;
    if (!silent && mode !== 'loop') { try { audio.currentTime = t; } catch (e) {} lastAudio = -1; }
    anchorT = t; anchorAt = performance.now();
    draw(); sync();
  }
  function goSilent() {
    if (silent) return;
    silent = true; buffering = false; anchorT = t; anchorAt = performance.now();
    const mute = button('mute');
    mute.disabled = true; mute.setAttribute('aria-label', 'Sound unavailable');
  }
  function finish() {
    playing = false; ended = true; t = D;
    if (!silent && !audio.paused) audio.pause();
    // The controls step aside, so the closing frame shows whole, its "Not affiliated with DoorDash" line too (for good,
    // where the loop does not come back); the play button offers a replay (page.js) and takes the focus they had.
    const focused = controls.contains(document.activeElement);
    controls.hidden = true;
    draw(); sync();
    emit('ended');
    if (focused) $('film-play').focus({preventScroll: true});
    // The closing frame holds a moment; then the film goes back to its muted loop.
    clearTimeout(back);
    if (!still) back = setTimeout(() => { if (ended && !playing) { mode = 'loop'; t = 0; player.loop(); } }, 3000);
  }
  /** Plays the film with its sound, from the start if it was looping muted or had ended. */
  player.play = () => {
    if (missing) { player.wanted = true; return Promise.resolve(); }
    loadApp(); live = true; clearTimeout(back);
    if (!started || ended || mode === 'loop') { started = true; mode = 'sound'; seekTo(0); }
    mode = 'sound'; playing = true; ended = false; controls.hidden = false; showControls();
    let result = Promise.resolve();
    if (silent) { anchorT = t; anchorAt = performance.now(); }
    else {
      buffering = true; audio.preload = 'auto';
      result = Promise.resolve(audio.play()).catch(error => {
        if (error && error.name === 'NotAllowedError') { player.pause(); throw error; }
        goSilent();
      });
    }
    if (!raf) raf = requestAnimationFrame(loop);
    emit('play');
    return result;
  };
  /** The muted loop, from where it was (the start, the first time). */
  player.loop = () => {
    if (missing || !F || !renderer() || resting || (playing && mode === 'sound')) return;
    if (mode !== 'loop') { mode = 'loop'; t = 0; }
    started = live = playing = true; ended = false; controls.hidden = true;
    anchorT = t; anchorAt = performance.now();
    if (!raf) raf = requestAnimationFrame(loop);
    emit('loop');
  };
  /** While motion is paused or a dialog is open (page.js), the muted loop waits, and carries on after. */
  player.rest = on => {
    resting = on;
    if (mode !== 'loop') return;
    if (on && playing) player.pause();
    else if (!on && !playing) player.loop();
  };
  player.pause = () => {
    if (!playing) return;
    playing = false;
    if (!silent && mode === 'sound') audio.pause();
    if (raf) cancelAnimationFrame(raf);
    raf = 0; draw(); sync(); showControls();
    emit('pause');
  };
  Object.defineProperties(player, {
    paused: {get: () => !playing}, ended: {get: () => ended}, error: {get: () => null}, quiet: {get: () => mode === 'loop'}
  });
  // A click or K on the muted loop plays the film with its sound; otherwise they pause and play.
  const toggle = () => playing && mode === 'sound' ? player.pause() : player.play().catch(() => {});

  audio.addEventListener('playing', () => { buffering = false; lastAudio = -1; });
  audio.addEventListener('waiting', () => { buffering = true; });
  audio.addEventListener('ended', () => { if (playing) finish(); });
  // Media keys and the system's audio controls act on the soundtrack; keep the picture with them.
  audio.addEventListener('pause', () => { if (playing && !audio.ended) player.pause(); });
  audio.addEventListener('play', () => { if (!playing) player.play().catch(() => {}); });
  const sources = audio.querySelectorAll('source');
  sources[sources.length - 1].addEventListener('error', goSilent);

  // Controls appear while paused, on pointer movement, or with keyboard focus, then step aside.
  function showControls() {
    stage.classList.add('controls-on');
    clearTimeout(hideTimer);
    if (playing) hideTimer = setTimeout(() => {
      if (playing && !controls.contains(document.activeElement)) stage.classList.remove('controls-on');
    }, 2600);
  }
  stage.addEventListener('pointermove', showControls);
  stage.addEventListener('focusin', showControls);
  canvas.addEventListener('click', () => { toggle(); showControls(); });
  button('toggle').addEventListener('click', toggle);
  seek.addEventListener('pointerdown', () => { dragging = true; });
  seek.addEventListener('input', () => { seekTo(+seek.value); });
  seek.addEventListener('change', () => { dragging = false; });
  window.addEventListener('pointerup', () => { dragging = false; });

  function setCaptions(on) {
    captions = on; cueText = null;
    button('captions').setAttribute('aria-pressed', String(on));
    try { localStorage.setItem('offerfilter.captions', on ? '1' : '0'); } catch (e) {}
    sync();
  }
  try { captions = localStorage.getItem('offerfilter.captions') === '1'; } catch (e) {}
  button('captions').setAttribute('aria-pressed', String(captions));
  button('captions').addEventListener('click', () => setCaptions(!captions));
  function setMuted(on) {
    audio.muted = on;
    const mute = button('mute');
    mute.setAttribute('aria-pressed', String(on)); mute.setAttribute('aria-label', on ? 'Unmute' : 'Mute');
  }
  button('mute').addEventListener('click', () => setMuted(!audio.muted));

  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const full = button('fullscreen');
  if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) full.hidden = true;
  function toggleFullscreen() {
    if (full.hidden) return;
    if (fullscreenElement()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage);
  }
  full.addEventListener('click', toggleFullscreen);
  for (const type of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(type, () => {
    const on = fullscreenElement() === stage;
    full.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    full.classList.toggle('is-full', on);
  });

  stage.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase(), tag = e.target.tagName;
    if (key === 'k' || (key === ' ' && tag !== 'BUTTON' && tag !== 'INPUT')) toggle();
    else if (key === 'm') setMuted(!audio.muted);
    else if (key === 'c') setCaptions(!captions);
    else if (key === 'f') toggleFullscreen();
    else if ((key === 'arrowleft' || key === 'arrowright') && tag !== 'INPUT') seekTo(t + (key === 'arrowright' ? 5 : -5));
    else return;
    e.preventDefault(); showControls();
  });

  // Compose for the stage's shape: landscape on wide stages, square on phones, portrait in a tall full screen.
  // The backing store follows the device pixel ratio, capped so a large screen cannot demand a huge canvas.
  function fit() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    const cap = fullscreenElement() ? 3840 * 2160 : 2560 * 1440;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w * h * dpr * dpr > cap) dpr = Math.sqrt(cap / (w * h));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const aspect = w / h;
    format = aspect > 1.25 ? 'landscape' : aspect < .8 ? 'portrait' : 'square';
    comp = SIZES[format];
    scale = Math.min(canvas.width / comp[0], canvas.height / comp[1]);
    // A stage of the composition's own shape, off from it only by rounding, is covered edge to edge: letterboxed, a
    // sliver of the bars would show along two of its sides as a dark line.
    const cover = Math.max(canvas.width / comp[0], canvas.height / comp[1]);
    if (comp[0] * cover - canvas.width < 2 && comp[1] * cover - canvas.height < 2) scale = cover;
    ox = (canvas.width - comp[0] * scale) / 2; oy = (canvas.height - comp[1] * scale) / 2;
    if (ready && live) draw();
  }
  new ResizeObserver(fit).observe(stage);
  new IntersectionObserver(entries => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible && ready && live) draw();
  }).observe(stage);
  // The renderer and the models (unless the page's scenery already loaded them here), the app's own views (assets/app/,
  // which draw the phone in the film's middle) and the film's script load only when the film is wanted, in order, with
  // the Roboto the app's words are drawn in.
  let app = null;
  function loadApp() {
    if (app) return app;
    app = fetch(`assets/app/files.json${MEDIA}`).then(r => r.json()).then(files => new Promise(resolve => {
      const list = [window.OfferGL ? null : 'assets/gl.js', window.OfferModels ? null : 'assets/models.js'].filter(Boolean)
        .concat(files.map(file => `assets/app/${file}`), 'assets/film.js');
      let left = list.length;
      for (const src of list) {
        const script = Object.assign(document.createElement('script'), {src: src + MEDIA, async: false});
        script.onload = script.onerror = () => { if (--left === 0) resolve(); };
        document.head.append(script);
      }
    })).then(() => { F = window.OfferFilm || null; })
      .then(() => document.fonts && Promise.all([document.fonts.load('400 1em Roboto'), document.fonts.load('500 1em Roboto')]))
      .catch(() => {}).then(() => { if (ready && live) draw(); });
    return app;
  }
  // The app's views and the film's 3D art, built a piece at a time between frames, so the film starts without a stall;
  // the picture stays until it does. As soon as someone reaches for the play button, the soundtrack too.
  let warmed = null;
  function wake() {
    if (warmed) return warmed;
    return warmed = loadApp().then(() => new Promise(resolve => {
      if (!F || !renderer()) return resolve();
      const steps = F.prepare(r, comp[0], comp[1]);
      const step = () => { if (steps.length) { steps.shift()(); setTimeout(step, 0); } else resolve(); };
      step();
    }));
  }
  const warm = () => { if (audio.preload === 'none') audio.preload = 'auto'; wake(); };
  for (const type of ['pointerenter', 'focus', 'touchstart']) $('film-play').addEventListener(type, warm, {once: true, passive: true});
  // The muted loop begins once the page has loaded and shown its words, when the browser is idle. If a dialog is open
  // then or motion is paused (a visit to /#help, say), the loop is due all the same and begins when they end (rest()).
  if (!still) {
    const go = () => (window.requestIdleCallback || (fn => setTimeout(fn, 50)))(() => wake().then(() => { if (mode === 'idle') { mode = 'loop'; t = 0; player.loop(); } }), {timeout: 1500});
    let loaded = document.readyState === 'complete', painted = false;
    const both = () => { if (loaded && painted) { loaded = false; go(); } };
    try {
      new PerformanceObserver((list, observer) => {
        if (list.getEntries().some(e => e.name === 'first-contentful-paint')) { observer.disconnect(); painted = true; both(); }
      }).observe({type: 'paint', buffered: true});
    } catch (e) {}
    const onLoad = () => { loaded = true; both(); setTimeout(() => { painted = true; both(); }, 1000); };
    if (loaded) onLoad(); else addEventListener('load', onLoad, {once: true});
  }

  // Live frames wait for the fonts and the tinted emblem.
  const fonts = document.fonts ? Promise.all([document.fonts.load('700 1em "Baloo 2"'), document.fonts.load('400 1em "Atkinson Hyperlegible"')]) : Promise.resolve();
  // The footer signature already loads the emblem; tint a copy of it rather than fetching it again.
  const art = new Promise(resolve => {
    const img = document.querySelector('.signature img') || Object.assign(new Image(), {src: 'assets/jesus-loves-you-emblem-560.png' + MEDIA});
    const tint = () => {
      const c = document.createElement('canvas'), x = c.getContext('2d');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#315B54'; x.fillRect(0, 0, c.width, c.height);
      emblem = c; resolve();
    };
    if (img.complete && img.naturalWidth) tint();
    else { img.addEventListener('load', tint, {once: true}); img.addEventListener('error', resolve, {once: true}); }
  });
  Promise.all([fonts, art]).catch(() => {}).then(() => { ready = true; fit(); stage.classList.add('drawn'); });
  setState(); sync();
  window.offerFilm = player;
})();
