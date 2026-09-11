import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../theme";

const IconBadge = ({
  children,
  delay = 0,
  size = 160,
}: {
  readonly children: React.ReactNode;
  readonly delay?: number;
  readonly size?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 11 } });

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "28%",
        background: `linear-gradient(155deg, ${colors.primary}, ${colors.primaryLight})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${progress}) rotate(${(1 - progress) * -20}deg)`,
        opacity: progress,
        boxShadow: `0 20px 60px -20px ${colors.primary}aa`,
      }}
    >
      {children}
    </div>
  );
};

export { IconBadge };
