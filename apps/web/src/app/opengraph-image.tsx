import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const containerStyle = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "flex-start",
  gap: 24,
  padding: 96,
  background: "#0f1614",
  color: "#fbfdfb",
} as const;

const badgeRowStyle = { display: "flex", alignItems: "center", gap: 20 } as const;

const badgeStyle = {
  display: "flex",
  width: 84,
  height: 84,
  borderRadius: 20,
  background: "#1f6b52",
} as const;

const wordmarkStyle = { fontSize: 72, fontWeight: 700 } as const;

const taglineStyle = { fontSize: 36, color: "#a8b8b2", maxWidth: 900 } as const;

const OpengraphImage = () =>
  new ImageResponse(
    <div style={containerStyle}>
      <div style={badgeRowStyle}>
        <div style={badgeStyle} />
        <div style={wordmarkStyle}>Budgie</div>
      </div>
      <div style={taglineStyle}>Give every pound a job, before you spend it.</div>
    </div>,
    { ...size },
  );

export default OpengraphImage;
