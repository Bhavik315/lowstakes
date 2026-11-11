import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { glide, linear, pop } from "../anim";
import { At, Big } from "../components/Bits";
import { HookQuestion } from "../components/HookQuestion";
import { Coin, Sprout } from "../components/Icons";
import { C } from "../theme";
import { SCENES, T, local } from "../timing";
import { HOOK_START_SCALE } from "./Hook";

const L = (f: number) => local("outro", f);

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = SCENES.outro;
  const enter = glide(frame, 0, 9);
  const today = pop(frame, L(T.startToday));
  const away = glide(frame, L(T.nextTime) - 3, 10);
  const bubble = pop(frame, L(T.nextTime), 0.8);
  // last frames: the hook question flies back in, so the loop is seamless
  const loop = linear(frame, durationInFrames - 9, durationInFrames - 1);
  const asked = frame >= L(T.asks);

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: Math.min(1, linear(frame, 0, 3)) * (1 - away),
          scale: String((0.86 + 0.14 * enter) * (1 - away * 0.3)),
          transformOrigin: "50% 38%",
        }}
      >
        <At x={540} y={540}>
          <Sprout size={460} grow={0.12 + 0.2 * glide(frame, 2, 20) + 0.72 * today} />
        </At>
        {[
          { x: 360, y: 330 },
          { x: 730, y: 290 },
          { x: 560, y: 190 },
        ].map((c, i) => (
          <At
            key={i}
            x={c.x}
            y={c.y + Math.sin((frame + i * 12) / 7) * 8}
            scale={pop(frame, L(T.startToday) + 4 + i * 3, 1.2)}
          >
            <Coin size={100} spin={(frame + i * 8) / 6} />
          </At>
        ))}
        <At x={540} y={890} scale={pop(frame, L(T.startSmall))}>
          <Big size={104}>Start small</Big>
        </At>
        <At x={540} y={1030} scale={today * (1 + 0.03 * Math.sin(frame / 4))}>
          <Big size={128} color={C.yellow} style={{ textShadow: `0 0 70px ${C.yellow}66` }}>
            Start today
          </Big>
        </At>
      </AbsoluteFill>

      {/* "the next time someone asks you..." */}
      <At
        x={540}
        y={640}
        scale={bubble * (1 + loop * 0.8)}
        opacity={Math.min(1, bubble * 3) * (1 - loop)}
        rotate={Math.sin(frame / 8) * 2}
      >
        <svg width={760} height={560} viewBox="0 0 760 560">
          <path
            d="M70 10 L690 10 Q750 10 750 70 L750 350 Q750 410 690 410 L330 410 L210 540 L230 410 L70 410 Q10 410 10 350 L10 70 Q10 10 70 10 Z"
            fill={C.white}
          />
          {asked ? null : (
            <g fill={C.bg}>
              {[0, 1, 2].map((i) => (
                <circle
                  key={i}
                  cx={250 + i * 130}
                  cy={210 - Math.max(0, Math.sin((frame - i * 4) / 3)) * 36}
                  r={36}
                />
              ))}
            </g>
          )}
        </svg>
        {asked ? (
          <Big
            size={330}
            color={C.bg}
            style={{
              position: "absolute",
              top: 46,
              scale: String(pop(frame, L(T.asks), 1.3)),
            }}
          >
            ?
          </Big>
        ) : null}
      </At>

      <At
        x={540}
        y={800}
        scale={0.72 + (HOOK_START_SCALE - 0.72) * loop}
        opacity={loop}
      >
        <HookQuestion frame={-1} />
      </At>
    </AbsoluteFill>
  );
};
