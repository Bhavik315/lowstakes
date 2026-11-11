import React from "react";
import { useCurrentFrame } from "remotion";
import { glide, jolt, linear, pop } from "../anim";
import { At, Big, Pill, SceneShell } from "../components/Bits";
import { Coin } from "../components/Icons";
import { C } from "../theme";
import { SCENES, T, local } from "../timing";

const L = (f: number) => local("faster", f);
const TRACK = { left: 90, width: 900 };
// first $50,000: ~40 months, latest $50,000: ~16 months
const SHARE_LATEST = 16.3 / 40.4;

const Row: React.FC<{
  y: number;
  title: string;
  result: string;
  color: string;
  enter: number;
  pulseAt: number;
  fill: number;
  resultAt: number;
  resultSize: number;
}> = ({ y, title, result, color, enter, pulseAt, fill, resultAt, resultSize }) => {
  const frame = useCurrentFrame();
  const shake = jolt(frame, pulseAt, 12);
  const pulse = 1 + 0.16 * (1 - pop(frame, pulseAt, 1.3)) * (frame >= pulseAt ? 1 : 0);
  const resultShake = jolt(frame, resultAt, 10);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: TRACK.left + shake.x,
          top: y + shake.y,
          transformOrigin: "0% 100%",
          scale: String(enter * pulse),
        }}
      >
        <Big size={54} color={color} style={{ textTransform: "none", textAlign: "left" }}>
          {title}
        </Big>
      </div>
      <div
        style={{
          position: "absolute",
          right: 1080 - TRACK.left - TRACK.width - resultShake.x,
          top: y - (resultSize - 54) + resultShake.y,
          transformOrigin: "100% 100%",
          scale: String(pop(frame, resultAt)),
        }}
      >
        <Big size={resultSize} color={color} style={{ textAlign: "right" }}>
          {result}
        </Big>
      </div>
      <div
        style={{
          position: "absolute",
          left: TRACK.left,
          top: y + 78,
          width: TRACK.width,
          height: 60,
          borderRadius: 30,
          background: C.panel,
          border: `3px solid ${C.line}`,
          scale: String(enter),
        }}
      >
        <div
          style={{
            width: Math.max(60, TRACK.width * fill) - 6,
            height: 54,
            borderRadius: 27,
            background: color,
            opacity: fill > 0 ? 1 : 0,
          }}
        />
      </div>
      <At x={TRACK.left + Math.max(30, TRACK.width * fill - 30)} y={y + 108} scale={fill > 0 ? enter : 0}>
        <Coin size={92} spin={frame / 3} />
      </At>
    </>
  );
};

export const Faster: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = glide(frame, L(T.hisFirst) - 4, 10);
  // speed gauge fills the gap before the rows arrive
  const needle = -78 + 156 * glide(frame, 6, 44) + Math.sin(frame / 2) * 2;
  const fill1 = linear(frame, L(T.took), L(T.threeYears) + 12);
  const fill2 = SHARE_LATEST * glide(frame, L(T.just), 16);

  return (
    <SceneShell durationInFrames={SCENES.faster.durationInFrames} from="right">
      {/* speed streaks */}
      {[0, 1, 2, 3, 4].map((i) => {
        const t = ((frame * (14 + i * 3) + i * 300) % 1500) - 300;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: t,
              top: 190 + i * 62,
              width: 180 + i * 30,
              height: 8,
              borderRadius: 4,
              background: C.yellow,
              opacity: 0.16,
            }}
          />
        );
      })}
      <At x={540} y={220} scale={pop(frame, 1)}>
        <Big size={60}>It keeps getting</Big>
      </At>
      <At x={540} y={335} scale={pop(frame, L(T.faster), 1.2)}>
        <Big size={150} color={C.yellow} style={{ transform: "skewX(-10deg)", letterSpacing: 4 }}>
          Faster
        </Big>
      </At>

      <At x={540} y={790} scale={(1 - rows) * pop(frame, 3, 0.7)} opacity={1 - rows}>
        <svg width={620} height={360} viewBox="0 0 620 360" style={{ overflow: "visible" }}>
          <path d="M40 330 A270 270 0 0 1 580 330" fill="none" stroke={C.line} strokeWidth={44} strokeLinecap="round" />
          <path
            d="M40 330 A270 270 0 0 1 580 330"
            fill="none"
            stroke={C.green}
            strokeWidth={44}
            strokeLinecap="round"
            strokeDasharray={848}
            strokeDashoffset={848 * (1 - (needle + 78) / 156)}
          />
          <g transform={`rotate(${needle} 310 330)`}>
            <path d="M298 330 L310 96 L322 330 Z" fill={C.white} />
          </g>
          <circle cx={310} cy={330} r={30} fill={C.white} />
        </svg>
      </At>

      <Row
        y={520}
        title="First $50,000"
        result="3+ years"
        color={C.white}
        enter={rows}
        pulseAt={L(T.fiftyK1)}
        fill={fill1}
        resultAt={L(T.threeYears)}
        resultSize={54}
      />
      <Row
        y={770}
        title="Latest $50,000"
        result="16 months"
        color={C.green}
        enter={glide(frame, L(T.hisLatest) - 3, 10)}
        pulseAt={L(T.fiftyK2)}
        fill={fill2}
        resultAt={L(T.sixteen)}
        resultSize={66}
      />

      <At x={540} y={1050} scale={pop(frame, L(T.sixteen) + 14)} rotate={-3}>
        <Pill color={C.yellow} size={70}>
          2.5× faster
        </Pill>
      </At>
    </SceneShell>
  );
};
