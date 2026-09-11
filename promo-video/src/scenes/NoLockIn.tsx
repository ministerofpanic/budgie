import { FeatureScene } from "../components/FeatureScene";
import { DownloadIcon } from "../components/icons";

const NoLockIn = () => (
  <FeatureScene
    icon={<DownloadIcon size={64} />}
    headline="Your data. Never locked in."
    highlight="locked"
    caption="Import and export via CSV, any time. No payment wall, anywhere."
  />
);

export { NoLockIn };
