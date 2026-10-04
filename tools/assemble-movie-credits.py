#!/usr/bin/env python3
"""Locally render the 24-second film with movie credits and complete supplied voice.

Read source films from the reviewed 7375a83 website release. Keep the first 16s
edit, fading its final 0.35s to black, then append the separately rendered 8s credit
sequence. Video is re-encoded; it is not claimed byte-identical. Every spoken word
from the original uploaded MP3 remains at its original speed and level. Only its
speech-free instrumental outro repeats, with sample-counted equal-power joins.
"""
import argparse, concurrent.futures, hashlib, json, math, subprocess
from array import array
from pathlib import Path
SOURCE={
'offer-filter-landscape.mp4':'98676283cfc8794210dedf640d014c570f02f3d5da422141afa7dc74a2a82f83',
'offer-filter-portrait.mp4':'33c51bc1ec8c27537911046519c14cec4b73d8b97f6b62dabe780d9634555a5d',
'offer-filter-square.mp4':'abdf126185797ada2bf018c122f1a1aa3ed1aeac2a4487c6c052a551e7447b39',
'offer-filter-portrait.webm':'1b505a06494776dc732553afbd5d31ab0522d08b5bc9d12d0a5ee331f11fa0ba'}
AUDIO_SHA='b9faf89fb1a52ae1151a900c33ff1a1b828544964d00bf0e215501f47eca6dbc'
FPS=30;DURATION=24

def run(args):return subprocess.run(args,check=True,capture_output=True,text=True).stdout

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def probe(p):return json.loads(run(['ffprobe','-v','error','-count_frames','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate,nb_read_frames,sample_rate,channels','-of','json',str(p)]))

def soundtrack(source,output):
 assert sha(source)==AUDIO_SHA
 rate=48000;channels=2
 pcm=array('f',subprocess.check_output(['ffmpeg','-nostdin','-v','error','-i',str(source),'-f','f32le','-ar',str(rate),'-ac',str(channels),'-']))
 def clip(a,b):return pcm[round(a*rate)*channels:round(b*rate)*channels]
 def join(a,b,seconds):
  n=round(seconds*rate);count=n*channels;r=a[:-count]
  for i in range(n):
   t=i/(n-1)*math.pi/2;c,s=math.cos(t),math.sin(t)
   for ch in range(channels):r.append(a[len(a)-count+i*channels+ch]*c+b[i*channels+ch]*s)
  r.extend(b[count:]);return r
 tail=clip(16.08,17.60);bed=tail
 for i in range(3):bed=join(bed,tail,.20)
 final=join(clip(0,17.60),bed,.15)
 assert len(final)==round(22.93*rate)*channels
 start,end=round(22.13*rate),round(22.93*rate)
 for i in range(start,end):
  g=1-(i-start)/(end-start-1)
  for ch in range(channels):final[i*channels+ch]*=g
 final.extend(array('f',[0])*(DURATION*rate*channels-len(final)))
 subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-f','f32le','-ar',str(rate),'-ac',str(channels),'-i','pipe:0','-c:a','pcm_s24le',str(output)],input=final.tobytes(),check=True,capture_output=True)
 return {'sourceSha256':AUDIO_SHA,'editedWavSha256':sha(output),'allSpokenWordsRetained':True,'finalLine':'Free and open source.','sourcePcmUnchangedThroughSeconds':17.45,'voiceSpeed':1,'voiceGainDb':0,'instrumentalSourceRange':[16.08,17.60],'instrumentalRepetitions':4,'loopCrossfadeSeconds':.20,'leadTailCrossfadeSeconds':.15,'fadeOutRange':[22.13,22.93],'quietTailSeconds':1.07}

def export(name,source,ending,out,audio):
 before=source/name;after=out/name;assert sha(before)==SOURCE[name]
 variant=name.removeprefix('offer-filter-').split('.')[0]
 graph='[0:v]trim=start=0:end=16,setpts=PTS-STARTPTS,fade=t=out:st=15.65:d=0.35[first];[1:v]setpts=PTS-STARTPTS[credits];[first][credits]concat=n=2:v=1:a=0,format=yuv420p[out]'
 webm=before.suffix=='.webm'
 codec=['-c:v','libvpx-vp9','-crf','28','-b:v','0','-row-mt','1','-deadline','good','-cpu-used','3','-c:a','libopus','-b:a','160k']if webm else['-c:v','libx264','-crf','18','-preset','medium','-c:a','aac','-b:a','192k','-movflags','+faststart']
 run(['ffmpeg','-nostdin','-y','-v','error','-i',str(before),'-i',str(ending/(variant+'.mov')),'-i',str(audio),'-filter_complex_threads','1','-filter_complex',graph,'-map','[out]','-map','2:a:0',*codec,'-threads','2','-pix_fmt','yuv420p','-r','30','-frames:v','720','-t','24','-map_metadata','-1',str(after)])
 run(['ffmpeg','-nostdin','-v','error','-i',str(after),'-f','null','-'])
 p=probe(after);assert p['streams'][0]['nb_read_frames']=='720',p
 assert p['streams'][0]['r_frame_rate']=='30/1',p
 return {'file':name,'sourceSha256':sha(before),'sha256':sha(after),'bytes':after.stat().st_size,'completeDecode':'pass',**p}

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--source',type=Path,required=True);p.add_argument('--ending',type=Path,required=True);p.add_argument('--audio',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 source,ending,audio,out=a.source.resolve(),a.ending.resolve(),a.audio.resolve(),a.output.resolve();assert source!=out;out.mkdir(parents=True,exist_ok=True)
 wav=out/'your-time-matters-complete-credits.wav';sound=soundtrack(audio,wav)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:exports=list(pool.map(lambda n:export(n,source,ending,out,wav),SOURCE))
 for filename,variant in [('film-poster-wide.jpg','landscape'),('film-poster.jpg','portrait')]:run(['ffmpeg','-nostdin','-y','-v','error','-ss','22','-i',str(out/('offer-filter-'+variant+'.mp4')),'-frames:v','1','-q:v','2',str(out/filename)])
 record={'scope':'Local movie-credit ending candidate; not live publication evidence','baseCommit':'7375a837f75ea50afb7c3c293227b04cde627036','durationSeconds':DURATION,'frames':720,'fps':FPS,'originalEditRetainedThroughSeconds':15.65,'fadeToBlack':[15.65,16.0],'credits':[16,24],'soundtrack':sound,'layout':json.loads((ending/'movie-credits-layouts.json').read_text()),'exports':exports}
 (out/'film-movie-credits-20261004.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record,indent=2))
if __name__=='__main__':main()
