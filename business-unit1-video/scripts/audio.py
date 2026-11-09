"""Synthesise the music bed and sound effects (no samples, no licences needed).

Writes public/music/ambient.wav (a seamless 64-second loop) and
public/sfx/{whoosh,boom,swish}.wav.
"""
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
ROOT = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(7)

def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)

def circular_reverb(x, seconds=4.0, wet=0.45):
    """Reverb by circular convolution, so a loop stays seamless."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t * 3.2 / seconds * 2.2)
        ir = sosfilt(butter(2, 5000, "low", fs=SR, output="sos"), ir)
        ir /= np.sqrt((ir ** 2).sum())
        X = np.fft.rfft(x[:, ch])
        H = np.fft.rfft(ir, len(x))
        out[:, ch] = np.fft.irfft(X * H, len(x))
    return (1 - wet) * x + wet * out * 0.9

def pad_loop():
    chords = [
        [45, 52, 59, 60, 67],  # Am9
        [41, 48, 57, 64],      # Fmaj7
        [48, 55, 62, 64],      # Cadd9
        [43, 50, 59, 64],      # G6
        [50, 57, 64, 65],      # Dm9
        [45, 52, 55, 60],      # Am7
        [41, 48, 64, 71],      # Fmaj7#11
        [40, 47, 52, 57],      # Esus4
    ]
    seg = 8.0
    L = int(seg * len(chords) * SR)
    t_all = np.arange(L) / SR
    out = np.zeros((L, 2))
    xfade = 3.0
    for ci, chord in enumerate(chords):
        start = ci * seg - xfade / 2
        dur = seg + xfade
        n = int(dur * SR)
        t = np.arange(n) / SR
        env = np.ones(n)
        k = int(xfade * SR)
        env[:k] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, k))
        env[-k:] = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, k))
        sig = np.zeros((n, 2))
        for note in chord:
            f0 = mtof(note)
            for ch, det in enumerate((-0.07, 0.07)):
                for d in (-1, 0, 1):
                    f = f0 * 2 ** ((det + d * 0.05) / 12)
                    ph = rng.uniform(0, 2 * np.pi)
                    for h in range(1, 7):
                        if f * h > 4000:
                            break
                        sig[:, ch] += np.sin(2 * np.pi * f * h * t + ph * h) / h ** 1.8
        # sub bass on the root
        root = mtof(chord[0] - 12)
        sig += (0.9 * np.sin(2 * np.pi * root * t))[:, None]
        # shimmer two octaves up, slow tremolo
        top = mtof(chord[-1] + 12)
        trem = 0.5 + 0.5 * np.sin(2 * np.pi * 0.25 * t + ci)
        sig[:, 0] += 0.25 * np.sin(2 * np.pi * top * t) * trem
        sig[:, 1] += 0.25 * np.sin(2 * np.pi * top * 1.002 * t) * (1 - trem)
        sig *= env[:, None]
        idx = (np.arange(n) + int(start * SR)) % L
        np.add.at(out, idx, sig)
    # slow filter-like movement: blend a low-passed copy (periodic over the loop)
    sos = butter(2, 900, "low", fs=SR, output="sos")
    dark = np.stack([sosfilt(sos, np.tile(out[:, c], 2))[L:] for c in range(2)], axis=1)
    mix = 0.5 + 0.5 * np.sin(2 * np.pi * t_all / (seg * len(chords)))
    out = dark * mix[:, None] + out * (1 - mix[:, None]) * 0.8
    out = circular_reverb(out, 4.5, 0.5)
    out -= out.mean(axis=0)
    rms = np.sqrt((out ** 2).mean())
    out *= 10 ** (-20 / 20) / rms
    return np.clip(out, -0.98, 0.98)

def bandpass_sweep(n, f_start, f_peak, f_end, q=1.2):
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    t = np.linspace(0, 1, n)
    freqs = np.where(t < 0.5, f_start * (f_peak / f_start) ** (t * 2), f_peak * (f_end / f_peak) ** ((t - 0.5) * 2))
    block = 256
    for i in range(0, n, block):
        f = freqs[i]
        lo, hi = f / (1 + 1 / q), min(f * (1 + 1 / q), SR / 2 - 100)
        sos = butter(2, [lo, hi], "band", fs=SR, output="sos")
        out[i:i + block] = sosfilt(sos, noise[max(0, i - 2048):i + block])[-len(noise[i:i + block]):]
    return out

def whoosh(dur=1.6, f=(250, 2800, 500), gain=0.8):
    n = int(dur * SR)
    x = bandpass_sweep(n, *f)
    t = np.linspace(0, 1, n)
    env = np.sin(np.pi * t ** 0.8) ** 2
    x *= env
    pan = t
    st = np.stack([x * np.cos(pan * np.pi / 2), x * np.sin(pan * np.pi / 2)], axis=1)
    st = circular_reverb(np.vstack([st, np.zeros((SR, 2))]), 1.5, 0.3)
    return st / np.abs(st).max() * gain

def boom(dur=3.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 32 + 48 * np.exp(-t * 3)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 1.6)
    hit = sosfilt(butter(2, 400, "low", fs=SR, output="sos"), rng.standard_normal(n)) * np.exp(-t * 18) * 0.6
    x = x + hit
    st = np.stack([x, x], axis=1)
    st = circular_reverb(st, 2.5, 0.35)
    return st / np.abs(st).max() * 0.9

if __name__ == "__main__":
    (ROOT / "public" / "music").mkdir(parents=True, exist_ok=True)
    (ROOT / "public" / "sfx").mkdir(parents=True, exist_ok=True)
    sf.write(ROOT / "public" / "sfx" / "whoosh.wav", whoosh(), SR, subtype="PCM_16")
    sf.write(ROOT / "public" / "sfx" / "swish.wav", whoosh(0.7, (900, 4500, 1500), 0.5), SR, subtype="PCM_16")
    sf.write(ROOT / "public" / "sfx" / "boom.wav", boom(), SR, subtype="PCM_16")
    sf.write(ROOT / "public" / "music" / "ambient.wav", pad_loop(), SR, subtype="PCM_16")
    print("audio written")
