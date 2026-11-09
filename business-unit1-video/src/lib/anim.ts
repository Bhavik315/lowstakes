import { Easing, interpolate } from "remotion";

export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 → 1 progress starting at `start`, over `dur` frames, with a cinematic ease-out. */
export const prog = (frame: number, start: number, dur = 20) =>
  interpolate(frame, [start, start + dur], [0, 1], { ...CLAMP, easing: EASE });

/**
 * Spotlight: which item is currently being narrated.
 * `starts` holds the cue frame of each item; returns, per item, how "active" it is (0..1)
 * and whether the scene has moved past the list (everything goes back to full brightness).
 */
export const spotlight = (frame: number, starts: number[], release: number) => {
  const distinct = [...new Set(starts)].sort((a, b) => a - b);
  return starts.map((s) => {
    const idx = distinct.indexOf(s);
    const next = idx < distinct.length - 1 ? distinct[idx + 1] : release;
    if (next - 2 <= s + 8) return frame >= s && frame < next ? 1 : 0;
    return interpolate(frame, [s, s + 8, next - 2, next + 8], [0, 1, 1, 0], CLAMP);
  });
};

/** Opacity for an item that is revealed but not currently in the spotlight. */
export const dimmed = (active: number, frame: number, release: number) => {
  const settled = interpolate(frame, [release, release + 15], [0, 1], CLAMP);
  return Math.max(0.5 + 0.5 * active, settled);
};
