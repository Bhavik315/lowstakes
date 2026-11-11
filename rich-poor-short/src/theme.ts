import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Poppins (SIL OFL) is bundled in public/fonts so renders never depend on the
// network. The latin-ext files add broader punctuation coverage.
const SUBSETS = {
  latin:
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  "latin-ext":
    "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
};

export const fontFamily = "Poppins";

for (const weight of ["600", "800", "900"]) {
  for (const [subset, unicodeRange] of Object.entries(SUBSETS)) {
    loadFont({
      family: fontFamily,
      url: staticFile(`fonts/poppins-${subset}-${weight}-normal.woff2`),
      weight,
      unicodeRange,
    }).catch((err) => console.error("Font failed to load", err));
  }
}

export const C = {
  bg: "#0f0f14",
  panel: "#191923",
  line: "#2b2b3b",
  white: "#f7f7fc",
  muted: "#8f91a8",
  green: "#22e584",
  greenDeep: "#0c8a4d",
  red: "#ff4558",
  redDeep: "#a31d2f",
  yellow: "#ffe234",
  gold: "#ffc531",
  goldDeep: "#c98a06",
};

export const WIDTH = 1080;
export const HEIGHT = 1920;
