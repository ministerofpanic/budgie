import { Background } from "../components/Background";
import { Headline } from "../components/Headline";

const Problem = () => (
  <Background>
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        padding: "0 100px",
      }}
    >
      <Headline text="Your bank app shows what you spent." size={54} startFrame={0} />
      <Headline
        text="Not what's actually free to spend."
        size={54}
        startFrame={30}
        highlight="free"
      />
    </div>
  </Background>
);

export { Problem };
