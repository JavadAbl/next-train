import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow dev-mode assets/HMR through the public preview proxy domain
  // (the app is served from https://preview-*.space-z.ai, which tunnels to localhost:3000).
  allowedDevOrigins: ["*.space-z.ai"],
};

export default nextConfig;
