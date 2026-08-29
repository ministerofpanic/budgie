import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@budgie/budget", "@budgie/core", "@budgie/db"],
  typedRoutes: true,
};

export default config;
