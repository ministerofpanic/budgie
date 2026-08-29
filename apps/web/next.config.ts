import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@budgie/core", "@budgie/db"],
  typedRoutes: true,
};

export default config;
