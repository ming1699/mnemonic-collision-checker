/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
      };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: '/api/etherscan/:path*',
        destination: 'https://api.etherscan.io/api/:path*',
      },
      {
        source: '/api/bscscan/:path*',
        destination: 'https://api.bscscan.com/api/:path*',
      },
      {
        source: '/api/polygonscan/:path*',
        destination: 'https://api.polygonscan.com/api/:path*',
      },
      {
        source: '/api/hecoinfo/:path*',
        destination: 'https://api.hecoinfo.com/api/:path*',
      },
    ]
  }
};

module.exports = nextConfig; 