import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption, TikTokPage } from "@remotion/captions";
import captionData from "../data/captions.json";
import { jolt, linear, pop } from "../anim";
import { C } from "../theme";
import { DURATION, SCENES } from "../timing";

const captions: Caption[] = captionData;

// These get the extra zoom + shake when spoken.
const KEY_WORDS = /^(₹10 lakh|compounding|36%|₹46 lakh|16 months)/i;

const outline = (px: number, color: string) =>
  Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `${(Math.cos(a) * px).toFixed(1)}px ${(Math.sin(a) * px).toFixed(1)}px 0 ${color}`;
  }).join(", ") + `, 0 14px 0 rgba(0,0,0,0.55)`;

const SHADOW = outline(9, "#07070a");

const Page: React.FC<{ page: TikTokPage }> = ({ page }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = page.startMs + (frame / fps) * 1000;
  const enter = pop(frame, 0, 0.7);

  return (
    <AbsoluteFill
      style={{
        top: 1150,
        height: 360,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          columnGap: 30,
          rowGap: 4,
          maxWidth: 940,
          scale: String(0.8 + 0.2 * enter),
        }}
      >
        {page.tokens.map((token, i) => {
          const word = token.text.trim();
          const active = token.fromMs <= nowMs && nowMs < token.toMs;
          const said = nowMs >= token.toMs;
          const key = KEY_WORDS.test(word);
          const startFrame = ((token.fromMs - page.startMs) / 1000) * fps;
          const hit = pop(frame, startFrame, 1.2);
          const shake = key ? jolt(frame, startFrame, 12) : { x: 0, y: 0 };
          const grow = key ? 0.1 : 0.07;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                fontSize: 90,
                fontWeight: 900,
                lineHeight: 1.12,
                textTransform: "uppercase",
                whiteSpace: "pre",
                margin: key ? "0 30px" : 0,
                color: active ? C.yellow : C.white,
                opacity: active || said ? 1 : 0.6,
                textShadow: SHADOW,
                translate: `${shake.x}px ${shake.y}px`,
                scale: String(
                  active ? 1 + grow * (2 - hit) * 0.5 + grow * 0.5 : 1,
                ),
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Word-by-word captions in the middle-lower third, timed by edge-tts word boundaries. */
export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pages = useMemo(
    () =>
      createTikTokStyleCaptions({
        captions,
        // page breaks are decided in scripts/generate_voiceover.py (pageBreakAfter)
        combineTokensWithinMilliseconds: 100000,
      }).pages,
    [],
  );
  // The hook question is already huge on screen, so captions start after it.
  const firstFrame = SCENES.meet.from;

  return (
    <AbsoluteFill
      style={{ opacity: 1 - linear(frame, DURATION - 10, DURATION - 4) }}
    >
      {pages.map((page, i) => {
        const next = pages[i + 1];
        const from = Math.round((page.startMs / 1000) * fps);
        const lastToken = page.tokens[page.tokens.length - 1];
        const to = Math.min(
          next ? Math.round((next.startMs / 1000) * fps) : DURATION,
          Math.round(((lastToken.toMs + 600) / 1000) * fps),
        );
        if (from < firstFrame || to <= from) {
          return null;
        }
        return (
          <Sequence
            key={i}
            name={page.text}
            from={from}
            durationInFrames={to - from}
            premountFor={0}
          >
            <Page page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
