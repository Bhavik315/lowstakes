import React from "react";
import data from "../data/words.json";
import { jolt, pop } from "../anim";
import { C } from "../theme";
import { FPS } from "../timing";

// The first sentence of the voiceover, laid out as a poster.
const LINES: { words: number[]; size: number }[] = [
  { words: [0, 1, 2], size: 100 }, // WHY DO THE
  { words: [3, 4], size: 150 }, // RICH GET
  { words: [5], size: 170 }, // RICHER
  { words: [6, 7], size: 100 }, // AND THE
  { words: [8, 9], size: 150 }, // POOR GET
  { words: [10], size: 150 }, // POORER? (smaller on purpose)
];
const TONE: Record<number, string> = {
  3: C.green,
  5: C.green,
  8: C.red,
  10: C.red,
};

const frameOf = (i: number) =>
  Math.round((data.words[i].startMs / 1000) * FPS);

/**
 * `frame` is the hook-scene frame. Before a word is spoken it is white; the
 * word being spoken flashes yellow; rich/poor words keep their colour.
 * Passing a negative frame gives the untouched all-white poster, which is what
 * the outro lands on so the video loops cleanly.
 */
export const HookQuestion: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      {LINES.map((line, li) => (
        <div key={li} style={{ display: "flex", gap: line.size * 0.26 }}>
          {line.words.map((wi) => {
            const start = frameOf(wi);
            const end = wi < 10 ? frameOf(wi + 1) : start + 16;
            const spoken = frame >= start;
            const active = spoken && frame < end;
            const tone = TONE[wi];
            const hit = pop(frame, start, 1.2);
            const shake = wi === 10 ? jolt(frame, start, 16) : { x: 0, y: 0 };
            return (
              <span
                key={wi}
                style={{
                  display: "inline-block",
                  fontSize: line.size,
                  fontWeight: 900,
                  lineHeight: 0.98,
                  textTransform: "uppercase",
                  color: spoken ? (tone ?? (active ? C.yellow : C.white)) : C.white,
                  textShadow: spoken && tone ? `0 0 60px ${tone}66` : "none",
                  scale: String(spoken ? 1 + (tone ? 0.22 : 0.1) * (1 - hit) : 1),
                  translate: `${shake.x}px ${shake.y}px`,
                }}
              >
                {data.words[wi].text + (wi === 10 ? "?" : "")}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
