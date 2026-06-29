import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // iyzipay is a CJS-native module — keep it out of the webpack bundle
  serverExternalPackages: ["iyzipay"],
};

export default nextConfig;
