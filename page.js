(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const FEEDBACK_ENDPOINT = 'https://zlnfvqyyjsltmkmmpgzp.supabase.co/functions/v1/offer-filter-feedback';
  const FEEDBACK_TIMEOUT_MS = 15000;
  const FEEDBACK_MAX = 4000;
  const film = $('film'), play = $('film-play'), stage = film.closest('.film-stage');

  // Phones get the composed square film. The browser picks the source once (<source media>), so the choice stays
  // fixed for the visit (no crop, autoplay, reload or reset on rotation) and nothing is fetched before Play. Only the
  // matching poster is fetched: the HTML has none, and its preload hints use the same media query.
  const square = film.currentSrc ? /offer-filter-square/.test(film.currentSrc) : matchMedia('(max-width: 600px)').matches;
  stage.classList.add(square ? 'film-square' : 'film-wide');
  if (square) {
    film.width = film.height = 1080;
    $('film-save').href = film.querySelector('source:last-of-type').getAttribute('src');
  }
  film.poster = square ? film.dataset.posterSquare : film.dataset.posterWide;
  play.hidden = false;

  // Captions: a visible switch that follows the player's own captions menu too. Its name stays "Captions"; the
  // state is aria-pressed (the on/off word is for sighted visitors only).
  const captions = $('captions-toggle');
  const track = film.textTracks && film.textTracks[0];
  function showCaptions() {
    const on = !!track && track.mode === 'showing';
    captions.lastElementChild.textContent = on ? 'on' : 'off';
    captions.setAttribute('aria-pressed', String(on));
  }
  if (track) {
    captions.hidden = false;
    captions.addEventListener('click', () => {
      track.mode = track.mode === 'showing' ? 'hidden' : 'showing';
      showCaptions();
    });
    film.textTracks.addEventListener('change', showCaptions);
    showCaptions();
  }

  // Motion: the visitor's choice, the system's reduced-motion setting, and quiet while a dialog or the film is up.
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduceMotion.matches;
  function syncMotion() {
    const dialogOpen = document.querySelector('dialog[open]') !== null;
    const quiet = paused || dialogOpen || (!film.paused && !film.ended && !film.error);
    document.body.classList.toggle('dialog-open', dialogOpen);
    document.body.classList.toggle('motion-paused', quiet);
    window.setScenePaused?.(quiet);
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
    rateLimited: 'Too many sends from this network — try again in a few minutes.',
    rejected: 'Couldn’t be accepted — shorten it?',
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

  // Film.
  play.addEventListener('click', () => {
    film.play().catch(() => { play.hidden = false; syncMotion(); });
  });
  film.addEventListener('play', () => { play.hidden = true; syncMotion(); });
  film.addEventListener('pause', syncMotion);
  film.addEventListener('error', syncMotion);
  film.addEventListener('ended', () => {
    play.hidden = false;
    play.querySelector('b').textContent = 'Replay film';
    play.setAttribute('aria-label', 'Replay the Offer Filter film');
    syncMotion();
  });

  // Sky.
  $('sky-toggle').addEventListener('click', () => {
    const night = document.body.classList.toggle('night');
    $('sky-toggle').setAttribute('aria-label', night ? 'Switch to day' : 'Switch to night');
    window.setSceneNight?.(night);
  });
})();
