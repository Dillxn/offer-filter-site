#!/usr/bin/env python3
"""Builds the small files the website loads from the unchanged masters in assets/.

    python3 tools/build-web-assets.py            # everything
    python3 tools/build-web-assets.py fonts      # or any of: fonts signature posters

Needs Pillow, fonttools and brotli (pip install Pillow fonttools brotli). Nothing here changes a master: the film
tools keep drawing with the TTF fonts and the emblem PNG, and the JPEG posters stay (the wide one is the social
share image).

fonts      assets/fonts/baloo2-latin.woff2 (Baloo 2, weights 600-700) and assets/fonts/atkinson-latin.woff2,
           Latin subsets. Both fonts are SIL OFL 1.1 with no Reserved Font Name; every name record, including the
           copyright and license, is kept. Licenses: assets/OFL-*.txt.
signature  assets/jesus-loves-you-signature.webp and .png: the emblem master's own alpha at 432 px wide (3x the
           144 px it is shown at) in the forest-green ink #36594b the page used to apply with a CSS mask. One small
           image replaces two downloads of the 818 KB master. Night mode turns it white with a CSS filter.
posters    assets/film-poster-wide.webp and assets/film-poster-square.webp from the JPEG posters, so a phone loads
           one ~40 KB poster instead of two JPEGs (~300 KB).

assets/favicon.svg is minified separately with svgo (npx svgo --precision 1 --multipass assets/favicon.svg) after
tools/render-favicon.cjs writes it.
"""
import io
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'

# Google Fonts' "latin" range, plus the arrows and symbols the pages use where a font has them.
LATIN = [
    (0x0000, 0x00FF), (0x0131, 0x0131), (0x0152, 0x0153), (0x02BB, 0x02BC), (0x02C6, 0x02C6), (0x02DA, 0x02DA),
    (0x02DC, 0x02DC), (0x0304, 0x0304), (0x0308, 0x0308), (0x0329, 0x0329), (0x2000, 0x206F), (0x20AC, 0x20AC),
    (0x2122, 0x2122), (0x2190, 0x2193), (0x2212, 0x2212), (0x2215, 0x2215), (0x25B6, 0x25B6), (0xFEFF, 0xFEFF),
    (0xFFFD, 0xFFFD),
]
INK = (0x36, 0x59, 0x4B)
SIGNATURE_WIDTH = 432
ALPHA_LEVELS = 64  # smooth antialiasing with a small palette
POSTER_QUALITY = 84


def report(path, source=None):
    note = f' from {source.name} ({source.stat().st_size:,})' if source else ''
    print(f'{path.relative_to(ROOT)}: {path.stat().st_size:,} bytes{note}')


def fonts():
    from fontTools import subset
    from fontTools.ttLib import TTFont
    from fontTools.varLib import instancer

    def options():
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['*']  # kerning, ligatures and contextual forms
        opts.name_IDs = ['*']         # copyright, license and every other name record
        opts.name_languages = ['*']
        opts.notdef_outline = True
        opts.hinting = False          # most of the weight; not needed by today's browsers
        opts.desubroutinize = True
        return opts

    def build(source, target, limit=None):
        font = TTFont(ASSETS / source, lazy=False)
        if limit:
            # Limit the weight axis, then reload so the subsetter sees fully built tables.
            buffer = io.BytesIO()
            instancer.instantiateVariableFont(font, limit).save(buffer)
            font = TTFont(io.BytesIO(buffer.getvalue()), lazy=False)
        cmap = font.getBestCmap()
        subsetter = subset.Subsetter(options())
        subsetter.populate(unicodes=[cp for start, end in LATIN for cp in range(start, end + 1) if cp in cmap])
        subsetter.subset(font)
        (ASSETS / 'fonts').mkdir(exist_ok=True)
        font.flavor = 'woff2'
        font.save(ASSETS / 'fonts' / target)
        report(ASSETS / 'fonts' / target, ASSETS / source)

    build('Baloo2.ttf', 'baloo2-latin.woff2', {'wght': (600, 700)})
    build('AtkinsonHyperlegible-Regular.ttf', 'atkinson-latin.woff2')


def signature():
    from PIL import Image

    master = ASSETS / 'jesus-loves-you-emblem.png'
    alpha = Image.open(master).convert('RGBA').getchannel('A')
    height = round(alpha.height * SIGNATURE_WIDTH / alpha.width)
    step = ALPHA_LEVELS - 1
    alpha = alpha.resize((SIGNATURE_WIDTH, height), Image.LANCZOS).point(
        lambda v: round(round(v * step / 255) * 255 / step))
    image = Image.new('RGBA', (SIGNATURE_WIDTH, height), INK + (0,))
    image.putalpha(alpha)
    palette = image.quantize(colors=ALPHA_LEVELS, method=Image.Quantize.FASTOCTREE)
    png = ASSETS / 'jesus-loves-you-signature.png'
    palette.save(png, 'PNG', optimize=True)
    webp = ASSETS / 'jesus-loves-you-signature.webp'
    palette.convert('RGBA').save(webp, 'WEBP', lossless=True, quality=100, method=6)
    report(webp, master)
    report(png, master)


def posters():
    from PIL import Image

    for name in ('film-poster-wide', 'film-poster-square'):
        source = ASSETS / f'{name}.jpg'
        target = ASSETS / f'{name}.webp'
        Image.open(source).convert('RGB').save(target, 'WEBP', quality=POSTER_QUALITY, method=6)
        report(target, source)


STEPS = {'fonts': fonts, 'signature': signature, 'posters': posters}

if __name__ == '__main__':
    for step in sys.argv[1:] or STEPS:
        if step not in STEPS:
            sys.exit(f'unknown step {step!r}; choose from {", ".join(STEPS)}')
        STEPS[step]()
