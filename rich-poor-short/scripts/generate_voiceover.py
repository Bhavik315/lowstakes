"""Generate the voiceover + word-level timings with edge-tts.

Outputs
  public/voiceover.mp3      raw edge-tts audio
  public/voiceover.wav      48 kHz PCM copy used by the composition
  src/data/words.json       raw word boundaries (spoken words, ms)
  src/data/captions.json    @remotion/captions `Caption[]` for on-screen captions

Usage:  python3 scripts/generate_voiceover.py
"""

import asyncio
import json
import os
import re
import subprocess
import time
import wave
from pathlib import Path

import edge_tts
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
VOICE = "en-IN-PrabhatNeural"
RATE = "+10%"

# Spoken phrase -> what the caption shows. Longest phrases first.
DISPLAY = [
    ("fifty thousand rupees", "₹50,000"),
    ("twenty thousand rupees", "₹20,000"),
    ("thirty six percent", "36%"),
    ("twenty four lakh", "₹24 lakh"),
    ("forty six lakh", "₹46 lakh"),
    ("ten lakh", "₹10 lakh"),
    ("sixteen months", "16 months"),
    ("ten years", "10 years"),
    ("three years", "3 years"),
    ("three loans", "3 loans"),
]
# Pause tightening: the voice leaves ~1.2s between sentences, far too slow for
# a Short. Silence between words is cut down to these lengths (ms).
SENTENCE_GAP_MS = 360
CLAUSE_GAP_MS = 260
KEEP_AFTER_WORD_MS = 170  # of the kept gap, how much stays attached to the word before
LEAD_IN_MS = 60  # silence before the first word
TAIL_MS = 260  # silence after the last word (keeps the loop tight)
SR = 48000

MAX_WORDS_PER_PAGE = 3
MAX_CHARS_PER_PAGE = 16


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


async def synthesize(text: str):
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    com = edge_tts.Communicate(
        text, VOICE, rate=RATE, boundary="WordBoundary", proxy=proxy
    )
    audio = bytearray()
    words = []
    async for chunk in com.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            start = chunk["offset"] / 10_000  # 100ns ticks -> ms
            words.append(
                {
                    "text": chunk["text"],
                    "startMs": round(start),
                    "endMs": round(start + chunk["duration"] / 10_000),
                }
            )
    return bytes(audio), words


def attach_punctuation(words, script: str):
    """Edge word boundaries drop punctuation; recover it from the script."""
    tokens = [t for t in script.split() if norm(t)]
    if len(tokens) != len(words) or any(
        norm(t) != norm(w["text"]) for t, w in zip(tokens, words)
    ):
        raise SystemExit(
            "Word boundaries do not line up with the script:\n"
            f"  script: {[norm(t) for t in tokens]}\n"
            f"  tts:    {[norm(w['text']) for w in words]}"
        )
    for tok, w in zip(tokens, words):
        w["written"] = tok
        w["sentenceEnd"] = bool(re.search(r"[.?!…]+$", tok))
        w["clauseEnd"] = w["sentenceEnd"] or tok.endswith(",")
    return words


def silent_span(samples: np.ndarray, from_ms: float, to_ms: float):
    """Longest stretch of near-silence between two word boundaries (ms)."""
    win = int(SR * 0.02)
    lo = max(0, int((from_ms - 80) * SR / 1000))
    hi = min(len(samples), int((to_ms + 40) * SR / 1000))
    n = max(0, (hi - lo) // win)
    if n == 0:
        return from_ms, from_ms
    rms = np.sqrt((samples[lo : lo + n * win].reshape(n, win) ** 2).mean(axis=1))
    best, start = (0, 0), None
    for i, quiet in enumerate(list(rms < 0.012) + [False]):
        if quiet and start is None:
            start = i
        elif not quiet and start is not None:
            if i - start > best[1] - best[0]:
                best = (start, i)
            start = None
    return (lo + best[0] * win) * 1000 / SR, (lo + best[1] * win) * 1000 / SR


def tighten(samples: np.ndarray, words):
    """Cut long silences out of the audio and shift the word timings to match."""
    ms = lambda t: int(round(t * SR / 1000))
    fade = ms(6)
    pieces = []
    cursor = max(0, words[0]["startMs"] - LEAD_IN_MS)  # source position (ms)
    removed = cursor
    for i, w in enumerate(words):
        nxt = words[i + 1] if i + 1 < len(words) else None
        w_start, w_end = w["startMs"], w["endMs"]
        w["startMs"], w["endMs"] = w_start - removed, w_end - removed
        if nxt is None:
            end = min(len(samples) * 1000 / SR, w_end + TAIL_MS)
            pieces.append(samples[ms(cursor) : ms(end)])
            break
        # Word boundaries are approximate, so measure where the audio is
        # actually silent between this word and the next before cutting.
        quiet_from, quiet_to = silent_span(samples, w_end, nxt["startMs"])
        target = SENTENCE_GAP_MS if w["sentenceEnd"] else CLAUSE_GAP_MS
        if quiet_to - quiet_from > target:
            cut_from = quiet_from + min(KEEP_AFTER_WORD_MS, target * 0.5)
            cut_to = quiet_to - (target - (cut_from - quiet_from))
            pieces.append(samples[ms(cursor) : ms(cut_from)])
            cursor = cut_to
            removed += cut_to - cut_from
    out = []
    for piece in pieces:
        piece = piece.astype(np.float32).copy()
        n = min(fade, len(piece) // 2)
        ramp = np.linspace(0, 1, n, dtype=np.float32)
        piece[:n] *= ramp
        piece[-n:] *= ramp[::-1]
        out.append(piece)
    for w in words:
        w["startMs"], w["endMs"] = round(w["startMs"]), round(w["endMs"])
    return np.concatenate(out), words


def build_captions(words):
    # 1) merge spoken number phrases into their display form
    merged = []
    i = 0
    while i < len(words):
        for phrase, shown in DISPLAY:
            parts = phrase.split()
            window = words[i : i + len(parts)]
            if [norm(w["text"]) for w in window] == [norm(p) for p in parts]:
                trail = re.search(r"[.,?!…]+$", window[-1]["written"])
                merged.append(
                    {
                        "text": shown + (trail.group(0) if trail else ""),
                        "startMs": window[0]["startMs"],
                        "endMs": window[-1]["endMs"],
                        "clauseEnd": window[-1]["clauseEnd"],
                    }
                )
                i += len(parts)
                break
        else:
            w = words[i]
            merged.append(
                {
                    "text": w["written"],
                    "startMs": w["startMs"],
                    "endMs": w["endMs"],
                    "clauseEnd": w["clauseEnd"],
                }
            )
            i += 1

    # 2) page breaks: at punctuation, or when a page gets too long
    captions = []
    count, chars = 0, 0
    for idx, m in enumerate(merged):
        nxt = merged[idx + 1] if idx + 1 < len(merged) else None
        count += 1
        chars += len(m["text"]) + 1
        brk = (
            nxt is None
            or m["clauseEnd"]
            or count >= MAX_WORDS_PER_PAGE
            or chars + len(nxt["text"]) > MAX_CHARS_PER_PAGE
        )
        captions.append(
            {
                "text": (" " if count > 1 else "") + m["text"],
                "startMs": m["startMs"],
                "endMs": m["endMs"],
                "timestampMs": (m["startMs"] + m["endMs"]) // 2,
                "confidence": None,
                "pageBreakAfter": brk,
            }
        )
        if brk:
            count, chars = 0, 0
    return captions


def main():
    script = " ".join((ROOT / "script.txt").read_text().split())
    # The free Edge endpoint sometimes answers with no audio; retry a few times.
    for attempt in range(6):
        try:
            audio, words = asyncio.run(synthesize(script))
            break
        except edge_tts.exceptions.NoAudioReceived:
            if attempt == 5:
                raise
            time.sleep(2 * (attempt + 1))
    words = attach_punctuation(words, script)

    mp3 = ROOT / "public" / "voiceover.mp3"
    wav = ROOT / "public" / "voiceover.wav"
    mp3.write_bytes(audio)  # untouched edge-tts output, kept for reference
    pcm = subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-i", str(mp3), "-f", "s16le", "-ar", str(SR), "-ac", "1", "-"],
        check=True,
        capture_output=True,
    ).stdout
    samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768
    raw_dur = len(samples) / SR
    samples, words = tighten(samples, words)
    samples = samples / max(1e-6, np.abs(samples).max()) * 0.92
    with wave.open(str(wav), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((samples * 32767).astype(np.int16).tobytes())
    dur = len(samples) / SR

    data = ROOT / "src" / "data"
    data.mkdir(parents=True, exist_ok=True)
    (data / "words.json").write_text(
        json.dumps(
            {
                "voice": VOICE,
                "rate": RATE,
                "audioDurationMs": round(dur * 1000),
                "words": [
                    {k: w[k] for k in ("text", "startMs", "endMs", "sentenceEnd")}
                    for w in words
                ],
            },
            indent=1,
            ensure_ascii=False,
        )
    )
    (data / "captions.json").write_text(
        json.dumps(build_captions(words), indent=1, ensure_ascii=False)
    )
    print(f"voiceover: {dur:.2f}s after tightening pauses (raw {raw_dur:.2f}s), {len(words)} words")


if __name__ == "__main__":
    main()
