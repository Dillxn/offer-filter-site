#!/usr/bin/env python3
"""Locally integrate supplied narration, retaining a clean final 'Free.'

The uploaded source is unchanged. Trim the phrase after the completed word Free,
then join only speech-free music from the same recording. Repeat the 1.52-second
instrumental tail once with an equal-power crossfade, fade out, and pad the film's
quiet ending. No voice synthesis, time stretch, pitch shift or license change.
All compressed video packets and their presentation/decode times stay unchanged.
"""
import argparse, concurrent.futures, hashlib, json, math, subprocess
from array import array
from pathlib import Path

SOURCE_VIDEOS={
 'offer-filter-landscape.mp4':'f7ff19db33d8fc42f33fa835a80020d165e95ac1a97e147159d80d714a7b6d28',
 'offer-filter-portrait.mp4':'1e199019bcebc25ae792523d5392181b5d6044e959b47b44620ed6e4cfba129d',
 'offer-filter-square.mp4':'c8913f21dcc19a6230411542cb0c631ae91b6a48e6b20834c4b9384404282355',
 'offer-filter-portrait.webm':'ee94dbf65a42a70d1f2552e64d7002b52a9f46f7460a1d905f582d808746cd18',
}
SOURCE_AUDIO='b9faf89fb1a52ae1151a900c33ff1a1b828544964d00bf0e215501f47eca6dbc'
DURATION=18.5

def run(args):return subprocess.run(args,check=True,capture_output=True,text=True).stdout

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def probe(path):return json.loads(run(['ffprobe','-v','error','-count_frames','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate,nb_read_frames,sample_rate,channels','-of','json',str(path)]))

def packets(path):
 p=json.loads(run(['ffprobe','-v','error','-select_streams','v:0','-show_packets','-show_data_hash','sha256','-of','json',str(path)]))['packets']
 return [(v['size'],v['data_hash'],v['pts_time'],v.get('dts_time'),v.get('duration_time')) for v in p]

def render_audio(source,output):
 assert sha(source)==SOURCE_AUDIO,'audio is not the unchanged supplied recording'
 # Assemble at sample precision rather than relying on short split-stream EOF
 # behavior in FFmpeg's acrossfade filter. Use its decoder/encoder only.
 rate,channels=48000,2
 pcm=array('f',subprocess.check_output(['ffmpeg','-nostdin','-v','error','-i',str(source),'-f','f32le','-ar',str(rate),'-ac',str(channels),'-']))
 def clip(start,end):return pcm[round(start*rate)*channels:round(end*rate)*channels]
 def join(left,right,seconds):
  frames=round(seconds*rate);count=frames*channels
  result=left[:-count]
  for i in range(frames):
   theta=(i/(frames-1))*math.pi/2
   c,s=math.cos(theta),math.sin(theta)
   for ch in range(channels):result.append(left[len(left)-count+i*channels+ch]*c+right[i*channels+ch]*s)
  result.extend(right[count:]);return result
 tail=clip(16.08,17.60)
 edited=join(clip(0,14.72),join(tail,tail,.20),.12)
 assert len(edited)==round(17.44*rate)*channels
 start,end=round(16.84*rate),round(17.44*rate)
 for i in range(start,end):
  gain=1-(i-start)/(end-start-1)
  for ch in range(channels):edited[i*channels+ch]*=gain
 edited.extend(array('f',[0])*(round(DURATION*rate)*channels-len(edited)))
 assert len(edited)==round(DURATION*rate)*channels
 subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-f','f32le','-ar',str(rate),'-ac',str(channels),'-i','pipe:0','-c:a','pcm_s24le',str(output)],input=edited.tobytes(),check=True,capture_output=True)

def export(name,source,output,audio):
 before,after=source/name,output/name
 assert sha(before)==SOURCE_VIDEOS[name],f'{name}: not the reviewed live visual source'
 webm=before.suffix=='.webm'
 run(['ffmpeg','-nostdin','-y','-v','error',*(['-copyts']if webm else[]),'-i',str(before),'-i',str(audio),'-map','0:v:0','-map','1:a:0','-c:v','copy','-ar','48000','-ac','2',*(['-c:a','libopus','-b:a','160k','-avoid_negative_ts','disabled']if webm else['-c:a','aac','-b:a','192k','-movflags','+faststart']),'-map_metadata','-1',str(after)])
 run(['ffmpeg','-nostdin','-v','error','-i',str(after),'-f','null','-'])
 assert packets(before)==packets(after),f'{name}: compressed video or timing changed'
 meta=probe(after)
 assert meta['streams'][0]['nb_read_frames']=='555',meta
 assert meta['streams'][0]['r_frame_rate']=='30/1',meta
 return {'file':name,'sourceSha256':sha(before),'sha256':sha(after),'bytes':after.stat().st_size,'videoPacketsAndTimingUnchanged':True,'fullDecode':'pass',**meta}

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--source',type=Path,required=True)
 p.add_argument('--audio',type=Path,required=True)
 p.add_argument('--output',type=Path,required=True)
 a=p.parse_args()
 source,audio,output=a.source.resolve(),a.audio.resolve(),a.output.resolve()
 if source==output:p.error('source and output must differ')
 output.mkdir(parents=True,exist_ok=True)
 edited=output/'your-time-matters-free.wav'
 render_audio(audio,edited)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:
  exports=list(pool.map(lambda n:export(n,source,output,edited),SOURCE_VIDEOS))
 receipt={'scope':'Local completed narration candidate; not publication evidence','baseCommit':'ccae35d09a13790ee9b232af9fb1176b6734402a','sourceAudioSha256':SOURCE_AUDIO,'editedAudioSha256':sha(edited),'finalSpokenLine':'Free.','originalAudioRetainedThroughSeconds':14.60,'leadCutSeconds':14.72,'instrumentalSourceRangeSeconds':[16.08,17.60],'instrumentalRepetitions':2,'instrumentalLoopCrossfadeSeconds':.20,'leadTailCrossfadeSeconds':.12,'crossfadeCurve':'equal power quarter sine','fadeOutRangeSeconds':[16.84,17.44],'quietTailSeconds':1.06,'durationSeconds':DURATION,'voiceSpeed':1,'voiceGainDb':0,'originalScoreMixed':False,'licenseChanged':False,'exports':exports}
 (output/'film-narration-free-20261004.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps(receipt,indent=2))
if __name__=='__main__':main()
