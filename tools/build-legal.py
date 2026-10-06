#!/usr/bin/env python3
"""Builds /terms/, /privacy/ and /license/ from the app's TERMS.md, PRIVACY.md and LICENSE.

    python3 tools/build-legal.py                    # from ../dasher-offer-filter
    python3 tools/build-legal.py --app-repo PATH    # another checkout of the app repository
    python3 tools/build-legal.py --check            # exit 1 if a page is out of date

Re-run it whenever the app's legal texts change, and at every release, so the site shows the same words the app
does. It writes terms/index.html, privacy/index.html and license/index.html (directory index files, so the clean
URLs work on GitHub Pages). Privacy gets one extra section at the end, "This website", which is maintained here in
WEBSITE_PRIVACY below.

Only the Python standard library is used. The converter handles the Markdown the texts use and a little more
(headings, paragraphs, nested lists, block quotes, fenced code, tables, rules, bold, italics, code, links and bare
URLs or e-mail addresses); anything else stays as escaped text.
"""
import argparse
import hashlib
import html
import os
import pathlib
import re
import sys

SITE = pathlib.Path(__file__).resolve().parents[1]
ORIGIN = 'https://offerfilter.org'
SOURCE_CODE = 'https://github.com/Dillxn/dasher-offer-filter'

WEBSITE_PRIVACY = """\
## This website

The sections above describe the app. This one covers offerfilter.org itself.

- **Hosting.** The site is a set of static pages hosted by GitHub Pages. Like any web host, GitHub receives the \
usual request information (your IP address, browser details and the page you asked for) and may keep it in server \
logs under GitHub's own privacy statement. The site has no accounts and no sign-in.
- **No cookies, no analytics.** The site sets no cookies, stores nothing in your browser, and runs no analytics, ads \
or tracking. Its pages, fonts, images and film come from offerfilter.org itself.
- **Feedback form.** Nothing is sent until you tap Send. Then the site sends the type you chose and the message you \
typed, marked as coming from the website, to the Offer Filter feedback service: a Supabase Edge Function, reached \
through Supabase's network (which includes Cloudflare). The service turns your connection's IP address into a \
rotating, one-way rate-limit value and does not store the IP address with your feedback. Supabase and Cloudflare \
handle ordinary connection data under their own policies. Feedback is deleted after 90 days.
- **Who reads feedback.** Feedback may be reviewed by the developer, with the help of AI assistants such as \
Anthropic's Claude or OpenAI's ChatGPT/Codex, to investigate problems. There is no reply address, so we can't answer \
you directly. Please leave out customer names, addresses, payment, account or password details.
- **Download.** The download button fetches the app from its update server on Render \
(dash-offer-filter-build.onrender.com), which receives ordinary connection information. The install page reads the \
current version number from offerfilter.org.
- **Tips and other links.** The tip links open Cash App or Venmo; the site sends them nothing and counts nothing. \
Source-code links open GitHub. Those services handle your visit under their own policies.
"""

PAGES = {
    'terms': {'file': 'TERMS.md', 'title': 'Terms of use', 'description':
              'The terms for using Offer Filter, the independent Android offer filter for Dashers.'},
    'privacy': {'file': 'PRIVACY.md', 'title': 'Privacy', 'description':
                'What Offer Filter reads, keeps and sends, and how offerfilter.org handles your information.'},
    'license': {'file': 'LICENSE', 'title': 'License', 'description':
                'Offer Filter is free and open-source software under the MIT License.'},
}

# ---------------------------------------------------------------------------------------------------------------
# Markdown to HTML (the subset the legal texts use, kept strict and escaped)

LIST_ITEM = re.compile(r'^( {0,12})([-*+]|\d{1,9}[.)])[ \t]+(.*)$')
HEADING = re.compile(r'^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$')
RULE = re.compile(r'^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$')
FENCE = re.compile(r'^ {0,3}(`{3,}|~{3,})(.*)$')
QUOTE = re.compile(r'^ {0,3}> ?(.*)$')
TABLE_RULE = re.compile(r'^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$')


def slug(text, used):
    base = re.sub(r'[^a-z0-9]+', '-', html.unescape(re.sub(r'<[^>]+>', '', text)).lower()).strip('-') or 'section'
    name, n = base, 2
    while name in used:
        name, n = f'{base}-{n}', n + 1
    used.add(name)
    return name


LOCAL_TARGETS = {'LICENSE': '../license/', 'TERMS.md': '../terms/', 'PRIVACY.md': '../privacy/'}


def target(url):
    """Links between the texts stay on the site; other repository-relative links go to GitHub."""
    if url in LOCAL_TARGETS:
        return LOCAL_TARGETS[url]
    if re.match(r'^(?:[a-z][a-z0-9+.-]*:|#|/)', url, re.I):
        return url
    return f'{SOURCE_CODE}/blob/main/{url}'


def emphasis(text):
    text = re.sub(r'\*\*(?=\S)(.+?)(?<=\S)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'(?<![\w_])__(?=\S)(.+?)(?<=\S)__(?![\w_])', r'<strong>\1</strong>', text)
    text = re.sub(r'(?<![\w*])\*(?=[^\s*])(.+?)(?<=[^\s*])\*(?![\w*])', r'<em>\1</em>', text)
    return re.sub(r'(?<![\w_])_(?=[^\s_])(.+?)(?<=[^\s_])_(?![\w_])', r'<em>\1</em>', text)


def inline(text):
    """Escaped inline HTML: code spans, links, autolinks, bare URLs and e-mail, bold and italics."""
    held = []

    def hold(fragment):
        held.append(fragment)
        return f'\x00{len(held) - 1}\x00'

    def link(label, url):
        return hold(f'<a href="{target(url).replace(chr(34), "%22")}">{emphasis(label)}</a>')

    text = re.sub(r'\\([\\`*_{}\[\]()#+\-.!>|])', lambda m: hold(html.escape(m.group(1))), text)
    text = re.sub(r'(`+)(.+?)\1', lambda m: hold('<code>' + html.escape(m.group(2).strip()) + '</code>'), text)
    text = html.escape(text, quote=False)
    text = re.sub(r'\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^)]*")?\)', lambda m: link(m.group(1), m.group(2)), text)
    text = re.sub(r'&lt;((?:https?://|mailto:)[^\s<>]+?)&gt;', lambda m: link(m.group(1), m.group(1)), text)
    text = re.sub(r'(?<![\w/@.\x00-])(https?://[^\s<\x00]*[^\s<\x00.,;:!?)\]\'"])',
                  lambda m: link(m.group(1), m.group(1)), text)
    text = re.sub(r'(?<![\w/@.\x00-])([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})(?![\w@])',
                  lambda m: link(m.group(1), 'mailto:' + m.group(1)), text)
    text = emphasis(text)
    while '\x00' in text:
        text = re.sub(r'\x00(\d+)\x00', lambda m: held[int(m.group(1))], text)
    return text


def indent_of(line):
    return len(line) - len(line.lstrip(' '))


def starts_block(line):
    item = LIST_ITEM.match(line)
    return bool(HEADING.match(line) or RULE.match(line) or FENCE.match(line) or QUOTE.match(line)
                or (item and (not item.group(2)[0].isdigit() or item.group(2)[:-1] == '1')))


def paragraph(lines):
    parts = []
    for n, line in enumerate(lines):
        last = n == len(lines) - 1
        hard = not last and (line.endswith('  ') or line.endswith('\\'))
        parts.append(inline(line.rstrip().rstrip('\\').strip()) + ('<br>' if hard else ''))
    return '<p>' + '\n'.join(parts) + '</p>'


def parse_list(lines, i, used):
    first = LIST_ITEM.match(lines[i])
    base, ordered = len(first.group(1)), first.group(2)[0].isdigit()
    marker = first.group(2)[-1]
    start = int(first.group(2)[:-1]) if ordered else None
    items, current, content, loose = [], None, 0, False

    def sibling(match):
        if not match or len(match.group(1)) != base:
            return False
        return (match.group(2)[0].isdigit() == ordered) and match.group(2)[-1] == marker

    while i < len(lines):
        line = lines[i]
        if not line.strip():
            j = i + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines) and (sibling(LIST_ITEM.match(lines[j])) or indent_of(lines[j]) >= content):
                current.append('')
                loose = True
                i += 1
                continue
            break
        match = LIST_ITEM.match(line)
        if sibling(match):
            current = [match.group(3)]
            items.append(current)
            content = match.start(3)
            i += 1
            continue
        depth = indent_of(line)
        if depth > base and (match or depth >= content):
            current.append(line[min(depth, content):])
            i += 1
            continue
        if not match and not starts_block(line) and current and current[-1] != '':
            current.append(line.strip())  # lazy continuation of the item's paragraph
            i += 1
            continue
        break

    tag = 'ol' if ordered else 'ul'
    attrs = f' start="{start}"' if ordered and start != 1 else ''
    out = [f'<{tag}{attrs}>']
    for item in items:
        while item and item[-1] == '':
            item.pop()
        body = render(item, used)
        if not loose and body.startswith('<p>'):
            end = body.index('</p>')
            body = body[3:end] + body[end + 4:]
        out.append('<li>' + body + '</li>')
    out.append(f'</{tag}>')
    return '\n'.join(out), i


def parse_table(lines, i):
    def cells(row):
        row = row.strip()
        if row.startswith('|'):
            row = row[1:]
        if row.endswith('|'):
            row = row[:-1]
        return [c.strip() for c in row.split('|')]

    head = cells(lines[i])
    i += 2
    rows = []
    while i < len(lines) and lines[i].strip() and '|' in lines[i]:
        rows.append(cells(lines[i]))
        i += 1
    out = ['<div class="table"><table>', '<thead><tr>' + ''.join(f'<th scope="col">{inline(c)}</th>' for c in head)
           + '</tr></thead>', '<tbody>']
    for row in rows:
        out.append('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in row) + '</tr>')
    out.append('</tbody></table></div>')
    return '\n'.join(out), i


def render(lines, used):
    out, i = [], 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        fence = FENCE.match(line)
        if fence:
            mark, body = fence.group(1), []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith(mark):
                body.append(lines[i])
                i += 1
            i += 1
            out.append('<pre><code>' + html.escape('\n'.join(body)) + '</code></pre>')
            continue
        heading = HEADING.match(line)
        if heading:
            level, text = len(heading.group(1)), inline(heading.group(2))
            out.append(f'<h{level} id="{slug(text, used)}">{text}</h{level}>')
            i += 1
            continue
        if RULE.match(line):
            out.append('<hr>')
            i += 1
            continue
        if QUOTE.match(line):
            body = []
            while i < len(lines) and lines[i].strip() and (QUOTE.match(lines[i]) or not starts_block(lines[i])):
                quoted = QUOTE.match(lines[i])
                body.append(quoted.group(1) if quoted else lines[i])
                i += 1
            out.append('<blockquote>\n' + render(body, used) + '\n</blockquote>')
            continue
        if '|' in line and i + 1 < len(lines) and TABLE_RULE.match(lines[i + 1]):
            table, i = parse_table(lines, i)
            out.append(table)
            continue
        if LIST_ITEM.match(line):
            block, i = parse_list(lines, i, used)
            out.append(block)
            continue
        body = []
        while i < len(lines) and lines[i].strip() and not (body and starts_block(lines[i])):
            body.append(lines[i])
            i += 1
        out.append(paragraph(body))
    return '\n'.join(out)


def markdown(text):
    """(title, body HTML): the first level-1 heading becomes the title; the rest is the body."""
    lines = text.replace('\r\n', '\n').replace('\r', '\n').replace('\t', '    ').split('\n')
    title = None
    for n, line in enumerate(lines):
        match = HEADING.match(line)
        if match and len(match.group(1)) == 1:
            title = inline(match.group(2))
            del lines[n]
            break
        if line.strip():
            break
    return title, render(lines, set())


def plain_text(text):
    """LICENSE: the first line is the title; blank-line-separated paragraphs, hard wraps joined."""
    blocks = [b for b in re.split(r'\n\s*\n', text.replace('\r\n', '\n').strip()) if b.strip()]
    title = html.escape(blocks[0].strip()) if '\n' not in blocks[0].strip() else 'License'
    body = blocks[1:] if '\n' not in blocks[0].strip() else blocks
    return title, '\n'.join('<p>' + html.escape(' '.join(l.strip() for l in b.split('\n'))) + '</p>' for b in body)

# ---------------------------------------------------------------------------------------------------------------
# Pages

REDIRECT = ("<script>if(location.protocol==='http:'&&/(^|\\.)offerfilter\\.org$/.test(location.hostname))"
            "location.replace('https://offerfilter.org'+location.pathname+location.search+location.hash)</script>")


def asset_version():
    """The site's cache-buster, as doc.css (the stylesheet these pages use) carries it."""
    found = re.search(r'\?v=([\w.-]+)', (SITE / 'doc.css').read_text(encoding='utf-8'))
    if not found:
        sys.exit('build-legal: could not find the asset version (?v=...) in doc.css')
    return found.group(1)


def page(slug_name, meta, title, intro, body, source_note):
    v = asset_version()
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
{REDIRECT}
<title>{meta['title']} · Offer Filter</title>
<meta name="description" content="{html.escape(meta['description'])}">
<link rel="canonical" href="{ORIGIN}/{slug_name}/">
<meta name="theme-color" content="#efe9db">
<link rel="icon" type="image/png" sizes="32x32" href="../assets/favicon-32.png?v={v}">
<link rel="icon" type="image/svg+xml" href="../assets/favicon.svg?v={v}">
<link rel="apple-touch-icon" sizes="180x180" href="../assets/apple-touch-icon.png?v={v}">
<link rel="preload" href="../assets/fonts/baloo2-latin.woff2?v={v}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="../doc.css?v={v}">
</head>
<body>
<!-- Generated by tools/build-legal.py from {source_note}. Edit the source and re-run; do not edit this file. -->
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
<a class="wordmark" href="../" aria-label="Offer Filter home"><img src="../assets/favicon.svg?v={v}" width="48" height="48" alt=""><span>Offer Filter</span></a>
<nav class="site-nav" aria-label="Site"><a href="../install/">Install</a><a href="../#help">Help</a><a href="../#feedback">Feedback</a></nav>
</header>
<main id="main" class="doc legal">
<p class="eyebrow">{meta['title']}</p>
<h1>{title}</h1>
{intro}
{body}
</main>
<footer class="site-footer">
<nav aria-label="Legal and source"><a href="../">Home</a><a href="../install/">Install</a><a href="../privacy/">Privacy</a><a href="../terms/">Terms</a><a href="../license/">License</a><a href="{SOURCE_CODE}">Source code (MIT)</a></nav>
<p class="independent">Offer Filter is independent and isn’t affiliated with DoorDash.</p>
<div class="signature"><picture><source type="image/webp" srcset="../assets/jesus-loves-you-signature.webp?v={v}"><img src="../assets/jesus-loves-you-signature.png?v={v}" width="432" height="341" loading="lazy" decoding="async" alt="Jesus Loves You. We love each other because He loves us first. 1 John 4:19."></picture></div>
</footer>
</body>
</html>
'''


def build(repo):
    pages = {}
    for name, meta in PAGES.items():
        source = repo / meta['file']
        if not source.is_file():
            sys.exit(f'build-legal: {source} not found; pass --app-repo or set OFFER_FILTER_APP_REPO')
        text = source.read_text(encoding='utf-8')
        note = f"dasher-offer-filter/{meta['file']} (sha256 {hashlib.sha256(text.encode()).hexdigest()[:16]})"
        if name == 'license':
            title, body = plain_text(text)
            intro = (f'<p class="legal-meta">Offer Filter is free and open-source software. Its source code is on '
                     f'GitHub: <a href="{SOURCE_CODE}">Dillxn/dasher-offer-filter</a>. The website\'s own code '
                     f'uses the same license; its fonts, film and emblem are covered separately (see its '
                     f'<a href="https://github.com/Dillxn/offer-filter-site/blob/main/THIRD_PARTY_NOTICES.md">'
                     f'third-party notices</a>).</p>')
            body = '<div class="license-text">\n' + body + '\n</div>'
        else:
            title, body = markdown(text)
            title = title or html.escape(meta['title'])
            intro = '<p class="legal-meta">Offer Filter shows this same text in the app.'
            if name == 'privacy':
                intro += ' The <a href="#this-website">last section</a> covers this website.'
                if 'id="this-website"' in body:  # the app text now covers the website itself; keep its words
                    print('note: PRIVACY.md has its own "This website" section; not appending WEBSITE_PRIVACY')
                else:
                    body += '\n<hr>\n' + markdown(WEBSITE_PRIVACY)[1]
                    note += ' plus the website section in tools/build-legal.py'
            intro += '</p>'
        pages[SITE / name / 'index.html'] = page(name, meta, title, intro, body, note)
    return pages


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('--app-repo', type=pathlib.Path, default=None, help='app repository checkout')
    parser.add_argument('--check', action='store_true', help='compare only; exit 1 when a page is out of date')
    args = parser.parse_args()
    repo = args.app_repo or pathlib.Path(os.environ.get('OFFER_FILTER_APP_REPO') or SITE.parent / 'dasher-offer-filter')
    stale = []
    for path, text in build(repo).items():
        current = path.read_text(encoding='utf-8') if path.is_file() else ''
        if current == text:
            print('current ' + str(path.relative_to(SITE)))
            continue
        stale.append(path)
        if not args.check:
            path.parent.mkdir(exist_ok=True)
            path.write_text(text, encoding='utf-8')
            print('wrote ' + str(path.relative_to(SITE)))
    if args.check and stale:
        print('out of date: ' + ', '.join(str(p.relative_to(SITE)) for p in stale))
        sys.exit(1)


if __name__ == '__main__':
    main()
