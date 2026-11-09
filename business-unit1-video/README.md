# IGCSE Business Studies · Unit 1 — cinematic explainer video

A ~30-minute narrated, animated explainer of **Cambridge IGCSE Business Studies (0450) Unit 1: Understanding Business Activity**, built with [Remotion](https://www.remotion.dev).

It covers the whole unit, from scratch:

| Chapter | Syllabus | What's covered |
| --- | --- | --- |
| 1 · Business activity | 1.1 | Needs & wants, factors of production, scarcity, opportunity cost, specialisation & division of labour, purpose of business, added value (worked example) |
| 2 · Classifying businesses | 1.2 | Primary, secondary & tertiary sectors, chain of production, sector change & de-industrialisation, private vs public sector, mixed economy |
| 3 · Enterprise, growth & size | 1.3 | Entrepreneurs, business plans, government support, measuring size, why & how firms grow, merger types, problems of growth, staying small, why businesses fail |
| 4 · Business organisation | 1.4 | Liability, sole traders, partnerships, Ltd, plc, franchises, joint ventures, public corporations, comparison table |
| 5 · Objectives & stakeholders | 1.5 | Why objectives matter, SMART, survival/profit/growth/market share, social enterprise, stakeholders, conflicts, public vs private objectives |

Every on-screen element is cued from the narration, the item being talked about is spotlighted, and captions are burned in.

## How it's made

- **Script & visuals:** `src/content/script.ts` holds every scene: the narration lines and the visuals they trigger (cue ids). Edit text here.
- **Voiceover:** generated locally with [Kokoro-82M](https://github.com/thewh1teagle/kokoro-onnx) (Apache-2.0, no API key). `scripts/tts.py` writes one track per scene to `public/vo/` and the exact timing of every line to `src/content/timeline.json`; scene lengths come from that file.
- **Music & sound effects:** synthesised in code by `scripts/audio.py` (an ambient pad loop, whooshes and a low boom) — no samples, no licences.
- **Fonts:** Fraunces and Inter (SIL Open Font License), bundled in `public/fonts/`.
- **Icons:** [Lucide](https://lucide.dev) (ISC).

## Commands

```bash
npm install
npm run dev          # Remotion Studio: preview the full video or any single scene
npm run render       # → out/IGCSE-Business-Unit1.mp4 (1080p30)
npm run subtitles    # → out/IGCSE-Business-Unit1.srt (for YouTube etc.)
npm run stills -- needs-wants@0.9 mergers@0.5   # quick PNG checks of scenes
```

Changing the narration:

```bash
./scripts/setup-voice.sh   # once: installs Kokoro and downloads the model (~350 MB)
npm run voice              # re-voices only the sentences that changed
```

Set `VOICE` (e.g. `bf_emma` for a British voice) or `SPEED` before `npm run voice` to change the narrator.
To render without burned-in captions: `npx remotion render IGCSEBusinessUnit1 --props='{"captions":false}'`.

Remotion is free for individuals and small teams; see the [Remotion license](https://www.remotion.dev/license).
