(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const FEEDBACK_ENDPOINT = 'https://zlnfvqyyjsltmkmmpgzp.supabase.co/functions/v1/offer-filter-feedback';
  const MEDIA = '?v=20261006-app', play = $('film-play');
  let film = window.offerFilm || videoFallback();
  // The live player (player.js) and the MP4 share one interface: play(), pause(), paused, ended and their events.
  // Without a canvas or the film script, the composed MP4 for this screen plays instead, with native controls.
  function videoFallback() {
    const small = matchMedia('(max-width: 600px)').matches, video = document.createElement('video');
    const src = `assets/offer-filter-${small ? 'square' : 'landscape'}.mp4${MEDIA}`;
    Object.assign(video, {controls: true, playsInline: true, preload: 'none', src, poster: `assets/film-poster-${small ? 'square' : 'wide'}.jpg${MEDIA}`});
    video.setAttribute('aria-label', 'Offer Filter animated film');
    video.append(Object.assign(document.createElement('track'), {kind: 'captions', src: `assets/film-captions.vtt${MEDIA}`, srclang: 'en', label: 'English'}));
    $('film-stage').replaceChildren(video, play);
    $('film-stage').classList.add('film-video');
    return video;
  }
  let opener = null;
  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Quiet scenery temporarily; preserve the visitor's motion preference.
  function syncMotion() {
    const dialogOpen = document.querySelector('dialog[open]') !== null;
    const quiet = paused || dialogOpen || (!film.paused && !film.ended && !film.error);
    document.body.classList.toggle('dialog-open', dialogOpen);
    document.body.classList.toggle('motion-paused', quiet);
    window.setScenePaused?.(quiet);
  }
  function open(id, source) {
    document.querySelectorAll('dialog[open]').forEach(d => { if (d.id !== id) d.close(); });
    opener = source;
    film.pause();
    $(id).showModal();
    syncMotion();
  }
  document.querySelectorAll('[data-close]').forEach(b =>
    b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => {
    d.addEventListener('close', () => { syncMotion(); opener?.focus(); });
    d.addEventListener('click', e => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
  });
  [['tip-open', 'tip-dialog'], ['download-open', 'download-dialog'], ['about-open', 'about-dialog'],
    ['feedback-open', 'feedback-dialog']]
    .forEach(([b, d]) => $(b).addEventListener('click', () => open(d, $(b))));
  $('help-feedback-open').addEventListener('click', () => open('feedback-dialog', $('help-feedback-open')));
  $('help-open').addEventListener('click', e => {
    e.preventDefault();
    open('help-dialog', $('help-open'));
  });
  const feedbackForm = $('feedback-form');
  feedbackForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = $('feedback-message').value.trim();
    if (!message) return;
    const submit = $('feedback-submit'), status = $('feedback-status');
    submit.disabled = true;
    status.textContent = 'Sending…';
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
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'unavailable');
      $('feedback-message').value = '';
      status.textContent = 'Sent' + (result.reference ? ' · reference ' + result.reference : '') + '. Thank you.';
    } catch (error) {
      status.textContent = 'Could not send feedback. Please try again.';
    } finally {
      submit.disabled = false;
    }
  });

  function openLinkedHelp() {
    if (location.hash === '#help' && !$('help-dialog').open) open('help-dialog', $('help-open'));
  }
  window.addEventListener('hashchange', openLinkedHelp);
  openLinkedHelp();
  play.addEventListener('click', () => {
    film.play().catch(() => { play.hidden = false; syncMotion(); });
  });
  function follow(f) {
    f.addEventListener('play', () => { play.hidden = true; syncMotion(); });
    f.addEventListener('pause', syncMotion);
    f.addEventListener('error', syncMotion);
    f.addEventListener('ended', () => {
      play.hidden = false;
      play.querySelector('b').textContent = 'Replay film';
      play.setAttribute('aria-label', 'Replay the Offer Filter film');
      syncMotion();
    });
  }
  follow(film);
  // The live film finds out it has no WebGL only when first wanted: the MP4 takes its place, playing if asked to.
  if (window.offerFilm) window.offerFilm.addEventListener('unavailable', () => {
    const wanted = window.offerFilm.wanted;
    film = videoFallback(); follow(film);
    if (wanted) film.play().catch(() => {});
  });
  // The sky button works as the app's sun button does: each tap moves on through Day, Night, System (the device's own
  // light or dark) and Auto (night from 6 pm to 6 am on this device's clock: the app's fallback when it knows no
  // place), Auto to begin with. A small badge marks System and Auto, and a short note names the new choice.
  const THEME = 'offerfilter.theme', MODES = ['DAY', 'NIGHT', 'SYSTEM', 'AUTO'], LABEL = {DAY: 'Day', NIGHT: 'Night', SYSTEM: 'System', AUTO: 'Auto'};
  const dark = matchMedia('(prefers-color-scheme: dark)'), sky = $('sky-toggle'), toast = $('sky-toast');
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
  function label() {
    const b = $('motion-toggle');
    b.textContent = paused ? 'Resume motion' : 'Pause motion';
    b.setAttribute('aria-pressed', String(paused));
    syncMotion();
  }
  label();
  $('motion-toggle').addEventListener('click', () => { paused = !paused; label(); });
})();

