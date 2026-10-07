(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const FEEDBACK_ENDPOINT = 'https://zlnfvqyyjsltmkmmpgzp.supabase.co/functions/v1/offer-filter-feedback';
  const FEEDBACK_TIMEOUT_MS = 15000;
  const FEEDBACK_MAX = 4000;
  const MEDIA = '?v=20261007-beta', play = $('film-play');
  let film = window.offerFilm || videoFallback();
  // The live player (player.js) and the MP4 share one interface: play(), pause(), paused, ended and their events.
  // Without a canvas or the film script, the composed MP4 for this screen plays instead, with native controls.
  function videoFallback() {
    const small = matchMedia('(max-width: 600px)').matches, video = document.createElement('video');
    const src = `assets/offer-filter-${small ? 'square' : 'landscape'}.mp4${MEDIA}`;
    Object.assign(video, {controls: false, playsInline: true, preload: 'none', src, poster: `assets/film-poster-${small ? 'square' : 'wide'}.jpg${MEDIA}`});
    // Its controls come up once it plays and leave at its end, so they never cover the poster's closing line ("Not
    // affiliated with DoorDash"); the play button stands in for them meanwhile, and so does a click on the picture.
    video.addEventListener('play', () => { video.controls = true; });
    video.addEventListener('ended', () => { video.controls = false; });
    video.addEventListener('click', () => { if (!video.controls) play.click(); });
    video.setAttribute('aria-label', 'Offer Filter animated film');
    video.append(Object.assign(document.createElement('track'), {kind: 'captions', src: `assets/film-captions.vtt${MEDIA}`, srclang: 'en', label: 'English'}));
    $('film-stage').replaceChildren(video, play);
    $('film-stage').classList.add('film-video');
    return video;
  }

  // Motion: the visitor's choice and the system's reduced-motion setting, followed as it changes. Rest the scenery and
  // the film's muted loop while motion is paused or a dialog is open. Otherwise the scenery rides on whatever the film
  // does, except where WebGL is drawn by the CPU: there it rests while the film plays with its sound, so the film has
  // the machine.
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduceMotion.matches;
  function syncMotion() {
    const dialogOpen = document.querySelector('dialog[open]') !== null;
    const withSound = !film.paused && !film.ended && !film.error && !film.quiet;
    const quiet = paused || dialogOpen || (withSound && !!window.sceneOnCPU?.());
    document.body.classList.toggle('dialog-open', dialogOpen);
    document.body.classList.toggle('motion-paused', quiet);
    window.setScenePaused?.(quiet);
    window.setSceneBusy?.(!film.paused && !film.ended && !film.error);
    film.rest?.(paused || dialogOpen);
  }
  function labelMotion() {
    const button = $('motion-toggle');
    button.textContent = paused ? 'Resume motion' : 'Pause motion';
    button.setAttribute('aria-pressed', String(paused));
    syncMotion();
  }
  $('motion-toggle').addEventListener('click', () => { paused = !paused; labelMotion(); });
  reduceMotion.addEventListener?.('change', event => { paused = event.matches; labelMotion(); });
  labelMotion();

  // Dialogs follow the address: #help, #feedback, #about and #tip open them, Back closes them, and a dialog opened
  // from another (Feedback from Help) returns to it when closed.
  const ROUTES = {tip: 'tip-dialog', feedback: 'feedback-dialog', about: 'about-dialog', help: 'help-dialog'};
  const openers = {};
  let pendingFocus = null;
  const nameOf = dialog => dialog.id.replace(/-dialog$/, '');
  const hashName = () => { const name = location.hash.slice(1); return ROUTES[name] ? name : ''; };

  function route() {
    const name = hashName();
    document.querySelectorAll('dialog[open]').forEach(dialog => {
      if (nameOf(dialog) !== name) { dialog.dataset.routed = '1'; dialog.close(); }
    });
    if (name && !$(ROUTES[name]).open) {
      film.pause();
      $(ROUTES[name]).showModal();
    }
    syncMotion();
    const target = pendingFocus;
    pendingFocus = null;
    if (target && target.isConnected && !target.closest('dialog:not([open])')) target.focus();
  }
  function openDialog(name, opener) {
    openers[name] = opener;
    if (hashName() !== name) history.pushState({offerDialog: name}, '', '#' + name);
    route();
  }
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    const name = link.getAttribute('href').slice(1);
    if (ROUTES[name]) link.addEventListener('click', event => { event.preventDefault(); openDialog(name, link); });
  });
  document.querySelectorAll('[data-close]').forEach(button =>
    button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {
      if (dialog.dataset.routed) { delete dialog.dataset.routed; syncMotion(); return; }
      // Closed by the visitor (×, Escape or the backdrop): step back out of its address.
      const name = nameOf(dialog);
      pendingFocus = openers[name] || null;
      if (location.hash !== '#' + name) { route(); return; }
      if (history.state && history.state.offerDialog === name) { history.back(); return; }
      history.replaceState(null, '', location.pathname + location.search);
      route();
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
    });
  });
  window.addEventListener('popstate', route);
  window.addEventListener('hashchange', route);
  route();

  // Feedback: accountless, sent only on Send, with honest messages for each way it can fail.
  const form = $('feedback-form'), field = $('feedback-message'), submit = $('feedback-submit');
  const status = $('feedback-status'), count = $('feedback-count');
  const MESSAGES = {
    empty: 'Please type a message first.',
    offline: 'You’re offline. Your message is still here; send it when you have signal.',
    network: 'Couldn’t reach the feedback service. Your message is still here; check your connection and try again.',
    timeout: 'No answer after 15 seconds. Your message is still here; try again when your signal is better.',
    rateLimited: 'Too many messages from this connection. Your message is still here; try again in about 10 minutes.',
    rejected: 'That message couldn’t be accepted. Shorten it and try again; your text is still here.',
    unavailable: 'The feedback service isn’t available right now. Your message is still here; please try again later.',
  };
  let sending = false;
  function say(text, kind) {
    status.textContent = text;
    status.dataset.kind = kind || '';
  }
  function updateCount() {
    const length = field.value.length;
    count.textContent = length.toLocaleString('en-US') + ' / ' + FEEDBACK_MAX.toLocaleString('en-US');
    count.classList.toggle('near-limit', length >= FEEDBACK_MAX - 200);
  }
  field.addEventListener('input', () => {
    updateCount();
    if (field.getAttribute('aria-invalid') === 'true' && field.value.trim()) {
      field.removeAttribute('aria-invalid');
      say('');
    }
  });
  updateCount();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    const message = field.value.trim();
    if (!message) {
      field.setAttribute('aria-invalid', 'true');
      say(MESSAGES.empty, 'error');
      field.focus();
      return;
    }
    if (navigator.onLine === false) { say(MESSAGES.offline, 'error'); return; }
    sending = true;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    say('Sending…');
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, FEEDBACK_TIMEOUT_MS);
    try {
      const response = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          kind: 'feedback',
          category: $('feedback-category').value,
          message,
          appVersion: 'web',
          diagnosticsConsented: false
        }),
        cache: 'no-store',
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok) {
        field.value = '';
        updateCount();
        say(result.reference ? 'Sent · reference ' + result.reference + '. Thank you.' : 'Sent. Thank you.', 'success');
      } else if (response.status === 429) {
        say(MESSAGES.rateLimited, 'error');
      } else if (response.status === 400 || response.status === 413) {
        say(MESSAGES.rejected, 'error');
      } else {
        say(MESSAGES.unavailable, 'error');
      }
    } catch (error) {
      say(timedOut ? MESSAGES.timeout : navigator.onLine === false ? MESSAGES.offline : MESSAGES.network, 'error');
    } finally {
      clearTimeout(timer);
      sending = false;
      submit.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });

  // A privacy question that needs an answer goes to the private address; feedback can't be answered.
  const category = $('feedback-category'), hint = $('feedback-hint');
  const generalHint = hint.textContent;
  category.addEventListener('change', () => {
    if (category.value === 'privacy') {
      hint.innerHTML = 'Need an answer, or something deleted? Email ' +
        '<a href="mailto:privacy@offerfilter.org">privacy@offerfilter.org</a> instead.';
    } else {
      hint.textContent = generalHint;
    }
  });

  // Film.
  play.addEventListener('click', () => {
    film.play().catch(() => { play.hidden = false; syncMotion(); });
  });
  // The play button offers the sound while the film loops muted, steps aside while it plays, and offers a replay at
  // its end.
  const offer = (text, label) => { play.hidden = false; play.querySelector('b').textContent = text; play.setAttribute('aria-label', label); };
  function follow(f) {
    f.addEventListener('loop', () => { offer('Play with sound', 'Play the Offer Filter film with sound'); syncMotion(); });
    f.addEventListener('play', () => { play.hidden = true; syncMotion(); });
    f.addEventListener('pause', syncMotion);
    f.addEventListener('error', syncMotion);
    f.addEventListener('ended', () => { offer('Replay film', 'Replay the Offer Filter film'); syncMotion(); });
  }
  follow(film);
  // The live film finds out it has no WebGL only when first wanted: the MP4 takes its place, playing if asked to. If the
  // browser refuses to start it without a fresh tap, the play button comes back for one (the MP4 has no controls yet).
  if (window.offerFilm) window.offerFilm.addEventListener('unavailable', () => {
    const wanted = window.offerFilm.wanted;
    film = videoFallback(); follow(film);
    if (wanted) film.play().catch(() => { play.hidden = false; syncMotion(); });
  });

  // The sky button works as the app's sun button does: each tap moves on through Day, Night, System (the device's own
  // light or dark) and Auto (night from 6 pm to 6 am on this device's clock: the app's fallback when it knows no
  // place), Auto to begin with. A small badge marks System and Auto, and a short note names the new choice. The
  // browser's own bars (theme-color) follow the sky.
  const THEME = 'offerfilter.theme', MODES = ['DAY', 'NIGHT', 'SYSTEM', 'AUTO'], LABEL = {DAY: 'Day', NIGHT: 'Night', SYSTEM: 'System', AUTO: 'Auto'};
  const dark = matchMedia('(prefers-color-scheme: dark)'), sky = $('sky-toggle'), toast = $('sky-toast');
  const themeColor = document.querySelector('meta[name="theme-color"]');
  let mode = 'AUTO', toastTimer = 0, turnTimer = 0;
  try { if (MODES.includes(localStorage.getItem(THEME))) mode = localStorage.getItem(THEME); } catch (e) {}
  const next = m => MODES[(MODES.indexOf(m) + 1) % MODES.length];
  const clockNight = () => { const hour = new Date().getHours(); return hour < 6 || hour >= 18; };
  const isNight = () => mode === 'DAY' ? false : mode === 'NIGHT' ? true : mode === 'SYSTEM' ? dark.matches : clockNight();
  function showTheme() {
    const night = isNight();
    if (document.body.classList.contains('night') !== night) {
      // The page's colors ease while the sky turns (style.css), then settle back to their own quick transitions.
      document.documentElement.classList.add('turning');
      clearTimeout(turnTimer);
      turnTimer = setTimeout(() => document.documentElement.classList.remove('turning'), 1700);
      document.body.classList.toggle('night', night);
      window.setSceneNight?.(night);
    }
    if (themeColor) themeColor.content = night ? '#102032' : '#efe9db';
    const basis = mode === 'AUTO' ? 'night from 6 pm to 6 am on this device' : mode === 'SYSTEM' ? 'follows this device' : 'fixed';
    const said = `Sky: ${LABEL[mode]}, ${night ? 'night' : 'day'}, ${basis}. Tap for ${LABEL[next(mode)]}.`;
    sky.setAttribute('aria-label', said); sky.title = said;
    sky.dataset.mode = mode;
  }
  sky.addEventListener('click', () => {
    mode = next(mode);
    try { localStorage.setItem(THEME, mode); } catch (e) {}
    showTheme();
    toast.textContent = LABEL[mode] + (mode === 'AUTO' ? ' · 6 am–6 pm local clock' : mode === 'SYSTEM' ? ' · follows this device' : '');
    toast.classList.add('shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('shown'), 2200);
  });
  dark.addEventListener('change', showTheme);
  // Auto turns the sky at 6 am and 6 pm while the page is open.
  setInterval(() => { if (mode === 'AUTO') showTheme(); }, 60000);
  showTheme();
})();
