import { useCurrentFrame } from "remotion";
import { colors } from "../theme";

/** A slow, continuous drift so no scene ever sits on a dead-static frame. */
const Background = ({ children }: { readonly children: React.ReactNode }) => {
  const frame = useCurrentFrame();
  const shiftX = Math.sin(frame / 140) * 15;
  const shiftY = Math.cos(frame / 180) * 10;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `
          radial-gradient(60% 45% at ${50 + shiftX}% ${20 + shiftY}%, ${colors.primary}33 0%, transparent 100%),
          radial-gradient(55% 40% at ${80 - shiftX}% ${85 - shiftY}%, ${colors.gold}1c 0%, transparent 100%),
          ${colors.bg}
        `,
        position: "relative",
      }}
    >
      {children}
    </div>
  );
};

export { Background };
