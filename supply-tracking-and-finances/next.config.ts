import type { NextConfig } from "next";

interface ExtendedConfig extends NextConfig {
  eslint?: {
    ignoreDuringBuilds?: boolean;
  };
}

const nextConfig: ExtendedConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
