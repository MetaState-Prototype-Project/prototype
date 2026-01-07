import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
    output: 'standalone',
    outputFileTracingRoot: path.join(__dirname),

    // 🔴 Critical for Safari 16 compatibility
    transpilePackages: [
        'marked',
        '@milkdown/preset-gfm',
    ],
};

export default nextConfig;
