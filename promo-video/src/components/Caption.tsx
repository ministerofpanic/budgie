import { interpolate, useCurrentFrame } from "remotion";
import { colors, fontFamily } from "../theme";

const Caption = ({
  text,
  delay = 0,
  size = 34,
}: {
  readonly text: string;
  readonly delay?: number;
  readonly size?: number;
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(frame - delay, [0, 15], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        fontFamily,
        fontSize: size,
        color: colors.muted,
        textAlign: "center",
        fontWeight: 500,
        opacity,
        transform: `translateY(${translateY}px)`,
        maxWidth: 780,
      }}
    >
      {text}
    </div>
  );
};

export { Caption };
