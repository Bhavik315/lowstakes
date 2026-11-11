import React from "react";
import { C } from "../theme";

export type Mood = "neutral" | "happy" | "sad" | "shock";

const LOOKS = {
  jake: {
    skin: "#e2a679",
    skinShade: "#c98958",
    hair: "#1d1a22",
    top: C.red,
    topShade: C.redDeep,
  },
  marcus: {
    skin: "#d9996b",
    skinShade: "#bd7d4e",
    hair: "#16151c",
    top: C.green,
    topShade: C.greenDeep,
  },
};

/**
 * Flat SVG bust. `frame` drives the idle motion (breathing, blinking), so the
 * character is never frozen on screen.
 */
export const Character: React.FC<{
  who: "jake" | "marcus";
  mood?: Mood;
  frame: number;
  width?: number;
  style?: React.CSSProperties;
}> = ({ who, mood = "neutral", frame, width = 360, style }) => {
  const look = LOOKS[who];
  const phase = who === "jake" ? 0 : 40;
  const breathe = Math.sin((frame + phase) / 9) * 3;
  const tilt = Math.sin((frame + phase) / 17) * (mood === "sad" ? 1.2 : 2.2);
  const blink = (frame + phase) % 75 < 4 ? 0.12 : 1;
  const eyeR = mood === "shock" ? 13 : 9.5;
  const headDrop = mood === "sad" ? 8 : 0;

  return (
    <svg
      viewBox="0 0 300 360"
      width={width}
      height={width * 1.2}
      style={{ overflow: "visible", ...style }}
    >
      {/* torso */}
      <g transform={`translate(0 ${breathe * 0.4})`}>
        <path
          d="M34 372 L34 306 Q34 238 108 226 L192 226 Q266 238 266 306 L266 372 Z"
          fill={look.top}
        />
        {who === "jake" ? (
          <>
            <path
              d="M112 225 Q150 262 188 225"
              fill="none"
              stroke={look.topShade}
              strokeWidth={12}
              strokeLinecap="round"
            />
            <path d="M78 300 L78 372" stroke={look.topShade} strokeWidth={6} strokeLinecap="round" />
            <path d="M222 300 L222 372" stroke={look.topShade} strokeWidth={6} strokeLinecap="round" />
          </>
        ) : (
          <>
            {/* shirt, tie, lapels */}
            <path d="M112 226 L150 318 L188 226 Z" fill={C.white} />
            <path d="M142 240 L158 240 L164 296 L150 314 L136 296 Z" fill="#14141c" />
            <path d="M108 226 L150 318 L118 372 L96 372 L84 262 Z" fill={look.topShade} />
            <path d="M192 226 L150 318 L182 372 L204 372 L216 262 Z" fill={look.topShade} />
            <circle cx={150} cy={346} r={7} fill="#14141c" />
          </>
        )}
      </g>

      {/* head */}
      <g transform={`translate(0 ${breathe + headDrop}) rotate(${tilt} 150 210)`}>
        <rect x={127} y={176} width={46} height={62} rx={20} fill={look.skinShade} />
        <circle cx={71} cy={130} r={17} fill={look.skinShade} />
        <circle cx={229} cy={130} r={17} fill={look.skinShade} />
        <ellipse cx={150} cy={120} rx={80} ry={88} fill={look.skin} />

        {who === "jake" ? (
          <path
            d="M68 118 Q60 24 150 24 Q240 24 232 118 Q222 78 196 66 Q186 90 160 68 Q140 92 118 66 Q84 76 68 118 Z"
            fill={look.hair}
          />
        ) : (
          <path
            d="M68 112 Q62 20 158 22 Q242 28 232 112 Q226 66 170 58 Q120 54 92 78 Q76 92 68 112 Z"
            fill={look.hair}
          />
        )}

        {/* brows */}
        {mood === "sad" ? (
          <>
            <path d="M100 100 L134 90" stroke={look.hair} strokeWidth={8} strokeLinecap="round" />
            <path d="M200 100 L166 90" stroke={look.hair} strokeWidth={8} strokeLinecap="round" />
          </>
        ) : mood === "shock" ? (
          <>
            <path d="M102 84 Q118 74 134 84" fill="none" stroke={look.hair} strokeWidth={8} strokeLinecap="round" />
            <path d="M166 84 Q182 74 198 84" fill="none" stroke={look.hair} strokeWidth={8} strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M102 96 Q118 88 134 94" fill="none" stroke={look.hair} strokeWidth={8} strokeLinecap="round" />
            <path d="M166 94 Q182 88 198 96" fill="none" stroke={look.hair} strokeWidth={8} strokeLinecap="round" />
          </>
        )}

        {/* eyes */}
        <g transform={`translate(0 124) scale(1 ${blink}) translate(0 -124)`}>
          {mood === "shock" ? (
            <>
              <circle cx={119} cy={124} r={19} fill={C.white} />
              <circle cx={181} cy={124} r={19} fill={C.white} />
            </>
          ) : null}
          <circle cx={119} cy={124} r={eyeR} fill="#15141b" />
          <circle cx={181} cy={124} r={eyeR} fill="#15141b" />
          <circle cx={122} cy={121} r={3} fill={C.white} />
          <circle cx={184} cy={121} r={3} fill={C.white} />
        </g>

        {who === "marcus" ? (
          <g fill="none" stroke={C.white} strokeWidth={6}>
            <rect x={92} y={102} width={52} height={44} rx={14} />
            <rect x={156} y={102} width={52} height={44} rx={14} />
            <path d="M144 120 L156 120" />
          </g>
        ) : null}

        {/* mouth */}
        {mood === "happy" ? (
          <path d="M118 160 Q150 202 182 160 Z" fill={C.white} stroke="#15141b" strokeWidth={5} strokeLinejoin="round" />
        ) : mood === "sad" ? (
          <path d="M124 182 Q150 158 176 182" fill="none" stroke="#15141b" strokeWidth={8} strokeLinecap="round" />
        ) : mood === "shock" ? (
          <ellipse cx={150} cy={176} rx={15} ry={20} fill="#15141b" />
        ) : (
          <path d="M128 170 Q150 180 172 170" fill="none" stroke="#15141b" strokeWidth={8} strokeLinecap="round" />
        )}

        {/* worry drop */}
        {who === "jake" && (mood === "sad" || mood === "shock") ? (
          <path
            d="M236 62 Q250 84 236 92 Q222 84 236 62 Z"
            fill="#6ecbff"
            transform={`translate(0 ${((frame + 10) % 40) * 0.9})`}
            opacity={1 - ((frame + 10) % 40) / 40}
          />
        ) : null}
      </g>
    </svg>
  );
};

export const NameTag: React.FC<{
  name: string;
  color: string;
  style?: React.CSSProperties;
}> = ({ name, color, style }) => (
  <div
    style={{
      padding: "10px 34px 6px",
      borderRadius: 999,
      background: color,
      color: C.bg,
      fontSize: 52,
      fontWeight: 900,
      letterSpacing: 2,
      lineHeight: 1.2,
      ...style,
    }}
  >
    {name}
  </div>
);
