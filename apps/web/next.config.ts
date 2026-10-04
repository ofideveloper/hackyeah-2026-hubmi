import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Unikaj mylenia workspace root z /Users/.../yarn.lock poza monorepo
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Testy E2E budują do osobnego katalogu, żeby nie nadpisać `.next` działającego dev-a
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
