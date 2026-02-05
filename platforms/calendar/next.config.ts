import type { NextConfig } from "next";
import path from "path";
import { loadEnvConfig } from "@next/env";

// Load .env* from monorepo root so NEXT_PUBLIC_* and others come from root (Next.js load order)
const rootDir = path.resolve(__dirname, "../..");
loadEnvConfig(rootDir);

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
