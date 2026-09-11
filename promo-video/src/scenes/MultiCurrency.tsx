import { FeatureScene } from "../components/FeatureScene";
import { GlobeIcon } from "../components/icons";

const MultiCurrency = () => (
  <FeatureScene
    icon={<GlobeIcon size={64} />}
    headline="Multi-currency accounts."
    highlight="accounts."
    caption="Hold an account in a different currency to your budget - rates fetched and editable per transaction."
  />
);

export { MultiCurrency };
