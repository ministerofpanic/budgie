import { Composition } from "remotion";
import { Sizzle, TOTAL_DURATION } from "./Sizzle";
import { FPS, HEIGHT, WIDTH } from "./theme";

const Root = () => (
  <>
    <Composition
      id="Sizzle"
      component={Sizzle}
      durationInFrames={TOTAL_DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);

export { Root };
