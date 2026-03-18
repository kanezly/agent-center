/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Use the same env var as the client, fallback to 8010
    const backendUrl = process.env.NEXT_PUBLIC_API_DOMAIN || 'http://localhost:8010';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
