#!/usr/bin/env python3
"""Apply the separately rendered closing scene to the guarded original films.

The first sixteen seconds retain the original edit, subject to video encoding.
Every original compressed audio packet and its presentation time is preserved.
Run render-closing-scene.cjs first; all work is local, with no external builds.
"""
import argparse
import concurrent.futures
import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location('original', Path(__file__).with_name('sign-emblem-film.py'))
original = importlib.util.module_from_spec(spec)
spec.loader.exec_module(original)
run, digest, probe, packets = original.run, original.digest, original.probe, original.packets

def export(name, source, output, ending):
    before, after = source / name, output / name
    assert digest(before) == original.SOURCE_SHA256[name], f'{name}: not the guarded original'
    variant = name.removeprefix('offer-filter-').split('.')[0]
    closing = ending / (variant + '.mov')
    assert closing.is_file(), closing
    graph = ('[1:v]format=rgba,fade=t=in:st=0:d=0.3:alpha=1,'
             'setpts=PTS+16/TB[closing];'
             '[0:v][closing]overlay=x=0:y=0:eof_action=pass:format=auto[out]')
    webm = before.suffix == '.webm'
    codec = (['-c:v','libvpx-vp9','-crf','28','-b:v','0','-row-mt','1',
              '-deadline','good','-cpu-used','2','-fps_mode','passthrough',
              '-enc_time_base','1:1000','-avoid_negative_ts','disabled'] if webm else
             ['-c:v','libx264','-crf','18','-preset','medium','-movflags','+faststart'])
    run(['ffmpeg','-nostdin','-y','-v','error', *(['-copyts'] if webm else []),
         '-i',str(before),'-i',str(closing),'-filter_complex_threads','1',
         '-filter_complex',graph,'-map','[out]','-map','0:a:0',*codec,
         '-threads','2','-pix_fmt','yuv420p','-c:a','copy','-frames:v','555',str(after)])
    run(['ffmpeg','-nostdin','-v','error','-i',str(after),'-f','null','-'])
    aa, ab = packets(before,'a:0'), packets(after,'a:0')
    assert [(p['size'],p['data_hash']) for p in aa] == [(p['size'],p['data_hash']) for p in ab], f'{name}: changed audio'
    assert [(p['pts_time'],p.get('duration_time')) for p in aa] == [(p['pts_time'],p.get('duration_time')) for p in ab], f'{name}: changed audio timing'
    meta=probe(after)
    assert meta['streams'][0]['nb_read_frames']=='555',meta
    assert meta['streams'][0]['r_frame_rate']=='30/1',meta
    return {'file':name,'sourceSha256':digest(before),'sha256':digest(after),'size':after.stat().st_size,
            'audioPacketsUnchanged':True,'audioPresentationTimingUnchanged':True,'completeDecode':'pass',**meta}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--ending',type=Path,required=True)
    args=p.parse_args()
    source,output,ending=args.source.resolve(),args.output.resolve(),args.ending.resolve()
    if source==output:p.error('source and output must differ')
    output.mkdir(parents=True,exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda name:export(name,source,output,ending),original.NAMES))
    for name,variant in [('film-poster-wide.jpg','landscape'),('film-poster.jpg','portrait')]:
        run(['ffmpeg','-nostdin','-y','-v','error','-ss','17.5','-i',str(output/('offer-filter-'+variant+'.mp4')),'-frames:v','1','-q:v','2',str(output/name)])
    report={'scope':'Locally rendered closing-scene composition; no publication or physical-device claim.',
            'originalEditRetainedBeforeSeconds':16,'closingSceneFullOpacitySeconds':16.3,
            'contentDurationSeconds':18.5,'frames':555,'framesPerSecond':30,
            'signatureColor':'#343A40','signatureShadow':False,'emblemMasterUnchanged':True,
            'audio':'Every compressed packet and presentation time remains unchanged.',
            'layouts':json.loads((ending/'closing-scene-layouts.json').read_text()),'exports':results}
    (output/'film-composition-20261004.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
