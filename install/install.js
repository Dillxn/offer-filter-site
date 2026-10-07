(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const PAGE_URL = 'https://offerfilter.org/install/';

  // Who is reading: the app is Android-only, so say so to iPhone and computer visitors.
  const ua = navigator.userAgent || '';
  const android = /Android/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const note = $('platform-note');
  if (ios) {
    // An APK can't be opened on an iPhone or iPad: no download here, just a way to send this page to an Android phone.
    note.textContent = 'This is an Android app. Offer Filter isn’t available for iPhone or iPad. To install it on an ' +
      'Android phone, open offerfilter.org/install there, or send yourself the link.';
    const share = document.createElement('button');
    share.type = 'button';
    share.className = 'button-secondary';
    share.id = 'share-link';
    share.textContent = navigator.share ? 'Share the link' : 'Copy the link';
    share.addEventListener('click', async () => {
      if (navigator.share) {
        try { await navigator.share({title: 'Install Offer Filter', url: PAGE_URL}); } catch (error) { /* closed */ }
        return;
      }
      try {
        await navigator.clipboard.writeText(PAGE_URL);
        share.textContent = 'Link copied';
      } catch (error) {
        share.textContent = 'Couldn’t copy; the address is offerfilter.org/install';
      }
    });
    note.append(document.createElement('br'), share);
    note.hidden = false;
    for (const id of ['download-apk', 'download-meta']) $(id).hidden = true;
    return;
  }
  if (!android && !/Mobi/i.test(ua)) {
    note.innerHTML = 'On a computer? Open <strong>offerfilter.org/install</strong> on your Android phone, ' +
      'or scan this code with its camera.<img src="../assets/install-qr.svg?v=20261007-beta" width="132" height="132" ' +
      'alt="QR code for offerfilter.org/install">';
    note.hidden = false;
  }

  // Label the download from assets/release.json (same origin), written by tools/sync-release.py.
  const formatSize = bytes => bytes >= 1e6 ? (bytes / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1e3)) + ' KB';
  const formatDate = day => {
    const date = new Date(day + 'T12:00:00Z');
    return isNaN(date) ? '' : date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
  };
  fetch('../assets/release.json', {cache: 'no-cache'})
    .then(response => response.ok ? response.json() : Promise.reject(new Error('release.json ' + response.status)))
    .then(release => {
      if (!release || !release.versionName || !(release.sizeBytes > 0)) return;
      const version = $('download-version');
      version.textContent = release.versionName + ' · ' + formatSize(release.sizeBytes);
      version.hidden = false;
      if (/^https:\/\//.test(release.apkUrl || '')) $('download-apk').href = release.apkUrl;
      const released = release.date ? formatDate(release.date) : '';
      $('download-meta').textContent = 'Version ' + release.versionName + (released ? ', released ' + released : '') +
        '. Android 8 or later. A signed APK from Offer Filter’s update server, dash-offer-filter-build.onrender.com, ' +
        'the same place the app gets its own updates.';
      if (/^[0-9a-f]{64}$/.test(release.sha256 || '')) {
        $('download-sha').textContent = release.sha256;
        $('download-check').hidden = false;
      }
      // Until the upcoming beta is published, say so next to the button: parts of this guide are for it.
      const upcoming = $('whats-new');
      const pending = $('beta-pending');
      if (upcoming && pending && Number(release.versionCode) < Number(upcoming.dataset.versionCode)) {
        const next = upcoming.dataset.versionName;
        pending.textContent = next + ' is on its way. Until it’s published, this download is ' + release.versionName +
          ': it works differently in places and doesn’t have the parts marked “New in ' + next + '”. Once ' +
          'installed, Offer Filter updates itself.';
        pending.hidden = false;
      }
    })
    .catch(() => { /* Keep the plain label; the link still downloads the current app. */ });
})();
