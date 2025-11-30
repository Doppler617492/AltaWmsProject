const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Temporarily disable PWA to avoid stale cached chunks during active development
  disable: true,
})

const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Remove build-time console logs in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },
  // Avoid ETag/304 on API routes that breaks client JSON handling
  generateEtags: false,
  // Force a unique build ID to hard-bust any cached chunks on client
  generateBuildId: async () => {
    return 'build-' + Date.now().toString();
  },
  typescript: {
    // Allow production builds despite type errors in legacy components
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
}

module.exports = withPWA(nextConfig)
