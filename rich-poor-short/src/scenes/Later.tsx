import React from "react";
import { useCurrentFrame } from "remotion";
import { glide, jolt, linear, pop } from "../anim";
import { At, Big, SceneShell } from "../components/Bits";
import { Character } from "../components/Character";
import { LoanTag } from "../components/Icons";
import { C } from "../theme";
import { SCENES, T, local } from "../timing";

const L = (f: number) => local("later", f);
const LOANS: { label: string; x: number; y: number; rotate: number }[] = [
  { label: "PHONE EMI", x: 300, y: 965, rotate: -5 },
  { label: "CREDIT CARD", x: 760, y: 950, rotate: 4 },
  { label: "PERSONAL LOAN", x: 540, y: 1090, rotate: -2 },
];

export const Later: React.FC = () => {
  const frame = useCurrentFrame();
  const years = Math.round(linear(frame, 1, 17) * 10);
  // the "10 years later" title shrinks into a header once Rahul shows up
  const tuck = glide(frame, L(T.rahulHas) - 5, 14);
  const rahul = pop(frame, L(T.rahulHas));
  const zero = pop(frame, L(T.zero), 0.8);
  const shake = jolt(frame, L(T.zero), 18);
  const ring = linear(frame, 1, 19);

  return (
    <SceneShell durationInFrames={SCENES.later.durationInFrames}>
      <At x={540} y={640 - 430 * tuck} scale={1 - 0.52 * tuck}>
        <svg
          width={840}
          height={840}
          style={{
            position: "absolute",
            top: -178,
            left: "50%",
            marginLeft: -420,
            rotate: "-90deg",
            opacity: 1 - tuck,
          }}
        >
          <circle
            cx={420}
            cy={420}
            r={400}
            fill="none"
            stroke={C.line}
            strokeWidth={14}
            strokeDasharray="6 26"
            strokeDashoffset={-frame * 3}
          />
          <circle
            cx={420}
            cy={420}
            r={400}
            fill="none"
            stroke={C.yellow}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={2513}
            strokeDashoffset={2513 * (1 - ring)}
          />
        </svg>
        <Big size={400} style={{ scale: String(1 + 0.08 * Math.sin(frame / 1.5) * (1 - ring)) }}>
          {years}
        </Big>
        <Big size={84} color={C.yellow} style={{ scale: String(pop(frame, L(T.tenYears) + 6)) }}>
          years later
        </Big>
      </At>

      <At x={280 - (1 - rahul) * 200} y={640} scale={rahul} opacity={Math.min(1, rahul * 3)}>
        <Character who="rahul" frame={frame} width={390} mood="sad" />
      </At>

      <At
        x={770 + shake.x}
        y={590 + shake.y}
        scale={2.6 - 1.6 * zero}
        opacity={Math.min(1, zero * 4)}
      >
        <Big size={300} color={C.red} style={{ textShadow: `0 0 80px ${C.red}88` }}>
          ₹0
        </Big>
      </At>
      <At x={770} y={780} scale={pop(frame, L(T.zero) + 7)}>
        <Big size={78}>savings</Big>
      </At>

      {LOANS.map((loan, i) => {
        const p = pop(frame, L(T.threeLoans) + i * 6);
        return (
          <At
            key={loan.label}
            x={loan.x}
            y={loan.y - (1 - p) * 60}
            rotate={loan.rotate + Math.sin((frame + i * 20) / 10) * 1.5}
            scale={p}
          >
            <LoanTag label={loan.label} />
          </At>
        );
      })}
    </SceneShell>
  );
};
