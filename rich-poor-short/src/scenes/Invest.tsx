import React from "react";
import { useCurrentFrame } from "remotion";
import { usd, linear, pop } from "../anim";
import { At, Big, SceneShell, Stamp } from "../components/Bits";
import { Character } from "../components/Character";
import { C } from "../theme";
import { SCENES, T, local } from "../timing";

const L = (f: number) => local("invest", f);
const MONTHS = "JFMAMJJASOND".split("");
// index-fund line: wobbly but clearly up and to the right
const LINE: [number, number][] = [
  [0, 150], [70, 128], [130, 138], [200, 104], [270, 116], [340, 82],
  [420, 92], [500, 58], [580, 66], [660, 34], [740, 40], [820, 8],
];
const PATH = LINE.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
const LENGTH = 880;

export const Invest: React.FC = () => {
  const frame = useCurrentFrame();
  const count = linear(frame, L(T.oneK), L(T.oneK) + 18);
  const amount = pop(frame, L(T.oneK));
  const draw = linear(frame, L(T.into), L(T.into) + 34);
  const panel = pop(frame, L(T.into) - 3, 0.6);

  return (
    <SceneShell durationInFrames={SCENES.invest.durationInFrames} from="right">
      <At x={290} y={500}>
        <Character
          who="marcus"
          frame={frame}
          width={400}
          mood={frame >= L(T.oneK) ? "happy" : "neutral"}
        />
      </At>

      <Stamp lines={["Invests", "first"]} color={C.green} at={L(T.invests)} x={770} y={360} rotate={6} />

      <At x={770} y={600} scale={amount * (1 + 0.1 * (1 - pop(frame, L(T.oneK) + 18, 1.3)))}>
        <Big size={108} color={C.green} style={{ textShadow: `0 0 60px ${C.green}66` }}>
          {usd(1000 * count)}
        </Big>
      </At>
      <At x={770} y={700} scale={pop(frame, L(T.every))}>
        <Big size={50}>every month</Big>
      </At>

      {/* twelve months ticking off */}
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 800,
          width: 900,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        {MONTHS.map((m, i) => {
          const on = pop(frame, L(T.every) + 2 + i * 2.2, 1.2);
          return (
            <div
              key={i}
              style={{
                width: 62,
                height: 62,
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 34,
                fontWeight: 900,
                lineHeight: 1,
                paddingTop: 4,
                color: on > 0.5 ? C.bg : C.muted,
                background: on > 0.5 ? C.green : C.panel,
                border: `3px solid ${on > 0.5 ? C.green : C.line}`,
                scale: String(1 + 0.35 * Math.sin(Math.min(1, on) * Math.PI)),
              }}
            >
              {m}
            </div>
          );
        })}
      </div>

      {/* index fund chart */}
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 900,
          width: 900,
          height: 230,
          borderRadius: 28,
          background: C.panel,
          border: `3px solid ${C.line}`,
          scale: String(panel),
          opacity: Math.min(1, panel * 2),
          overflow: "hidden",
        }}
      >
        <Big
          size={40}
          color={C.muted}
          style={{ position: "absolute", left: 30, top: 24, letterSpacing: 2 }}
        >
          Index fund
        </Big>
        <svg width={900} height={230} style={{ position: "absolute", inset: 0 }}>
          <g transform="translate(40 44)">
            <path
              d={PATH}
              fill="none"
              stroke={C.green}
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={LENGTH}
              strokeDashoffset={LENGTH * (1 - draw)}
            />
            <circle
              cx={LINE[Math.min(11, Math.floor(draw * 11))][0]}
              cy={LINE[Math.min(11, Math.floor(draw * 11))][1]}
              r={draw > 0 ? 16 + Math.sin(frame / 3) * 3 : 0}
              fill={C.white}
            />
          </g>
        </svg>
      </div>
    </SceneShell>
  );
};
