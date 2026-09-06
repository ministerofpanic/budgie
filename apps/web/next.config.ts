import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@budgie/budget", "@budgie/core", "@budgie/db"],
  typedRoutes: true,
  // Temporary: lets the browser devtools resolve minified stack traces
  // (e.g. "Minified React error #NNN") back to real component/file/line
  // names, without changing what's actually shipped to the browser - only
  // fetched when devtools is open. Revert once done debugging.
  productionBrowserSourceMaps: true,
};

export default config;
