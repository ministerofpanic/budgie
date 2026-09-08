import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@budgie/budget", "@budgie/core", "@budgie/db"],
  typedRoutes: true,
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Both dev and build run webpack explicitly (see package.json) since
  // this plugin doesn't support Turbopack. Serwist itself stays disabled
  // outside production so dev never compiles a real service worker.
  disable: process.env.NODE_ENV !== "production",
});

export default withSerwist(config);
