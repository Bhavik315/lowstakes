import * as Lucide from "lucide-react";
import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { CLAMP, EASE, prog } from "../lib/anim";
import { alpha, INK, MUTED, SANS, SERIF } from "../lib/theme";

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export const Icon: React.FC<{ name: string; size?: number; color?: string; stroke?: number }> = ({
  name,
  size = 48,
  color = INK,
  stroke = 1.75,
}) => {
  const C = (Lucide as unknown as Record<string, IconComponent>)[name] ?? Lucide.Circle;
  return <C size={size} color={color} strokeWidth={stroke} />;
};

/** Round, softly lit icon medallion. */
export const IconBadge: React.FC<{ name: string; color: string; size?: number; glow?: number }> = ({
  name,
  color,
  size = 96,
  glow = 0,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: `radial-gradient(circle at 30% 25%, ${alpha(color, 0.38)}, ${alpha(color, 0.1)} 70%)`,
      border: `1.5px solid ${alpha(color, 0.55)}`,
      boxShadow: `0 0 ${20 + glow * 40}px ${alpha(color, 0.15 + glow * 0.35)}, inset 0 1px 0 rgba(255,255,255,0.18)`,
    }}
  >
    <Icon name={name} size={size * 0.5} color={color} />
  </div>
);

/** Fade + rise (+ slight de-blur) entrance, driven by the frame. */
export const Reveal: React.FC<{
  at: number;
  dur?: number;
  dy?: number;
  dx?: number;
  scale?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ at, dur = 22, dy = 40, dx = 0, scale = false, style, children }) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, dur);
  const fill = style?.height !== undefined ? "100%" : undefined;
  // Flex layout set on the Reveal applies to its children, so mirror it on the animated wrapper.
  const layout: React.CSSProperties = style?.display
    ? {
        display: style.display,
        flexDirection: style.flexDirection,
        justifyContent: style.justifyContent,
        alignItems: style.alignItems,
        flexWrap: style.flexWrap,
        gap: style.gap,
        width: "100%",
      }
    : {};
  return (
    <div style={style}>
      <div
        style={{
          ...layout,
          height: fill,
          opacity: p,
          translate: p < 1 ? `${(1 - p) * dx}px ${(1 - p) * dy}px` : undefined,
          scale: scale && p < 1 ? String(0.9 + 0.1 * p) : undefined,
          filter: p > 0 && p < 1 ? `blur(${(1 - p) * 10}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Glass card that lights up in the accent colour when it is in the spotlight. */
export const Card: React.FC<{
  accent: string;
  active?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ accent, active = 0, style, children }) => (
  <div
    style={{
      position: "relative",
      borderRadius: 28,
      background: `linear-gradient(165deg, rgba(255,255,255,${0.075 + active * 0.03}), rgba(255,255,255,0.02))`,
      border: `1.5px solid ${active > 0.01 ? alpha(accent, 0.25 + active * 0.5) : "rgba(255,255,255,0.10)"}`,
      boxShadow: `0 30px 70px rgba(0,0,0,0.45), 0 0 ${active * 70}px ${alpha(accent, active * 0.22)}`,
      scale: String(1 + active * 0.025),
      ...style,
    }}
  >
    {children}
  </div>
);

/** Scene heading: chapter kicker + serif title with a drawn underline. */
export const Heading: React.FC<{
  kicker: string;
  title: string;
  color: string;
  at?: number;
  center?: boolean;
  size?: number;
}> = ({ kicker, title, color, at = 0, center = false, size = 76 }) => {
  const frame = useCurrentFrame();
  const line = prog(frame, at + 8, 40);
  return (
    <div
      style={{
        position: "absolute",
        top: 92,
        left: 120,
        right: 120,
        display: "flex",
        flexDirection: "column",
        alignItems: center ? "center" : "flex-start",
        textAlign: center ? "center" : "left",
      }}
    >
      <Reveal at={at} dy={16}>
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color,
            marginBottom: 14,
          }}
        >
          {kicker}
        </div>
      </Reveal>
      <Reveal at={at + 4} dy={30}>
        <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: size, color: INK, lineHeight: 1.05, letterSpacing: "-0.01em" }}>
          {title}
        </div>
      </Reveal>
      <div
        style={{
          marginTop: 22,
          height: 3,
          width: 220 * line,
          borderRadius: 3,
          background: `linear-gradient(90deg, ${color}, ${alpha(color, 0)})`,
        }}
      />
    </div>
  );
};

/** A highlighted takeaway strip that sweeps in. */
export const Banner: React.FC<{ text: string; at: number; color: string; style?: React.CSSProperties }> = ({
  text,
  at,
  color,
  style,
}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, 26);
  const sweep = interpolate(frame, [at + 6, at + 46], [-30, 130], { ...CLAMP, easing: EASE });
  if (p <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        translate: `-50% ${(1 - p) * 30}px`,
        opacity: p,
        padding: "16px 44px",
        borderRadius: 999,
        background: `linear-gradient(90deg, ${alpha(color, 0.2)}, ${alpha(color, 0.32)}, ${alpha(color, 0.2)})`,
        border: `1.5px solid ${alpha(color, 0.7)}`,
        boxShadow: `0 0 60px ${alpha(color, 0.3)}`,
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: 40,
        color: INK,
        whiteSpace: "nowrap",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(100deg, transparent ${sweep - 20}%, rgba(255,255,255,0.35) ${sweep}%, transparent ${sweep + 20}%)`,
        }}
      />
      <span style={{ position: "relative" }}>{text}</span>
    </div>
  );
};

export const Sub: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ fontFamily: SANS, fontSize: 32, fontWeight: 500, color: MUTED, lineHeight: 1.3, ...style }}>{children}</div>
);

export const Label: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({
  children,
  size = 44,
  style,
}) => (
  <div style={{ fontFamily: SANS, fontSize: size, fontWeight: 700, color: INK, lineHeight: 1.15, letterSpacing: "-0.01em", ...style }}>
    {children}
  </div>
);
