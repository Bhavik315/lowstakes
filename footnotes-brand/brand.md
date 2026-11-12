# Footnotes — Brand Guide

Faceless animated story Shorts about the surprising, little-known stories
behind history, money, psychology and how the world works. Editorial,
premium, slightly playful — a classic book publisher crossed with a modern
YouTube channel. Never childish, never generic-AI-looking.

**Tagline:** The stories history left out.

## Colour

| Name | Hex | Use |
|---|---|---|
| Paper (cream) | `#F6EEDC` | Primary background / surface |
| Ink | `#1E1A16` | Primary text, logo mark, dark surfaces |
| Mustard (accent) | `#F2B33D` | The footnote-marker accent. Pills, the superscript "1", small highlights |
| Brick (secondary accent) | `#C8452C` | Optional, rare use only — alternate highlight, never alongside mustard in the same element |

Max 3–4 colours in any single asset. Default to cream + ink + mustard.
Brick is a reserve accent for variety across thumbnails/titles — don't mix
it with mustard in the same composition.

## Typography

- **Display / wordmark — Fraunces** (variable, Google Fonts, SOFT/WONK/opsz
  axes). Use high `opsz` (100–144) and weight 800–900 for the wordmark,
  logo "F" and any large editorial headline. Italic styles (weight ~500,
  `opsz` ~40) are used for the tagline and small "margin note" decoration.
- **Text / UI — Inter** (variable, Google Fonts). Used for taglines on UI
  chrome, pills, captions and any small/body text. Semibold–Bold for
  labels and pills, uppercase with ~0.08em letter-spacing.

Font files (OFL-licensed) are in `/fonts`. Always download from
`github.com/google/fonts` (ofl/fraunces, ofl/inter) to stay in sync with
upstream.

## Logo

Chosen concept: **Monogram** — a bold serif "F" (Fraunces, weight 900) with
a superscript "1" footnote marker in mustard. The footnote marker is the
channel's core visual idea: this mark should appear, in some form, on
every thumbnail or end card.

- `logo.svg` / `logo_800.png` — primary lockup: cream background, ink "F",
  mustard "1". This is the channel-icon/avatar file; YouTube crops it to a
  circle, so the mark is already composed to read clearly once cropped.
- `watermark_150.png` — transparent background, ink mark with a thin cream
  outline so it stays legible over both light and dark video footage. Use
  this for the in-video Shorts watermark.

### Usage rules

- **Never redraw the mark thinner.** It must stay bold/high-contrast —
  YouTube shows it as a 98×98 circle, where thin strokes disappear.
- Minimum clear space around the mark: ~10% of its width on all sides.
- On dark backgrounds, use the inverted lockup (cream "F" on ink) or the
  transparent watermark version — never place the cream-background
  `logo_800.png` directly on a dark page edge-to-edge without its own
  background square/circle.
- Don't recolor the "F" — it is always ink (or cream, when inverted on a
  dark surface). Only the "1" may ever change to brick as a rare variant;
  it defaults to mustard.
- Don't add drop shadows, outlines, gradients or bevels to the mark beyond
  what's defined here.

## Banner

`banner.jpg` (2560×1440). All critical content (logo, wordmark, tagline,
"NEW SHORTS EVERY WEEK" pill) sits inside the centre safe area —
1546×423px, x 507–2053 / y 508–931 — which is what survives the crop to
mobile. Outside that box is decorative only: faint paper grain, small
footnote marks (*, †, ¹, ²), thin rule lines and faint italic "margin
notes." Never put required text/logo outside the safe box.

## End screen card

`end_screen_card.png` (1080×1920), ink background, cream logo chip,
"Follow for more footnotes" in Fraunces with "footnotes" set in mustard,
"NEW SHORTS EVERY WEEK" in small Inter caps underneath. Use at the end of
Shorts as a static follow card.

## Voice of the brand (visual)

- Flat, clean compositions. Subtle paper-grain texture is fine; no
  gradients that look "cheap," no stock clip-art or icon packs.
  Everything should feel like it could sit on a book jacket.
- The footnote motif (*, †, ¹, ²) is the channel's recurring visual
  device — use it sparingly as texture/decoration around the edges of
  thumbnails and end cards, never as the main subject on its own.
