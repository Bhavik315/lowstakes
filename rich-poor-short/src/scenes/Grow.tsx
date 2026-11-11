import React from "react";
import { useCurrentFrame } from "remotion";
import { glide, jolt, linear, pop } from "../anim";
import { At, Big, Pill, SceneShell } from "../components/Bits";
import { Character, NameTag } from "../components/Character";
import { C } from "../theme";
import { SCENES, T, local } from "../timing";

const L = (f: number) => local("grow", f);
const BASE = 1085;
const PX_PER_LAKH = 12.4;
const OWN_MONEY = "#3c8f68";

const Bar: React.FC<{
  x: number;
  lakh: number;
  color: string;
  label: string;
  labelColor: string;
  labelSize: number;
  caption: string;
  shake?: { x: number; y: number };
  /** Part of the bar (from the bottom) that is his own money, drawn darker. */
  ownLakh?: number;
}> = ({ x, lakh, color, label, labelColor, labelSize, caption, shake = { x: 0, y: 0 }, ownLakh }) => {
  const h = lakh * PX_PER_LAKH;
  const own = Math.min(lakh, ownLakh ?? 0) * PX_PER_LAKH;
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
      <At x={x + shake.x} y={BASE - h - labelSize * 0.75 + shake.y} opacity={lakh > 0.5 ? 1 : 0}>
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
  const invested = 24 * glide(frame, L(T.he), L(T.twentyFour) - L(T.he) + 14);
  const growth = glide(frame, L(T.grew), L(T.fortySix) - L(T.grew) + 16);
  const value = Math.min(invested, 24) + 22 * growth;
  const shake = jolt(frame, L(T.fortySix), 16);
  const done = frame >= L(T.fortySix);

  return (
    <SceneShell durationInFrames={SCENES.grow.durationInFrames} from="right">
      <At x={230} y={470} scale={pop(frame, 0)}>
        <Character who="vikram" frame={frame} width={340} mood="happy" />
      </At>
      <At x={230} y={720} scale={pop(frame, 4)}>
        <NameTag name="VIKRAM" color={C.green} style={{ fontSize: 44 }} />
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
        lakh={invested}
        color={OWN_MONEY}
        label={`₹${Math.round(invested)} lakh`}
        labelColor={C.white}
        labelSize={62}
        caption="PUT IN"
      />
      <Bar
        x={810}
        lakh={frame >= L(T.grew) ? value : 0}
        color={C.green}
        label={`₹${Math.round(value)} lakh`}
        labelColor={C.green}
        labelSize={done ? 76 : 66}
        caption="NOW"
        shake={shake}
        ownLakh={24}
      />

      {/* the ₹24 lakh line: everything above it is growth he never paid in */}
      <div
        style={{
          position: "absolute",
          left: 420,
          top: BASE - 24 * PX_PER_LAKH - 3,
          width: 510 * linear(frame, L(T.grew) - 2, L(T.grew) + 8),
          height: 0,
          borderTop: `6px dashed ${C.white}`,
          opacity: 0.85,
        }}
      />
      <At x={810} y={BASE - 35 * PX_PER_LAKH} scale={pop(frame, L(T.fortySix) + 6)}>
        <Big size={60} color={C.bg}>
          +₹22
        </Big>
        <Big size={44} color={C.bg} style={{ textTransform: "none" }}>
          lakh
        </Big>
      </At>

      <At x={250} y={900} scale={pop(frame, L(T.fortySix) + 14)} rotate={-6}>
        <Pill color={C.yellow} size={54}>
          Nearly 2×
        </Pill>
      </At>

      <At x={540} y={1165} opacity={linear(frame, L(T.he), L(T.he) + 10) * 0.9}>
        <div style={{ fontSize: 30, fontWeight: 600, color: C.muted, whiteSpace: "nowrap" }}>
          Illustration: ₹20,000 a month for 10 years at ~12% a year
        </div>
      </At>
    </SceneShell>
  );
};
