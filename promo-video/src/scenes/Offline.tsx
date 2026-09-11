import { FeatureScene } from "../components/FeatureScene";
import { WifiOffIcon } from "../components/icons";

const Offline = () => (
  <FeatureScene
    icon={<WifiOffIcon size={64} />}
    headline="Works with no connection."
    highlight="connection."
    caption="Installable, offline-first, and syncs safely when you're back - never silently overwriting someone else's edit."
  />
);

export { Offline };
