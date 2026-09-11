import { interpolate, useCurrentFrame } from "remotion";

/** Cheap cross-fade at each scene boundary so cuts aren't jarring - avoids
 * pulling in @remotion/transitions for one effect. */
const SceneFade = ({
  children,
  durationInFrames,
  fadeFrames = 14,
}: {
  readonly children: React.ReactNode;
  readonly durationInFrames: number;
  readonly fadeFrames?: number;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return <div style={{ width: "100%", height: "100%", opacity }}>{children}</div>;
};

export { SceneFade };
