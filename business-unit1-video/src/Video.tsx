import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { AbsoluteFill, interpolate, staticFile } from "remotion";
import { Background, Finish } from "./components/Atmosphere";
import { Captions } from "./components/Captions";
import { SCENES } from "./content/script";
import { CLAMP } from "./lib/anim";
import { sceneFrames, SCENE_STARTS, TOTAL_FRAMES, TRANSITION } from "./lib/timing";
import { LAYOUTS } from "./scenes";

export type VideoProps = { captions: boolean };

/** Music sits under the voice, and swells on title and chapter cards. */
const MUSIC_KEYS = (() => {
  const xs: number[] = [];
  const ys: number[] = [];
  SCENES.forEach((s, i) => {
    const level = s.kind === "chapter" ? 0.7 : s.kind === "title" || s.kind === "end" ? 0.6 : s.kind === "montage" ? 0.42 : 0.24;
    const start = SCENE_STARTS[i];
    const end = start + sceneFrames(s);
    xs.push(start + 12, end - TRANSITION - 2);
    ys.push(level, level);
  });
  return { xs, ys };
})();

const musicVolume = (f: number) => {
  const base = interpolate(f, MUSIC_KEYS.xs, MUSIC_KEYS.ys, CLAMP);
  const fadeIn = interpolate(f, [0, 60], [0, 1], CLAMP);
  const fadeOut = interpolate(f, [TOTAL_FRAMES - 150, TOTAL_FRAMES - 5], [1, 0], CLAMP);
  return base * fadeIn * fadeOut;
};

export const IGCSEBusinessUnit1: React.FC<VideoProps> = ({ captions }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#05070F" }}>
      <Background />
      <TransitionSeries>
        {SCENES.flatMap((scene, i) => {
          const Layout = LAYOUTS[scene.kind];
          const seq = (
            <TransitionSeries.Sequence key={scene.id} name={scene.id} durationInFrames={sceneFrames(scene)}>
              <Layout sceneId={scene.id} />
            </TransitionSeries.Sequence>
          );
          if (i === 0) return [seq];
          return [
            <TransitionSeries.Transition key={`t-${scene.id}`} presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION })} />,
            seq,
          ];
        })}
      </TransitionSeries>
      {captions ? <Captions /> : null}
      <Finish total={TOTAL_FRAMES} />
      <Audio src={staticFile("music/ambient.wav")} loop loopVolumeCurveBehavior="extend" volume={musicVolume} />
    </AbsoluteFill>
  );
};
