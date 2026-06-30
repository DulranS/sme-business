import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // This app keeps its own lockfile; pin the Turbopack workspace root to this
  // directory so Next does not infer the parent monorepo root (which carries a
  // sibling lockfile) and emit a workspace-root warning.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
