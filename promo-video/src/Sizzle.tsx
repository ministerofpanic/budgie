import { Audio, interpolate, Sequence, staticFile } from "remotion";
import { SceneFade } from "./components/SceneFade";
import { colors } from "./theme";

import { Opening } from "./scenes/Opening";
import { Problem } from "./scenes/Problem";
import { BudgetDemo } from "./scenes/BudgetDemo";
import { BankSync } from "./scenes/BankSync";
import { Reports } from "./scenes/Reports";
import { MultiCurrency } from "./scenes/MultiCurrency";
import { Offline } from "./scenes/Offline";
import { Passkeys } from "./scenes/Passkeys";
import { SharedBudgets } from "./scenes/SharedBudgets";
import { NoLockIn } from "./scenes/NoLockIn";
import { Closing } from "./scenes/Closing";

const scenes = [
  { Component: Opening, duration: 100 },
  { Component: Problem, duration: 150 },
  { Component: BudgetDemo, duration: 150 },
  { Component: BankSync, duration: 150 },
  { Component: Reports, duration: 150 },
  { Component: MultiCurrency, duration: 130 },
  { Component: Offline, duration: 130 },
  { Component: Passkeys, duration: 130 },
  { Component: SharedBudgets, duration: 130 },
  { Component: NoLockIn, duration: 150 },
  { Component: Closing, duration: 300 },
] as const;

export const TOTAL_DURATION = scenes.reduce((sum, scene) => sum + scene.duration, 0);

const scenesWithOffsets = scenes.map((scene, index) => {
  const from = scenes.slice(0, index).reduce((sum, prior) => sum + prior.duration, 0);
  return { Component: scene.Component, duration: scene.duration, from };
});

const MUSIC_FADE_OUT_FRAMES = 60;

const musicVolume = (frame: number) =>
  interpolate(frame, [TOTAL_DURATION - MUSIC_FADE_OUT_FRAMES, TOTAL_DURATION], [0.7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const Sizzle = () => (
  <div style={{ width: "100%", height: "100%", background: colors.bg }}>
    <Audio
      src={staticFile("bossa-antiguo-aaron-paul-low-main-version-21227-01-00.mp3")}
      volume={musicVolume}
    />
    {scenesWithOffsets.map(({ Component, duration, from }) => (
      <Sequence key={Component.name} from={from} durationInFrames={duration} name={Component.name}>
        <SceneFade durationInFrames={duration}>
          <Component />
        </SceneFade>
      </Sequence>
    ))}
  </div>
);

export { Sizzle };
