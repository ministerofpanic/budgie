import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../theme";

/** Frames a real app screenshot (captured via Playwright at 390x844@2x -
 * see apps/web/e2e/capture-screenshots.spec.ts) like a phone, with a
 * settle-in entrance so real UI, not just motion graphics, carries scenes. */
const PhoneShot = ({
  src,
  width = 560,
  delay = 0,
}: {
  readonly src: string;
  readonly width?: number;
  readonly delay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 16, mass: 0.9 } });
  const translateY = interpolate(progress, [0, 1], [90, 0]);
  const scale = interpolate(progress, [0, 1], [0.92, 1]);
  const height = width * (844 / 390);

  return (
    <div
      style={{
        opacity: progress,
        transform: `translateY(${translateY}px) scale(${scale})`,
      }}
    >
      <div
        style={{
          width: width + 14,
          padding: 7,
          borderRadius: 44,
          background: "linear-gradient(155deg, #2a2a2a, #0a0a0a)",
          boxShadow: `0 40px 90px -30px #000000cc, 0 0 0 1px ${colors.primary}22`,
        }}
      >
        <div
          style={{
            width,
            height,
            borderRadius: 38,
            overflow: "hidden",
            background: "white",
          }}
        >
          <Img src={staticFile(src)} width={width} height={height} style={{ display: "block" }} />
        </div>
      </div>
    </div>
  );
};

export { PhoneShot };
