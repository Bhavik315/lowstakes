import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C } from "../theme";
import { SCENES, SceneName } from "../timing";

// How strongly each scene leans red (Jake) or green (Marcus).
const TINT: Record<SceneName, [red: number, green: number]> = {
  hook: [0.7, 0.7],
  meet: [0.6, 0.6],
  spend: [1, 0.1],
  bank: [1, 0.1],
  invest: [0.1, 1],
  later: [1, 0.1],
  grow: [0.1, 1],
  compound: [0.15, 1],
  faster: [0.15, 1],
  flow: [0.8, 0.8],
  outro: [0.3, 0.9],
};

const names = Object.keys(SCENES) as SceneName[];

export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const idx = Math.max(
    0,
    names.findIndex(
      (n) =>
        frame >= SCENES[n].from &&
        frame < SCENES[n].from + SCENES[n].durationInFrames,
    ),
  );
  const cur = TINT[names[idx]];
  const prev = TINT[names[Math.max(0, idx - 1)]];
  const mix = interpolate(frame - SCENES[names[idx]].from, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const red = prev[0] + (cur[0] - prev[0]) * mix;
  const green = prev[1] + (cur[1] - prev[1]) * mix;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      {/* drifting dot grid */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.075) 2.5px, transparent 3px)",
          backgroundSize: "60px 60px",
          backgroundPosition: `${frame * 0.5}px ${-frame * 0.9}px`,
        }}
      />
      {/* red glow, top left */}
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          left: -420 + Math.sin(frame / 37) * 70,
          top: -260 + Math.cos(frame / 45) * 80,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.red} 0%, transparent 62%)`,
          opacity: 0.2 * red,
        }}
      />
      {/* green glow, bottom right */}
      <div
        style={{
          position: "absolute",
          width: 1300,
          height: 1300,
          left: 260 + Math.cos(frame / 41) * 80,
          top: 620 + Math.sin(frame / 33) * 90,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.green} 0%, transparent 62%)`,
          opacity: 0.17 * green,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(8,8,12,0.75) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
