'use strict';

// Content assertions shared by the full browser gate and permitted source checks.
// These checks never replace the browser, layout, interaction or deployment gates.
const AREA_LEARNING_VERSION_CODE = 92; // 0.6.0

function required(text, phrases, name) {
  return phrases.map(phrase => ({name: `${name}: ${phrase}`, ok: text.includes(phrase)}));
}

function installCopyChecks(text, guideCode) {
  if (!Number.isInteger(guideCode) || guideCode <= 0) {
    return [{name: 'guide has an explicit valid version code', ok: false}];
  }
  text = text.replace(/\s+/g, ' ').trim();
  if (guideCode < AREA_LEARNING_VERSION_CODE) {
    return ['combined area score', 'Keep the learning you choose'].map(phrase =>
      ({name: `pre-0.6 guide drops retired wording: ${phrase}`, ok: !text.includes(phrase)}));
  }
  return [
    ...required(text, ['Strict is the default', 'stronger pay or rates can compensate',
      'Max stops stays a hard limit', 'Area mode starts off', 'Learn from my acceptances',
      'Settings → Mode · Strict', 'Settings → Learned · Off',
      'Automatic accepts, declines and add-ons never teach it', 'saved knobs',
      'Adopt raises only lower saved minimums', 'Undo adoption', 'Clear history',
      'Earlier decisions keep their original numeric requirements',
      'adopted saved minimums stay', 'Auto-accept remains a separate choice',
      '100% or any higher Autopilot bar', 'Add-ons stay strict', 'without learned standalone floors',
      'optional timing study or diagnostics sharing', 'no old lessons restored',
      'growth waits while an enabled learned minimum is higher than its saved minimum'], '0.6 guide'),
    {name: '0.6 guide does not say area and learning are gone',
      ok: !text.includes('Score by area, per stop, per item and the old learned minimums are gone')},
  ];
}

function legalCopyChecks(texts, releaseCode, guideCode) {
  const checks = [];
  if (![releaseCode, guideCode].every(code => Number.isInteger(code) && code > 0)) {
    return [{name: 'release and guide have explicit valid version codes', ok: false}];
  }
  texts = Object.fromEntries(Object.entries(texts).map(([pathname, text]) =>
    [pathname, text.replace(/\s+/g, ' ').trim()]));
  const restored = Math.max(releaseCode, guideCode) >= AREA_LEARNING_VERSION_CODE;
  if (releaseCode >= 80 || restored) {
    for (const pathname of ['/terms/', '/privacy/']) {
      checks.push(...required(texts[pathname], ['Autopilot'], `${pathname} describes Autopilot`));
      for (const phrase of restored ? ['0.4.73'] : ['compensating', '0.4.73']) {
        checks.push({name: `${pathname} drops retired wording: ${phrase}`, ok: !texts[pathname].includes(phrase)});
      }
    }
  }
  if (!restored) return checks;
  checks.push({name: 'guide covers the restored 0.6 model', ok: guideCode >= AREA_LEARNING_VERSION_CODE});
  checks.push(...required(texts['/terms/'], [
    'Strict mode is the default', 'Area mode is a separate, initially off choice',
    'Maximum stops remains a hard limit', 'Acceptance learning is separate from area mode and Autopilot',
    'Automatic accepts, declines, add-ons and ambiguous outcomes do not teach it',
    'without moving saved knobs', 'Reset and Clear history preserve those adopted saved minimums',
    '100% or any higher Autopilot bar',
    'standalone learned floors do not apply to add-ons unless adopted as saved minimums',
    'prior decision snapshots remain until Clear history',
  ], '0.6 terms'));
  checks.push(...required(texts['/privacy/'], [
    'Learned evidence starts empty', 'Learned bests have no age expiry',
    'pausing or switching learning off retains them', 'Adopted saved minima remain settings',
    'restored learned bests', 'adoption Undo', 'Uncheck and save to stop new study collection/sharing',
    'A report already sent or a request already in flight cannot be recalled',
    'scoring mode, learning on/off and the recorded score kind',
    'per-decision required pay', 'Raw learned-best snapshots and adoption receipts are not sent',
  ], '0.6 privacy'));
  return checks;
}

module.exports = {AREA_LEARNING_VERSION_CODE, installCopyChecks, legalCopyChecks};
