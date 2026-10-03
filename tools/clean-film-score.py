#!/usr/bin/env python3
"""Render the film's original tonal score. No voice, samples, noise or breath layers.

Usage: python3 tools/clean-film-score.py /tmp/offer-filter-score.wav
The same 18.5-second WAV is muxed into every aspect-ratio export.
"""
import array
import math
import sys
import wave

RATE = 48000
DURATION = 18.5
out = array.array('f', [0]) * round(RATE * DURATION)

def note(start, midi, length=1.8, gain=0.11):
    frequency = 440 * 2 ** ((midi - 69) / 12)
    first = round(start * RATE)
    for j in range(min(round(length * RATE), len(out) - first)):
        t = j / RATE
        # A rounded piano-like attack, then a simple decaying harmonic tone.
        envelope = min(1, t / 0.012) * math.exp(-3.2 * t / length)
        envelope *= min(1, (length - t) / 0.12)
        tone = math.sin(2 * math.pi * frequency * t)
        tone += 0.16 * math.sin(2 * math.pi * frequency * 2 * t)
        tone += 0.04 * math.sin(2 * math.pi * frequency * 3 * t)
        out[first + j] += gain * envelope * tone

# Sparse 100 BPM motif, with changes following the seven-shot visual sequence.
phrases = [(0.15,[62,69,74,76]),(2.55,[59,66,71,74]),(4.95,[55,62,67,71]),
           (7.35,[57,64,69,74]),(9.75,[62,69,74,78]),(12.15,[55,62,67,74])]
for start, notes in phrases:
    note(start, notes[0]-12, 2.1, .07)
    for i, pitch in enumerate(notes):
        note(start+i*.6, pitch, 1.5, .075 if i==0 else .095)
for offset, pitch in [(14.6,62),(15.0,69),(15.4,74),(15.8,78)]:
    note(offset, pitch, 2.5, .075)
peak=max(abs(x) for x in out)
scale=min(1,.65/peak)
pcm=array.array('h')
for i,sample in enumerate(out):
    fade=min(1,(len(out)-i)/(RATE*.65))
    v=int(max(-1,min(1,sample*scale*fade))*32767)
    pcm.extend((v,v))
if sys.byteorder!='little': pcm.byteswap()
with wave.open(sys.argv[1], 'wb') as f:
    f.setparams((2,2,RATE,len(out),'NONE','not compressed'))
    f.writeframes(pcm.tobytes())
print(f'{DURATION}s original tonal score; peak={peak*scale:.3f}; no noise or voice layers')
