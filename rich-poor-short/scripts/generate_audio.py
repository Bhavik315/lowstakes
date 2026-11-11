"""Synthesize the background beat and the sound effects (no samples, pure numpy).

Outputs
  public/beat.wav           lo-fi beat, exactly as long as the video so it loops with it
  public/sfx/*.wav          whoosh, pop, ding, impact, count, down, riser

Usage:  python3 scripts/generate_audio.py   (run after generate_voiceover.py)
"""

import json
import math
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
FPS = 30
BARS = 20
rng = np.random.default_rng(7)


# ---------------------------------------------------------------- helpers
def write(path: Path, x: np.ndarray, peak: float):
    x = x / max(1e-9, np.abs(x).max()) * peak
    if x.ndim == 1:
        x = x[:, None]
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as f:
        f.setnchannels(x.shape[1])
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((x * 32767).astype(np.int16).tobytes())


def t(seconds: float) -> np.ndarray:
    return np.arange(int(seconds * SR)) / SR


def decay(seconds: float, tau: float) -> np.ndarray:
    return np.exp(-t(seconds) / tau)


def band(x: np.ndarray, lo: float | None = None, hi: float | None = None, order: int = 4):
    """Zero-phase Butterworth-shaped filter done in the frequency domain."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        g *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-6)) ** (2 * order))
    return np.fft.irfft(X * g, len(x))


def sweep(f0: float, f1: float, seconds: float, curve: float = 1.0) -> np.ndarray:
    """Sine whose pitch glides from f0 to f1."""
    n = int(seconds * SR)
    p = (np.arange(n) / max(1, n - 1)) ** curve
    freq = f0 * (f1 / f0) ** p
    return np.sin(2 * np.pi * np.cumsum(freq) / SR)


def fades(x: np.ndarray, a: float = 0.002, r: float = 0.01) -> np.ndarray:
    x = x.copy()
    na, nr = int(a * SR), int(r * SR)
    x[:na] *= np.linspace(0, 1, na)
    x[-nr:] *= np.linspace(1, 0, nr)
    return x


def hz(midi: float) -> float:
    return 440 * 2 ** ((midi - 69) / 12)


# ---------------------------------------------------------------- sfx
def sfx_whoosh():
    d = 0.5
    n = int(d * SR)
    x = np.zeros(n)
    pos = np.arange(n) / n
    # three noise bands peaking one after another = an upward "swish"
    for (lo, hi), centre, gain in [((180, 700), 0.34, 0.9), ((600, 2400), 0.48, 1.0), ((2000, 8000), 0.6, 0.7)]:
        x += band(rng.standard_normal(n), lo, hi, 3) * np.exp(-((pos - centre) ** 2) / (2 * 0.13**2)) * gain
    return fades(x, 0.02, 0.05)


def sfx_pop():
    d = 0.16
    x = sweep(300, 880, d, 0.35) + 0.25 * sweep(600, 1760, d, 0.35)
    return fades(x * decay(d, 0.032), 0.001, 0.02)


def sfx_ding():
    a = np.sin(2 * np.pi * hz(83) * t(0.075)) + 0.2 * np.sin(2 * np.pi * 3 * hz(83) * t(0.075))
    d = 0.6
    b = (np.sin(2 * np.pi * hz(88) * t(d)) + 0.2 * np.sin(2 * np.pi * 3 * hz(88) * t(d))) * decay(d, 0.16)
    return fades(np.concatenate([fades(a, 0.001, 0.004), b]), 0.001, 0.03)


def sfx_impact():
    d = 0.75
    body = sweep(120, 36, d, 0.4) * decay(d, 0.2)
    crack = band(rng.standard_normal(int(d * SR)), 80, 3200, 2) * decay(d, 0.04)
    return fades(np.tanh((body * 1.4 + crack * 0.7) * 1.6), 0.001, 0.05)


def sfx_count():
    """A short accelerating run of ticks for the rupee counters."""
    d = 0.7
    x = np.zeros(int(d * SR))
    pos, gap, i = 0.0, 0.07, 0
    while pos < d - 0.05:
        tick = np.sin(2 * np.pi * (1500 + 60 * i) * t(0.03)) * decay(0.03, 0.006)
        s = int(pos * SR)
        x[s : s + len(tick)] += tick * (0.6 + 0.4 * pos / d)
        pos += gap
        gap = max(0.028, gap * 0.9)
        i += 1
    return fades(x, 0.001, 0.02)


def sfx_down():
    """Sad two-note drop for Rahul's bad news."""
    out = []
    for f0, f1, d in [(294, 277, 0.2), (220, 147, 0.38)]:
        ph = 2 * np.pi * np.cumsum(f0 * (f1 / f0) ** (np.arange(int(d * SR)) / (d * SR))) / SR
        saw = sum(np.sin(k * ph) / k for k in range(1, 7))
        out.append(fades(band(saw, None, 1400, 2) * decay(d, 0.3), 0.004, 0.03))
    return np.concatenate(out)


def sfx_riser():
    d = 0.9
    n = int(d * SR)
    ramp = (np.arange(n) / n) ** 2
    tone = sweep(180, 1400, d, 1.6) * 0.5
    air = band(rng.standard_normal(n), 2500, 11000, 2) * 0.6
    return fades((tone + air) * ramp, 0.01, 0.012)


# ---------------------------------------------------------------- beat
def kick():
    d = 0.42
    x = sweep(135, 44, d, 0.3) * decay(d, 0.13)
    x[: int(0.004 * SR)] += band(rng.standard_normal(int(0.004 * SR)), 1000, 5000, 2) * 0.4
    return np.tanh(x * 1.8)


def snare():
    d = 0.3
    noise = band(rng.standard_normal(int(d * SR)), 900, 6500, 2) * decay(d, 0.07)
    tone = sweep(210, 170, d) * decay(d, 0.05)
    return noise * 0.9 + tone * 0.5


def hat(open_: bool = False):
    d = 0.2 if open_ else 0.07
    return band(rng.standard_normal(int(d * SR)), 6500, None, 3) * decay(d, 0.07 if open_ else 0.018)


def keys(midi: float, d: float, detune: float = 0.0):
    f = hz(midi) * (1 + detune)
    tt = t(d)
    x = np.sin(2 * np.pi * f * tt) + 0.32 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt / 0.25) + 0.1 * np.sin(2 * np.pi * 3 * f * tt) * np.exp(-tt / 0.12)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.6 * tt)
    return fades(x * np.exp(-tt / 0.75) * trem, 0.006, 0.08)


def bass(midi: float, d: float):
    f = hz(midi)
    tt = t(d)
    x = np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt)
    return fades(x * np.exp(-tt / 0.6), 0.008, 0.05)


def pluck(midi: float):
    d = 0.5
    f = hz(midi)
    tt = t(d)
    x = sum(np.sin(2 * np.pi * f * k * tt) / k**2 for k in (1, 3, 5))
    return fades(x * np.exp(-tt / 0.14), 0.002, 0.05)


def build_beat(total_seconds: float):
    n = int(round(total_seconds * SR))
    beat = total_seconds / (BARS * 4)
    drums = np.zeros((n, 2))
    music = np.zeros((n, 2))
    duck = np.ones(n)

    def put(buf, x, at_beats, gain=1.0, pan=0.0):
        s = int(at_beats * beat * SR)
        if s >= n:
            return
        x = x[: n - s]
        buf[s : s + len(x), 0] += x * gain * (1 - max(0, pan))
        buf[s : s + len(x), 1] += x * gain * (1 + min(0, pan))

    K, S, H, HO = kick(), snare(), hat(), hat(True)
    # Dm9 | Bbmaj7 | Fmaj7 | Cadd9  (four-bar loop, five times)
    chords = [
        (38, [57, 60, 64, 65]),
        (34, [53, 57, 58, 62]),
        (41, [52, 57, 60, 64]),
        (36, [52, 55, 60, 62]),
    ]
    melody = [69, 72, 74, None, 72, 69, None, 65, 67, None, 69, 64, None, 62, 64, None]
    swing = 0.09

    for bar in range(BARS):
        b0 = bar * 4
        root, notes = chords[bar % 4]
        intro = bar == 0  # under the hook: no drums yet, just keys
        outro = bar == BARS - 1  # last bar thins out so the loop restart lands

        for hit, length in [(0, 2.4), (2.5, 1.5)]:
            for i, m in enumerate(notes):
                put(music, keys(m, length * beat, 0.0015 * (i - 1.5)), b0 + hit + i * 0.012, 0.16, pan=0.35 * (i - 1.5) / 1.5)
        put(music, bass(root, 2.2 * beat), b0, 0.5)
        put(music, bass(root, 0.9 * beat), b0 + 2.5, 0.4)
        if not intro and bar % 2 == 1:
            put(music, bass(root + 7, 0.5 * beat), b0 + 3.5, 0.3)

        if bar >= 4 and not outro:  # melody joins after the first phrase
            for i in range(4):
                m = melody[(bar % 4) * 4 + i]
                if m:
                    put(music, pluck(m + 12), b0 + i + (swing if i % 2 else 0) + 0.5, 0.05, pan=-0.4 if i % 2 else 0.4)

        if intro:
            put(drums, K, b0, 0.8)
            for e in range(4, 8):
                put(drums, H, b0 + e * 0.5, 0.05 + 0.02 * (e - 4))
            continue

        kicks = [0, 2.5] + ([3.5] if bar % 2 == 1 else [])
        snares = [1, 3]
        if outro:
            kicks, snares = [0], [1]
        for k in kicks:
            put(drums, K, b0 + k, 0.95)
            s = int((b0 + k) * beat * SR)
            e = min(n, s + int(0.22 * SR))
            duck[s:e] = np.minimum(duck[s:e], 0.45 + 0.55 * np.linspace(0, 1, e - s) ** 1.5)
        for s_ in snares:
            put(drums, S, b0 + s_, 0.5)
        for e in range(8):
            if outro and e >= 4:
                break
            off = e % 2 == 1
            put(drums, H, b0 + e * 0.5 + (swing if off else 0), 0.14 if off else 0.2, pan=0.25)
        if bar % 4 == 3 and not outro:
            put(drums, HO, b0 + 3.5 + swing, 0.16, pan=0.25)

    mix = drums + music * duck[:, None]
    # darker, tape-like top end so the beat sits under the voice
    mix = np.stack([band(mix[:, c], 30, 7500, 2) for c in range(2)], axis=1)
    mix = np.tanh(mix * 1.3)
    edge = int(0.03 * SR)
    mix[:edge] *= np.linspace(0, 1, edge)[:, None]
    mix[-edge:] *= np.linspace(1, 0, edge)[:, None]
    return mix, 60 / beat


def main():
    audio_ms = json.loads((ROOT / "src" / "data" / "words.json").read_text())["audioDurationMs"]
    frames = math.ceil(audio_ms / 1000 * FPS)
    beat, bpm = build_beat(frames / FPS)
    write(ROOT / "public" / "beat.wav", beat, 0.85)
    print(f"beat: {frames / FPS:.2f}s, {BARS} bars at {bpm:.1f} BPM")

    for name, fn, peak in [
        ("whoosh", sfx_whoosh, 0.8),
        ("pop", sfx_pop, 0.8),
        ("ding", sfx_ding, 0.7),
        ("impact", sfx_impact, 0.9),
        ("count", sfx_count, 0.6),
        ("down", sfx_down, 0.7),
        ("riser", sfx_riser, 0.7),
    ]:
        x = fn()
        write(ROOT / "public" / "sfx" / f"{name}.wav", x, peak)
        print(f"sfx/{name}.wav  {len(x) / SR:.2f}s")


if __name__ == "__main__":
    main()
