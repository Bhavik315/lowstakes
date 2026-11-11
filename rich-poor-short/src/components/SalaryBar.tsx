import React from "react";
import { interpolateColors } from "remotion";
import { usd } from "../anim";
import { C } from "../theme";
import { Big } from "./Bits";

/** Jake's salary draining away. `level` is 1 (full) to 0 (empty). */
export const SalaryBar: React.FC<{ level: number; scale?: number }> = ({
  level,
  scale = 1,
}) => {
  const color = interpolateColors(level, [0, 0.35, 0.8], [C.red, C.yellow, C.white]);
  return (
    <div
      style={{
        position: "absolute",
        left: 90,
        top: 170,
        width: 900,
        scale: String(scale),
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Big size={42} color={C.muted} style={{ letterSpacing: 2 }}>
          Jake&apos;s salary
        </Big>
        <Big size={70} color={color}>
          {usd(5000 * level)}
        </Big>
      </div>
      <div
        style={{
          marginTop: 14,
          height: 46,
          borderRadius: 23,
          background: C.panel,
          border: `3px solid ${C.line}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${level * 100}%`,
            height: "100%",
            borderRadius: 23,
            background: color,
          }}
        />
      </div>
    </div>
  );
};
