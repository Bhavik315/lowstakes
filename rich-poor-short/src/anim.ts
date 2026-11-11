import { Easing, interpolate, spring } from "remotion";
import { FPS } from "./timing";

/** Bouncy 0→1 pop that starts at frame `at`. */
export const pop = (frame: number, at: number, bounce = 1) =>
  spring({
    frame: frame - at,
    fps: FPS,
    config: { damping: 11 / bounce, stiffness: 170, mass: 0.55 },
  });

/** Smooth 0→1 without overshoot. */
export const glide = (frame: number, at: number, durationInFrames = 18) =>
  spring({
    frame: frame - at,
    fps: FPS,
    config: { damping: 200 },
    durationInFrames,
  });

/** Clamped eased 0→1 between two frames. */
export const ramp = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

export const linear = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** Decaying wobble after an impact at frame `at` (px). */
export const jolt = (frame: number, at: number, amount = 14) => {
  const dt = frame - at;
  if (dt < 0 || dt > 16) return { x: 0, y: 0 };
  const a = amount * Math.exp(-dt / 4);
  return { x: Math.sin(dt * 2.6) * a, y: Math.cos(dt * 3.3) * a * 0.7 };
};

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
