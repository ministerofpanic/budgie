import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { BirdMark } from "../components/BirdMark";
import { Headline } from "../components/Headline";
import { CheckIcon } from "../components/icons";
import { colors, fontFamily } from "../theme";

const points = ["No subscription, ever", "Self-hosted - your data, your server", "Open by design"];

const Point = ({ text, delay }: { readonly text: string; readonly delay: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14 },
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        opacity: progress,
        transform: `translateY(${(1 - progress) * 16}px)`,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: colors.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <CheckIcon size={18} />
      </div>
      <span
        style={{
          fontFamily,
          fontSize: 34,
          color: colors.paper,
          fontWeight: 500,
        }}
      >
        {text}
      </span>
    </div>
  );
};

const Closing = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const markProgress = spring({ frame, fps, config: { damping: 10 } });
  const ctaOpacity = interpolate(frame - 130, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <Background>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 64,
        }}
      >
        <div style={{ transform: `scale(${markProgress})` }}>
          <BirdMark size={110} />
        </div>
        <Headline text="Budgeting you actually own." size={58} startFrame={12} highlight="own." />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {points.map((text, index) => (
            <Point key={text} text={text} delay={55 + index * 18} />
          ))}
        </div>
        <div
          style={{
            fontFamily,
            fontSize: 30,
            color: colors.muted,
            opacity: ctaOpacity,
            fontWeight: 600,
            letterSpacing: 1,
          }}
        >
          Try Budgie today
        </div>
      </div>
    </Background>
  );
};

export { Closing };
