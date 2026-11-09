import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, interpolate, staticFile } from "remotion";
import { Card, Heading, Icon, IconBadge, Label, Reveal, Sub } from "../components/ui";
import { CLAMP, dimmed, EASE, prog, spotlight } from "../lib/anim";
import { alpha, INK, MUTED, SANS, SERIF } from "../lib/theme";
import { getSpec, SceneProps, SceneShell, useScene } from "./shared";

// ─────────────── Cold open: the businesses around you ───────────────
export const MontageLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "montage");
  const { frame, cues, color } = useScene(spec);
  const cx = 960;
  const cy = 520;
  const q = cues.at(spec.question.at);
  const qp = prog(frame, q, 30);
  const centerAt = cues.at(spec.center.at);
  const intro = interpolate(frame, [cues.at("L0"), cues.at("L0") + 20, cues.at("things") - 6, cues.at("things") + 8], [0, 1, 1, 0], CLAMP);
  const fadeFromBlack = interpolate(frame, [0, 30], [1, 0], CLAMP);
  const n = spec.items.length;
  const first = spec.items.filter((i) => i.at === spec.items[0].at).length;

  return (
    <SceneShell spec={spec} swish={false}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ opacity: intro, fontFamily: SERIF, fontSize: 84, color: INK, textAlign: "center", lineHeight: 1.15 }}>
          Think about the last
          <br />
          <span style={{ color }}>24 hours</span> of your life…
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: 1 - qp * 0.8, scale: String(1 - qp * 0.12), filter: qp > 0 ? `blur(${qp * 6}px)` : undefined }}>
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {spec.items.map((item, i) => {
            const a = (i / n) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(a) * 540;
            const y = cy + Math.sin(a) * 330;
            const p = prog(frame, centerAt + 10 + i * 3, 30);
            return (
              <line
                key={item.label}
                x1={cx}
                y1={cy}
                x2={cx + (x - cx) * p}
                y2={cy + (y - cy) * p}
                stroke={alpha(color, 0.45)}
                strokeWidth={2}
                strokeDasharray="6 8"
              />
            );
          })}
        </svg>
        {spec.items.map((item, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * 540;
          const y = cy + Math.sin(a) * 330;
          const groupIdx = i < first ? i : i - first;
          const groupN = i < first ? first : n - first;
          const at = cues.spread(item.at!, groupIdx, groupN);
          return (
            <Reveal key={item.label} at={at} dy={30} scale style={{ position: "absolute", left: x - 90, top: y - 80, width: 180 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <IconBadge name={item.icon} color={color} size={112} />
                <Label size={34} style={{ textAlign: "center" }}>
                  {item.label}
                </Label>
              </div>
            </Reveal>
          );
        })}
        <Reveal at={centerAt} scale dy={0} style={{ position: "absolute", left: cx - 150, top: cy - 150 }}>
          <div
            style={{
              width: 300,
              height: 300,
              borderRadius: 300,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: `radial-gradient(circle at 35% 30%, ${alpha(color, 0.5)}, ${alpha(color, 0.12)} 70%)`,
              border: `2px solid ${alpha(color, 0.8)}`,
              boxShadow: `0 0 120px ${alpha(color, 0.45)}`,
            }}
          >
            <Icon name="Building2" size={84} color={INK} />
            <div style={{ fontFamily: SERIF, fontSize: 52, color: INK, marginTop: 8 }}>{spec.center.label}</div>
          </div>
        </Reveal>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: qp }}>
        <div style={{ translate: `0 ${(1 - qp) * 30}px`, textAlign: "center" }}>
          <div style={{ fontFamily: SANS, fontSize: 30, letterSpacing: "0.3em", color, fontWeight: 700, marginBottom: 24 }}>
            THE BIG QUESTION
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 112, color: INK, lineHeight: 1.05 }}>{spec.question.text}</div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "black", opacity: fadeFromBlack }} />
    </SceneShell>
  );
};

// ─────────────── Title card ───────────────
export const TitleLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "title");
  const { frame, color } = useScene(spec);
  const words = spec.title.split(" ");
  const streak = interpolate(frame, [20, 80], [-20, 120], { ...CLAMP, easing: EASE });
  const line = prog(frame, 30, 50);
  return (
    <SceneShell spec={spec} swish={false} push={0.05}>
      <Audio src={staticFile("sfx/whoosh.wav")} volume={0.5} />
      <Audio src={staticFile("sfx/boom.wav")} from={14} volume={0.5} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", paddingBottom: 40 }}>
        <Reveal at={6} dy={20}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.28em", color, textTransform: "uppercase" }}>
            {spec.kicker}
          </div>
        </Reveal>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: 1600, marginTop: 30, gap: "0 34px" }}>
          {words.map((w, i) => {
            const p = prog(frame, 14 + i * 7, 34);
            return (
              <div key={w} style={{ overflow: "hidden", paddingBottom: 12 }}>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontWeight: 600,
                    fontSize: 150,
                    lineHeight: 1.04,
                    color: INK,
                    translate: `0 ${(1 - p) * 110}%`,
                    letterSpacing: "-0.015em",
                  }}
                >
                  {w}
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            height: 3,
            width: 900 * line,
            marginTop: 34,
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          }}
        />
        <Reveal at={50} dy={20}>
          <Sub style={{ marginTop: 34, fontSize: 42 }}>{spec.subtitle}</Sub>
        </Reveal>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(105deg, transparent ${streak - 8}%, ${alpha(color, 0.18)} ${streak}%, transparent ${streak + 8}%)`,
          mixBlendMode: "screen",
        }}
      />
    </SceneShell>
  );
};

// ─────────────── Roadmap ───────────────
export const RoadmapLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "roadmap");
  const { frame, cues, color, kicker } = useScene(spec);
  const starts = spec.items.map((i) => cues.at(i.at));
  const release = cues.end(spec.items[spec.items.length - 1].at) + 6;
  const spots = spotlight(frame, starts, release);
  return (
    <SceneShell spec={spec}>
      <Heading kicker={kicker} title={spec.heading} color={color} />
      <div style={{ position: "absolute", top: 286, left: 260, right: 260, display: "flex", flexDirection: "column", gap: 16 }}>
        {spec.items.map((item, i) => (
          <Reveal key={item.num} at={starts[i]} dx={-60} dy={0}>
            <Card
              accent={color}
              active={spots[i]}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 40,
                padding: "12px 36px",
                opacity: dimmed(spots[i], frame, release),
              }}
            >
              <div style={{ fontFamily: SERIF, fontSize: 54, color, width: 120, fontWeight: 600 }}>{item.num}</div>
              <div style={{ flex: 1 }}>
                <Label size={40}>{item.title}</Label>
                <Sub style={{ fontSize: 28, marginTop: 2 }}>{item.sub}</Sub>
              </div>
            </Card>
          </Reveal>
        ))}
      </div>
    </SceneShell>
  );
};

// ─────────────── Chapter cards ───────────────
export const ChapterLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "chapter");
  const { frame, color } = useScene(spec);
  const fill = interpolate(frame, [10, 70], [0, 100], { ...CLAMP, easing: EASE });
  const streak = interpolate(frame, [8, 70], [-20, 120], { ...CLAMP, easing: EASE });
  const line = prog(frame, 22, 50);
  const num = String(spec.num).padStart(2, "0");
  return (
    <SceneShell spec={spec} swish={false} push={0.06}>
      <Audio src={staticFile("sfx/whoosh.wav")} volume={0.55} />
      <Audio src={staticFile("sfx/boom.wav")} from={12} volume={0.6} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <div style={{ position: "relative", height: 380, marginTop: -60 }}>
          <div
            style={{
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 400,
              lineHeight: 1,
              color: "transparent",
              WebkitTextStroke: `3px ${alpha(color, 0.55)}`,
              opacity: prog(frame, 0, 20),
              scale: String(1.08 - 0.08 * prog(frame, 0, 60)),
            }}
          >
            {num}
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              fontFamily: SERIF,
              fontWeight: 700,
              fontSize: 400,
              lineHeight: 1,
              background: `linear-gradient(180deg, ${color}, ${alpha(color, 0.25)})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              clipPath: `inset(0 ${100 - fill}% 0 0)`,
              scale: String(1.08 - 0.08 * prog(frame, 0, 60)),
              opacity: 0.9,
            }}
          >
            {num}
          </div>
        </div>
        <Reveal at={14} dy={16}>
          <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: 30, letterSpacing: "0.3em", color, marginTop: 10 }}>
            CHAPTER {spec.num} · SYLLABUS {spec.code}
          </div>
        </Reveal>
        <Reveal at={20} dy={30}>
          <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: spec.title.length > 24 ? 100 : 120, color: INK, marginTop: 18, textAlign: "center", lineHeight: 1.05 }}>
            {spec.title}
          </div>
        </Reveal>
        <div style={{ height: 3, width: 700 * line, marginTop: 30, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
        <Reveal at={34} dy={20}>
          <Sub style={{ marginTop: 26, fontSize: 44, color: MUTED, fontStyle: "italic", fontFamily: SERIF }}>{spec.subtitle}</Sub>
        </Reveal>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(100deg, transparent ${streak - 6}%, ${alpha(color, 0.22)} ${streak}%, transparent ${streak + 6}%)`,
          mixBlendMode: "screen",
        }}
      />
    </SceneShell>
  );
};

// ─────────────── End card ───────────────
export const EndLayout: React.FC<SceneProps> = ({ sceneId }) => {
  const spec = getSpec(sceneId, "end");
  const { frame, cues, color } = useScene(spec);
  const toBlack = interpolate(frame, [cues.total - 70, cues.total - 5], [0, 1], CLAMP);
  return (
    <SceneShell spec={spec} push={0.05}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <Reveal at={6} scale dy={0}>
          <IconBadge name="BadgeCheck" color={color} size={170} glow={0.8} />
        </Reveal>
        <Reveal at={14} dy={30}>
          <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 140, color: INK, marginTop: 40 }}>{spec.title}</div>
        </Reveal>
        <Reveal at={24} dy={20}>
          <Sub style={{ fontSize: 46, marginTop: 10 }}>{spec.sub}</Sub>
        </Reveal>
        <Reveal at={cues.end("L0")} dy={16}>
          <div style={{ fontFamily: SANS, fontSize: 30, letterSpacing: "0.3em", color, marginTop: 60, fontWeight: 700 }}>
            NEXT UP · UNIT 2: PEOPLE IN BUSINESS
          </div>
        </Reveal>
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "black", opacity: toBlack }} />
    </SceneShell>
  );
};
