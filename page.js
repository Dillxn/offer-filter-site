(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const FEEDBACK_ENDPOINT = 'https://zlnfvqyyjsltmkmmpgzp.supabase.co/functions/v1/offer-filter-feedback';
  const film = $('film'), play = $('film-play');
  // Select a composed square film on phones, then keep that choice stable
  // throughout playback. No crop, autoplay, or reset when the viewport changes.
  if (matchMedia('(max-width: 600px)').matches) {
    const source = film.querySelector('source');
    source.src = 'assets/offer-filter-square.mp4?v=open-ending-20261004';
    film.poster = 'assets/film-poster-square.jpg?v=open-ending-20261004';
    film.width = film.height = 1080;
    film.closest('.film-stage').classList.add('film-square');
    film.load();
    document.querySelector('.film-heading a[download]').href = source.src;
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
  film.addEventListener('play', () => { play.hidden = true; syncMotion(); });
  film.addEventListener('pause', syncMotion);
  film.addEventListener('error', syncMotion);
  film.addEventListener('ended', () => {
    play.hidden = false;
    play.querySelector('b').textContent = 'Replay film';
    play.setAttribute('aria-label', 'Replay the Offer Filter film');
    syncMotion();
  });
  $('sky-toggle').addEventListener('click', () => {
    const night = document.body.classList.toggle('night');
    $('sky-toggle').setAttribute('aria-label', night ? 'Switch to day' : 'Switch to night');
    window.setSceneNight?.(night);
  });
  function label() {
    const b = $('motion-toggle');
    b.textContent = paused ? 'Resume motion' : 'Pause motion';
    b.setAttribute('aria-pressed', String(paused));
    syncMotion();
  }
  label();
  $('motion-toggle').addEventListener('click', () => { paused = !paused; label(); });
})();

