import React from "react";
import { useCurrentFrame } from "remotion";
import { usd, linear, pop } from "../anim";
import { At, Big, SceneShell } from "../components/Bits";
import { Character, NameTag } from "../components/Character";
import { C } from "../theme";
import { SCENES, T, local } from "../timing";

const L = (f: number) => local("meet", f);

export const Meet: React.FC = () => {
  const frame = useCurrentFrame();
  const jake = pop(frame, L(T.jake));
  const marcus = pop(frame, L(T.marcus));
  const both = pop(frame, L(T.both));
  const count = linear(frame, L(T.five), L(T.five) + 20);
  const salaryPulse = 1 + 0.12 * (1 - pop(frame, L(T.five) + 20, 1.3));

  return (
    <SceneShell durationInFrames={SCENES.meet.durationInFrames} from="bottom">
      <At x={540} y={230} scale={pop(frame, 1)}>
        <Big size={130} color={C.yellow} style={{ letterSpacing: 10 }}>
          Meet
        </Big>
      </At>

      <At x={290 - (1 - jake) * 260} y={570} scale={0.4 + 0.6 * jake} opacity={Math.min(1, jake * 3)}>
        <Character who="jake" frame={frame} width={380} />
      </At>
      <At x={290} y={850} scale={pop(frame, L(T.jake) + 4)}>
        <NameTag name="JAKE" color={C.red} />
      </At>

      <At x={790 + (1 - marcus) * 260} y={570} scale={0.4 + 0.6 * marcus} opacity={Math.min(1, marcus * 3)}>
        <Character who="marcus" frame={frame} width={380} mood="happy" />
      </At>
      <At x={790} y={850} scale={pop(frame, L(T.marcus) + 4)}>
        <NameTag name="MARCUS" color={C.green} />
      </At>

      {/* same salary */}
      <At x={290} y={1010} scale={both * salaryPulse}>
        <Big size={86}>{usd(5000 * count)}</Big>
        <Big size={38} color={C.muted} style={{ marginTop: 6, letterSpacing: 3 }}>
          a month
        </Big>
      </At>
      <At x={540} y={1000} scale={pop(frame, L(T.both) + 5)}>
        <Big size={110} color={C.yellow}>
          =
        </Big>
      </At>
      <At x={790} y={1010} scale={pop(frame, L(T.both) + 3) * salaryPulse}>
        <Big size={86}>{usd(5000 * count)}</Big>
        <Big size={38} color={C.muted} style={{ marginTop: 6, letterSpacing: 3 }}>
          a month
        </Big>
      </At>
    </SceneShell>
  );
};
