import { Sequence } from "remotion";
import { SceneFade } from "./components/SceneFade";
import { colors } from "./theme";

import { Opening } from "./scenes/Opening";
import { Problem } from "./scenes/Problem";
import { BudgetDemo } from "./scenes/BudgetDemo";
import { BankSync } from "./scenes/BankSync";
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
  { Component: MultiCurrency, duration: 120 },
  { Component: Offline, duration: 120 },
  { Component: Passkeys, duration: 120 },
  { Component: SharedBudgets, duration: 120 },
  { Component: NoLockIn, duration: 120 },
  { Component: Closing, duration: 240 },
] as const;

export const TOTAL_DURATION = scenes.reduce((sum, scene) => sum + scene.duration, 0);

const Sizzle = () => {
  let from = 0;
  return (
    <div style={{ width: "100%", height: "100%", background: colors.bg }}>
      {scenes.map(({ Component, duration }, index) => {
        const sequenceFrom = from;
        from += duration;
        return (
          <Sequence
            key={index}
            from={sequenceFrom}
            durationInFrames={duration}
            name={Component.name}
          >
            <SceneFade durationInFrames={duration}>
              <Component />
            </SceneFade>
          </Sequence>
        );
      })}
    </div>
  );
};

export { Sizzle };
