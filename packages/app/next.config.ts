import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@xbridge/sdk", "@xbridge/config"],
};

export default nextConfig;
