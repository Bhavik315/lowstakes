import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { glide, linear, pop } from "../anim";
import { At } from "../components/Bits";
import { HookQuestion } from "../components/HookQuestion";
import { Arrow } from "../components/Icons";
import { C } from "../theme";
import { SCENES, T } from "../timing";

export const HOOK_START_SCALE = 1.1;

export const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = SCENES.hook;
  // Frame 0 already shows the full question (it is also the loop point).
  const settle = glide(frame, 0, 10);
  const exit = linear(frame, durationInFrames - 4, durationInFrames);
  const up = pop(frame, T.richer);
  const down = pop(frame, T.poorer);

  return (
    <AbsoluteFill style={{ opacity: 1 - exit, scale: String(1 + exit * 0.12) }}>
      <At
        x={540}
        y={800}
        scale={
          (HOOK_START_SCALE - (HOOK_START_SCALE - 1) * settle) *
          (1 + 0.03 * (frame / durationInFrames))
        }
      >
        <HookQuestion frame={frame} />
      </At>

      {/* arrows sit in the margins beside RICHER and POORER? */}
      <At
        x={930}
        y={690 - ((frame - T.richer + 60) % 30) * 0.9}
        scale={up}
        opacity={Math.min(1, up * 2)}
      >
        <Arrow color={C.green} size={150} />
      </At>
      <At
        x={130}
        y={1160 + ((frame - T.poorer + 60) % 30) * 0.9}
        scale={down}
        opacity={Math.min(1, down * 2)}
      >
        <Arrow color={C.red} size={150} down />
      </At>
    </AbsoluteFill>
  );
};
