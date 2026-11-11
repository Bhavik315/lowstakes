import React from "react";
import { C } from "../theme";

type IconProps = { size?: number; style?: React.CSSProperties };

export const Coin: React.FC<IconProps & { spin?: number }> = ({
  size = 100,
  style,
  spin = 0,
}) => (
  <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: "visible", ...style }}>
    <g transform={`translate(50 50) scale(${Math.cos(spin) * 0.25 + 0.75} 1) translate(-50 -50)`}>
      <circle cx={50} cy={50} r={48} fill={C.goldDeep} />
      <circle cx={50} cy={47} r={46} fill={C.gold} />
      <circle cx={50} cy={47} r={35} fill="none" stroke={C.goldDeep} strokeWidth={4} opacity={0.55} />
      <text
        x={50}
        y={66}
        textAnchor="middle"
        fontSize={54}
        fontWeight={900}
        fill="#7a4f00"
      >
        ₹
      </text>
    </g>
  </svg>
);

export const Phone: React.FC<IconProps> = ({ size = 200, style }) => (
  <svg viewBox="0 0 120 200" width={size * 0.6} height={size} style={style}>
    <rect x={4} y={4} width={112} height={192} rx={22} fill="#2c2c3d" stroke={C.white} strokeWidth={6} />
    <rect x={16} y={18} width={88} height={150} rx={10} fill="#4d7cff" />
    <path d="M16 110 L50 70 L78 104 L104 82 L104 158 Q104 168 94 168 L26 168 Q16 168 16 158 Z" fill="#7fa2ff" />
    <circle cx={76} cy={52} r={12} fill={C.yellow} />
    <rect x={44} y={178} width={32} height={7} rx={3.5} fill={C.white} />
  </svg>
);

export const CreditCard: React.FC<IconProps> = ({ size = 300, style }) => (
  <svg viewBox="0 0 300 190" width={size} height={size * 0.633} style={style}>
    <rect x={4} y={4} width={292} height={182} rx={24} fill="#7b3ff2" stroke={C.white} strokeWidth={6} />
    <path d="M4 120 Q150 60 296 130 L296 162 Q296 186 272 186 L28 186 Q4 186 4 162 Z" fill="#5a25c9" />
    <rect x={30} y={44} width={58} height={44} rx={9} fill={C.gold} />
    <path d="M30 66 L88 66 M59 44 L59 88" stroke={C.goldDeep} strokeWidth={4} />
    <g fill={C.white}>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={30 + i * 62} y={128} width={48} height={14} rx={7} opacity={0.9} />
      ))}
    </g>
  </svg>
);

export const Bank: React.FC<IconProps> = ({ size = 300, style }) => (
  <svg viewBox="0 0 300 280" width={size} height={size * 0.933} style={style}>
    <path d="M150 10 L290 92 L10 92 Z" fill={C.white} />
    <circle cx={150} cy={62} r={17} fill={C.bg} />
    <rect x={22} y={100} width={256} height={22} rx={6} fill="#cfd0e0" />
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={40 + i * 62} y={130} width={36} height={104} rx={8} fill={C.white} />
    ))}
    <rect x={14} y={240} width={272} height={32} rx={8} fill={C.white} />
  </svg>
);

export const Arrow: React.FC<IconProps & { color: string; down?: boolean }> = ({
  size = 160,
  color,
  down,
  style,
}) => (
  <svg
    viewBox="0 0 100 140"
    width={size * 0.714}
    height={size}
    style={{ rotate: down ? "180deg" : "0deg", ...style }}
  >
    <path d="M50 4 L96 58 L68 58 L68 136 L32 136 L32 58 L4 58 Z" fill={color} />
  </svg>
);

export const LoanTag: React.FC<{ label: string; style?: React.CSSProperties }> = ({
  label,
  style,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 18,
      padding: "14px 30px 10px 22px",
      borderRadius: 18,
      background: C.red,
      color: C.white,
      fontSize: 46,
      fontWeight: 900,
      lineHeight: 1.2,
      boxShadow: `0 10px 0 ${C.redDeep}`,
      ...style,
    }}
  >
    <svg viewBox="0 0 40 40" width={40} height={40}>
      <circle cx={20} cy={20} r={18} fill={C.white} />
      <path d="M20 9 L20 23" stroke={C.red} strokeWidth={6} strokeLinecap="round" />
      <circle cx={20} cy={31} r={3.5} fill={C.red} />
    </svg>
    {label}
  </div>
);

/** A little plant; `grow` 0..1 scales the stem and leaves in. */
export const Sprout: React.FC<IconProps & { grow: number }> = ({
  size = 300,
  grow,
  style,
}) => {
  const g = Math.max(0, Math.min(1.2, grow));
  return (
    <svg viewBox="0 0 300 300" width={size} height={size} style={{ overflow: "visible", ...style }}>
      <ellipse cx={150} cy={278} rx={110} ry={20} fill="#4a3424" />
      <g transform={`translate(150 276) scale(${0.35 + g * 0.65}) translate(-150 -276)`}>
        <path d="M150 276 Q146 190 150 110" fill="none" stroke={C.green} strokeWidth={14} strokeLinecap="round" />
        <path d="M150 190 Q84 190 70 126 Q138 118 150 190 Z" fill={C.green} />
        <path d="M150 150 Q216 150 232 84 Q164 78 150 150 Z" fill={C.greenDeep} />
        <path d="M150 112 Q110 96 110 50 Q150 60 150 112 Z" fill={C.green} />
      </g>
    </svg>
  );
};
