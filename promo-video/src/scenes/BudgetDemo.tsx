import { Background } from "../components/Background";
import { Headline } from "../components/Headline";
import { PhoneShot } from "../components/PhoneShot";

const BudgetDemo = () => (
  <Background>
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
      }}
    >
      <Headline text="Give every pound a job." size={54} startFrame={4} highlight="job." />

      <PhoneShot src="screens/budget-grid.png" width={480} delay={22} />

      <Headline
        text="Zero-based budgeting, done right."
        size={34}
        startFrame={50}
        highlight="right."
      />
    </div>
  </Background>
);

export { BudgetDemo };
