#!/usr/bin/env python3
"""Writes assets/release.json, the download button's label and link, from the app's published release feed.

    python3 tools/sync-release.py                       # from ../dasher-offer-filter/release/latest.json
    python3 tools/sync-release.py --app-repo PATH       # another checkout of the app repository
    python3 tools/sync-release.py --live                # from what Render serves right now
    python3 tools/sync-release.py --check               # exit 1 if assets/release.json is out of date

Run it at every release, after the new APK is live on Render (the Render static site does not deploy itself), so the
site never labels a version Render does not serve. The page reads assets/release.json from its own origin:

    {"versionName", "versionCode", "sizeBytes", "sha256", "apkUrl", "date"}

apkUrl is always the Render APK, the same file the app's own updater installs. date is the day (UTC) the feed was
committed in the app repository, or Render's Last-Modified with --live; --date YYYY-MM-DD overrides it.
Only the Python standard library is used.
"""
import argparse
import datetime
import email.utils
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.request

SITE = pathlib.Path(__file__).resolve().parents[1]
TARGET = SITE / 'assets/release.json'
PACKAGE = 'com.local.dasherfilter'
RENDER = 'https://dash-offer-filter-build.onrender.com'
APK_URL = RENDER + '/OfferFilter.apk'


def fail(message):
    sys.exit('sync-release: ' + message)


def default_app_repo():
    configured = os.environ.get('OFFER_FILTER_APP_REPO')
    return pathlib.Path(configured) if configured else SITE.parent / 'dasher-offer-filter'


def local_feed(repo):
    path = repo / 'release/latest.json'
    if not path.is_file():
        fail(f'{path} not found; pass --app-repo or set OFFER_FILTER_APP_REPO')
    feed = json.loads(path.read_text(encoding='utf-8'))
    apk = repo / 'release/OfferFilter.apk'
    if apk.is_file():  # the feed must describe the APK beside it
        data = apk.read_bytes()
        if len(data) != int(feed.get('size', -1)) or hashlib.sha256(data).hexdigest() != feed.get('sha256'):
            fail(f'{apk} does not match {path} (size or SHA-256)')
    return feed, committed_day(repo, 'release/latest.json')


def committed_day(repo, relative):
    try:
        stamp = subprocess.run(['git', '-C', str(repo), 'log', '-1', '--format=%cI', '--', relative],
                               capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        stamp = ''
    if not stamp:
        return None
    return datetime.datetime.fromisoformat(stamp).astimezone(datetime.timezone.utc).date().isoformat()


def live_feed():
    request = urllib.request.Request(RENDER + '/latest.json', headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=30) as response:
        feed = json.loads(response.read().decode('utf-8'))
        modified = response.headers.get('Last-Modified')
    day = None
    if modified:
        try:
            day = email.utils.parsedate_to_datetime(modified).astimezone(datetime.timezone.utc).date().isoformat()
        except (TypeError, ValueError):
            day = None
    return feed, day


def release(feed, day):
    if feed.get('packageName', PACKAGE) != PACKAGE:
        fail('the feed names another package: %r' % feed.get('packageName'))
    name = str(feed.get('versionName', ''))
    if not re.fullmatch(r'[0-9A-Za-z][0-9A-Za-z._+-]{0,31}', name):
        fail('versionName missing or malformed: %r' % name)
    code, size, sha = feed.get('versionCode'), feed.get('size'), str(feed.get('sha256', '')).lower()
    if not isinstance(code, int) or code < 1:
        fail('versionCode missing or malformed: %r' % code)
    if not isinstance(size, int) or size < 1:
        fail('size missing or malformed: %r' % size)
    if not re.fullmatch(r'[0-9a-f]{64}', sha):
        fail('sha256 missing or malformed')
    if not day:
        day = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    return {'versionName': name, 'versionCode': code, 'sizeBytes': size, 'sha256': sha, 'apkUrl': APK_URL,
            'date': day}


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--app-repo', type=pathlib.Path, default=None, help='app repository checkout')
    parser.add_argument('--live', action='store_true', help="read Render's live latest.json instead")
    parser.add_argument('--date', help='release day, YYYY-MM-DD')
    parser.add_argument('--check', action='store_true', help='compare only; exit 1 when out of date')
    args = parser.parse_args()
    if args.date and not re.fullmatch(r'\d{4}-\d{2}-\d{2}', args.date):
        fail('--date must be YYYY-MM-DD')
    feed, day = live_feed() if args.live else local_feed(args.app_repo or default_app_repo())
    text = json.dumps(release(feed, args.date or day), indent=2) + '\n'
    current = TARGET.read_text(encoding='utf-8') if TARGET.is_file() else ''
    if args.check:
        if current != text:
            print('assets/release.json is out of date:\n' + text, end='')
            sys.exit(1)
        print('assets/release.json is current')
        return
    if current != text:
        TARGET.write_text(text, encoding='utf-8')
    print(('wrote ' if current != text else 'unchanged ') + str(TARGET.relative_to(SITE)) + '\n' + text, end='')


if __name__ == '__main__':
    main()
