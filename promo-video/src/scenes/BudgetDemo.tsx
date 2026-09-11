import { interpolate, useCurrentFrame } from "remotion";
import { Background } from "../components/Background";
import { Headline } from "../components/Headline";
import { colors, fontFamily } from "../theme";

const money = (pounds: number) =>
  `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const categories = [
  { name: "Rent", target: 900, delay: 70 },
  { name: "Groceries", target: 300, delay: 90 },
  { name: "Transport", target: 100, delay: 110 },
  { name: "Dining Out", target: 50, delay: 130 },
];

const TOTAL_READY = categories.reduce((sum, c) => sum + c.target, 0);

const CategoryRow = ({
  name,
  target,
  delay,
}: {
  readonly name: string;
  readonly target: number;
  readonly delay: number;
}) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame - delay, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fillProgress = interpolate(frame - delay - 6, [0, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const amount = target * fillProgress;

  return (
    <div
      style={{
        opacity: reveal,
        transform: `translateX(${(1 - reveal) * -30}px)`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: 760,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily,
          color: colors.paper,
          fontSize: 34,
          fontWeight: 600,
        }}
      >
        <span>{name}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(amount)}</span>
      </div>
      <div
        style={{
          height: 14,
          borderRadius: 999,
          background: "#ffffff14",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${String(fillProgress * 100)}%`,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${colors.primary}, ${colors.primaryLight})`,
          }}
        />
      </div>
    </div>
  );
};

const BudgetDemo = () => {
  const frame = useCurrentFrame();
  const assignedSoFar = categories.reduce((sum, c) => {
    const fillProgress = interpolate(frame - c.delay - 6, [0, 26], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return sum + c.target * fillProgress;
  }, 0);
  const readyToAssign = Math.max(0, TOTAL_READY - assignedSoFar);

  return (
    <Background>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily,
              fontSize: 28,
              color: colors.muted,
              textTransform: "uppercase",
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            Ready to Assign
          </div>
          <div
            style={{
              fontFamily,
              fontSize: 96,
              fontWeight: 800,
              color: readyToAssign <= 0.5 ? colors.primaryLight : colors.paper,
              fontVariantNumeric: "tabular-nums",
              letterSpacing: -2,
            }}
          >
            {money(readyToAssign)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {categories.map((category) => (
            <CategoryRow key={category.name} {...category} />
          ))}
        </div>

        <div style={{ height: 8 }}>
          <Headline
            text="Zero-based budgeting, done right."
            size={40}
            startFrame={140}
            highlight="right."
          />
        </div>
      </div>
    </Background>
  );
};

export { BudgetDemo };
