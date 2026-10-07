#!/bin/sh
# Derive the shipped fonts from the bundled OFL sources (no Reserved Font Names, so subsets keep their names).
# Web: Latin subsets as WOFF2; Baloo 2 keeps its 400-800 weight axis.
# Renderer: a static Baloo 2 Bold, because Skia draws a variable font at its default weight.
# Requires fontTools with brotli: pip install fonttools brotli
set -eu
cd "$(dirname "$0")/.."
LATIN="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+FEFF,U+FFFD"
pyftsubset assets/Baloo2.ttf --unicodes="$LATIN" --layout-features='*' --flavor=woff2 --output-file=assets/baloo2-latin.woff2
pyftsubset assets/AtkinsonHyperlegible-Regular.ttf --unicodes="$LATIN" --layout-features='*' --flavor=woff2 --output-file=assets/atkinson-hyperlegible-latin.woff2
tmp=$(mktemp -d)
fonttools varLib.instancer assets/Baloo2.ttf wght=700 --static -o "$tmp/Baloo2-700.ttf"
pyftsubset "$tmp/Baloo2-700.ttf" --unicodes="$LATIN" --layout-features='*' --output-file=assets/baloo2-bold-latin.ttf
rm -r "$tmp"
