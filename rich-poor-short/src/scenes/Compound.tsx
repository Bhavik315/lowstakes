import React from "react";
import { useCurrentFrame } from "remotion";
import { glide, jolt, linear, pop } from "../anim";
import { At, Big, SceneShell } from "../components/Bits";
import { Coin } from "../components/Icons";
import { C } from "../theme";
import { SCENES, T, local } from "../timing";

const L = (f: number) => local("compound", f);
const ROWS = [
  { n: 1, y: 520, size: 124, gap: 0, at: T.money1 },
  { n: 2, y: 690, size: 112, gap: 330, at: T.money2 },
  { n: 4, y: 860, size: 98, gap: 196, at: T.money3 },
  { n: 8, y: 1030, size: 84, gap: 108, at: T.money4 },
];
const xOf = (row: (typeof ROWS)[number], i: number) =>
  540 + (i - (row.n - 1) / 2) * row.gap;

export const Compound: React.FC = () => {
  const frame = useCurrentFrame();
  const slam = pop(frame, L(T.compounding), 0.8);
  const shake = jolt(frame, L(T.compounding), 20);
  const lift = glide(frame, L(T.money1) - 4, 12);

  return (
    <SceneShell durationInFrames={SCENES.compound.durationInFrames}>
      <At x={540} y={470 - 260 * lift} scale={pop(frame, 1)}>
        <Big size={70}>That is</Big>
      </At>
      <At
        x={540 + shake.x}
        y={620 - 290 * lift + shake.y}
        scale={(2.4 - 1.4 * slam) * (1 - 0.14 * lift) * (1 + Math.sin(frame / 5) * 0.012)}
        opacity={Math.min(1, slam * 4)}
      >
        <Big size={112} color={C.yellow} style={{ textShadow: `0 0 80px ${C.yellow}77` }}>
          Compounding
        </Big>
      </At>

      {/* branches: every coin makes two more */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        {ROWS.slice(1).map((row, r) =>
          Array.from({ length: row.n }, (_, i) => {
            const parent = ROWS[r];
            const p = linear(frame, L(row.at) - 3, L(row.at) + 5);
            const x1 = xOf(parent, Math.floor(i / 2));
            const y1 = parent.y;
            return (
              <line
                key={`${r}-${i}`}
                x1={x1}
                y1={y1}
                x2={x1 + (xOf(row, i) - x1) * p}
                y2={y1 + (row.y - y1) * p}
                stroke={C.green}
                strokeWidth={7}
                strokeLinecap="round"
                opacity={p > 0 ? 0.75 : 0}
              />
            );
          }),
        )}
      </svg>
      {ROWS.map((row, r) =>
        Array.from({ length: row.n }, (_, i) => {
          const p = pop(frame, L(row.at) + i * 1.2, 1.2);
          return (
            <At
              key={`${r}-${i}`}
              x={xOf(row, i)}
              y={row.y + Math.sin((frame + i * 9 + r * 5) / 8) * 5}
              scale={p}
            >
              <Coin size={row.size} spin={(frame + i * 11) / 9} />
            </At>
          );
        }),
      )}
    </SceneShell>
  );
};
