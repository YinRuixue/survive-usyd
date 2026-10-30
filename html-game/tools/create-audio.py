#!/usr/bin/env python3
"""Render the game's original pastoral loop and button sound using only stdlib.

No samples or melodies from another game are used. The 32-bar score combines
soft plucked strings, a breathy sine lead, mellow bells, bass and brushed taps.
Run from any directory with Python 3.9+; output is deterministic, local PCM WAV.
"""
import math
import random
import sys
import wave
from array import array
from pathlib import Path

RATE = 22050
BPM = 92
BEAT = 60 / BPM
LENGTH = 32 * 4 * BEAT
OUT = Path(__file__).resolve().parents[1] / "assets/audio"
TAU = math.tau


def render_music():
    size = round(LENGTH * RATE)
    left, right = (array("f", [0]) * size for _ in range(2))
    rng = random.Random(9001)

    def note(beat, midi, beats, level, voice="pluck", pan=0):
        start = round(beat * BEAT * RATE)
        duration = beats * BEAT
        count = round(duration * RATE)
        frequency = 440 * 2 ** ((midi - 69) / 12)
        lp, rp = math.sqrt((1 - pan) / 2), math.sqrt((1 + pan) / 2)
        phase = rng.random() * TAU
        for i in range(count):
            t = i / RATE
            release = min(1, (duration - t) / .12)
            p = TAU * frequency * t
            if voice == "pluck":
                envelope = min(1, t / .008) * math.exp(-t * 3.4) * release
                value = (math.sin(p) + .32 * math.sin(2*p) * math.exp(-t*3)
                         + .13 * math.sin(3*p) * math.exp(-t*5)) * envelope
            elif voice == "flute":
                envelope = min(1, t / .075) * min(1, (duration-t) / .2)
                vibrato = .012 * math.sin(TAU * 4.5 * t) * min(1, t / .3)
                value = (math.sin(p + vibrato) + .10 * math.sin(2*p + vibrato)) * envelope
            elif voice == "bell":
                envelope = min(1, t / .006) * math.exp(-t*2.5) * release
                value = (math.sin(p) + .23*math.sin(p*2.01)*math.exp(-t*4)
                         + .05*math.sin(p*3.98)*math.exp(-t*8)) * envelope
            elif voice == "bass":
                envelope = min(1, t / .025) * math.exp(-t*2.2) * release
                value = (math.sin(p) + .15*math.sin(2*p)) * envelope
            else:
                envelope = min(1, t / .003) * math.exp(-t*45) * release
                value = (rng.uniform(-1, 1)*.35 + math.sin(p+phase)*.25) * envelope
            value *= level
            j = (start + i) % size
            left[j] += value * lp
            right[j] += value * rp

    # D major, with major sevenths and open ninths for a warm, unhurried mood.
    harmony = [
        (38, [62, 66, 69, 76]), (43, [62, 67, 71, 74]),
        (42, [62, 66, 69, 74]), (45, [61, 64, 69, 71]),
        (47, [62, 66, 69, 73]), (43, [62, 67, 71, 74]),
        (40, [62, 64, 67, 71]), (45, [61, 64, 69, 74]),
    ]
    # Each tuple is (offset in beats, MIDI pitch, held beats).
    theme_a = [
        [(0,74,.7),(1,78,.7),(2,81,1.2),(3.5,78,.4)],
        [(.5,79,.7),(1.5,78,.4),(2,76,.8),(3,74,.7)],
        [(0,73,.8),(1,74,.4),(1.5,78,.8),(3,76,.7)],
        [(0,73,1.3),(2,71,.7),(3,69,.7)],
        [(.5,71,.7),(1.5,74,.4),(2,78,1.3)],
        [(0,79,.8),(1,78,.4),(1.5,76,.8),(3,74,.7)],
        [(0,76,1.2),(1.5,74,.7),(2.5,71,.9)],
        [(0,73,.7),(1,76,.7),(2,74,1.4)],
    ]
    theme_b = [
        [(0,81,1.3),(1.5,78,.7),(2.5,76,.4),(3,74,.7)],
        [(.5,79,.8),(1.5,83,.7),(2.5,81,.4),(3,79,.7)],
        [(0,78,.8),(1,76,.7),(2,74,1.3)],
        [(0,76,.8),(1,73,.7),(2,71,1.2)],
        [(0,74,.7),(1,78,.7),(2,81,.8),(3,78,.7)],
        [(0,79,1.2),(1.5,78,.7),(2.5,74,1.0)],
        [(0,76,.8),(1,74,.7),(2,71,.7),(3,73,.7)],
        [(0,76,.7),(1,73,.7),(2,74,1.5)],
    ]
    for bar in range(32):
        root, chord = harmony[bar % 8]
        offset = bar * 4
        for step, index in enumerate([0, 2, 1, 3, 2, 1, 3, 2]):
            note(offset + step*.5, chord[index], 1.4, .095 if step%2 == 0 else .065,
                 pan=-.32 if step%2 == 0 else .25)
        note(offset, root, 1.8, .16, "bass", -.05)
        note(offset+2, root+7, 1.5, .105, "bass", .05)
        melody = theme_b if 16 <= bar < 24 else theme_a
        for beat, pitch, held in melody[bar % 8]:
            note(offset+beat, pitch, held, .10, "flute", .15)
        if bar >= 8:
            for beat in [1, 3]:
                note(offset+beat, 55, .2, .045, "brush", -.35)
            if bar%2 == 1:
                note(offset+3.5, chord[2]+12, .9, .045, "bell", -.4)
        if bar >= 24 and bar%2 == 0:
            note(offset+.5, chord[3]+12, 1.5, .035, "bell", .4)

    # Circular, cross-channel echoes retain the release tails across the loop seam.
    dry_left, dry_right = array("f", left), array("f", right)
    for delay, level in [(.16, .12), (.31, .07), (.47, .035)]:
        shift = round(delay * RATE)
        for i in range(size):
            left[i] += dry_right[(i-shift) % size] * level
            right[i] += dry_left[(i-shift) % size] * level
    return left, right


def render_click():
    size = round(.11 * RATE)
    channel = array("f", [0]) * size
    for i in range(size):
        t = i / RATE
        envelope = min(1, t/.003) * math.exp(-t*48) * min(1, (.11-t)/.02)
        # A short, soft wooden "pip", with no sharp noise transient.
        channel[i] = (math.sin(TAU*740*t) + .3*math.sin(TAU*1110*t)) * envelope
    return channel, channel


def write_wav(name, channels, peak):
    maximum = max(abs(v) for channel in channels for v in channel)
    scale = peak * 32767 / max(maximum, .001)
    samples = array("h")
    for frame in zip(*channels):
        samples.extend(round(value*scale) for value in frame)
    if sys.byteorder != "little":
        samples.byteswap()
    with wave.open(str(OUT/name), "wb") as output:
        output.setparams((2, 2, RATE, 0, "NONE", "not compressed"))
        output.writeframes(samples.tobytes())
    print(f"{name}: {len(channels[0])/RATE:.2f}s, peak {peak:.2f}")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    write_wav("campus-afternoon.wav", render_music(), .62)
    write_wav("button-click.wav", render_click(), .45)
