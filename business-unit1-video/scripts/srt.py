"""Write subtitles (out/IGCSE-Business-Unit1.srt) matching the burned-in captions.

Mirrors the timing rules in src/lib/timing.ts and the chunking in src/components/Captions.tsx.
"""
import json, math, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FPS, TRANSITION, MAX_CHARS = 30, 20, 84
timeline = json.loads((ROOT / "src/content/timeline.json").read_text())["scenes"]
narration = json.loads((ROOT / "scripts/narration.json").read_text())
src = (ROOT / "src/content/script.ts").read_text()
kinds = dict(re.findall(r'id: "([\w-]+)",\n\s+kind: "(\w+)"', src))

def lead(k): return {"chapter": 42, "montage": 36, "title": 30}.get(k, 16)
def tail(k): return {"end": 180, "chapter": 36, "title": 36}.get(k, 28)

def chunk(text, start, end):
    if len(text) <= MAX_CHARS:
        return [(text, start, end)]
    words = text.split(" ")
    n = math.ceil(len(text) / MAX_CHARS)
    target = len(text) / n
    pieces, cur = [], ""
    for i, w in enumerate(words):
        nxt = f"{cur} {w}" if cur else w
        remaining = len(words) - i
        brk = len(cur) >= target * 0.6 and (re.search(r"[,:;]$", cur) or len(nxt) > target * 1.15) and remaining > 2
        if brk and len(pieces) < n - 1:
            pieces.append(cur); cur = w
        else:
            cur = nxt
    if cur: pieces.append(cur)
    total = sum(len(p) for p in pieces)
    out, t = [], start
    for p in pieces:
        d = (end - start) * len(p) / total
        out.append((p, t, t + d)); t += d
    return out

def ts(frames):
    ms = int(round(frames / FPS * 1000))
    h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"

def wrap(text, width=48):
    if len(text) <= width: return text
    words, best = text.split(" "), None
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        score = max(len(a), len(b))
        if best is None or score < best[0]: best = (score, a, b)
    return f"{best[1]}\n{best[2]}"

start, cues = 0, []
for i, scene in enumerate(narration):
    sid = scene["scene"]; k = kinds[sid]
    base = start + lead(k)
    for line in timeline[sid]["lines"]:
        for p in line["parts"]:
            cues += chunk(p["text"], base + p["start"] * FPS, base + p["end"] * FPS)
    frames = lead(k) + math.ceil(timeline[sid]["duration"] * FPS) + tail(k)
    start += frames - (TRANSITION if i < len(narration) - 1 else 0)

out = ROOT / "out" / "IGCSE-Business-Unit1.srt"
out.parent.mkdir(exist_ok=True)
with out.open("w") as f:
    for n, (text, a, b) in enumerate(cues, 1):
        nxt = cues[n][1] if n < len(cues) else b + 18
        f.write(f"{n}\n{ts(a)} --> {ts(min(b + 18, nxt))}\n{wrap(text)}\n\n")
print(f"{len(cues)} subtitles, video length {ts(start)} -> {out}")
