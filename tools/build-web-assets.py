#!/usr/bin/env python3
"""Builds the reading pages' small signature image from the unchanged emblem master in assets/.

    python3 tools/build-web-assets.py            # everything
    python3 tools/build-web-assets.py signature  # or a named step

Needs Pillow (pip install Pillow). Nothing here changes a master: the film tools keep drawing with the emblem PNG.

signature  assets/jesus-loves-you-signature.webp and .png, for the install guide, the legal pages and the 404 page:
           the emblem master's own alpha at 432 px wide (3x the 144 px it is shown at) in the forest-green ink #36594b,
           pre-tinted, so those pages need no CSS mask. Night mode turns it white with a CSS filter. (The home page's
           footer and the film use assets/jesus-loves-you-emblem-560.png, which they tint themselves.)

The other web files come from the tools that draw them: the Latin WOFF2 fonts from tools/make-fonts.sh; the posters
(JPEG, AVIF and WebP, the film's closing frame) from `node tools/render-film.cjs posters`; the logo, touch icon and
favicons from tools/render-icons.cjs (the 3D mascot).
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'

INK = (0x36, 0x59, 0x4B)
SIGNATURE_WIDTH = 432
ALPHA_LEVELS = 64  # smooth antialiasing with a small palette


def report(path, source=None):
    note = f' from {source.name} ({source.stat().st_size:,})' if source else ''
    print(f'{path.relative_to(ROOT)}: {path.stat().st_size:,} bytes{note}')


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


STEPS = {'signature': signature}

if __name__ == '__main__':
    for step in sys.argv[1:] or STEPS:
        if step not in STEPS:
            sys.exit(f'unknown step {step!r}; choose from {", ".join(STEPS)}')
        STEPS[step]()
