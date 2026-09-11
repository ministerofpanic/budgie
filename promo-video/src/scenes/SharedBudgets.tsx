import { FeatureScene } from "../components/FeatureScene";
import { UsersIcon } from "../components/icons";

const SharedBudgets = () => (
  <FeatureScene
    icon={<UsersIcon size={64} />}
    headline="Budget with the people you live your life with."
    highlight="life"
    caption="Shared budgets with owner, editor, and viewer roles."
  />
);

export { SharedBudgets };
