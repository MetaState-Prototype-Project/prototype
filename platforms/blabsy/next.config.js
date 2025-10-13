/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    images: {
        unoptimized: true
    },
    eslint: {
        ignoreDuringBuilds: true
    },
    output: 'standalone',
};

module.exports = nextConfig;
