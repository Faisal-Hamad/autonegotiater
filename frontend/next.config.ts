import type { NextConfig } from "next";

// Deliberate, immutable artifact choice. Runtime USE_MOCK_DATA cannot turn a normal
// production artifact into a demo or connect an isolated demo to a real backend.
const isolatedDemo = process.env.AUTONEG_ISOLATED_DEMO_BUILD === "true";
const nextConfig: NextConfig = {
  output: "standalone",
  env: { NEXT_PUBLIC_AUTONEG_DEMO_BUILD: isolatedDemo ? "true" : "false", NEXT_PUBLIC_AUTONEG_REAL_MODE: isolatedDemo ? "false" : "true" },
  async rewrites() { return [{source:"/api/:path*",destination:`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000"}/:path*`}]; },
  distDir: process.env.AUTONEG_BUILD_DIR === ".next-demo" ? ".next-demo" : process.env.AUTONEG_BUILD_DIR === ".next-release" ? ".next-release" : ".next",
  async headers() {
    if (!isolatedDemo) return [];
    return [{ source: "/:path*", headers: [
      { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ] }];
  },
};
export default nextConfig;
