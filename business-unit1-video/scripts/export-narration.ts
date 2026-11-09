// Validates the scene script and exports the narration for the TTS step.
// Usage: node scripts/export-narration.ts
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { SCENES } from "../src/content/script.ts";

const require = createRequire(import.meta.url);
const lucide = require("lucide-react");

const errors: string[] = [];
const seen = new Set<string>();

const walk = (value: unknown, cb: (key: string, v: unknown) => void) => {
  if (Array.isArray(value)) value.forEach((v) => walk(v, cb));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      cb(k, v);
      if (k !== "lines") walk(v, cb);
    }
  }
};

const out = SCENES.map((scene) => {
  if (seen.has(scene.id)) errors.push(`duplicate scene id ${scene.id}`);
  seen.add(scene.id);
  const ids = scene.lines.map((l, i) => l.id ?? `L${i}`);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) errors.push(`${scene.id}: duplicate line ids ${dupes.join(", ")}`);
  walk(scene, (k, v) => {
    if ((k === "at" || k === "atDef") && typeof v === "string" && !ids.includes(v)) {
      errors.push(`${scene.id}: cue "${v}" does not match any line id`);
    }
    if (k === "icon" && typeof v === "string" && !lucide[v]) {
      errors.push(`${scene.id}: unknown icon "${v}"`);
    }
  });
  return {
    scene: scene.id,
    chapter: scene.chapter,
    lines: scene.lines.map((l, i) => ({
      id: ids[i],
      text: l.text,
      say: l.say ?? l.text,
      pause: l.pause ?? null,
    })),
  };
});

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
writeFileSync(new URL("./narration.json", import.meta.url), JSON.stringify(out, null, 2));
const words = out.flatMap((s) => s.lines).reduce((n, l) => n + l.say.split(/\s+/).length, 0);
console.log(`${out.length} scenes, ${out.flatMap((s) => s.lines).length} lines, ${words} words (~${Math.round(words / 155)} min)`);
