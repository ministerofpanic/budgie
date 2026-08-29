import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@budgie/core"],
  typedRoutes: true,
};

export default config;
