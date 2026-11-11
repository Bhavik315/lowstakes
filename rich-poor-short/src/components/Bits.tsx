import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { glide, linear, pop } from "../anim";
import { C } from "../theme";

/** Absolutely positioned box anchored on its centre, in 1080x1920 space. */
export const At: React.FC<{
  x: number;
  y: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ x, y, scale = 1, rotate = 0, opacity = 1, children, style }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      translate: "-50% -50%",
      scale: String(scale),
      rotate: `${rotate}deg`,
      opacity,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Big: React.FC<{
  size: number;
  color?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ size, color = C.white, children, style }) => (
  <div
    style={{
      fontSize: size,
      fontWeight: 900,
      color,
      lineHeight: 1,
      whiteSpace: "nowrap",
      textTransform: "uppercase",
      textAlign: "center",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Rubber-stamp style label that slams in at frame `at`. */
export const Stamp: React.FC<{
  lines: string[];
  color: string;
  at: number;
  x: number;
  y: number;
  rotate: number;
  size?: number;
}> = ({ lines, color, at, x, y, rotate, size = 62 }) => {
  const frame = useCurrentFrame();
  const p = pop(frame, at, 0.8);
  return (
    <At
      x={x}
      y={y}
      rotate={rotate + (1 - p) * 14}
      scale={2.4 - 1.4 * p}
      opacity={linear(frame, at, at + 3)}
    >
      <div
        style={{
          border: `9px solid ${color}`,
          borderRadius: 22,
          padding: "20px 30px 12px",
          background: "rgba(15,15,20,0.82)",
        }}
      >
        {lines.map((l) => (
          <Big key={l} size={size} color={color} style={{ letterSpacing: 2 }}>
            {l}
          </Big>
        ))}
      </div>
    </At>
  );
};

export const Pill: React.FC<{
  color: string;
  size?: number;
  textColor?: string;
  children: React.ReactNode;
}> = ({ color, size = 52, textColor = C.bg, children }) => (
  <div
    style={{
      background: color,
      color: textColor,
      fontSize: size,
      fontWeight: 900,
      lineHeight: 1.2,
      padding: `${size * 0.2}px ${size * 0.6}px ${size * 0.1}px`,
      borderRadius: 999,
      whiteSpace: "nowrap",
      textTransform: "uppercase",
    }}
  >
    {children}
  </div>
);

/**
 * Wraps a scene: quick punch-in, quick punch-out, and a slow push-in for the
 * whole time in between so no frame is ever static.
 */
export const SceneShell: React.FC<{
  durationInFrames: number;
  from?: "left" | "right" | "bottom" | "zoom";
  children: React.ReactNode;
}> = ({ durationInFrames, from = "zoom", children }) => {
  const frame = useCurrentFrame();
  const enter = glide(frame, 0, 9);
  const exit = linear(frame, durationInFrames - 4, durationInFrames);
  const drift = 1 + 0.035 * (frame / durationInFrames);
  const dx = from === "left" ? -140 : from === "right" ? 140 : 0;
  const dy = from === "bottom" ? 160 : 0;
  const zoom = from === "zoom" ? 0.86 + 0.14 * enter : 1;
  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(1, linear(frame, 0, 3)) * (1 - exit),
        translate: `${dx * (1 - enter)}px ${dy * (1 - enter)}px`,
        scale: String(zoom * drift * (1 + exit * 0.1)),
        transformOrigin: "50% 38%",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
