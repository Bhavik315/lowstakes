import React from "react";
import { useCurrentFrame } from "remotion";
import { glide, jolt, linear, pop, usd } from "../anim";
import { At, Big, Pill, SceneShell } from "../components/Bits";
import { Character, NameTag } from "../components/Character";
import { C } from "../theme";
import { SCENES, T, local } from "../timing";

const L = (f: number) => local("grow", f);
const BASE = 1085;
// Bars are scaled in thousands of dollars (k): $230,000 -> k=230.
const PX_PER_K = 2.48;
const OWN_MONEY = "#3c8f68";

const Bar: React.FC<{
  x: number;
  k: number;
  color: string;
  label: string;
  labelColor: string;
  labelSize: number;
  caption: string;
  shake?: { x: number; y: number };
  /** Part of the bar (from the bottom) that is his own money, drawn darker. */
  ownK?: number;
}> = ({ x, k, color, label, labelColor, labelSize, caption, shake = { x: 0, y: 0 }, ownK }) => {
  const h = k * PX_PER_K;
  const own = Math.min(k, ownK ?? 0) * PX_PER_K;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x - 100,
          top: BASE - h,
          width: 200,
          height: h,
          borderRadius: "22px 22px 0 0",
          background: color,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: 200,
            height: own,
            background: OWN_MONEY,
          }}
        />
      </div>
      <At x={x + shake.x} y={BASE - h - labelSize * 0.75 + shake.y} opacity={k > 2 ? 1 : 0}>
        <Big size={labelSize} color={labelColor} style={{ textTransform: "none" }}>
          {label}
        </Big>
      </At>
      <At x={x} y={BASE + 40}>
        <Big size={38} color={C.muted} style={{ letterSpacing: 2 }}>
          {caption}
        </Big>
      </At>
    </>
  );
};

export const Grow: React.FC = () => {
  const frame = useCurrentFrame();
  const invested = 120 * glide(frame, L(T.he), L(T.hundredTwenty) - L(T.he) + 14);
  const growth = glide(frame, L(T.grew), L(T.twoThirty) - L(T.grew) + 16);
  const value = Math.min(invested, 120) + 110 * growth;
  const shake = jolt(frame, L(T.twoThirty), 16);
  const done = frame >= L(T.twoThirty);

  return (
    <SceneShell durationInFrames={SCENES.grow.durationInFrames} from="right">
      <At x={230} y={470} scale={pop(frame, 0)}>
        <Character who="marcus" frame={frame} width={340} mood="happy" />
      </At>
      <At x={230} y={720} scale={pop(frame, 4)}>
        <NameTag name="MARCUS" color={C.green} style={{ fontSize: 44 }} />
      </At>

      {/* baseline */}
      <div
        style={{
          position: "absolute",
          left: 400,
          top: BASE,
          width: 550,
          height: 6,
          borderRadius: 3,
          background: C.line,
        }}
      />
      <Bar
        x={540}
        k={invested}
        color={OWN_MONEY}
        label={usd(invested * 1000)}
        labelColor={C.white}
        labelSize={56}
        caption="PUT IN"
      />
      <Bar
        x={810}
        k={frame >= L(T.grew) ? value : 0}
        color={C.green}
        label={usd(value * 1000)}
        labelColor={C.green}
        labelSize={done ? 68 : 60}
        caption="NOW"
        shake={shake}
        ownK={120}
      />

      {/* the $120,000 line: everything above it is growth he never paid in */}
      <div
        style={{
          position: "absolute",
          left: 640,
          top: BASE - 120 * PX_PER_K - 3,
          width: 290 * linear(frame, L(T.grew) - 2, L(T.grew) + 8),
          height: 0,
          borderTop: `6px dashed ${C.white}`,
          opacity: 0.85,
        }}
      />
      <At x={810} y={BASE - 165 * PX_PER_K} scale={pop(frame, L(T.twoThirty) + 6)}>
        <Big size={58} color={C.bg}>
          +$110K
        </Big>
        <Big size={40} color={C.bg} style={{ textTransform: "none" }}>
          growth
        </Big>
      </At>

      <At x={250} y={900} scale={pop(frame, L(T.twoThirty) + 14)} rotate={-6}>
        <Pill color={C.yellow} size={54}>
          Nearly 2×
        </Pill>
      </At>

      <At x={540} y={1183} opacity={linear(frame, L(T.he), L(T.he) + 10) * 0.9}>
        <div style={{ fontSize: 30, fontWeight: 600, color: C.muted, whiteSpace: "nowrap" }}>
          Illustration: $1,000 a month for 10 years at ~12% a year
        </div>
      </At>
    </SceneShell>
  );
};
