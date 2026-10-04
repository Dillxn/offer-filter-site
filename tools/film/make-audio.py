#!/usr/bin/env python3
"""Keep the supplied voice at its original speed and level; extend only music."""
from array import array
from pathlib import Path
import hashlib, json, math, subprocess, sys
root=Path(__file__).resolve().parents[2]
source=root/'assets/your-time-matters.mp3'
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
source_sha=hashlib.sha256(source.read_bytes()).hexdigest()
assert source_sha=='b9faf89fb1a52ae1151a900c33ff1a1b828544964d00bf0e215501f47eca6dbc'
rate,channels=48000,2
pcm=array('f',subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-f','f32le','-ar',str(rate),'-ac','2','-']))
def clip(a,b):return pcm[round(a*rate)*channels:round(b*rate)*channels]
def join(a,b,seconds):
 n=round(seconds*rate);count=n*channels;result=a[:-count]
 for i in range(n):
  theta=i/(n-1)*math.pi/2
  for ch in range(channels):result.append(a[len(a)-count+i*channels+ch]*math.cos(theta)+b[i*channels+ch]*math.sin(theta))
 result.extend(b[count:]);return result
tail=clip(16.08,17.60)
final=join(clip(0,17.60),join(tail,tail,.20),.15)
assert len(final)==round(20.29*rate)*channels
unchanged=round(17.45*rate)*channels
assert final[:unchanged]==pcm[:unchanged]
start,end=round(19.49*rate),round(20.29*rate)
for i in range(start,end):
 gain=1-(i-start)/(end-start-1)
 for ch in range(channels):final[i*channels+ch]*=gain
final.extend(array('f',[0])*(21*rate*channels-len(final)))
wav=out/'soundtrack.wav'
subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-f','f32le','-ar',str(rate),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(wav)],input=final.tobytes(),check=True)
receipt={'sourceSha256':source_sha,'duration':21,'originalPcmUnchangedThroughSeconds':17.45,'voiceSpeed':1,'voiceGainDb':0,'completeFinalLine':'Free and open source.','instrumentalSourceSeconds':[16.08,17.6],'instrumentalCopies':2,'fadeOut':[19.49,20.29],'silentHold':.71,'peakAmplitude':max(map(abs,final))}
(out/'audio-validation.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
