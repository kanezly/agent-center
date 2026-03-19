/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Inject runtime config script into every page
  async rewrites() {
    // Use environment variable for API proxy target
    // Local dev: http://localhost:8010
    // Docker: http://backend:8010
    const apiTarget = process.env.API_DOMAIN || 'http://localhost:8010';
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
