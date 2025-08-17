import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone build for Docker
  output: 'standalone',
  
  // Disable ESLint during build to avoid blocking on warnings
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Environment variables that should be available on client-side
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
    NEXT_PUBLIC_IMAGE_URL: process.env.NEXT_PUBLIC_IMAGE_URL,
  },
  
  // Redirect configuration for health checks
  async rewrites() {
    return [
      {
        source: '/health',
        destination: '/api/health',
      },
      {
        source: '/health/live',
        destination: '/api/health',
      },
      {
        source: '/health/ready',
        destination: '/api/health',
      },
    ];
  },
  
  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
