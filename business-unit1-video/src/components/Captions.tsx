import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { SCENES } from "../content/script";
import { CLAMP } from "../lib/anim";
import { FPS, SANS } from "../lib/theme";
import { leadFor, SCENE_STARTS, TIMELINE } from "../lib/timing";

type Chunk = { text: string; start: number; end: number };

const MAX_CHARS = 84;

/** Break a long sentence into readable caption chunks, timed by character count. */
const chunk = (text: string, start: number, end: number): Chunk[] => {
  if (text.length <= MAX_CHARS) return [{ text, start, end }];
  const words = text.split(" ");
  const n = Math.ceil(text.length / MAX_CHARS);
  const target = text.length / n;
  const pieces: string[] = [];
  let cur = "";
  words.forEach((w, i) => {
    const next = cur ? `${cur} ${w}` : w;
    const remaining = words.length - i;
    const breakHere =
      cur.length >= target * 0.6 && (/[,:;]$/.test(cur) || next.length > target * 1.15) && remaining > 2;
    if (breakHere && pieces.length < n - 1) {
      pieces.push(cur);
      cur = w;
    } else cur = next;
  });
  if (cur) pieces.push(cur);
  const total = pieces.reduce((s, p) => s + p.length, 0);
  let t = start;
  return pieces.map((p) => {
    const d = ((end - start) * p.length) / total;
    const c = { text: p, start: t, end: t + d };
    t += d;
    return c;
  });
};

const CHUNKS: Chunk[] = (() => {
  const out: Chunk[] = [];
  SCENES.forEach((scene, i) => {
    const base = SCENE_STARTS[i] + leadFor(scene);
    TIMELINE.scenes[scene.id].lines.forEach((line) =>
      line.parts.forEach((p) => out.push(...chunk(p.text, base + p.start * FPS, base + p.end * FPS))),
    );
  });
  return out;
})();

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = CHUNKS.findIndex((c, i) => {
    const next = CHUNKS[i + 1];
    const until = next ? Math.min(c.end + 18, next.start) : c.end + 18;
    return frame >= c.start - 2 && frame < until;
  });
  if (idx < 0) return null;
  const c = CHUNKS[idx];
  const next = CHUNKS[idx + 1];
  const until = next ? Math.min(c.end + 18, next.start) : c.end + 18;
  const gapToNext = next ? next.start - c.end : 99;
  const fadeOut = gapToNext > 10 ? interpolate(frame, [until - 6, until], [1, 0], CLAMP) : 1;
  const fadeIn = interpolate(frame, [c.start - 2, c.start + 3], [0, 1], CLAMP);
  return (
    <div
      style={{
        position: "absolute",
        bottom: 46,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity: Math.min(fadeIn, fadeOut),
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          padding: "12px 28px",
          borderRadius: 14,
          background: "rgba(4, 6, 13, 0.72)",
          border: "1px solid rgba(255,255,255,0.08)",
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: 36,
          lineHeight: 1.3,
          color: "#F4F1EA",
          textAlign: "center",
        }}
      >
        {c.text}
      </div>
    </div>
  );
};
