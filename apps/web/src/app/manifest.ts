import type { MetadataRoute } from "next";

const manifest = (): MetadataRoute.Manifest => ({
  name: "Budgie",
  short_name: "Budgie",
  description: "Give every pound a job, before you spend it.",
  start_url: "/budget",
  display: "standalone",
  background_color: "#0f1614",
  theme_color: "#1f6b52",
  icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
});

export default manifest;
