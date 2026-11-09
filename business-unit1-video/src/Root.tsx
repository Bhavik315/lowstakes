import React from "react";
import { Composition, Folder } from "remotion";
import { Background } from "./components/Atmosphere";
import { SCENES } from "./content/script";
import { FPS, HEIGHT, WIDTH } from "./lib/theme";
import { sceneFrames, TOTAL_FRAMES } from "./lib/timing";
import { LAYOUTS } from "./scenes";
import { IGCSEBusinessUnit1 } from "./Video";

/** A scene previewed on its own, over the same backdrop as the main video. */
const ScenePreview: React.FC<{ sceneId: string }> = ({ sceneId }) => {
  const spec = SCENES.find((s) => s.id === sceneId)!;
  const Layout = LAYOUTS[spec.kind];
  return (
    <>
      <Background />
      <Layout sceneId={sceneId} />
    </>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="IGCSEBusinessUnit1"
        component={IGCSEBusinessUnit1}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ captions: true }}
      />
      <Folder name="Scenes">
        {SCENES.map((s) => (
          <Composition
            key={s.id}
            id={`scene-${s.id}`}
            component={ScenePreview}
            durationInFrames={sceneFrames(s)}
            fps={FPS}
            width={WIDTH}
            height={HEIGHT}
            defaultProps={{ sceneId: s.id }}
          />
        ))}
      </Folder>
    </>
  );
};
