#!/usr/bin/env python3
"""Add the small charcoal Jesus Loves You signature to the original closing scene.

Operates only on the known, unsignatured 18.5-second clean-score exports, never
on its own output. The original mascot, app title, call to action and scenery
remain. Every original compressed audio packet is copied. Requires ffmpeg and
ffprobe. Earlier full-frame emblem exports are superseded by this recipe.
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
    'offer-filter-landscape.mp4': '287cc499c0f85b6b8a5c60814cdb8a0bd021ad0ca8b1768baf0476939abdc446',
    'offer-filter-portrait.mp4': 'e3d3ee5501c1947fce62b64e7a407588e4e88c8356242c1d1fd5607cbf00fa00',
    'offer-filter-square.mp4': '996156c19bd8aec1ad79040679ab49e0fb9ed90cbd7ffd850ad4120bac08352d',
    'offer-filter-portrait.webm': 'fdb5e35868e7b781190bc3514611a472a9a2cb04ceee7ec7ef53d3ef56e0fd5c',
}

# Format-specific clear space: wide sits below the CTA; tall/square sit beside
# the heading because their CTA is already on the hills. Values are (width,x,y).
SIGNATURE_LAYOUTS = {(1920,1080): (220,65,592), (1080,1920): (180,20,1090),
                     (1080,1080): (200,40,590)}
SIGNATURE_RGB = (52,58,64)  # #343A40, flat dark gray; no shadow or backing.

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
    if (width,height) not in SIGNATURE_LAYOUTS:
        raise ValueError(f'{name}: unreviewed end-card dimensions {width}x{height}')
    mark_width, mark_x, mark_y = SIGNATURE_LAYOUTS[(width,height)]
    red, green, blue = SIGNATURE_RGB
    # Preserve the original PNG alpha and full passage. No shadow layer.
    graph = (
        f'[1:v]scale={mark_width}:-1:flags=lanczos,format=rgba,'
        f'lutrgb=r={red}:g={green}:b={blue},'
        'fade=t=in:st=16.3:d=0.35:alpha=1[mark];'
        f'[0:v][mark]overlay=x={mark_x}:y={mark_y}:shortest=1:format=auto[out]'
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
         '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-frames:v', '555', str(after)])
    run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(after), '-f', 'null', '-'])
    before_audio, after_audio = packets(before, 'a:0'), packets(after, 'a:0')
    match = [(p['size'], p['data_hash']) for p in before_audio] == [(p['size'], p['data_hash']) for p in after_audio]
    assert match, f'{name}: original audio packets changed'
    metadata = probe(after)
    assert metadata['streams'][0]['nb_read_frames'] == '555', metadata
    assert metadata['streams'][0]['r_frame_rate'] == '30/1', metadata
    audio_timing = [(p['pts_time'],p.get('duration_time')) for p in before_audio] == [(p['pts_time'],p.get('duration_time')) for p in after_audio]
    assert audio_timing, f'{name}: audio presentation timing changed'
    return {'file': name, 'sourceSha256': digest(before), 'sha256': digest(after),
            'size': after.stat().st_size, 'signatureBox': {'width': mark_width, 'x': mark_x, 'y': mark_y},
            'audioPacketsUnchanged': match,
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
        'signatureBeginsSeconds': 16.3, 'signatureFullOpacitySeconds': 16.65,
        'contentDurationSeconds': 18.5, 'frames': 555, 'framesPerSecond': 30,
        'signatureWidthPixels': {'landscape': 220, 'portrait': 180, 'square': 200},
        'signatureColor': '#343A40', 'shadow': False,
        'signaturePlacement': 'Wide: x65/y592 below Android/tips copy, above hills. Portrait: x20/y1090; square: x40/y590 in clear sky beside the heading. Full passage retained without shadow or backing.',
        'audio': 'Every compressed packet and presentation time of the existing clean tonal score is unchanged.',
        'exports': results,
    }
    (output / 'film-charcoal-signature-validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
