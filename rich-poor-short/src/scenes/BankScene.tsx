import React from "react";
import { useCurrentFrame } from "remotion";
import { glide, linear, pop } from "../anim";
import { At, Big, SceneShell } from "../components/Bits";
import { Character } from "../components/Character";
import { Bank, Coin } from "../components/Icons";
import { SalaryBar } from "../components/SalaryBar";
import { C } from "../theme";
import { SCENES, T, local } from "../timing";

const L = (f: number) => local("bank", f);
const FLIGHT = 15;

export const BankScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = SCENES.bank;
  const coins = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => L(T.hisMoney) + 4 + i * 5);
  // bank bumps every time a coin lands
  const bump = coins.reduce((acc, start) => {
    const dt = frame - (start + FLIGHT);
    return dt >= 0 && dt < 6 ? Math.max(acc, 1 - dt / 6) : acc;
  }, 0);
  const level = 0.28 * (1 - glide(frame, L(T.hisMoney) + 6, durationInFrames - 16));

  return (
    <SceneShell durationInFrames={durationInFrames} from="right">
      <SalaryBar level={level} />

      <At x={250} y={640}>
        <Character who="jake" frame={frame} width={350} mood="sad" />
      </At>
      <At x={250} y={900} scale={pop(frame, L(T.hisMoney))}>
        <Big size={60} color={C.red}>
          His money
        </Big>
      </At>

      <At x={820} y={610 + bump * 8} scale={pop(frame, 1) * (1 + bump * 0.07)}>
        <Bank size={330} />
      </At>
      <At x={820} y={900} scale={pop(frame, L(T.bank))}>
        <Big size={60} color={C.yellow}>
          Bank&apos;s profit
        </Big>
      </At>

      {coins.map((start, i) => {
        const t = linear(frame, start, start + FLIGHT);
        if (t <= 0 || t >= 1) return null;
        return (
          <At
            key={i}
            x={340 + (780 - 340) * t}
            y={690 - Math.sin(t * Math.PI) * 250 - 60 * t}
            scale={1 - t * 0.35}
          >
            <Coin size={96} spin={frame / 2 + i} />
          </At>
        );
      })}

      {/* dashed path the coins follow */}
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <path
          d="M340 1010 L720 1010"
          stroke={C.red}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray="4 30"
          strokeDashoffset={-frame * 4}
          opacity={0.9}
        />
        <path d="M716 978 L770 1010 L716 1042 Z" fill={C.red} />
      </svg>
    </SceneShell>
  );
};
