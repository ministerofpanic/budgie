import { Background } from "./Background";
import { Headline } from "./Headline";
import { Caption } from "./Caption";
import { PhoneShot } from "./PhoneShot";

const ScreenshotScene = ({
  src,
  headline,
  highlight,
  caption,
}: {
  readonly src: string;
  readonly headline: string;
  readonly highlight?: string;
  readonly caption: string;
}) => (
  <Background>
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 34,
        padding: "0 70px",
      }}
    >
      <Headline text={headline} size={58} highlight={highlight} startFrame={4} />
      <Caption text={caption} delay={16} size={30} />
      <div style={{ marginTop: 10 }}>
        <PhoneShot src={src} width={540} delay={12} />
      </div>
    </div>
  </Background>
);

export { ScreenshotScene };
