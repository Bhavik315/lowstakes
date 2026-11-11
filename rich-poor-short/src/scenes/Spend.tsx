import React from "react";
import { useCurrentFrame } from "remotion";
import { glide, jolt, pop } from "../anim";
import { At, Big, Pill, SceneShell, Stamp } from "../components/Bits";
import { Character } from "../components/Character";
import { CreditCard, Phone } from "../components/Icons";
import { SalaryBar } from "../components/SalaryBar";
import { C } from "../theme";
import { SCENES, T, local } from "../timing";

const L = (f: number) => local("spend", f);

export const Spend: React.FC = () => {
  const frame = useCurrentFrame();
  const phone = pop(frame, L(T.phone));
  const card = pop(frame, L(T.credit));
  const rate = pop(frame, L(T.thirtySix), 0.8);
  const shake = jolt(frame, L(T.thirtySix), 18);
  // salary: full -> 60% after the phone -> 28% after the card
  const level =
    1 - 0.4 * glide(frame, L(T.phone), 20) - 0.32 * glide(frame, L(T.credit), 20);
  const mood =
    frame >= L(T.thirtySix) ? "shock" : frame >= L(T.phone) ? "happy" : "neutral";

  return (
    <SceneShell durationInFrames={SCENES.spend.durationInFrames} from="left">
      <SalaryBar level={level} scale={pop(frame, 2, 0.6)} />

      <At x={290} y={680}>
        <Character who="rahul" frame={frame} width={400} mood={mood} />
      </At>

      <Stamp lines={["Spends", "first"]} color={C.red} at={L(T.spends)} x={770} y={480} rotate={-7} />

      <At x={770} y={770} scale={phone} rotate={Math.sin(frame / 7) * 5 - (1 - phone) * 40}>
        <Phone size={270} />
      </At>
      <At x={890} y={650} scale={pop(frame, L(T.emi))} rotate={12}>
        <Pill color={C.red} textColor={C.white} size={58}>
          EMI
        </Pill>
      </At>

      <At x={300} y={1010} scale={card} rotate={-9 + Math.sin(frame / 9) * 3 + (1 - card) * 30}>
        <CreditCard size={340} />
      </At>

      <At
        x={760 + shake.x}
        y={1000 + shake.y}
        scale={2.6 - 1.6 * rate}
        opacity={Math.min(1, rate * 4)}
      >
        <Big size={200} color={C.red} style={{ textShadow: `0 0 70px ${C.red}88` }}>
          36%
        </Big>
      </At>
      <At x={760} y={1118} scale={pop(frame, L(T.interest))}>
        <Big size={58}>interest</Big>
      </At>
    </SceneShell>
  );
};
