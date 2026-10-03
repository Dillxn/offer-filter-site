#!/usr/bin/env python3
"""Add the requested closing signature to existing Offer Filter exports locally.

Inputs remain unmodified. Encodes video only and copies each original audio
stream, preserving the clean tonal score. Requires ffmpeg and bundled Baloo 2.
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess

NAMES = ('offer-filter-landscape.mp4', 'offer-filter-portrait.mp4',
         'offer-filter-square.mp4', 'offer-filter-portrait.webm')

SOURCE_SHA256 = {'offer-filter-landscape.mp4': '287cc499c0f85b6b8a5c60814cdb8a0bd021ad0ca8b1768baf0476939abdc446', 'offer-filter-portrait.mp4': 'e3d3ee5501c1947fce62b64e7a407588e4e88c8356242c1d1fd5607cbf00fa00', 'offer-filter-square.mp4': '996156c19bd8aec1ad79040679ab49e0fb9ed90cbd7ffd850ad4120bac08352d', 'offer-filter-portrait.webm': 'fdb5e35868e7b781190bc3514611a472a9a2cb04ceee7ec7ef53d3ef56e0fd5c'}

def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def audio_packets(path):
    data = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'a:0',
        '-show_packets', '-show_data_hash', 'sha256', '-of', 'json', str(path)]))
    return [(p['size'], p['data_hash']) for p in data['packets']]

def packet_timing(path, stream):
    data = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', stream,
        '-show_packets', '-show_entries', 'packet=pts_time,duration_time',
        '-of', 'json', str(path)]))
    return sorted((p['pts_time'], p['duration_time']) for p in data['packets'])

def info(path):
    return json.loads(run(['ffprobe', '-v', 'error', '-count_frames',
        '-show_entries', 'format=duration:stream=codec_name,width,height,r_frame_rate,nb_read_frames',
        '-of', 'json', str(path)]))

def export(name, source, output, font):
    before = source / name
    after = output / name
    if digest(before) != SOURCE_SHA256[name]:
        raise ValueError(f'{name}: expected the unsignatured source export; refusing a duplicate or stale overlay')
    # All exports have 1080px as their minimum dimension. Leave a 17px bottom
    # inset; the signature is the final line beneath the affiliation notice.
    overlay = (f"drawtext=fontfile={font}:text='Jesus Loves You':"
        "fontsize=34:fontcolor=0x12203a:x=(w-text_w)/2:y=h-42:"
        "alpha='if(lt(t,16.3),0,min((t-16.3)/0.4,1))'")
    codec = (['-c:v', 'libvpx-vp9', '-crf', '28', '-b:v', '0', '-row-mt', '1',
               '-deadline', 'good', '-cpu-used', '2', '-fps_mode', 'passthrough',
               '-enc_time_base', '1:1000', '-avoid_negative_ts', 'disabled'] if before.suffix == '.webm'
             else ['-c:v', 'libx264', '-crf', '18', '-preset', 'medium',
                   '-movflags', '+faststart'])
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error',
        *(['-copyts'] if before.suffix == '.webm' else []), '-i', str(before),
        '-map', '0:v:0', '-map', '0:a:0', '-vf', overlay, *codec,
        '-threads', '2', '-pix_fmt', 'yuv420p', '-c:a', 'copy', str(after)])
    run(['ffmpeg', '-nostdin', '-v', 'error', '-i', str(after), '-f', 'null', '-'])
    packets_match = audio_packets(before) == audio_packets(after)
    assert packets_match, f'{name}: audio packets changed'
    metadata = info(after)
    assert metadata['streams'][0]['nb_read_frames'] == '555', metadata
    timing_match = all(packet_timing(before, stream) == packet_timing(after, stream) for stream in ('v:0', 'a:0'))
    assert timing_match, f'{name}: stream presentation timing changed'
    return {'file': name, 'sourceSha256': digest(before), 'sha256': digest(after),
            'size': after.stat().st_size, 'audioPacketsUnchanged': packets_match,
            'streamPresentationTimingUnchanged': timing_match,
            'completeDecode': 'pass', **metadata}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    if source == output:
        parser.error('source and output must be different directories')
    output.mkdir(parents=True, exist_ok=True)
    font = source / 'Baloo2.ttf'
    assert font.is_file(), font
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda name: export(name, source, output, font), NAMES))
    report = {'signature': 'Jesus Loves You', 'appearsAtSeconds': 16.3,
        'fullOpacityAtSeconds': 16.7, 'lastFrameSeconds': 18.466667,
        'font': 'Baloo 2', 'fontSizePixels': 34,
        'audio': 'Original clean tonal score; every compressed audio packet unchanged.',
        'exports': results}
    (output / 'film-signature-validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
