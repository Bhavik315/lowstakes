import React from "react";
import { AbsoluteFill, Composition, Folder } from "remotion";
import { Background } from "./components/Background";
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
import { Short } from "./Short";
import { C, fontFamily } from "./theme";
import { DURATION, FPS, SCENES, SceneName } from "./timing";

const SCENE_COMPONENTS: Record<SceneName, React.FC> = {
  hook: Hook,
  meet: Meet,
  spend: Spend,
  bank: BankScene,
  invest: Invest,
  later: Later,
  grow: Grow,
  compound: Compound,
  faster: Faster,
  flow: Flow,
  outro: Outro,
};

// Lets each scene be previewed on its own in the Studio, on the same backdrop.
const preview = (Scene: React.FC): React.FC => {
  const Preview = () => (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily }}>
      <Background />
      <Scene />
    </AbsoluteFill>
  );
  return Preview;
};

const PREVIEWS = (Object.keys(SCENE_COMPONENTS) as SceneName[]).map((name) => ({
  name,
  component: preview(SCENE_COMPONENTS[name]),
}));

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Durations follow the voiceover (src/timing.ts), so they are not hard-coded here. */}
      <Composition
        id="Short"
        component={Short}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Folder name="Scenes">
        {PREVIEWS.map(({ name, component }) => (
          <Composition
            key={name}
            id={`scene-${name}`}
            component={component}
            durationInFrames={SCENES[name].durationInFrames}
            fps={FPS}
            width={1080}
            height={1920}
          />
        ))}
      </Folder>
    </>
  );
};
