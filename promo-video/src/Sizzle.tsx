import { Sequence } from "remotion";
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
  { Component: Opening, duration: 90 },
  { Component: Problem, duration: 90 },
  { Component: BudgetDemo, duration: 210 },
  { Component: BankSync, duration: 120 },
  { Component: Reports, duration: 120 },
  { Component: MultiCurrency, duration: 120 },
  { Component: Offline, duration: 120 },
  { Component: Passkeys, duration: 120 },
  { Component: SharedBudgets, duration: 120 },
  { Component: NoLockIn, duration: 120 },
  { Component: Closing, duration: 240 },
] as const;

export const TOTAL_DURATION = scenes.reduce((sum, scene) => sum + scene.duration, 0);

const scenesWithOffsets = scenes.map((scene, index) => {
  const from = scenes.slice(0, index).reduce((sum, prior) => sum + prior.duration, 0);
  return { Component: scene.Component, duration: scene.duration, from };
});

const Sizzle = () => (
  <div style={{ width: "100%", height: "100%", background: colors.bg }}>
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
