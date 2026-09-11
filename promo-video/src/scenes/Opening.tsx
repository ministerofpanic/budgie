import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { BirdMark } from "../components/BirdMark";
import { Headline } from "../components/Headline";
import { colors, fontFamily } from "../theme";

const Opening = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const markProgress = spring({ frame, fps, config: { damping: 10 } });
  const wordmarkOpacity = interpolate(frame, [10, 25], [0, 1], {
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
          gap: 36,
        }}
      >
        <div style={{ transform: `scale(${markProgress})` }}>
          <BirdMark size={150} />
        </div>
        <div
          style={{
            fontFamily,
            fontSize: 88,
            fontWeight: 800,
            color: colors.paper,
            opacity: wordmarkOpacity,
            letterSpacing: -2,
          }}
        >
          Budgie
        </div>
        <div style={{ marginTop: 8 }}>
          <Headline text="Give every pound a job." size={46} startFrame={35} highlight="job." />
        </div>
      </div>
    </Background>
  );
};

export { Opening };
