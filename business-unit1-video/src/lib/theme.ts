import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Fraunces and Inter (SIL Open Font License), bundled locally so renders work offline.
const FACES: [string, string, string, "normal" | "italic"][] = [
  ["Fraunces", "fraunces-latin-500-normal.woff2", "500", "normal"],
  ["Fraunces", "fraunces-latin-600-normal.woff2", "600", "normal"],
  ["Fraunces", "fraunces-latin-700-normal.woff2", "700", "normal"],
  ["Fraunces", "fraunces-latin-500-italic.woff2", "500", "italic"],
  ["Inter", "inter-latin-400-normal.woff2", "400", "normal"],
  ["Inter", "inter-latin-500-normal.woff2", "500", "normal"],
  ["Inter", "inter-latin-600-normal.woff2", "600", "normal"],
  ["Inter", "inter-latin-700-normal.woff2", "700", "normal"],
  ["Inter", "inter-latin-800-normal.woff2", "800", "normal"],
];

FACES.forEach(([family, file, weight, style]) => {
  loadFont({ family, url: staticFile(`fonts/${file}`), weight, style, format: "woff2" });
});

export const SERIF = "Fraunces, Georgia, serif";
export const SANS = "Inter, system-ui, sans-serif";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const INK = "#F4F1EA";
export const MUTED = "rgba(244, 241, 234, 0.66)";
export const FAINT = "rgba(244, 241, 234, 0.12)";
export const GOOD = "#4ADE80";
export const BAD = "#F87171";
export const BG = "#05070F";

export type Chapter = { code: string; title: string; color: string; glow: string };

export const CHAPTERS: Chapter[] = [
  { code: "", title: "Introduction", color: "#F5C065", glow: "#7A4B12" },
  { code: "1.1", title: "Business activity", color: "#F5B942", glow: "#7A4310" },
  { code: "1.2", title: "Classification of businesses", color: "#2DD4BF", glow: "#0B5A55" },
  { code: "1.3", title: "Enterprise, growth & size", color: "#A78BFA", glow: "#3E2A86" },
  { code: "1.4", title: "Types of business organisation", color: "#60A5FA", glow: "#173E7A" },
  { code: "1.5", title: "Objectives & stakeholders", color: "#FB7185", glow: "#7A1F35" },
  { code: "", title: "Summary", color: "#F5C065", glow: "#7A4B12" },
];

export const toneColor = (tone: string, accent: string) => {
  if (tone === "good") return GOOD;
  if (tone === "bad") return BAD;
  if (tone === "neutral") return "#CBD5E1";
  return accent;
};

/** Adds an alpha channel to a #RRGGBB colour. */
export const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, "0")}`;
