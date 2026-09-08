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
  // Dev runs on Turbopack (the Next 16 default), which this webpack-based
  // plugin doesn't support - only the production build (`next build
  // --webpack`, see package.json) compiles the service worker.
  disable: process.env.NODE_ENV !== "production",
});

export default withSerwist(config);
