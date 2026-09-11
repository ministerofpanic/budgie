import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fontFamily } from "../theme";

const Word = ({
  word,
  delay,
  highlighted,
}: {
  readonly word: string;
  readonly delay: number;
  readonly highlighted: boolean;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({ frame: frame - delay, fps, config: { damping: 14, mass: 0.6 } });
  const translateY = interpolate(progress, [0, 1], [40, 0]);

  return (
    <span
      style={{
        display: "inline-block",
        transform: `translateY(${translateY}px)`,
        opacity: progress,
        marginRight: "0.28em",
        color: highlighted ? colors.highlight : undefined,
      }}
    >
      {word}
    </span>
  );
};

const Headline = ({
  text,
  size = 76,
  color = colors.paper,
  align = "center",
  startFrame = 0,
  highlight,
}: {
  readonly text: string;
  readonly size?: number;
  readonly color?: string;
  readonly align?: "center" | "left";
  readonly startFrame?: number;
  readonly highlight?: string;
}) => {
  const words = text.split(" ");
  return (
    <div
      style={{
        fontFamily,
        fontSize: size,
        fontWeight: 700,
        color,
        textAlign: align,
        lineHeight: 1.12,
        letterSpacing: -1,
      }}
    >
      {words.map((word, index) => (
        <Word
          key={`${word}-${String(index)}`}
          word={word}
          delay={startFrame + index * 3}
          highlighted={
            highlight !== undefined &&
            word.replace(/[.,!?]/g, "") === highlight.replace(/[.,!?]/g, "")
          }
        />
      ))}
    </div>
  );
};

export { Headline };
