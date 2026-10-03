import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Unikaj mylenia workspace root z /Users/.../yarn.lock poza monorepo
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
