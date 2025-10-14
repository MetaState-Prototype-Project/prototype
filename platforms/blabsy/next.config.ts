import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    images: {
        unoptimized: true
    },
    eslint: {
        ignoreDuringBuilds: true
    },
    output: 'standalone',
    distDir: '.next',
    outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
