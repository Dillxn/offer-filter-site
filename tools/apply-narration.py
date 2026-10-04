#!/usr/bin/env python3
"""Replace the score with the supplied narration without re-encoding video.

Use the revised closing-composition exports as input. The supplied MP3 remains
unchanged as a source asset. Its full 17.6-second decoded content is used at its
original speed and level; a verified speech-free tail can optionally fade out.
The remainder of the 18.5-second film is padded with silence. No old score mix.
"""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import subprocess

VIDEO_SHA256 = {
    'offer-filter-landscape.mp4': 'f7ff19db33d8fc42f33fa835a80020d165e95ac1a97e147159d80d714a7b6d28',
    'offer-filter-portrait.mp4': '1e199019bcebc25ae792523d5392181b5d6044e959b47b44620ed6e4cfba129d',
    'offer-filter-square.mp4': 'c8913f21dcc19a6230411542cb0c631ae91b6a48e6b20834c4b9384404282355',
    'offer-filter-portrait.webm': 'ee94dbf65a42a70d1f2552e64d7002b52a9f46f7460a1d905f582d808746cd18',
}
AUDIO_SHA256='b9faf89fb1a52ae1151a900c33ff1a1b828544964d00bf0e215501f47eca6dbc'
AUDIO_SECONDS=17.6
FILM_SECONDS=18.5

def run(args):return subprocess.run(args,check=True,capture_output=True,text=True).stdout

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def packets(path):return json.loads(run(['ffprobe','-v','error','-select_streams','v:0','-show_packets','-show_data_hash','sha256','-of','json',str(path)]))['packets']

def probe(path):return json.loads(run(['ffprobe','-v','error','-count_frames','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate,nb_read_frames,sample_rate,channels','-of','json',str(path)]))

def export(name,source,output,audio,fade_start):
    before,after=source/name,output/name
    assert digest(before)==VIDEO_SHA256[name],f'{name}: not the reviewed composition source'
    af='asetpts=PTS-STARTPTS'
    if fade_start is not None:af+=f',afade=t=out:st={fade_start}:d={AUDIO_SECONDS-fade_start}'
    af+=f',apad=whole_dur={FILM_SECONDS},atrim=duration={FILM_SECONDS}'
    webm=before.suffix=='.webm'
    run(['ffmpeg','-nostdin','-y','-v','error',*(['-copyts'] if webm else []),
         '-i',str(before),'-i',str(audio),'-map','0:v:0','-map','1:a:0',
         '-c:v','copy','-af',af,'-ar','48000','-ac','2',
         *(['-c:a','libopus','-b:a','160k','-avoid_negative_ts','disabled'] if webm else ['-c:a','aac','-b:a','192k','-movflags','+faststart']),
         '-map_metadata','-1',str(after)])
    run(['ffmpeg','-nostdin','-v','error','-i',str(after),'-f','null','-'])
    aa,ab=packets(before),packets(after)
    assert [(p['size'],p['data_hash']) for p in aa]==[(p['size'],p['data_hash']) for p in ab],f'{name}: video packets changed'
    assert [(p['pts_time'],p.get('dts_time'),p.get('duration_time')) for p in aa]==[(p['pts_time'],p.get('dts_time'),p.get('duration_time')) for p in ab],f'{name}: video timing changed'
    meta=probe(after)
    assert meta['streams'][0]['nb_read_frames']=='555',meta
    assert meta['streams'][0]['r_frame_rate']=='30/1',meta
    return {'file':name,'sourceSha256':digest(before),'sha256':digest(after),'size':after.stat().st_size,
            'videoPacketsUnchanged':True,'videoPresentationAndDecodeTimingUnchanged':True,
            'completeDecode':'pass',**meta}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--audio',type=Path,required=True)
    p.add_argument('--fade-start',type=float,help='Only after the final spoken syllable has been verified.')
    args=p.parse_args()
    source,output,audio=args.source.resolve(),args.output.resolve(),args.audio.resolve()
    if source==output:p.error('source and output must be separate')
    if digest(audio)!=AUDIO_SHA256:p.error('audio source is not the original user attachment')
    if args.fade_start is not None and not (16.5<=args.fade_start<AUDIO_SECONDS):p.error('fade start outside reviewed tail')
    output.mkdir(parents=True,exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        exports=list(pool.map(lambda name:export(name,source,output,audio,args.fade_start),VIDEO_SHA256))
    r={'scope':'Local narration integration; not a live publication receipt',
       'audioSource':audio.name,'audioSourceSha256':AUDIO_SHA256,'audioDecodedDurationSeconds':AUDIO_SECONDS,
       'audioSpeed':1,'audioGainDecibels':0,'audioTailFadeStartsSeconds':args.fade_start,
       'oldSoundtrackMixed':False,'filmDurationSeconds':FILM_SECONDS,'silencePaddingSeconds':.9,
       'videoReencoded':False,'exports':exports}
    (output/'film-narration-20261004.json').write_text(json.dumps(r,indent=2)+'\n')
    print(json.dumps(r,indent=2))

if __name__=='__main__':main()
