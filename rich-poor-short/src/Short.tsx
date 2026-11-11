import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Background } from "./components/Background";
import { Captions } from "./components/Captions";
import { Soundtrack } from "./components/Soundtrack";
import { BankScene } from "./scenes/BankScene";
import { Compound } from "./scenes/Compound";
import { Faster } from "./scenes/Faster";
import { Flow } from "./scenes/Flow";
import { Grow } from "./scenes/Grow";
import { Hook } from "./scenes/Hook";
import { Invest } from "./scenes/Invest";
import { Later } from "./scenes/Later";
import { Meet } from "./scenes/Meet";
import { Outro } from "./scenes/Outro";
import { Spend } from "./scenes/Spend";
import { C, fontFamily } from "./theme";
import { IMPACTS, SCENES } from "./timing";

/** Subtle zoom + shake of the whole stage on the key numbers. */
const useCameraPunch = () => {
  const frame = useCurrentFrame();
  let x = 0;
  let y = 0;
  let zoom = 0;
  for (const impact of IMPACTS) {
    const dt = frame - impact.frame;
    if (dt < 0 || dt > 18) continue;
    const a = impact.strength * Math.exp(-dt / 4.5);
    x += Math.sin(dt * 2.4) * a * 9;
    y += Math.cos(dt * 3.1) * a * 7;
    zoom += a * 0.045;
  }
  return { translate: `${x}px ${y}px`, scale: String(1 + zoom) };
};

export const Short: React.FC = () => {
  const punch = useCameraPunch();
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily }}>
      <Background />
      <AbsoluteFill name="Stage" style={punch}>
        <Sequence name="Hook" {...SCENES.hook}>
          <Hook />
        </Sequence>
        <Sequence name="Meet Rahul and Vikram" {...SCENES.meet}>
          <Meet />
        </Sequence>
        <Sequence name="Rahul spends first" {...SCENES.spend}>
          <Spend />
        </Sequence>
        <Sequence name="His money works for the bank" {...SCENES.bank}>
          <BankScene />
        </Sequence>
        <Sequence name="Vikram invests first" {...SCENES.invest}>
          <Invest />
        </Sequence>
        <Sequence name="10 years later" {...SCENES.later}>
          <Later />
        </Sequence>
        <Sequence name="24 lakh grew to 46 lakh" {...SCENES.grow}>
          <Grow />
        </Sequence>
        <Sequence name="Compounding" {...SCENES.compound}>
          <Compound />
        </Sequence>
        <Sequence name="It keeps getting faster" {...SCENES.faster}>
          <Faster />
        </Sequence>
        <Sequence name="Pay vs collect interest" {...SCENES.flow}>
          <Flow />
        </Sequence>
        <Sequence name="Outro + loop" {...SCENES.outro}>
          <Outro />
        </Sequence>
      </AbsoluteFill>
      <Captions />
      <Soundtrack />
    </AbsoluteFill>
  );
};
