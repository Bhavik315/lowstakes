import { interpolateColors } from "remotion";
import timelineJson from "../content/timeline.json";
import { SCENES } from "../content/script";
import type { SceneSpec } from "../content/types";
import { CHAPTERS, FPS } from "./theme";

type TimelinePart = { text: string; start: number; end: number };
type TimelineLine = { id: string; start: number; end: number; parts: TimelinePart[] };
type Timeline = {
  voice: string;
  scenes: Record<string, { duration: number; lines: TimelineLine[] }>;
};

export const TIMELINE = timelineJson as Timeline;

/** Frames of cross-fade between consecutive scenes. */
export const TRANSITION = 20;
/** Visuals land a few frames before the words that introduce them. */
const ANTICIPATE = 5;

export const leadFor = (spec: SceneSpec) => {
  if (spec.kind === "chapter") return 42;
  if (spec.kind === "montage") return 36;
  if (spec.kind === "title") return 30;
  return 16;
};

const tailFor = (spec: SceneSpec) => {
  if (spec.kind === "end") return 6 * FPS;
  if (spec.kind === "chapter") return 36;
  if (spec.kind === "title") return 36;
  return 28;
};

const voiceFrames = (spec: SceneSpec) => {
  const t = TIMELINE.scenes[spec.id];
  if (!t) throw new Error(`No voiceover timing for scene "${spec.id}". Run "npm run voice".`);
  return Math.ceil(t.duration * FPS);
};

export const sceneFrames = (spec: SceneSpec) => leadFor(spec) + voiceFrames(spec) + tailFor(spec);

/** Start frame of every scene on the main timeline (accounts for transition overlap). */
export const SCENE_STARTS: number[] = (() => {
  const starts: number[] = [];
  let t = 0;
  SCENES.forEach((s, i) => {
    starts.push(t);
    t += sceneFrames(s) - (i < SCENES.length - 1 ? TRANSITION : 0);
  });
  return starts;
})();

export const TOTAL_FRAMES =
  SCENES.reduce((sum, s) => sum + sceneFrames(s), 0) - TRANSITION * (SCENES.length - 1);

export const sceneIndexAt = (frame: number) => {
  let idx = 0;
  for (let i = 0; i < SCENE_STARTS.length; i++) {
    if (frame >= SCENE_STARTS[i]) idx = i;
  }
  return idx;
};

/** Accent colours, blended smoothly when the chapter changes. */
export const paletteAt = (frame: number) => {
  const idx = sceneIndexAt(frame);
  const cur = CHAPTERS[SCENES[idx].chapter];
  const next = SCENES[idx + 1] ? CHAPTERS[SCENES[idx + 1].chapter] : cur;
  const end = SCENE_STARTS[idx] + sceneFrames(SCENES[idx]);
  const range = [end - TRANSITION - 30, end];
  const blend = (a: string, b: string) =>
    a === b ? a : interpolateColors(frame, range, [a, b]);
  return { color: blend(cur.color, next.color), glow: blend(cur.glow, next.glow) };
};

export type Cues = {
  /** Frame (scene-relative) at which a line starts; visuals use this to appear. */
  at: (id: string | undefined, fallback?: number) => number;
  /** Frame at which a line finishes. */
  end: (id: string) => number;
  /** Spread n items evenly over the duration of one line. */
  spread: (id: string, k: number, n: number) => number;
  lines: TimelineLine[];
  lead: number;
  total: number;
};

export const getCues = (spec: SceneSpec): Cues => {
  const lead = leadFor(spec);
  const t = TIMELINE.scenes[spec.id];
  const byId = new Map(t.lines.map((l) => [l.id, l]));
  const at = (id: string | undefined, fallback = 0) => {
    if (!id) return fallback;
    const line = byId.get(id);
    if (!line) return fallback;
    return Math.max(0, lead + Math.round(line.start * FPS) - ANTICIPATE);
  };
  const end = (id: string) => {
    const line = byId.get(id);
    return line ? lead + Math.round(line.end * FPS) : 0;
  };
  const spread = (id: string, k: number, n: number) => {
    const a = at(id);
    const d = end(id) - a;
    return a + Math.round((k * d * 0.85) / Math.max(1, n));
  };
  return { at, end, spread, lines: t.lines, lead, total: sceneFrames(spec) };
};
