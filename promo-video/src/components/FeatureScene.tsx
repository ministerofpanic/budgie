import { Background } from "./Background";
import { IconBadge } from "./IconBadge";
import { Headline } from "./Headline";
import { Caption } from "./Caption";

const FeatureScene = ({
  icon,
  headline,
  highlight,
  caption,
}: {
  readonly icon: React.ReactNode;
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
        gap: 48,
        padding: "0 90px",
      }}
    >
      <IconBadge>{icon}</IconBadge>
      <Headline text={headline} highlight={highlight} startFrame={8} />
      <Caption text={caption} delay={22} />
    </div>
  </Background>
);

export { FeatureScene };
