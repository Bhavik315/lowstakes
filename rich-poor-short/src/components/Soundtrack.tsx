import React from "react";
import { staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { DURATION, IMPACTS, SCENES, T } from "../timing";

type Sfx = "whoosh" | "pop" | "ding" | "impact" | "count" | "down" | "riser";
type Hit = { sfx: Sfx; frame: number; volume: number };

const at = (sfx: Sfx, volume: number, frames: number[]): Hit[] =>
  frames.map((frame) => ({ sfx, frame, volume }));

const HITS: Hit[] = [
  // a whoosh on every scene change
  ...at(
    "whoosh",
    0.3,
    Object.values(SCENES)
      .map((s) => s.from - 4)
      .filter((f) => f > 0),
  ),
  // pops when things appear
  ...at("pop", 0.36, [
    T.rahul,
    T.vikram,
    T.both + 4,
    T.spends,
    T.phone,
    T.emi,
    T.credit,
    T.invests,
    T.every,
    T.every + 9,
    T.every + 18,
    T.into - 3,
    T.rahulHas,
    T.threeLoans,
    T.threeLoans + 6,
    T.threeLoans + 12,
    T.vikramQ,
    T.faster,
    T.hisFirst,
    T.threeYears,
    T.hisLatest,
    T.pay,
    T.startSmall,
    T.nextTime,
    T.asks,
  ]),
  // ticking run under the rupee counters
  ...at("count", 0.26, [T.fifty, T.twentyK, T.tenYears, T.he + 4, T.grew, T.took]),
  // thud on the key numbers (same frames as the camera punch)
  ...IMPACTS.map((i) => ({
    sfx: "impact" as const,
    frame: i.frame,
    volume: 0.42 * Math.min(1, i.strength),
  })),
  // coins
  ...at("ding", 0.24, [
    T.hisMoney + 19,
    T.hisMoney + 34,
    T.index + 6,
    T.money1,
    T.money2,
    T.money3,
    T.money4,
    T.sixteen + 14,
    T.collect + 4,
    T.startToday,
    T.startToday + 8,
  ]),
  // bad news for Rahul
  ...at("down", 0.3, [T.interest + 6, T.threeLoans + 20]),
  // build-up into "compounding" and into the loop point
  ...at("riser", 0.26, [T.compounding - 27, DURATION - 27]),
];

export const Soundtrack: React.FC = () => (
  <>
    <Audio name="Voiceover" src={staticFile("voiceover.wav")} />
    <Audio name="Beat" src={staticFile("beat.wav")} volume={0.13} />
    {HITS.map((hit, i) => (
      <Audio
        key={i}
        name={hit.sfx}
        from={Math.max(0, hit.frame)}
        src={staticFile(`sfx/${hit.sfx}.wav`)}
        volume={hit.volume}
      />
    ))}
  </>
);
