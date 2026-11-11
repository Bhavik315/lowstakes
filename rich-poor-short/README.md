# Why do the rich get richer? — YouTube Short

A vertical Short (1080×1920, 30 fps) built with [Remotion](https://www.remotion.dev).
Two flat SVG characters, Jake (red, spends first) and Marcus (green, invests first),
explain compounding. The last line ("...the next time someone asks you...") runs straight
back into the opening question, so the video loops.

## Render

```bash
npm install
npx remotion render Short out/short.mp4
```

Preview and scrub in the Studio with `npm run dev`. Each scene is also registered on its
own under the **Scenes** folder.

## Change the script

Everything is timed from the voiceover, so a new script needs no manual re-timing of
captions. Scene cues are looked up by spoken word in `src/timing.ts`; if you remove a
word a cue depends on, the build fails and names the missing cue.

```bash
pip install -r requirements.txt
python3 scripts/generate_voiceover.py   # script.txt -> voiceover + word timings
python3 scripts/generate_audio.py       # beat (same length as the video) + sound effects
npx remotion render Short out/short.mp4
```

1. Edit `script.txt`. Write numbers as words (`five thousand dollars`) so the voice reads
   them correctly; `DISPLAY` in `scripts/generate_voiceover.py` maps them to what the
   caption shows (`$5,000`).
2. `generate_voiceover.py` calls edge-tts (`en-US-ChristopherNeural`, rate `+10%`), reads
   the word-boundary events, trims the long pauses the voice leaves between sentences,
   and writes `public/voiceover.wav`, `src/data/words.json` and `src/data/captions.json`.
3. `generate_audio.py` synthesizes the lo-fi beat and the whoosh / pop / ding / impact
   effects with numpy. Nothing is sampled, so there is nothing to license.

## Where things live

| Path | What |
| --- | --- |
| `script.txt` | Voiceover script |
| `src/timing.ts` | Word cues, scene boundaries, camera-punch frames |
| `src/Short.tsx` | Main composition: background, scenes, captions, audio |
| `src/scenes/` | One file per scene |
| `src/components/Captions.tsx` | Word-by-word captions, current word in yellow |
| `src/components/Character.tsx` | Jake and Marcus |
| `src/components/Soundtrack.tsx` | Voice, beat and every sound-effect hit |

## The numbers

Illustrative, not advice: $1,000 a month for 10 years at an assumed 12% a year
(compounded monthly) comes to about $230,000 on $120,000 paid in. At that rate the
first $50,000 of that total takes about 40 months and the last $50,000 of it about
16 — real returns vary and are not guaranteed. The on-screen footnote in the growth
scene states the assumption.

Font: Poppins (SIL Open Font License), bundled in `public/fonts`.
