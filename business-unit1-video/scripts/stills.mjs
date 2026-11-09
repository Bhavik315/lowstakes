// Render preview stills of scenes. Usage: node scripts/stills.mjs [sceneId[@fraction] ...]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = process.env.OUT ?? path.join(root, "out", "stills");
mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), onProgress: () => {} });
const args = process.argv.slice(2);
for (const arg of args) {
  const [id, frac = "0.9"] = arg.split("@");
  const isMain = id.startsWith("main");
  const comp = await selectComposition({ serveUrl, id: isMain ? "IGCSEBusinessUnit1" : `scene-${id}`, inputProps: isMain ? { captions: true } : { sceneId: id }, browserExecutable: process.env.REMOTION_BROWSER ?? null });
  const frame = isMain ? Number(frac) : Math.floor(comp.durationInFrames * Number(frac));
  const output = path.join(outDir, `${id}${isMain ? "-" + frac : ""}${isMain ? "" : "@" + frac}.png`);
  const t = Date.now();
  await renderStill({ composition: comp, serveUrl, frame, output, inputProps: comp.props, scale: 0.5, browserExecutable: process.env.REMOTION_BROWSER ?? null, chromiumOptions: { gl: "angle" } });
  console.log(`${output} (frame ${frame}, ${Date.now() - t}ms)`);
}
