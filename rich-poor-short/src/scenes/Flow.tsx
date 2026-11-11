import React from "react";
import { useCurrentFrame } from "remotion";
import { linear, pop } from "../anim";
import { At, Big, Pill, SceneShell } from "../components/Bits";
import { Character } from "../components/Character";
import { Coin } from "../components/Icons";
import { C } from "../theme";
import { SCENES, T, local } from "../timing";

const L = (f: number) => local("flow", f);
const FLIGHT = 17;

export const Flow: React.FC = () => {
  const frame = useCurrentFrame();
  const coins = Array.from({ length: 16 }, (_, i) => L(T.pay) + i * 4);
  const collected = frame >= L(T.collect);

  return (
    <SceneShell durationInFrames={SCENES.flow.durationInFrames}>
      <At x={230} y={300} scale={pop(frame, 1)}>
        <Pill color={C.red} textColor={C.white} size={50}>
          Poor
        </Pill>
      </At>
      <At x={230} y={580}>
        <Character who="rahul" frame={frame} width={330} mood="sad" />
      </At>
      <At x={850} y={300} scale={pop(frame, 3)}>
        <Pill color={C.green} size={50}>
          Rich
        </Pill>
      </At>
      <At x={850} y={580} scale={1 + (collected ? 0.06 * Math.abs(Math.sin(frame / 3)) : 0)}>
        <Character who="vikram" frame={frame} width={330} mood="happy" />
      </At>

      {coins.map((start, i) => {
        const t = linear(frame, start, start + FLIGHT);
        if (t <= 0 || t >= 1) return null;
        return (
          <At
            key={i}
            x={320 + (760 - 320) * t}
            y={640 - Math.sin(t * Math.PI) * (200 + (i % 3) * 40)}
            scale={0.8 + 0.3 * Math.sin(t * Math.PI)}
          >
            <Coin size={92} spin={frame / 2 + i} />
          </At>
        );
      })}

      <At x={245} y={900} scale={pop(frame, L(T.pay))}>
        <Big size={64} color={C.red}>
          Pays
        </Big>
        <Big size={64} color={C.red}>
          interest
        </Big>
      </At>
      <At x={835} y={900} scale={pop(frame, L(T.collect))}>
        <Big size={64} color={C.green}>
          Collects
        </Big>
        <Big size={64} color={C.green}>
          it
        </Big>
      </At>

      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <path
          d="M300 1060 L740 1060"
          stroke={C.yellow}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray="4 34"
          strokeDashoffset={-frame * 5}
        />
        <path d="M736 1024 L796 1060 L736 1096 Z" fill={C.yellow} />
      </svg>
    </SceneShell>
  );
};
