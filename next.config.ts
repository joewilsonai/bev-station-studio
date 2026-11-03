import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  outputFileTracingIncludes: { "/api/**": ["./data/**/*"] },
};
export default config;
