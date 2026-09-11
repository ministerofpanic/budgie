import { FeatureScene } from "../components/FeatureScene";
import { BankIcon } from "../components/icons";

const BankSync = () => (
  <FeatureScene
    icon={<BankIcon size={64} />}
    headline="Real bank sync."
    highlight="sync."
    caption="Connect your accounts via Open Banking - transactions arrive automatically, no manual entry."
  />
);

export { BankSync };
