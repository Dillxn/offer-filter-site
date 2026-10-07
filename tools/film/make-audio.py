#!/usr/bin/env python3
"""Prepare the film soundtrack: the supplied take at its own speed and balance, 1 dB of headroom, its last ring eased out, then silence to 21 s."""
from array import array
from pathlib import Path
import hashlib, json, subprocess, sys
root=Path(__file__).resolve().parents[2]
source=root/'assets/your-time-matters.mp3'
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
source_sha=hashlib.sha256(source.read_bytes()).hexdigest()
assert source_sha=='db3b01b116becbf205037d6f176cf23cd847b4449312e21271e2d72b2b2a08ec'
rate,channels,duration=48000,2,21
pcm=array('f',subprocess.check_output(['ffmpeg','-v','error','-i',str(source),'-f','f32le','-ar',str(rate),'-ac','2','-']))
frames=len(pcm)//channels
assert frames==round(20.4*rate),frames
# The take is mastered to 0 dBFS; lossy encodes then overshoot. A uniform 1 dB trim keeps them below -0.5 dBTP.
trim=10**(-1/20)
final=array('f',(v*trim for v in pcm))
# The take stops while its final chord still rings at about -35 dB; fade those last 0.3 s to silence.
start=round(20.1*rate)
for i in range(start,frames):
 gain=(frames-1-i)/(frames-1-start)
 for ch in range(channels):final[i*channels+ch]*=gain
assert all(abs(a-b*trim)<1e-6 for a,b in zip(final[:start*channels],pcm[:start*channels]))
final.extend(array('f',[0])*(duration*rate*channels-len(final)))
wav=out/'soundtrack.wav'
subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-f','f32le','-ar',str(rate),'-ac','2','-i','pipe:0','-c:a','pcm_s24le',str(wav)],input=final.tobytes(),check=True)
# The website plays these alongside the live canvas: Opus where supported, AAC everywhere else.
subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-i',str(wav),'-c:a','libopus','-b:a','96k','-map_metadata','-1',str(out/'film-soundtrack.webm')],check=True)
subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-i',str(wav),'-c:a','aac','-b:a','128k','-movflags','+faststart','-map_metadata','-1',str(out/'film-soundtrack.m4a')],check=True)
receipt={'sourceSha256':source_sha,'duration':duration,'sourceSeconds':20.4,'originalPcmUnchangedExceptTrimThroughSeconds':20.1,'voiceSpeed':1,'uniformGainDb':-1,'tailFade':[20.1,20.4],'silentHold':.6,'peakAmplitude':max(map(abs,final))}
(out/'audio-validation.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt))
