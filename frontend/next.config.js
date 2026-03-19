/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Inject runtime config script into every page
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
