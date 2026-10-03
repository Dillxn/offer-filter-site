#!/usr/bin/env python3
"""Apply the shared Jesus Loves You emblem to the film's final four seconds.

Operates only on the known, previously signed 18.5-second exports, never on
its own output. The first sixteen seconds keep their edit and all original
compressed audio packets are copied. The final 1.5 seconds are intentionally
quiet after the existing score resolves. Requires ffmpeg and ffprobe.
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess

NAMES = ('offer-filter-landscape.mp4', 'offer-filter-portrait.mp4',
         'offer-filter-square.mp4', 'offer-filter-portrait.webm')
SOURCE_SHA256 = {
    'offer-filter-landscape.mp4': '99001b06f9811b5c8d5433f3159d518b197a795c9f6c728c60c7b89edad5796d',
    'offer-filter-portrait.mp4': 'c71f0720afabd36a756c55127716366c514f56966a448dec2580fa064bc13120',
    'offer-filter-square.mp4': '331c38b36471ac975ac1e8edf9e7cb895a233cb182e18e88469836f62b8b30ac',
    'offer-filter-portrait.webm': '1a8b105cbe00afad688e8c82c2b473d814cfdd9a84272b7f017f852ccdf7a6f4',
}


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def probe(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-count_frames',
        '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate,nb_read_frames',
        '-of', 'json', str(path)]))


def packets(path, stream):
    return json.loads(run(['ffprobe', '-v', 'error', '-select_streams', stream,
        '-show_packets', '-show_data_hash', 'sha256', '-of', 'json', str(path)]))['packets']


def export(name, source, output, emblem):
    before, after = source / name, output / name
    if digest(before) != SOURCE_SHA256[name]:
        raise ValueError(f'{name}: refusing stale or already-overlaid input')
    original = probe(before)
    width, height = original['streams'][0]['width'], original['streams'][0]['height']
    mark_width = round(min(width * .88, height * .74 * 1412 / 1114))
    top = '(H-h)/2'
    # A full-frame closing card avoids shrinking the passage into a logo strip.
    # The same transparent PNG is used by the website and Android Settings.
    graph = (
        f'color=c=0x111721:s={width}x{height}:r=30:d=20.1,format=rgba,'
        f"drawtext=fontfile={source / 'AtkinsonHyperlegible-Regular.ttf'}:"
        "text='Offer Filter':fontsize=32:fontcolor=0xb7c4c4:"
        "x=(w-text_w)/2:y=54,"
        f"drawtext=fontfile={source / 'AtkinsonHyperlegible-Regular.ttf'}:"
        "text='Independent app. Not affiliated with DoorDash.':"
        "fontsize=23:fontcolor=0xb7c4c4:x=(w-text_w)/2:y=h-66[paper];"
        f'[1:v]scale={mark_width}:-1:flags=lanczos,format=rgba[mark];'
        f'[paper][mark]overlay=x=(W-w)/2:y={top}:shortest=1,'
        'fade=t=in:st=16:d=0.35:alpha=1[card];'
        '[0:v]tpad=stop_mode=clone:stop_duration=1.5[base];'
        '[base][card]overlay=shortest=1:format=auto[out]'
    )
    webm = before.suffix == '.webm'
    codec = (['-c:v', 'libvpx-vp9', '-crf', '28', '-b:v', '0', '-row-mt', '1',
              '-deadline', 'good', '-cpu-used', '2', '-fps_mode', 'passthrough',
              '-enc_time_base', '1:1000', '-avoid_negative_ts', 'disabled'] if webm else
             ['-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart'])
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error',
         *(['-copyts'] if webm else []), '-i', str(before),
         '-loop', '1', '-framerate', '30', '-i', str(emblem),
         '-filter_complex_threads', '1', '-filter_complex', graph,
         '-map', '[out]', '-map', '0:a:0', *codec, '-threads', '2',
         '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-frames:v', '600', str(after)])
    run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(after), '-f', 'null', '-'])
    before_audio, after_audio = packets(before, 'a:0'), packets(after, 'a:0')
    match = [(p['size'], p['data_hash']) for p in before_audio] == [(p['size'], p['data_hash']) for p in after_audio]
    assert match, f'{name}: original audio packets changed'
    metadata = probe(after)
    assert metadata['streams'][0]['nb_read_frames'] == '600', metadata
    assert metadata['streams'][0]['r_frame_rate'] == '30/1', metadata
    audio_timing = [(p['pts_time'],p.get('duration_time')) for p in before_audio] == [(p['pts_time'],p.get('duration_time')) for p in after_audio]
    assert audio_timing, f'{name}: audio presentation timing changed'
    return {'file': name, 'sourceSha256': digest(before), 'sha256': digest(after),
            'size': after.stat().st_size, 'audioPacketsUnchanged': match,
            'audioPresentationTimingUnchanged': audio_timing,
            'completeDecode': 'pass', **metadata}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--emblem', type=Path, required=True)
    args = parser.parse_args()
    source, output, emblem = args.source.resolve(), args.output.resolve(), args.emblem.resolve()
    if source == output:
        parser.error('source and output must be different directories')
    output.mkdir(parents=True, exist_ok=True)
    if not emblem.is_file():
        parser.error('emblem file does not exist')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda name: export(name, source, output, emblem), NAMES))
    report = {
        'emblem': emblem.name, 'emblemSha256': digest(emblem),
        'exactText': ['JESUS', 'LOVES', 'YOU', 'WE LOVE EACH OTHER',
                      'BECAUSE HE LOVES US FIRST.', '1 JOHN 4:19'],
        'closingCardBeginsSeconds': 16, 'closingCardFullOpacitySeconds': 16.35,
        'contentDurationSeconds': 20, 'frames': 600, 'framesPerSecond': 30,
        'audio': 'Every compressed packet and presentation time of the existing clean tonal score is unchanged. Final 1.5 seconds are intentionally quiet.',
        'exports': results,
    }
    (output / 'film-emblem-validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
