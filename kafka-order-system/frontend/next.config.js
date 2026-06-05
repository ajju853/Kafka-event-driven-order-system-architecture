/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["localhost"],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_GATEWAY || "http://localhost:4001"}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
