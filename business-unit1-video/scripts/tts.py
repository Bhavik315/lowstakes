"""Generate the voiceover with Kokoro (open-weight, runs locally, no API key).

Reads scripts/narration.json (written by export-narration.ts), synthesises every
sentence, and writes:
  public/vo/<scene>.mp3          one narration track per scene
  src/content/timeline.json      start/end of every line and caption part

Unchanged sentences are cached in scripts/.tts-cache, so edits re-render fast.
"""
import hashlib, json, os, re, subprocess, sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
MODELS = Path(os.environ.get("KOKORO_DIR", ROOT / "scripts" / ".models"))
CACHE = ROOT / "scripts" / ".tts-cache"
VOICE = os.environ.get("VOICE", "af_heart")
SPEED = float(os.environ.get("SPEED", "0.94"))
SR = 24000

SENTENCE_GAP = 0.26   # silence between sentences inside a line
LINE_GAP = 0.45       # silence between lines
QUESTION_GAP = 0.65   # after a question

def split_sentences(text):
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9“\"$])", text.strip())
    return [p.strip() for p in parts if p.strip()]

def trim(audio, thresh_db=-42.0, keep=0.03):
    if len(audio) == 0:
        return audio
    thresh = 10 ** (thresh_db / 20) * max(1e-9, np.abs(audio).max())
    idx = np.where(np.abs(audio) > thresh)[0]
    if len(idx) == 0:
        return audio
    pad = int(keep * SR)
    return audio[max(0, idx[0] - pad): min(len(audio), idx[-1] + pad)]

def main():
    narration = json.loads((ROOT / "scripts" / "narration.json").read_text())
    CACHE.mkdir(parents=True, exist_ok=True)
    (ROOT / "public" / "vo").mkdir(parents=True, exist_ok=True)
    kokoro = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))

    def synth(sentence):
        key = hashlib.sha1(f"{VOICE}|{SPEED}|{sentence}".encode()).hexdigest()
        path = CACHE / f"{key}.npy"
        if path.exists():
            return np.load(path)
        samples, sr = kokoro.create(sentence, voice=VOICE, speed=SPEED, lang="en-us")
        assert sr == SR
        samples = trim(np.asarray(samples, dtype=np.float32))
        np.save(path, samples)
        return samples

    timeline = {"voice": VOICE, "speed": SPEED, "scenes": {}}
    tracks = {}
    total_lines = sum(len(s["lines"]) for s in narration)
    done = 0
    for scene in narration:
        chunks, lines, t = [], [], 0.0
        for li, line in enumerate(scene["lines"]):
            spoken = split_sentences(line["say"])
            shown = split_sentences(line["text"])
            line_start = t
            spans = []
            for si, sentence in enumerate(spoken):
                audio = synth(sentence)
                spans.append((t, t + len(audio) / SR))
                chunks.append(audio)
                t += len(audio) / SR
                if si < len(spoken) - 1:
                    chunks.append(np.zeros(int(SENTENCE_GAP * SR), np.float32))
                    t += SENTENCE_GAP
            line_end = t
            if len(shown) == len(spoken):
                parts = [{"text": s, "start": round(a, 3), "end": round(b, 3)} for s, (a, b) in zip(shown, spans)]
            else:
                parts = [{"text": line["text"], "start": round(line_start, 3), "end": round(line_end, 3)}]
            lines.append({"id": line["id"], "start": round(line_start, 3), "end": round(line_end, 3), "parts": parts})
            if li < len(scene["lines"]) - 1:
                gap = line["pause"] if line["pause"] is not None else (QUESTION_GAP if line["say"].rstrip().endswith("?") else LINE_GAP)
                chunks.append(np.zeros(int(gap * SR), np.float32))
                t += gap
            done += 1
            print(f"\r[{done}/{total_lines}] {scene['scene']}", end="", flush=True)
        tracks[scene["scene"]] = np.concatenate(chunks)
        timeline["scenes"][scene["scene"]] = {"duration": round(t, 3), "lines": lines}
    print()

    peak = max(np.abs(a).max() for a in tracks.values())
    gain = 0.89 / peak
    for sid, audio in tracks.items():
        wav = CACHE / f"_{sid}.wav"
        sf.write(wav, audio * gain, SR, subtype="PCM_16")
        # Compact mono MP3 keeps the repo small; speech at 64 kbps is transparent enough.
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "64k",
             "-ac", "1", str(ROOT / "public" / "vo" / f"{sid}.mp3")],
            check=True,
        )
        wav.unlink()

    (ROOT / "src" / "content" / "timeline.json").write_text(json.dumps(timeline, indent=1))
    total = sum(s["duration"] for s in timeline["scenes"].values())
    print(f"Wrote {len(tracks)} tracks, {total/60:.1f} min of narration (voice {VOICE}, speed {SPEED})")

if __name__ == "__main__":
    sys.exit(main())
