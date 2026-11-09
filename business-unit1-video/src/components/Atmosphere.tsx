import React from "react";
import { AbsoluteFill, Img, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { paletteAt } from "../lib/timing";
import { alpha, BG } from "../lib/theme";

/** Continuous backdrop behind every scene: drifting light, a dot grid and floating dust. */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const { color, glow } = paletteAt(frame);
  const t = frame / 30;
  const ax = 22 + Math.sin(t * 0.09) * 10;
  const ay = 18 + Math.cos(t * 0.07) * 8;
  const bx = 80 + Math.cos(t * 0.06) * 8;
  const by = 85 + Math.sin(t * 0.08) * 8;

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 80% at ${ax}% ${ay}%, ${alpha(rgbToHex(glow), 0.55)}, transparent 70%),
            radial-gradient(ellipse 60% 70% at ${bx}% ${by}%, ${alpha(rgbToHex(glow), 0.4)}, transparent 70%),
            radial-gradient(ellipse 50% 40% at 50% 110%, ${alpha(rgbToHex(color), 0.1)}, transparent 70%),
            linear-gradient(180deg, #070A16 0%, #04060D 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1.4px, transparent 1.6px)",
          backgroundSize: "56px 56px",
          backgroundPosition: `${(t * 4) % 56}px ${(t * 2) % 56}px`,
          maskImage: "radial-gradient(ellipse 75% 70% at 50% 45%, black 10%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse 75% 70% at 50% 45%, black 10%, transparent 80%)",
          opacity: 0.6,
        }}
      />
      <Dust color={rgbToHex(color)} />
    </AbsoluteFill>
  );
};

const Dust: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      {new Array(46).fill(0).map((_, i) => {
        const speed = 0.25 + random(`s${i}`) * 0.6;
        const size = 2 + random(`z${i}`) * 4;
        const x = random(`x${i}`) * width + Math.sin(frame / 90 + i) * 24;
        const span = height + 80;
        const y = (((random(`y${i}`) * span - frame * speed) % span) + span) % span - 40;
        const tint = i % 3 === 0 ? color : "#FFFFFF";
        const o = 0.12 + random(`o${i}`) * 0.35;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: size,
              background: tint,
              opacity: o,
              boxShadow: `0 0 ${size * 3}px ${tint}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Film grain, vignette and a hairline progress bar on top of everything. */
export const Finish: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  const { color } = paletteAt(frame);
  // A fixed grain texture: it adds film-like texture and breaks up gradient banding,
  // without the bitrate cost of a grain that changes every frame.
  const ox = 0;
  const oy = 0;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ overflow: "hidden", opacity: 0.05, mixBlendMode: "overlay" }}>
        <div style={{ position: "absolute", left: -ox, top: -oy, display: "grid", gridTemplateColumns: "repeat(8, 320px)" }}>
          {new Array(32).fill(0).map((_, i) => (
            <Img key={i} src={staticFile("grain.png")} style={{ width: 320, height: 320, display: "block" }} />
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse 85% 80% at 50% 48%, transparent 55%, rgba(0,0,0,0.62) 100%)" }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 4,
          width: `${(frame / Math.max(1, total - 1)) * 100}%`,
          background: `linear-gradient(90deg, ${alpha(rgbToHex(color), 0.2)}, ${rgbToHex(color)})`,
          boxShadow: `0 0 12px ${rgbToHex(color)}`,
        }}
      />
    </AbsoluteFill>
  );
};

/** interpolateColors returns rgba(); convert back to hex so alpha() can be appended. */
export function rgbToHex(c: string) {
  if (c.startsWith("#")) return c.slice(0, 7);
  const m = c.match(/[\d.]+/g);
  if (!m) return "#ffffff";
  return `#${m
    .slice(0, 3)
    .map((v) => Math.round(Number(v)).toString(16).padStart(2, "0"))
    .join("")}`;
}
