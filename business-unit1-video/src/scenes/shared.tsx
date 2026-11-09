import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import { SCENES } from "../content/script";
import type { SceneSpec } from "../content/types";
import { CLAMP } from "../lib/anim";
import { CHAPTERS } from "../lib/theme";
import { getCues } from "../lib/timing";

export type SceneProps = { sceneId: string };

export const getSpec = <K extends SceneSpec["kind"]>(id: string, kind: K) => {
  const spec = SCENES.find((s) => s.id === id);
  if (!spec) throw new Error(`Unknown scene ${id}`);
  if (spec.kind !== kind) throw new Error(`Scene ${id} is ${spec.kind}, expected ${kind}`);
  return spec as Extract<SceneSpec, { kind: K }>;
};

export const useScene = (spec: SceneSpec) => {
  const frame = useCurrentFrame();
  const cues = getCues(spec);
  const chapter = CHAPTERS[spec.chapter];
  const kicker = chapter.code ? `${chapter.code} · ${chapter.title}` : chapter.title;
  return { frame, cues, color: chapter.color, kicker };
};

/**
 * Every scene sits in this shell: a slow camera push-in, the scene's narration track
 * and a soft swish as it enters.
 */
export const SceneShell: React.FC<{
  spec: SceneSpec;
  children: React.ReactNode;
  push?: number;
  swish?: boolean;
}> = ({ spec, children, push = 0.035, swish = true }) => {
  const frame = useCurrentFrame();
  const cues = getCues(spec);
  const scale = interpolate(frame, [0, cues.total], [1, 1 + push], CLAMP);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ scale: String(scale) }}>{children}</AbsoluteFill>
      <Audio src={staticFile(`vo/${spec.id}.mp3`)} from={cues.lead} />
      {swish ? <Audio src={staticFile("sfx/swish.wav")} volume={0.14} /> : null}
    </AbsoluteFill>
  );
};
