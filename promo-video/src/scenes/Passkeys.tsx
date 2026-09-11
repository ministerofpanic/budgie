import { FeatureScene } from "../components/FeatureScene";
import { FingerprintIcon } from "../components/icons";

const Passkeys = () => (
  <FeatureScene
    icon={<FingerprintIcon size={64} />}
    headline="No passwords. Ever."
    highlight="Ever."
    caption="Sign in with a passkey - Face ID, Touch ID, or your device's own security. Nothing to leak."
  />
);

export { Passkeys };
